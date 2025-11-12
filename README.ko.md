<p align="center">
  <img src="./public/media/apilog-logo-ko.png" alt="ApiLog 로고">
</p>

<h1 align="center">ApiLog</h1>

<p align="center">
  <i>ApiLog 하나로 인사이트를 직접 소유하세요—드롭인 트래킹, 드래그앤드롭 대시보드, 프라이버시 우선 분석을 제품 옆에서 바로 돌릴 수 있습니다.</i>
</p>

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.ko.md"><strong>한국어</strong></a>
</p>

<p align="center">
  <a href="https://apilog.kr" target="_blank" rel="noopener">apilog.kr</a> — 프로젝트 소개 마이크로사이트 &nbsp;•&nbsp;
  <a href="https://demo.apilog.kr" target="_blank" rel="noopener">demo.apilog.kr</a> — 대시보드 데모
</p>
 
---

## 🧭 프로덕트 둘러보기

<p align="center">
  <img src="./public/media/apilog-dashboard.gif" alt="ApiLog 대시보드 미리보기" width="820">
</p>

- [apilog.kr](https://apilog.kr)에서는 프로젝트 철학, 아키텍처, 온보딩 절차를 한눈에 볼 수 있습니다.
- [demo.apilog.kr](https://demo.apilog.kr)은 샘플 워크스페이스와 연결되어 있어 별도 설정 없이 포틀릿과 프리셋을 체험할 수 있습니다.

---

## 🚀 시작하기

시작에 대한 자세한 내용은 [apilog.kr/docs](https://apilog.kr/docs)를 방문하세요.

---

## 🛠 소스에서 설치

### 요구 사항

- Docker & Docker Compose (전체 스택 실행 권장)

### 1. 소스 코드 받기

```bash
git clone https://github.com/APIL0g/APILog.git
cd APILog
```

### 2. ApiLog 환경 설정

리포지터리 루트에서 `.env.example`을 `.env`로 복사한 뒤 값을 원하는 대로 조정하세요.

```bash
cp .env.example .env
```

아래 내용은 `.env.example` 파일을 그대로 가져온 것입니다. 기본값이 바뀌면 `.env.example`만 수정하고 다시 복사하면 문서와 환경이 함께 업데이트됩니다.

```ini
# 이 파일을 .env로 이름을 바꾸고 환경에 맞게 변수를 수정하세요.

# InfluxDB 설정
INFLUX_USERNAME=username
INFLUX_PASSWORD=password
INFLUX_ORG=your_organization
INFLUX_DATABASE=your-database-name
INFLUX_ADMIN_TOKEN=replace-it-with-a-complicated-random-string

# CORS 허용 목록(쉼표로 구분하거나 * 사용)
CORS_ALLOW_ORIGIN=*

# apilog-api가 InfluxDB에 접속할 내부 URL
INFLUX_URL=http://influxdb3-core:8181

# LLM (Ollama) 설정
LLM_PROVIDER=ollama
# apilog-api가 Ollama 컨테이너에 접근할 수 있도록 Docker 서비스 이름 사용
LLM_ENDPOINT=http://ollama:11434
# 공백 없는 모델 태그
LLM_MODEL=llama3:8b
LLM_TEMPERATURE=0.2
LLM_TIMEOUT_S=60
# 테스트 중에는 인사이트 캐시를 비활성화 (0 = 끔)
AI_INSIGHTS_EXPLAIN_CACHE_TTL=0
```

### 3. 애플리케이션 시작

```bash
docker compose up -d --build
```

_기본값으로 `http://<Public IP 주소>:8080`(또는 개발 환경에서는 `localhost`)에서 대시보드에 접속할 수 있습니다._

> ⚠️ **외부 접속 주의**  
> 대시보드를 인터넷에 연 경우 `CORS_ALLOW_ORIGIN`과 보안 그룹(방화벽)에서 허용할 IP/도메인만 열어 두세요. 신뢰하지 않는 주소를 모두 허용하면 데이터가 노출될 수 있습니다.

### 4. 추적 스니펫 삽입

`index.html`의 `<head>` 영역에 아래 로더를 추가하면 ApiLog가 즉시 이벤트를 수집할 수 있습니다.

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

## 🔄 업데이트하기

소스 코드를 최신화하고 다시 빌드하려면:

```bash
git pull
docker compose up --force-recreate -d --build
```

---

## 📚 참고 자료

- **문서** — 자세한 설정과 FAQ는 [apilog.kr/docs](https://apilog.kr/docs)에서 확인하세요.
- **데모 초기화** — `docker compose down -v`로 Influx 볼륨을 지우고 언제든 새로 시작할 수 있습니다.
- **기여 안내** — PR 전에 [CONTRIBUTING.md](CONTRIBUTING.md)를 꼭 읽어 주세요.
- **라이선스** — 프로젝트는 [MIT](LICENSE)로 배포되며 상업적 활용도 허용됩니다.
---
