import os
from fastapi import APIRouter, BackgroundTasks, Request, Query
from pydantic import BaseModel

from typing import Any, Dict, List

# 1. (수정) snapshot_bot의 전체 경로를 import합니다.
from .snapshot_bot import take_snapshot
# 2. (수정) .service는 현재 디렉토리에 있으므로 상대 경로를 사용합니다.
from .service import get_snapshot_filepath, get_click_data_from_influx

# 3. (수정) docker-compose 환경에서는 'localhost'가 아닌 서비스 이름으로 접근해야 합니다.
# (dummy-frontend 서비스가 3000번 포트를 사용한다고 가정)
TARGET_SITE_BASE_URL = "http://dummy-frontend:3000"

# --- API 라우터 및 모델 정의 ---

# 4. (수정) 라우터에 prefix와 tag를 명시합니다.
# 이렇게 하면 이 파일의 모든 경로는 /api/plugins/widgets/heatmap으로 시작합니다.
router = APIRouter()

class HeatmapData(BaseModel):
    snapshot_url: str | None # 이미지가 없으면 null
    clicks: List[Dict[str, Any]] # InfluxDB에서 가져온 클릭 데이터

# --- API 엔드포인트 ---

@router.get("/heatmap")
async def get_heatmap_data(
    background_tasks: BackgroundTasks,
    path: str = Query(
        ...,  # '...'는 이 파라미터가 필수(Required)임을 의미합니다.
        description="히트맵을 조회할 페이지 URL, 예: / 또는 /products/123"
    ), 
    deviceType: str = Query(
        ...,  # 필수 파라미터
        description="디바이스 유형, 예: desktop 또는 mobile"
    )
) -> HeatmapData:
    """
    히트맵 위젯에 필요한 스냅샷 URL과 클릭 데이터를 반환합니다.
    스냅샷이 없으면 백그라운드에서 생성을 트리거합니다.
    """
    
    # (site_id는 실제로는 request.state.user.site_id 등 인증/컨텍스트에서 가져와야 함)
    site_id = "main" 

    # 1. (서비스 호출) Base64 인코딩된 파일 경로 생성
    snapshot_file_path = get_snapshot_filepath(site_id, path, deviceType)
    
    # 2. 파일 존재 여부 확인
    snapshot_exists = os.path.exists(snapshot_file_path)
    
    snapshot_url = None
    if snapshot_exists:
        # 3. 파일이 존재하면, 프론트엔드가 접근할 수 있는 URL 경로로 변환
        filename = os.path.basename(snapshot_file_path)
        # (back/app/main.py에 마운트된 경로)
        snapshot_url = f"/api/snapshots/{filename}"
    else:
        # 4. 파일이 없으면, 백그라운드에서 스냅샷 생성을 "유도"
        print(f"[API] Snapshot not found. Triggering background task for {snapshot_file_path}")
        
        target_url = f"{TARGET_SITE_BASE_URL}{path}"
        
        # (봇 호출) take_snapshot 함수를 백그라운드에서 실행
        background_tasks.add_task(
            take_snapshot, 
            target_url, 
            deviceType, 
            snapshot_file_path
        )

    # 5. (서비스 호출) InfluxDB에서 클릭 데이터 조회
    clicks_data = get_click_data_from_influx(path, deviceType)

    # 6. 스냅샷 URL(있거나 null)과 클릭 데이터를 즉시 반환
    return HeatmapData(
        snapshot_url=snapshot_url,
        clicks=clicks_data
    )