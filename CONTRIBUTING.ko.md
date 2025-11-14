# 기여 가이드 (Korean)

<p align="center">
  <a href="CONTRIBUTING.md">English</a> |
  <a href="CONTRIBUTING.ko.md"><strong>한국어</strong></a>
</p>

## 커뮤니케이션
- 큰 변경 사항은 Pull Request 전에 GitHub 이슈에서 먼저 논의해주세요.
- 이슈 제목과 요약은 영어로 작성하고, 필요한 경우 한국어 설명을 덧붙입니다.

## 개발 흐름
1. 저장소를 포크하고 브랜치를 생성합니다: git checkout -b feature/your-change.
2. 한 브랜치에는 하나의 논리적인 변경만 포함하도록 유지합니다.
3. 각 패키지에서 사용 중인 코딩 컨벤션을 준수합니다 (프런트엔드는 Prettier/ESLint, 파이썬은 Ruff/Black 스타일 참조).

## ✨ 포틀릿(위젯) 기여 가이드

이 가이드는 포틀릿(위젯) 개발에 참여하는 분들이 시스템 구조를 빠르게 이해하고 기여할 수 있도록 돕기 위해 작성되었습니다.

## 🏗️ 1. 기여 개요 및 시스템 구조

위젯 개발은 **프론트엔드 (FE)**와 **백엔드 (BE)** 작업을 동시에 다루게 됩니다. 기여를 시작하기 전에 전체 데이터 흐름과 협업 규칙을 숙지해 주세요.

### 데이터 흐름 아키텍처

위젯의 데이터 흐름은 **API 수집 → InfluxDB 저장 → FastAPI 위젯 API → Vite/React 대시보드** 순서로 이어집니다.

| 순서 | 구성 요소 | 역할 | 위치 및 참고 |
| --- | --- | --- | --- |
| 1 | **API 수집 (Collector)** | 사용자 데이터 수집 | back/app/main.py (lines 13-40) |
| 2 | **InfluxDB 저장** | 수집된 시계열 데이터 저장 | Docker 환경 |
| 3 | **FastAPI 위젯 API** | 데이터 쿼리 및 가공 | back/app/plugins/widgets/ |
| 4 | **Vite/React 대시보드** | 위젯 렌더링 | front/apps/dashboard/ |

### 협업 규칙

- **코드 스타일 및 규칙**: 전체 브랜치 네이밍, 커밋 타입, TypeScript/Python 스타일은 [<a href="CONTRIBUTING.ko.md"><strong>APILog/CONTRIBUTING.ko.md</strong></a>](lines 12-181)에 정리된 규칙을 따릅니다.
- **PR 작성**: 위젯 개발 시 FE/BE 작업은 **각각 별도의 PR**로 분리하여 제출해야 합니다. 각 PR의 설명에는 해당 PR이 다루는 영역(**FE 또는 BE**)과 **"위젯명"**을 명확히 기재하여 리뷰를 용이하게 합니다.
    - ex. [FEAT] BE - “위젯명 + 작업 내용”

## 🛠️ 2. 환경 및 Tool 준비

개발 환경 구축과 Tool 사용법에 대한 안내입니다.

### 개발 환경 구축

- **통합 환경**: `docker-compose.dev.yml` (lines 7-200)을 사용하여 InfluxDB, Ollama, Dummy Frontend 등 **공통 인프라를 한 번에** 올릴 수 있으며, 통합 테스트를 기본으로 합니다.
    - **로컬 실행**: `docker compose -f docker-compose.dev.yml up --build`
- **백엔드 (Python)**:
    - **버전**: Python 3.11+
    - **설치**: `pip install -r back/app/requirements.txt` (lines 1-13)
- **프론트엔드 (Node/TS)**:
    - **버전**: Node 18+ 및 PNPM/NPM 중 하나 선택
    - **Collector 번들**: 별도 Rollup 설정 (`front/apps/collector-js/package.json`, lines 16-32)을 따르며, `dist/`만 배포합니다.

### 프론트엔드 실행 방법 (중요)

프론트엔드 대시보드는 개발 목적에 따라 두 가지 방식으로 접근할 수 있습니다.

| 목적 | 실행 명령어 | 접속 주소 | 설명 |
| --- | --- | --- | --- |
| **개발 (핫 리로드)** | `npm run dev` | `http://localhost:5173` | 개발 중에는 이 명령어로 Vite 개발 서버를 구동하여, 빠른 변경사항 반영(핫 리로드)을 확인합니다. |
| **실서비스 흐름 확인** | `npm run build` 후 Docker Compose 실행 | `http://localhost:10000` | `npm run build`로 빌드된 후 Nginx(`docker-compose.dev.yml`에 포함)를 통해 서빙되는 **실제 서비스 배포 환경**과 동일한 통합 흐름을 확인할 수 있습니다. |

### 환경 변수 및 설정

| 구분 | 내용 | 참고 파일 |
| --- | --- | --- |
| **환경 변수** | 필수/선택 목록과 기본값. 새 변수 추가 시 **`.env.example`**과 실제 `.env`를 동시에 갱신하고 설명을 추가해야 합니다. | APILog/.env.example (lines 8-53) |
| **런타임 설정** | 위젯 캐시, LLM 파라미터 등 런타임에 주입되는 기본값 확인 | back/app/config.py (lines 47-135) |

## 💻 3. 프론트엔드 (FE) 작업 포인트

위젯을 사용자에게 보여주는 대시보드 및 Collector 관련 작업 포인트입니다.

| 주제 | 내용 | 참고 파일 |
| --- | --- | --- |
| **앱 위치** | 대시보드 앱 루트 | front/apps/dashboard |
| **자동 등록** | 모든 위젯은 `front/apps/plugins/widgets/**/index.tsx`에서 **`default`**와 **`widgetMeta`****를  export 하면 자동 등록됩니다. (필수) | front/apps/dashboard/src/core/init-widgets.ts (lines 9-50) |
| **경로 통일** | Vite alias (`@`와 `@plugins`) 정의를 확인하고 Import 경로를 통일합니다. | front/apps/dashboard/tsconfig.json (lines 20-23) |
| **API/상태** | React 훅 기반으로 API 호출과 상태 관리를 구현합니다. 표준 예시를 참고하세요. | front/apps/plugins/widgets/page_exit/index.tsx (lines 1-144) |
| **다국어 (i18n)** | 공통 UI/문안은 `i18n.ts`를 통해 제공되며, 새 언어/문구 추가 시 이 파일과 각 위젯의 `locales.ts` 패턴을 따릅니다. | front/apps/plugins/widgets/i18n.ts (lines 1-28) |
| **AI 리포트** | 새 데이터 구조 추가 시 AI 리포트 페이지의 타입/렌더링 패턴을 참고하고 백엔드 스키마와 타입을 맞춥니다. | front/apps/dashboard/src/pages/ai-report.tsx (lines 1-200) |
| **Collector** | DOM API 사용 시 브라우저 전용 코드만 넣고, **Tree-shaking**이 가능하도록 코드를 작성하여 번들 사이즈를 유지합니다. | front/apps/collector-js/src/bootstrap.ts (line 1) |

## 🖥️ 4. 백엔드 (BE) 작업 포인트

데이터 쿼리, 가공, 그리고 API 라우팅 관련 작업 포인트입니다.

### FastAPI 및 라우팅

- **메인 엔트리**: 새 **전역 라우터**는 `back/app/main.py` (lines 13-39)에 정의된 순서에 맞춰서 추가해야 합니다.
- **위젯 API 자동 스캔**: `back/app/plugins/router.py` (lines 13-49)가 `plugins/widgets/*/router.py`를 자동으로 스캔합니다.
    - **규칙**:  새 포틀릿을 만들 때는 `plugins/widgets/<widget>` 폴더 안에 **`router.py`**와 **`service.py`** 파일을 두고, `router.py` 파일 내에 `router = APIRouter()` → FastAPI **라우터 객체를 정의하여 외부에 공개(export)해야 합니다.**
- **데이터 수집 API**: 이벤트 태그/필드 규격 변경은 프론트 Collector와 Dataflow 모두에 영향을 주므로 **문서화가 필수**입니다.
    - **해당 파일**: back/app/ingest/router.py (lines 12-20)와 back/app/ingest/influx.py (lines 1-155).

### 로직 및 스키마

- **데이터 계산 로직**: Influx SQL 쿼리 및 데이터 변환 로직은 **서비스 계층 (`service.py`)에 분리**합니다. 공통 설정은 `config.py`에서 읽습니다.
    - **참고**: back/app/plugins/widgets/page_exit/service.py (lines 1-99)
- **응답 스키마**: 복잡한 응답은 Pydantic 모델로 선언하여 **프론트 타입과 싱크**를 맞춥니다. FastAPI 라우터에서 `response_model`을 지정하는 것이 좋습니다.
    - **참고**: back/app/plugins/widgets/ai_report/schemas.py (lines 1-115)
- **외부 호출**: `httpx`를 사용하고, 타임아웃/에러 로깅 패턴은 기존 AI 리포트 서비스를 재사용하세요. 환경변수 (`AI_REPORT_*`)를 활용합니다.
    - **참고**: back/app/plugins/widgets/ai_report/service.py (lines 1-120)

## 🚀 5. 새 위젯/포틀릿 제작 절차

새로운 위젯을 만드는 단계별 가이드입니다.

1. **데이터 소스 확인**: 위젯에 필요한 데이터가 InfluxDB에 이미 있는지 확인합니다.
    - **없다면**: Collector (`front/apps/collector-js/src/bootstrap.ts`) → Ingest (`back/app/ingest/influx.py`) 경로를 확장하여 이벤트를 수집하도록 합니다.
2. **백엔드 서비스 구현**:
    - `back/app/plugins/widgets/<widget>` 디렉터리를 생성합니다.
    - **`service.py`**에서 Influx SQL 쿼리 또는 외부 API 호출 로직을 구현하고, 입력 파라미터 검증 및 기본 메타데이터를 반환합니다.
3. **백엔드 라우터 정의**:
    - 같은 폴더에 **`router.py`**를 만들고, `/<your-endpoint>` 형태의 FastAPI 라우트를 정의하며, `router = APIRouter()` 객체를 노출합니다. (참고: back/app/plugins/widgets/page_exit/router.py, lines 12-38)
    - ※ 주의
        
        상위 레벨에서 `plugins.router`가 **모든 위젯 라우터를 `/api/query` 아래에 자동으로 마운트**하도록 설정되어 있기 때문에, **각 위젯의 [router.py](http://router.py/) 내에서는 `/api/query`를 직접 붙일 필요가 없습니다.**
        
4. **프론트엔드 위젯 구현**:
    - `front/apps/plugins/widgets/<widget>/index.tsx`를 생성합니다.
    - `WidgetProps`를 받아 API를 호출하고 UI를 렌더링하며, **`widgetMeta`**를 export 합니다. (참고: front/apps/plugins/widgets/page_exit/index.tsx, lines 37-144)
5. **다국어 및 배치**:
    - 필요하면 `front/apps/plugins/widgets/<widget>/locales.ts`로 다국어 문안을 추가합니다.
    - 대시보드 페이지 (`front/apps/dashboard/src/pages/*`)나 레이아웃에 해당 위젯을 배치합니다. (참고: front/apps/dashboard/src/pages/ai-report.tsx, lines 190-200)

## ✅ 6. 검증 및 제출 체크리스트

PR 제출 전 반드시 확인해야 할 사항입니다.

### 코드 검증

- **프론트엔드**: `npm run build`로 타입 및 번들 검증을 수행하고, 린트 규칙 ([<a href="CONTRIBUTING.ko.md"><strong>APILog/CONTRIBUTING.ko.md</strong></a>], lines 69-106)을 준수합니다.
- **백엔드**: 최소한의 유닛/통합 테스트를 `pytest`로 돌리고 ([<a href="CONTRIBUTING.ko.md"><strong>APILog/CONTRIBUTING.ko.md</strong></a>], lines 17-21), Influx 쿼리는 Docker 환경에서 **실제 데이터로 검증**합니다.

### Git 및 PR 제출

- **Git 브랜치**: `<type>/<scope>-<description>` 포맷을 사용합니다. ([<a href="CONTRIBUTING.ko.md"><strong>APILog/CONTRIBUTING.ko.md</strong></a>], lines 42-66)
- **커밋 메시지**: 커밋 메시지 타입은 [CONTRIBUTING.ko.md의 표](https://www.google.com/search?q=APILog/CONTRIBUTING.ko.md, lines 145-162)에 맞춥니다.
- **PR 본문**: 다음 내용을 반드시 명시합니다.
    - 영향 범위 (**FE, BE, Collector**)
    - 새 환경변수 여부 (APILog/.env.example, lines 8-53)
    - 테스트 결과
    - UI 변경 시 **스크린샷** 또는 **GIF** 첨부

### 최종 점검

- **통합 리허설**: `docker compose -f docker-compose.dev.yml up --build` 명령으로 **모든 컴포넌트를 띄워 통합 확인**을 합니다.
- **.env 및 문서**: `.env` 및 관련 문서 동기화 여부를 체크리스트 ([<a href="CONTRIBUTING.ko.md"><strong>APILog/CONTRIBUTING.ko.md</strong></a>], lines 168-177)와 함께 최종 확인합니다.

### Git 및 PR 제출

- **Git 브랜치**: `<type>/<scope>-<description>` 포맷을 사용합니다. ([<a href="CONTRIBUTING.ko.md"><strong>APILog/CONTRIBUTING.ko.md</strong></a>], lines 42-66)
- **커밋 메시지**: 커밋 메시지 타입은 ([<a href="CONTRIBUTING.ko.md"><strong>APILog/CONTRIBUTING.ko.md</strong></a>], lines 145-162)에 맞춥니다.
- **PR 본문**: 다음 내용을 반드시 명시합니다.
    - 영향 범위 (**FE, BE, Collector**)
    - 새 환경변수 여부 (APILog/.env.example, lines 8-53)
    - 테스트 결과
    - UI 변경 시 **스크린샷** 또는 **GIF** 첨부

### 최종 점검

- **통합 리허설**: `docker compose -f docker-compose.dev.yml up --build` 명령으로 **모든 컴포넌트를 띄워 통합 확인**을 합니다.
- **.env 및 문서**: `.env` 및 관련 문서 동기화 여부를 체크리스트 ([<a href="CONTRIBUTING.ko.md"><strong>APILog/CONTRIBUTING.ko.md</strong></a>], lines 168-177)와 함께 최종 확인합니다.

## 테스트
- 백엔드: pytest 커버리지를 추가·갱신하고 pytest로 검증합니다.
- 수집기 & 대시보드: 
pm run build와 린트 스크립트를 실행해 TypeScript 정확성을 확인합니다.
- 컨테이너: docker compose up --build로 멀티 스테이지 이미지가 정상 빌드되는지 확인합니다.



## 커밋 & PR 규칙
- 명령형 어조의 설명적인 커밋 메시지를 작성합니다 (예: Add event batching helper).
- 사용자 행동이 달라지는 변경은 PR 본문에 영어와 한국어 설명을 모두 작성합니다.
- UI 또는 인프라 변경에는 필요한 경우 스크린샷이나 로그를 첨부합니다.

## 📌 코드 컨벤션(KR)

<aside>

프론트엔드 : Preact(TypeScript)

백엔드 : FastAPI(Python 3.11+)

공통적으로 유지보수성과 일관성을 높이기 위한 컨벤션입니다. 

</aside>

---

### **🔖 Branch Naming Convention**

**✅ branch 형식**

```markdown
<type>/<scope>-<description>
```

| type | 설명 |
| --- | --- |
| `feat/` | 새로운 기능 추가 |
| `fix/` | 버그 수정 |
| `refactor/` | 리팩토링 (기능 변화 없음) |
| `docs/` | 문서 수정 |
| `test/` | 테스트 코드 추가/수정 |
| `chore/` | 기타 설정, 빌드, 환경 수정 |
| `hotfix/` | 긴급 수정(배포 중 오류 등) |

| scope | 설명 |
| --- | --- |
| `fe` | Frontend |
| `be` | Backend |
| `docs` | 문서 관련 |
| `devops` | 인프라/CI 설정 |

---

### 🏷️ TypeScript Lint Rules

| No | Rule | Description |
| --- | --- | --- |
| 1 | `no-unused-vars` | 선언 후 사용되지 않는 변수 금지 |
| 2 | `no-console` | `console.log` 사용 금지 (`console.error`, `console.warn`은 필요 시 허용) |
| 3 | `eqeqeq` | `==` 대신 `===` 사용 |
| 4 | `no-undef` | 선언되지 않은 변수 사용 금지 |
| 5 | `semi` | 문장 끝에 세미콜론(`;`) 필수 |
| 6 | `camelcase` | 변수 및 함수명은 `camelCase`로 작성 |
| 7 | `quotes` | 문자열은 `'`(작은따옴표) 사용 권장 |
| 8 | `no-var` | `var` 금지 → `let` 또는 `const` 사용 |
| 9 | `prefer-const` | 재할당 없는 변수는 `const` 사용 |
| 10 | `arrow-body-style` | 간단한 함수는 중괄호 없이 한 줄로 작성 |
| 11 | `max-len` | 한 줄 최대 100자 제한 |
| 12 | `no-trailing-spaces` | 불필요한 공백 금지 |
| 13 | `object-curly-spacing` | 객체 리터럴 중괄호 내부에 공백 필수 `{ key: value }` |
| 14 | `prettier/prettier` | Prettier 포맷팅 규칙 준수 (통합 포맷터 사용) |

### 🏷️ Preact Specific Rules

| No | Rule | Description |
| --- | --- | --- |
| 1 | `react/jsx-filename-extension` | `.jsx` 또는 `.tsx` 확장자 권장 |
| 2 | `react/self-closing-comp` | 내용 없는 태그는 `<Component />` 형식 사용 |
| 3 | `react/destructuring-assignment` | `props`, `state`는 구조 분해 할당 사용 |
| 4 | `react/function-component-definition` | 함수형 컴포넌트 사용 (`function` 또는 `arrow function`) |
| 5 | `react-hooks/rules-of-hooks` | Hook 규칙 준수 (`useEffect`, `useState` 등 조건문 내 금지) |
| 6 | `react-hooks/exhaustive-deps` | 의존성 배열 누락 금지 (`useEffect` 등) |

### 🏷️ 접근성 Lint (a11y)

| No | Rule | Description |
| --- | --- | --- |
| 1 | `jsx-a11y/alt-text` | `<img>`에는 `alt` 속성 필수 |
| 2 | `jsx-a11y/anchor-is-valid` | `<a>`는 유효한 `href` 필요 |
| 3 | `jsx-a11y/no-static-element-interactions` | static 요소에 직접 이벤트 바인딩 금지 |
| 4 | `jsx-a11y/label-has-associated-control` | `<label>`에는 연결된 폼 요소 필요 |

---

### 📥 Python (FastAPI) Convention

✅ **Naming**

| 항목 | 규칙 |
| --- | --- |
| 변수명 | `snake_case` |
| 함수명 | `snake_case` |
| 클래스명 | `PascalCase` |
| 상수 | `UPPER_CASE_WITH_UNDERSCORES` |
| 파일명 | 모두 소문자, 단어 구분은 `_` 사용 |
| 모듈/패키지 | 소문자, 숫자 및 `_`만 허용 |

✅ **FastAPI Architecture**

| Layer | 역할 |
| --- | --- |
| `core` | 프로젝트 전역에서 사용하는 **공통 구성 요소**를 관리 |
| `features` | 실제 **기능(도메인)** 단위를 담는 최상위 폴더 |
| `router` | FastAPI **엔드포인트 정의** |
| `service` | 비즈니스 로직 처리 |
| `repo` | **데이터 접근**  |
| `schemas` | 데이터 모델 정의 (Pydantic) |

✅ **Security & Management**

- 민감 정보는 `.env` 파일에 저장 (`python-dotenv` or `pydantic.BaseSettings`)
- `uvicorn` 실행 시 `-reload` 옵션은 개발용에서만 사용
- 로그는 `logging` 모듈 또는 `structlog`로 관리
- 정적 분석: `ruff`, `sonarlint`, `bandit` 등 병행 권장

---

### 🧩 Git Convention

✅ Commit Message 형식

```markdown
[TYPE] - description
```

| TYPE | Description |
| --- | --- |
| FEAT | 새로운 기능 추가 |
| FIX | 버그 수정 |
| ADD | 부수적인 코드 추가 (feat 외) |
| UPDATE | 기능 수정 |
| DEL | 불필요한 코드 삭제 |
| DOCS | 문서 수정 |
| REFACTOR | 리팩토링 (기능 변화 없음) |
| CHORE | 기타 단순 변경 (패키지, 포맷, 변수명 등) |
| TEST | 테스트 코드 추가 |
| SECURITY | 보안 관련 수정 |

---

### 📢 General Rules

- 커밋은 **작은 단위로 나누기**
- 하나의 커밋 = 하나의 의미 있는 변경
- PR 제목은 커밋 메시지 컨벤션과 동일한 규칙 적용

## 코드 리뷰 체크리스트
- [ ] 새로운 동작과 에지 케이스를 테스트가 다룹니까?
- [ ] 설정 변경에 대한 문서가 업데이트되었습니까?
- [ ] 보안 민감 경로에서 입력 검증을 확인했습니까?
- [ ] 새로운 의존성이 Docker 이미지 크기에 미치는 영향을 검토했습니까?

## 행동 강령
- 서로를 존중하며 열린 협업 문화를 유지합니다.
- 부적절한 행동이 있다면 보안 연락 창구를 통해 관리자에게 알려주세요.


