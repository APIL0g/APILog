"""API router for the Daily Count widget.
위젯: 최근 1주일 날짜별 로그 수 집계 API.
"""

from typing import Any, Dict

from fastapi import APIRouter, Query

from .service import query_daily_counts


router = APIRouter()


@router.get("/daily-count")
def daily_count(range: str = Query("7d", description="기간, 예: 7d")) -> Dict[str, Any]:
    # 간단 파싱: 접미사 d를 허용하고 숫자만 사용
    days = 7
    s = (range or "7d").strip().lower()
    if s.endswith("d"):
        s = s[:-1]
    try:
        days = max(1, int(s))
    except ValueError:
        days = 7

    rows = query_daily_counts(days)
    return {"rows": rows}

