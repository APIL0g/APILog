"""API router for the Top Page widget.
위젯: 가장 많이 조회된 페이지 통계 API.
"""

from typing import Any, Dict
from fastapi import APIRouter, Query
from .service import get_top_pages

router = APIRouter()

@router.get("/top-pages")
def top_pages(limit: int = Query(5, description="조회할 상위 페이지 수")) -> Dict[str, Any]:
    """
    인기 페이지 Top 5를 반환합니다.
    
    Returns:
        {
            "rows": [
                {"path": "/home", "total_views": 150},
                {"path": "/products", "total_views": 89},
                ...
            ]
        }
    """  
    rows = get_top_pages(limit)
    return {"rows": rows}