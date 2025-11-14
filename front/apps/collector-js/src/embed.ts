(function () {
  // Ensure the loader only executes inside a browser environment.
  // 로더가 브라우저 환경에서만 실행되도록 보장합니다.
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  // Prevent double bootstrapping when the script tag is included twice.
  // 스크립트 태그가 두 번 포함되었을 때 중복 부팅을 방지합니다.
  if ((window as any).__APILOG_EMBED_BOOTED__) {
    return;
  }
  (window as any).__APILOG_EMBED_BOOTED__ = true;

  interface InitConfig {
    siteId: string;
    ingestUrl: string;
  }

  interface ApilogStub {
    __q: Array<[string, IArguments | any[]]>;
    init: (...args: any[]) => void;
    markFunnelStep: (...args: any[]) => void;
    markError: (...args: any[]) => void;
    flushNow: (...args: any[]) => void;
  }

  interface ApilogFinal extends ApilogStub {
    init(config: InitConfig): void;
    markFunnelStep(stepName: string): void;
    markError(info: unknown): void;
    flushNow(): void;
  }

  // Retrieve the script element responsible for executing this loader.
  // 현재 로더를 실행하는 스크립트 요소를 찾아 반환합니다.
  function getCurrentScript(): HTMLScriptElement | null {
    const current = document.currentScript as HTMLScriptElement | null;
    if (current && current.tagName.toLowerCase() === "script") {
      return current;
    }

    const scripts = document.getElementsByTagName("script");
    return scripts.length
      ? (scripts[scripts.length - 1] as HTMLScriptElement)
      : null;
  }

  // Install a stubbed `window.apilog` object that queues calls until ready.
  // 준비될 때까지 호출을 큐에 넣는 `window.apilog` 스텁 객체를 설치합니다.
  function ensureApilogStub(
    win: Window & { apilog?: ApilogStub }
  ): ApilogStub {
    if (win.apilog && typeof win.apilog === "object") {
      return win.apilog;
    }

    const queue: Array<[string, IArguments | any[]]> = [];

    const stub: ApilogStub = {
      init: function () {
        queue.push(["init", arguments]);
      },
      markFunnelStep: function () {
        queue.push(["markFunnelStep", arguments]);
      },
      markError: function () {
        queue.push(["markError", arguments]);
      },
      flushNow: function () {
        queue.push(["flushNow", arguments]);
      },
      __q: queue,
    };

    win.apilog = stub;
    return stub;
  }

  // Build the collector bundle URL relative to this embed script.
  // 이 임베드 스크립트를 기준으로 수집기 번들 URL을 구성합니다.
  function getCollectorUrl(embedScriptEl: HTMLScriptElement): string {
    const embedSrc = embedScriptEl.getAttribute("src") || "";
    const lastSlash = embedSrc.lastIndexOf("/");
    const base = lastSlash >= 0 ? embedSrc.slice(0, lastSlash) : "";

    // Default to a same-directory collector bundle when no base path is found.
    // 기본 경로가 없으면 동일한 디렉터리의 수집기 번들을 기본값으로 사용합니다.
    return base ? `${base}/collector.iife.js` : "collector.iife.js";
  }

  // Pull initial configuration from the data-* attributes of the script tag.
  // 스크립트 태그의 data-* 속성에서 초기 구성을 읽어옵니다.
  function readInitConfigFromScript(el: HTMLScriptElement): InitConfig {
    return {
      siteId: el.getAttribute("data-site-id") || "",
      ingestUrl: el.getAttribute("data-ingest-url") || "",
    };
  }

  // Dynamically load the collector bundle and notify via callbacks.
  // 수집기 번들을 동적으로 로드하고 콜백으로 결과를 알립니다.
  function loadCollectorScript(
    url: string,
    onLoad: () => void,
    onError: () => void
  ) {
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";

    script.onload = function () {
      onLoad();
    };

    script.onerror = function () {
      onError();
    };

    document.head.appendChild(script);
  }

  // Replace the stub with the real collector API and replay queued calls.
  // 스텁을 실제 수집기 API로 교체하고 큐에 쌓인 호출을 재생합니다.
  function finalizeInit(
    win: Window & { apilog?: ApilogFinal },
    cfg: InitConfig
  ) {
    try {
      if (win.apilog && typeof win.apilog.init === "function") {
        win.apilog.init(cfg);
      }

      const maybeQueue = win.apilog && (win.apilog as any).__q;
      if (maybeQueue && Array.isArray(maybeQueue)) {
        for (let i = 0; i < maybeQueue.length; i += 1) {
          const [method, argsLike] = maybeQueue[i];
          const api = (win.apilog as any) || {};

          if (typeof api[method] === "function") {
            try {
              const argArray = Array.prototype.slice.call(argsLike);
              api[method].apply(null, argArray);
            } catch (err) {
              // Silently swallow replay failures to avoid breaking host apps.
              // 호스트 애플리케이션을 방해하지 않도록 재생 실패를 무시합니다.
            }
          }
        }
        (win.apilog as any).__q = [];
      }
    } catch (err) {
      // Suppress unexpected runtime errors in the bootstrapper.
      // 부트스트래퍼에서 발생하는 예기치 않은 런타임 오류를 억제합니다.
    }
  }

  // ---------------------------------------------------------------------------
  // Main boot sequence
  // 주요 부트 시퀀스
  // ---------------------------------------------------------------------------

  const win = window as Window & { apilog?: ApilogStub };
  const me = getCurrentScript();

  // Fallback to just installing the stub if no script element could be found.
  // 스크립트 요소를 찾을 수 없으면 스텁만 설치하고 종료합니다.
  if (!me) {
    ensureApilogStub(win);
    return;
  }

  const initConfig = readInitConfigFromScript(me);
  ensureApilogStub(win);

  const collectorUrl = getCollectorUrl(me);

  loadCollectorScript(
    collectorUrl,
    function onLoaded() {
      finalizeInit(win as any, initConfig);
    },
    function onFailed() {
      // Ignore loading failures; observers can inspect network tools instead.
      // 로드 실패는 무시하고 네트워크 도구에서 추적하도록 둡니다.
    }
  );
})();
