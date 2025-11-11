"""Service logic for the Global Top Buttons widget.
Aggregates click counts across all pages for the given time range.
"""

from __future__ import annotations

from typing import Any, Dict, List

from influxdb_client_3 import InfluxDBClient3

from config import INFLUX_DATABASE, INFLUX_URL, INFLUX_TOKEN


def _sanitize_range(range_str: str) -> str:
    """Allow only simple duration like 1h, 6h, 24h, 7d, 30d."""
    s = (range_str or "7d").strip().lower()
    # fallback if malformed
    if not s or any(ch for ch in s if ch not in "0123456789hd"):
        return "7d"
    return s


def query_top_buttons_global(range_str: str = "7d", limit: int = 10) -> List[Dict[str, Any]]:
    rng = _sanitize_range(range_str)

    try:
        with InfluxDBClient3(host=INFLUX_URL, token=INFLUX_TOKEN, database=INFLUX_DATABASE) as c3:
            sql = f"""
SELECT element_hash,
       SUM("count")::BIGINT AS cnt
FROM "events"
WHERE time >= now() - INTERVAL '{rng}'
  AND event_name = 'click'
  AND (path IS NULL
       OR (path NOT LIKE '%.js' AND path NOT LIKE '%.css' AND path NOT LIKE '%.png'
           AND path NOT LIKE '%.jpg' AND path NOT LIKE '%.jpeg' AND path NOT LIKE '%.gif'
           AND path NOT LIKE '%.svg' AND path NOT LIKE '%.ico' AND path NOT LIKE '%.map'
           AND path NOT LIKE '%.json' AND path NOT LIKE '%.txt'))
GROUP BY element_hash
ORDER BY cnt DESC
LIMIT {int(limit)}
"""
            res = c3.query(sql)

        rows: List[Dict[str, Any]] = []
        if hasattr(res, "iterrows"):
            for _, r in res.iterrows():  # type: ignore[attr-defined]
                rows.append({
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
                    "element_text": (r.get("element_hash") if isinstance(r, dict) else None) or "unknown",  # type: ignore
                    "count": int((r.get("cnt") if isinstance(r, dict) else 0) or 0),  # type: ignore
                })
        return rows
    except Exception:
        return []
