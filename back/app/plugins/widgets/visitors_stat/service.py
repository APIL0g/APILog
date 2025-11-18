"""Service logic for visitor statistics.

Aggregates per-day visitor counts and new visitor counts based on ``user_hash``
values stored in InfluxDB.

🏃‍♂️ Performance notes
- 7일치 히스토리는 이제 하루씩 7번 조회하지 않고,
  **한 번의 범위 SQL(7일 구간)** 로 묶어서 가져온 뒤 파이썬에서 일자별로 풀어 쓴다.
- 과거 날짜(오늘 이전)는 여전히 메모리 캐시에 저장해서 재호출 속도를 높인다.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone, date
from threading import Lock
from typing import Any, Dict, List, Optional, Tuple

from influxdb_client_3 import InfluxDBClient3  # type: ignore

from config import INFLUX_DATABASE, INFLUX_URL

# Module level cache. Keyed by (date_iso, site_id or "").
_CACHE: Dict[Tuple[str, str], Dict[str, Any]] = {}
_CACHE_LOCK = Lock()


def get_visitor_stat(date_str: Optional[str] = None, site_id: Optional[str] = None) -> Dict[str, Any]:
    """Return visitor statistics for the given ``date_str``.

    Args:
        date_str: Target date in ``YYYY-MM-DD`` (ISO) format. Defaults to today.
        site_id: Optional site identifier filter. When provided, only events
                 matching this ``site_id`` are considered.

    Returns:
        {
            "date": "2025-01-01",
            "total_visitors": 120,
            "new_visitors": 45,
            "returning_visitors": 75,
            "history": [
                {
                    "date": "2024-12-26",
                    "total_visitors": ...,
                    "new_visitors": ...,
                    "returning_visitors": ...,
                },
                ...  # 7일치 (과거 6일 + target_date)
            ],
        }
    """

    target_date = _parse_date(date_str)
    today = datetime.now(timezone.utc).date()
    site_key = site_id or ""

    # 7일 window: target_date 포함 과거 6일
    history_days: List[date] = [
        target_date - timedelta(days=offset) for offset in range(6, -1, -1)
    ]

    stats_by_date: Dict[date, Dict[str, Any]] = {}
    missing_days: List[date] = []

    # 1) 캐시에서 먼저 채우고, 캐시에 없는 날짜만 모아서 한 번에 Influx 조회
    for day in history_days:
        if day < today:
            cached = _get_cached((day.isoformat(), site_key))
            if cached is not None:
                stats_by_date[day] = cached
                continue
        # 오늘이거나 캐시에 없는 과거 날짜는 나중에 범위 조회
        missing_days.append(day)

    if missing_days:
        start_day = min(missing_days)
        end_day = max(missing_days)
        range_stats = _query_range_influx(start_day, end_day, site_id)

        for iso, payload in range_stats.items():
            d = datetime.fromisoformat(iso).date()
            stats_by_date[d] = payload
            if d < today:
                _set_cached((iso, site_key), payload)

    # 2) 그래도 비어 있는 날짜(데이터 완전 0인 날)는 0으로 채움
    for day in history_days:
        if day not in stats_by_date:
            iso = day.isoformat()
            stats_by_date[day] = {
                "date": iso,
                "total_visitors": 0,
                "new_visitors": 0,
            }

    primary = stats_by_date.get(
        target_date,
        {
            "date": target_date.isoformat(),
            "total_visitors": 0,
            "new_visitors": 0,
        },
    )

    def _with_returning(payload: Dict[str, Any]) -> Dict[str, Any]:
        total = int(payload.get("total_visitors", 0) or 0)
        new = int(payload.get("new_visitors", 0) or 0)
        returning = max(0, total - new)
        enriched = dict(payload)
        enriched["returning_visitors"] = returning
        return enriched

    history_entries = [_with_returning(stats_by_date[d]) for d in history_days]

    response = _with_returning(primary)
    response["history"] = history_entries
    return response


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _parse_date(date_str: Optional[str]) -> date:
    if not date_str:
        return datetime.now(timezone.utc).date()

    # Accept both YYYY-MM-DD and full ISO timestamps by truncating to date.
    text = date_str.strip()
    if not text:
        return datetime.now(timezone.utc).date()

    try:
        # ``fromisoformat`` supports YYYY-MM-DD or full ISO strings.
        parsed = datetime.fromisoformat(text)
        if isinstance(parsed, datetime):
            return parsed.date()
    except ValueError:
        pass

    try:
        return datetime.strptime(text[:10], "%Y-%m-%d").date()
    except ValueError:
        return datetime.now(timezone.utc).date()


def _get_cached(key: Tuple[str, str]) -> Optional[Dict[str, Any]]:
    with _CACHE_LOCK:
        cached = _CACHE.get(key)
        if cached is None:
            return None
        # Return a shallow copy to avoid accidental external mutation.
        return dict(cached)


def _set_cached(key: Tuple[str, str], value: Dict[str, Any]) -> None:
    with _CACHE_LOCK:
        _CACHE[key] = dict(value)


def _query_range_influx(
    start_date: date,
    end_date: date,
    site_id: Optional[str],
) -> Dict[str, Dict[str, Any]]:
    """Query InfluxDB for a date range and return per-day stats.

    Args:
        start_date: 시작 날짜 (포함)
        end_date:   끝 날짜 (포함)

    Returns:
        {
            "YYYY-MM-DD": {
                "date": "YYYY-MM-DD",
                "total_visitors": int,
                "new_visitors": int,
            },
            ...
        }
    """
    # [start, end_next) 구간
    start_dt = datetime(start_date.year, start_date.month, start_date.day, tzinfo=timezone.utc)
    end_dt = datetime(end_date.year, end_date.month, end_date.day, tzinfo=timezone.utc) + timedelta(days=1)

    start_iso = _iso_utc(start_dt)
    end_iso = _iso_utc(end_dt)

    client = InfluxDBClient3(host=INFLUX_URL, database=INFLUX_DATABASE)
    where_clause = _build_where(site_id)

    # 1) 일자별 total_visitors (해당 일자에 page_view를 한 distinct user_hash 수)
    total_sql = f"""
        SELECT
            date_bin(INTERVAL '1 day', time, TIMESTAMP '1970-01-01 00:00:00Z') AS day,
            COUNT(DISTINCT user_hash) AS total_visitors
        FROM events
        WHERE {where_clause}
          AND time >= TIMESTAMP '{start_iso}'
          AND time < TIMESTAMP '{end_iso}'
        GROUP BY day
    """

    # 2) 일자별 new_visitors
    #    - 유저별로 '첫 방문 시각(MIN(time))'을 먼저 계산
    #    - 그 first_time 이 7일 구간 안에 있는 경우만 day-bin 으로 묶어서 카운트
    new_sql = f"""
        WITH first_visits AS (
            SELECT
                MIN(time) AS first_time
            FROM events
            WHERE {where_clause}
            GROUP BY user_hash
        )
        SELECT
            date_bin(INTERVAL '1 day', first_time, TIMESTAMP '1970-01-01 00:00:00Z') AS day,
            COUNT(*) AS new_visitors
        FROM first_visits
        WHERE first_time >= TIMESTAMP '{start_iso}'
          AND first_time < TIMESTAMP '{end_iso}'
        GROUP BY day
    """

    try:
        total_by_day = _run_range_query(client, total_sql, "total_visitors")
        new_by_day = _run_range_query(client, new_sql, "new_visitors")
    except Exception as exc:  # pragma: no cover - defensive logging path
        print(f"Error querying InfluxDB visitor stats (range): {exc}")
        total_by_day = {}
        new_by_day = {}
    finally:
        client.close()

    # 두 결과를 day 기준으로 merge
    all_days = set(total_by_day.keys()) | set(new_by_day.keys())
    result: Dict[str, Dict[str, Any]] = {}
    for day_iso in all_days:
        result[day_iso] = {
            "date": day_iso,
            "total_visitors": int(total_by_day.get(day_iso, 0)),
            "new_visitors": int(new_by_day.get(day_iso, 0)),
        }

    return result


def _iso_utc(dt: datetime) -> str:
    # Ensure UTC ISO string with trailing Z for SQL literal.
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _build_where(site_id: Optional[str]) -> str:
    conditions = ["user_hash <> ''", "event_name = 'page_view'"]
    if site_id:
        escaped = site_id.replace("'", "''")
        conditions.append(f"site_id = '{escaped}'")
    return " AND ".join(conditions)


def _normalize_day_value(value: Any) -> Optional[str]:
    """Influx date_bin 결과를 'YYYY-MM-DD' 문자열로 통일."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date().isoformat()

    text = str(value)
    if not text:
        return None
    if "T" in text:
        # 예: 2025-01-01T00:00:00Z or 2025-01-01T00:00:00.000Z
        return text.split("T", 1)[0]
    return text[:10]


def _run_range_query(client: InfluxDBClient3, sql: str, column: str) -> Dict[str, int]:
    """일자 컬럼(day/time/_time) + 값 컬럼 하나를 갖는 쿼리를 실행해서
    { 'YYYY-MM-DD': value } 형태로 변환."""
    table = client.query(query=sql, language="sql")
    if table is None:
        return {}

    data: Dict[str, Any] = getattr(table, "to_pydict", lambda: {})()
    if not data:
        return {}

    # 컬럼 이름은 day 또는 time 중 하나일 가능성이 큼
    days = data.get("day") or data.get("time") or data.get("_time")
    values = data.get(column)
    if not days or not values:
        return {}

    result: Dict[str, int] = {}
    for raw_day, raw_value in zip(days, values):
        day_iso = _normalize_day_value(raw_day)
        if not day_iso:
            continue

        try:
            v = int(raw_value)
        except Exception:
            try:
                v = int(float(raw_value))
            except Exception:
                continue

        result[day_iso] = v

    return result
