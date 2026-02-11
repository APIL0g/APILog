from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

import httpx
from influxdb_client_3 import InfluxDBClient3

from config import (
    AI_REPORT_LLM_API_KEY,
    AI_REPORT_LLM_ENDPOINT,
    AI_REPORT_LLM_MAX_TOKENS,
    AI_REPORT_LLM_MODEL,
    AI_REPORT_LLM_PROVIDER,
    AI_REPORT_LLM_TEMPERATURE,
    AI_REPORT_LLM_TIMEOUT_S,
    INFLUX_DATABASE,
    INFLUX_URL,
)
from .schemas import ReportResponse

log = logging.getLogger("ai_report")

# -- Section keys that the LLM is expected to produce --
REPORT_SECTIONS = [
    "diagnostics",
    "page_issues",
    "error_analysis",
    "ux_recommendations",
    "tech_recommendations",
    "priorities",
    "metrics_to_track",
]

JSON_RETRY_PROMPT = (
    "The previous response was not valid JSON. Re-read the instructions and respond AGAIN "
    "with strict JSON only (no markdown fences, no explanations). The output must be a single "
    "JSON object that matches the requested schema."
)

_TRAILING_COMMA_RE = re.compile(r",(\s*[}\]])")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _llm_available() -> bool:
    """Return True if OpenAI-compatible LLM credentials are configured."""
    provider = (AI_REPORT_LLM_PROVIDER or "").strip().lower()
    if provider in {"none", "disabled"}:
        return False
    return bool((AI_REPORT_LLM_API_KEY or "").strip())


# ---------------------------------------------------------------------------
# LLM call helpers
# ---------------------------------------------------------------------------

def _call_openai_compatible(messages: List[Dict[str, str]]) -> str:
    base = (AI_REPORT_LLM_ENDPOINT or "https://api.openai.com").rstrip("/")
    url = base + "/v1/chat/completions"
    headers = {"Content-Type": "application/json"}
    api_key = (AI_REPORT_LLM_API_KEY or "").strip()
    if not api_key:
        raise RuntimeError("OpenAI-compatible provider requires LLM_API_KEY")
    headers["Authorization"] = f"Bearer {api_key}"
    payload: Dict[str, Any] = {
        "model": AI_REPORT_LLM_MODEL,
        "messages": messages,
        "response_format": {"type": "json_object"},
    }
    if AI_REPORT_LLM_TEMPERATURE not in (None, ""):
        payload["temperature"] = float(AI_REPORT_LLM_TEMPERATURE)
    if AI_REPORT_LLM_MAX_TOKENS:
        payload["max_tokens"] = int(AI_REPORT_LLM_MAX_TOKENS)
    timeout_seconds = max(5.0, float(AI_REPORT_LLM_TIMEOUT_S or 60.0))
    timeout = httpx.Timeout(timeout_seconds, connect=min(10.0, timeout_seconds / 2))
    with httpx.Client(timeout=timeout) as client:
        response = client.post(url, headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()
    choice = (data.get("choices") or [{}])[0]
    message = choice.get("message") or {}
    return _message_content_to_str(message)


def _retry_llm_for_json(messages: List[Dict[str, str]], last_content: Optional[str]) -> Optional[str]:
    retry_msgs = [dict(m) for m in messages]
    snippet = (last_content or "").strip()
    if snippet:
        retry_msgs.append({"role": "assistant", "content": snippet[:4000]})
    retry_msgs.append({"role": "user", "content": JSON_RETRY_PROMPT})
    try:
        return _call_openai_compatible(retry_msgs)
    except Exception as exc:
        log.warning("LLM retry failed: %s", exc)
        return None


def _message_content_to_str(message: Dict[str, Any]) -> str:
    content = message.get("content")
    if isinstance(content, str):
        return content
    return str(content or "")


# ---------------------------------------------------------------------------
# JSON extraction (robust parsing of LLM output)
# ---------------------------------------------------------------------------

_CODE_FENCE_RE = re.compile(r"^```(?:json)?\s*\n?", re.IGNORECASE)


def _extract_json(text: str) -> Dict[str, Any]:
    """Strip markdown fences, isolate first JSON object, parse it."""
    if not isinstance(text, str) or not text.strip():
        return {}

    # 1) strip code fences
    blob = text.strip()
    blob = _CODE_FENCE_RE.sub("", blob)
    if blob.endswith("```"):
        blob = blob[: blob.rfind("```")]
    blob = blob.strip()

    # 2) isolate first { ... } substring
    start = blob.find("{")
    if start == -1:
        return {}
    # find matching close brace (simple depth count, ignore strings for speed)
    depth = 0
    end = -1
    for i in range(start, len(blob)):
        if blob[i] == "{":
            depth += 1
        elif blob[i] == "}":
            depth -= 1
            if depth == 0:
                end = i
                break
    if end == -1:
        return {}
    candidate = blob[start : end + 1]

    # 3) try json.loads, with one fallback (trailing comma removal)
    for attempt in (candidate, _TRAILING_COMMA_RE.sub(r"\1", candidate)):
        try:
            data = json.loads(attempt)
            if isinstance(data, dict):
                return data
        except (json.JSONDecodeError, ValueError):
            continue
    return {}


# ---------------------------------------------------------------------------
# Integrated InfluxDB queries (replaces individual HTTP calls)
# ---------------------------------------------------------------------------

def _collect_report_bundle(days: int = 7) -> Dict[str, Any]:
    """Collect all data needed for the AI report via a single InfluxDB connection.

    Opens one client, runs 3 queries, then closes — avoiding 3x connection overhead.
    Fetches 14 days of data and splits into current (recent 7d) vs previous (prior 7d)
    to calculate week-over-week deltas for severity assessment.
    """
    now = datetime.now(timezone.utc)
    current_start = now - timedelta(days=days)
    previous_start = now - timedelta(days=days * 2)
    from_str = previous_start.strftime("%Y-%m-%d %H:%M:%S")
    mid_str = current_start.strftime("%Y-%m-%d %H:%M:%S")
    to_str = now.strftime("%Y-%m-%d %H:%M:%S")

    summary_sql = f"""
    SELECT
        device_type, browser_family, country_code, path, event_name,
        CASE WHEN time >= TIMESTAMP '{mid_str}' THEN 'current' ELSE 'previous' END AS period,
        COUNT(*) AS cnt,
        COUNT(DISTINCT session_id) AS sessions,
        AVG(dwell_ms) AS avg_dwell_ms,
        COUNT(dwell_ms) AS dwell_count,
        AVG(scroll_pct) AS avg_scroll_pct,
        COUNT(scroll_pct) AS scroll_count,
        SUM(CASE WHEN error_flag = true THEN 1 ELSE 0 END) AS error_count
    FROM events
    WHERE time >= TIMESTAMP '{from_str}' AND time < TIMESTAMP '{to_str}'
      AND session_id IS NOT NULL AND session_id <> ''
    GROUP BY device_type, browser_family, country_code, path, event_name,
             CASE WHEN time >= TIMESTAMP '{mid_str}' THEN 'current' ELSE 'previous' END
    """

    trend_sql = f"""
    SELECT DATE_BIN(INTERVAL '1 day', time) AS day, SUM("count")::BIGINT AS daily_count
    FROM events
    WHERE time >= TIMESTAMP '{from_str}' AND time < TIMESTAMP '{to_str}'
    GROUP BY day ORDER BY day ASC
    """

    exit_sql = f"""
    WITH last_view AS (
        SELECT session_id, MAX(time) AS last_time FROM events
        WHERE time >= TIMESTAMP '{mid_str}' AND time < TIMESTAMP '{to_str}'
          AND event_name = 'page_view' AND session_id IS NOT NULL AND session_id <> ''
        GROUP BY session_id
    ),
    exits AS (
        SELECT e.path, COUNT(DISTINCT e.session_id) AS exit_sessions
        FROM events e JOIN last_view lv ON e.session_id = lv.session_id AND e.time = lv.last_time
        GROUP BY e.path
    ),
    views AS (
        SELECT path, SUM(count) AS views FROM events
        WHERE time >= TIMESTAMP '{mid_str}' AND time < TIMESTAMP '{to_str}'
          AND event_name = 'page_view' GROUP BY path
    )
    SELECT v.path, v.views, COALESCE(x.exit_sessions,0) AS exits,
           ROUND(100.0*COALESCE(x.exit_sessions,0)/NULLIF(v.views,0),2) AS exit_rate
    FROM views v LEFT JOIN exits x ON v.path = x.path
    WHERE COALESCE(x.exit_sessions,0) > 0 ORDER BY exit_rate DESC, views DESC LIMIT 20
    """

    # Single connection for all 3 queries
    summary_rows: List[Dict[str, Any]] = []
    trend_rows: List[Dict[str, Any]] = []
    exit_rows: List[Dict[str, Any]] = []
    try:
        with InfluxDBClient3(host=INFLUX_URL, database=INFLUX_DATABASE) as client:
            summary_rows = client.query(summary_sql).to_pylist()
            trend_rows = client.query(trend_sql).to_pylist()
            exit_rows = client.query(exit_sql).to_pylist()
    except Exception as exc:
        log.warning("InfluxDB query failed: %s", exc)

    # -- Split summary_rows by period and build dimension maps --
    device_maps: Dict[str, Dict[str, int]] = {"current": {}, "previous": {}}
    browser_maps: Dict[str, Dict[str, int]] = {"current": {}, "previous": {}}
    country_maps: Dict[str, Dict[str, int]] = {"current": {}, "previous": {}}
    dwell_by_device: Dict[str, Dict[str, List[float]]] = {"current": {}, "previous": {}}
    error_aggs: Dict[str, Dict[Tuple[str, str], List[int]]] = {"current": {}, "previous": {}}

    # Health score accumulators (current period only)
    hs_total_cnt = 0        # total event count
    hs_total_errors = 0     # total error count
    hs_dwell_sum = 0.0      # weighted sum of avg_dwell_ms
    hs_dwell_count = 0      # number of rows with dwell data (page_view_dwell)
    hs_dwell_n = 0          # total valid dwell samples
    hs_scroll_sum = 0.0     # weighted sum of avg_scroll_pct
    hs_scroll_count = 0     # number of rows with scroll data (page_view_dwell)
    hs_scroll_n = 0         # total valid scroll samples
    hs_click_cnt = 0        # click event count

    for row in summary_rows:
        period = str(row.get("period") or "current")
        if period not in ("current", "previous"):
            period = "current"
        sessions = int(row.get("sessions") or 0)
        dev = str(row.get("device_type") or "unknown").lower()
        browser = str(row.get("browser_family") or "unknown")
        cc = str(row.get("country_code") or "unknown")
        event_name = str(row.get("event_name") or "")
        cnt = int(row.get("cnt") or 0)

        device_maps[period][dev] = device_maps[period].get(dev, 0) + sessions
        browser_maps[period][browser] = browser_maps[period].get(browser, 0) + sessions
        country_maps[period][cc] = country_maps[period].get(cc, 0) + sessions

        dwell = row.get("avg_dwell_ms")
        if dwell is not None:
            dwell_by_device[period].setdefault(dev, []).append(float(dwell))

        errs = int(row.get("error_count") or 0)
        if errs > 0 and cnt > 0:
            path = str(row.get("path") or "/")
            key = (path, browser)
            acc = error_aggs[period].get(key)
            if acc:
                acc[0] += errs
                acc[1] += cnt
            else:
                error_aggs[period][key] = [errs, cnt]

        # Health score accumulation (current period only)
        if period == "current":
            hs_total_cnt += cnt
            hs_total_errors += errs

            if event_name == "click":
                hs_click_cnt += cnt

            if event_name == "page_view_dwell":
                dwell_n = int(row.get("dwell_count") or 0)
                avg_d = row.get("avg_dwell_ms")
                if dwell_n > 0 and avg_d is not None:
                    hs_dwell_sum += float(avg_d) * dwell_n
                    hs_dwell_n += dwell_n
                    hs_dwell_count += 1

                scroll_n = int(row.get("scroll_count") or 0)
                avg_s = row.get("avg_scroll_pct")
                if scroll_n > 0 and avg_s is not None:
                    hs_scroll_sum += float(avg_s) * scroll_n
                    hs_scroll_n += scroll_n
                    hs_scroll_count += 1

    # -- Helper: compute percentage delta safely --
    def _pct_delta(current_val: float, previous_val: float) -> Optional[float]:
        if previous_val == 0:
            return None
        return round(100.0 * (current_val - previous_val) / previous_val, 1)

    # -- Build bundle from current period, with week-over-week deltas --
    cur_device = device_maps["current"]
    prev_device = device_maps["previous"]
    total_sessions = sum(cur_device.values()) or 1

    def _top_n(mapping: Dict[str, int], key_name: str, n: int = 10) -> List[Dict[str, Any]]:
        return sorted(
            [{key_name: k, "sessions": v} for k, v in mapping.items()],
            key=lambda x: -x["sessions"],
        )[:n]

    # Device share with delta
    device_share = []
    for d in _top_n(cur_device, "device"):
        entry: Dict[str, Any] = {**d, "pct": round(100.0 * d["sessions"] / total_sessions, 2)}
        prev_s = prev_device.get(d["device"], 0)
        delta = _pct_delta(d["sessions"], prev_s)
        if delta is not None:
            entry["delta_pct"] = delta
        device_share.append(entry)

    # Browser share with delta
    browser_share = []
    for b in _top_n(browser_maps["current"], "browser"):
        entry_b: Dict[str, Any] = dict(b)
        prev_s = browser_maps["previous"].get(b["browser"], 0)
        delta = _pct_delta(b["sessions"], prev_s)
        if delta is not None:
            entry_b["delta_pct"] = delta
        browser_share.append(entry_b)

    # Country share with delta
    country_share = []
    for c in _top_n(country_maps["current"], "code"):
        entry_c: Dict[str, Any] = dict(c)
        prev_s = country_maps["previous"].get(c["code"], 0)
        delta = _pct_delta(c["sessions"], prev_s)
        if delta is not None:
            entry_c["delta_pct"] = delta
        country_share.append(entry_c)

    # Dwell by device with delta
    cur_dwell = dwell_by_device["current"]
    prev_dwell = dwell_by_device["previous"]
    avg_dwell_by_device: Dict[str, Any] = {}
    for dev, vals in cur_dwell.items():
        if not vals:
            continue
        cur_avg = round(sum(vals) / len(vals), 1)
        dwell_entry: Dict[str, Any] = {"current_ms": cur_avg}
        prev_vals = prev_dwell.get(dev, [])
        if prev_vals:
            prev_avg = round(sum(prev_vals) / len(prev_vals), 1)
            dwell_entry["previous_ms"] = prev_avg
            delta = _pct_delta(cur_avg, prev_avg)
            if delta is not None:
                dwell_entry["delta_pct"] = delta
        avg_dwell_by_device[dev] = dwell_entry

    # Error analysis with delta
    cur_errors = error_aggs["current"]
    prev_errors = error_aggs["previous"]
    error_list: List[Dict[str, Any]] = []
    for (p, b), v in cur_errors.items():
        if v[1] <= 0:
            continue
        cur_rate = round(100.0 * v[0] / v[1], 2)
        entry_err: Dict[str, Any] = {"path": p, "browser": b, "error_rate": cur_rate}
        prev_v = prev_errors.get((p, b))
        if prev_v and prev_v[1] > 0:
            prev_rate = round(100.0 * prev_v[0] / prev_v[1], 2)
            entry_err["previous_error_rate"] = prev_rate
            entry_err["delta_pp"] = round(cur_rate - prev_rate, 2)
        error_list.append(entry_err)
    error_list.sort(key=lambda x: -x["error_rate"])

    # Total traffic delta
    total_delta = _pct_delta(sum(cur_device.values()), sum(prev_device.values()))

    bundle: Dict[str, Any] = {
        "period_info": {
            "current": f"{mid_str} ~ {to_str}",
            "previous": f"{from_str} ~ {mid_str}",
            "current_total_sessions": sum(cur_device.values()),
            "previous_total_sessions": sum(prev_device.values()),
            "total_traffic_delta_pct": total_delta,
        },
        "device_share": device_share,
        "browser_share": browser_share,
        "country_share": country_share,
        "page_exit_rate": [
            {"path": str(r.get("path") or "/"), "views": int(r.get("views") or 0),
             "exits": int(r.get("exits") or 0), "exit_rate": float(r.get("exit_rate") or 0)}
            for r in exit_rows[:15]
        ],
        "avg_dwell_by_device": avg_dwell_by_device,
        "daily_count": [
            {"date": str(r.get("day", ""))[:10], "cnt": int(r.get("daily_count") or 0)}
            for r in trend_rows
        ],
        "error_analysis": error_list[:10],
    }

    # -- Health Score 5-axis (0~100, null if insufficient data) --
    _MIN_SAMPLES = 30
    _MIN_RATIO = 0.10  # 10% of total events

    def _sufficient(n: int) -> bool:
        return n >= _MIN_SAMPLES and (hs_total_cnt == 0 or n / hs_total_cnt >= _MIN_RATIO)

    # 1) 안정성: (1 - error_rate) × 100
    if hs_total_cnt > 0:
        stability = round((1.0 - hs_total_errors / hs_total_cnt) * 100, 1)
    else:
        stability = None

    # 2) 참여도: avg dwell_ms → 0~100 (cap at 10_000ms = 100)
    _DWELL_CAP_MS = 10_000
    if _sufficient(hs_dwell_n):
        raw_dwell = hs_dwell_sum / hs_dwell_n
        engagement = round(min(raw_dwell / _DWELL_CAP_MS, 1.0) * 100, 1)
    else:
        engagement = None

    # 3) 콘텐츠 소비: avg scroll_pct (0~1) → 0~100
    if _sufficient(hs_scroll_n):
        raw_scroll = hs_scroll_sum / hs_scroll_n
        content_consumption = round(min(max(raw_scroll, 0.0), 1.0) * 100, 1)
    else:
        content_consumption = None

    # 4) 유지력: (1 - overall_exit_rate) × 100
    total_views = sum(int(r.get("views") or 0) for r in exit_rows)
    total_exits = sum(int(r.get("exits") or 0) for r in exit_rows)
    if total_views > 0:
        retention = round((1.0 - total_exits / total_views) * 100, 1)
    else:
        retention = None

    # 5) 상호작용: click_count / total_events × 100
    if hs_total_cnt > 0:
        interactivity = round(hs_click_cnt / hs_total_cnt * 100, 1)
    else:
        interactivity = None

    bundle["health_score"] = {
        "stability": stability,
        "engagement": engagement,
        "content_consumption": content_consumption,
        "retention": retention,
        "interactivity": interactivity,
    }

    return bundle


# ---------------------------------------------------------------------------
# LLM prompt construction
# ---------------------------------------------------------------------------

_SCHEMA_HINT = {
    "generated_at": "ISO8601 string",
    "title": "AI 리포트",
    "summary": "string (include overall traffic delta from period_info)",
    "diagnostics": [{"focus": "모바일Chrome", "finding": "string", "widget": "device_share", "severity": "High", "delta_pct": -12.5}],
    "page_issues": [{"page": "/checkout", "issue": "string", "widget": "page_exit_rate", "dwell_time": "12s", "exit_rate": "65%"}],
    "error_analysis": [{"path": "/checkout", "browser": "Safari", "error_rate": 8.2, "detail": "string"}],
    "ux_recommendations": [{"category": "UX", "suggestion": "string", "rationale": "string", "validation": "string"}],
    "tech_recommendations": [{"category": "Tech", "suggestion": "string", "rationale": "string", "validation": "string"}],
    "priorities": [{"title": "string", "priority": "High|Medium|Low", "impact": "string"}],
    "metrics_to_track": [{"metric": "page_exit_rate", "widget": "page_exit_rate", "reason": "string"}],
    "health_score": "(server-computed, do NOT generate — just pass through from bundle)",
    "meta": {"prompt_version": "v4"},
}

_SYSTEM_PROMPT = (
    "You are a senior analytics engineer. Return STRICT JSON ONLY that matches the schema. "
    "No preface, no markdown, no extra text. Reply in Korean when language=ko.\n\n"
    "CRITICAL RULES:\n"
    "- ALL numbers in your response MUST come from the WIDGET_API_BUNDLE data below.\n"
    "- Do NOT invent, hallucinate, or estimate any numeric values.\n"
    "- Your role is to INTERPRET and EXPLAIN the data, not to generate data.\n"
    "- If the data is insufficient for a section, return an empty array [].\n\n"
    "WEEK-OVER-WEEK DELTA RULES:\n"
    "- The bundle contains `period_info` with current vs previous 7-day totals and `total_traffic_delta_pct`.\n"
    "- Each item in device_share, browser_share, country_share may have `delta_pct` (% change vs previous week).\n"
    "- avg_dwell_by_device entries have `current_ms`, `previous_ms`, `delta_pct`.\n"
    "- error_analysis entries may have `previous_error_rate` and `delta_pp` (percentage-point change).\n"
    "- Use these deltas to determine severity in `diagnostics`:\n"
    "  * High: delta >= +20% degradation (e.g. sessions drop >=20%, error rate rise >=3pp, dwell drop >=20%)\n"
    "  * Medium: delta 5~20% degradation\n"
    "  * Low: delta <5% or improvement\n"
    "- Include `delta_pct` in each diagnostic item so the frontend can display the change.\n"
    "- Mention the week-over-week change in `finding` text (e.g. '전주 대비 15.2% 감소').\n\n"
    "HEALTH SCORE:\n"
    "- The bundle includes `health_score` with 5 axes (0~100, null = insufficient data).\n"
    "- Do NOT generate or modify health_score values. They are pre-computed by the server.\n"
    "- Reference health_score in your `summary` to describe overall site health."
)


def _build_messages(bundle: Dict[str, Any], prompt: str, language: str, audience: str, word_limit: int) -> List[Dict[str, str]]:
    soft_prompt = (prompt or "").strip()[:400]
    user_prompt = (
        f"Language: {language}\n"
        f"Audience: {audience}\n"
        f"WordLimit: {word_limit}\n"
        f"UserHint(LightlyIncorporate): {soft_prompt}\n\n"
        "Build an AI report with these sections:\n"
        "- `diagnostics`: 2~4 core issues by device/browser/country, citing actual numbers AND week-over-week delta_pct from the data. "
        "Set severity based on the delta (High/Medium/Low per the rules). Include delta_pct as a number.\n"
        "- `page_issues`: pages with high exit rate AND low dwell time from page_exit_rate data.\n"
        "- `error_analysis`: paths + browsers with notable error rates from error_analysis data. Mention delta_pp if available.\n"
        "- `ux_recommendations`: actionable UX fixes with validation methods.\n"
        "- `tech_recommendations`: technical fixes with monitoring approach.\n"
        "- `priorities`: rank recommendations by effort vs impact as High/Medium/Low.\n"
        "- `metrics_to_track`: which metrics to monitor after improvements, using only fields that exist in the data.\n\n"
        "Respond with JSON only, conforming to this schema:\n"
        f"{json.dumps(_SCHEMA_HINT, ensure_ascii=False)}\n\n"
        f"WIDGET_API_BUNDLE:\n{json.dumps(bundle, ensure_ascii=False)}"
    )
    return [{"role": "system", "content": _SYSTEM_PROMPT}, {"role": "user", "content": user_prompt}]


# ---------------------------------------------------------------------------
# Section-level validation
# ---------------------------------------------------------------------------

_SECTION_DEFAULTS = {"ux_recommendations": "UX", "tech_recommendations": "Tech"}


def _validate_sections(data: Dict[str, Any]) -> Tuple[Dict[str, Any], List[str]]:
    """Validate each section: ensure list[dict], set category defaults.

    Returns (cleaned_data, partial_failures).
    """
    partial_failures: List[str] = []

    for key in REPORT_SECTIONS:
        value = data.get(key)
        if not isinstance(value, list):
            data[key] = []
            if value is not None:
                partial_failures.append(key)
            continue
        data[key] = [item for item in value if isinstance(item, dict)]

    # Fill missing category on recommendations
    for key, default_cat in _SECTION_DEFAULTS.items():
        for item in data[key]:
            item.setdefault("category", default_cat)

    return data, partial_failures


# ---------------------------------------------------------------------------
# Error report
# ---------------------------------------------------------------------------

def _error_report(reason: str) -> Dict[str, Any]:
    """Return an explicit error response instead of fake data when LLM fails."""
    return _finalize_report(
        {
            "generated_at": _now_iso(),
            "title": "AI 리포트 생성 실패",
            "summary": f"리포트 생성에 실패했습니다. 다시 시도해주세요. (사유: {reason})",
            "meta": {"mode": "error", "prompt_version": "v4"},
        },
        mode="error",
    )


# ---------------------------------------------------------------------------
# Finalize
# ---------------------------------------------------------------------------

def _finalize_report(
    payload: Dict[str, Any],
    mode: str,
    partial_failures: Optional[List[str]] = None,
) -> Dict[str, Any]:
    payload.setdefault("generated_at", _now_iso())
    meta = payload.get("meta") if isinstance(payload.get("meta"), dict) else {}
    meta.update(
        mode=mode,
        provider=AI_REPORT_LLM_PROVIDER or "openai",
        model=AI_REPORT_LLM_MODEL or "unknown",
        prompt_version="v4",
    )
    if partial_failures:
        meta["partial_failures"] = partial_failures
    payload["meta"] = meta
    return ReportResponse(**payload).model_dump()


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def generate_report(
    from_ts: Optional[str],
    to_ts: Optional[str],
    bucket: str,
    site_id: Optional[str],
    *,
    prompt: str,
    language: str,
    audience: str,
    word_limit: int,
) -> Dict[str, Any]:
    if not _llm_available():
        return _error_report(reason="API 키가 설정되지 않아 리포트를 생성할 수 없습니다.")

    bundle = _collect_report_bundle()
    messages = _build_messages(bundle, prompt, language, audience, word_limit)

    try:
        content = _call_openai_compatible(messages)

        data = _extract_json(content)
        if not data:
            log.warning("LLM returned invalid JSON, retrying. snippet=%s", _safe_snippet(content))
            repaired = _retry_llm_for_json(messages, content)
            if repaired:
                data = _extract_json(repaired)
        if not data:
            raise ValueError("invalid JSON from LLM")

        data, partial_failures = _validate_sections(data)
        # Inject server-computed health_score (LLM must not generate this)
        data["health_score"] = bundle.get("health_score")
        return _finalize_report(data, mode="llm", partial_failures=partial_failures or None)
    except Exception as exc:
        log.warning("LLM failed: %s", exc)
        return _error_report(reason=str(exc))


def _safe_snippet(text: Any, limit: int = 1200) -> str:
    s = str(text or "")[:limit]
    return s.replace("\n", "\\n")
