"""Service logic for the Global Top Buttons widget.
Aggregates click counts across all pages for the given time range.
"""

from __future__ import annotations

from typing import Any, Dict, List

# Prefer InfluxDB 3 (FlightSQL) when available
try:
    from influxdb_client_3 import InfluxDBClient3  # type: ignore
except Exception:  # pragma: no cover
    InfluxDBClient3 = None  # type: ignore

from influxdb_client import InfluxDBClient

from config import INFLUX_URL, INFLUX_TOKEN, INFLUX_ORG, INFLUX_BUCKET


def _sanitize_range(range_str: str) -> str:
    """Allow only simple duration like 1h, 6h, 24h, 7d, 30d."""
    s = (range_str or "7d").strip().lower()
    # fallback if malformed
    if not s or any(ch for ch in s if ch not in "0123456789hd"):
        return "7d"
    return s


def query_top_buttons_global(range_str: str = "7d", limit: int = 10) -> List[Dict[str, Any]]:
    rng = _sanitize_range(range_str)

    # 1) InfluxDB 3 SQL path
    if InfluxDBClient3 is not None:
        try:
            with InfluxDBClient3(host=INFLUX_URL, token=INFLUX_TOKEN, database=INFLUX_BUCKET) as c3:  # type: ignore
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
            # Fallback to Flux
            pass

    # 2) Flux fallback for InfluxDB 2.x compatibility
    flux = f"""
from(bucket: "{INFLUX_BUCKET}")
  |> range(start: -{rng})
  |> filter(fn: (r) => r._measurement == "events")
  |> filter(fn: (r) => r.event_name == "click")
  |> filter(fn: (r) => r._field == "count")
  |> filter(fn: (r) => not exists r.path or r.path !~ /\.(js|css|png|jpg|jpeg|gif|svg|ico|map|json|txt)$/)
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
                "element_text": rec.get("element_hash") or "unknown",
                "count": int(rec.get("_value", 0) or 0),
            })
    return rows2
