from __future__ import annotations

from typing import Any, Dict
from fastapi import APIRouter

from .schemas import ReportRequest, ReportResponse
from .service import generate_report


router = APIRouter()


@router.post("/ai-report/generate", response_model=ReportResponse)
def post_ai_report(req: ReportRequest) -> Dict[str, Any]:
    t = req.time
    data = generate_report(
        t.from_ts, t.to, t.bucket, t.site_id,
        prompt=req.prompt, language=req.language, audience=req.audience, word_limit=req.word_limit,
    )
    return data

