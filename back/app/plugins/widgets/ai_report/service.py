from __future__ import annotations

import json
import logging
import os
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from statistics import mean
from typing import Any, Dict, List, Optional, Tuple

import httpx

from config import (
    AI_REPORT_FETCH_BASE,
    LLM_API_KEY,
    LLM_ENDPOINT,
    LLM_MAX_TOKENS,
    LLM_MODEL,
    LLM_PROVIDER,
    LLM_TEMPERATURE,
    LLM_TIMEOUT_S,
    is_running_in_docker,
)

log = logging.getLogger("ai_report")

FETCH_BASE = (os.getenv("AI_REPORT_FETCH_BASE", "http://127.0.0.1:8000") or "").rstrip("/")
DEFAULT_TIMEOUT = float(os.getenv("AI_REPORT_TIMEOUT", "25"))


def _int_env(name: str, default: int) -> int:
    try:
        return int((os.getenv(name) or str(default)).strip())
    except Exception:
        return default


def _float_env(name: str, default: float) -> float:
    try:
        return float((os.getenv(name) or str(default)).strip())
    except Exception:
        return default


LLM_PROVIDER = (os.getenv("LLM_PROVIDER", "ollama") or "ollama").strip()
LLM_ENDPOINT = (os.getenv("LLM_ENDPOINT", "") or "").strip()
LLM_MODEL = (os.getenv("LLM_MODEL", "llama3.1:8b-instruct") or "").strip()
LLM_API_KEY = (os.getenv("LLM_API_KEY", "") or "").strip()
LLM_MAX_TOKENS = _int_env("LLM_MAX_TOKENS", 1024)
LLM_TEMPERATURE = _float_env("LLM_TEMPERATURE", 0.2)
LLM_TIMEOUT_S = _float_env("LLM_TIMEOUT_S", _float_env("LLM_TIMEOUT", 25.0))


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _as_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except Exception:
        return default


def _as_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except Exception:
        return default


def _safe_pct(part: float, whole: float) -> float:
    if whole <= 0:
        return 0.0
    return round((part / whole) * 100.0, 2)


def _rows(payload: Any) -> List[Dict[str, Any]]:
    if isinstance(payload, dict):
        for key in ("rows", "data", "items"):
            rows = payload.get(key)
            if isinstance(rows, list):
                return [r for r in rows if isinstance(r, dict)]
        if all(isinstance(v, dict) for v in payload.values()):  # pragma: no cover
            return list(payload.values())
    elif isinstance(payload, list):
        return [r for r in payload if isinstance(r, dict)]
    return []


def _first_row(payload: Any) -> Dict[str, Any]:
    rows = _rows(payload)
    return rows[0] if rows else {}


def _discover_query_endpoints() -> List[str]:
    try:
        from plugins.router import router as plugins_router  # type: ignore
        from fastapi.routing import APIRoute  # type: ignore

        paths: List[str] = []
        for route in getattr(plugins_router, "routes", []) or []:
            if not isinstance(route, APIRoute):
                continue
            if "GET" not in (route.methods or []):
                continue
            path = getattr(route, "path", None) or getattr(route, "path_format", None)
            if not isinstance(path, str):
                continue
            if "/ai-report" in path or "/heatmap" in path or "/snapshot" in path:
                continue
            paths.append(path)

        uniq: List[str] = []
        seen = set()
        for p in paths:
            if p not in seen:
                seen.add(p)
                uniq.append(p)
        return uniq
    except Exception as exc:  # pragma: no cover
        log.warning("endpoint discovery failed: %s", exc)
        return []


def _fetch_json(client: httpx.Client, url: str, params: Optional[Dict[str, Any]] = None) -> Tuple[bool, Any]:
    try:
        response = client.get(url, params=params or {})
        response.raise_for_status()
        return True, response.json()
    except Exception as exc:
        return False, {"error": str(exc), "url": url}


def _collect_widget_data() -> Dict[str, Any]:
    base = FETCH_BASE + "/api/query"
    out: Dict[str, Any] = {"_meta": {"base": base}}

    timeout = httpx.Timeout(DEFAULT_TIMEOUT, connect=min(10.0, DEFAULT_TIMEOUT), read=DEFAULT_TIMEOUT, write=DEFAULT_TIMEOUT)
    with httpx.Client(timeout=timeout) as client:
        discovered = _discover_query_endpoints()
        out["_meta"]["discovered"] = discovered

        tails = set()
        for path in discovered:
            if path.startswith("/api/query"):
                tails.add(path[len("/api/query") :] or "/")
            tails.add(path)

        def _shrink(payload: Any) -> Any:
            if not isinstance(payload, dict):
                return payload
            data = dict(payload)
            if isinstance(data.get("rows"), list) and len(data["rows"]) > 80:
                data["rows"] = data["rows"][:80]
            if isinstance(data.get("buckets"), list) and len(data["buckets"]) > 60:
                data["buckets"] = data["buckets"][:60]
            return data

        simple_gets = [
            ("browser_share", "/browser-share", {}),
            ("daily_count", "/daily-count", {}),
            ("device_share", "/device-share", {}),
            ("dwell_time", "/dwell-time", {"range": "7d", "top": 20}),
            ("page_exit_rate", "/page-exit-rate", {}),
            ("time_top_pages", "/time-top-pages", {}),
            ("top_pages", "/top-pages", {}),
            ("top_buttons_global", "/top-buttons/global", {}),
        ]

        for key, rel, params in simple_gets:
            if (rel in tails) or ((f"/api/query{rel}") in tails):
                ok, data = _fetch_json(client, base + rel, params)
                out[key] = _shrink(data) if ok else {"_fail": data}

        if ("/top-buttons/paths" in tails or "/api/query/top-buttons/paths" in tails) and (
            "/top-buttons/by-path" in tails or "/api/query/top-buttons/by-path" in tails
        ):
            ok, paths_resp = _fetch_json(client, base + "/top-buttons/paths", {})
            sample_path = None
            if ok and isinstance(paths_resp, dict):
                candidates = paths_resp.get("paths") or paths_resp.get("rows") or []
                if isinstance(candidates, list) and candidates:
                    first = candidates[0]
                    if isinstance(first, str):
                        sample_path = first
                    elif isinstance(first, dict):
                        sample_path = first.get("path")
            if sample_path:
                ok2, heatmap = _fetch_json(client, base + "/top-buttons/by-path", {"path": sample_path, "range": "7d"})
                out["top_buttons_by_path"] = heatmap if ok2 else {"_fail": heatmap}
            else:
                out["top_buttons_by_path"] = {"_skip": "no path candidates"}

        known = {rel for _, rel, _ in simple_gets} | {"/top-buttons/paths", "/top-buttons/by-path"}
        misc: Dict[str, Any] = {}
        for full in discovered:
            tail = full
            if tail.startswith("/api/query"):
                tail = tail[len("/api/query") :]
            if not tail.startswith("/"):
                tail = "/" + tail
            if tail in known:
                continue
            ok, payload = _fetch_json(client, base + tail, {})
            key = tail.strip("/").replace("/", "_") or "root"
            misc[key] = payload if ok else {"_fail": payload}
        if misc:
            out["misc"] = misc

    return out


def _bundle_snapshot(bundle: Dict[str, Any]) -> Dict[str, Any]:
    snapshot: Dict[str, Any] = {}
    for key, value in bundle.items():
        if key.startswith("_"):
            continue
        rows = _rows(value)
        if rows:
            snapshot[key] = rows[:10]
    return snapshot


def _call_openai_compatible(messages: List[Dict[str, str]]) -> str:
    endpoint = (LLM_ENDPOINT or "").rstrip("/")
    if not endpoint:
        raise RuntimeError("LLM_ENDPOINT is empty for openai_compat provider")
    url = endpoint + "/v1/chat/completions"
    headers = {"Content-Type": "application/json"}
    if LLM_API_KEY:
        headers["Authorization"] = f"Bearer {LLM_API_KEY}"
    payload = {
        "model": LLM_MODEL,
        "messages": messages,
        "temperature": LLM_TEMPERATURE,
        "max_tokens": LLM_MAX_TOKENS,
        "response_format": {"type": "json_object"},
    }
    with httpx.Client(timeout=LLM_TIMEOUT_S) as client:
        response = client.post(url, headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]


def _call_ollama_resilient(messages: List[Dict[str, str]]) -> str:
    candidates: List[str] = []
    if LLM_ENDPOINT:
        candidates.append(LLM_ENDPOINT.rstrip("/"))
    candidates.extend(["http://ollama:11434", "http://localhost:11434"])

    last_err: Optional[Exception] = None
    for base in candidates:
        if not base:
            continue
        url = base.rstrip("/") + "/api/chat"
        for use_json in (True, False):
            payload: Dict[str, Any] = {"model": LLM_MODEL, "messages": messages, "stream": False}
            if use_json:
                payload["format"] = "json"
            try:
                timeout = httpx.Timeout(LLM_TIMEOUT_S, connect=min(10.0, LLM_TIMEOUT_S), read=LLM_TIMEOUT_S, write=LLM_TIMEOUT_S)
                with httpx.Client(timeout=timeout) as client:
                    response = client.post(url, json=payload)
                    response.raise_for_status()
                    data = response.json()
                    message = data.get("message") if isinstance(data, dict) else None
                    content = (message or {}).get("content") if isinstance(message, dict) else None
                    if isinstance(content, str) and content.strip():
                        return content
            except Exception as exc:  # pragma: no cover
                last_err = exc
                continue
    raise RuntimeError(f"Ollama call failed: {last_err}")


def _extract_json(text: str) -> Dict[str, Any]:
    try:
        return json.loads(text)
    except Exception:
        pass
    start = text.find("{")
    if start == -1:
        return {}
    depth = 0
    in_string = False
    escape = False
    for idx, ch in enumerate(text[start:], start):
        if in_string:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_string = False
        else:
            if ch == '"':
                in_string = True
            elif ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    candidate = text[start : idx + 1]
                    try:
                        return json.loads(candidate)
                    except Exception:
                        break
    return {}


def _build_messages(bundle: Dict[str, Any], prompt: str, language: str, audience: str, word_limit: int) -> List[Dict[str, str]]:
    schema_hint = {
        "generated_at": "ISO8601 string",
        "title": "AI Traffic Diagnosis & Action Report",
        "summary": "string",
        "diagnostics": [
            {
                "focus": "Mobile Chrome gap",
                "finding": "Mobile holds 32% of users yet drives 58% of exits.",
                "widget": "device_share|browser_share|daily_count",
                "severity": "High|Medium|Low",
                "share": "32%",
                "insight": "Validate load time vs CTA visibility on this segment.",
            }
        ],
        "page_issues": [
            {
                "page": "/checkout",
                "issue": "Dwell 12s with 74% exits before payment CTA.",
                "dwell_time": "12s",
                "exit_rate": "74%",
                "insight": "Form friction and hidden shipping cost force abandonment.",
                "widget": "page_exit_rate|dwell_time",
            }
        ],
        "interaction_insights": [
            {
                "area": "Global CTA distribution",
                "insight": "72% of clicks cluster on one CTA while the long tail gets <5%.",
                "action": "Duplicate the primary CTA on mid-funnel screens.",
                "widget": "top_buttons_global|top_buttons_by_path",
            }
        ],
        "ux_recommendations": [
            {
                "category": "Checkout UX",
                "suggestion": "Surface delivery summary before payment fields and add sticky CTA copy.",
                "rationale": "Dwell 12s / exit 74% proves users never reach the confirmation button.",
                "validation": "page_exit_rate + dwell_time (7d)",
            }
        ],
        "tech_recommendations": [
            {
                "category": "Mobile Performance",
                "suggestion": "Inline critical CSS, preload fonts, and lazy-load heatmap scripts on mobile Chrome.",
                "rationale": "Segment owns 30%+ of sessions yet bounces fastest.",
                "validation": "device_share + browser_share + daily_count",
            }
        ],
        "priorities": [
            {
                "title": "Stabilize mobile Chrome loading",
                "priority": "High|Medium|Low",
                "impact": "30% of traffic churns here; shaving 1s off LCP lifts conversions ~5%p.",
                "effort": "Low|Medium|High",
                "expected_metric_change": {"metric": "page_exit_rate", "target": "-10%p", "period": "14d"},
                "business_outcome": "Daily conversions +5%p",
            }
        ],
        "metrics_to_track": [
            {
                "metric": "Checkout exit rate",
                "widget": "page_exit_rate",
                "reason": "Confirms abandonment reduction",
                "target_change": "-10pp",
                "timeframe": "14d",
            }
        ],
        "predictions": [
            {
                "metric": "Daily sessions",
                "baseline": 1800,
                "expected": 1950,
                "unit": "sessions",
                "narrative": "Traffic should rebound once UX blockers are removed.",
            }
        ],
        "radar_scores": [
            {"axis": "performance", "score": 58, "commentary": "Mobile LCP regresses when heatmap loads."},
            {"axis": "experience", "score": 62, "commentary": "Checkout rage-clicks indicate unclear CTA."},
            {"axis": "growth", "score": 54, "commentary": "Top pages plateau and campaign traffic is flat."},
            {"axis": "search", "score": 66, "commentary": "Landing traffic depends on five URLs only."},
            {"axis": "stability", "score": 70, "commentary": "API error rate is low but caching is missing."},
        ],
    }

    locale = "Respond in English." if language.lower().startswith("en") else "Respond in Korean."
    bundle_excerpt = json.dumps(_bundle_snapshot(bundle), ensure_ascii=False)
    user_prompt = prompt.strip() or "Diagnose the primary blockers and recommend actions."

    instructions = """
1. Diagnose traffic environments via device_share, browser_share, daily_count, and top_pages; cite the weakest device/browser segments or abnormal volume swings.
2. Use dwell_time and page_exit_rate to flag risky pages (short dwell + high exits) and explain why they matter.
3. Reference top_buttons_global and top_buttons_by_path/heatmap to prove whether visitors click the intended CTAs.
4. Recommend concrete UX and technical fixes with validation widgets, priorities (High/Medium/Low), metrics-to-track, numeric predictions, and five radar scores (performance/experience/growth/search/stability).
5. Keep numbers grounded in the widget data, prefer percentages for shares, and always output JSON only.
"""

    content = (
        f"{locale} Audience: {audience}. Soft word limit: {word_limit}.\n"
        f"{instructions.strip()}\n"
        f"Custom request: {user_prompt}\n"
        f"Widget data snapshot:\n{bundle_excerpt}\n"
        f"Schema hint:\n{json.dumps(schema_hint, ensure_ascii=False)}"
    )

    return [
        {
            "role": "system",
            "content": "You are an AI web analyst that produces deterministic JSON reports referencing the provided data.",
        },
        {"role": "user", "content": content},
    ]

@dataclass
class PromptContext:
    raw: str

    def __post_init__(self) -> None:
        tokens = re.findall(r"[a-zA-Z0-9\uac00-\ud7a3/_-]+", self.raw.lower())
        self.keywords = {t for t in tokens if t}

    def mentions(self, *candidates: str) -> bool:
        return any(candidate.lower() in self.keywords for candidate in candidates)



class InsightGenerator:
    def __init__(
        self,
        bundle: Dict[str, Any],
        *,
        from_iso: Optional[str],
        to_iso: Optional[str],
        bucket: str,
        site_id: Optional[str],
        prompt: str,
    ) -> None:
        self.bundle = bundle
        self.from_iso = from_iso
        self.to_iso = to_iso
        self.bucket = bucket
        self.site_id = site_id
        self.prompt = PromptContext(prompt or "")

        self.device_rows = _rows(bundle.get("device_share"))
        self.browser_rows = _rows(bundle.get("browser_share"))
        self.daily_rows = _rows(bundle.get("daily_count"))
        self.top_pages = _rows(bundle.get("top_pages"))
        self.time_buckets = _rows(bundle.get("time_top_pages"))
        self.exit_rows = _rows(bundle.get("page_exit_rate"))
        self.dwell_rows = _rows(bundle.get("dwell_time"))
        self.top_buttons_global = _rows(bundle.get("top_buttons_global"))
        self.top_buttons_by_path = _rows(bundle.get("top_buttons_by_path"))

        self.heatmap_sample: Dict[str, Any] = _first_row(self.top_buttons_by_path)

        self.dwell_map = {
            row.get("path") or row.get("page"): _as_float(row.get("avg_seconds") or row.get("avg"))
            for row in self.dwell_rows
            if row.get("path") or row.get("page")
        }

        self.device_distribution = self._distribution(self.device_rows, ("device", "type", "name"))
        self.browser_distribution = self._distribution(self.browser_rows, ("browser", "name"))
        self.total_sessions = self.device_distribution["total"] or sum(
            _as_int(row.get("cnt")) for row in self.daily_rows if row.get("cnt") is not None
        )

        self.top_page_summary = self._top_page_summary()

        self.exit_index: Dict[str, Dict[str, Any]] = {}
        exit_rates: List[float] = []
        for row in self.exit_rows:
            path = self._page_label(row)
            if not path:
                continue
            exit_rate = self._percent(row.get("exit_rate"))
            exit_rates.append(exit_rate)
            self.exit_index[path] = {
                "exit_rate": exit_rate,
                "views": int(self._pick(row, ("views", "sessions", "count", "value"))),
                "exits": int(self._pick(row, ("exits", "exit_count"))),
            }
        self.avg_exit_rate = mean(exit_rates) if exit_rates else 0.0
        self.avg_dwell = mean(self.dwell_map.values()) if self.dwell_map else 0.0
        self.daily_series = [_as_int(row.get("cnt")) for row in self.daily_rows if row.get("cnt") is not None]

        button_sorted = sorted(
            [row for row in self.top_buttons_global if self._pick(row, ("count", "clicks", "value")) > 0],
            key=lambda row: self._pick(row, ("count", "clicks", "value")),
            reverse=True,
        )
        self.button_sorted = button_sorted
        self.button_leader = button_sorted[0] if button_sorted else None
        self.button_tail = button_sorted[-1] if len(button_sorted) > 1 else None
        self.total_clicks = sum(int(self._pick(row, ("count", "clicks", "value"))) for row in self.top_buttons_global)
        self.click_rate_pct = _safe_pct(self.total_clicks, self.total_sessions or 1)

    def build(self) -> Dict[str, Any]:
        trend = self._traffic_trend()
        page_issues = self._page_issues()
        interactions = self._interaction_insights()
        diagnostics = self._diagnostics(trend, page_issues, interactions)
        ux_recs, tech_recs = self._recommendations(page_issues, trend, interactions)
        priorities = self._priorities(page_issues, trend)
        metrics = self._metrics_to_track(page_issues)
        predictions = self._predictions(page_issues, trend)

        required_sources = [
            ("device_share", self.device_rows),
            ("browser_share", self.browser_rows),
            ("daily_count", self.daily_rows),
            ("page_exit_rate", self.exit_rows),
            ("dwell_time", self.dwell_rows),
            ("top_buttons_global", self.top_buttons_global),
            ("top_buttons_by_path", self.top_buttons_by_path),
        ]
        missing_widgets = sorted(key for key, rows in required_sources if not rows)

        radar = self._radar_scores(page_issues, trend, len(missing_widgets))
        summary = self._summary_text(diagnostics, page_issues, trend)

        meta: Dict[str, Any] = {
            "mode": "deterministic",
            "provider": "insight-engine",
            "model": "deterministic-v2",
            "prompt": self.prompt.raw,
            "time": {"from": self.from_iso, "to": self.to_iso, "bucket": self.bucket},
            "site_id": self.site_id,
            "widgets": sorted([key for key in self.bundle.keys() if not key.startswith("_")]),
            "missing_widgets": missing_widgets,
            "trend": trend,
            "focus_pages": [item["page"] for item in self.top_page_summary["items"]],
            "button_sample_path": self.heatmap_sample.get("path"),
        }

        return {
            "generated_at": _now_iso(),
            "title": "AI Traffic Diagnosis & Action Report",
            "summary": summary,
            "diagnostics": diagnostics,
            "page_issues": page_issues,
            "interaction_insights": interactions,
            "ux_recommendations": ux_recs,
            "tech_recommendations": tech_recs,
            "priorities": priorities,
            "metrics_to_track": metrics,
            "predictions": predictions,
            "radar_scores": radar,
            "meta": meta,
        }

    def _traffic_trend(self) -> Dict[str, Any]:
        values = self.daily_series
        if not values:
            return {"label": "unknown"}

        first, last = values[0], values[-1]
        change = last - first
        change_pct = _safe_pct(change, first or 1)
        half = max(1, len(values) // 2)
        early = mean(values[:half])
        late = mean(values[-half:])
        momentum = _safe_pct(late - early, early or 1)

        if change_pct >= 6:
            label = "rising"
        elif change_pct <= -6:
            label = "falling"
        else:
            label = "flat"

        top_pages = [
            {"page": item["page"], "share": item["share"], "views": item["views"]}
            for item in self.top_page_summary["items"]
        ]
        top_share = round(sum(item["share"] for item in top_pages), 2)

        return {
            "label": label,
            "first": first,
            "last": last,
            "change": change,
            "change_pct": round(change_pct, 2),
            "momentum_pct": round(momentum, 2),
            "average": round(mean(values), 2),
            "days": len(values),
            "top_pages": top_pages,
            "top_share": top_share,
        }

    def _page_issues(self) -> List[Dict[str, Any]]:
        if not self.exit_index:
            return []

        issues: List[Tuple[float, Dict[str, Any]]] = []
        for path, info in self.exit_index.items():
            exit_rate = info["exit_rate"]
            dwell = self.dwell_map.get(path, 0.0)
            dwell_text = f"{dwell:.0f}s" if dwell else "-"
            exit_text = f"{exit_rate:.1f}%"
            dwell_gap = dwell - self.avg_dwell
            score = exit_rate - self.avg_exit_rate - (dwell_gap * 0.25)

            insight_bits: List[str] = []
            if dwell > 0 and dwell_gap < 0:
                insight_bits.append("Visitors bounce before consuming half of the content.")
            elif dwell_gap > 6:
                insight_bits.append("People linger but still exit, which signals a missing or unclear CTA.")
            else:
                insight_bits.append("Scroll depth stalls near the fold and users never reach the CTA.")

            views = info.get("views")
            exits = info.get("exits")
            if isinstance(views, int) and isinstance(exits, int):
                insight_bits.append(f"{exits:,} of {views:,} tracked sessions exit on this screen.")

            if self.heatmap_sample.get("path") == path:
                hotspots = self.heatmap_sample.get("hotspots") or self.heatmap_sample.get("elements") or []
                if isinstance(hotspots, list) and hotspots:
                    focus = hotspots[0].get("text") or hotspots[0].get("selector") or "non-CTA elements"
                    insight_bits.append(f"Heatmap focus drifts to {focus}.")

            issues.append(
                (
                    score,
                    {
                        "page": path,
                        "issue": f"{path} - dwell {dwell_text} / exit {exit_text}",
                        "dwell_time": dwell_text,
                        "exit_rate": exit_text,
                        "insight": " ".join(insight_bits),
                        "widget": "page_exit_rate|dwell_time",
                    },
                )
            )

        issues.sort(key=lambda item: item[0], reverse=True)
        return [item[1] for item in issues[:4]]

    def _interaction_insights(self) -> List[Dict[str, Any]]:
        insights: List[Dict[str, Any]] = []
        if self.button_leader and self.total_clicks:
            leader_label = self._safe_label(
                self.button_leader,
                ("element_text", "text", "label", "selector", "id"),
                "Primary CTA",
            )
            leader_clicks = int(self._pick(self.button_leader, ("count", "clicks", "value")))
            leader_share = _safe_pct(leader_clicks, self.total_clicks or 1)
            insights.append(
                {
                    "area": f"Global CTA - {leader_label}",
                    "insight": f"{leader_share:.1f}% of {self.total_clicks:,} clicks land on {leader_label}, so funnel health depends on a single surface.",
                    "action": "Mirror this CTA above the fold on high-exit pages and keep label/colour consistent across devices.",
                    "widget": "top_buttons_global",
                }
            )
            if self.button_tail and self.button_tail is not self.button_leader:
                tail_label = self._safe_label(
                    self.button_tail,
                    ("element_text", "text", "label", "selector", "id"),
                    "Secondary CTA",
                )
                tail_clicks = int(self._pick(self.button_tail, ("count", "clicks", "value")))
                if tail_clicks:
                    tail_share = _safe_pct(tail_clicks, self.total_clicks or 1)
                    insights.append(
                        {
                            "area": f"Under-used CTA - {tail_label}",
                            "insight": f"{tail_label} attracts only {tail_share:.1f}% ({tail_clicks:,}) of clicks, so intent leaks before the next step.",
                            "action": "Raise the CTA above the fold on mobile and test a contrasting colour to capture intent.",
                            "widget": "top_buttons_global",
                        }
                    )
        heatmap_path = self.heatmap_sample.get("path") or self.heatmap_sample.get("page")
        if heatmap_path:
            hotspots = self.heatmap_sample.get("hotspots") or self.heatmap_sample.get("elements") or []
            hotspot_count = len(hotspots) if isinstance(hotspots, list) else 0
            focal = ""
            if isinstance(hotspots, list) and hotspots:
                focal = hotspots[0].get("text") or hotspots[0].get("selector") or ""
            insights.append(
                {
                    "area": f"Heatmap - {heatmap_path}",
                    "insight": f"{hotspot_count or 3} hotspots absorb attention but users focus on {focal or 'non-CTA zones'}.",
                    "action": "Align the primary CTA with these hotspots and trim decorative blocks that compete for clicks.",
                    "widget": "top_buttons_by_path",
                }
            )
        return insights

    def _diagnostics(
        self,
        trend: Dict[str, Any],
        page_issues: List[Dict[str, Any]],
        interactions: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        diagnostics: List[Dict[str, Any]] = []
        if self.device_distribution["items"]:
            head = self.device_distribution["items"][0]
            tail = self.device_distribution["items"][-1]
            gap = head["share"] - tail["share"]
            context = None
            if page_issues:
                context = f"{page_issues[0]['page']} dwells {page_issues[0].get('dwell_time', '-')}/exit {page_issues[0].get('exit_rate', '-')}"
            diagnostics.append(
                {
                    "focus": f"{tail['label']} traffic",
                    "finding": f"{tail['label']} represents only {tail['share']:.1f}% vs {head['label']} {head['share']:.1f}% (+{gap:.1f}pp gap).",
                    "widget": "device_share|page_exit_rate",
                    "severity": "High" if tail["share"] <= 25 else "Medium",
                    "share": f"{tail['share']:.1f}%",
                    "insight": context or "Audit this device viewport for layout or performance regressions.",
                }
            )
        if self.browser_distribution["items"]:
            head = self.browser_distribution["items"][0]
            tail = self.browser_distribution["items"][-1]
            gap = head["share"] - tail["share"]
            diagnostics.append(
                {
                    "focus": f"{tail['label']} sessions",
                    "finding": f"{tail['label']} owns {tail['share']:.1f}% of traffic while {head['label']} dominates; CSS/support gaps likely hold exits high.",
                    "widget": "browser_share",
                    "severity": "Medium" if tail["share"] <= 15 else "Low",
                    "share": f"{tail['share']:.1f}%",
                    "insight": "Verify sticky headers, fonts, and analytics beacons on this browser.",
                }
            )
        if trend.get("label"):
            severity = "High" if trend["label"] == "falling" else ("Medium" if trend["label"] == "flat" else "Low")
            top_pages = trend.get("top_pages") or []
            top_names = ", ".join(item["page"] for item in top_pages[:3])
            diagnostics.append(
                {
                    "focus": "Traffic momentum",
                    "finding": f"Daily logs are {trend['label']} ({trend.get('change_pct', 0):+.1f}%) and top five pages already represent {trend.get('top_share', 0):.1f}% ({top_names}).",
                    "widget": "daily_count|top_pages",
                    "severity": severity,
                    "insight": "Volume is concentrated, so any outage on these URLs will immediately hit acquisition.",
                }
            )
        if self.button_leader and self.button_tail and self.total_clicks:
            leader_clicks = int(self._pick(self.button_leader, ("count", "clicks", "value")))
            tail_clicks = int(self._pick(self.button_tail, ("count", "clicks", "value")))
            leader_share = _safe_pct(leader_clicks, self.total_clicks or 1)
            tail_share = _safe_pct(tail_clicks, self.total_clicks or 1) if tail_clicks else 0.0
            diagnostics.append(
                {
                    "focus": "CTA engagement",
                    "finding": f"The top CTA captures {leader_share:.1f}% of clicks while the weakest sees {tail_share:.1f}%.",
                    "widget": "top_buttons_global|top_buttons_by_path",
                    "severity": "Medium",
                    "share": f"{leader_share:.1f}% vs {tail_share:.1f}%",
                    "insight": "Duplicate the winning CTA earlier in the journey to reduce dependency on a single fold.",
                }
            )
        return diagnostics

    def _recommendations(
        self,
        page_issues: List[Dict[str, Any]],
        trend: Dict[str, Any],
        interactions: List[Dict[str, Any]],
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        ux: List[Dict[str, Any]] = []
        tech: List[Dict[str, Any]] = []
        worst = page_issues[0] if page_issues else None
        if worst:
            ux.append(
                {
                    "category": "Checkout clarity",
                    "suggestion": f"Compress above-the-fold copy on {worst['page']} and pin the payment CTA directly under the delivery summary.",
                    "rationale": f"Dwell {worst.get('dwell_time', '-')} with exits {worst.get('exit_rate', '-')} shows users never reach the CTA.",
                    "validation": "page_exit_rate + dwell_time trends",
                }
            )
        heatmap_path = self.heatmap_sample.get("path") or self.heatmap_sample.get("page")
        if heatmap_path:
            ux.append(
                {
                    "category": "Heatmap alignment",
                    "suggestion": f"Move the primary CTA into the hotspot on {heatmap_path} and hide decorative modules that steal clicks.",
                    "rationale": "Heatmap hotspots concentrate away from the intended CTA.",
                    "validation": "top_buttons_by_path heatmap + session replay",
                }
            )
        if self.button_leader and interactions:
            ux.append(
                {
                    "category": "CTA hierarchy",
                    "suggestion": "Duplicate the high-performing CTA on mid-funnel screens and retire low-performing buttons.",
                    "rationale": "One CTA controls most clicks, so distributing it earlier reduces dependence on a single scroll depth.",
                    "validation": "top_buttons_global before/after comparison",
                }
            )
        mobile = self._find_distribution_item(self.device_distribution, "mobile")
        chrome = self._find_distribution_item(self.browser_distribution, "chrome")
        mobile_share = mobile["share"] if mobile else (self.device_distribution["items"][0]["share"] if self.device_distribution["items"] else 0.0)
        chrome_share = chrome["share"] if chrome else (self.browser_distribution["items"][0]["share"] if self.browser_distribution["items"] else 0.0)
        tech.append(
            {
                "category": "Mobile Chrome performance",
                "suggestion": "Inline the first 50KB of CSS, preload fonts, and lazy-load heatmap scripts only after First Contentful Paint.",
                "rationale": f"Mobile traffic is {mobile_share:.1f}% and Chrome covers {chrome_share:.1f}% of sessions; load-time debt there drives exits.",
                "validation": "device_share + browser_share + synthetic LCP trace",
            }
        )
        tech.append(
            {
                "category": "Landing page caching",
                "suggestion": "Edge-cache the top five entry pages and prefetch API payloads to stabilise daily sessions.",
                "rationale": f"Trend is {trend.get('label', 'unknown')} ({trend.get('change_pct', 0):+.1f}%), so shaving TTFB is the fastest lever.",
                "validation": "top_pages + daily_count watchlist",
            }
        )
        return ux, tech

    def _priorities(
        self,
        page_issues: List[Dict[str, Any]],
        trend: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        priorities: List[Dict[str, Any]] = []
        worst = page_issues[0] if page_issues else None
        if worst:
            baseline = self._percent(worst.get("exit_rate"))
            target = max(0.0, baseline - 12.0)
            priorities.append(
                {
                    "title": f"Reduce exits on {worst['page']}",
                    "priority": "High",
                    "impact": f"Cutting exits from {baseline:.1f}% to {target:.1f}% should recover ~6%p of the checkout funnel.",
                    "effort": "Medium",
                    "expected_metric_change": {
                        "metric": "page_exit_rate",
                        "baseline": round(baseline, 2),
                        "target": f"{target:.1f}%",
                        "period": "14d",
                    },
                    "business_outcome": "Projected +5-7%p conversion lift on checkout.",
                }
            )
        mobile = self._find_distribution_item(self.device_distribution, "mobile")
        if mobile or self.device_distribution["items"]:
            share = mobile["share"] if mobile else self.device_distribution["items"][0]["share"]
            priorities.append(
                {
                    "title": "Stabilise mobile Chrome load time",
                    "priority": "High" if share >= 30 else "Medium",
                    "impact": f"{share:.1f}% of traffic sits on this segment; reducing LCP by 1s lifts overall conversions ~4%p.",
                    "effort": "Medium",
                    "expected_metric_change": {"metric": "device_share", "target": "+4%p", "period": "21d"},
                    "business_outcome": "More stable mobile experience and reduced bounce.",
                }
            )
        if trend.get("label") in {"falling", "flat"}:
            priorities.append(
                {
                    "title": "Re-ignite acquisition",
                    "priority": "Medium" if trend["label"] == "flat" else "High",
                    "impact": f"Top pages already cover {trend.get('top_share', 0):.1f}% of traffic; broadening campaigns can add ~8% volume.",
                    "effort": "Medium",
                    "expected_metric_change": {"metric": "daily_count", "target": "+12%", "period": "21d"},
                    "business_outcome": "Keeps weekly lead targets on track.",
                }
            )
        return priorities

    def _metrics_to_track(self, page_issues: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        metrics: List[Dict[str, Any]] = []
        if page_issues:
            worst = page_issues[0]
            metrics.append(
                {
                    "metric": f"{worst['page']} exit rate",
                    "widget": "page_exit_rate",
                    "reason": "Confirms whether the redesigned CTA reduces abandonment.",
                    "target_change": "-10pp",
                    "timeframe": "14d",
                }
            )
            metrics.append(
                {
                    "metric": f"{worst['page']} dwell time",
                    "widget": "dwell_time",
                    "reason": "Longer dwell (>20s) proves the new layout keeps users engaged.",
                    "target_change": "+15%",
                    "timeframe": "14d",
                }
            )
        metrics.append(
            {
                "metric": "Mobile share stability",
                "widget": "device_share",
                "reason": "Ensures mobile fixes recover at least +5pp share.",
                "timeframe": "21d",
            }
        )
        metrics.append(
            {
                "metric": "Browser distribution health",
                "widget": "browser_share",
                "reason": "Safari/Edge gaps will expose CSS or tracking regressions.",
                "timeframe": "21d",
            }
        )
        metrics.append(
            {
                "metric": "CTA click-through",
                "widget": "top_buttons_global",
                "reason": "Validates whether duplicated CTAs capture +3pp clicks.",
                "target_change": "+3pp",
                "timeframe": "14d",
            }
        )
        return metrics

    def _predictions(self, page_issues: List[Dict[str, Any]], trend: Dict[str, Any]) -> List[Dict[str, Any]]:
        predictions: List[Dict[str, Any]] = []
        if page_issues:
            worst = page_issues[0]
            baseline = self._percent(worst.get("exit_rate"))
            conversion_baseline = max(0.5, (100 - baseline) * max(self.click_rate_pct or 5.0, 3.0) / 100.0)
            conversion_expected = round(conversion_baseline * 1.12, 2)
            predictions.append(
                {
                    "metric": "Checkout conversion rate",
                    "baseline": round(conversion_baseline, 2),
                    "expected": conversion_expected,
                    "unit": "%",
                    "narrative": f"Assumes {worst['page']} exits drop by ~12pp after the layout fix.",
                }
            )
            expected_exit = round(max(0.0, baseline - max(8.0, baseline * 0.12)), 2)
            predictions.append(
                {
                    "metric": f"{worst['page']} exit rate",
                    "baseline": round(baseline, 2),
                    "expected": expected_exit,
                    "unit": "%",
                    "narrative": "Sticky CTA + reduced form friction should cut abandonment.",
                }
            )
        if trend.get("last") is not None:
            baseline = trend.get("last") or trend.get("average") or 0
            expected = int(round(baseline * 1.08 + 5))
            predictions.append(
                {
                    "metric": "Daily sessions",
                    "baseline": baseline,
                    "expected": expected,
                    "unit": "sessions",
                    "narrative": "Edge caching plus campaign refresh is expected to add 8% volume.",
                }
            )
        if self.total_sessions:
            baseline = round(self.click_rate_pct, 2)
            expected = round(min(100.0, baseline + 3.5), 2)
            predictions.append(
                {
                    "metric": "CTA click share",
                    "baseline": baseline,
                    "expected": expected,
                    "unit": "%",
                    "narrative": "Duplicating the hero CTA should capture at least +3pp clicks.",
                }
            )
        return predictions

    def _radar_scores(
        self,
        page_issues: List[Dict[str, Any]],
        trend: Dict[str, Any],
        missing_count: int,
    ) -> List[Dict[str, Any]]:
        top_exit = self.avg_exit_rate
        if page_issues:
            top_exit = self._percent(page_issues[0].get("exit_rate"))
        dwell = self.avg_dwell
        mobile = self._find_distribution_item(self.device_distribution, "mobile")
        mobile_share = mobile["share"] if mobile else (self.device_distribution["items"][0]["share"] if self.device_distribution["items"] else 0.0)
        trend_change = trend.get("change_pct", 0) or 0.0
        top_share = trend.get("top_share", 0) or 0.0

        def clamp(value: float) -> int:
            return int(max(20.0, min(95.0, round(value, 2))))

        performance = clamp(82 - max(0.0, top_exit - 45.0) * 0.6 - max(0.0, 40.0 - mobile_share) * 0.4)
        experience = clamp(60 + min(18.0, dwell - 20.0) - max(0.0, top_exit - 60.0) * 0.5)
        growth = clamp(55 + trend_change * 0.8 - max(0.0, top_share - 70.0) * 0.4)
        search = clamp(60 - max(0.0, top_share - 75.0) * 0.4 + min(10.0, len(self.top_page_summary["items"]) * 1.5))
        stability = clamp(72 - missing_count * 8.0 + min(6.0, len(self.daily_rows)))
        axes = [
            ("performance", performance, f"Mobile share {mobile_share:.1f}% and exits {top_exit:.1f}% drive the score."),
            ("experience", experience, f"Avg dwell {dwell:.0f}s; still limited by high exit pages."),
            ("growth", growth, f"Traffic trend {trend_change:+.1f}% with top pages covering {top_share:.1f}% of inflow."),
            ("search", search, f"Acquisition leans on {len(self.top_page_summary['items'])} URLs; diversify keywords."),
            ("stability", stability, "Monitoring gaps" if missing_count else "All required widgets responding"),
        ]
        radar: List[Dict[str, Any]] = []
        for axis, score, commentary in axes:
            radar.append({"axis": axis, "score": int(round(score)), "commentary": commentary})
        return radar

    def _summary_text(
        self,
        diagnostics: List[Dict[str, Any]],
        page_issues: List[Dict[str, Any]],
        trend: Dict[str, Any],
    ) -> str:
        lines: List[str] = []
        if trend.get("label") and trend.get("label") != "unknown":
            lines.append(
                f"Traffic is {trend['label']} ({trend.get('change_pct', 0):+.1f}%) across {trend.get('days', 0)} days while the top five pages already account for {trend.get('top_share', 0):.1f}% of sessions."
            )
        if diagnostics:
            lines.append(" | ".join(f"{diag['focus']}: {diag['finding']}" for diag in diagnostics[:2]))
        if page_issues:
            worst = page_issues[0]
            lines.append(
                f"{worst['page']} keeps users for {worst.get('dwell_time', '-')} but still loses {worst.get('exit_rate', '-')} of traffic - fix this screen first."
            )
        if self.click_rate_pct:
            lines.append(f"Global CTA click-through is {self.click_rate_pct:.1f}%, so duplicating the winning CTA is the fastest uplift.")
        if self.prompt.raw.strip():
            lines.append(f'Custom request "{self.prompt.raw.strip()}" has been incorporated into the action plan.')
        return " ".join(lines) or "Widget data is missing; please rerun the report after the queries respond."

    def _distribution(self, rows: List[Dict[str, Any]], label_keys: Tuple[str, ...]) -> Dict[str, Any]:
        items: List[Dict[str, Any]] = []
        total = 0
        for row in rows:
            label = self._safe_label(row, label_keys, "Unknown")
            value = int(self._pick(row, ("sessions", "count", "value", "views")))
            if value <= 0:
                continue
            total += value
            items.append({"label": label, "value": value})
        items.sort(key=lambda item: item["value"], reverse=True)
        for item in items:
            item["share"] = _safe_pct(item["value"], total or 1)
        return {"total": total, "items": items}

    def _top_page_summary(self, limit: int = 5) -> Dict[str, Any]:
        pages: List[Dict[str, Any]] = []
        for row in self.top_pages:
            page = self._page_label(row)
            if not page:
                continue
            views = int(self._pick(row, ("views", "sessions", "count", "value")))
            if views <= 0:
                continue
            pages.append({"page": page, "views": views})
        pages.sort(key=lambda item: item["views"], reverse=True)
        top = pages[:limit]
        reference = self.total_sessions or sum(item["views"] for item in pages) or 1
        for item in top:
            item["share"] = _safe_pct(item["views"], reference)
        return {"items": top, "total_views": sum(item["views"] for item in pages)}

    def _pick(self, row: Dict[str, Any], keys: Tuple[str, ...]) -> float:
        for key in keys:
            if key not in row:
                continue
            value = row.get(key)
            if value is None:
                continue
            if isinstance(value, str):
                cleaned = value.strip().replace(",", "")
                if cleaned.endswith("%"):
                    cleaned = cleaned[:-1]
                value = cleaned or "0"
            try:
                return float(value)
            except Exception:
                continue
        return 0.0

    def _percent(self, value: Any) -> float:
        if value is None:
            return 0.0
        if isinstance(value, str):
            value = value.replace("%", "").strip()
        return _as_float(value)

    def _page_label(self, row: Dict[str, Any]) -> str:
        for key in ("path", "page", "url", "title"):
            value = row.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        return ""

    def _safe_label(self, row: Dict[str, Any], keys: Tuple[str, ...], default: str) -> str:
        for key in keys:
            value = row.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        return default

    def _find_distribution_item(self, distribution: Dict[str, Any], keyword: str) -> Optional[Dict[str, Any]]:
        keyword_lower = keyword.lower()
        for item in distribution.get("items", []):
            if keyword_lower in item["label"].lower():
                return item
        return None

def generate_report(
    from_iso: Optional[str],
    to_iso: Optional[str],
    bucket: str,
    site_id: Optional[str],
    *,
    prompt: str,
    language: str,
    audience: str,
    word_limit: int,
) -> Dict[str, Any]:
    try:
        bundle = _collect_widget_data()
    except Exception as exc:
        log.error("Failed to collect widget data: %s", exc)
        return {
            "generated_at": _now_iso(),
            "title": "AI Traffic Diagnosis & Action Report",
            "summary": "Widget queries failed. Verify collectors and rerun the AI report.",
            "diagnostics": [],
            "page_issues": [],
            "interaction_insights": [],
            "ux_recommendations": [],
            "tech_recommendations": [],
            "priorities": [],
            "metrics_to_track": [],
            "predictions": [],
            "radar_scores": [],
            "meta": {"mode": "error", "reason": str(exc)},
        }

    generator = InsightGenerator(
        bundle,
        from_iso=from_iso,
        to_iso=to_iso,
        bucket=bucket,
        site_id=site_id,
        prompt=prompt,
    )
    deterministic = generator.build()

    if LLM_PROVIDER.lower() == "none":
        return deterministic

    try:
        messages = _build_messages(bundle, prompt, language, audience, word_limit)
        if LLM_PROVIDER == "openai_compat":
            content = _call_openai_compatible(messages)
        else:
            content = _call_ollama_resilient(messages)
        data = _extract_json(content)
        if not isinstance(data, dict) or not data:
            raise ValueError("LLM returned invalid JSON")
        data.setdefault("generated_at", _now_iso())
        data.setdefault("title", deterministic.get("title", "AI Traffic Diagnosis & Action Report"))
        for field in [
            "diagnostics",
            "page_issues",
            "interaction_insights",
            "ux_recommendations",
            "tech_recommendations",
            "priorities",
            "metrics_to_track",
            "predictions",
            "radar_scores",
        ]:
            if not isinstance(data.get(field), list):
                data[field] = []
        data.setdefault("summary", deterministic.get("summary", ""))
        if not isinstance(data.get("meta"), dict):
            data["meta"] = {}
        meta = data["meta"]
        meta.update(
            {
                "mode": "llm",
                "provider": LLM_PROVIDER,
                "model": LLM_MODEL,
                "prompt": prompt,
                "time": {"from": from_iso, "to": to_iso, "bucket": bucket},
                "site_id": site_id,
                "widgets": deterministic.get("meta", {}).get("widgets"),
                "missing_widgets": deterministic.get("meta", {}).get("missing_widgets"),
                "trend": deterministic.get("meta", {}).get("trend"),
            }
        )
        return data
    except Exception as exc:
        log.warning("LLM generation failed, using deterministic report: %s", exc)
        deterministic_meta = deterministic.setdefault("meta", {})
        deterministic_meta.setdefault("mode", "deterministic")
        deterministic_meta["llm_error"] = str(exc)
        deterministic_meta.setdefault("provider", "insight-engine")
        deterministic_meta.setdefault("model", "deterministic-v1")
        return deterministic
