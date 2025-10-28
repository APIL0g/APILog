# ApiLog 분석 플랫폼

## 개요
- FastAPI로 이벤트를 수집하고 InfluxDB에 저장하는 경량 분석 파이프라인입니다.
- Rollup + TypeScript 기반의 수집기 SDK가 브라우저 행동을 기록하고 임베드 가능한 로더를 제공합니다.
- React + Vite 대시보드는 집계된 지표를 시각화하기 위한 시작점을 제공합니다.

## 아키텍처
- **백엔드**: back/apps/api가 수집(/api/ingest/events)과 리포트(/api/query/top-pages) 엔드포인트를 노출합니다.
- **수집기**: front/apps/collector-js는 ESM SDK, 임베드 로더, IIFE 런타임을 번들링합니다.
- **대시보드**: front/apps/dashboard는 API 데이터를 소비하는 Vite 기반 React 앱입니다.
- **엣지**: infra/nginx가 대시보드와 수집기 번들을 제공하고 API 호출을 역프록시합니다.

## 시작하기
1. 의존성 설치
   ```bash
   npm install --prefix front/apps/dashboard
   npm install --prefix front/apps/collector-js
   python -m pip install fastapi uvicorn[standard] influxdb-client
   ```
2. 스택 실행
   ```bash
   docker compose up --build
   ```
3. <http://localhost:8080>에서 대시보드를 확인하고 <http://localhost:8080/api/health>로 API 상태를 점검합니다.

## 개발 워크플로
- front/apps/collector-js: 
pm run dev로 Rollup 감시 모드를, 
pm run build로 배포 번들을 실행합니다.
- front/apps/dashboard: 
pm run dev로 UI를 개발하고 
pm run build로 nginx용 정적 자산을 만듭니다.
- back/apps/api: uvicorn app.main:app --reload --port 8000으로 로컬 FastAPI 서버를 실행합니다.

## 테스트와 품질
- 백엔드: back/apps/api/tests 아래에 pytest 스위트를 추가하고 pytest를 실행합니다.
- 수집기 & 대시보드: 
pm run lint(구성된 경우) 등으로 린트하고 선호하는 러너로 컴포넌트 테스트를 추가합니다.
- 인프라: docker compose up --build로 배포 이미지를 로컬에서 검증합니다.

## 프로젝트 구조
```
back/
  apps/api/            # FastAPI 서비스 및 Influx 헬퍼
front/
  apps/collector-js/   # 브라우저 수집기 SDK
  apps/dashboard/      # React 대시보드 스캐폴드
infra/
  nginx/               # 멀티 스테이지 nginx 빌드와 설정
```

## 라이선스
![Static Badge](https://img.shields.io/badge/license-MIT-green)
