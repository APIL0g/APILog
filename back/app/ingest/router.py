"""Ingestion API router.
수집 관련 엔드포인트를 제공하는 라우터입니다.
"""

from typing import Any, Dict

from fastapi import APIRouter, Request

from .influx import write_events


router = APIRouter(prefix="/api/ingest", tags=["ingest"])


@router.post("/events")
async def ingest_events(req: Request) -> Dict[str, Any]:
    body: Dict[str, Any] = await req.json()
    events = body.get("events", [])
    write_events(events)
    return {"ok": True, "received": len(events)}

