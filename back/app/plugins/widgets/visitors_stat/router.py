"""API router for visitor statistics widget."""

from typing import Any, Dict, Optional

from fastapi import APIRouter, Query

from .service import get_visitor_stat


router = APIRouter()


@router.get("/visitor-stat")
def visitor_stat(
    date: Optional[str] = Query(
        default=None,
        description="ISO date (YYYY-MM-DD). Defaults to today.",
    ),
    site_id: Optional[str] = Query(
        default=None,
        description="Optional site identifier to filter events.",
    ),
) -> Dict[str, Any]:
    """Return visitor statistics for the requested day and trailing history."""

    return get_visitor_stat(date_str=date, site_id=site_id)