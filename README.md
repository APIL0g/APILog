﻿# ApiLog Analytics Platform

> Prefer Korean? [한국어 안내서 보기](README.ko.md)

## Overview
- Lightweight analytics pipeline that ingests events through FastAPI and stores them in InfluxDB.
- Collector SDK (Rollup + TypeScript) captures browser behaviour and shares an embeddable loader.
- Dashboard (React + Vite) provides a starting point for visualising aggregated metrics.

## Architecture
- **Backend**: back/apps/api exposes ingestion (/api/ingest/events) and reporting (/api/query/top-pages) endpoints.
- **Collector**: front/apps/collector-js bundles an ESM SDK, an embeddable loader, and an IIFE runtime.
- **Dashboard**: front/apps/dashboard is a Vite-based React app that consumes API data.
- **Edge**: infra/nginx serves the dashboard, collector bundles, and reverse-proxies API calls.

## Getting Started
1. Install dependencies
   ```bash
   git clone https://github.com/APIL0g/APILog.git
   cd APILog
   npm install
   pip install -r back/apps/api/requirements.txt
   ```
2. Bring up the stack
   `bash
   docker compose up --build
   ```
3. Visit the dashboard at <http://localhost:8080> and validate the API at <http://localhost:8080/api/health>.

## Development Workflow
- front/apps/collector-js: 
pm run dev launches Rollup in watch mode; 
pm run build emits distributable bundles.
- front/apps/dashboard: 
pm run dev serves the UI; 
pm run build produces static assets for nginx.
- fack/apps/api: uvicorn app.main:app --reload --port 8000 runs the FastAPI server locally.

## Testing & Quality
- Backend: add pytest suites under back/apps/api/tests and run pytest.
- Collector & Dashboard: lint with 
pm run lint (if configured) and add component tests with your preferred runner.
- Infrastructure: use docker compose up --build to validate the production image locally.

## Project Structure
```
back/
  apps/api/            # FastAPI service & Influx helpers
front/
  apps/collector-js/   # Browser collector SDK
  apps/dashboard/      # React dashboard scaffold
infra/
  nginx/               # Multi-stage nginx build & config
```

## Licensing
- ApiLog is released under the MIT license, see [LICENSE](https://github.com/APIL0g/APILog/blob/develop/LICENSE).
