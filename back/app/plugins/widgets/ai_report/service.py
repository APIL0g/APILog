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
        "title": "AI 웹사이트 컨디션 리포트",
        "summary": "string",
        "diagnostics": [
            {
                "focus": "모바일 Chrome",
                "finding": "진단 내용",
                "widget": "device_share|browser_share|daily_count",
                "severity": "High|Medium|Low",
                "share": "32%",
                "insight": "추가 설명",
            }
        ],
        "page_issues": [
            {
                "page": "/checkout",
                "issue": "짧은 체류와 높은 이탈",
                "dwell_time": "12s",
                "exit_rate": "74%",
                "insight": "문제 원인",
                "widget": "page_exit_rate|dwell_time",
            }
        ],
        "interaction_insights": [
            {
                "area": "CTA 버튼",
                "insight": "히트맵 설명",
                "action": "실행 방안",
                "widget": "top_buttons_global|top_buttons_by_path",
            }
        ],
        "ux_recommendations": [
            {
                "category": "UX",
                "suggestion": "구체적 UI 개선",
                "rationale": "데이터 근거",
                "validation": "검증 방법",
            }
        ],
        "tech_recommendations": [
            {
                "category": "Tech",
                "suggestion": "성능 개선",
                "rationale": "추정 원인",
                "validation": "추적 지표",
            }
        ],
        "priorities": [
            {
                "title": "핵심 조치",
                "priority": "High|Medium|Low",
                "impact": "예상 효과",
                "effort": "Low|Medium|High",
                "expected_metric_change": {"metric": "page_exit_rate", "target": "-10%p", "period": "7d"},
                "business_outcome": "비즈니스 영향",
            }
        ],
        "metrics_to_track": [
            {
                "metric": "페이지별 이탈률",
                "widget": "page_exit_rate",
                "reason": "개선 검증",
                "target_change": "-10%p",
                "timeframe": "7d",
            }
        ],
        "predictions": [
            {"metric": "일일 로그", "baseline": 1800, "expected": 1950, "unit": "sessions", "narrative": "예측 근거"}
        ],
        "radar_scores": [
            {"axis": "performance", "score": 58, "commentary": "모바일 최적화 필요"},
            {"axis": "experience", "score": 62, "commentary": "CTA 혼선"},
            {"axis": "growth", "score": 54, "commentary": "유입 정체"},
            {"axis": "search", "score": 66, "commentary": "검색 노출 보통"},
            {"axis": "stability", "score": 70, "commentary": "로그 안정"},
        ],
    }

    locale = "Respond in English." if language.lower().startswith("en") else "Respond in Korean."
    bundle_excerpt = json.dumps(_bundle_snapshot(bundle), ensure_ascii=False)
    user_prompt = prompt.strip() or "핵심 문제를 진단하고 실행안을 제시해 주세요."

    instructions = """
1. Diagnose traffic environments (device_share, browser_share, daily_count, top_pages) and highlight low-share/high-exit contexts.
2. Identify problematic pages by combining dwell_time and page_exit_rate (mention dwell+exit metrics).
3. Derive interaction insights from top_buttons_global/by_path and suggest UX tweaks.
4. Provide actionable UX/Tech remedies with validation widgets and timeframe.
5. Prioritize actions (High/Medium/Low) with expected business impact and metric targets.
6. Offer numeric predictions (baseline vs expected) for key KPIs with ±5~15% realistic deltas.
7. Output radar scores for performance/experience/growth/search/stability (0-100) with commentary.
8. Return valid JSON matching the schema hint. Do not wrap with markdown.
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
        tokens = re.findall(r"[a-zA-Z가-힣0-9/_]+", self.raw.lower())
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

        self.dwell_map = {row.get("path"): _as_float(row.get("avg_seconds")) for row in self.dwell_rows if row.get("path")}
        self.total_sessions = sum(_as_int(row.get("sessions")) for row in self.device_rows if row.get("sessions") is not None)

    def build(self) -> Dict[str, Any]:
        trend = self._traffic_trend()
        page_issues = self._page_issues()
        interactions = self._interaction_insights()
        diagnostics = self._diagnostics(trend, interactions)
        ux_recs, tech_recs = self._recommendations(page_issues, trend, interactions)
        priorities = self._priorities(page_issues, diagnostics, trend)
        metrics = self._metrics_to_track(page_issues)
        predictions = self._predictions(page_issues, trend)
        radar = self._radar_scores(page_issues, trend)
        summary = self._summary_text(diagnostics, page_issues, trend)

        meta: Dict[str, Any] = {
            "mode": "deterministic",
            "provider": "insight-engine",
            "model": "deterministic-v1",
            "prompt": self.prompt.raw,
            "time": {"from": self.from_iso, "to": self.to_iso, "bucket": self.bucket},
            "site_id": self.site_id,
            "widgets": sorted([key for key in self.bundle.keys() if not key.startswith("_")]),
            "missing_widgets": sorted(
                key
                for key, rows in [
                    ("device_share", self.device_rows),
                    ("browser_share", self.browser_rows),
                    ("daily_count", self.daily_rows),
                    ("page_exit_rate", self.exit_rows),
                    ("dwell_time", self.dwell_rows),
                    ("top_buttons_global", self.top_buttons_global),
                ]
                if not rows
            ),
            "trend": trend,
        }

        return {
            "generated_at": _now_iso(),
            "title": "AI 웹사이트 컨디션 리포트",
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
        values = [_as_int(row.get("cnt")) for row in self.daily_rows if row.get("cnt") is not None]
        if not values:
            return {"label": "unknown"}
        first, last = values[0], values[-1]
        change = last - first
        change_pct = _safe_pct(change, first or 1)
        half = max(1, len(values) // 2)
        early = mean(values[:half])
        late = mean(values[-half:])
        momentum = _safe_pct(late - early, early or 1)
        label = "정체"
        if change_pct >= 8:
            label = "상승"
        elif change_pct <= -8:
            label = "하락"
        return {
            "label": label,
            "first": first,
            "last": last,
            "change": change,
            "change_pct": round(change_pct, 2),
            "momentum_pct": round(momentum, 2),
            "average": round(mean(values), 2),
            "days": len(values),
        }

    def _page_issues(self) -> List[Dict[str, Any]]:
        if not self.exit_rows:
            return []
        sorted_rows = sorted(self.exit_rows, key=lambda r: _as_float(r.get("exit_rate")), reverse=True)[:3]
        issues: List[Dict[str, Any]] = []
        for row in sorted_rows:
            path = row.get("path") or "unknown"
            exit_rate = _as_float(row.get("exit_rate"))
            dwell = self.dwell_map.get(path)
            dwell_text = f"{dwell:.0f}s" if dwell else None
            exit_text = f"{exit_rate:.1f}%" if exit_rate else None
            views = _as_int(row.get("views"))
            exits = _as_int(row.get("exits"))
            insight = None
            if dwell and dwell < 15 and exit_rate >= 60:
                insight = "평균 체류가 15초 미만으로 메시지가 닿기 전에 이탈합니다."
            elif views and exits:
                insight = f"{views:,}뷰 중 {exits:,}뷰에서 세션이 종료되었습니다."
            issues.append(
                {
                    "page": path,
                    "issue": f"이탈률 {exit_text or 'N/A'}로 세션 손실이 큰 페이지입니다.",
                    "dwell_time": dwell_text,
                    "exit_rate": exit_text,
                    "insight": insight,
                    "widget": "page_exit_rate",
                }
            )
        return issues

    def _interaction_insights(self) -> List[Dict[str, Any]]:
        insights: List[Dict[str, Any]] = []
        if self.top_buttons_global:
            total_clicks = sum(_as_int(row.get("count")) for row in self.top_buttons_global)
            top_button = self.top_buttons_global[0]
            tail_button = self.top_buttons_global[-1]
            top_share = _safe_pct(_as_int(top_button.get("count")), total_clicks or 1)
            tail_share = _safe_pct(_as_int(tail_button.get("count")), total_clicks or 1)
            insights.append(
                {
                    "area": f"전역 CTA · {top_button.get('element_text')}",
                    "insight": f"전체 클릭 {total_clicks:,}건 중 {top_share:.1f}%가 한 CTA에 집중되었습니다.",
                    "action": "보조 CTA 컬러 대비와 서브 카피를 강화해 클릭 분포를 분산하세요.",
                    "widget": "top_buttons_global",
                }
            )
            insights.append(
                {
                    "area": f"저성과 요소 · {tail_button.get('element_text')}",
                    "insight": f"하위 버튼은 {tail_share:.1f}%({tail_button.get('count')}회)만 클릭됩니다.",
                    "action": "요소 제거 또는 위치 조정으로 상호작용 노이즈를 줄이세요.",
                    "widget": "top_buttons_global",
                }
            )
        heatmap = _first_row(self.top_buttons_by_path)
        if heatmap.get("path"):
            insights.append(
                {
                    "area": f"히트맵 · {heatmap.get('path')}",
                    "insight": "히어로 상단 버튼 이후 클릭이 급감해 폴드 하단 CTA 노출이 부족합니다.",
                    "action": "스크롤 유도 UI(진행 바, 앵커 링크)로 하단 CTA 가시성을 확보하세요.",
                    "widget": "top_buttons_by_path",
                }
            )
        return insights

    def _diagnostics(self, trend: Dict[str, Any], interactions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        diagnostics: List[Dict[str, Any]] = []
        if self.device_rows:
            sorted_devices = sorted(self.device_rows, key=lambda r: _as_int(r.get("sessions")), reverse=True)
            top_device = sorted_devices[0]
            weak_device = sorted_devices[-1]
            total = sum(_as_int(row.get("sessions")) for row in self.device_rows) or 1
            top_share = _safe_pct(_as_int(top_device.get("sessions")), total)
            weak_share = _safe_pct(_as_int(weak_device.get("sessions")), total)
            diagnostic = {
                "focus": f"{weak_device.get('device', '모바일')} 트래픽",
                "finding": f"세션 비중 {weak_share:.1f}%로 {top_device.get('device')} 대비 {top_share - weak_share:.1f}%p 격차가 있습니다.",
                "widget": "device_share",
                "severity": "High" if weak_share < 35 else "Medium",
                "share": f"{weak_share:.1f}%",
                "insight": None,
            }
            if interactions:
                diagnostic["widget"] = "device_share|top_buttons_by_path"
                diagnostic["insight"] = "히트맵에서도 상단 CTA 외 클릭이 급감해 모바일 UX 저하가 의심됩니다."
            diagnostics.append(diagnostic)

        if self.browser_rows:
            sorted_browser = sorted(self.browser_rows, key=lambda r: _as_int(r.get("sessions")), reverse=True)
            tail = sorted_browser[-1]
            head = sorted_browser[0]
            total = sum(_as_int(row.get("sessions")) for row in self.browser_rows) or 1
            head_share = _safe_pct(_as_int(head.get("sessions")), total)
            tail_share = _safe_pct(_as_int(tail.get("sessions")), total)
            diagnostics.append(
                {
                    "focus": f"{tail.get('browser', 'Safari')} 세션",
                    "finding": f"{tail.get('browser')} 비중 {tail_share:.1f}%로 상위 브라우저 대비 {head_share - tail_share:.1f}%p 뒤처집니다.",
                    "widget": "browser_share",
                    "severity": "Medium" if tail_share < 15 else "Low",
                    "share": f"{tail_share:.1f}%",
                    "insight": "CSS sticky 요소나 고정 헤더가 브라우저별로 다르게 렌더링되는지 확인하세요.",
                }
            )

        if trend.get("label"):
            diagnostics.append(
                {
                    "focus": "일일 로그 추세",
                    "finding": f"{trend['label']} 흐름이며 마지막 날 {trend.get('last', 0):,}건, 변동 {trend.get('change_pct', 0):+.1f}%.",
                    "widget": "daily_count|top_pages",
                    "severity": "High" if trend["label"] == "하락" else ("Medium" if trend["label"] == "정체" else "Low"),
                    "share": None,
                    "insight": "Top5 페이지 구성이 거의 동일하여 신규 랜딩이 부족합니다.",
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

        if page_issues:
            worst = page_issues[0]
            ux.append(
                {
                    "category": "Checkout UX",
                    "suggestion": f"{worst['page']} 상단을 가치제안 > 증거 > CTA 순으로 재구성해 3초 내 메시지를 완결하세요.",
                    "rationale": f"체류 {worst.get('dwell_time') or '-'} / 이탈 {worst.get('exit_rate') or '-'} 데이터 근거",
                    "validation": "page_exit_rate·dwell_time 위젯으로 7일간 추적",
                }
            )

        if interactions:
            ux.append(
                {
                    "category": "히트맵",
                    "suggestion": "보조 CTA 대비와 스크롤 유도 인디케이터를 도입해 하단 CTA 가시성을 높이세요.",
                    "rationale": "히트맵에서 상단 CTA 독식으로 클릭 분포가 쏠림",
                    "validation": "top_buttons_by_path 위젯에서 구간별 클릭 점유율 비교",
                }
            )

        if trend.get("label") in {"하락", "정체"}:
            tech.append(
                {
                    "category": "성능",
                    "suggestion": "모바일 번들 사이즈, 이미지 lazy-load, LCP 2.5초 목표 여부를 점검하세요.",
                    "rationale": "모바일 비중 저하 + CTA 집중 현상 → 로딩 지연 가능성",
                    "validation": "device_share와 RUM 성능 로그 비교",
                }
            )

        tech.append(
            {
                "category": "로그 품질",
                "suggestion": "일일 로그가 꺾인 구간에서 이벤트 누락 여부를 교차 검증하세요.",
                "rationale": "daily_count 지표 변동이 ±8%p 이상 발생",
                "validation": "daily_count 위젯 + 원시 로그 샘플 비교",
            }
        )

        return ux, tech

    def _priorities(
        self,
        page_issues: List[Dict[str, Any]],
        diagnostics: List[Dict[str, Any]],
        trend: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        priorities: List[Dict[str, Any]] = []
        if page_issues:
            top_issue = page_issues[0]
            baseline = _as_float((top_issue.get("exit_rate") or "").replace("%", "")) if isinstance(top_issue.get("exit_rate"), str) else 70.0
            priorities.append(
                {
                    "title": f"{top_issue['page']} CTA 재구성",
                    "priority": "High",
                    "impact": "이탈률 10~12%p 감소 시 전환률 +5%p 기대",
                    "effort": "Medium",
                    "expected_metric_change": {"metric": "page_exit_rate", "target": f"{max(0.0, baseline - 12):.1f}%", "period": "7d"},
                    "business_outcome": "결제 단계 이탈 감소로 주간 매출 방어",
                }
            )

        mobile = next((row for row in self.device_rows if (row.get("device") or "").lower().startswith("mobile")), None)
        if mobile:
            share = _safe_pct(_as_int(mobile.get("sessions")), self.total_sessions or 1)
            priorities.append(
                {
                    "title": "모바일 로딩 속도 개선",
                    "priority": "High" if share >= 30 else "Medium",
                    "impact": f"모바일 세션 {share:.1f}% 차지 · LCP 1초 단축 시 전환률 +4%p",
                    "effort": "Medium",
                    "expected_metric_change": {"metric": "device_share", "target": "+5%p", "period": "14d"},
                    "business_outcome": "모바일 매출 유지 및 신규 캠페인 효율 확보",
                }
            )

        if trend.get("label") in {"하락", "정체"}:
            priorities.append(
                {
                    "title": "랜딩 캠페인 리뉴얼",
                    "priority": "High" if trend["label"] == "하락" else "Medium",
                    "impact": f"일일 로그 {trend.get('change_pct', 0):+.1f}%p 반등 시 퍼널 복원",
                    "effort": "Medium",
                    "expected_metric_change": {"metric": "daily_count", "target": "+12%", "period": "14d"},
                    "business_outcome": "신규 유입 확보로 성장 정체 해소",
                }
            )
        return priorities

    def _metrics_to_track(self, page_issues: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        metrics: List[Dict[str, Any]] = []
        if page_issues:
            metrics.append(
                {
                    "metric": f"{page_issues[0]['page']} 이탈률",
                    "widget": "page_exit_rate",
                    "reason": "CTA 재구성 효과 검증",
                    "target_change": "-10%p",
                    "timeframe": "7d",
                }
            )
        metrics.append(
            {
                "metric": "페이지별 체류 시간",
                "widget": "dwell_time",
                "reason": "상단 메시지 개선 후 20초 이상 체류 확보 여부 확인",
                "target_change": "+15%",
                "timeframe": "14d",
            }
        )
        metrics.append(
            {
                "metric": "일일 로그 수",
                "widget": "daily_count",
                "reason": "성능·캠페인 조치 이후 유입 회복 확인",
                "target_change": "+12%",
                "timeframe": "14d",
            }
        )
        return metrics

    def _predictions(self, page_issues: List[Dict[str, Any]], trend: Dict[str, Any]) -> List[Dict[str, Any]]:
        predictions: List[Dict[str, Any]] = []
        if page_issues:
            exit_rate = _as_float((page_issues[0].get("exit_rate") or "").replace("%", "")) if isinstance(page_issues[0].get("exit_rate"), str) else 70.0
            predictions.append(
                {
                    "metric": f"{page_issues[0]['page']} 이탈률",
                    "baseline": round(exit_rate, 2),
                    "expected": round(max(0.0, exit_rate - 12.0), 2),
                    "unit": "%",
                    "narrative": "CTA 재배치 및 신뢰요소 추가 시 2주 내 10~12%p 개선 예상",
                }
            )
        if trend.get("last") is not None:
            baseline = trend.get("last") or trend.get("average") or 0
            expected = baseline + max(int(baseline * 0.08), 10)
            predictions.append(
                {
                    "metric": "일일 로그",
                    "baseline": baseline,
                    "expected": expected,
                    "unit": "sessions",
                    "narrative": "성능/캠페인 실행 시 주 단위 +8% 성장 목표",
                }
            )
        return predictions

    def _radar_scores(self, page_issues: List[Dict[str, Any]], trend: Dict[str, Any]) -> List[Dict[str, Any]]:
        top_exit = _as_float((page_issues[0].get("exit_rate") or "").replace("%", "")) if page_issues else 65.0
        dwell = self.dwell_map.get(page_issues[0]["page"]) if page_issues else None
        performance = max(30, min(85, 90 - top_exit * 0.4))
        experience = max(28, min(90, 70 - (top_exit - 50) * 0.6 + (dwell or 18)))
        growth = 60 + (trend.get("change_pct", 0) / 2 if trend else 0)
        search = 55 + min(10, len(self.top_pages) * 2)
        stability = 70 - (5 if self.bundle.get("misc") else 0)
        axes = [
            ("performance", performance, "모바일 번들 최적화 필요"),
            ("experience", experience, "Checkout 이탈률이 높음"),
            ("growth", growth, "일일 로그 추세 기반"),
            ("search", search, "상위 페이지 다양성 기준"),
            ("stability", stability, "로그 수집은 안정적"),
        ]
        radar: List[Dict[str, Any]] = []
        for axis, score, commentary in axes:
            radar.append({"axis": axis, "score": int(round(max(20, min(90, score)))), "commentary": commentary})
        return radar

    def _summary_text(self, diagnostics: List[Dict[str, Any]], page_issues: List[Dict[str, Any]], trend: Dict[str, Any]) -> str:
        lines: List[str] = []
        if diagnostics:
            lines.append(" · ".join(f"{diag['focus']}: {diag['finding']}" for diag in diagnostics[:2]))
        if page_issues:
            worst = page_issues[0]
            lines.append(f"{worst['page']} 페이지는 체류 {worst.get('dwell_time') or '-'} / 이탈 {worst.get('exit_rate') or '-'}로 손실이 가장 큽니다.")
        if trend.get("label"):
            lines.append(f"일일 로그는 {trend['label']} 흐름({trend.get('change_pct', 0):+.1f}%). 유입 부족 구간을 복원할 조치를 우선 배치했습니다.")
        if self.prompt.raw.strip():
            lines.append(f"사용자 요청(\"{self.prompt.raw.strip()}\")을 반영해 결제 단계 개선을 선순위로 배치했습니다.")
        return "\n".join(lines) or "수집된 위젯 데이터를 기반으로 핵심 문제와 조치안을 요약했습니다."


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
            "title": "AI 웹사이트 컨디션 리포트",
            "summary": "위젯 데이터를 수집하지 못해 기본 리포트를 제공하지 못했습니다.",
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
        data.setdefault("title", deterministic.get("title", "AI 웹사이트 컨디션 리포트"))
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
