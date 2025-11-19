"""LLM-backed AI insights service.
Robust Ollama/OpenAI calls, safe JSON parsing, and configurable caching.
"""
from __future__ import annotations

import json
import hashlib
import logging
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime, timezone

import httpx
from cachetools import TTLCache
from fastapi import HTTPException

from config import (
    AI_INSIGHTS_EXPLAIN_CACHE_TTL,
    LLM_API_KEY,
    LLM_ENDPOINT,
    LLM_MAX_TOKENS,
    LLM_MODEL,
    LLM_PROVIDER,
    LLM_TEMPERATURE,
    LLM_TIMEOUT_S,
    is_running_in_docker,
)

log = logging.getLogger("ai_insights")

# Cache TTL for explain results (seconds). Set to 0 to disable caching.
EXPLAIN_CACHE_TTL_S = AI_INSIGHTS_EXPLAIN_CACHE_TTL
_cache = TTLCache(maxsize=256, ttl=max(0, EXPLAIN_CACHE_TTL_S))

# ---- Utils ----
def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()

def _cache_key(digest: Dict[str, Any], language: str, word_limit: int, audience: str) -> str:
    blob = json.dumps({
        "d": digest,
        "lang": language,
        "w": word_limit,
        "aud": audience,
        "prov": LLM_PROVIDER,
        "model": LLM_MODEL,
    }, sort_keys=True)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()

def _rule_based_insights(digest: Dict[str, Any]) -> Dict[str, Any]:
    totals = digest.get("totals") if isinstance(digest, dict) else {}
    top_paths = digest.get("top_paths") if isinstance(digest, dict) else []

    pageviews = float(totals.get("pageviews") or 0)
    sessions = float(totals.get("sessions") or 0)
    users = float(totals.get("users") or 0)

    insights: List[Dict[str, Any]] = []

    if pageviews <= 0 or sessions <= 0:
        insights.append(
            {
                "title": "트래픽 데이터 부족",
                "severity": "medium",
                "metric_refs": ["pageviews", "sessions"],
                "evidence": {"pageviews": pageviews, "sessions": sessions},
                "explanation": "최근 구간에서 수집된 페이지뷰/세션 데이터가 없어 AI 인사이트를 생성할 수 없습니다.",
                "action": "SDK 스니펫과 수집 파이프라인이 정상 동작하는지 확인하세요.",
            }
        )
    else:
        avg_session = pageviews / max(sessions, 1)
        insights.append(
            {
                "title": "세션당 페이지뷰",
                "severity": "low",
                "metric_refs": ["pageviews", "sessions"],
                "evidence": {"pageviews": pageviews, "sessions": sessions, "pages_per_session": round(avg_session, 2)},
                "explanation": f"세션당 평균 페이지뷰는 약 {avg_session:.1f} PVS 입니다.",
                "action": "핵심 전환 경로의 페이지 수를 줄여 이탈을 방지하세요.",
            }
        )

    if isinstance(top_paths, list) and top_paths:
        primary = top_paths[0]
        path = primary.get("path") or primary.get("url") or "unknown"
        share = primary.get("share") or primary.get("ratio")
        insights.append(
            {
                "title": "상위 페이지 집중도",
                "severity": "medium",
                "metric_refs": ["top_paths"],
                "evidence": {"top_path": path, "share": share},
                "explanation": f"'{path}' 경로가 트래픽의 대부분을 차지합니다.",
                "action": "해당 페이지의 로딩 속도와 CTA 배치를 점검하세요.",
            }
        )

    return {
        "generated_at": _now_iso(),
        "insights": insights,
        "meta": {"provider": "rule_based", "fallback": True},
    }

def _extract_json(text: str) -> Dict[str, Any]:
    # 1) Entire content is JSON
    try:
        return json.loads(text)
    except Exception:
        pass
    # 2) Find first balanced {...}
    start = text.find("{")
    if start == -1:
        return {"generated_at": _now_iso(), "insights": [], "meta": {"fallback": "parse_failed"}}
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
    return {"generated_at": _now_iso(), "insights": [], "meta": {"fallback": "parse_failed"}}

def _is_docker() -> bool:
    return is_running_in_docker()
# ---- Error-to-status mapping (Ollama) ----
def _ollama_status_from_exception(exc: Exception) -> Tuple[Optional[str], Optional[str]]:
    """Map exceptions from Ollama calls to user-friendly status messages.
    Returns (code, message) or (None, None) if not a recognized Ollama status.
    """
    try:
        msg = (str(exc) or "").lower()
    except Exception:
        msg = ""
    # Connection issues
    if isinstance(exc, (httpx.ConnectError, httpx.ConnectTimeout, httpx.ReadTimeout)):
        # Some transient disconnects happen while models are being prepared
        if "disconnect" in msg or "disconnected" in msg:
            return (
                "model_downloading",
                "모델을 다운로드 중입니다. 잠시 후 다시 시도해주세요.",
            )
        return (
            "ollama_unreachable",
            "AI 백엔드(Ollama)에 연결할 수 없습니다. Docker/Ollama 상태를 확인해주세요.",
        )
    # HTTP status specific handling
    if isinstance(exc, httpx.HTTPStatusError):
        try:
            status = exc.response.status_code
            body = (exc.response.text or "").lower()
        except Exception:
            status = None
            body = msg
        # 404: model not found
        if status == 404 or "model not found" in body or "no such model" in body or "unknown model" in body:
            return (
                "model_not_found",
                f"모델을 찾을 수 없습니다: {LLM_MODEL}. 먼저 모델을 다운로드 해주세요.",
            )
        # 503/5xx with pulling/downloading indicators
        if (status == 503 or (status and 500 <= status < 600)) or (
            "pull" in body or "downloading" in body or "waiting for model" in body or "model is downloading" in body
        ):
            return (
                "model_downloading",
                "모델을 다운로드 중입니다. 잠시 후 다시 시도해주세요.",
            )
    # Heuristic fallback by message
    if "model not found" in msg or "no such model" in msg or "unknown model" in msg:
        return (
            "model_not_found",
            f"모델을 찾을 수 없습니다: {LLM_MODEL}. 먼저 모델을 다운로드 해주세요.",
        )
    if (
        "pull" in msg
        or "downloading" in msg
        or "waiting for model" in msg
        or "model is downloading" in msg
        or "disconnect" in msg
        or "disconnected" in msg
    ):
        return (
            "model_downloading",
            "모델을 다운로드 중입니다. 잠시 후 다시 시도해주세요.",
        )
    return (None, None)
def _status_insight(message: str, code: str) -> Dict[str, Any]:
    """Build a response that surfaces status to the UI as an insight item.
    The front-end renders items under `insights`, so we place a single, low-severity
    item with the message in `explanation` to ensure the user sees it.
    """
    return {
        "generated_at": _now_iso(),
        "insights": [
            {
                "title": "AI 모델 상태",
                "severity": "low",
                "explanation": message,
                "action": "모델 준비 완료 후 다시 시도해주세요.",
                "metric_refs": [],
                "evidence": {},
            }
        ],
        "meta": {"fallback": code, "provider": LLM_PROVIDER, "model": LLM_MODEL},
    }

# ---- Prompt builder ----
def _compact_digest(digest: Dict[str, Any], max_points: int = None, top_n_paths: int = None) -> Dict[str, Any]:
    try:
        mp = max_points if isinstance(max_points, int) and max_points > 0 else _int_env("AI_INSIGHTS_MAX_SERIES_POINTS", 40)
        tp = top_n_paths if isinstance(top_n_paths, int) and top_n_paths > 0 else _int_env("AI_INSIGHTS_TOP_PATHS", 10)
        d = dict(digest)
        series = dict(d.get("series", {}))
        out_series: Dict[str, List[Dict[str, Any]]] = {}
        for k, arr in series.items():
            if isinstance(arr, list) and len(arr) > mp:
                out_series[k] = arr[-mp:]
            else:
                out_series[k] = arr
        d["series"] = out_series
        if isinstance(d.get("top_paths"), list) and len(d["top_paths"]) > tp:
            d["top_paths"] = d["top_paths"][:tp]
        # Optional trims
        for key in ("errors", "anomalies", "funnels"):
            val = d.get(key)
            if isinstance(val, list) and len(val) > tp:
                d[key] = val[:tp]
        return d
    except Exception:
        return digest

def _build_messages(digest: Dict[str, Any], language: str, word_limit: int, audience: str) -> List[Dict[str, str]]:
    # Use a compacted digest for Ollama to reduce tokens and latency
    use_digest = _compact_digest(digest) if LLM_PROVIDER == "ollama" else digest
    schema_hint = {
        "generated_at": "ISO8601",
        "insights": [{
            "title": "string",
            "severity": "low|medium|high|critical",
            "metric_refs": ["metric@time or path:..."],
            "evidence": {"any": "numbers/paths/codes"},
            "explanation": "string",
            "action": "string"
        }],
        "meta": {"prompt_version": "v1"}
    }
    system = (
        "You are a senior analytics engineer. "
        "Return STRICT JSON ONLY that matches the 'Insights' schema. "
        "No preface, no markdown, no additional text. "
        "Do not include any PII or user-level details."
    )
    user = (
        f"Language: {language}\n"
        f"Audience: {audience}\n"
        f"WordLimit: {word_limit}\n\n"
        "Using the following Digest JSON, produce 'Insights' JSON with 3-6 concise items.\n"
        "Each item must include: title, severity, metric_refs, evidence(with numbers), explanation, action.\n"
        "Respond with JSON only, matching this schema:\n"
        f"{json.dumps(schema_hint, ensure_ascii=False)}\n\n"
        f"DIGEST:\n{json.dumps(use_digest, ensure_ascii=False)}"
    )
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]


# ---- OpenAI-compatible ----
def _call_openai_compatible(messages: List[Dict[str, str]]) -> str:
    url = (LLM_ENDPOINT or "").rstrip("/") + "/v1/chat/completions"
    headers = {"Content-Type": "application/json"}
    api_key = (LLM_API_KEY or "").strip()
    if not api_key:
        raise RuntimeError("LLM_API_KEY is required for OpenAI-compatible providers")
    headers["Authorization"] = f"Bearer {api_key}"
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


# ---- Ollama resilient ----
def _call_ollama_resilient(messages: List[Dict[str, str]]) -> str:
    raise RuntimeError(
        "Local Ollama inference is disabled. Configure LLM_PROVIDER=openai_compat with a valid LLM_API_KEY."
    )


# ---- Entry point ----
def generate_insights(digest: Dict[str, Any], language: str, word_limit: int, audience: str) -> Dict[str, Any]:
    key = _cache_key(digest, language, word_limit, audience)
    if EXPLAIN_CACHE_TTL_S > 0 and key in _cache:
        return _cache[key]

    messages = _build_messages(digest, language, word_limit, audience)

    try:
        if LLM_PROVIDER in ("vllm", "openai_compat", "openai"):
            content = _call_openai_compatible(messages)
        elif LLM_PROVIDER == "ollama":
            raise HTTPException(
                status_code=503,
                detail={
                    "code": "ollama_disabled",
                    "message": "Local LLM inference is disabled. Configure LLM_PROVIDER=openai_compat "
                    "and supply LLM_API_KEY to use AI Insights.",
                },
            )
        else:
            result = _rule_based_insights(digest)
            if EXPLAIN_CACHE_TTL_S > 0:
                _cache[key] = result
            return result

        parsed = _extract_json(content)
        parsed.setdefault("generated_at", _now_iso())
        meta = parsed.setdefault("meta", {})
        meta.update({"provider": LLM_PROVIDER, "model": LLM_MODEL, "prompt_version": "v1"})
        if EXPLAIN_CACHE_TTL_S > 0:
            _cache[key] = parsed
        return parsed

    except HTTPException:
        raise
    except Exception as e:
        try:
            log.exception("[ai] LLM insights generation failed")
        except Exception:
            pass
        # For Ollama, return HTTP error codes to the client
        if LLM_PROVIDER == "ollama":
            code, user_msg = _ollama_status_from_exception(e)
            if code and user_msg:
                status_map = {
                    "model_not_found": 404,
                    "model_downloading": 503,
                    "ollama_unreachable": 503,
                }
                status_code = status_map.get(code, 502)
                detail = {
                    "code": code,
                    "message": user_msg,
                    "provider": LLM_PROVIDER,
                    "model": LLM_MODEL,
                }
                try:
                    detail["error"] = str(e)[:500]
                except Exception:
                    pass
                raise HTTPException(status_code=status_code, detail=detail)
            # Unknown Ollama error: propagate as 502 Bad Gateway
            raise HTTPException(
                status_code=502,
                detail={
                    "code": "Loading",
                    "message": "The ollama service is now loading. Please try again later.",
                    "provider": LLM_PROVIDER,
                    "model": LLM_MODEL,
                },
            )
        # Fallback: keep previous minimal rule-based insights
        result = _rule_based_insights(digest)
        result["meta"]["fallback"] = "llm_error"
        try:
            result["meta"]["error"] = str(e)[:500]
        except Exception:
            pass
        if EXPLAIN_CACHE_TTL_S > 0:
            _cache[key] = result
        return result
