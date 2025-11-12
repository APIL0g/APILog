"""Service logic for the Dwell Time widget.
페이지별 평균 체류 시간을 InfluxDB에서 집계합니다.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import logging
from typing import Any, Dict, List, Tuple

from influxdb_client_3 import InfluxDBClient3

from config import INFLUX_DATABASE, INFLUX_TOKEN, INFLUX_URL


LOOKBACK_DAYS = 7
LOOKBACK_RANGE_TOKEN = f"{LOOKBACK_DAYS}d"
LOOKBACK_SECONDS = LOOKBACK_DAYS * 24 * 60 * 60
DWELL_EVENT_NAME = "page_view_dwell"
PATH_DENYLIST = {"", "none"}

LOGGER = logging.getLogger(__name__)


def _result_rows_from_sql(result: Any) -> List[Dict[str, Any]]:
    """Normalize SQL client outputs into a consistent list of dicts.

    InfluxDB v3 client APIs sometimes return Pandas DataFrames (`iterrows`),
    Arrow tables (`to_pylist` / `read_all`), or raw Python lists depending on
    the version and optional dependencies installed.  This helper keeps the
    query logic agnostic of those variations.
    """
    rows: List[Dict[str, Any]] = []
    if result is None:
        return rows

    try:
        if hasattr(result, "iterrows"):
            for _, series in result.iterrows():  # type: ignore[attr-defined]
                record = dict(series)
                rows.append(_normalize_row_dict(record))
            return rows

        data: List[Dict[str, Any]] = []
        if hasattr(result, "to_pylist"):
            data = result.to_pylist()  # type: ignore[attr-defined]
        elif hasattr(result, "read_all"):
            try:
                table = result.read_all()  # type: ignore[attr-defined]
                if hasattr(table, "to_pylist"):
                    data = table.to_pylist()  # type: ignore[attr-defined]
            except Exception:
                data = []
        elif isinstance(result, list):
            data = result

        for entry in data:
            if isinstance(entry, dict):
                rows.append(_normalize_row_dict(entry))
    except Exception as exc:
        print(f"[query_dwell_time][parse] {exc}")
    return rows


def _normalize_row_dict(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Standardize heterogenous SQL/Flux row payloads into widget schema."""
    path = str(raw.get("path") or "/")

    avg_seconds = raw.get("avg_seconds")
    if avg_seconds is None:
        # fall back to avg_ms when provided
        avg_ms = raw.get("avg_ms")
        avg_seconds = (float(avg_ms) / 1000.0) if avg_ms is not None else 0.0
    avg_seconds = float(avg_seconds or 0.0)

    samples = raw.get("samples")
    if samples is None and raw.get("count") is not None:
        samples = raw.get("count")
    if samples is None:
        samples = 0

    sessions = raw.get("sessions")
    if sessions is None:
        sessions = raw.get("distinct_sessions")
    sessions = int(sessions or 0)

    return {
        "path": path,
        "avg_seconds": avg_seconds,
        "samples": int(samples or 0),
        "sessions": sessions,
    }


def _format_range_label(seconds: int) -> str:
    if seconds % (24 * 3600) == 0:
        return f"{seconds // (24 * 3600)}d"
    if seconds % 3600 == 0:
        return f"{seconds // 3600}h"
    if seconds % 60 == 0:
        return f"{seconds // 60}m"
    return f"{seconds}s"


def _sql_path_filter() -> str:
    if not PATH_DENYLIST:
        return ""
    deny = ", ".join(f"'{value}'" for value in sorted(PATH_DENYLIST))
    return f"    AND path NOT IN ({deny})\n"


def query_dwell_time(
    limit: int = 10,
    range_seconds: int = LOOKBACK_SECONDS,
    range_label: str | None = None,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """Return top paths ranked by average dwell time (seconds) for the requested window."""
    limit = max(1, min(int(limit or 10), 50))
    range_seconds = max(60, int(range_seconds or LOOKBACK_SECONDS))
    now = datetime.now(timezone.utc)
    since = now - timedelta(seconds=range_seconds)
    range_token = range_label or _format_range_label(range_seconds)

    backend = "sql"
    try:
        from_str = since.strftime("%Y-%m-%d %H:%M:%S")
        to_str = now.strftime("%Y-%m-%d %H:%M:%S")

        sql = f"""
SELECT
    path,
    ROUND(AVG("dwell_ms") / 1000.0, 2) AS avg_seconds,
    COUNT(*)::BIGINT AS samples,
    COUNT(DISTINCT session_id)::BIGINT AS sessions
FROM "events"
WHERE
    time >= TIMESTAMP '{from_str}' AND time < TIMESTAMP '{to_str}'
    AND event_name = '{DWELL_EVENT_NAME}'
    AND "dwell_ms" > 0
    AND path IS NOT NULL AND path <> ''
{_sql_path_filter()}
GROUP BY path
ORDER BY avg_seconds DESC
LIMIT {limit}
"""

        with InfluxDBClient3(
            host=INFLUX_URL,
            token=INFLUX_TOKEN,
            database=INFLUX_DATABASE,
        ) as c3:
            result = c3.query(sql)
        rows = _result_rows_from_sql(result)
    except Exception as exc:
        backend = "error"
        LOGGER.warning("Failed dwell-time SQL query: %s", exc)
        rows = []

    meta = {
        "range": range_token,
        "from": since.isoformat().replace("+00:00", "Z"),
        "to": now.isoformat().replace("+00:00", "Z"),
        "limit": limit,
        "total_samples": int(sum(r.get("samples", 0) or 0 for r in rows)),
        "backend": backend,
    }

    return rows, meta
