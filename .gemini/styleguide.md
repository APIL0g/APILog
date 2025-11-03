# Company X Python Style Guide

# Introduction
This style guide outlines the coding conventions for  code developed at Company X.
It's based on PEP 8, but with some modifications to address specific needs and
preferences within our organization.

# Key Principles
* **Readability:** Code should be easy to understand for all team members.
* **Maintainability:** Code should be easy to modify and extend.
* **Consistency:** Adhering to a consistent style across all projects improves
  collaboration and reduces errors.
* **Performance:** While readability is paramount, code should be efficient.

## Type Hints
* **Use type hints:**  Type hints improve code readability and help catch errors early.

## Comments
* **Write clear and concise comments:** Explain the "why" behind the code, not just the "what".
* **Comment sparingly:** Well-written code should be self-documenting where possible.

## Logging
* **Use a standard logging framework:**  Company X uses the built-in `logging` module.
* **Log at appropriate levels:** DEBUG, INFO, WARNING, ERROR, CRITICAL
* **Provide context:** Include relevant information in log messages to aid debugging.

## Error Handling
* **Use specific exceptions:** Avoid using broad exceptions like `Exception`.
* **Handle exceptions gracefully:** Provide informative error messages and avoid crashing the program.
* **Use `try...except` blocks:**  Isolate code that might raise exceptions.

# Tooling
* **Code formatter:**  [Specify formatter, e.g., Black] - Enforces consistent formatting automatically.
* **Linter:**  [Specify linter, e.g., Flake8, Pylint] - Identifies potential issues and style violations.

# Code review comments

When Gemini generates code review comments (e.g., PR descriptions), the following guidelines must be followed:

1. **Bilingual Output:** All reviews must be written in **English** first.
2. **Korean Translation:** Immediately following the English summary, a **complete and accurate Korean translation** of the summary must be attached, separated by a "---" (horizontal bar).
3. **Format:** Use Markdown to write clearly and readably.
4. **Content:** Summarize the highlights and potential issues of the change.

Gemini가 코드 리뷰 댓글(예: PR 설명 생성)을 생성할 때, 다음 지침을 **반드시** 따라야 합니다.

1.  **이중 언어 출력:** 모든 리뷰는 **영어(English)**로 먼저 작성해야 합니다.
2.  **한국어 번역:** 영어 요약문 바로 다음에, 해당 요약문의 **완전하고 정확한 한국어(Korean) 번역**을 "---" (수평선)으로 구분하여 첨부해야 합니다.
3.  **형식:** 마크다운(Markdown)을 사용하여 명확하고 읽기 쉽게 작성합니다.
4.  **내용:** 변경 사항의 핵심(Highlights)과 잠재적인 문제점을 요약합니다.

## Example output format (required compliance)

**Highlights**

* New Feature: Popular Page Ranking: Implemented backend logic to fetch the top 5 most viewed pages.
* API Endpoint: Introduced a new API endpoint `/api/query/top-pages`.
* Error Handling: Included local testing for query results and error catching.

**Potential Issues**

* The new service could benefit from more specific error handling for database connection failures.

---

**하이라이트**

* 새로운 기능: 인기 페이지 순위: 가장 많이 본 상위 5개 페이지를 가져오는 백엔드 로직을 구현했습니다.
* API 엔드포인트: 새로운 API 엔드포인트 `/api/query/top-pages`를 도입했습니다.
* 오류 처리: 쿼리 결과 및 오류 포착을 위한 로컬 테스트가 포함되었습니다.

**잠재적 문제**

* 새 서비스는 데이터베이스 연결 실패에 대한 더 구체적인 오류 처리를 추가하면 좋습니다

---

![medium](https://www.gstatic.com/codereviewagent/medium-priority.svg)

The `datetime` module is imported but is not used anywhere in this file. It's best practice to remove unused imports to keep the code clean and avoid potential confusion.

---

![medium](https://www.gstatic.com/codereviewagent/medium-priority.svg)

모듈 datetime을 가져왔지만 이 파일 어디에서도 사용되지 않았습니다. 코드를 깔끔하게 유지하고 잠재적인 혼란을 방지하려면 사용되지 않는 imports를 제거하는 것이 가장 좋습니다.