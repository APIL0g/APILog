import { resolveWidgetLanguage, type WidgetLanguage } from "../i18n"

interface DailyCountCopy {
  title: string
}

const dailyCountCopy: Record<WidgetLanguage, DailyCountCopy> = {
  en: {
    title: "Daily Log Count (7d)",
  },
  ko: {
    title: "일별 로그 수 (최근 7일)",
  },
}

export function getDailyCountCopy(language?: string): DailyCountCopy {
  return dailyCountCopy[resolveWidgetLanguage(language)]
}
