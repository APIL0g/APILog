"""Service logic for the Dwell Time widget.
페이지별 평균 체류 시간을 InfluxDB에서 집계합니다.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import logging
from typing import Any, Dict, List, Tuple

try:
    from influxdb_client_3 import InfluxDBClient3  # type: ignore
except Exception:  # pragma: no cover
    InfluxDBClient3 = None  # type: ignore

from influxdb_client import InfluxDBClient

from config import INFLUX_URL, INFLUX_TOKEN, INFLUX_ORG, INFLUX_BUCKET


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


def _flux_path_filter_lines() -> str:
    if not PATH_DENYLIST:
        return ""

    clauses = [
        f'r.path <> "{value}"'
        for value in sorted(PATH_DENYLIST)
        if value
    ]
    if not clauses:
        return ""

    predicate = " and ".join(clauses)
    return f"  |> filter(fn: (r) => {predicate})\n"


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

    rows: List[Dict[str, Any]] = []
    backend = "sql"

    if InfluxDBClient3 is not None:
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

            with InfluxDBClient3(host=INFLUX_URL, token=INFLUX_TOKEN, database=INFLUX_BUCKET) as c3:  # type: ignore
                result = c3.query(sql)
            rows = _result_rows_from_sql(result)
        except Exception as exc:
            backend = "flux"
            LOGGER.warning("Failed dwell-time SQL query, falling back to Flux: %s", exc)

    if not rows:
        # Fallback to Flux for environments without InfluxDB 3 SQL.
        try:
            path_filter_lines = _flux_path_filter_lines()
            flux = f"""
from(bucket: "{INFLUX_BUCKET}")
  |> range(start: -{range_token})
  |> filter(fn: (r) => r._measurement == "events")
  |> filter(fn: (r) => r.event_name == "{DWELL_EVENT_NAME}")
  |> filter(fn: (r) => r._field == "dwell_ms")
  |> filter(fn: (r) => exists r.path and r.path <> "")
{path_filter_lines}  |> group(columns: ["path"])
  |> mean()
  |> sort(columns: ["_value"], desc: true)
  |> limit(n: {limit})
"""
            with InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG) as c2:
                tables = c2.query_api().query(flux)

            backend = "flux"
            rows = []
            for table in tables:
                for record in table.records:
                    path = record.get("path") or "/"
                    avg_ms = float(record.get("_value", 0.0) or 0.0)
                    rows.append(
                        {
                            "path": str(path),
                            "avg_seconds": round(avg_ms / 1000.0, 2),
                            "samples": None,
                            "sessions": None,
                        }
                    )
            if rows:
                _populate_flux_sample_counts(range_token, rows)
        except Exception as exc:
            LOGGER.warning("Failed dwell-time Flux query: %s", exc)
            backend = "none"
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


def _populate_flux_sample_counts(range_token: str, rows: List[Dict[str, Any]]) -> None:
    paths = [row["path"] for row in rows if row.get("path")]
    if not paths:
        return

    escaped = [
        path.replace("\\", "\\\\").replace('"', '\\"')
        for path in paths
    ]
    path_filter_expr = " or ".join(f'r.path == "{value}"' for value in escaped)
    if not path_filter_expr:
        return

    flux = f"""
from(bucket: "{INFLUX_BUCKET}")
  |> range(start: -{range_token})
  |> filter(fn: (r) => r._measurement == "events")
  |> filter(fn: (r) => r.event_name == "{DWELL_EVENT_NAME}")
  |> filter(fn: (r) => r._field == "dwell_ms")
  |> filter(fn: (r) => {path_filter_expr})
  |> count(column: "_value")
"""
    with InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG) as client:
        tables = client.query_api().query(flux)

    counts: Dict[str, int] = {}
    for table in tables:
        for record in table.records:
            path = record.get("path") or "/"
            counts[path] = int(record.get("_value", 0) or 0)

    for row in rows:
        path = row.get("path")
        if not path:
            continue
        row["samples"] = counts.get(path, row.get("samples") or 0)
