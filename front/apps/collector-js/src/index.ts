/**
 * Public entry points for the in-browser analytics collector SDK.
 * 브라우저 분석 수집기 SDK의 공개 진입점을 정의합니다.
 */

export interface InitConfig {
  siteId: string;
  ingestUrl: string;
  pageVariant?: string;
  utmSource?: string;
  utmCampaign?: string;
}

// Track whether the collector has already been initialised.
// 수집기가 이미 초기화되었는지 여부를 추적합니다.
let started = false;

// Preserve the runtime configuration to share with helper utilities.
// 헬퍼 유틸리티와 공유하기 위해 런타임 구성을 보존합니다.
let runtimeConfig: InitConfig | null = null;

/**
 * Initialise the placeholder collector until the full implementation lands.
 * 전체 구현이 도착하기 전까지 플레이스홀더 수집기를 초기화합니다.
 */
export function initCollector(cfg: InitConfig): void {
  if (started) {
    // Skip duplicate initialisations to keep state consistent.
    // 상태 일관성을 위해 중복 초기화를 건너뜁니다.
    return;
  }

  started = true;
  runtimeConfig = cfg;

  // TODO: Replace placeholder logging with the real collector wiring.
  // TODO: 플레이스홀더 로그를 실제 수집기 연동으로 교체합니다.
  console.log("[apilog SDK] initCollector()", cfg);
}

/**
 * Record a funnel milestone for later aggregation in the backend.
 * 백엔드에서 집계할 퍼널 이정표를 기록합니다.
 */
export function markFunnelStep(stepName: string): void {
  if (!started) {
    // Ignore calls until the collector has been initialised properly.
    // 수집기가 올바르게 초기화될 때까지 호출을 무시합니다.
    return;
  }

  // TODO: Queue a structured funnel event for the batch pipeline.
  // TODO: 배치 파이프라인을 위한 구조화된 퍼널 이벤트를 큐에 추가합니다.
  console.log("[apilog SDK] markFunnelStep()", stepName, {
    siteId: runtimeConfig?.siteId,
  });
}

/**
 * Capture additional error details from the host application.
 * 호스트 애플리케이션에서 추가 오류 정보를 수집합니다.
 */
export function markError(info: unknown): void {
  if (!started) {
    return;
  }

  // TODO: Attach the error payload to the batch queue for transport.
  // TODO: 오류 페이로드를 전송을 위한 배치 큐에 연결합니다.
  console.log("[apilog SDK] markError()", info, {
    siteId: runtimeConfig?.siteId,
  });
}

/**
 * Force an immediate flush of all buffered events.
 * 버퍼에 저장된 모든 이벤트를 즉시 플러시합니다.
 */
export function flushNow(): void {
  if (!started) {
    return;
  }

  // TODO: Expose the collector batch flush routine.
  // TODO: 수집기의 배치 플러시 루틴을 연동합니다.
  console.log("[apilog SDK] flushNow()", {
    siteId: runtimeConfig?.siteId,
  });
}

/**
 * Expose the current initialisation state for debugging utilities.
 * 디버깅 유틸리티를 위해 현재 초기화 상태를 노출합니다.
 */
export function isStarted(): boolean {
  return started;
}

/**
 * Provide read-only access to the configuration supplied during init.
 * 초기화 시 제공된 구성을 읽기 전용으로 제공합니다.
 */
export function getRuntimeConfig(): InitConfig | null {
  return runtimeConfig;
}
