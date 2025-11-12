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

