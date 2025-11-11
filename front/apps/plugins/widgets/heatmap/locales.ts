import { resolveWidgetLanguage, type WidgetLanguage } from "../i18n"

export type HeatmapKnownError =
  | "SNAPSHOT_TIMEOUT"
  | "SNAPSHOT_GENERATE_TIMEOUT"
  | "POLLING_ERROR"
  | "GENERATION_START_FAILED"
  | "FETCH_DATA_FAILED"
  | "NO_PAGE_DATA"
  | "PAGE_LIST_FAILED"

interface HeatmapCopy {
  title: string
  pagePlaceholder: string
  deviceLabel: {
    desktop: string
    mobile: string
  }
  generatingSnapshot: string
  errors: Record<HeatmapKnownError, string>
}

const heatmapCopy: Record<WidgetLanguage, HeatmapCopy> = {
  en: {
    title: "Page Heatmap",
    pagePlaceholder: "Select page",
    deviceLabel: {
      desktop: "Desktop",
      mobile: "Mobile",
    },
    generatingSnapshot: "Creating a snapshot... It will refresh after a while.",
    errors: {
      SNAPSHOT_TIMEOUT: "Snapshot generation timed out. Please try again.",
      SNAPSHOT_GENERATE_TIMEOUT: "Failed to generate snapshot (timeout).",
      POLLING_ERROR: "Error while polling for snapshot.",
      GENERATION_START_FAILED: "Failed to start snapshot generation.",
      FETCH_DATA_FAILED: "Failed to load heatmap data.",
      NO_PAGE_DATA: "No page data found. Visit your site first to collect snapshots.",
      PAGE_LIST_FAILED: "Failed to load page list.",
    },
  },
  ko: {
    title: "페이지 히트맵",
    pagePlaceholder: "페이지를 선택하세요",
    deviceLabel: {
      desktop: "데스크톱",
      mobile: "모바일",
    },
    generatingSnapshot: "스냅샷을 생성하고 있어요. 잠시 후 새로 고쳐집니다.",
    errors: {
      SNAPSHOT_TIMEOUT: "스냅샷 생성이 시간 초과되었습니다. 다시 시도해 주세요.",
      SNAPSHOT_GENERATE_TIMEOUT: "스냅샷 생성에 실패했습니다 (시간 초과).",
      POLLING_ERROR: "스냅샷 상태를 확인하는 중 오류가 발생했습니다.",
      GENERATION_START_FAILED: "스냅샷 생성을 시작하지 못했습니다.",
      FETCH_DATA_FAILED: "히트맵 데이터를 불러오지 못했습니다.",
      NO_PAGE_DATA: "페이지 데이터가 없습니다. 사이트를 방문해 데이터를 먼저 수집하세요.",
      PAGE_LIST_FAILED: "페이지 목록을 불러오지 못했습니다.",
    },
  },
}

export function getHeatmapCopy(language?: string): HeatmapCopy {
  return heatmapCopy[resolveWidgetLanguage(language)]
}
