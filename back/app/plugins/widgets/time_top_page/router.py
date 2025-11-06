"""API router for the Time Top Page widget.
버튼(6h/12h)로 시간대별 Top 페이지를 조회합니다.
"""

from typing import Any, Dict

from fastapi import APIRouter, Query

from .service import get_time_top_pages


router = APIRouter()


@router.get("/time-top-pages")
def time_top_pages(
    bucket: str = Query("6h", description="버킷 크기: 6h 또는 12h"),
    hours: int = Query(24, description="조회 기간(시간), 기본 24h"),
    limit: int = Query(5, description="버킷별 상위 N 페이지"),
) -> Dict[str, Any]:
    s = (bucket or "6h").strip().lower()
    if s.endswith("h"):
        s = s[:-1]
    try:
        bucket_hours = int(s)
    except ValueError:
        bucket_hours = 6
    # Only allow 6 or 12
    if bucket_hours not in (6, 12):
        bucket_hours = 6

    rows = get_time_top_pages(bucket_hours=bucket_hours, hours=hours, limit=limit)
    return {"buckets": rows}

