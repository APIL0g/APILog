import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";

/**
 * Rollup configuration that emits three bundles for the collector SDK.
 * 수집기 SDK를 위해 세 가지 번들을 생성하는 Rollup 구성입니다.
 *
 * 1) dist/index.js  (ESM build for frameworks to import directly)
 *    dist/index.js  (프레임워크에서 직접 가져오는 ESM 번들)
 *
 * 2) dist/collector.iife.js  (browser-ready collector runtime)
 *    dist/collector.iife.js  (브라우저에서 즉시 실행 가능한 수집기 런타임)
 *
 * 3) dist/embed.js  (loader script that fetches the runtime bundle)
 *    dist/embed.js  (런타임 번들을 가져오는 로더 스크립트)
 */
export default [
  {
    // ESM bundle consumed via modern build tools.
    // 최신 빌드 도구에서 소비하는 ESM 번들입니다.
    input: "src/index.ts",
    output: {
      file: "dist/index.js",
      format: "esm",
      sourcemap: false,
    },
    plugins: [
      resolve({ browser: true }),
      commonjs(),
      typescript({ tsconfig: "./tsconfig.json" }),
      terser(), // Minify the distributed bundle.
      // 배포 번들을 최소화하여 용량을 줄입니다.
    ],
    treeshake: true,
  },
  {
    // IIFE bundle that exposes the full collector runtime.
    // 전체 수집기 런타임을 제공하는 IIFE 번들입니다.
    input: "src/bootstrap.ts",
    output: {
      file: "dist/collector.iife.js",
      format: "iife",
      name: "ApiLogCollector", // Name aids debugging when attached to window.
      // 이름을 지정하여 window에 연결될 때 디버깅을 돕습니다.
      sourcemap: false,
    },
    plugins: [
      resolve({ browser: true }),
      commonjs(),
      typescript({ tsconfig: "./tsconfig.json" }),
      terser(), // Compress to keep the loader fast.
      // 로더 성능을 유지하기 위해 번들을 압축합니다.
    ],
    treeshake: true,
  },
  {
    // IIFE loader that downloads and initialises the collector runtime.
    // 수집기 런타임을 다운로드하고 초기화하는 IIFE 로더입니다.
    input: "src/embed.ts",
    output: {
      file: "dist/embed.js",
      format: "iife",
      name: "ApiLogEmbed",
      sourcemap: false,
    },
    plugins: [
      resolve({ browser: true }),
      commonjs(),
      typescript({ tsconfig: "./tsconfig.json" }),
      terser(), // Match the runtime bundle size constraints.
      // 런타임 번들과 동일한 크기 제한을 맞추기 위해 축소합니다.
    ],
    treeshake: true,
  },
];
