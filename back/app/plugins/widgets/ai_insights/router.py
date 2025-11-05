# back/app/plugins/widgets/ai_insights/router.py
from fastapi import APIRouter, Query
from typing import Optional
from .service import build_digest
from .schemas import Digest, ExplainRequest, Insights
from .explain_service import generate_insights

router = APIRouter(prefix="/widgets/ai_insights", tags=["ai_insights"])

@router.get("/aggregate", response_model=Digest)
def get_aggregate(
    from_: Optional[str] = Query(default=None, alias="from"),
    to: Optional[str] = None,
    bucket: str = "1h",               # '1h'|'3h'|'6h'|'1d'
    site_id: Optional[str] = None,
):
    """
    Digest JSON 반환 (LLM 입력/프론트 공용).
    """
    digest = build_digest(from_, to, bucket, site_id)
    return digest

@router.post("/explain", response_model=Insights)
def post_explain(req: ExplainRequest):
    """
    Digest -> LLM Insights (또는 룰 기반 폴백) 생성.
    """
    return generate_insights(req.digest.model_dump(by_alias=True),
                             req.language, req.word_limit, req.audience)