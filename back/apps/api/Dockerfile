# Base image with Python 3.11 for the ingestion API server.
# 수집 API 서버를 위한 Python 3.11 베이스 이미지를 사용합니다.
FROM python:3.11-slim

# Install the runtime dependencies without caching wheels to reduce image size.
# 이미지 크기를 줄이기 위해 캐시를 남기지 않고 런타임 의존성을 설치합니다.
RUN pip install --no-cache-dir fastapi uvicorn[standard] influxdb-client

# Set the working directory for application code.
# 애플리케이션 코드를 위한 작업 디렉터리를 설정합니다.
WORKDIR /app

# Copy the FastAPI source into the container.
# FastAPI 소스 코드를 컨테이너로 복사합니다.
COPY app /app/app

# Ensure logs are flushed directly to stdout/stderr.
# 로그를 stdout/stderr로 즉시 플러시하도록 설정합니다.
ENV PYTHONUNBUFFERED=1

# Launch the API under python -m for proper module resolution.
# 모듈 해석을 위해 python -m으로 API를 실행합니다.
CMD ["python", "-m", "app.main"]
