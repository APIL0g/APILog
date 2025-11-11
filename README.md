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
# Rename this file to .env and modify the variables to suit your environment.

# InfluxDB Settings
INFLUX_USERNAME=username
INFLUX_PASSWORD=password
INFLUX_ORG=your_organization
INFLUX_DATABASE=your-database-name
INFLUX_ADMIN_TOKEN=replace-it-with-a-complicated-random-string

# CORS allow list (comma separated or *)
CORS_ALLOW_ORIGIN=*

# Internal URL used by apilog-api to reach InfluxDB
INFLUX_URL=http://influxdb3-core:8181

# LLM (Ollama) Settings
LLM_PROVIDER=ollama
# Use Docker service name so apilog-api can reach the Ollama container
LLM_ENDPOINT=http://ollama:11434
# Trimmed model tag (no trailing spaces)
LLM_MODEL=llama3:8b
LLM_TEMPERATURE=0.2
LLM_TIMEOUT_S=60
# Disable insights cache while testing (0 = off)
AI_INSIGHTS_EXPLAIN_CACHE_TTL=0
```

### 3. Start the Application

```bash
docker compose up -d --build
```

_By default, this launches the dashboard on `http://<Public IP>:8080` (or `localhost` in dev) and the API on `http://<Public IP>:8080/api` behind nginx._

> ⚠️ **Internet exposure warning**  
> If you open the dashboard to the public web, lock down `CORS_ALLOW_ORIGIN` and your firewall/security groups so only trusted IPs/domains can reach it. Allowing `*` for everything risks leaking data.

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
