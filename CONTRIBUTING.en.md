# Contributing Guide (English)

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

## Code Review Checklist
- [ ] Tests cover the new behaviour and edge cases.
- [ ] Configuration changes include documentation updates.
- [ ] Security-sensitive code paths were reviewed for input validation.
- [ ] Docker image size impact considered for new dependencies.

## Conduct
- Be respectful, collaborate openly, and welcome new contributors.
- Report abusive behaviour to the maintainers via the security contact channel.
