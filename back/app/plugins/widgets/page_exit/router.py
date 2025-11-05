"""API router for the Page Exit Rate widget.
페이지별 이탈률 API 라우터.
"""

from typing import Any, Dict
from fastapi import APIRouter, Query, HTTPException
from datetime import datetime, timedelta, timezone

from .service import get_page_exit_rate


router = APIRouter()


@router.get("/page-exit-rate")
def page_exit_rate(
    days: int = Query(7, description="기간(day): 7 or 30"),
):
    """
    Return page exit rates.

    - days: 7 or 30
    """
    if days not in (7, 30):
        raise HTTPException(status_code=400, detail="days must be 7 or 30")

    rows = get_page_exit_rate(days=days)

    now = datetime.now(timezone.utc)
    since = now - timedelta(days=days)
    return {
        "rows": rows,
        "meta": {
            "from": since.isoformat().replace("+00:00", "Z"),
            "to": now.isoformat().replace("+00:00", "Z"),
            "days": days,
            "definition": "exit_rate = exits_per_path / views_per_path * 100",
        },
    }
