import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Vite configuration tailored for the dashboard development workflow.
 * 대시보드 개발 워크플로에 맞춘 Vite 구성입니다.
 */
export default defineConfig({
  // Enable the React plugin with the experimental compiler for fast refresh.
  // 빠른 갱신을 위해 실험적 React 컴파일러가 포함된 플러그인을 활성화합니다.
  plugins: [
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler"]],
      },
    }),
  ],
});
