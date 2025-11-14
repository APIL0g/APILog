import { resolveWidgetLanguage, type WidgetLanguage } from "../i18n"

export interface VisitorsStatCopy {
  title: string
  previewDescription: string
  metrics: {
    total: string
    returning: string
    new: string
  }
  noHistory: string
}

const visitorsStatCopy: Record<WidgetLanguage, VisitorsStatCopy> = {
  en: {
    title: "Visitor Overview",
    previewDescription: "Trend of total, returning, and new visitors.",
    metrics: {
      total: "Total Visitors",
      returning: "Returning Visitors",
      new: "New Visitors",
    },
    noHistory: "No historical data",
  },
  ko: {
    title: "방문자 개요",
    previewDescription: "전체·재방문·신규 방문자 추이를 한눈에 보여줘요.",
    metrics: {
      total: "총 방문자",
      returning: "재방문자",
      new: "신규 방문자",
    },
    noHistory: "히스토리 데이터가 없습니다",
  },
}

export function getVisitorsStatCopy(language?: string): VisitorsStatCopy {
  return visitorsStatCopy[resolveWidgetLanguage(language)]
}
