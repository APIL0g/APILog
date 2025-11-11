import { resolveWidgetLanguage, type WidgetLanguage } from "../i18n"

interface TimeTopPagesCopy {
  title: string
  bucketLabelPrefix: string
  lookbackLabel: string
}

const timeTopPagesCopy: Record<WidgetLanguage, TimeTopPagesCopy> = {
  en: {
    title: "Time Top Pages",
    bucketLabelPrefix: "Bucket",
    lookbackLabel: "Lookback Hours",
  },
  ko: {
    title: "시간대별 인기 페이지",
    bucketLabelPrefix: "버킷",
    lookbackLabel: "조회 시간 범위",
  },
}

export function getTimeTopPagesCopy(language?: string): TimeTopPagesCopy {
  return timeTopPagesCopy[resolveWidgetLanguage(language)]
}
