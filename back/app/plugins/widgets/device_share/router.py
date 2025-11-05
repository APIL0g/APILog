"""API router for the Device Share widget.
위젯: 디바이스 유형별 사용자 비중 API."""

from typing import Any, Dict
from fastapi import APIRouter, Query
from datetime import datetime, timedelta, timezone
from .service import get_device_share

router = APIRouter()

@router.get("/device-share")
def device_share(days: int = Query(7, ge=1, le=90), limit: int = Query(2, ge=1, le=4),):
    rows = get_device_share(days=days, limit=limit)

    now = datetime.now(timezone.utc)
    since = now - timedelta(days=days)
    return {
        "rows" : rows,
        "meta" : {
            "from"  :  since.isoformat().replace("+00:00", "Z"),
            "to"    :  now.isoformat().replace("+00:00", "Z"),
            "days"  :  days,
            "limit" :  limit,
            "multi_touch" : True, # 중복 세션이 각 디바이스에 카운트 허용
        },
    }