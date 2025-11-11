"""Service logic for the Browser Share widget.
브라우저별 세션 비율/집계를 InfluxDB에서 계산합니다.
"""

from __future__ import annotations

from typing import Any, Dict, List

from influxdb_client_3 import InfluxDBClient3

from config import INFLUX_DATABASE, INFLUX_URL, INFLUX_TOKEN


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

    try:
        with InfluxDBClient3(host=INFLUX_URL, token=INFLUX_TOKEN, database=INFLUX_DATABASE) as c3:
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
        return []

