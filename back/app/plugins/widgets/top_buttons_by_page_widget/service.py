"""Service logic for the By-Page Top Buttons widget.
InfluxDB 3(SQL) 기반으로 특정 페이지 경로의 버튼 클릭 상위를 집계합니다.
"""

from __future__ import annotations

from typing import Any, Dict, List

from influxdb_client_3 import InfluxDBClient3

from config import INFLUX_DATABASE, INFLUX_TOKEN, INFLUX_URL


def _sanitize_range(range_str: str) -> str:
    s = (range_str or "7d").strip().lower()
    if not s or any(ch for ch in s if ch not in "0123456789hd"):
        return "7d"
    return s


def _sanitize_path(path: str) -> str:
    s = (path or "/").strip()
    safe = "".join(ch for ch in s if ch.isalnum() or ch in {"_", "-", "/"})
    if not safe.startswith("/"):
        safe = "/" + safe
    return safe or "/"


def _result_rows(result: Any) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    if hasattr(result, "iterrows"):
        for _, series in result.iterrows():  # type: ignore[attr-defined]
            rows.append(dict(series))
        return rows

    data: List[Dict[str, Any]] = []
    if hasattr(result, "to_pylist"):
        data = result.to_pylist()  # type: ignore[attr-defined]
    elif hasattr(result, "read_all"):
        try:
            table = result.read_all()  # type: ignore[attr-defined]
            if hasattr(table, "to_pylist"):
                data = table.to_pylist()  # type: ignore[attr-defined]
        except Exception:
            data = []
    elif isinstance(result, list):
        data = result

    for entry in data:
        if isinstance(entry, dict):
            rows.append(entry)
    return rows


def query_top_buttons_by_path(path: str, range_str: str = "7d", limit: int = 10) -> List[Dict[str, Any]]:
    rng = _sanitize_range(range_str)
    pth = _sanitize_path(path)
    sql = f"""
SELECT element_hash,
       SUM("count")::BIGINT AS cnt
FROM "events"
WHERE time >= now() - INTERVAL '{rng}'
  AND event_name = 'click'
  AND path = '{pth}'
GROUP BY element_hash
ORDER BY cnt DESC
LIMIT {int(limit)}
"""
    try:
        with InfluxDBClient3(
            host=INFLUX_URL,
            token=INFLUX_TOKEN,
            database=INFLUX_DATABASE,
        ) as client:
            res = client.query(sql)
        rows = []
        for entry in _result_rows(res):
            rows.append({
                "path": pth,
                "element_text": entry.get("element_hash") or "unknown",
                "count": int(entry.get("cnt") or 0),
            })
        return rows
    except Exception:
        return []


def list_page_paths(range_str: str = "7d", limit: int = 50) -> List[Dict[str, Any]]:
    """Return popular page paths within the time range (based on page_view/click counts)."""
    rng = _sanitize_range(range_str)
    sql = f"""
SELECT path,
       SUM("count")::BIGINT AS cnt
FROM "events"
WHERE time >= now() - INTERVAL '{rng}'
  AND event_name IN ('page_view','click')
GROUP BY path
ORDER BY cnt DESC
LIMIT {int(limit)}
"""
    try:
        with InfluxDBClient3(
            host=INFLUX_URL,
            token=INFLUX_TOKEN,
            database=INFLUX_DATABASE,
        ) as client:
            res = client.query(sql)

        items: List[Dict[str, Any]] = []
        for entry in _result_rows(res):
            path_value = entry.get("path") or "/"
            items.append({"path": str(path_value), "count": int(entry.get("cnt") or 0)})
        return items
    except Exception:
        return []
