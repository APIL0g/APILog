"""Service logic for the Country Share widget.
Aggregates session counts per country within a lookback range.
"""

from __future__ import annotations

from typing import Any, Dict, List, Tuple

try:  # pragma: no cover
    from influxdb_client_3 import InfluxDBClient3  # type: ignore
except Exception:  # pragma: no cover
    InfluxDBClient3 = None  # type: ignore

from influxdb_client import InfluxDBClient

from config import INFLUX_URL, INFLUX_TOKEN, INFLUX_ORG, INFLUX_BUCKET


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except Exception:
        return default


def _parse_range(range_str: str) -> Tuple[int, str]:
    """Return (value, unit) where unit is 'd' or 'h'."""
    s = (range_str or "7d").strip().lower()
    digits = "".join(ch for ch in s if ch.isdigit())
    unit = "d"
    if "h" in s:
        unit = "h"
    elif "d" in s:
        unit = "d"
    if not digits:
        digits = "7"
    try:
        value = max(1, int(digits))
    except ValueError:
        value = 7
    return value, unit


def _interval_for_sql(value: int, unit: str) -> str:
    return f"{value} {'day' if unit == 'd' else 'hour'}"


def _interval_for_flux(value: int, unit: str) -> str:
    return f"{value}{unit}"


def _normalise_code(raw: Any) -> Tuple[str, str]:
    code = str(raw or "").strip().upper()
    if not code or code in {"NONE", "NULL", "UNKNOWN"}:
        return "UNKNOWN", "Unknown"
    return code[:16], code[:16]


def query_country_share(range_str: str = "7d", top: int = 5) -> Dict[str, Any]:
    top = max(1, int(top))
    value, unit = _parse_range(range_str)
    sql_interval = _interval_for_sql(value, unit)
    flux_interval = _interval_for_flux(value, unit)
    limit_fetch = max(top + 10, top * 3)

    rows: List[Dict[str, Any]] = []

    if InfluxDBClient3 is not None:
        try:
            with InfluxDBClient3(host=INFLUX_URL, token=INFLUX_TOKEN, database=INFLUX_BUCKET) as c3:  # type: ignore
                sql = f"""
SELECT
  COALESCE(NULLIF(country_code, ''), 'none') AS country,
  COUNT(DISTINCT session_id) AS sessions
FROM "events"
WHERE time >= now() - INTERVAL '{sql_interval}'
  AND session_id IS NOT NULL AND session_id <> ''
GROUP BY country
ORDER BY sessions DESC
LIMIT {limit_fetch}
"""
                res = c3.query(sql)

            if hasattr(res, "iterrows"):
                for _, r in res.iterrows():  # type: ignore[attr-defined]
                    rows.append({
                        "country": r.get("country"),
                        "sessions": _safe_int(r.get("sessions"), 0),
                    })
                return _shape_results(rows, top)

            pyrows: List[Dict[str, Any]] = []
            if hasattr(res, "to_pylist"):
                pyrows = res.to_pylist()  # type: ignore[attr-defined]
            elif hasattr(res, "read_all"):
                try:
                    table = res.read_all()  # type: ignore[attr-defined]
                    if hasattr(table, "to_pylist"):
                        pyrows = table.to_pylist()  # type: ignore[attr-defined]
                except Exception:  # pragma: no cover
                    pyrows = []
            elif isinstance(res, list):
                pyrows = res  # type: ignore[assignment]

            for r in pyrows:
                country = r.get("country") if isinstance(r, dict) else None
                sessions = r.get("sessions") if isinstance(r, dict) else None
                rows.append({
                    "country": country,
                    "sessions": _safe_int(sessions, 0),
                })
            return _shape_results(rows, top)
        except Exception:
            rows.clear()

    flux = f"""
from(bucket: "{INFLUX_BUCKET}")
  |> range(start: -{flux_interval})
  |> filter(fn: (r) => r._measurement == "events")
  |> filter(fn: (r) => r._field == "session_id")
  |> filter(fn: (r) => exists r._value and r._value != "")
  |> group(columns: ["country_code"])
  |> distinct(column: "_value")
  |> count()
  |> rename(columns: {{_value: "sessions"}})
  |> keep(columns: ["country_code", "sessions"])
  |> group()
  |> sort(columns: ["sessions"], desc: true)
  |> limit(n: {limit_fetch})
"""
    with InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG) as client:
        tables = client.query_api().query(flux)

    for table in tables:
        for record in table.records:
            rows.append({
                "country": record.get("country_code"),
                "sessions": _safe_int(record.get("sessions", 0), 0),
            })

    return _shape_results(rows, top)


def _shape_results(raw_rows: List[Dict[str, Any]], top: int) -> Dict[str, Any]:
    normalised: List[Dict[str, Any]] = []

    for row in raw_rows:
        sessions = _safe_int(row.get("sessions"), 0)
        if sessions <= 0:
            continue
        code, label = _normalise_code(row.get("country"))
        normalised.append({"code": code, "label": label, "sessions": sessions})

    normalised.sort(key=lambda r: r["sessions"], reverse=True)

    total = sum(r["sessions"] for r in normalised)
    if not normalised:
        return {"rows": [], "total": 0}

    top_rows = normalised[:top]
    others_value = sum(r["sessions"] for r in normalised[top:])
    if others_value > 0:
        top_rows.append({"code": "OTHERS", "label": "Others", "sessions": others_value})

    return {
        "rows": top_rows,
        "total": total,
    }
