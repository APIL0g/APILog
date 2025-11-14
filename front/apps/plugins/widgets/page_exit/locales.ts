import { resolveWidgetLanguage, type WidgetLanguage } from "../i18n"

interface PageExitCopy {
  title: string
  previewDescription: string
  range7: string
  range30: string
  noOptions: string
  labels: {
    page: string
    exitRate: string
    exits: string
    views: string
  }
}

const pageExitCopy: Record<WidgetLanguage, PageExitCopy> = {
  en: {
    title: "Top Pages by Exit Rate",
    previewDescription: "Identify pages with the highest exit rate.",
    range7: "Last 7 days",
    range30: "Last 30 days",
    noOptions: "No options",
    labels: {
      page: "Page",
      exitRate: "Exit Rate",
      exits: "exits",
      views: "views",
    },
  },
  ko: {
    title: "페이지별 종료율 Top",
    previewDescription: "이탈률이 높은 페이지를 찾아볼 수 있어요.",
    range7: "최근 7일",
    range30: "최근 30일",
    noOptions: "선택지가 없습니다",
    labels: {
      page: "페이지",
      exitRate: "종료율",
      exits: "종료",
      views: "조회",
    },
  },
}

export function getPageExitCopy(language?: string): PageExitCopy {
  return pageExitCopy[resolveWidgetLanguage(language)]
}
