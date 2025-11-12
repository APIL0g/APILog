import { resolveWidgetLanguage, type WidgetLanguage } from "../i18n"

interface TopButtonsGlobalCopy {
  title: string
  range7: string
  range30: string
  noOptions: string
  columnButton: string
  columnClicks: string
}

const topButtonsGlobalCopy: Record<WidgetLanguage, TopButtonsGlobalCopy> = {
  en: {
    title: "Top Button Clicks (Global)",
    range7: "Last 7 days",
    range30: "Last 30 days",
    noOptions: "No options",
    columnButton: "Button",
    columnClicks: "Clicks",
  },
  ko: {
    title: "전체 버튼 클릭 Top",
    range7: "최근 7일",
    range30: "최근 30일",
    noOptions: "선택지가 없습니다",
    columnButton: "버튼",
    columnClicks: "클릭 수",
  },
}

export function getTopButtonsGlobalCopy(language?: string): TopButtonsGlobalCopy {
  return topButtonsGlobalCopy[resolveWidgetLanguage(language)]
}
