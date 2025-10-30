"""Plugin/reporting API router.
위젯 등 플러그인용 조회 엔드포인트 라우터입니다.
"""

from typing import Any, Dict
import importlib
import pkgutil
from pathlib import Path

from fastapi import APIRouter

from ingest.influx import query_top_pages


router = APIRouter(prefix="/api/query", tags=["plugins"])

def _include_widget_routers(parent: APIRouter) -> None:
    base_pkg = "plugins.widgets"
    search_paths = []
    try:
        pkg = importlib.import_module(base_pkg)
        search_paths = list(getattr(pkg, "__path__", []))
    except Exception:
        # Fallback: resolve via filesystem relative to this file
        search_paths = [str(Path(__file__).parent / "widgets")]

    for _, name, ispkg in pkgutil.iter_modules(search_paths):
        if not ispkg:
            continue
        mod_name = f"{base_pkg}.{name}.router"
        try:
            mod = importlib.import_module(mod_name)
            child = getattr(mod, "router", None)
            if child is not None:
                parent.include_router(child)
        except Exception:
            # Ignore widgets without router or import errors
            continue


# Auto-load widget routers under plugins/widgets/*/router.py
_include_widget_routers(router)

