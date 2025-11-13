# /tests/test_api_endpoints.py (새로운 내용)

import pytest
import pandas as pd  # 모킹을 위해 pandas import
from httpx import AsyncClient
from back.app.main import app
from fastapi.routing import APIRoute
from influxdb_client_3 import InfluxDBClient3  # <--- 모킹할 클래스 import

# --- 1. 동적으로 모든 API 엔드포인트 수집 ---

# FastAPI가 자동으로 생성하는 문서는 테스트에서 제외합니다.
EXCLUDED_PATHS = ["/openapi.json", "/docs", "/docs/oauth2-redirect", "/redoc"]

def collect_api_routes():
    """
    FastAPI 'app' 객체에서 모든 엔드포인트 경로와 메서드를 수집합니다.
    """
    routes_to_test = []
    for route in app.routes:
        # route가 'APIRoute' 타입인지 명시적으로 확인하고, Mount 객체는 무시합니다.
        if isinstance(route, APIRoute) and route.path not in EXCLUDED_PATHS:
            for method in route.methods:
                routes_to_test.append(
                    (method, route.path)
                )
    return routes_to_test

# --- 2. (신규) InfluxDB 연결 모킹 Fixture ---

@pytest.fixture(autouse=True)
def mock_influx_query(monkeypatch):
    """
    모든 API 테스트가 실행되기 전, InfluxDBClient3.query 함수를
    자동으로 모킹(Mocking)합니다.
    (autouse=True: 이 파일의 모든 테스트에 자동으로 적용됨)
    """
    
    # 이것이 InfluxDBClient3.query를 대체할 가짜 함수입니다.
    def mock_query(*args, **kwargs):
        print(f"MOCK INFLUXDB QUERY CALLED (mode={kwargs.get('mode')})")
        
        # 에러 로그에서 'mode="pandas"'를 사용하는 것을 확인했습니다.
        if kwargs.get('mode') == 'pandas':
            return pd.DataFrame()  # 빈 Pandas DataFrame을 반환
        
        # 기본 (mode='all' 등)
        return []

    # monkeypatch를 사용해 InfluxDBClient3 클래스의 'query' 메서드를
    # 우리가 만든 'mock_query' 함수로 덮어씁니다.
    monkeypatch.setattr(InfluxDBClient3, "query", mock_query)


# --- 3. 파라미터화된 테스트 함수 (변경 없음) ---

@pytest.mark.parametrize("method, path", collect_api_routes())
@pytest.mark.asyncio
async def test_api_smoke_test(method, path):
    """
    수집된 모든 엔드포인트에 대해 '스모크 테스트'를 실행합니다.
    - 404 (Not Found)가 뜨지 않는지 확인합니다.
    - 500 (Server Error)이 뜨지 않는지 확인합니다.
    """
    async with AsyncClient(app=app, base_url="http://test") as ac:
        
        response = None
        if method == "GET":
            response = await ac.get(path)
        elif method == "POST":
            # POST 요청은 Pydantic 스키마 검증이 필요할 수 있습니다.
            # 422 (Unprocessable Entity)는 '성공'으로 간주합니다.
            response = await ac.post(path, json={})
        elif method == "PUT":
            response = await ac.put(path, json={})
        elif method == "DELETE":
            response = await ac.delete(path)
        else:
            pytest.skip(f"Method {method} not tested in smoke test")

        print(f"Testing {method} {path}: Got {response.status_code}")
        
        # 404: 엔드포인트가 존재하지 않음 (실패)
        # 500: 코드 실행 중 서버 내부 오류 발생 (실패)
        assert response.status_code != 404, f"API {method} {path} not found (404)."
        assert response.status_code < 500, f"API {method} {path} returned server error ({response.status_code})."