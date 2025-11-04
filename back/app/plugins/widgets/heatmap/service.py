import os
import base64
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

async def get_click_data_from_influx(site_id: str, page_url: str, device_type: str) -> list:
    """
    (구현 필요) InfluxDB에서 클릭 데이터를 조회합니다.
    """
    # (예시: InfluxDB 쿼리 로직...)
    # try:
    #     client = get_influxdb()
    #     query = f'''
    #         SELECT x, y, count() as value 
    #         FROM clicks
    #         WHERE siteId = '{site_id}' 
    #           AND pageUrl = '{page_url}' 
    #           AND deviceType = '{device_type}'
    #         GROUP BY x, y
    #     '''
    #     results = await client.query(query)
    #     return results.to_dict(orient="records")
    # except Exception as e:
    #     print(f"Error querying InfluxDB: {e}")
    #     return []
        
    # 임시 반환
    return []