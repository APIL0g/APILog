# /tests/test_api_endpoints.py

import pytest
from httpx import AsyncClient
from back.app.main import app  # pytest.ini 설정 덕분에 import 가능

# 이 파일의 모든 테스트는 '비동기'로 실행됨을 표시
pytestmark = pytest.mark.asyncio


async def test_read_main_root():
    """
    back/app/main.py의 기본 '/' 엔드포인트를 테스트합니다.
    (실제 엔드포인트가 존재한다고 가정)
    """
    # 'async with'를 사용하여 FastAPI 앱을 테스트하는 비동기 클라이언트 생성
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/")

    # HTTP 상태 코드가 200 (OK)인지 확인
    assert response.status_code == 200
    # (선택) 실제 반환되는 JSON 값을 확인
    # assert response.json() == {"message": "Hello World"}


async def test_ingest_router():
    """
    back/app/ingest/router.py의 엔드포인트를 테스트합니다.
    (예: '/ingest/data'라는 엔드포인트가 있다고 가정)
    """
    async with AsyncClient(app=app, base_url="http://test") as ac:
        # FastAPI 라우터에 설정된 실제 경로로 변경해야 합니다.
        response = await ac.get("/ingest/data") # <- 실제 경로로 수정

    # (가정) 이 엔드포인트도 200 (OK)를 반환해야 함
    assert response.status_code == 200
    # assert response.json() == {"status": "received"}


async def test_plugins_ai_insights_router():
    """
    back/app/plugins/widgets/ai_insights/router.py의 엔드포인트를 테스트합니다.
    (예: '/plugins/widgets/ai_insights/explain'이 있다고 가정)
    """
    async with AsyncClient(app=app, base_url="http://test") as ac:
        # POST 요청 및 JSON 본문 전송 예시
        test_payload = {
            "query": "test query"
        }
        response = await ac.post("/plugins/widgets/ai_insights/explain", json=test_payload) # <- 실제 경로로 수정

    assert response.status_code == 200
    # assert "explanation" in response.json()


# --- 아래에 다른 모든 라우터와 엔드포인트에 대한 테스트를 추가하세요 ---
# 예: test_plugins_ai_report_router()
# 예: test_plugins_browser_share_router()
# ...