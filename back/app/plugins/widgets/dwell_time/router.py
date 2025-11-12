"""API router for the dwell time widget.
페이지별 평균 체류 시간을 반환하는 API 라우터입니다.
"""

import re
from typing import Any, Dict, Tuple

from fastapi import APIRouter, HTTPException, Query

from .service import LOOKBACK_RANGE_TOKEN, LOOKBACK_SECONDS, query_dwell_time


router = APIRouter()

_RANGE_PATTERN = re.compile(r"^\s*(\d+)\s*([dhms]?)\s*$")
_UNIT_SECONDS = {"d": 24 * 60 * 60, "h": 60 * 60, "m": 60, "s": 1}


def _parse_range_seconds(range_token: str) -> Tuple[int, str]:
    """Parse range token such as `7d`, `12h`, `30m`, defaulting to days."""
    token = (range_token or LOOKBACK_RANGE_TOKEN).strip().lower()
    match = _RANGE_PATTERN.match(token)
    if not match:
        raise HTTPException(
            status_code=400,
            detail="range must be a positive integer with optional d/h/m/s suffix (e.g., 7d, 12h, 30m)",
        )

    value = max(1, int(match.group(1)))
    unit = match.group(2) or "d"
    seconds = value * _UNIT_SECONDS.get(unit, _UNIT_SECONDS["d"])
    normalized = f"{value}{unit}"
    return seconds, normalized


@router.get("/dwell-time")
def dwell_time_endpoint(
    range_token: str = Query(LOOKBACK_RANGE_TOKEN, alias="range", description="조회 기간, 예: 7d, 12h, 30m"),
    top: int = Query(10, alias="top", ge=1, le=50, description="상위 경로 개수 (1~50)"),
) -> Dict[str, Any]:
    """Return the top pages by average dwell time for the requested window."""
    range_seconds, normalized = _parse_range_seconds(range_token)
    rows, meta = query_dwell_time(limit=top, range_seconds=range_seconds, range_label=normalized)
    return {"rows": rows, "meta": meta}
