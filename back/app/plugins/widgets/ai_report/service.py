from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

import httpx

from plugins.widgets.ai_insights.service import build_digest

log = logging.getLogger("ai_report")


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


# ---- LLM env ----
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


LLM_PROVIDER = (os.getenv("LLM_PROVIDER", "ollama") or "ollama").strip()  # ollama|openai_compat|none
LLM_ENDPOINT = (os.getenv("LLM_ENDPOINT", "") or "").strip()
LLM_MODEL = (os.getenv("LLM_MODEL", "llama3.1:8b-instruct") or "").strip()
LLM_API_KEY = (os.getenv("LLM_API_KEY", "") or "").strip()
LLM_MAX_TOKENS = _int_env("LLM_MAX_TOKENS", 1024)
LLM_TEMPERATURE = _float_env("LLM_TEMPERATURE", 0.2)
LLM_TIMEOUT_S = _float_env("LLM_TIMEOUT_S", _float_env("LLM_TIMEOUT", 25.0))


def _is_docker() -> bool:
    try:
        return os.path.exists("/.dockerenv") or (os.getenv("RUNNING_IN_DOCKER") == "1")
    except Exception:
        return False


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
                    # ollama /api/chat returns { message: {content: ...}, ... }
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


def build_aggregate(from_iso: Optional[str], to_iso: Optional[str], bucket: str, site_id: Optional[str]) -> Dict[str, Any]:
    return build_digest(from_iso, to_iso, bucket, site_id)


def _build_messages(aggregate: Dict[str, Any], prompt: str, language: str, audience: str, word_limit: int) -> List[Dict[str, str]]:
    schema_hint = {
        "generated_at": "ISO8601",
        "title": "AI 리포트",
        "summary": "string",
        "diagnostics": [{"widget": "string", "finding": "string", "pattern": "string"}],
        "recommendations": [{"category": "string", "suggestion": "string", "rationale": "string"}],
        "priorities": [{
            "title": "string",
            "priority": "High|Medium|Low",
            "impact": "string",
            "effort": "Low|Medium|High",
            "expected_metric_change": {"metric": "string", "period": "7d", "target": "string"}
        }],
        "metrics_to_track": ["string"],
        "meta": {"prompt_version": "v1"}
    }

    system = (
        "You are a senior analytics engineer. Return STRICT JSON ONLY that matches the schema. "
        "No preface, no markdown, no extra text. Korean if language=ko."
    )
    soft_prompt = (prompt or "").strip()
    user = (
        f"Language: {language}\n"
        f"Audience: {audience}\n"
        f"WordLimit: {word_limit}\n"
        f"UserHint(LightlyIncorporate): {soft_prompt[:400]}\n\n"
        "Using the following aggregated analytics DIGEST, produce an AI report with: summary, diagnostics (3-6), "
        "recommendations (3-6), prioritized actions (3-6), and metrics_to_track (3-6). \n"
        "Respond with JSON only, conforming to this schema:\n"
        f"{json.dumps(schema_hint, ensure_ascii=False)}\n\n"
        f"DIGEST:\n{json.dumps(aggregate, ensure_ascii=False)}"
    )
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def _fallback_report(aggregate: Dict[str, Any]) -> Dict[str, Any]:
    series = (aggregate or {}).get("series", {})
    pv = series.get("pageviews", [])
    top_paths = (aggregate or {}).get("top_paths", [])
    summary = "최근 트래픽과 상위 경로를 바탕으로 기본 리포트를 생성했습니다."
    diags: List[Dict[str, Any]] = []
    if pv:
        peak = max(pv, key=lambda x: x.get("v", 0))
        diags.append({"widget": "일일 로그 수", "finding": f"최고 PV 시점: {peak.get('t')}", "pattern": "트래픽 피크 탐지"})
    if top_paths:
        top = top_paths[0]
        diags.append({"widget": "상위 페이지 5개", "finding": f"1위 경로: {top.get('path','/')} (pv={top.get('pv',0)})"})
    return {
        "generated_at": _now_iso(),
        "title": "AI 리포트",
        "summary": summary,
        "diagnostics": diags[:4],
        "recommendations": [
            {"category": "성능", "suggestion": "모바일 환경 로딩 시간 계측 및 최적화", "rationale": "전환 저하 예방"},
            {"category": "UX", "suggestion": "이탈 높은 페이지의 CTA 배치 점검", "rationale": "사용자 여정 개선"},
        ],
        "priorities": [
            {"title": "모바일 로딩 최적화", "priority": "High", "impact": "이탈률 개선 기대", "effort": "Medium",
             "expected_metric_change": {"metric": "page_exit_rate", "period": "7d", "target": "-10%"}},
        ],
        "metrics_to_track": ["페이지별 이탈 비율", "페이지별 체류시간", "일일 로그 수"],
        "meta": {"mode": "rule"},
    }


def generate_report(from_iso: Optional[str], to_iso: Optional[str], bucket: str, site_id: Optional[str],
                    prompt: str, language: str, audience: str, word_limit: int) -> Dict[str, Any]:
    aggregate = build_aggregate(from_iso, to_iso, bucket, site_id)
    msgs = _build_messages(aggregate, prompt, language, audience, word_limit)
    try:
        if LLM_PROVIDER == "openai_compat":
            content = _call_openai_compatible(msgs)
        else:  # default ollama
            content = _call_ollama_resilient(msgs)
        data = _extract_json(content)
        if not isinstance(data, dict) or not data:
            raise ValueError("invalid JSON from LLM")
        # Ensure required keys
        data.setdefault("generated_at", _now_iso())
        data.setdefault("title", "AI 리포트")
        data.setdefault("meta", {})
        data["meta"].update({
            "provider": LLM_PROVIDER,
            "model": LLM_MODEL,
            "prompt_version": "v1",
        })
        return data
    except Exception as e:
        log.warning("LLM failed, using fallback: %s", e)
        return _fallback_report(aggregate)

