import { resolveWidgetLanguage, type WidgetLanguage } from "../i18n"

interface BrowserShareCopy {
  title: string
  previewDescription: string
  unknownLabel: (index: number) => string
}

const browserShareCopy: Record<WidgetLanguage, BrowserShareCopy> = {
  en: {
    title: "Sessions by Browser",
    previewDescription: "Donut chart showing how sessions are split across browsers.",
    unknownLabel: (index) => `Unknown ${index}`,
  },
  ko: {
    title: "브라우저별 세션 수",
    previewDescription: "브라우저별 세션 비중을 도넛 차트로 보여줘요.",
    unknownLabel: (index) => `알 수 없음 ${index}`,
  },
}

export function getBrowserShareCopy(language?: string): BrowserShareCopy {
  return browserShareCopy[resolveWidgetLanguage(language)]
}
