"""FastAPI application entry point that wires feature routers.
애플리케이션 진입점으로, 기능별 라우터를 연결합니다.
"""

from typing import Dict
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from ingest.router import router as ingest_router
from plugins.router import router as plugins_router
from plugins.widgets.ai_insights.router import router as ai_insights_router

app = FastAPI()

# Configure CORS
allow_origin = os.getenv("CORS_ALLOW_ORIGIN", "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if allow_origin == "*" else [allow_origin],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount feature routers
app.include_router(ingest_router)
app.include_router(plugins_router)
app.include_router(ai_insights_router)

@app.get("/api/health")
async def health() -> Dict[str, bool]:
    return {"ok": True}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)

