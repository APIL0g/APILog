from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import httpx

log = logging.getLogger("ai_report")


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


# ---- LLM/env ----
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

# Base URL to call this server's own query endpoints
FETCH_BASE = (os.getenv("AI_REPORT_FETCH_BASE", "http://127.0.0.1:8000") or "").rstrip("/")


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
        "Using the following widget API responses (raw JSON from multiple endpoints), produce an AI report with: summary, diagnostics (3-6), "
        "recommendations (3-6), prioritized actions (3-6), and metrics_to_track (3-6). \n"
        "Respond with JSON only, conforming to this schema:\n"
        f"{json.dumps(schema_hint, ensure_ascii=False)}\n\n"
        f"WIDGET_API_BUNDLE:\n{json.dumps(bundle, ensure_ascii=False)}"
    )
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def _fallback_report(bundle: Dict[str, Any]) -> Dict[str, Any]:
    top_pages_rows = []
    try:
        tp = (bundle.get("top_pages") or {}).get("rows")
        if isinstance(tp, list):
            top_pages_rows = tp
    except Exception:
        pass
    summary = "최근 트래픽과 상위 경로를 바탕으로 기본 리포트를 생성했습니다."
    diags: List[Dict[str, Any]] = []
    if top_pages_rows:
        top = top_pages_rows[0]
        path = (top.get("path") if isinstance(top, dict) else None) or "/"
        pv = (top.get("total_views") if isinstance(top, dict) else None) or 0
        diags.append({"widget": "상위 페이지 5개", "finding": f"1위 경로: {path} (views={pv})"})
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
        data.setdefault("meta", {})
        data["meta"].update({
            "provider": LLM_PROVIDER,
            "model": LLM_MODEL,
            "prompt_version": "v1",
            "source": "router_scan",
        })
        return data
    except Exception as e:
        log.warning("LLM failed, using fallback: %s", e)
        return _fallback_report(bundle)

