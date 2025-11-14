import { resolveWidgetLanguage, type WidgetLanguage } from "../i18n"

interface TopPagesCopy {
  title: string
  previewDescription: string
}

const topPagesCopy: Record<WidgetLanguage, TopPagesCopy> = {
  en: {
    title: "Top Pages (Top 5)",
    previewDescription: "Top pages ranked by total views.",
  },
  ko: {
    title: "인기 페이지 Top 5",
    previewDescription: "조회수가 많은 페이지 순위를 알려줘요.",
  },
}

export function getTopPagesCopy(language?: string): TopPagesCopy {
  return topPagesCopy[resolveWidgetLanguage(language)]
}
