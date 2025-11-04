"""Service logic for the Device Share widget.
디바이스 유형별 사용자 수와 비중을 InfluxDB에서 집계합니다.
"""

from __future__ import annotations
from typing import Any, Dict, List
from datetime import datetime, timedelta, timezone
from influxdb_client_3 import InfluxDBClient3
from config import INFLUX_URL, INFLUX_TOKEN, INFLUX_BUCKET


def get_device_share(days: int = 7, limit: int = 3) -> List[Dict[str, Any]]:
    """Return Device share pages.

        Aggregate distinct session counts by device_type.
        각 device_type별로 DISTINCT session_id를 집계.

        The ratio(pct) is calculated by windowed sum in DB.
        비율(pct)은 DB에서 윈도우 합으로 계산.
    
    Returns:
        [
            {"device": "desktop", "sessions": 120, "pct": 63.16},
            {"device": "mobile",  "sessions": 60,  "pct": 31.58},
            {"device": "tablet",  "sessions": 10,  "pct": 5.26}
        ]
    """

    now = datetime.now(timezone.utc)
    since = now - timedelta(days=days)

    from_str = since.strftime("%Y-%m-%d %H:%M:%S")
    to_str = now.strftime("%Y-%m-%d %H:%M:%S")

    sql_query = f"""
    SELECT
        device,
        sessions,
        ROUND( 100.0 * sessions / NULLIF(SUM(sessions) OVER (),0), 2) AS pct
    FROM (
        SELECT        
            LOWER(device_type) AS device,
            COUNT(DISTINCT session_id) AS sessions
        FROM events
        WHERE
            time >= TIMESTAMP '{from_str}' 
            AND time < TIMESTAMP '{to_str}'
            AND session_id IS NOT NULL AND session_id <> ''
            AND device_type IN ('desktop', 'mobile')
        GROUP BY device
    )
    ORDER BY sessions DESC
    LIMIT {limit} 
    """ 

    client = InfluxDBClient3(host=INFLUX_URL, token=INFLUX_TOKEN, database=INFLUX_BUCKET)
    try:
        table = client.query(query=sql_query, language="sql")
        data = table.to_pydict() if table is not None else {}
        if not data or "device" not in data:
            return []

        rows: List[Dict[str, Any]] = []
        for i in range(len(data["device"])):
            rows.append({
                "device": str(data["device"][i]),
                "sessions": int(data["sessions"][i] or 0),
                "pct": float(data["pct"][i] or 0.0),
            })
        return rows
    except Exception as e:
        print(f"[get_device_share] {e}")
        return []
    finally:
        client.close()
