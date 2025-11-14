import { resolveWidgetLanguage, type WidgetLanguage } from "../i18n"

interface TopButtonsByPageCopy {
  title: string
  previewDescription: string
  range7: string
  range30: string
  noOptions: string
  searchPlaceholder: string
  noResults: string
  pagePlaceholder: string
  columnButton: string
  columnClicks: string
  clicksLabel: string
}

const topButtonsByPageCopy: Record<WidgetLanguage, TopButtonsByPageCopy> = {
  en: {
    title: "Top Button Clicks by Page",
    previewDescription: "CTA performance for any selected page.",
    range7: "Last 7 days",
    range30: "Last 30 days",
    noOptions: "No options",
    searchPlaceholder: "Search page...",
    noResults: "No results found",
    pagePlaceholder: "Select page",
    columnButton: "Button",
    columnClicks: "Clicks",
    clicksLabel: "clicks",
  },
  ko: {
    title: "페이지별 버튼 클릭 Top",
    previewDescription: "선택한 페이지의 CTA 버튼 클릭 순위를 보여줘요.",
    range7: "최근 7일",
    range30: "최근 30일",
    noOptions: "선택지가 없습니다",
    searchPlaceholder: "페이지 검색...",
    noResults: "검색 결과가 없습니다",
    pagePlaceholder: "페이지를 선택하세요",
    columnButton: "버튼",
    columnClicks: "클릭 수",
    clicksLabel: "회 클릭",
  },
}

export function getTopButtonsByPageCopy(language?: string): TopButtonsByPageCopy {
  return topButtonsByPageCopy[resolveWidgetLanguage(language)]
}
