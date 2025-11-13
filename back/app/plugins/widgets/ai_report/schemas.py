from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, ConfigDict


class TimeRange(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    from_ts: Optional[str] = Field(default=None, alias="from", serialization_alias="from")
    to: Optional[str] = None
    bucket: str = "1h"
    site_id: Optional[str] = None


class ReportRequest(BaseModel):
    time: TimeRange = TimeRange()
    prompt: str = ""
    language: str = "en"
    audience: str = "dev"
    word_limit: int = 700


class TrafficDiagnosisItem(BaseModel):
    focus: str
    finding: str
    widget: str
    severity: str = "Medium"
    share: Optional[str] = None
    insight: Optional[str] = None


class PageIssueItem(BaseModel):
    page: str
    issue: str
    dwell_time: Optional[str] = None
    exit_rate: Optional[str] = None
    insight: Optional[str] = None
    widget: str = "page_exit_rate"


class InteractionInsightItem(BaseModel):
    area: str
    insight: str
    widget: str
    action: Optional[str] = None


class RecommendationItem(BaseModel):
    category: str
    suggestion: str
    rationale: Optional[str] = None
    validation: Optional[str] = None


class PriorityItem(BaseModel):
    title: str
    priority: str
    impact: str
    effort: Optional[str] = None
    expected_metric_change: Optional[Dict[str, Any]] = None
    business_outcome: Optional[str] = None


class MetricItem(BaseModel):
    metric: str
    widget: str
    reason: str
    target_change: Optional[str] = None
    timeframe: Optional[str] = None


class PredictionItem(BaseModel):
    metric: str
    baseline: float
    expected: float
    unit: str = "%"
    narrative: Optional[str] = None


class RadarScoreItem(BaseModel):
    axis: str
    score: int
    commentary: Optional[str] = None


class ReportResponse(BaseModel):
    generated_at: str
    title: str = "AI Traffic Diagnosis Report"
    summary: str = ""
    diagnostics: List[TrafficDiagnosisItem] = Field(default_factory=list)
    page_issues: List[PageIssueItem] = Field(default_factory=list)
    interaction_insights: List[InteractionInsightItem] = Field(default_factory=list)
    ux_recommendations: List[RecommendationItem] = Field(default_factory=list)
    tech_recommendations: List[RecommendationItem] = Field(default_factory=list)
    priorities: List[PriorityItem] = Field(default_factory=list)
    metrics_to_track: List[MetricItem] = Field(default_factory=list)
    predictions: List[PredictionItem] = Field(default_factory=list)
    radar_scores: List[RadarScoreItem] = Field(default_factory=list)
    meta: Dict[str, Any] = Field(default_factory=dict)
