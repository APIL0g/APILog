"""Service logic for the Daily Count widget.
최근 1주일 간의 날짜별 로그 수를 InfluxDB에서 집계합니다.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

# v3 SQL 클라이언트 (FlightSQL)
try:
    from influxdb_client_3 import InfluxDBClient3  # type: ignore
except Exception:  # pragma: no cover - 런타임에만 필요한 경우 대비
    InfluxDBClient3 = None  # type: ignore

# v2 Flux 클라이언트 (호환 경로가 있을 때만 사용)
from influxdb_client import InfluxDBClient

# 재사용을 위해 수집 모듈의 설정을 참조합니다.
from ingest.influx import (
    INFLUX_URL,
    INFLUX_TOKEN,
    INFLUX_ORG,
    INFLUX_BUCKET,
)


def _iso_date(dt: datetime) -> str:
    return dt.date().isoformat()


def _last_n_days(n: int) -> List[str]:
    today = datetime.now(timezone.utc).date()
    return [
        (today - timedelta(days=i)).isoformat() for i in range(n - 1, -1, -1)
    ]


def query_daily_counts(days: int = 7) -> List[Dict[str, Any]]:
    """Return daily total counts for the last `days` days.
    InfluxDB 3(SQL) 우선 사용, 실패 시 Flux 호환 경로를 시도합니다.
    """
    days = max(1, int(days))

    # 1) InfluxDB 3 (SQL via FlightSQL)
    if InfluxDBClient3 is not None:
        try:
            with InfluxDBClient3(host=INFLUX_URL, token=INFLUX_TOKEN, database=INFLUX_BUCKET) as c3:  # type: ignore
                sql = f"""
SELECT DATE_BIN(INTERVAL '1 day', time) AS day,
       SUM("count")::BIGINT AS cnt
FROM "events"
WHERE time >= now() - INTERVAL '{days} day'
GROUP BY day
ORDER BY day ASC
"""
                res = c3.query(sql)

            raw: Dict[str, int] = {}
            # pandas.DataFrame 경로
            if hasattr(res, "iterrows"):
                for _, row in res.iterrows():  # type: ignore[attr-defined]
                    day = row["day"]
                    cnt = int(row["cnt"] or 0)
                    key = _iso_date(day) if isinstance(day, datetime) else str(day)[0:10]
                    raw[key] = raw.get(key, 0) + cnt
            else:
                # pyarrow.Table 또는 RecordBatchReader 처리
                rows: List[Dict[str, Any]] = []
                if hasattr(res, "to_pylist"):
                    # pyarrow.Table
                    rows = res.to_pylist()  # type: ignore[attr-defined]
                elif hasattr(res, "read_all"):
                    # RecordBatchReader -> Table
                    try:
                        table = res.read_all()  # type: ignore[attr-defined]
                        if hasattr(table, "to_pylist"):
                            rows = table.to_pylist()  # type: ignore[attr-defined]
                    except Exception:
                        rows = []
                elif isinstance(res, list):
                    rows = res  # already list of dict-like

                for row in rows:
                    day = row.get("day")  # type: ignore
                    cnt = int((row.get("cnt") if isinstance(row, dict) else 0) or 0)  # type: ignore
                    key = _iso_date(day) if isinstance(day, datetime) else str(day)[0:10]
                    raw[key] = raw.get(key, 0) + cnt

            days_list = _last_n_days(days)
            return [{"date": d, "cnt": int(raw.get(d, 0))} for d in days_list]
        except Exception:
            # SQL 경로 실패 시 Flux로 폴백
            pass

    # 2) Flux fallback (InfluxDB 2.x 호환 엔드포인트가 켜져 있을 때)
    flux = f"""
from(bucket: "{INFLUX_BUCKET}")
  |> range(start: -{days}d)
  |> filter(fn: (r) => r._measurement == "events")
  |> filter(fn: (r) => r._field == "count")
  |> aggregateWindow(every: 1d, fn: sum, createEmpty: true)
  |> group(columns: ["_time"]) 
  |> sum()
  |> sort(columns: ["_time"], desc: false)
"""
    with InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG) as client:
        tables = client.query_api().query(flux)

    raw2: Dict[str, int] = {}
    for table in tables:
        for record in table.records:
            t = record.get_time()  # type: ignore[attr-defined]
            if isinstance(t, datetime):
                key = _iso_date(t)
            else:
                key = str(record.get("_time"))[0:10]
            val = int(record.get("_value", 0) or 0)
            raw2[key] = raw2.get(key, 0) + val

    days_list = _last_n_days(days)
    return [{"date": d, "cnt": int(raw2.get(d, 0))} for d in days_list]
