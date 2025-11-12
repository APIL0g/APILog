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


