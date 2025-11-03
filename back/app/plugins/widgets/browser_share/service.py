"""Service logic for the Browser Share widget.
브라우저별 세션 비율/집계를 InfluxDB에서 계산합니다.
"""

from __future__ import annotations

from typing import Any, Dict, List
from datetime import datetime

# Prefer v3 (FlightSQL / SQL) if available
try:  # pragma: no cover
    from influxdb_client_3 import InfluxDBClient3  # type: ignore
except Exception:  # pragma: no cover
    InfluxDBClient3 = None  # type: ignore

# Fallback to v2 Flux client
from influxdb_client import InfluxDBClient

from config import INFLUX_URL, INFLUX_TOKEN, INFLUX_ORG, INFLUX_BUCKET


def _as_int(x: Any, default: int = 0) -> int:
    try:
        return int(x)
    except Exception:
        return default


def query_browser_share(days: int = 7, limit: int = 10) -> List[Dict[str, Any]]:
    """Return session counts grouped by browser for the last `days`.

    Returns a list like: [{"browser": "Chrome", "sessions": 123}, ...]
    """
    days = max(1, int(days))
    limit = max(1, int(limit))

    # 1) InfluxDB 3 (SQL) path
    if InfluxDBClient3 is not None:
        try:
            with InfluxDBClient3(host=INFLUX_URL, token=INFLUX_TOKEN, database=INFLUX_BUCKET) as c3:  # type: ignore
                sql = f"""
SELECT
  browser_family AS browser,
  COUNT(DISTINCT session_id) AS sessions
FROM "events"
WHERE time >= now() - INTERVAL '{days} day'
  AND session_id IS NOT NULL AND session_id <> ''
GROUP BY browser
ORDER BY sessions DESC
LIMIT {limit}
"""
                res = c3.query(sql)

            rows: List[Dict[str, Any]] = []

            # pandas.DataFrame style
            if hasattr(res, "iterrows"):
                for _, r in res.iterrows():  # type: ignore[attr-defined]
                    rows.append({
                        "browser": str(r.get("browser", "unknown")),
                        "sessions": _as_int(r.get("sessions", 0), 0),
                    })
                return rows

            # pyarrow.Table / RecordBatchReader style
            pyrows: List[Dict[str, Any]] = []
            if hasattr(res, "to_pylist"):
                pyrows = res.to_pylist()  # type: ignore[attr-defined]
            elif hasattr(res, "read_all"):
                try:
                    table = res.read_all()  # type: ignore[attr-defined]
                    if hasattr(table, "to_pylist"):
                        pyrows = table.to_pylist()  # type: ignore[attr-defined]
                except Exception:
                    pyrows = []
            elif isinstance(res, list):
                pyrows = res  # assume list[dict]

            for r in pyrows:
                browser = r.get("browser") if isinstance(r, dict) else None
                sessions = r.get("sessions") if isinstance(r, dict) else None
                rows.append({
                    "browser": str(browser or "unknown"),
                    "sessions": _as_int(sessions, 0),
                })

            return rows
        except Exception:
            # fall back to Flux
            pass

    # 2) Flux fallback (InfluxDB 2.x compatibility)
    flux = f"""
from(bucket: "{INFLUX_BUCKET}")
  |> range(start: -{days}d)
  |> filter(fn: (r) => r._measurement == "events")
  |> filter(fn: (r) => r._field == "session_id")
  |> filter(fn: (r) => exists r._value and r._value != "")
  |> group(columns: ["browser_family"])
  |> distinct(column: "_value")
  |> count()
  |> rename(columns: {_value: "sessions"})
  |> keep(columns: ["browser_family", "sessions"]) 
  |> group()
  |> sort(columns: ["sessions"], desc: true)
  |> limit(n: {limit})
"""

    with InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG) as client:
        tables = client.query_api().query(flux)

    rows: List[Dict[str, Any]] = []
    for table in tables:
        for record in table.records:
            browser = str(record.get("browser_family") or "unknown")
            sessions = _as_int(record.get("sessions", 0), 0)
            rows.append({"browser": browser, "sessions": sessions})

    return rows

