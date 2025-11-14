import { resolveWidgetLanguage, type WidgetLanguage } from "../i18n"

interface TimeTopPagesCopy {
  title: string
  previewDescription: string
  bucketLabelPrefix: string
  lookbackLabel: string
}

const timeTopPagesCopy: Record<WidgetLanguage, TimeTopPagesCopy> = {
  en: {
    title: "Time Top Pages",
    previewDescription: "Compare top pages inside each time bucket to spot spikes.",
    bucketLabelPrefix: "Bucket",
    lookbackLabel: "Lookback Hours",
  },
  ko: {
    title: "시간대별 인기 페이지",
    previewDescription: "시간대별 상위 페이지를 비교해 트래픽 변화를 살펴봐요.",
    bucketLabelPrefix: "버킷",
    lookbackLabel: "조회 시간 범위",
  },
}

export function getTimeTopPagesCopy(language?: string): TimeTopPagesCopy {
  return timeTopPagesCopy[resolveWidgetLanguage(language)]
}
