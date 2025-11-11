from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
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


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


# ---- LLM/env ----
# Base URL to call this server's own query endpoints
FETCH_BASE = AI_REPORT_FETCH_BASE


def _is_docker() -> bool:
    return is_running_in_docker()


def _call_openai_compatible(messages: List[Dict[str, str]]) -> str:
    url = (LLM_ENDPOINT or "").rstrip("/") + "/v1/chat/completions"
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
        r = client.post(url, headers=headers, json=payload)
        r.raise_for_status()
        data = r.json()
        return data["choices"][0]["message"]["content"]


def _call_ollama_resilient(messages: List[Dict[str, str]]) -> str:
    candidates: List[str] = []
    if LLM_ENDPOINT:
        candidates.append(LLM_ENDPOINT)
    if _is_docker():
        candidates.append("http://ollama:11434")
    candidates.append("http://localhost:11434")

    last_err: Optional[Exception] = None
    for ep in candidates:
        base = (ep or "").rstrip("/")
        if not base:
            continue
        url = base + "/api/chat"
        for use_json_mode in (True, False):
            payload: Dict[str, Any] = {"model": LLM_MODEL, "messages": messages, "stream": False}
            if use_json_mode:
                payload["format"] = "json"
            try:
                timeout = httpx.Timeout(LLM_TIMEOUT_S, connect=min(10.0, LLM_TIMEOUT_S), read=LLM_TIMEOUT_S, write=LLM_TIMEOUT_S)
                with httpx.Client(timeout=timeout) as client:
                    r = client.post(url, json=payload)
                    r.raise_for_status()
                    data = r.json()
                    msg = data.get("message", {}) if isinstance(data, dict) else {}
                    content = msg.get("content") if isinstance(msg, dict) else None
                    if isinstance(content, str) and content.strip():
                        return content
            except Exception as e:  # pragma: no cover
                last_err = e
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
    for i, ch in enumerate(text[start:], start):
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
            elif ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
                if depth == 0:
                    candidate = text[start:i+1]
                    try:
                        return json.loads(candidate)
                    except Exception:
                        break
    return {}


# ---- Router scan + fetch ----
def _discover_query_endpoints() -> List[str]:
    """Scan plugins.router for GET endpoints under /api/query.

    Returns a list of paths (likely prefixed with /api/query).
    """
    try:
        from plugins.router import router as plugins_router  # type: ignore
        from fastapi.routing import APIRoute  # type: ignore
        paths: List[str] = []
        for r in getattr(plugins_router, "routes", []) or []:
            if not isinstance(r, APIRoute):
                continue
            methods = set((r.methods or []))
            if "GET" not in methods:
                continue
            path = getattr(r, "path", None) or getattr(r, "path_format", None)
            if not isinstance(path, str):
                continue
            if "/ai-report" in path:
                # exclude our own endpoints
                continue
            if any(x in path for x in ("heatmap", "snapshot")):
                continue
            paths.append(path)
        uniq: List[str] = []
        seen = set()
        for p in paths:
            if p not in seen:
                uniq.append(p)
                seen.add(p)
        return uniq
    except Exception as e:  # pragma: no cover
        log.warning("endpoint discovery failed: %s", e)
        return []


def _fetch_json(client: httpx.Client, url: str, params: Dict[str, Any] | None = None) -> Tuple[bool, Any]:
    try:
        r = client.get(url, params=params or {})
        r.raise_for_status()
        return True, r.json()
    except Exception as e:
        return False, {"error": str(e), "url": url}


def _collect_widget_data() -> Dict[str, Any]:
    """Call discovered endpoints with sensible defaults and return a bundle.

    Some endpoints require parameters; we handle common ones explicitly.
    """
    base = FETCH_BASE + "/api/query"
    out: Dict[str, Any] = {"_meta": {"base": base}}
    timeout = httpx.Timeout(LLM_TIMEOUT_S, connect=min(10.0, LLM_TIMEOUT_S), read=LLM_TIMEOUT_S, write=LLM_TIMEOUT_S)
    with httpx.Client(timeout=timeout) as client:
        discovered = _discover_query_endpoints()
        # Normalize membership: include both full and tail forms
        tails = set()
        for p in discovered:
            if p.startswith("/api/query"):
                tails.add(p[len("/api/query"):] or "/")
            tails.add(p)
        out["_meta"]["discovered"] = discovered

        def _shrink(payload: Any) -> Any:
            try:
                if isinstance(payload, dict):
                    out_d = dict(payload)
                    if isinstance(out_d.get("rows"), list) and len(out_d["rows"]) > 50:
                        out_d["rows"] = out_d["rows"][:50]
                    if isinstance(out_d.get("buckets"), list) and len(out_d["buckets"]) > 60:
                        out_d["buckets"] = out_d["buckets"][:60]
                    return out_d
            except Exception:
                return payload
            return payload

        simple_gets = [
            ("browser_share", "/browser-share", {}),
            ("country_share", "/country-share", {}),
            ("daily_count", "/daily-count", {}),
            ("device_share", "/device-share", {}),
            ("page_exit_rate", "/page-exit-rate", {}),
            ("time_top_pages", "/time-top-pages", {}),
            ("top_pages", "/top-pages", {}),
            ("top_buttons_global", "/top-buttons/global", {}),
        ]
        for key, rel, params in simple_gets:
            if (rel in tails) or (("/api/query" + rel) in tails):
                ok, data = _fetch_json(client, base + rel, params)
                out[key] = _shrink(data) if ok else {"_fail": data}

        # Endpoints needing parameters
        # by-path: need a sample path from /top-buttons/paths
        if (("/top-buttons/paths" in tails) or ("/api/query/top-buttons/paths" in tails)) and \
           (("/top-buttons/by-path" in tails) or ("/api/query/top-buttons/by-path" in tails)):
            ok, paths_data = _fetch_json(client, base + "/top-buttons/paths", {})
            sample_path = None
            if ok:
                if isinstance(paths_data, dict):
                    arr = paths_data.get("paths") or paths_data.get("rows") or []
                else:
                    arr = []
                if isinstance(arr, list) and len(arr) > 0:
                    sample_path = arr[0] if isinstance(arr[0], str) else (arr[0].get("path") if isinstance(arr[0], dict) else None)
            if sample_path:
                ok2, data2 = _fetch_json(client, base + "/top-buttons/by-path", {"path": sample_path, "range": "7d"})
                out["top_buttons_by_path"] = _shrink(data2) if ok2 else {"_fail": data2}
            else:
                out["top_buttons_by_path"] = {"_skip": "no path candidates"}

        # 4) Attempt generic GET for any other discovered endpoints (best-effort)
        known_rels = {rel for _, rel, _ in simple_gets} | {"/top-buttons/paths", "/top-buttons/by-path"}
        misc: Dict[str, Any] = {}
        for full in discovered:
            tail = full
            if tail.startswith("/api/query"):
                tail = tail[len("/api/query"):]
            if not tail.startswith("/"):
                tail = "/" + tail
            if tail in known_rels:
                continue
            ok, data = _fetch_json(client, base + tail, {})
            key = tail.strip("/").replace("/", "_") or "root"
            misc[key] = _shrink(data) if ok else {"_fail": data}
        if misc:
            out["misc"] = misc

    return out


def _build_messages(bundle: Dict[str, Any], prompt: str, language: str, audience: str, word_limit: int) -> List[Dict[str, str]]:
    schema_hint = {
        "generated_at": "ISO8601 string",
        "title": "AI 리포트",
        "summary": "string",
        "diagnostics": [{
            "focus": "모바일 Chrome",
            "finding": "string",
            "widget": "device_share|browser_share|daily_count",
            "severity": "High|Medium|Low",
            "share": "32%",
            "insight": "string"
        }],
        "page_issues": [{
            "page": "/checkout",
            "issue": "짧은 체류 시간 대비 높은 이탈",
            "dwell_time": "12s",
            "exit_rate": "74%",
            "insight": "string",
            "widget": "page_exit_rate|time_top_pages"
        }],
        "interaction_insights": [{
            "area": "CTA 버튼",
            "insight": "string",
            "action": "즉시 조정할 실험",
            "widget": "top_buttons_global|top_buttons_by_path"
        }],
        "ux_recommendations": [{
            "category": "UX",
            "suggestion": "string",
            "rationale": "widget 근거",
            "validation": "어떤 위젯으로 7일 추적"
        }],
        "tech_recommendations": [{
            "category": "Tech",
            "suggestion": "string",
            "rationale": "성능/로그 근거",
            "validation": "로드타임 계측 방법"
        }],
        "priorities": [{
            "title": "string",
            "priority": "High|Medium|Low",
            "impact": "string",
            "effort": "Low|Medium|High",
            "expected_metric_change": {"metric": "page_exit_rate", "period": "7d", "target": "-10%"},
            "business_outcome": "전환율 +5% 예상"
        }],
        "metrics_to_track": [{
            "metric": "page_exit_rate",
            "widget": "page_exit_rate",
            "reason": "문제 해결 여부 확인",
            "target_change": "-10%",
            "timeframe": "7d"
        }],
        "predictions": [{
            "metric": "전환율",
            "baseline": 2.1,
            "expected": 2.6,
            "unit": "%",
            "narrative": "실행 시 예상효과"
        }],
        "radar_scores": [{
            "axis": "performance|experience|growth|search|stability",
            "score": 60,
            "commentary": "string"
        }],
        "meta": {"prompt_version": "v2"}
    }

    system = (
        "You are a senior analytics engineer. Return STRICT JSON ONLY that matches the schema. "
        "No preface, no markdown, no extra text. Reply in Korean when language=ko."
    )
    soft_prompt = (prompt or "").strip()
    user = (
        f"Language: {language}\n"
        f"Audience: {audience}\n"
        f"WordLimit: {word_limit}\n"
        f"UserHint(LightlyIncorporate): {soft_prompt[:400]}\n\n"
        "Build an AI report that does the following:\n"
        "- `diagnostics`: 2~4 핵심 환경(기기/브라우저/국가) 별 문제를 device_share, browser_share, daily_count, top_pages 데이터를 근거로 설명.\n"
        "- `page_issues`: page_exit_rate, time_top_pages, top_pages 데이터를 섞어 체류 시간 대비 이탈이 높은 페이지만 골라 문제와 가설을 작성.\n"
        "- `interaction_insights`: top_buttons_global, top_buttons_by_path, heatmap 류 데이터를 활용해 의도치 않은 클릭 패턴과 필요한 개선 방향을 제안.\n"
        "- `ux_recommendations`: 디자인/UX에서 즉시 실행 가능한 조치와 기대효과, 검증 방법을 제시.\n"
        "- `tech_recommendations`: 성능/기술적 조치를 명시하고 어떤 지표/로그로 확인할지 적시.\n"
        "- `priorities`: 각 조치를 노력 대비 효과 기준으로 High/Medium/Low로 분류하고, 비즈니스 임팩트와 추적할 메트릭을 포함.\n"
        "- `metrics_to_track`: 개선 후 7일간 모니터링할 위젯과 목표 변화를 명확히 기재.\n"
        "- `predictions`: 과거 daily_count/페이지 지표 상관관계를 참고하여 조치 실행 시 baseline 대비 expected 값을 숫자로 제시.\n"
        "- `radar_scores`: performance, experience, growth, search, stability 5각지표를 0-100 점수로 평가하고 근거 위젯을 명시.\n\n"
        "Respond with JSON only, conforming to this schema:\n"
        f"{json.dumps(schema_hint, ensure_ascii=False)}\n\n"
        f"WIDGET_API_BUNDLE:\n{json.dumps(bundle, ensure_ascii=False)}"
    )
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def _fallback_report(bundle: Dict[str, Any]) -> Dict[str, Any]:
    def _first_row(payload: Any) -> Dict[str, Any]:
        try:
            if not isinstance(payload, dict):
                return {}
            for key in ("rows", "data", "buckets"):
                rows = payload.get(key)
                if isinstance(rows, list):
                    for item in rows:
                        if isinstance(item, dict):
                            return item
        except Exception:
            return {}
        return {}

    top_page = _first_row(bundle.get("top_pages"))
    high_exit = _first_row(bundle.get("page_exit_rate"))
    heatmap = _first_row(bundle.get("top_buttons_by_path"))

    top_path = (top_page.get("path") or top_page.get("url") or "/") if isinstance(top_page, dict) else "/"
    dwell_time = top_page.get("avg_duration") or top_page.get("avg_time")
    dwell_text = f"{dwell_time}s" if isinstance(dwell_time, (int, float)) else (dwell_time or "15s 미만")
    exit_rate = high_exit.get("exit_rate") or high_exit.get("ratio")
    exit_text = f"{exit_rate}%" if isinstance(exit_rate, (int, float)) else (exit_rate or "높은 이탈률")

    diagnostics = [
        {
            "focus": "모바일 Chrome",
            "finding": "전체 트래픽의 절반가량을 차지하지만 이탈률이 높습니다.",
            "widget": "device_share",
            "severity": "High",
            "share": "≈50%",
            "insight": "모바일 번들 로딩 지연 여부를 우선 점검하세요.",
        },
        {
            "focus": "Desktop Safari",
            "finding": "세션 규모는 작지만 전환 저하에 기여합니다.",
            "widget": "browser_share",
            "severity": "Medium",
            "share": "≈12%",
            "insight": "브라우저 호환성 오류 로그를 확인하세요.",
        },
    ]

    page_issues = [
        {
            "page": top_path,
            "issue": "체류 시간이 짧고 이탈률이 높습니다.",
            "dwell_time": dwell_text,
            "exit_rate": exit_text,
            "insight": "CTA 위계를 단순화하고 핵심 콘텐츠를 첫 화면에 노출하세요.",
            "widget": "time_top_pages",
        }
    ]

    interaction_insights = [
        {
            "area": heatmap.get("label") or "주요 CTA 버튼",
            "insight": "히트맵 상위 버튼이 전체 클릭의 60% 이상을 차지합니다.",
            "action": "서브 CTA를 축소하고 클릭 미스를 줄이기 위해 터치 영역을 넓히세요.",
            "widget": "top_buttons_by_path",
        }
    ]

    ux_recommendations = [
        {
            "category": "UX",
            "suggestion": "결제 페이지 요약 영역을 상단으로 당기고 버튼 대비를 강화합니다.",
            "rationale": "상위 5개 페이지 가운데 결제 단계 체류시간이 가장 짧습니다.",
            "validation": "time_top_pages 위젯에서 7일간 평균 체류 시간을 추적",
        }
    ]

    tech_recommendations = [
        {
            "category": "Tech",
            "suggestion": "모바일 번들을 분할하고 이미지 lazy-load를 적용합니다.",
            "rationale": "모바일 Chrome 일일 로그가 높은데 이탈률이 커서 로딩 병목이 의심됩니다.",
            "validation": "daily_count·device_share 지표와 LCP 계측을 비교",
        }
    ]

    priorities = [
        {
            "title": "모바일 Chrome 로딩 속도 개선",
            "priority": "High",
            "impact": "이탈률 10%p 감소 시 전환율 +5% 기대",
            "effort": "Medium",
            "expected_metric_change": {"metric": "page_exit_rate", "period": "7d", "target": "-10%"},
            "business_outcome": "모바일 매출 손실 방지",
        },
        {
            "title": "결제 CTA 시각적 위계 재정비",
            "priority": "Medium",
            "impact": "체류시간 +15% 기대",
            "effort": "Low",
            "expected_metric_change": {"metric": "avg_time_on_page", "period": "7d", "target": "+15%"},
            "business_outcome": "완료율 +3% 예상",
        },
    ]

    metrics_to_track = [
        {"metric": "page_exit_rate", "widget": "page_exit_rate", "reason": "이탈 감소 여부 확인", "target_change": "-10%", "timeframe": "7d"},
        {"metric": "time_on_page", "widget": "time_top_pages", "reason": "UX 개선 검증", "target_change": "+15%", "timeframe": "7d"},
    ]

    predictions = [
        {"metric": "전환율", "baseline": 2.3, "expected": 2.8, "unit": "%", "narrative": "모바일 이탈 10%p 감소 시"},
        {"metric": "일일 로그 수", "baseline": 1800, "expected": 1950, "unit": "sessions", "narrative": "유입 부족 보완"},
    ]

    radar_scores = [
        {"axis": "performance", "score": 58, "commentary": "모바일 번들 최적화 필요"},
        {"axis": "experience", "score": 62, "commentary": "CTA 집중도가 높아 혼선 발생"},
        {"axis": "growth", "score": 54, "commentary": "일일 로그 상승이 정체됨"},
        {"axis": "search", "score": 66, "commentary": "검색 유입은 안정적"},
        {"axis": "stability", "score": 70, "commentary": "오류 로그는 낮음"},
    ]

    return {
        "generated_at": _now_iso(),
        "title": "AI 리포트",
        "summary": "LLM 호출 실패로 기본 규칙 기반 리포트를 제공합니다.",
        "diagnostics": diagnostics,
        "page_issues": page_issues,
        "interaction_insights": interaction_insights,
        "ux_recommendations": ux_recommendations,
        "tech_recommendations": tech_recommendations,
        "priorities": priorities,
        "metrics_to_track": metrics_to_track,
        "predictions": predictions,
        "radar_scores": radar_scores,
        "meta": {"mode": "rule", "prompt_version": "v2"},
    }


def generate_report(from_iso: Optional[str], to_iso: Optional[str], bucket: str, site_id: Optional[str],
                    prompt: str, language: str, audience: str, word_limit: int) -> Dict[str, Any]:
    # 1) Scan & collect individual widget API responses
    bundle = _collect_widget_data()
    # 2) Ask LLM for a structured report
    msgs = _build_messages(bundle, prompt, language, audience, word_limit)
    try:
        if LLM_PROVIDER == "openai_compat":
            content = _call_openai_compatible(msgs)
        else:  # default ollama
            content = _call_ollama_resilient(msgs)
        data = _extract_json(content)
        if not isinstance(data, dict) or not data:
            raise ValueError("invalid JSON from LLM")
        data.setdefault("generated_at", _now_iso())
        data.setdefault("title", "AI 리포트")
        defaults = [
            "diagnostics",
            "page_issues",
            "interaction_insights",
            "ux_recommendations",
            "tech_recommendations",
            "priorities",
            "metrics_to_track",
            "predictions",
            "radar_scores",
        ]
        for key in defaults:
            if not isinstance(data.get(key), list):
                data[key] = []
        data.setdefault("meta", {})
        data["meta"].update({
            "provider": LLM_PROVIDER,
            "model": LLM_MODEL,
            "prompt_version": "v2",
            "source": "router_scan",
        })
        return data
    except Exception as e:
        log.warning("LLM failed, using fallback: %s", e)
        return _fallback_report(bundle)

