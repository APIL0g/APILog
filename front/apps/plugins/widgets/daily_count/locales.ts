import { resolveWidgetLanguage, type WidgetLanguage } from "../i18n"

interface DailyCountCopy {
  title: string
  previewDescription: string
}

const dailyCountCopy: Record<WidgetLanguage, DailyCountCopy> = {
  en: {
    title: "Daily Log Count (7d)",
    previewDescription: "Daily total log volume for the selected range.",
  },
  ko: {
    title: "일별 로그 수 (최근 7일)",
    previewDescription: "선택한 기간 동안의 일별 로그 합계를 확인해요.",
  },
}

export function getDailyCountCopy(language?: string): DailyCountCopy {
  return dailyCountCopy[resolveWidgetLanguage(language)]
}
