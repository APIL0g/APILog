"""FastAPI application entry point for the analytics ingestion service.
분석 데이터 수집 서비스를 위한 FastAPI 애플리케이션의 진입점입니다.
"""

from typing import Any, Dict
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from .influx import query_top_pages, write_events

app = FastAPI()

# Determine which origin is allowed to talk to this API over CORS.
# CORS를 통해 이 API와 통신할 수 있는 오리진을 결정합니다.
allow_origin = os.getenv("CORS_ALLOW_ORIGIN", "*")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if allow_origin == "*" else [allow_origin],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health() -> Dict[str, bool]:
    """Expose a lightweight health probe for container orchestrators.
    컨테이너 오케스트레이터를 위한 경량 상태 확인 엔드포인트입니다.
    """
    return {"ok": True}


@app.post("/api/ingest/events")
async def ingest_events(req: Request) -> Dict[str, Any]:
    """Accept batched SDK events and forward them to InfluxDB.
    SDK가 전송한 배치 이벤트를 수신하여 InfluxDB로 전달합니다.
    """
    body: Dict[str, Any] = await req.json()

    # Pull the event list out of the request body or fallback to an empty list.
    # 요청 본문에서 이벤트 목록을 꺼내고 없으면 빈 목록을 사용합니다.
    events = body.get("events", [])

    write_events(events)
    return {"ok": True, "received": len(events)}


@app.get("/api/query/top-pages")
async def top_pages() -> Dict[str, Any]:
    """Return a list of the most viewed pages for dashboard widgets.
    대시보드 위젯을 위해 조회 수가 많은 페이지 목록을 반환합니다.
    """
    rows = query_top_pages()
    return {"rows": rows}


if __name__ == "__main__":
    # Run uvicorn directly when executing the module for local development.
    # 모듈을 직접 실행할 때 uvicorn을 구동하여 로컬 개발을 지원합니다.
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=False)
