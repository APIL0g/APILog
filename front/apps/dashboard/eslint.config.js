import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

/**
 * ESLint configuration that keeps the dashboard TypeScript code quality high.
 * 대시보드 TypeScript 코드 품질을 유지하기 위한 ESLint 구성입니다.
 */
export default defineConfig([
  // Ignore compiled artefacts from linting to speed up editor feedback.
  // 린트 속도를 높이기 위해 컴파일 산출물은 검사 대상에서 제외합니다.
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs["recommended-latest"],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
]);
