from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field


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
    audience: str = "product"
    word_limit: int = 600


class TrafficDiagnosis(BaseModel):
    focus: str
    finding: str
    widget: str
    severity: Optional[str] = None
    share: Optional[str] = None
    insight: Optional[str] = None


class PageIssue(BaseModel):
    page: str
    issue: str
    widget: str
    dwell_time: Optional[str] = None
    exit_rate: Optional[str] = None
    insight: Optional[str] = None


class InteractionInsight(BaseModel):
    area: str
    insight: str
    widget: str
    action: Optional[str] = None


class Recommendation(BaseModel):
    category: str
    suggestion: str
    rationale: Optional[str] = None
    validation: Optional[str] = None


class ExpectedMetricChange(BaseModel):
    metric: Optional[str] = None
    period: Optional[str] = None
    target: Optional[str] = None
    baseline: Optional[float] = None


class PriorityItem(BaseModel):
    title: str
    priority: Union[Literal["low", "medium", "high"], str]
    impact: str
    widget: Optional[str] = None
    effort: Optional[str] = None
    expected_metric_change: Optional[ExpectedMetricChange] = None
    business_outcome: Optional[str] = None


class MetricWatch(BaseModel):
    metric: str
    widget: str
    reason: str
    target_change: Optional[str] = None
    timeframe: Optional[str] = None


class Prediction(BaseModel):
    metric: str
    baseline: float
    expected: float
    unit: Optional[str] = None
    narrative: Optional[str] = None


class RadarScoreItem(BaseModel):
    axis: Union[Literal["performance", "experience", "growth", "search", "stability"], str]
    score: int
    commentary: Optional[str] = None


class TrendMeta(BaseModel):
    label: str
    change_pct: float
    momentum_pct: Optional[float] = None
    days: Optional[int] = None
    last: Optional[float] = None


class ReportMeta(BaseModel):
    model_config = ConfigDict(extra="allow")

    provider: str = "unknown"
    model: str = "unknown"
    prompt_version: str = "v2"
    mode: Union[Literal["llm", "fallback", "deterministic", "error"], str] = "llm"
    source: Optional[str] = None
    site_id: Optional[str] = None
    time: Dict[str, Optional[str]] = Field(default_factory=dict)
    widgets: List[str] = Field(default_factory=list)
    missing_widgets: List[str] = Field(default_factory=list)
    trend: Optional[TrendMeta] = None
    notes: Dict[str, str] = Field(default_factory=dict)
    extras: Dict[str, Any] = Field(default_factory=dict)


class ReportResponse(BaseModel):
    generated_at: str
    title: str = "AI Traffic Diagnosis Report"
    summary: str = ""
    diagnostics: List[TrafficDiagnosis] = Field(default_factory=list)
    page_issues: List[PageIssue] = Field(default_factory=list)
    interaction_insights: List[InteractionInsight] = Field(default_factory=list)
    ux_recommendations: List[Recommendation] = Field(default_factory=list)
    tech_recommendations: List[Recommendation] = Field(default_factory=list)
    priorities: List[PriorityItem] = Field(default_factory=list)
    metrics_to_track: List[MetricWatch] = Field(default_factory=list)
    predictions: List[Prediction] = Field(default_factory=list)
    radar_scores: List[RadarScoreItem] = Field(default_factory=list)
    meta: ReportMeta = Field(default_factory=ReportMeta)
