# Contributing Guide (English)

<p align="center">
  <a href="CONTRIBUTING.md"><strong>English</strong></a> |
  <a href="CONTRIBUTING.ko.md">한국어</a>
</p>

## Communication
- Discuss significant changes in GitHub issues before opening a pull request.
- Use English for issue titles and summaries; add Korean context when helpful.

## Development Workflow
1. Fork the repository and create a feature branch: git checkout -b feature/your-change.
2. Keep branches focused—one logical change per pull request.
3. Follow the coding conventions used in each package (Prettier/ESLint for frontend, Ruff/Black style for Python).

## ✨ Portlet (Widget) Contribution Guide

This guide is for contributors who want to build portlets (widgets) on top of the APILog system. It explains how the system is structured and what you need to know to contribute effectively.

## 🏗️ 1. Overview & System Architecture

Widget development usually involves **both Frontend (FE)** and **Backend (BE)** work. Before you start, please make sure you understand the end-to-end data flow and collaboration rules.

### Data Flow Architecture

The widget data pipeline is:

**API Collector → InfluxDB Storage → FastAPI Widget API → Vite/React Dashboard**

| Step | Component | Role | Location & Reference |
| --- | --- | --- | --- |
| 1 | **API Collector** | Collect user event data | `back/app/main.py` (lines 13–40) |
| 2 | **InfluxDB** | Store collected time-series data | Docker environment |
| 3 | **FastAPI Widget API** | Query & process data | `back/app/plugins/widgets/` |
| 4 | **Vite/React Dashboard** | Render widgets | `front/apps/dashboard/` |

### Collaboration Rules

- **Code style & conventions**: Branch naming, commit types, TypeScript/Python style, etc. are defined in
    
    [<a href="CONTRIBUTING.md"><strong>APILog/CONTRIBUTING.md</strong></a>](lines 12-181).
    
- **Pull Requests**: FE and BE changes **must be submitted as separate PRs**. In each PR description, clearly state the area (**FE or BE**) and the **widget name** for easier review.
    - e.g. `[FEAT] BE – "<WidgetName> + short description"`

---

## 🛠️ 2. Environment & Tooling

How to set up your development environment and tools.

### Dev Environment Setup

- **Integrated stack**: Use `docker-compose.dev.yml` (lines 7–200) to bring up InfluxDB, Ollama, Dummy Frontend, etc. as a **single shared dev stack**. We recommend testing in this integrated environment by default.
    - **Run locally**:
        
        ```bash
        docker compose -f docker-compose.dev.yml up --build
        ```
        
- **Backend (Python)**:
    - **Version**: Python 3.11+
    - **Install dependencies**:
        
        ```bash
        pip install -r back/app/requirements.tx
        ```
        
- **Frontend (Node/TS)**:
    - **Version**: Node 18+ and one of PNPM/NPM
    - **Collector bundle**: Uses a separate Rollup config (`front/apps/collector-js/package.json`, lines 16–32). Only the built `dist/` output is shipped.

### Frontend Dashboard – How to Run (Important)

There are two ways to run the dashboard depending on your purpose:

| Purpose | Command | URL | Note |
| --- | --- | --- | --- |
| **Development (hot reload)** | `npm run dev` | `http://localhost:5173` | Use this during development. Runs Vite dev server with hot reload for fast feedback. |
| **Check production-like flow** | `npm run build` then Docker Compose | `http://localhost:10000` | After `npm run build`, the built assets are served via Nginx (configured in `docker-compose.dev.yml`), mirroring the real deployment flow. |

### Environment Variables & Settings

| Type | Description | Reference |
| --- | --- | --- |
| **Env vars** | Required/optional keys and defaults. When adding a new variable, you **must update both `.env.example` and your real `.env`** and add a short description. | `APILog/.env.example` (lines 8–53) |
| **Runtime config** | Default runtime values such as widget caching, LLM parameters, etc. | `back/app/config.py` (lines 47–135) |

---

## 💻 3. Frontend (FE) Work Points

These are key points for the dashboard and collector-related work.

| Topic | Description | Reference |
| --- | --- | --- |
| **App root** | Dashboard app root | `front/apps/dashboard` |
| **Auto-registration** | Every widget is auto-registered when `front/apps/plugins/widgets/**/index.tsx` exports both a **default React component** and **`widgetMeta`**. (Required) | `front/apps/dashboard/src/core/init-widgets.ts` (lines 9–50) |
| **Path aliases** | Use Vite aliases (`@` and `@plugins`) consistently for imports. | `front/apps/dashboard/tsconfig.json` (lines 20–23) |
| **API & state** | Use React hooks for API calls and state management. Follow the standard examples. | `front/apps/plugins/widgets/page_exit/index.tsx` (lines 1–144) |
| **i18n** | Common UI text is managed via `i18n.ts`. When adding new languages or strings, follow the patterns in this file and each widget’s `locales.ts`. | `front/apps/plugins/widgets/i18n.ts` (lines 1–28) |
| **AI Report** | When adding new data structures, align the types and rendering patterns with the AI Report page and sync with backend schemas. | `front/apps/dashboard/src/pages/ai-report.tsx` (lines 1–200) |
| **Collector** | When using DOM APIs, keep the code browser-only and **tree-shaking friendly** to keep bundle size under control. | `front/apps/collector-js/src/bootstrap.ts` (line 1) |

---

## 🖥️ 4. Backend (BE) Work Points

Key points for data querying, processing, and API routing.

### FastAPI & Routing

- **Main entry**: New **top-level routers** must be added following the order defined in `back/app/main.py` (lines 13–39).
- **Widget API auto-scan**: `back/app/plugins/router.py` (lines 13–49) automatically scans `plugins/widgets/*/router.py`.
    - **Rule**: For each new portlet, create a `plugins/widgets/<widget>` directory with both **`router.py`** and **`service.py`**.
        
        In `router.py`, you **must** define `router = APIRouter()` and expose that router object.
        
- **Ingest API**: Changes to event tag/field formats affect both the Collector and the rest of the dataflow, so **they must be documented**.
    - **Files**: `back/app/ingest/router.py` (lines 12–20) and `back/app/ingest/influx.py` (lines 1–155).

### Logic & Schemas

- **Business logic**: Influx SQL queries and data transformation logic should live in the **service layer (`service.py`)**. Shared configuration is read from `config.py`.
    - **Example**: `back/app/plugins/widgets/page_exit/service.py` (lines 1–99)
- **Response schemas**: For non-trivial responses, define Pydantic models and keep them **in sync with frontend types**. It is recommended to use `response_model` in FastAPI routes.
    - **Example**: `back/app/plugins/widgets/ai_report/schemas.py` (lines 1–115)
- **External calls**: Use `httpx` and reuse the timeout/error logging patterns from the existing AI Report service. Relevant settings come from `AI_REPORT_*` environment variables.
    - **Example**: `back/app/plugins/widgets/ai_report/service.py` (lines 1–120)

---

## 🚀 5. Steps to Create a New Widget/Portlet

Step-by-step guide to building a new widget.

1. **Check data source**
    
    Confirm whether the data required for your widget is already available in InfluxDB.
    
    - **If not**: extend the pipeline `Collector (front/apps/collector-js/src/bootstrap.ts) → Ingest (back/app/ingest/influx.py)` to capture the new events.
2. **Implement backend service**
    - Create `back/app/plugins/widgets/<widget>` directory.
    - Implement your Influx SQL queries or external API calls in **`service.py`**, along with input validation and basic metadata.
3. **Define backend router**
    - In the same folder, create **`router.py`** and define your FastAPI routes under `/<your-endpoint>`, exposing a `router = APIRouter()` object.
    - **Note**: The higher-level `plugins.router` automatically mounts all widget routers under `/api/query`, so you **must not** manually prefix `/api/query` inside each widget’s `router.py`.
        
        (See: `back/app/plugins/widgets/page_exit/router.py`, lines 12–38)
        
4. **Implement frontend widget**
    - Create `front/apps/plugins/widgets/<widget>/index.tsx`.
    - Implement a component that accepts `WidgetProps`, calls the API, renders the UI, and exports **`widgetMeta`**.
        
        (See: `front/apps/plugins/widgets/page_exit/index.tsx`, lines 37–144)
        
5. **i18n & placement**
    - If needed, add `front/apps/plugins/widgets/<widget>/locales.ts` for translations.
    - Place the widget in the dashboard pages (e.g. `front/apps/dashboard/src/pages/*`) or layout.
        
        (See: `front/apps/dashboard/src/pages/ai-report.tsx`, lines 190–200)
        

---

## ✅ 6. Validation & PR Checklist

Things to verify before opening a PR.

### Code Validation

- **Frontend**:
    - Run `npm run build` to validate types and bundle.
    - Ensure all lint rules are satisfied (see [<a href="CONTRIBUTING.md"><strong>APILog/CONTRIBUTING.md</strong></a>], lines 69–106).
- **Backend**:
    - Run at least basic unit/integration tests via `pytest` (see [<a href="CONTRIBUTING.md"><strong>APILog/CONTRIBUTING.md</strong></a>], lines 17–21).
    - Validate Influx queries against **real data** in the Docker environment.

### Git & Pull Request

- **Branch naming**: Use the format `<type>/<scope>-<description>`.
    
    (See [<a href="CONTRIBUTING.md"><strong>APILog/CONTRIBUTING.md</strong></a>], lines 42–66)
    
- **Commit messages**: Commit types must follow the table in
    
    [CONTRIBUTING.md]([<a href="CONTRIBUTING.md"><strong>APILog/CONTRIBUTING.md</strong></a>], lines 145–162).
    
- **PR body must include**:
    - Impacted areas (**FE, BE, Collector**)
    - Whether new env vars were added (ref: `APILog/.env.example`, lines 8–53)
    - Test results
    - **Screenshot or GIF** for any UI change

### Final Checks

- **Full integration rehearsal**:
    
    Run `docker compose -f docker-compose.dev.yml up --build`and verify that all components work together.
    
- **.env & docs**:
    
    Confirm `.env` and docs are up to date using the checklist in
    
   [<a href="CONTRIBUTING.md"><strong>APILog/CONTRIBUTING.md</strong></a>], lines 168–177.

## Testing
- Backend: add or update pytest coverage and run pytest before submitting.
- Collector & Dashboard: run 
pm run build and lint scripts to verify TypeScript correctness.
- Containers: execute docker compose up --build to ensure multi-stage images build successfully.

## Commit & PR Standards
- Write descriptive commit messages using the imperative mood (e.g., Add event batching helper).
- Provide bilingual (English + Korean) descriptions in pull requests when user-facing behaviour changes.
- Include screenshots or logs for UI or infrastructure modifications where relevant.

## 📌 Code Convention (EN)

<aside>

**Frontend:** Preact (TypeScript)

**Backend:** FastAPI (Python 3.11+)

These conventions are designed to ensure **maintainability and consistency** across the project.

</aside>

---

### **🔖 Branch Naming Convention**

**✅ Branch Format**

```markdown
<type>/<scope>-<description>
```

| Type | Description |
| --- | --- |
| `feat/` | Add a new feature |
| `fix/` | Fix a bug |
| `refactor/` | Refactor code (no feature changes) |
| `docs/` | Update documentation |
| `test/` | Add or modify test code |
| `chore/` | Miscellaneous tasks (config, build, env setup) |
| `hotfix/` | Critical hotfix (for urgent production issues) |

| Scope | Description |
| --- | --- |
| `fe` | Frontend |
| `be` | Backend |

---

### 🏷️ TypeScript Lint Rules

| No | Rule | Description |
| --- | --- | --- |
| 1 | `no-unused-vars` | Disallow unused variables |
| 2 | `no-console` | Disallow `console.log` (allow `console.error` and `console.warn` when necessary) |
| 3 | `eqeqeq` | Enforce the use of `===` instead of `==` |
| 4 | `no-undef` | Disallow the use of undeclared variables |
| 5 | `semi` | Require semicolons (`;`) at the end of statements |
| 6 | `camelcase` | Use `camelCase` for variable and function names |
| 7 | `quotes` | Prefer single quotes `' '` for strings |
| 8 | `no-var` | Disallow `var`; use `let` or `const` instead |
| 9 | `prefer-const` | Use `const` when variables are not reassigned |
| 10 | `arrow-body-style` | Use concise arrow function bodies when possible |
| 11 | `max-len` | Limit line length to 100 characters |
| 12 | `no-trailing-spaces` | Disallow unnecessary trailing spaces |
| 13 | `object-curly-spacing` | Require spacing inside braces: `{ key: value }` |
| 14 | `prettier/prettier` | Enforce Prettier formatting rules (unified formatter) |

### 🏷️ Preact Specific Rules

| No | Rule | Description |
| --- | --- | --- |
| 1 | `react/jsx-filename-extension` | Use `.jsx` or `.tsx` file extensions |
| 2 | `react/self-closing-comp` | Use self-closing tags for empty components `<Component />` |
| 3 | `react/destructuring-assignment` | Prefer destructuring for `props` and `state` |
| 4 | `react/function-component-definition` | Use functional components (`function` or arrow function`) |
| 5 | `react-hooks/rules-of-hooks` | Follow React Hooks rules (no hooks inside loops or conditionals) |
| 6 | `react-hooks/exhaustive-deps` | Require all dependencies in `useEffect` and similar hooks |

### 🏷️ Accessibility Lint (a11y)

| No | Rule | Description |
| --- | --- | --- |
| 1 | `jsx-a11y/alt-text` | Require `alt` attribute for `<img>` tags |
| 2 | `jsx-a11y/anchor-is-valid` | Ensure `<a>` elements have valid `href` attributes |
| 3 | `jsx-a11y/no-static-element-interactions` | Avoid binding events to static elements |
| 4 | `jsx-a11y/label-has-associated-control` | Ensure `<label>` elements are associated with form controls |

---

### 📥 Python (FastAPI) Convention

✅ **Naming Rules**

| Item | Rule |
| --- | --- |
| Variable | `snake_case` |
| Function | `snake_case` |
| Class | `PascalCase` |
| Constant | `UPPER_CASE_WITH_UNDERSCORES` |
| Filename | Lowercase, words separated by `_` |
| Module/Package | Lowercase letters, numbers, and `_` only |

✅ **FastAPI Architecture**

| Layer | Role |
| --- | --- |
| `core` | Manage global **shared components** (settings, configuration, utilities) |
| `features` | The top-level directory for individual **functional domains** (e.g., `ingest`, `analysis`) |
| `router` | Define FastAPI **endpoints** (request/response mapping) |
| `service` | Handle **business logic** and validation |
| `repo` | Manage **data access** (InfluxDB read/write operations) |
| `schemas` | Define **data models** (Pydantic Request/Response models) |

✅ **Security & Management**

- Store sensitive information in `.env` (via `python-dotenv` or `pydantic.BaseSettings`)
- Use `-reload` option in `uvicorn` **only during development**
- Manage logs using the `logging` module or `structlog`
- Use static analysis tools such as `ruff`, `sonarlint`, and `bandit` for code quality and security

---

### 🧩 Git Convention

✅ **Commit Message Format**

```markdown
[TYPE] - description
```

| TYPE | Description |
| --- | --- |
| FEAT | Add a new feature |
| FIX | Fix a bug |
| ADD | Add supplementary code (non-feature) |
| UPDATE | Modify an existing feature |
| DEL | Remove unnecessary code |
| DOCS | Documentation updates |
| REFACTOR | Code refactor (no feature change) |
| CHORE | Miscellaneous changes (naming, format, dependencies, etc.) |
| TEST | Add or update test code |
| SECURITY | Security-related updates |

---

### 📢 General Rules

- Split commits into **small, meaningful units**
- One commit = one logical change
- PR titles must follow the same **convention as commit messages**

## Code Review Checklist
- [ ] Tests cover the new behaviour and edge cases.
- [ ] Configuration changes include documentation updates.
- [ ] Security-sensitive code paths were reviewed for input validation.
- [ ] Docker image size impact considered for new dependencies.

## Conduct
- Be respectful, collaborate openly, and welcome new contributors.
- Report abusive behaviour to the maintainers via the security contact channel.

