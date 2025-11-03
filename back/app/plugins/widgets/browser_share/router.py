"""API router for the Browser Share widget.
브라우저별 세션 비율/집계 API.
"""

from typing import Any, Dict

from fastapi import APIRouter, Query

from .service import query_browser_share


router = APIRouter()


@router.get("/browser-share")
def browser_share(range: str = Query("7d", description="기간, 예: 7d"), top: int = Query(10, description="상위 N 개")) -> Dict[str, Any]:
    # 간단 파싱: 끝의 d만 허용하고 숫자만 사용
    days = 7
    s = (range or "7d").strip().lower()
    if s.endswith("d"):
        s = s[:-1]
    try:
        days = max(1, int(s))
    except ValueError:
        days = 7

    rows = query_browser_share(days=days, limit=top)
    return {"rows": rows}
