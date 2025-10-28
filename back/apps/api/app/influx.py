"""InfluxDB helpers that power the analytics ingestion pipeline.
분석 수집 파이프라인을 구동하는 InfluxDB 헬퍼 모듈입니다.
"""

from typing import Any, Dict, List, Optional
import os

from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS

INFLUX_URL = os.getenv("INFLUX_URL", "http://localhost:8086")
INFLUX_TOKEN = os.getenv("INFLUX_TOKEN", "dev-token")
INFLUX_ORG = os.getenv("INFLUX_ORG", "apilog")
INFLUX_BUCKET = os.getenv("INFLUX_BUCKET", "apilog_raw")

_client = InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG)
_write = _client.write_api(write_options=SYNCHRONOUS)
_query = _client.query_api()


def _safe_str(value: Any, default: str = "") -> str:
    """Convert a value to string while honouring a default fallback.
    기본값을 유지하면서 입력 값을 문자열로 변환합니다.
    """
    if value is None:
        return default
    return str(value)


def _safe_int(value: Any, default: Optional[int] = None) -> Optional[int]:
    """Convert a value to integer if possible, otherwise use the default.
    값을 정수로 변환할 수 없을 때는 기본값을 반환합니다.
    """
    if value is None:
        return default
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def _safe_float(value: Any, default: Optional[float] = None) -> Optional[float]:
    """Convert a value to float if possible, otherwise use the default.
    값을 부동소수점으로 변환할 수 없을 때는 기본값을 반환합니다.
    """
    if value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _safe_bool(value: Any, default: Optional[bool] = None) -> Optional[bool]:
    """Convert a value to boolean with a sensible default for unknown inputs.
    불리언으로 변환할 수 없을 때는 합리적인 기본값을 사용합니다.
    """
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        lower = value.lower()
        if lower in {"true", "1", "yes", "y"}:
            return True
        if lower in {"false", "0", "no", "n"}:
            return False
    return default


def write_events(events: List[Dict[str, Any]]) -> None:
    """Persist collected events in the `events` measurement.
    수집된 이벤트를 `events` 측정값에 저장합니다.

    Tags:
        site_id, path, page_variant, event_name, element_hash,
        device_type, browser_family, country_code, utm_source, utm_campaign
        사이트, 경로, 페이지 변형, 이벤트 이름, 요소 해시,
        디바이스 유형, 브라우저 패밀리, 국가 코드, UTM 소스, UTM 캠페인

    Fields:
        count, session_id, user_hash, dwell_ms, scroll_pct,
        click_x, click_y, viewport_w, viewport_h,
        funnel_step, error_flag, bot_score, extra_json
        수량, 세션 ID, 사용자 해시, 체류 시간, 스크롤 비율,
        클릭 좌표, 뷰포트 크기, 유입 단계, 오류 플래그, 봇 점수, 추가 정보
    """
    points: List[Point] = []

    for event in events:
        # Convert the provided timestamp into milliseconds if present.
        # 전달된 타임스탬프가 있으면 밀리초 단위로 변환합니다.
        timestamp_ms = _safe_int(event.get("ts"))

        point = (
            Point("events")
            # Tags describe low-cardinality dimensions for fast grouping.
            # 태그는 빠른 그룹화를 위한 저카디널리티 차원을 설명합니다.
            .tag("site_id", _safe_str(event.get("site_id")))
            .tag("path", _safe_str(event.get("path")))
            .tag("page_variant", _safe_str(event.get("page_variant")))
            .tag("event_name", _safe_str(event.get("event_name")))
            .tag("element_hash", _safe_str(event.get("element_hash")))
            .tag("device_type", _safe_str(event.get("device_type")))
            .tag("browser_family", _safe_str(event.get("browser_family")))
            .tag("country_code", _safe_str(event.get("country_code")))
            .tag("utm_source", _safe_str(event.get("utm_source")))
            .tag("utm_campaign", _safe_str(event.get("utm_campaign")))
            # Fields hold the high-cardinality metrics we query over time.
            # 필드는 시간에 따라 조회할 고카디널리티 지표를 저장합니다.
            .field("count", _safe_int(event.get("count"), 1) or 1)
            .field("session_id", _safe_str(event.get("session_id")))
            .field("user_hash", _safe_str(event.get("user_hash")))
            .field("dwell_ms", _safe_int(event.get("dwell_ms"), 0) or 0)
            .field("scroll_pct", _safe_float(event.get("scroll_pct"), 0.0) or 0.0)
            .field("click_x", _safe_int(event.get("click_x"), 0) or 0)
            .field("click_y", _safe_int(event.get("click_y"), 0) or 0)
            .field("viewport_w", _safe_int(event.get("viewport_w"), 0) or 0)
            .field("viewport_h", _safe_int(event.get("viewport_h"), 0) or 0)
            .field("funnel_step", _safe_str(event.get("funnel_step")))
            .field("error_flag", _safe_bool(event.get("error_flag"), False) or False)
            .field("bot_score", _safe_float(event.get("bot_score"), 0.0) or 0.0)
            .field("extra_json", _safe_str(event.get("extra_json")))
        )

        if timestamp_ms is not None:
            # Attach the explicit timestamp to preserve user ordering.
            # 사용자 순서를 보존하기 위해 명시적인 타임스탬프를 설정합니다.
            point = point.time(timestamp_ms, write_precision="ms")

        points.append(point)

    if points:
        # Batch write all prepared points to reduce network overhead.
        # 네트워크 오버헤드를 줄이기 위해 준비된 포인트를 배치로 기록합니다.
        _write.write(
            bucket=INFLUX_BUCKET,
            org=INFLUX_ORG,
            record=points,
            write_precision="ms",
        )


def query_top_pages() -> List[Dict[str, Any]]:
    """Query for the ten most-viewed paths in the past hour.
    지난 한 시간 동안 조회 수가 가장 많은 경로 열 개를 조회합니다.
    """
    flux = f"""
from(bucket: "{INFLUX_BUCKET}")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "events")
  |> filter(fn: (r) => r.event_name == "page_view")
  |> filter(fn: (r) => r._field == "count")
  |> group(columns: ["path"])
  |> sum()
  |> sort(columns: ["_value"], desc: true)
  |> limit(n: 10)
"""

    tables = _query.query(flux)
    rows: List[Dict[str, Any]] = []

    for table in tables:
        for record in table.records:
            rows.append(
                {
                    "path": record["path"],
                    "cnt": record["_value"],
                }
            )

    return rows
