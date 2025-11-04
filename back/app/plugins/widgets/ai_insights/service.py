from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import os
import math
import logging
import time
from concurrent.futures import ThreadPoolExecutor

# ──────────────────────────────────────────────────────────────────────────────
# 환경설정
# ──────────────────────────────────────────────────────────────────────────────
try:
    from back.app.config import (
        INFLUX_URL,
        INFLUX_ADMIN_TOKEN,
        INFLUX_ORG,
        INFLUX_DATABASE,
    )
except Exception:
    INFLUX_URL = os.getenv("INFLUX_URL", "http://localhost:8181")
    INFLUX_ADMIN_TOKEN = os.getenv("INFLUX_ADMIN_TOKEN") or os.getenv("INFLUX_TOKEN", "")
    INFLUX_ORG = os.getenv("INFLUX_ORG", "apilog")
    INFLUX_DATABASE = os.getenv("INFLUX_DATABASE", "apilog_db")

log = logging.getLogger("ai_insights")

# ──────────────────────────────────────────────────────────────────────────────
# 간단 캐시 (in-proc)
# ──────────────────────────────────────────────────────────────────────────────
_cache: Dict[str, tuple[float, Dict[str, Any]]] = {}
_TTL = float(os.getenv("AI_INSIGHTS_CACHE_TTL", "60"))

def _cache_get(key: str):
    v = _cache.get(key)
    if not v:
        return None
    ts, data = v
    if time.time() - ts > _TTL:
        _cache.pop(key, None)
        return None
    return data

def _cache_set(key: str, data: Dict[str, Any]):
    _cache[key] = (time.time(), data)

# ──────────────────────────────────────────────────────────────────────────────
# InfluxDB 3 (SQL/Flight)
# ──────────────────────────────────────────────────────────────────────────────
_sql_client = None

def _get_sql_client():
    global _sql_client
    if _sql_client is not None:
        return _sql_client
    from influxdb_client_3 import InfluxDBClient3
    _sql_client = InfluxDBClient3(
        host=INFLUX_URL,
        token=INFLUX_ADMIN_TOKEN,
        org=INFLUX_ORG,
        database=INFLUX_DATABASE,
    )
    return _sql_client

def _to_records(df_obj) -> List[Dict[str, Any]]:
    if hasattr(df_obj, "to_dict"):
        return df_obj.to_dict(orient="records")
    try:
        import pyarrow as pa  # type: ignore
        if isinstance(df_obj, pa.Table):
            cols = df_obj.column_names
            arrays = [c.to_pylist() for c in df_obj.columns]
            return [{cols[i]: row[i] for i in range(len(cols))} for row in zip(*arrays)]
    except Exception:
        pass
    return []

def _sql_query(query: str) -> List[Dict[str, Any]]:
    cli = _get_sql_client()
    df = cli.query(query)
    return _to_records(df)

# ──────────────────────────────────────────────────────────────────────────────
# 유틸
# ──────────────────────────────────────────────────────────────────────────────
def _normalize_bucket(s: str) -> str:
    s = (s or "1h").lower()
    allow = {"1h": "1 hour", "3h": "3 hour", "6h": "6 hour", "1d": "1 day"}
    return allow.get(s, "1 hour")

def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).replace(microsecond=0).isoformat()

def _z_scores(points: List[Dict[str, Any]], key: str = "v", z: float = 3.0) -> List[Dict[str, Any]]:
    vals = [p[key] for p in points if isinstance(p.get(key), (int, float))]
    if len(vals) < 5:
        return []
    mean = sum(vals) / len(vals)
    var = sum((x - mean) ** 2 for x in vals) / len(vals)
    std = math.sqrt(var)
    if std == 0:
        return []
    out = []
    for p in points:
        v = p.get(key)
        if not isinstance(v, (int, float)):
            continue
        zval = (v - mean) / std
        if abs(zval) >= z:
            out.append({"metric": "pageviews", "at": p["t"], "z": round(zval, 2)})
    return out

def _timed(name: str, fn):
    t0 = time.perf_counter()
    try:
        return fn()
    finally:
        log.info("[ai] %s took %.3fs", name, time.perf_counter() - t0)

# ──────────────────────────────────────────────────────────────────────────────
# 집계 쿼리 (SQL)
# ──────────────────────────────────────────────────────────────────────────────
def q_pv_series(from_iso: str, to_iso: str, bucket_str: str, site_id: Optional[str]=None) -> List[Dict[str, Any]]:
    bucket_sql = _normalize_bucket(bucket_str)
    where_site = f"AND site_id = '{site_id}'" if site_id else ""
    sql = f"""
SELECT DATE_BIN(INTERVAL '{bucket_sql}', time) AS bucket,
       SUM("count")::BIGINT AS pv
FROM "events"
WHERE time BETWEEN TIMESTAMP '{from_iso}' AND TIMESTAMP '{to_iso}'
  AND event_name = 'page_view'
  {where_site}
GROUP BY bucket
ORDER BY bucket;
"""
    rows = _sql_query(sql)
    out = []
    for r in rows:
        b = r["bucket"]
        t = b.isoformat() if hasattr(b, "isoformat") else str(b)
        out.append({"t": t, "v": int(r.get("pv", 0) or 0)})
    return out

def q_top_paths(from_iso: str, to_iso: str, site_id: Optional[str]=None, limit:int=10) -> List[Dict[str, Any]]:
    where_site = f"AND site_id = '{site_id}'" if site_id else ""
    sql = f"""
SELECT path, SUM("count")::BIGINT AS pv
FROM "events"
WHERE time BETWEEN TIMESTAMP '{from_iso}' AND TIMESTAMP '{to_iso}'
  AND event_name = 'page_view'
  {where_site}
GROUP BY path
ORDER BY pv DESC
LIMIT {int(limit)};
"""
    rows = _sql_query(sql)
    return [{"path": str(r.get("path", "")), "pv": int(r.get("pv", 0) or 0)} for r in rows]

def q_error_series(from_iso: str, to_iso: str, bucket_str: str, site_id: Optional[str]=None) -> List[Dict[str, Any]]:
    bucket_sql = _normalize_bucket(bucket_str)
    where_site = f"AND site_id = '{site_id}'" if site_id else ""
    sql = f"""
SELECT DATE_BIN(INTERVAL '{bucket_sql}', time) AS bucket,
       SUM(CASE WHEN COALESCE(TRY_CAST(error_flag AS BOOLEAN), false) THEN 1 ELSE 0 END)::BIGINT AS errors,
       COUNT(*)::BIGINT AS total
FROM "events"
WHERE time BETWEEN TIMESTAMP '{from_iso}' AND TIMESTAMP '{to_iso}'
  {where_site}
GROUP BY bucket
ORDER BY bucket;
"""
    rows = _sql_query(sql)
    out = []
    for r in rows:
        total = int(r.get("total", 0) or 0)
        errors = int(r.get("errors", 0) or 0)
        rate = (errors / total) if total else 0.0
        b = r["bucket"]
        t = b.isoformat() if hasattr(b, "isoformat") else str(b)
        out.append({"t": t, "v": rate})
    return out

def q_sessions(from_iso: str, to_iso: str, site_id: Optional[str]=None) -> int:
    where_site = f"AND site_id = '{site_id}'" if site_id else ""
    sql = f"""
SELECT COUNT(DISTINCT session_id)::BIGINT AS sessions
FROM "events"
WHERE time BETWEEN TIMESTAMP '{from_iso}' AND TIMESTAMP '{to_iso}'
  {where_site};
"""
    rows = _sql_query(sql)
    return int(rows[0].get("sessions", 0) or 0) if rows else 0

def q_funnel(from_iso: str, to_iso: str, site_id: Optional[str]=None) -> Dict[str, int]:
    where_site = f"AND site_id = '{site_id}'" if site_id else ""
    sql = f"""
WITH s AS (
  SELECT
    session_id,
    BOOL_OR(path='/' OR path LIKE '/landing%') AS has_landing,
    BOOL_OR(path LIKE '/products%') AS has_product,
    BOOL_OR(path LIKE '/checkout%' OR path LIKE '/cart%') AS has_checkout
  FROM "events"
  WHERE time BETWEEN TIMESTAMP '{from_iso}' AND TIMESTAMP '{to_iso}'
    AND event_name IN ('page_view','click')
    {where_site}
  GROUP BY session_id
)
SELECT
  SUM(CASE WHEN has_landing THEN 1 ELSE 0 END)::BIGINT AS landing_sessions,
  SUM(CASE WHEN has_product THEN 1 ELSE 0 END)::BIGINT AS product_sessions,
  SUM(CASE WHEN has_checkout THEN 1 ELSE 0 END)::BIGINT AS checkout_sessions
FROM s;
"""
    rows = _sql_query(sql)
    if not rows:
        return {"landing": 0, "product": 0, "checkout": 0}
    r = rows[0]
    return {
        "landing": int(r.get("landing_sessions", 0) or 0),
        "product": int(r.get("product_sessions", 0) or 0),
        "checkout": int(r.get("checkout_sessions", 0) or 0),
    }

# ──────────────────────────────────────────────────────────────────────────────
# Digest 조립
# ──────────────────────────────────────────────────────────────────────────────
def build_digest(from_iso: Optional[str], to_iso: Optional[str], bucket: str, site_id: Optional[str]) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    if not to_iso:
        to_iso = _iso(now)
    if not from_iso:
        from_iso = _iso(now - timedelta(hours=24))
    bucket = (bucket or "1h").lower()

    cache_key = f"{from_iso}|{to_iso}|{bucket}|{site_id or ''}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    with ThreadPoolExecutor(max_workers=5) as ex:
        f_pv  = ex.submit(lambda: _timed("q_pv_series",  lambda: q_pv_series(from_iso, to_iso, bucket, site_id)))
        f_err = ex.submit(lambda: _timed("q_error_series",lambda: q_error_series(from_iso, to_iso, bucket, site_id)))
        f_top = ex.submit(lambda: _timed("q_top_paths",  lambda: q_top_paths(from_iso, to_iso, site_id)))
        f_ses = ex.submit(lambda: _timed("q_sessions",   lambda: q_sessions(from_iso, to_iso, site_id)))
        f_fun = ex.submit(lambda: _timed("q_funnel",     lambda: q_funnel(from_iso, to_iso, site_id)))

        pv_series  = f_pv.result()
        err_series = f_err.result()
        top_paths  = f_top.result()
        sessions   = f_ses.result()
        funnel_raw = f_fun.result()

    totals_pageviews = int(sum(p.get("v", 0) for p in pv_series)) if pv_series else 0
    users = sessions
    anomalies = _z_scores(pv_series, key="v", z=3.0)
    product = funnel_raw.get("product", 0)
    checkout = funnel_raw.get("checkout", 0)
    conv = (checkout / product) if product else 0.0

    digest = {
        "version": "1",
        "time_window": {"from": from_iso, "to": to_iso, "bucket": bucket},
        "context": {"site_id": site_id or "default", "filters": {}},
        "totals": {"pageviews": totals_pageviews, "sessions": sessions, "users": users},
        "series": {"pageviews": pv_series, "error_rate": err_series},
        "top_paths": top_paths,
        "errors": {"by_code": [], "top_endpoints": []},
        "funnels": [{"name": "landing→product→checkout", "conv": conv}],
        "anomalies": anomalies,
    }

    _cache_set(cache_key, digest)
    return digest
