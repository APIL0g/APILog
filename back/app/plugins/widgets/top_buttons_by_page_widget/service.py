"""Service logic for the By-Page Top Buttons widget.
Aggregates click counts for a specific page path and time range,
and provides a helper to list popular page paths for the filter.
"""

from __future__ import annotations

from typing import Any, Dict, List

try:
    from influxdb_client_3 import InfluxDBClient3  # type: ignore
except Exception:  # pragma: no cover
    InfluxDBClient3 = None  # type: ignore

from influxdb_client import InfluxDBClient

from config import INFLUX_URL, INFLUX_TOKEN, INFLUX_ORG, INFLUX_BUCKET


def _sanitize_range(range_str: str) -> str:
    s = (range_str or "7d").strip().lower()
    if not s or any(ch for ch in s if ch not in "0123456789hd"):
        return "7d"
    return s

def _sanitize_path(path: str) -> str:
    s = (path or "/").strip()
    # allow slash, underscore, hyphen, alnum; drop others
    safe = "".join(ch for ch in s if ch.isalnum() or ch in {"_", "-", "/"})
    if not safe.startswith("/"):
        safe = "/" + safe
    return safe or "/"

def _is_asset_path(path: str) -> bool:
    lower = (path or "").lower()
    # Heuristic: ignore obvious static assets
    for ext in (".js", ".css", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".map", ".json", ".txt"):
        if lower.endswith(ext):
            return True
    return False


def query_top_buttons_by_path(path: str, range_str: str = "7d", limit: int = 10) -> List[Dict[str, Any]]:
    rng = _sanitize_range(range_str)
    pth = _sanitize_path(path)

    if InfluxDBClient3 is not None:
        try:
            with InfluxDBClient3(host=INFLUX_URL, token=INFLUX_TOKEN, database=INFLUX_BUCKET) as c3:  # type: ignore
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
                res = c3.query(sql)

            rows: List[Dict[str, Any]] = []
            if hasattr(res, "iterrows"):
                for _, r in res.iterrows():  # type: ignore[attr-defined]
                    rows.append({
                        "path": pth,
                        "element_text": r.get("element_hash") or "unknown",
                        "count": int(r.get("cnt") or 0),
                    })
            else:
                data: List[Dict[str, Any]] = []
                if hasattr(res, "to_pylist"):
                    data = res.to_pylist()  # type: ignore[attr-defined]
                elif hasattr(res, "read_all"):
                    try:
                        table = res.read_all()  # type: ignore[attr-defined]
                        if hasattr(table, "to_pylist"):
                            data = table.to_pylist()  # type: ignore[attr-defined]
                    except Exception:
                        data = []
                elif isinstance(res, list):
                    data = res

                for r in data:
                    rows.append({
                        "path": pth,
                        "element_text": (r.get("element_hash") if isinstance(r, dict) else None) or "unknown",  # type: ignore
                        "count": int((r.get("cnt") if isinstance(r, dict) else 0) or 0),  # type: ignore
                    })
            return rows
        except Exception:
            pass

    # Flux fallback
    flux = f"""
from(bucket: "{INFLUX_BUCKET}")
  |> range(start: -{rng})
  |> filter(fn: (r) => r._measurement == "events")
  |> filter(fn: (r) => r.event_name == "click")
  |> filter(fn: (r) => r.path == "{pth}")
  |> filter(fn: (r) => r._field == "count")
  |> group(columns: ["element_hash"])
  |> sum()
  |> sort(columns: ["_value"], desc: true)
  |> limit(n: {int(limit)})
"""
    with InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG) as c2:
        tables = c2.query_api().query(flux)

    rows2: List[Dict[str, Any]] = []
    for table in tables:
        for rec in table.records:
            rows2.append({
                "path": pth,
                "element_text": rec.get("element_hash") or "unknown",
                "count": int(rec.get("_value", 0) or 0),
            })
    return rows2


def list_page_paths(range_str: str = "7d", limit: int = 50) -> List[Dict[str, Any]]:
    """Return popular page paths within the time range (based on page_view counts).
    Filters out obvious asset-like paths.
    """
    rng = _sanitize_range(range_str)

    # 1) SQL path (consider both page_view and click so pages with clicks only still appear)
    if InfluxDBClient3 is not None:
        try:
            with InfluxDBClient3(host=INFLUX_URL, token=INFLUX_TOKEN, database=INFLUX_BUCKET) as c3:  # type: ignore
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
                res = c3.query(sql)

            items: List[Dict[str, Any]] = []
            if hasattr(res, "iterrows"):
                for _, r in res.iterrows():  # type: ignore[attr-defined]
                    p = r.get("path") or "/"
                    if not _is_asset_path(str(p)):
                        items.append({"path": str(p), "count": int(r.get("cnt") or 0)})
            else:
                data: List[Dict[str, Any]] = []
                if hasattr(res, "to_pylist"):
                    data = res.to_pylist()  # type: ignore[attr-defined]
                elif hasattr(res, "read_all"):
                    try:
                        table = res.read_all()  # type: ignore[attr-defined]
                        if hasattr(table, "to_pylist"):
                            data = table.to_pylist()  # type: ignore[attr-defined]
                    except Exception:
                        data = []
                elif isinstance(res, list):
                    data = res

                for r in data:
                    p = (r.get("path") if isinstance(r, dict) else "/") or "/"  # type: ignore
                    if not _is_asset_path(str(p)):
                        items.append({"path": str(p), "count": int((r.get("cnt") if isinstance(r, dict) else 0) or 0)})  # type: ignore
            return items
        except Exception:
            pass

    # 2) Flux fallback (page_view or click)
    flux = f"""
from(bucket: "{INFLUX_BUCKET}")
  |> range(start: -{rng})
  |> filter(fn: (r) => r._measurement == "events")
  |> filter(fn: (r) => r.event_name == "page_view" or r.event_name == "click")
  |> filter(fn: (r) => r._field == "count")
  |> group(columns: ["path"]) 
  |> sum()
  |> sort(columns: ["_value"], desc: true)
  |> limit(n: {int(limit)})
"""
    with InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG) as c2:
        tables = c2.query_api().query(flux)

    items2: List[Dict[str, Any]] = []
    for table in tables:
        for rec in table.records:
            p = rec.get("path") or "/"
            if not _is_asset_path(str(p)):
                items2.append({"path": str(p), "count": int(rec.get("_value", 0) or 0)})
    return items2
