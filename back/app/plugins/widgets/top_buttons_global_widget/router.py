"""API router for the Global Top Buttons widget."""

from typing import Any, Dict, List

from fastapi import APIRouter, Query

from .service import query_top_buttons_global


router = APIRouter()


@router.get("/top-buttons/global")
def top_buttons_global(range: str = Query("7d", description="Lookback window, e.g. 7d, 24h")) -> Dict[str, Any]:
    rows: List[Dict[str, Any]] = query_top_buttons_global(range)
    return {"rows": rows}

