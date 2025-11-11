"""Service logic for the Time Top Page widget.
시간대(6시간/12시간) 버킷별로 페이지 조회 Top N을 집계합니다.
InfluxDB 3(SQL) 기반으로 구현합니다.
"""

from __future__ import annotations

from typing import Any, Dict, List, DefaultDict
from collections import defaultdict
from datetime import datetime

from influxdb_client_3 import InfluxDBClient3  # type: ignore

from config import INFLUX_DATABASE, INFLUX_URL, INFLUX_TOKEN


def get_time_top_pages(
    bucket_hours: int = 6,
    hours: int = 24,
    limit: int = 5,
) -> List[Dict[str, Any]]:
    """
    Return top pages per time bucket within the lookback window.

    Args:
        bucket_hours: 버킷 크기(6 또는 12)
        hours: 조회 기간(시간 단위, 기본 24시간)
        limit: 버킷별 상위 N 페이지

    Returns (example):
        [
            {
                "bucket": "2025-01-01T00:00:00Z",
                "rows": [
                    {"path": "/home", "total_views": 53},
                    {"path": "/products", "total_views": 21}
                ]
            },
            {
                "bucket": "2025-01-01T06:00:00Z",
                "rows": [ ... ]
            }
        ]
    """

    bucket_hours = 12 if int(bucket_hours) == 12 else 6
    hours = max(1, int(hours))
    limit = max(1, int(limit))

    client = InfluxDBClient3(host=INFLUX_URL, token=INFLUX_TOKEN, database=INFLUX_DATABASE)

    sql_query = f"""
    SELECT
        DATE_BIN(INTERVAL '{bucket_hours} hour', time) AS bucket,
        path,
        SUM(count) AS total_views
    FROM events
    WHERE event_name = 'page_view'
      AND time >= now() - INTERVAL '{hours} hour'
    GROUP BY bucket, path
    ORDER BY bucket ASC
    """

    def _to_bucket_str(v: Any) -> str:
        # Normalize bucket value to ISO-like string for grouping/return
        if isinstance(v, datetime):
            s = v.isoformat()
            # Normalize naive to Z if needed
            return s if s.endswith("Z") else s
        return str(v)

    try:
        table = client.query(query=sql_query, language="sql")

        data = table.to_pydict()  # {'bucket': [...], 'path': [...], 'total_views': [...]}
        if not data or 'bucket' not in data or 'path' not in data or 'total_views' not in data:
            return []

        n = min(len(data['bucket']), len(data['path']), len(data['total_views']))

        grouped: DefaultDict[str, List[Dict[str, Any]]] = defaultdict(list)
        for i in range(n):
            b = _to_bucket_str(data['bucket'][i])
            p = data['path'][i]
            tv_raw = data['total_views'][i]
            try:
                tv = int(tv_raw)
            except Exception:
                tv = int(tv_raw or 0)
            grouped[b].append({"path": p, "total_views": tv})

        # Sort each bucket's rows by total_views desc and trim to limit
        result: List[Dict[str, Any]] = []
        # Sort buckets by key; keys are ISO-like so lexicographic works
        for bucket_key in sorted(grouped.keys()):
            rows = sorted(grouped[bucket_key], key=lambda r: r.get("total_views", 0), reverse=True)[:limit]
            result.append({"bucket": bucket_key, "rows": rows})

        return result

    except Exception as e:
        print(f"Error querying InfluxDB (time_top_page): {e}")
        return []
    finally:
        client.close()

