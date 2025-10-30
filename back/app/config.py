"""Application-wide configuration values.
환경 변수에서 읽어 공통으로 사용하는 설정을 정의합니다.
"""

from __future__ import annotations

import os

# InfluxDB settings (shared by ingest/plugins)
INFLUX_URL: str = os.getenv("INFLUX_URL", "http://localhost:8086")
INFLUX_TOKEN: str = os.getenv("INFLUX_TOKEN", "dev-token")
INFLUX_ORG: str = os.getenv("INFLUX_ORG", "apilog")
INFLUX_BUCKET: str = os.getenv("INFLUX_BUCKET", "apilog_raw")

# CORS
CORS_ALLOW_ORIGIN: str = os.getenv("CORS_ALLOW_ORIGIN", "*")

