"""Plugin/reporting API router.
위젯 등 플러그인용 조회 엔드포인트 라우터입니다.
"""

from typing import Any, Dict
import importlib
import pkgutil
from pathlib import Path

from fastapi import APIRouter


router = APIRouter(prefix="/api/query", tags=["plugins"])

def _include_widget_routers(parent: APIRouter) -> None:
    # 1. 위젯 모듈 기본 경로 설정
    base_pkg = "plugins.widgets"
    # 2. plugins/widgets/ 폴더 경로 찾기
    search_paths = []
    try:
        pkg = importlib.import_module(base_pkg)
        search_paths = list(getattr(pkg, "__path__", []))
    except Exception:
        # Fallback: resolve via filesystem relative to this file
        search_paths = [str(Path(__file__).parent / "widgets")]

    # 3. widgets/ 폴더 안의 모든 하위 폴더 순회
    for _, name, ispkg in pkgutil.iter_modules(search_paths):
        if not ispkg:
            continue

        # 4. 각 위젯의 router.py 모듈 경로 생성
        mod_name = f"{base_pkg}.{name}.router"
        try:
            # 5. 위젯의 router 모듈을 import
            mod = importlib.import_module(mod_name)
            # 6. 모듈에서 'router' 객체 가져오기
            child = getattr(mod, "router", None)

            # 7. 위젯 라우터를 부모 라우터에 포함
            if child is not None:
                parent.include_router(child)
        except Exception:
            # Ignore widgets without router or import errors
            continue


# Auto-load widget routers under plugins/widgets/*/router.py
# 8. 모든 위젯 라우터 자동 로드
_include_widget_routers(router)

