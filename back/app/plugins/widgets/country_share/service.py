"""Service logic for the Country Share widget.
Aggregates session counts per country within a lookback range.

Country Share 위젯 서비스 로직.
지정된 조회 기간 동안 국가별 세션 수를 집계합니다.
"""

from __future__ import annotations

from typing import Any, Dict, List, Tuple

from influxdb_client_3 import InfluxDBClient3  # InfluxDB 3 코어 SQL 클라이언트

from config import (
    INFLUX_TOKEN,
    INFLUX_URL,
    INFLUX_DATABASE,
)

def _safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except Exception:
        return default


def _parse_range(range_str: str) -> Tuple[int, str]:
    """Return (value, unit) where unit is 'd' or 'h'."""
    s = (range_str or "7d").strip().lower()
    digits = "".join(ch for ch in s if ch.isdigit())
    unit = "d"
    if "h" in s:
        unit = "h"
    elif "d" in s:
        unit = "d"
    if not digits:
        digits = "7"
    try:
        value = max(1, int(digits))
    except ValueError:
        value = 7
    return value, unit


def _interval_for_sql(value: int, unit: str) -> str:
    # '7 day' or '24 hour' 형태로 반환
    return f"{value} {'day' if unit == 'd' else 'hour'}"


def _normalise_code(raw: Any) -> Tuple[str, str]:
    code = str(raw or "").strip().upper()
    if not code or code in {"NONE", "NULL", "UNKNOWN"}:
        return "UNKNOWN", "Unknown"
    return code[:16], code[:16]


def query_country_share(range_str: str = "7d", top: int = 5) -> Dict[str, Any]:
    """Return top-N countries by distinct session count in the given range."""
    top = max(1, int(top))
    value, unit = _parse_range(range_str)
    sql_interval = _interval_for_sql(value, unit)
    # 상위 N개 외에 tail 을 OTHERS로 묶기 위해 여유 있게 가져오기
    limit_fetch = max(top + 10, top * 3)

    sql = f"""
    SELECT
      CASE
        WHEN country_code IS NULL OR CAST(country_code AS STRING) = '' THEN 'UNKNOWN'
        ELSE CAST(country_code AS STRING)
      END AS country,
      COUNT(DISTINCT session_id) AS sessions
    FROM events
    WHERE
      time >= NOW() - INTERVAL '{sql_interval}'
      AND session_id IS NOT NULL
      AND session_id <> ''
    GROUP BY
      CASE
        WHEN country_code IS NULL OR CAST(country_code AS STRING) = '' THEN 'UNKNOWN'
        ELSE CAST(country_code AS STRING)
      END
    ORDER BY sessions DESC
    LIMIT {limit_fetch}
    """

    client = InfluxDBClient3(
        host=INFLUX_URL,            # 예: "http://influxdb3-core:8181"
        token=INFLUX_TOKEN or "",   # without-auth면 그냥 dummy 값
        database=INFLUX_DATABASE,
    )

    try:
        # pandas DataFrame 으로 받기
        table = client.query(query=sql, language="sql", mode="pandas")
    finally:
        client.close()

    rows: List[Dict[str, Any]] = []
    for _, r in table.iterrows():
        rows.append(
            {
                "country": r.get("country"),
                "sessions": _safe_int(r.get("sessions"), 0),
            }
        )

    return _shape_results(rows, top)


def _shape_results(raw_rows: List[Dict[str, Any]], top: int) -> Dict[str, Any]:
    normalised: List[Dict[str, Any]] = []

    for row in raw_rows:
        sessions = _safe_int(row.get("sessions"), 0)
        if sessions <= 0:
            continue
        code, label = _normalise_code(row.get("country"))
        normalised.append({"code": code, "label": label, "sessions": sessions})

    normalised.sort(key=lambda r: r["sessions"], reverse=True)

    total = sum(r["sessions"] for r in normalised)
    if not normalised:
        return {"rows": [], "total": 0}

    top_rows = normalised[:top]
    others_value = sum(r["sessions"] for r in normalised[top:])

    if others_value > 0:
        top_rows.append({"code": "OTHERS", "label": "Others", "sessions": others_value})

    return {
        "rows": top_rows,
        "total": total,
    }
