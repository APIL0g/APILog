from __future__ import annotations

import os
from typing import Optional


def _clean_str(value: Optional[str], default: str = "", *, strip: bool = True) -> str:
    if value is None:
        return default
    if strip:
        value = value.strip()
    return value or default


def _as_int(value: Optional[str], default: int) -> int:
    if value is None:
        return default
    value = value.strip()
    if not value:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def _as_float(value: Optional[str], default: float) -> float:
    if value is None:
        return default
    value = value.strip()
    if not value:
        return default
    try:
        return float(value)
    except ValueError:
        return default


def is_running_in_docker() -> bool:
    """Detect container runtime via well-known markers."""
    try:
        return os.path.exists("/.dockerenv") or os.getenv("RUNNING_IN_DOCKER") == "1"
    except Exception:
        return False


# InfluxDB settings (shared by ingest/plugins)
_raw_influx_url = os.getenv("INFLUX_URL")
INFLUX_URL: str = _clean_str(_raw_influx_url, "http://influxdb3-core:8181")

_raw_influx_token = os.getenv("INFLUX_TOKEN")
INFLUX_TOKEN: str = _clean_str(_raw_influx_token, "dev-token")

_raw_influx_database = os.getenv("INFLUX_DATABASE")
INFLUX_DATABASE: str = _clean_str(_raw_influx_database, "apilog_db")


# CORS
_raw_cors = os.getenv("CORS_ALLOW_ORIGIN")
CORS_ALLOW_ORIGIN: str = _clean_str(_raw_cors, "*")


# LLM & AI defaults
_raw_llm_provider = os.getenv("LLM_PROVIDER")
LLM_PROVIDER: str = _clean_str(_raw_llm_provider, "ollama")

_raw_llm_endpoint = os.getenv("LLM_ENDPOINT")
LLM_ENDPOINT: str = _clean_str(_raw_llm_endpoint, "http://ollama:11434").rstrip("/")

_raw_llm_model = os.getenv("LLM_MODEL")
LLM_MODEL: str = _clean_str(_raw_llm_model, "llama3:8b")

_raw_llm_api_key = os.getenv("LLM_API_KEY")
LLM_API_KEY: str = _clean_str(_raw_llm_api_key, "")

_raw_llm_max_tokens = os.getenv("LLM_MAX_TOKENS")
LLM_MAX_TOKENS: int = _as_int(_raw_llm_max_tokens, 1024)

_raw_llm_temperature = os.getenv("LLM_TEMPERATURE")
LLM_TEMPERATURE: float = _as_float(_raw_llm_temperature, 0.2)

_raw_llm_timeout_s = os.getenv("LLM_TIMEOUT_S")
LLM_TIMEOUT_S: float = _as_float(_raw_llm_timeout_s, 60.0)

# AI Report specific LLM overrides (falls back to global LLM_* when unset)
_raw_report_llm_provider = os.getenv("AI_REPORT_LLM_PROVIDER")
AI_REPORT_LLM_PROVIDER: str = _clean_str(_raw_report_llm_provider, LLM_PROVIDER)

_raw_report_llm_endpoint = os.getenv("AI_REPORT_LLM_ENDPOINT")
AI_REPORT_LLM_ENDPOINT: str = _clean_str(
    _raw_report_llm_endpoint, LLM_ENDPOINT
).rstrip("/")

_raw_report_llm_model = os.getenv("AI_REPORT_LLM_MODEL")
AI_REPORT_LLM_MODEL: str = _clean_str(_raw_report_llm_model, LLM_MODEL)

_raw_report_llm_api_key = os.getenv("AI_REPORT_LLM_API_KEY")
AI_REPORT_LLM_API_KEY: str = _clean_str(_raw_report_llm_api_key, LLM_API_KEY)

_raw_report_llm_max_tokens = os.getenv("AI_REPORT_LLM_MAX_TOKENS")
AI_REPORT_LLM_MAX_TOKENS: int = _as_int(
    _raw_report_llm_max_tokens, LLM_MAX_TOKENS
)

_raw_report_llm_temperature = os.getenv("AI_REPORT_LLM_TEMPERATURE")
AI_REPORT_LLM_TEMPERATURE: float = _as_float(
    _raw_report_llm_temperature, LLM_TEMPERATURE
)

_raw_report_llm_timeout_s = os.getenv("AI_REPORT_LLM_TIMEOUT_S")
AI_REPORT_LLM_TIMEOUT_S: float = _as_float(
    _raw_report_llm_timeout_s, LLM_TIMEOUT_S
)

# AI cache knobs
_raw_ai_insights_cache_ttl = os.getenv("AI_INSIGHTS_CACHE_TTL")
AI_INSIGHTS_CACHE_TTL: float = _as_float(_raw_ai_insights_cache_ttl, 60.0)

_raw_ai_insights_explain_cache_ttl = os.getenv("AI_INSIGHTS_EXPLAIN_CACHE_TTL")
AI_INSIGHTS_EXPLAIN_CACHE_TTL: int = _as_int(
    _raw_ai_insights_explain_cache_ttl, 300
)


# AI report internal fetch endpoint
_raw_ai_report_fetch_base = os.getenv("AI_REPORT_FETCH_BASE")
AI_REPORT_FETCH_BASE: str = _clean_str(
    _raw_ai_report_fetch_base, "http://127.0.0.1:8000"
).rstrip("/")


# Misc
_raw_target_site_base_url = os.getenv("TARGET_SITE_BASE_URL")
TARGET_SITE_BASE_URL: str = _clean_str(
    _raw_target_site_base_url, "your-website-url"
)


# Dynamic widget storage path (JSON)
_raw_dynamic_widgets_path = os.getenv("DYNAMIC_WIDGETS_PATH")
DYNAMIC_WIDGETS_PATH: str = _clean_str(
    _raw_dynamic_widgets_path, "/snapshots/dynamic_widgets.json"
)
