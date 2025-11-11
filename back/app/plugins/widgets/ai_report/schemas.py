from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, ConfigDict


class TimeRange(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)
    from_ts: Optional[str] = Field(default=None, alias="from", serialization_alias="from")
    to: Optional[str] = None
    bucket: str = "1h"  # '1h'|'3h'|'6h'|'1d'
    site_id: Optional[str] = None


class ReportRequest(BaseModel):
    time: TimeRange = TimeRange()
    prompt: str = ""
    language: str = "ko"  # ko|en ...
    audience: str = "dev"  # dev|pm|ops
    word_limit: int = 700


class DiagnosisItem(BaseModel):
    widget: str
    finding: str
    pattern: Optional[str] = None


class RecommendationItem(BaseModel):
    category: str  # UX|기술|성능|콘텐츠 등 자유 텍스트
    suggestion: str
    rationale: Optional[str] = None


class PriorityItem(BaseModel):
    title: str
    priority: str  # High|Medium|Low
    impact: str
    effort: Optional[str] = None
    expected_metric_change: Optional[Dict[str, Any]] = None


class ReportResponse(BaseModel):
    generated_at: str
    title: str = "AI 리포트"
    summary: str = ""
    diagnostics: List[DiagnosisItem] = []
    recommendations: List[RecommendationItem] = []
    priorities: List[PriorityItem] = []
    metrics_to_track: List[str] = []
    meta: Dict[str, Any] = {}

