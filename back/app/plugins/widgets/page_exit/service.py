"""Service logic for the Page Exit Rate widget.
페이지별 이탈률 집계 로직 (InfluxDB 3.x SQL).
"""

from __future__ import annotations
from typing import Any, Dict, List
from datetime import datetime, timedelta, timezone

from influxdb_client_3 import InfluxDBClient3
from config import INFLUX_DATABASE, INFLUX_URL, INFLUX_TOKEN


def get_page_exit_rate(days: int = 7) -> List[Dict[str, Any]]:
    """
    Return per-path exit rate rows for the given period.

    exit_rate = (sessions that ended on path) / (views on path) * 100

    Numerator:
      - For each session_id, find the last page_view within the period, then count per path.

    Denominator:
      - SUM(count) of events per path for the period where event_name = 'page_view'

    Returns rows like:
        [{
          "path": "/home",
          "views": 120,
          "exits": 45,
          "exit_rate": 37.5
        }, ...]
    """

    now = datetime.now(timezone.utc)
    since = now - timedelta(days=days)

    from_str = since.strftime("%Y-%m-%d %H:%M:%S")
    to_str = now.strftime("%Y-%m-%d %H:%M:%S")

    sql_query = f"""
    WITH last_view AS (
        SELECT session_id, MAX(time) AS last_time
        FROM events
        WHERE
            time >= TIMESTAMP '{from_str}' AND time < TIMESTAMP '{to_str}'
            AND event_name = 'page_view'
            AND session_id IS NOT NULL AND session_id <> ''
        GROUP BY session_id
    ),
    exits AS (
        SELECT e.path  AS path, COUNT(DISTINCT e.session_id) AS exit_sessions
        FROM events e
        JOIN last_view lv
          ON e.session_id = lv.session_id AND e.time = lv.last_time
        GROUP BY e.path
    ),
    views AS (
        SELECT path, SUM(count) AS views
        FROM events
        WHERE
            time >= TIMESTAMP '{from_str}' AND time < TIMESTAMP '{to_str}'
            AND event_name = 'page_view'
        GROUP BY path
    )
    SELECT
        v.path,
        v.views AS views,
        COALESCE(x.exit_sessions, 0) AS exits,
        ROUND( 100.0 * COALESCE(x.exit_sessions, 0) / NULLIF(v.views, 0), 2) AS exit_rate
    FROM views v
    LEFT JOIN exits x ON v.path = x.path
    WHERE COALESCE(x.exit_sessions, 0) > 0
    ORDER BY exit_rate DESC, views DESC
    """

    client = InfluxDBClient3(host=INFLUX_URL, token=INFLUX_TOKEN, database=INFLUX_DATABASE)
    try:
        table = client.query(query=sql_query, language="sql")
        data = table.to_pydict() if table is not None else {}
        if not data or "path" not in data:
            return []

        rows: List[Dict[str, Any]] = []
        count_rows = len(data.get("path", []))
        for i in range(count_rows):
            rows.append(
                {
                    "path": str(data["path"][i]),
                    "views": int((data.get("views", [0] * count_rows)[i]) or 0),
                    "exits": int((data.get("exits", [0] * count_rows)[i]) or 0),
                    "exit_rate": float((data.get("exit_rate", [0.0] * count_rows)[i]) or 0.0),
                }
            )
        return rows
    except Exception as e:
        print(f"[get_page_exit_rate] {e}")
        return []
    finally:
        client.close()
