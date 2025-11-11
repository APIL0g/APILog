import os
import base64

from typing import Any, Dict, List

try:
    from influxdb_client_3 import InfluxDBClient3  # type: ignore
except Exception:  # pragma: no cover
    InfluxDBClient3 = None  # type: ignore

from influxdb_client import InfluxDBClient

from config import INFLUX_URL, INFLUX_TOKEN, INFLUX_BUCKET
# from app.ingest.influx import get_influxdb # (InfluxDB 연동 시 필요)

# 모든 스냅샷이 저장될 단일 디렉토리 (docker-compose.yml에서 볼륨 마운트 필요)
SNAPSHOT_STORAGE_ROOT = "/snapshots" 

def _generate_composite_key(site_id: str, page_url: str, device_type: str) -> str:
    """
    "siteId::pageUrl::deviceType" 형식의 고유 키 문자열을 생성합니다.
    """
    return f"{site_id}::{page_url}::{device_type}"

def _encode_key_to_filename(key: str) -> str:
    """
    키 문자열을 URL/파일 시스템에 안전한 Base64 문자열로 인코딩하여 파일명으로 만듭니다.
    """
    key_bytes = key.encode('utf-8')
    # 표준 Base64(+, /) 대신 'urlsafe' 버전을 사용
    b64_bytes = base64.urlsafe_b64encode(key_bytes)
    # 패딩(=)을 제거한 문자열 반환
    b64_string = b64_bytes.decode('utf-8').rstrip('=')
    
    return f"{b64_string}.webp" # 예: bWFpbjo6L2NhcnQ6OmRlc2t0b3A.webp

def get_snapshot_filepath(site_id: str, page_url: str, device_type: str) -> str:
    """
    siteId, pageUrl, deviceType을 기반으로 
    Base64 인코딩된 최종 파일 절대 경로를 반환합니다.
    """
    # 1. "main::/cart::desktop"
    key = _generate_composite_key(site_id, page_url, device_type)
    
    # 2. "bWFpbjo6L2NhcnQ6OmRlc2t0b3A.webp"
    filename = _encode_key_to_filename(key)
    
    # 3. "/snapshots/bWFpbjo6L2NhcnQ6OmRlc2t0b3A.webp"
    return os.path.join(SNAPSHOT_STORAGE_ROOT, filename)

def get_click_data_from_influx(path: str, device_type: str) -> List[Dict[str, Any]]:
    """
    (수정) InfluxDB 3.x에서 SQL을 사용하여 클릭 데이터를 조회합니다.
    (참고: browser_share 위젯)
    """
    
    # 2. (수정) InfluxDB 3.x용 SQL 쿼리
    # InfluxDB 3의 SQL은 테이블/필드명에 대소문자를 구분하므로
    # 데이터 수집(ingest) 시 사용된 스키마(필드명)와 정확히 일치해야 합니다.
    # (예: "siteId", "pageUrl", "deviceType", "x", "y")
    query = f'''
        SELECT 
            click_x as x, 
            click_y as y, 
            count(*) as value 
        FROM events
        WHERE
            "path" = '{path}' 
            AND "device_type" = '{device_type}'
        GROUP BY x, y
    '''

    try:
        result_df = InfluxDBClient3(host=INFLUX_URL, token=INFLUX_TOKEN, database=INFLUX_BUCKET).query(query)

        if result_df is None:
            return []

        # 5. DataFrame을 딕셔너리 리스트로 변환하여 반환
        return result_df.to_pylist()

    except Exception as e:
        print(f"Error querying InfluxDB: {e}")
        return []
    
def get_available_paths_from_influx() -> List[str]:
    """
    InfluxDB 'events' measurement에서 고유한(DISTINCT) 'path' 목록을 조회합니다.
    """
    
    # 1. 사용자가 요청한 SQL 쿼리
    query = "SELECT DISTINCT path FROM events"

    try:
        # 2. InfluxDB 3.x 클라이언트로 쿼리 실행
        result_df = InfluxDBClient3(host=INFLUX_URL, token=INFLUX_TOKEN, database=INFLUX_BUCKET).query(query)

        if result_df is None:
            return []

        return result_df['path'].to_pylist()

    except Exception as e:
        print(f"Error querying InfluxDB for distinct paths: {e}")
        return []