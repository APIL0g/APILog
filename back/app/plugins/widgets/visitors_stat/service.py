"""Service logic for visitor statistics.

Aggregates per-day visitor counts and new visitor counts based on ``user_hash``
values stored in InfluxDB. Previous-day results are cached in-memory for faster
subsequent lookups while the current day's statistics are always refreshed.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone, date
from threading import Lock
from typing import Any, Dict, List, Optional, Tuple

from influxdb_client_3 import InfluxDBClient3  # type: ignore

from config import INFLUX_URL, INFLUX_TOKEN, INFLUX_BUCKET

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
            "history": [...],
        }
    """

    target_date = _parse_date(date_str)
    primary = _get_day_stat(target_date, site_id)

    history_entries: List[Dict[str, Any]] = []
    for offset in range(6, -1, -1):
        day = target_date - timedelta(days=offset)
        if day == target_date:
            history_entries.append(dict(primary))
        else:
            history_entries.append(_get_day_stat(day, site_id))

    def _with_returning(payload: Dict[str, Any]) -> Dict[str, Any]:
        total = int(payload.get("total_visitors", 0) or 0)
        new = int(payload.get("new_visitors", 0) or 0)
        returning = max(0, total - new)
        enriched = dict(payload)
        enriched["returning_visitors"] = returning
        return enriched

    response = _with_returning(primary)
    response["history"] = [_with_returning(entry) for entry in history_entries]
    return response


def _get_day_stat(target_date: date, site_id: Optional[str]) -> Dict[str, Any]:
    today = datetime.now(timezone.utc).date()
    cache_key = (target_date.isoformat(), site_id or "")

    if target_date < today:
        cached = _get_cached(cache_key)
        if cached is not None:
            return cached

    stats = _query_influx(target_date, site_id)

    if target_date < today:
        _set_cached(cache_key, stats)

    return stats


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


def _query_influx(target_date: date, site_id: Optional[str]) -> Dict[str, Any]:
    start, end = _date_range(target_date)
    start_iso = _iso_utc(start)
    end_iso = _iso_utc(end)

    client = InfluxDBClient3(host=INFLUX_URL, token=INFLUX_TOKEN, database=INFLUX_BUCKET)

    where_clause = _build_where(site_id)

    total_sql = f"""
        SELECT COUNT(*) AS total_visitors
        FROM (
            SELECT DISTINCT user_hash
            FROM events
            WHERE {where_clause}
              AND time >= TIMESTAMP '{start_iso}'
              AND time < TIMESTAMP '{end_iso}'
        )
    """

    new_sql = f"""
        SELECT COUNT(*) AS new_visitors
        FROM (
            SELECT user_hash, MIN(time) AS first_time
            FROM events
            WHERE {where_clause}
            GROUP BY user_hash
        ) AS first_visits
        WHERE first_time >= TIMESTAMP '{start_iso}'
          AND first_time < TIMESTAMP '{end_iso}'
    """

    try:
        total = _run_scalar_query(client, total_sql, "total_visitors")
        new = _run_scalar_query(client, new_sql, "new_visitors")
    except Exception as exc:  # pragma: no cover - defensive logging path
        print(f"Error querying InfluxDB visitor stats: {exc}")
        total = 0
        new = 0
    finally:
        client.close()

    return {
        "date": target_date.isoformat(),
        "total_visitors": int(total),
        "new_visitors": int(new),
    }


def _date_range(target_date: date) -> Tuple[datetime, datetime]:
    start = datetime(target_date.year, target_date.month, target_date.day, tzinfo=timezone.utc)
    end = start + timedelta(days=1)
    return start, end


def _iso_utc(dt: datetime) -> str:
    # Ensure UTC ISO string with trailing Z for SQL literal.
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _build_where(site_id: Optional[str]) -> str:
    conditions = ["user_hash <> ''", "event_name = 'page_view'"]
    if site_id:
        escaped = site_id.replace("'", "''")
        conditions.append(f"site_id = '{escaped}'")
    return " AND ".join(conditions)


def _run_scalar_query(client: InfluxDBClient3, sql: str, column: str) -> int:
    table = client.query(query=sql, language="sql")

    if table is None:
        return 0

    data: Dict[str, Any] = getattr(table, "to_pydict", lambda: {})()
    if not data:
        return 0

    values = data.get(column)
    if not values:
        return 0

    try:
        raw = values[0]
    except (IndexError, TypeError):
        return 0

    try:
        return int(raw)
    except Exception:
        try:
            return int(float(raw))
        except Exception:
            return 0