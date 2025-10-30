"""Plugin/reporting API router.
위젯 등 플러그인용 조회 엔드포인트 라우터입니다.
"""

from typing import Any, Dict

from fastapi import APIRouter

from ingest.influx import query_top_pages
from plugins.widgets.daily_count.router import router as daily_count_router


router = APIRouter(prefix="/api/query", tags=["plugins"])


@router.get("/top-pages")
async def top_pages() -> Dict[str, Any]:
    rows = query_top_pages()
    return {"rows": rows}

# Widgets
router.include_router(daily_count_router)

