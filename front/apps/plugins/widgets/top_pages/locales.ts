import { resolveWidgetLanguage, type WidgetLanguage } from "../i18n"

interface TopPagesCopy {
  title: string
}

const topPagesCopy: Record<WidgetLanguage, TopPagesCopy> = {
  en: {
    title: "Top Pages (Top 5)",
  },
  ko: {
    title: "인기 페이지 Top 5",
  },
}

export function getTopPagesCopy(language?: string): TopPagesCopy {
  return topPagesCopy[resolveWidgetLanguage(language)]
}
