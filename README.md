﻿<p align="center">
  <img src="./public/media/apilog-logo-en.png" alt="ApiLog logo">
</p>

<h1 align="center">ApiLog</h1>

<p align="center">
  <i>Own every insight with ApiLog—drop-in tracking, drag-and-drop dashboards, and privacy-first analytics you can run right beside your product.</i>
</p>

<p align="center">
  <a href="README.md"><strong>English</strong></a> |
  <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  <a href="https://apilog.kr" target="_blank" rel="noopener">apilog.kr</a> — open-source microsite &nbsp;•&nbsp;
  <a href="https://demo.apilog.kr" target="_blank" rel="noopener">demo.apilog.kr</a> — live dashboard demo
</p>

---

## 🧭 Product Walkthrough

<p align="center">
  <img src="./public/media/apilog-dashboard.gif" alt="ApiLog dashboard walkthrough" width="820">
</p>

- [apilog.kr](https://apilog.kr) highlights the mission, architecture, and onboarding steps.
- [demo.apilog.kr](https://demo.apilog.kr) connects to a seeded workspace so you can explore dashboards, presets, and portlets without setup.

---

## 🚀 Getting Started

A detailed getting started guide can be found at [apilog.kr/docs](https://apilog.kr/docs).

---

## 🛠 Installing from Source

[▶️ Watch the user guide video](https://youtu.be/9LJH8unmKWQ) for a full walkthrough.

### Requirements

- Docker & Docker Compose (recommended for running the full stack locally)

### 1. Get the Source Code

```bash
git clone https://github.com/APIL0g/APILog.git
cd APILog
```

### 2. Configure ApiLog

Copy the provided template to `.env` so your local setup stays in sync with the repo:

```bash
cp .env.example .env
```

The snippet below is pulled directly from `.env.example` (update that file and re-run the copy whenever variables change):

```ini
# Copy this file to `.env` (e.g. `cp .env.example .env`) and adjust the values.
# 이 파일을 `.env`로 복사한 뒤(`cp .env.example .env`) 환경에 맞게 값을 채워주세요.

############################################################
# Required Settings (필수 설정)
############################################################

# InfluxDB database name where APILog writes/reads analytics events.
# (If you used docker-compose, the default is usually `apilog_db`).
# APILog이 데이터를 저장/조회할 InfluxDB 데이터베이스 이름 (docker-compose 기본값: `apilog_db`).
INFLUX_DATABASE=<Influx Db database name>

# Public base URL of the site you want to snapshot/analyze.
# Example: https://example.com (include protocol, no trailing slash).
# 스냅샷·분석 대상 실서비스의 기본 URL (프로토콜 포함, 마지막 슬래시 제외 권장).
TARGET_SITE_BASE_URL=<your site domain or Ip address>

############################################################
# Optional Settings (선택 설정) — 필요한 경우에만 수정
############################################################

# InfluxDB endpoint (change this only if you host Influx elsewhere)
# docker-compose 기본값으로 충분하다면 수정하지 마세요.
INFLUX_URL=http://influxdb3-core:8181

# CORS allow list (comma separated or * for all origins)
# 다중 도메인은 쉼표로 구분, 전부 허용하려면 *.
CORS_ALLOW_ORIGIN=*

# LLM (Ollama) Settings (used by AI Insights)
# AI Insights에서 사용하는 Ollama 기본 설정입니다.
LLM_PROVIDER=ollama
LLM_ENDPOINT=http://ollama:11434
LLM_MODEL=llama3:8b
LLM_TEMPERATURE=0.2
LLM_TIMEOUT_S=60
LLM_MAX_TOKENS=1024

# AI Report LLM (OpenAI) Settings — leave blank to disable.
# AI Report 기능을 쓰지 않으면 비워두셔도 됩니다.
AI_REPORT_LLM_PROVIDER=openai_compat
AI_REPORT_LLM_ENDPOINT=https://api.openai.com
AI_REPORT_LLM_MODEL=gpt-4.1
# Fill with your OpenAI-compatible API key if you want to enable AI Report.
# AI Report 기능을 쓰려면 OpenAI 호환 API 키를 여기에 입력하세요.
AI_REPORT_LLM_API_KEY=
AI_REPORT_LLM_MAX_TOKENS=4096
AI_REPORT_LLM_TEMPERATURE=0.2
AI_REPORT_LLM_TIMEOUT_S=300

# AI caching / internal API endpoints
# AI 캐시 및 내부 API 엔드포인트 설정입니다.
AI_INSIGHTS_CACHE_TTL=60
AI_INSIGHTS_EXPLAIN_CACHE_TTL=0
AI_REPORT_FETCH_BASE=http://apilog-api:8000

# Where to persist AI-generated dynamic widget specs (JSON file path)
# Docker 환경에서는 /snapshots가 이미 마운트됩니다.
DYNAMIC_WIDGETS_PATH=/snapshots/dynamic_widgets.json

# Optional settings reference (선택 설정 안내)
# - LLM_*: Adjust only for advanced LLM tuning / LLM 동작을 세밀히 조정할 때만 변경
# - AI_INSIGHTS_* / AI_REPORT_FETCH_BASE: Modify when 캐시 정책이나 내부 API 주소를 바꿔야 할 때만 수정하세요.
```

### 3. Start the Application

```bash
docker compose up -d --build
```

_By default, this launches the dashboard on `http://<Public IP>:8080` (or `localhost` in dev) and the API on `http://<Public IP>:8080/api` behind nginx._

> ⚠️ **Internet exposure warning**  
> ApiLog serves the dashboard at `http://localhost:10000` by default. If the app must be reachable from outside, open port `10000` only for the IPs you explicitly trust and keep `CORS_ALLOW_ORIGIN` restricted. For example:
> 
> ```bash
> sudo ufw allow from <trusted_ip> to any port 10000 proto tcp
> ```
> 
> Granting access more broadly (or keeping `*` in `CORS_ALLOW_ORIGIN`) risks exposing analytics data.

### 4. Inject the Tracker Snippet

Add the following loaders to the `<head>` area of `index.html` so that ApiLog can collect events immediately.

```html
<!-- Add this to your website's <head> section -->
<script
  src="http://<Public IP or Domain>:8080/apilog/embed.js"
  data-site-id="main"
  data-ingest-url="http://<Public IP or Domain>:8080/api/ingest/events"
  strategy="beforeInteractive"
></script>
```

---

## 🔄 Getting Updates

To pull code changes and rebuild from source:

```bash
git pull
docker compose up --force-recreate -d --build
```

---

## 📚 Extras

- **Docs** — [apilog.kr/docs](https://apilog.kr/docs) for deeper configuration guides and FAQs.
- **Demo data reset** — `docker compose down -v` wipes Influx volumes so you can start over quickly.
- **Contributing** — see [CONTRIBUTING.md](CONTRIBUTING.md) before opening a PR.
- **License** — code is released under [MIT](LICENSE); commercial use is welcome.

---
