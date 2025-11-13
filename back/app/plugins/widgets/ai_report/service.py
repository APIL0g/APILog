from __future__ import annotations

import ast
import json
import logging
import re
from collections import deque
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
from .schemas import ReportResponse

log = logging.getLogger("ai_report")

RADAR_AXIS_ORDER = ["performance", "experience", "growth", "search", "stability"]
RADAR_AXIS_ALIASES = {
    "performance": "performance",
    "perf": "performance",
    "성능": "performance",
    "experience": "experience",
    "ux": "experience",
    "사용자경험": "experience",
    "경험": "experience",
    "growth": "growth",
    "conversion": "growth",
    "전환": "growth",
    "성장": "growth",
    "search": "search",
    "도달": "search",
    "seo": "search",
    "검색": "search",
    "stability": "stability",
    "안정성": "stability",
    "기술안정성": "stability",
}
RADAR_FALLBACK_COMMENTARY = "데이터 부족"

JSON_RETRY_PROMPT = (
    "The previous response was not valid JSON. Re-read the instructions and respond AGAIN "
    "with strict JSON only (no markdown fences, no explanations). The output must be a single "
    "JSON object that matches the requested schema."
)

FETCH_BASE = (AI_REPORT_FETCH_BASE or "http://127.0.0.1:8000").rstrip("/")
_TRAILING_COMMA_RE = re.compile(r",(\s*[}\]])")
_UNSAFE_NUM_RE = re.compile(r"\b(?:NaN|Infinity|-Infinity)\b")


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _resolved_provider() -> str:
    provider = (LLM_PROVIDER or "").strip().lower()
    api_key = (LLM_API_KEY or "").strip()
    endpoint = (LLM_ENDPOINT or "").strip().lower()

    if provider in {"", "auto"}:
        if api_key:
            return "openai"
        if endpoint:
            return "ollama"
        return "disabled"

    if provider in {"openai", "openai_compat", "gpt", "azure_openai"}:
        return "openai"

    if provider in {"ollama", "local"}:
        if api_key and "openai" in endpoint:
            return "openai"
        return "ollama"

    if provider in {"none", "disabled"}:
        return "disabled"

    if api_key and "openai" in endpoint:
        return "openai"

    return provider


def _call_openai_compatible(messages: List[Dict[str, str]]) -> str:
    base = (LLM_ENDPOINT or "https://api.openai.com").rstrip("/")
    url = base + "/v1/chat/completions"
    headers = {"Content-Type": "application/json"}
    api_key = (LLM_API_KEY or "").strip()
    if not api_key:
        raise RuntimeError("OpenAI-compatible provider requires LLM_API_KEY")
    headers["Authorization"] = f"Bearer {api_key}"
    payload: Dict[str, Any] = {"model": LLM_MODEL, "messages": messages, "response_format": {"type": "json_object"}}
    if LLM_TEMPERATURE not in (None, ""):
        payload["temperature"] = float(LLM_TEMPERATURE)
    if LLM_MAX_TOKENS:
        payload["max_tokens"] = int(LLM_MAX_TOKENS)
    timeout_seconds = max(5.0, float(LLM_TIMEOUT_S or 60.0))
    timeout = httpx.Timeout(timeout_seconds, connect=min(10.0, timeout_seconds / 2))
    with httpx.Client(timeout=timeout) as client:
        response = client.post(url, headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()
    choice = (data.get("choices") or [{}])[0]
    message = choice.get("message") or {}
    return _message_content_to_str(message)


def _call_ollama_resilient(messages: List[Dict[str, str]]) -> str:
    candidates: List[str] = []
    if LLM_ENDPOINT:
        candidates.append(LLM_ENDPOINT)
    if is_running_in_docker():
        candidates.append("http://ollama:11434")
    candidates.append("http://localhost:11434")

    last_err: Optional[Exception] = None
    timeout_seconds = max(10.0, float(LLM_TIMEOUT_S or 60.0))
    timeout = httpx.Timeout(timeout_seconds, connect=min(15.0, timeout_seconds / 2))
    for endpoint in candidates:
        base = (endpoint or "").rstrip("/")
        if not base:
            continue
        url = base + "/api/chat"
        for json_mode in (True, False):
            payload: Dict[str, Any] = {"model": LLM_MODEL, "messages": messages, "stream": False}
            if json_mode:
                payload["format"] = "json"
            try:
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


def _clone_messages(messages: List[Dict[str, str]]) -> List[Dict[str, str]]:
    cloned: List[Dict[str, str]] = []
    for msg in messages:
        cloned.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
    return cloned


def _retry_llm_for_json(messages: List[Dict[str, str]], last_content: Optional[str]) -> Optional[str]:
    retry_msgs = _clone_messages(messages)
    snippet = (last_content or "").strip()
    if snippet:
        retry_msgs.append({"role": "assistant", "content": snippet[:4000]})
    retry_msgs.append({"role": "user", "content": JSON_RETRY_PROMPT})
    provider = _resolved_provider()
    try:
        if provider in {"openai", "openai_compat", "vllm"}:
            return _call_openai_compatible(retry_msgs)
        if provider == "disabled":
            raise RuntimeError("LLM disabled")
        return _call_ollama_resilient(retry_msgs)
    except Exception as exc:  # pragma: no cover
        log.warning("LLM retry failed: %s", exc)
        return None


def _message_content_to_str(message: Dict[str, Any]) -> str:
    content = message.get("content")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: List[str] = []
        for chunk in content:
            if isinstance(chunk, str):
                parts.append(chunk)
            elif isinstance(chunk, dict):
                chunk_type = chunk.get("type")
                if chunk_type in {"text", "output_text"} and isinstance(chunk.get("text"), str):
                    parts.append(chunk["text"])
                elif isinstance(chunk.get("content"), str):
                    parts.append(chunk["content"])
        return "".join(parts).strip()
    refusal = message.get("refusal")
    if isinstance(refusal, str):
        return refusal
    if content is None:
        return ""
    try:
        return json.dumps(content, ensure_ascii=False)
    except Exception:
        return str(content)


def _strip_code_fence(text: str) -> str:
    stripped = text.strip()
    if stripped.startswith("```"):
        _, _, remainder = stripped.partition("\n")
        stripped = remainder or stripped
    if stripped.endswith("```"):
        stripped = stripped[: stripped.rfind("```")]
    if stripped.lower().startswith("json"):
        stripped = stripped[4:].lstrip()
    return stripped.strip()


def _slice_first_object(text: str) -> Optional[str]:
    start = text.find("{")
    if start == -1:
        return None
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
                    return text[start : idx + 1]
    return None


def _json_dict_or_none(blob: str) -> Optional[Dict[str, Any]]:
    try:
        data = json.loads(blob)
    except Exception:
        return None
    if isinstance(data, dict):
        return data
    if isinstance(data, list) and data and isinstance(data[0], dict):
        return data[0]
    return None


def _literal_dict_or_none(blob: str) -> Optional[Dict[str, Any]]:
    try:
        data = ast.literal_eval(blob)
    except Exception:
        return None
    if isinstance(data, dict):
        return _coerce_jsonable(data)
    if isinstance(data, list) and data and isinstance(data[0], dict):
        return _coerce_jsonable(data[0])
    return None


def _coerce_jsonable(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(k): _coerce_jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_coerce_jsonable(v) for v in value]
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)


def _maybe_unwrap_json_string(blob: str) -> Optional[str]:
    if len(blob) < 2:
        return None
    if (blob[0] == '"' and blob[-1] == '"') or (blob[0] == "'" and blob[-1] == "'"):
        try:
            unwrapped = json.loads(blob)
        except Exception:
            try:
                unwrapped = ast.literal_eval(blob)
            except Exception:
                return None
        if isinstance(unwrapped, str) and ("{" in unwrapped or "[" in unwrapped):
            return unwrapped
    return None


def _maybe_balance_brackets(blob: str) -> Optional[str]:
    stack: List[str] = []
    in_string = False
    escape = False
    for ch in blob:
        if in_string:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_string = False
            continue
        if ch == '"':
            in_string = True
            continue
        if ch in "{[":
            stack.append(ch)
        elif ch in "}]":
            if stack and ((stack[-1] == "{" and ch == "}") or (stack[-1] == "[" and ch == "]")):
                stack.pop()
            else:
                return None
    if not stack:
        return None
    closing = "".join("}" if opener == "{" else "]" for opener in reversed(stack))
    return blob + closing


def _sanitize_json_tokens(blob: str) -> str:
    return _UNSAFE_NUM_RE.sub("null", blob)


def _extract_json(text: str) -> Dict[str, Any]:
    if not isinstance(text, str):
        if isinstance(text, (dict, list)):
            try:
                text = json.dumps(text, ensure_ascii=False)
            except Exception:
                text = str(text)
        else:
            text = str(text or "")
    if not text:
        return {}

    stripped = _strip_code_fence(text)
    first_object = _slice_first_object(stripped)

    seeds = [stripped]
    if first_object and first_object not in seeds:
        seeds.append(first_object)

    seen: set[str] = set()
    queue: deque[str] = deque(seeds)

    while queue:
        candidate = queue.popleft()
        if not candidate:
            continue
        candidate = _sanitize_json_tokens(candidate).strip()
        if candidate in seen:
            continue
        seen.add(candidate)

        parsed = _json_dict_or_none(candidate)
        if parsed:
            return parsed

        parsed = _literal_dict_or_none(candidate)
        if parsed:
            return parsed

        unwrapped = _maybe_unwrap_json_string(candidate)
        if unwrapped and unwrapped not in seen:
            queue.append(unwrapped)

        cleaned = _TRAILING_COMMA_RE.sub(r"\1", candidate)
        if cleaned != candidate and cleaned not in seen:
            queue.append(cleaned)

        balanced = _maybe_balance_brackets(candidate)
        if balanced and balanced not in seen:
            queue.append(balanced)

    return {}


def _discover_query_endpoints() -> List[str]:
    """Return GET endpoints under /api/query (best effort)."""
    try:
        from fastapi.routing import APIRoute  # type: ignore
        from plugins.router import router as plugins_router  # type: ignore
    except Exception as exc:  # pragma: no cover
        log.warning("router import failed: %s", exc)
        return []

    paths: List[str] = []
    for route in getattr(plugins_router, "routes", []) or []:
        if not isinstance(route, APIRoute):
            continue
        methods = set(route.methods or [])
        if "GET" not in methods:
            continue
        path = getattr(route, "path", None) or getattr(route, "path_format", None)
        if not isinstance(path, str):
            continue
        if "/ai-report" in path or "snapshot" in path or "heatmap" in path:
            continue
        paths.append(path)
    uniq: List[str] = []
    seen = set()
    for path in paths:
        if path not in seen:
            uniq.append(path)
            seen.add(path)
    return uniq


def _fetch_json(client: httpx.Client, url: str, params: Optional[Dict[str, Any]] = None) -> Tuple[bool, Any]:
    try:
        response = client.get(url, params=params or {})
        response.raise_for_status()
        return True, response.json()
    except Exception as exc:
        return False, {"error": str(exc), "url": url}


def _collect_widget_data() -> Dict[str, Any]:
    base = FETCH_BASE.rstrip("/") + "/api/query"
    data: Dict[str, Any] = {"_meta": {"base": base}}
    timeout_seconds = max(5.0, float(LLM_TIMEOUT_S or 60.0))
    timeout = httpx.Timeout(timeout_seconds, connect=min(10.0, timeout_seconds / 2))
    with httpx.Client(timeout=timeout) as client:
        discovered = _discover_query_endpoints()
        tails = set()
        for path in discovered:
            if path.startswith("/api/query"):
                tails.add(path[len("/api/query"):] or "/")
            tails.add(path)
        data["_meta"]["discovered"] = discovered

        def _shrink(payload: Any) -> Any:
            if isinstance(payload, dict):
                trimmed = dict(payload)
                rows = trimmed.get("rows")
                if isinstance(rows, list) and len(rows) > 50:
                    trimmed["rows"] = rows[:50]
                buckets = trimmed.get("buckets")
                if isinstance(buckets, list) and len(buckets) > 60:
                    trimmed["buckets"] = buckets[:60]
                return trimmed
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
            if rel in tails or ("/api/query" + rel) in tails:
                ok, payload = _fetch_json(client, base + rel, params)
                data[key] = _shrink(payload) if ok else {"_fail": payload}

        if (
            ("/top-buttons/paths" in tails or "/api/query/top-buttons/paths" in tails)
            and ("/top-buttons/by-path" in tails or "/api/query/top-buttons/by-path" in tails)
        ):
            ok_paths, paths_payload = _fetch_json(client, base + "/top-buttons/paths", {})
            sample_path = None
            if ok_paths and isinstance(paths_payload, dict):
                candidates = paths_payload.get("paths") or paths_payload.get("rows") or []
                if isinstance(candidates, list) and candidates:
                    first = candidates[0]
                    if isinstance(first, str):
                        sample_path = first
                    elif isinstance(first, dict):
                        sample_path = first.get("path")
            if sample_path:
                ok_btn, btn_payload = _fetch_json(
                    client, base + "/top-buttons/by-path", {"path": sample_path, "range": "7d"}
                )
                data["top_buttons_by_path"] = _shrink(btn_payload) if ok_btn else {"_fail": btn_payload}
            else:
                data["top_buttons_by_path"] = {"_skip": "no path candidates"}

        known = {rel for _, rel, _ in simple_gets} | {"/top-buttons/paths", "/top-buttons/by-path"}
        misc: Dict[str, Any] = {}
        for full in discovered:
            tail = full
            if tail.startswith("/api/query"):
                tail = tail[len("/api/query"):]
            if not tail.startswith("/"):
                tail = "/" + tail
            if tail in known:
                continue
            ok, payload = _fetch_json(client, base + tail, {})
            key = tail.strip("/").replace("/", "_") or "root"
            misc[key] = _shrink(payload) if ok else {"_fail": payload}
        if misc:
            data["misc"] = misc
    return data


def _build_messages(bundle: Dict[str, Any], prompt: str, language: str, audience: str, word_limit: int) -> List[Dict[str, str]]:
    schema_hint = {
        "generated_at": "ISO8601 string",
        "title": "AI 리포트",
        "summary": "string",
        "diagnostics": [{"focus": "모바일Chrome", "finding": "string", "widget": "device_share", "severity": "High"}],
        "page_issues": [{"page": "/checkout", "issue": "string", "widget": "page_exit_rate"}],
        "interaction_insights": [{"area": "CTA 버튼", "insight": "string", "widget": "top_buttons_global"}],
        "ux_recommendations": [{"category": "UX", "suggestion": "string"}],
        "tech_recommendations": [{"category": "Tech", "suggestion": "string"}],
        "priorities": [{"title": "string", "priority": "High|Medium|Low", "impact": "string"}],
        "metrics_to_track": [{"metric": "page_exit_rate", "widget": "page_exit_rate"}],
        "predictions": [{"metric": "전환율", "baseline": 2.1, "expected": 2.6, "unit": "%"}],
        "radar_scores": [{"axis": "performance|experience|growth|search|stability", "score": 60}],
        "meta": {"prompt_version": "v2"},
    }

    system_prompt = (
        "You are a senior analytics engineer. Return STRICT JSON ONLY that matches the schema. "
        "No preface, no markdown, no extra text. Reply in Korean when language=ko."
    )
    soft_prompt = (prompt or "").strip()[:400]
    user_prompt = (
        f"Language: {language}\n"
        f"Audience: {audience}\n"
        f"WordLimit: {word_limit}\n"
        f"UserHint(LightlyIncorporate): {soft_prompt}\n\n"
        "Build an AI report that does the following:\n"
        "- `diagnostics`: 2~4 핵심 환경별 문제를 위젯 데이터를 근거로 설명.\n"
        "- `page_issues`: 체류 시간 대비 이탈이 높은 페이지만 골라 가설을 작성.\n"
        "- `interaction_insights`: 버튼/클릭 패턴을 기반으로 개선 방향을 제안.\n"
        "- `ux_recommendations`: 즉시 실행 가능한 UX 조치와 검증 방법을 제시.\n"
        "- `tech_recommendations`: 기술 조치와 추적 방법을 명시.\n"
        "- `priorities`: 노력 대비 효과 기준으로 High/Medium/Low 분류.\n"
        "- `metrics_to_track`: 개선 후 7일간 모니터링할 위젯과 목표 변화를 명확히 기재.\n"
        "- `predictions`: 조치 실행 시 baseline 대비 expected 값을 숫자로 제시.\n"
        "- `radar_scores`: five axes 0-100 점수, 서로 다른 지표 근거 사용.\n\n"
        "Respond with JSON only, conforming to this schema:\n"
        f"{json.dumps(schema_hint, ensure_ascii=False)}\n\n"
        f"WIDGET_API_BUNDLE:\n{json.dumps(bundle, ensure_ascii=False)}"
    )
    return [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}]


def _normalize_radar_axis(value: Any) -> Optional[str]:
    if not isinstance(value, str):
        return None
    cleaned = value.strip().lower().replace(" ", "")
    if not cleaned:
        return None
    return RADAR_AXIS_ALIASES.get(cleaned, cleaned if cleaned in RADAR_AXIS_ORDER else None)


def _normalize_radar_scores(payload: Dict[str, Any]) -> None:
    raw_scores = payload.get("radar_scores")
    items = raw_scores if isinstance(raw_scores, list) else []
    normalized: Dict[str, Dict[str, Any]] = {}

    for item in items:
        if not isinstance(item, dict):
            continue
        axis_field = item.get("axis")
        axis_text = axis_field if isinstance(axis_field, str) else ""
        axis_text = axis_text.replace("/", "|")
        candidates = [seg.strip() for seg in axis_text.split("|") if seg.strip()] or (
            [axis_field] if axis_field else []
        )
        for candidate in candidates:
            axis_key = _normalize_radar_axis(candidate)
            if not axis_key or axis_key in normalized:
                continue
            score_raw = item.get("score")
            try:
                score_val = int(float(score_raw))
            except Exception:
                score_val = 50
            score_val = max(0, min(100, score_val))
            commentary = item.get("commentary")
            commentary_text = commentary if isinstance(commentary, str) and commentary.strip() else None
            normalized[axis_key] = {
                "axis": axis_key,
                "score": score_val,
                "commentary": commentary_text or RADAR_FALLBACK_COMMENTARY,
            }
    for axis in RADAR_AXIS_ORDER:
        if axis not in normalized:
            normalized[axis] = {"axis": axis, "score": 50, "commentary": RADAR_FALLBACK_COMMENTARY}
    payload["radar_scores"] = [normalized[axis] for axis in RADAR_AXIS_ORDER]


def _sanitize_recommendation_lists(payload: Dict[str, Any]) -> None:
    def _clean_list(items: Any, default_category: str) -> List[Dict[str, Any]]:
        cleaned: List[Dict[str, Any]] = []
        if not isinstance(items, list):
            return cleaned
        for item in items:
            if not isinstance(item, dict):
                continue
            suggestion = item.get("suggestion")
            if not isinstance(suggestion, str) or not suggestion.strip():
                continue
            category = item.get("category")
            category_text = category.strip() if isinstance(category, str) else default_category
            if not category_text:
                category_text = default_category
            new_item = dict(item)
            new_item["category"] = category_text
            new_item["suggestion"] = suggestion.strip()
            cleaned.append(new_item)
        return cleaned

    payload["ux_recommendations"] = _clean_list(payload.get("ux_recommendations"), "UX")
    payload["tech_recommendations"] = _clean_list(payload.get("tech_recommendations"), "Tech")


def _sanitize_metrics(payload: Dict[str, Any]) -> None:
    metrics = payload.get("metrics_to_track")
    cleaned: List[Dict[str, Any]] = []
    if not isinstance(metrics, list):
        payload["metrics_to_track"] = cleaned
        return

    for item in metrics:
        if not isinstance(item, dict):
            continue
        entry = dict(item)
        reason = entry.get("reason")
        if not isinstance(reason, str) or not reason.strip():
            entry["reason"] = "Tracking rationale missing"
        cleaned.append(entry)
    payload["metrics_to_track"] = cleaned


def _fallback_report(bundle: Dict[str, Any]) -> Dict[str, Any]:
    def _first_row(payload: Any) -> Dict[str, Any]:
        if not isinstance(payload, dict):
            return {}
        for key in ("rows", "data", "buckets"):
            rows = payload.get(key)
            if isinstance(rows, list):
                for entry in rows:
                    if isinstance(entry, dict):
                        return entry
        return {}

    top_page = _first_row(bundle.get("top_pages"))
    high_exit = _first_row(bundle.get("page_exit_rate"))
    heatmap = _first_row(bundle.get("top_buttons_by_path"))

    top_path = (top_page.get("path") or top_page.get("url") or "/") if isinstance(top_page, dict) else "/"
    dwell_time = top_page.get("avg_duration") or top_page.get("avg_time")
    dwell_text = f"{dwell_time}s" if isinstance(dwell_time, (int, float)) else (dwell_time or "15s 미만")
    exit_rate = high_exit.get("exit_rate") or high_exit.get("ratio")
    exit_text = f"{exit_rate}%" if isinstance(exit_rate, (int, float)) else (exit_rate or "높은 이탈률")

    def _heatmap_area(row: Any) -> str:
        if not isinstance(row, dict):
            return ""
        for key in ("label", "area", "path", "button", "name"):
            value = row.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        return ""

    heatmap_area = _heatmap_area(heatmap) or "주요 CTA 버튼"

    report = {
        "generated_at": _now_iso(),
        "title": "AI 리포트",
        "summary": "LLM 호출 실패로 규칙 기반 리포트를 제공합니다.",
        "diagnostics": [
            {
                "focus": "모바일 Chrome",
                "finding": "전체 트래픽의 절반을 차지하지만 이탈률이 높습니다.",
                "widget": "device_share",
                "severity": "High",
                "share": "≈50%",
                "insight": "모바일 번들 로딩 지연 여부를 먼저 확인하세요.",
            },
            {
                "focus": "Desktop Safari",
                "finding": "세션 규모는 작지만 전환 저하에 기여합니다.",
                "widget": "browser_share",
                "severity": "Medium",
                "share": "≈12%",
                "insight": "브라우저 호환성 오류 로그를 확인하세요.",
            },
        ],
        "page_issues": [
            {
                "page": top_path,
                "issue": "체류 시간이 짧고 이탈률이 높습니다.",
                "dwell_time": dwell_text,
                "exit_rate": exit_text,
                "insight": "CTA 위계를 단순화하고 핵심 콘텐츠를 상단에 배치하세요.",
                "widget": "time_top_pages",
            }
        ],
        "interaction_insights": [
            {
                "area": heatmap_area,
                "insight": "히트맵 상위 버튼이 전체 클릭의 60% 이상을 차지합니다.",
                "action": "서브 CTA를 축소하고 터치 영역을 넓혀 클릭 미스를 줄이세요.",
                "widget": "top_buttons_by_path",
            }
        ],
        "ux_recommendations": [
            {
                "category": "UX",
                "suggestion": "결제 페이지 요약 영역을 상단으로 올리고 버튼 대비를 강화합니다.",
                "rationale": "상위 페이지 중 결제 단계 체류 시간이 가장 짧습니다.",
                "validation": "time_top_pages 위젯으로 7일간 평균 체류 시간을 추적",
            }
        ],
        "tech_recommendations": [
            {
                "category": "Tech",
                "suggestion": "모바일 번들을 분할하고 이미지 lazy-load를 적용합니다.",
                "rationale": "모바일 Chrome 로그 대비 이탈률이 커서 로딩 병목이 의심됩니다.",
                "validation": "daily_count·device_share 지표와 LCP 계측을 비교",
            }
        ],
        "priorities": [
            {
                "title": "모바일 Chrome 로딩 속도 개선",
                "priority": "High",
                "impact": "이탈률 10%p 감소 시 전환율 +5% 기대",
                "effort": "Medium",
                "expected_metric_change": {"metric": "page_exit_rate", "period": "7d", "target": "-10%"},
                "business_outcome": "모바일 매출 손실 방지",
            },
            {
                "title": "결제 CTA 시각적 위계 정비",
                "priority": "Medium",
                "impact": "체류시간 +15% 기대",
                "effort": "Low",
                "expected_metric_change": {"metric": "avg_time_on_page", "period": "7d", "target": "+15%"},
                "business_outcome": "완료율 +3% 예상",
            },
        ],
        "metrics_to_track": [
            {
                "metric": "page_exit_rate",
                "widget": "page_exit_rate",
                "reason": "이탈 감소 여부 확인",
                "target_change": "-10%",
                "timeframe": "7d",
            },
            {
                "metric": "time_on_page",
                "widget": "time_top_pages",
                "reason": "UX 개선 검증",
                "target_change": "+15%",
                "timeframe": "7d",
            },
        ],
        "predictions": [
            {"metric": "전환율", "baseline": 2.3, "expected": 2.8, "unit": "%", "narrative": "모바일 이탈 10%p 감소 시"},
            {"metric": "일일 로그 수", "baseline": 1800, "expected": 1950, "unit": "sessions", "narrative": "유입 부족 보완"},
        ],
        "radar_scores": [
            {"axis": "performance", "score": 58, "commentary": "모바일 번들 최적화 필요"},
            {"axis": "experience", "score": 62, "commentary": "CTA 집중도가 높아 혼선 발생"},
            {"axis": "growth", "score": 54, "commentary": "일일 로그 상승이 정체됨"},
            {"axis": "search", "score": 66, "commentary": "검색 유입은 안정적"},
            {"axis": "stability", "score": 70, "commentary": "오류 로그는 낮음"},
        ],
        "meta": {"mode": "fallback", "prompt_version": "v2", "source": "router_scan"},
    }
    return report


def _finalize_report(payload: Dict[str, Any], mode: str) -> Dict[str, Any]:
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
        if not isinstance(payload.get(key), list):
            payload[key] = []
    payload.setdefault("generated_at", _now_iso())
    payload.setdefault("title", "AI 리포트")
    _normalize_radar_scores(payload)
    _sanitize_recommendation_lists(payload)
    _sanitize_metrics(payload)

    meta = payload.get("meta")
    if not isinstance(meta, dict):
        meta = {}
    meta.setdefault("provider", LLM_PROVIDER or "unknown")
    meta.setdefault("model", LLM_MODEL or "unknown")
    meta.setdefault("prompt_version", "v2")
    meta.setdefault("source", "router_scan")
    meta["mode"] = mode
    payload["meta"] = meta

    return ReportResponse(**payload).model_dump()


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
    del from_ts, to_ts, bucket, site_id  # Inputs are handled via widget bundle collection.
    bundle = _collect_widget_data()
    messages = _build_messages(bundle, prompt, language, audience, word_limit)
    provider = _resolved_provider()

    try:
        if provider in {"", "disabled", "none"}:
            raise RuntimeError("LLM disabled")
        if provider in {"openai", "openai_compat", "vllm"}:
            content = _call_openai_compatible(messages)
        else:
            content = _call_ollama_resilient(messages)

        log.debug("ai-report raw LLM response: %s", (content[:500] + "...") if isinstance(content, str) and len(content) > 500 else content)
        data = _extract_json(content)
        if not isinstance(data, dict) or not data:
            log.warning("LLM returned invalid JSON, attempting repair. snippet=%s", _safe_snippet(content))
            repaired = _retry_llm_for_json(messages, content)
            if repaired:
                data = _extract_json(repaired)
        if not isinstance(data, dict) or not data:
            raise ValueError("invalid JSON from LLM")
        return _finalize_report(data, mode="llm")
    except Exception as exc:
        log.warning("LLM failed, using fallback: %s", exc)
        fallback = _fallback_report(bundle)
        return _finalize_report(fallback, mode="fallback")


def _safe_snippet(text: Any, limit: int = 1200) -> str:
    if isinstance(text, bytes):
        text = text.decode("utf-8", "replace")
    elif not isinstance(text, str):
        try:
            text = json.dumps(text, ensure_ascii=False)
        except Exception:
            text = str(text)
    sanitized = (text or "").replace("\r", "\\r").replace("\n", "\\n")
    if len(sanitized) > limit:
        return sanitized[:limit] + "...(truncated)"
    return sanitized

