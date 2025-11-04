# back/app/plugins/widgets/ai_insights/schemas.py
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, ConfigDict

# ----- Digest (입력용) -----
class TVPoint(BaseModel):
    t: str
    v: float

class TimeWindow(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)
    from_ts: str = Field(alias="from", serialization_alias="from")
    to: str
    bucket: str  # '1h'|'3h'|'6h'|'1d'

class Digest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)
    version: str = "1"
    time_window: TimeWindow
    context: Dict[str, Any] = {"site_id": "default", "filters": {}}
    totals: Dict[str, float] = {"pageviews": 0, "sessions": 0, "users": 0}
    series: Dict[str, List[TVPoint]] = {"pageviews": [], "error_rate": []}
    top_paths: List[Dict[str, Any]] = []
    errors: Dict[str, Any] = {"by_code": [], "top_endpoints": []}
    funnels: List[Dict[str, Any]] = []
    anomalies: List[Dict[str, Any]] = []

# ----- Explain 입력 -----
class ExplainRequest(BaseModel):
    digest: Digest
    language: str = "ko"        # "ko" | "en" ...
    word_limit: int = 400
    audience: str = "dev"       # "dev" | "pm" | "ops"

# ----- Insights (LLM 출력/프론트용) -----
class InsightItem(BaseModel):
    title: str
    severity: str                  # low|medium|high|critical
    metric_refs: List[str] = []
    evidence: Dict[str, Any] = {}
    explanation: str
    action: str

class Insights(BaseModel):
    generated_at: str
    insights: List[InsightItem] = []
    meta: Dict[str, Any] = {}
