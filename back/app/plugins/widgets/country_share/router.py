"""API router for the Country Share widget."""

from typing import Any, Dict

from fastapi import APIRouter, Query

from .service import query_country_share


router = APIRouter()


@router.get("/country-share")
def country_share(
    range: str = Query("7d", description="Lookback window, e.g. 7d or 24h"),
    top: int = Query(5, ge=1, le=50),
) -> Dict[str, Any]:
    return query_country_share(range_str=range, top=top)
