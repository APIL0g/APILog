from __future__ import annotations

import json
import logging
import os
import re
import threading
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException

from config import (
    AI_REPORT_LLM_PROVIDER,
    DYNAMIC_WIDGETS_PATH,
    LLM_PROVIDER,
)
from plugins.widgets.ai_insights.explain_service import (
    _call_ollama_resilient,
    _call_openai_compatible as _call_ai_insights_openai,
    _extract_json,
    _now_iso,
)
from plugins.widgets.ai_report.service import (
    _call_openai_compatible as _call_ai_report_openai,
)
from plugins.widgets.ai_insights.service import _sql_query, _validate_site_id

from .schemas import DynamicWidgetData, DynamicWidgetSpec, GeneratedWidgetRequest

log = logging.getLogger("dynamic_widgets")

_STORE_LOCK = threading.Lock()
_WIDGETS: Dict[str, DynamicWidgetSpec] = {}
_LOADED = False


def _ensure_loaded() -> None:
    global _LOADED, _WIDGETS
    if _LOADED:
        return
    with _STORE_LOCK:
        if _LOADED:
            return
        path = DYNAMIC_WIDGETS_PATH
        widgets: Dict[str, DynamicWidgetSpec] = {}
        try:
            if path and os.path.exists(path):
                with open(path, "r", encoding="utf-8") as f:
                    raw = json.load(f)
                for item in raw.get("widgets", []):
                    try:
                        spec = DynamicWidgetSpec(**item)
                        if spec.id:
                            widgets[spec.id] = spec
                    except Exception:
                        continue
        except Exception as exc:
            try:
                log.warning("Failed to load dynamic widgets from %s: %s", path, exc)
            except Exception:
                pass
            widgets = {}
        _WIDGETS = widgets
        _LOADED = True


def _save() -> None:
    path = DYNAMIC_WIDGETS_PATH
    if not path:
        return
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
    except Exception:
        # Best-effort only; in-memory widgets will still work for this process
        pass
    payload = {"widgets": [spec.model_dump(mode="json") for spec in _WIDGETS.values()]}
    tmp_path = path + ".tmp"
    try:
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        os.replace(tmp_path, path)
    except Exception as exc:
        try:
            log.warning("Failed to persist dynamic widgets to %s: %s", path, exc)
        except Exception:
            pass


def _slugify(title: str) -> str:
    base = re.sub(r"[^a-zA-Z0-9_-]+", "-", title.lower()).strip("-")
    if not base:
        base = "widget"
    suffix = uuid.uuid4().hex[:8]
    return f"dyn_{base}_{suffix}"


def _safe_sql(sql: str) -> str:
    s = (sql or "").strip()
    if not s:
        raise HTTPException(status_code=400, detail={"message": "SQL must not be empty"})
    lower = s.lower()
    if not lower.startswith("select"):
        raise HTTPException(status_code=400, detail={"message": "Only SELECT queries are allowed"})
    forbidden = ["insert", "update", "delete", "drop", "alter", "truncate"]
    if any(word in lower for word in forbidden):
        raise HTTPException(
            status_code=400,
            detail={"message": "Only read-only SELECT queries over the events table are allowed"},
        )
    return s


def _render_sql(template: str, from_ts: str, to_ts: str, bucket: str, site_id: Optional[str]) -> str:
    sql = template
    bucket_interval = _bucket_interval_sql(bucket)
    replacements = {
        "{{from}}": from_ts,
        "{{to}}": to_ts,
        "{{bucket}}": bucket,
        "{{bucket_interval}}": bucket_interval,
    }
    if site_id is not None:
        replacements["{{site_id}}"] = site_id
    for key, value in replacements.items():
        sql = sql.replace(key, value)
    return sql


def _bucket_interval_sql(bucket: str) -> str:
    s = (bucket or "").strip().lower()
    match = re.fullmatch(r"(\d+)\s*([smhd])", s)
    if not match:
        return "INTERVAL '1 hour'"
    value = match.group(1)
    unit = match.group(2)
    label = {"s": "second", "m": "minute", "h": "hour", "d": "day"}.get(unit, "hour")
    return f"INTERVAL '{value} {label}'"


def _default_time_range(bucket: str) -> tuple[str, str]:
    now = datetime.now(timezone.utc)
    # Simple heuristic: if bucket is daily, look back 30 days, otherwise 7 days
    days = 30 if bucket.endswith("d") else 7
    start = now - timedelta(days=days)
    return (
        start.replace(microsecond=0).isoformat(),
        now.replace(microsecond=0).isoformat(),
    )


def list_widgets() -> List[DynamicWidgetSpec]:
    _ensure_loaded()
    return list(_WIDGETS.values())


def get_widget(widget_id: str) -> DynamicWidgetSpec:
    _ensure_loaded()
    spec = _WIDGETS.get(widget_id)
    if not spec:
        raise HTTPException(status_code=404, detail={"message": "Widget not found"})
    return spec


def _resolve_widget_llm_provider() -> tuple[str, bool]:
    """Returns (provider, use_ai_report_config)."""
    primary = (LLM_PROVIDER or "").strip().lower()
    if primary and primary not in {"disabled", "none"}:
        return primary, False

    fallback = (AI_REPORT_LLM_PROVIDER or "").strip().lower()
    if fallback and fallback not in {"disabled", "none"}:
        return fallback, True
    return "", False


def _call_llm(messages: List[Dict[str, str]]) -> Dict[str, Any]:
    provider, use_ai_report_config = _resolve_widget_llm_provider()
    if not provider:
        raise HTTPException(status_code=503, detail={"message": "LLM provider is not configured"})
    try:
        if provider in ("vllm", "openai_compat", "openai"):
            if use_ai_report_config:
                content = _call_ai_report_openai(messages)
            else:
                content = _call_ai_insights_openai(messages)
        elif provider == "ollama":
            content = _call_ollama_resilient(messages)
        else:
            raise RuntimeError(f"Unsupported LLM provider: {provider}")
    except HTTPException:
        # Bubble up HTTPException from underlying helpers as-is
        raise
    except Exception as exc:
        try:
            log.exception("[dynamic_widgets] LLM call failed")
        except Exception:
            pass
        raise HTTPException(
            status_code=502,
            detail={"message": "LLM call failed while generating widget", "error": str(exc)[:500]},
        )

    try:
        parsed = _extract_json(content)
        if not isinstance(parsed, dict):
            raise ValueError("Expected a JSON object from LLM")
        return parsed
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail={"message": "Failed to parse LLM JSON for widget spec", "error": str(exc)[:500]},
        )


_SCHEMA_INSTRUCTIONS = """
You design analytic widgets for the APILog product.

You receive a natural-language requirement (in Korean or English) and must respond with a single JSON object describing ONE widget.
The JSON must match this schema (top-level, no extra fields):

{
  "title": string,
  "description": string,
  "sql": string,
  "chart": {
    "type": "line" | "bar" | "pie" | "table" | "metric" | "area",
    "x": string,
    "y": string,
    "series_field": string | null,
    "value_format": string | null,
    "options": object
  }
}

Rules for the SQL string:
- Use InfluxDB 3 SQL over a table named events.
- Never modify or drop data; read-only SELECT queries only.
- Prefer time-bucketed metrics and aggregate values (COUNT, SUM, AVG, etc.).
- When you need a time filter, use placeholders exactly like:
  WHERE time >= TIMESTAMP '{{from}}' AND time < TIMESTAMP '{{to}}'
- When you need to filter by site, use:
  AND site_id = '{{site_id}}'
- For time bucketing, prefer functions like DATE_BIN({{bucket_interval}}, time) AS t (and alias the metric as v). Avoid unsupported helpers such as time_bucket.
- '{{bucket_interval}}' is already a full INTERVAL literal (e.g. INTERVAL '1 hour'). Use '{{bucket}}' only when the raw string (like 1h) is needed outside of SQL intervals.
- Do not include markdown fences or comments; output PURE JSON only.

events tags (dimensions):
- site_id, path, page_variant, event_name, element_hash,
  device_type, browser_family, country_code, utm_source, utm_campaign

events fields (metrics):
- count, dwell_ms, scroll_pct, click_x, click_y,
  viewport_w, viewport_h, funnel_step, error_flag, bot_score,
  extra_json, session_id, user_hash
""".strip()


def generate_widget_from_requirement(req: GeneratedWidgetRequest) -> DynamicWidgetSpec:
    requirement = (req.requirement or "").strip()
    if not requirement:
        raise HTTPException(status_code=400, detail={"message": "requirement must not be empty"})

    user_parts = [
        f"Requirement: {requirement}",
        f"Language: {req.language or 'ko'}",
    ]
    if req.site_id:
        user_parts.append(f"Target site_id (if used): {req.site_id}")
    if req.preferred_chart:
        user_parts.append(f"Preferred chart type: {req.preferred_chart}")
    user_text = "\n".join(user_parts)

    messages = [
        {"role": "system", "content": _SCHEMA_INSTRUCTIONS},
        {"role": "user", "content": user_text},
    ]

    payload = _call_llm(messages)

    chart = payload.get("chart") or {}
    if req.preferred_chart and not chart.get("type"):
        chart["type"] = req.preferred_chart
    payload["chart"] = chart

    try:
        spec = DynamicWidgetSpec(**payload)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail={"message": "LLM returned an invalid widget spec", "error": str(exc)[:500]},
        )

    spec.sql = _safe_sql(spec.sql)

    with _STORE_LOCK:
        _ensure_loaded()
        widget_id = spec.id or _slugify(spec.title)
        # Ensure uniqueness
        while widget_id in _WIDGETS:
            widget_id = _slugify(spec.title)
        spec.id = widget_id
        spec.language = req.language or spec.language or "ko"
        spec.site_id = req.site_id or spec.site_id
        spec.created_at = _now_iso()
        _WIDGETS[widget_id] = spec
        _save()

    return spec


def query_widget_data(
    widget_id: str,
    from_ts: Optional[str],
    to_ts: Optional[str],
    bucket: str,
    site_id: Optional[str],
) -> DynamicWidgetData:
    spec = get_widget(widget_id)

    if not from_ts or not to_ts:
        from_ts, to_ts = _default_time_range(bucket)

    if site_id:
        try:
            site_id = _validate_site_id(site_id)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail={"message": str(exc)})

    sql = _render_sql(spec.sql, from_ts, to_ts, bucket, site_id)

    try:
        rows = _sql_query(sql)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail={"message": "Failed to execute dynamic widget query", "error": str(exc)[:500]},
        )

    meta: Dict[str, Any] = {
        "widget_id": widget_id,
        "from": from_ts,
        "to": to_ts,
        "bucket": bucket,
        "site_id": site_id,
        "sql": sql,
        "created_at": spec.created_at,
        "title": spec.title,
        "chart": spec.chart.model_dump(mode="json"),
    }
    return DynamicWidgetData(rows=rows, meta=meta)
