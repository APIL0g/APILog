########################################
# Build the dashboard frontend with Vite.
# Vite로 대시보드 프런트엔드를 빌드합니다.
########################################
FROM node:20-alpine AS build-dashboard

# Use a dedicated working directory inside the builder.
# 빌더 컨테이너 내부에 전용 작업 디렉터리를 사용합니다.
WORKDIR /app/dashboard

# Copy dependency manifests first to leverage Docker layer caching.
# Docker 레이어 캐시를 활용하기 위해 의존성 매니페스트를 먼저 복사합니다.
COPY front/apps/dashboard/package.json ./
COPY front/apps/dashboard/package-lock.json ./

# Install dependencies for the dashboard.
# 대시보드 의존성을 설치합니다 (peerDependencies 충돌 무시).
RUN npm ci --legacy-peer-deps

# Copy the remaining application sources and configuration.
# 나머지 애플리케이션 소스와 구성을 복사합니다.
COPY front/apps/dashboard ./

# Produce the static dashboard bundle in /app/dashboard/dist.
# /app/dashboard/dist에 정적 대시보드 번들을 생성합니다.
RUN npm run build

########################################
# Build the collector SDK with Rollup.
# Rollup으로 수집기 SDK를 빌드합니다.
########################################
FROM node:20-alpine AS build-collector

WORKDIR /app/collector

# Copy package metadata to install dependencies.
# 의존성 설치를 위해 패키지 메타데이터를 복사합니다.
COPY front/apps/collector-js/package.json ./
COPY front/apps/collector-js/package-lock.json ./

# Install dependencies for the collector SDK.
# 수집기 SDK 의존성을 설치합니다 (peerDependencies 충돌 무시).
RUN npm ci --legacy-peer-deps

# Copy the collector source tree and configuration files.
# 수집기 소스 트리와 구성 파일을 복사합니다.
COPY front/apps/collector-js ./

# Run the Rollup build to populate /app/collector/dist.
# Rollup 빌드를 실행해 /app/collector/dist를 채웁니다.
RUN npm run build

########################################
# Assemble the runtime nginx image.
# 런타임 nginx 이미지를 조립합니다.
########################################
FROM nginx:alpine AS runtime

# Prepare the public directories that host static assets.
# 정적 자산을 제공할 디렉터리를 준비합니다.
RUN mkdir -p /usr/share/nginx/html \
    && mkdir -p /usr/share/nginx/html/apilog

# Copy the dashboard SPA into the nginx html root.
# 대시보드 SPA를 nginx html 루트에 복사합니다.
COPY --from=build-dashboard /app/dashboard/dist /usr/share/nginx/html

# Copy the collector bundle under /apilog for script tag delivery.
# 스크립트 태그 제공을 위해 수집기 번들을 /apilog 경로에 복사합니다.
COPY --from=build-collector /app/collector/dist /usr/share/nginx/html/apilog

# Provide the custom nginx configuration tailored to the project.
# 프로젝트에 맞춘 nginx 구성을 복사합니다.
COPY infra/nginx/nginx.conf /etc/nginx/nginx.conf

# Expose port 80 for downstream services.
# 다운스트림 서비스가 접근할 수 있도록 80번 포트를 엽니다.
EXPOSE 80
