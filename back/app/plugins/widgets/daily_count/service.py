"""Service logic for the Daily Count widget.
최근 1주일 간의 날짜별 로그 수를 InfluxDB 3(SQL)에서 집계합니다.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

from influxdb_client_3 import InfluxDBClient3

from config import INFLUX_DATABASE, INFLUX_TOKEN, INFLUX_URL


def _iso_date(dt: datetime) -> str:
    return dt.date().isoformat()


def _last_n_days(n: int) -> List[str]:
    today = datetime.now(timezone.utc).date()
    return [
        (today - timedelta(days=i)).isoformat() for i in range(n - 1, -1, -1)
    ]


def query_daily_counts(days: int = 7) -> List[Dict[str, Any]]:
    """Return daily total counts for the last `days` days."""
    days = max(1, int(days))
    sql = f"""
SELECT DATE_BIN(INTERVAL '1 day', time) AS day,
       SUM("count")::BIGINT AS cnt
FROM "events"
WHERE time >= now() - INTERVAL '{days} day'
GROUP BY day
ORDER BY day ASC
"""
    try:
        with InfluxDBClient3(
            host=INFLUX_URL,
            token=INFLUX_TOKEN,
            database=INFLUX_DATABASE,
        ) as client:
            res = client.query(sql)

        raw: Dict[str, int] = {}
        if hasattr(res, "iterrows"):
            for _, row in res.iterrows():  # type: ignore[attr-defined]
                day = row["day"]
                cnt = int(row["cnt"] or 0)
                key = _iso_date(day) if isinstance(day, datetime) else str(day)[0:10]
                raw[key] = raw.get(key, 0) + cnt
        else:
            rows: List[Dict[str, Any]] = []
            if hasattr(res, "to_pylist"):
                rows = res.to_pylist()  # type: ignore[attr-defined]
            elif hasattr(res, "read_all"):
                try:
                    table = res.read_all()  # type: ignore[attr-defined]
                    if hasattr(table, "to_pylist"):
                        rows = table.to_pylist()  # type: ignore[attr-defined]
                except Exception:
                    rows = []
            elif isinstance(res, list):
                rows = res

            for row in rows:
                day = row.get("day")  # type: ignore
                cnt = int((row.get("cnt") if isinstance(row, dict) else 0) or 0)
                key = _iso_date(day) if isinstance(day, datetime) else str(day)[0:10]
                raw[key] = raw.get(key, 0) + cnt

        days_list = _last_n_days(days)
        return [{"date": d, "cnt": int(raw.get(d, 0))} for d in days_list]
    except Exception:
        days_list = _last_n_days(days)
        return [{"date": d, "cnt": 0} for d in days_list]
