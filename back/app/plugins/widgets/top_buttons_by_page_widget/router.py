"""API router for the By-Page Top Buttons widget."""

from typing import Any, Dict, List

from fastapi import APIRouter, Query

from .service import query_top_buttons_by_path, list_page_paths


router = APIRouter()


@router.get("/top-buttons/by-path")
def top_buttons_by_path(path: str = Query(..., description="Page path, e.g. / or /products"),
                        range: str = Query("7d", description="Lookback window, e.g. 7d, 24h")) -> Dict[str, Any]:
    rows: List[Dict[str, Any]] = query_top_buttons_by_path(path=path, range_str=range)
    return {"rows": rows}

@router.get("/top-buttons/paths")
def list_paths(range: str = Query("7d", description="Lookback window, e.g. 7d, 24h"),
               limit: int = Query(50, ge=1, le=500)) -> Dict[str, Any]:
    items: List[Dict[str, Any]] = list_page_paths(range_str=range, limit=limit)
    return {"paths": [it["path"] for it in items], "rows": items}
