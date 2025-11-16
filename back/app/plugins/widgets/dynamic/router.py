from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Query

from .schemas import DynamicWidgetData, DynamicWidgetSpec, GeneratedWidgetRequest
from .service import (
    generate_widget_from_requirement,
    get_widget,
    list_widgets,
    query_widget_data,
)


router = APIRouter(prefix="/widgets/dynamic", tags=["dynamic_widgets"])


@router.get("", response_model=List[DynamicWidgetSpec])
def list_dynamic_widgets() -> List[DynamicWidgetSpec]:
    return list_widgets()


@router.get("/{widget_id}", response_model=DynamicWidgetSpec)
def get_dynamic_widget(widget_id: str) -> DynamicWidgetSpec:
    return get_widget(widget_id)


@router.get("/{widget_id}/data", response_model=DynamicWidgetData)
def get_dynamic_widget_data(
    widget_id: str,
    from_: Optional[str] = Query(default=None, alias="from"),
    to: Optional[str] = None,
    bucket: str = "1h",
    site_id: Optional[str] = None,
) -> DynamicWidgetData:
    return query_widget_data(widget_id, from_, to, bucket, site_id)


@router.post("/ai-generate", response_model=DynamicWidgetSpec)
def post_ai_generate(req: GeneratedWidgetRequest) -> DynamicWidgetSpec:
    return generate_widget_from_requirement(req)

