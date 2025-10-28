/**
 * Entry point for mounting the dashboard React application.
 * 대시보드 React 애플리케이션을 마운트하는 진입점입니다.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import App from "./App.tsx";

// Hydrate the root element with React in strict mode to surface warnings.
// 경고를 노출하기 위해 React StrictMode로 루트 요소를 마운트합니다.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
