import { resolveWidgetLanguage, type WidgetLanguage } from "../i18n"

interface BrowserShareCopy {
  title: string
  unknownLabel: (index: number) => string
}

const browserShareCopy: Record<WidgetLanguage, BrowserShareCopy> = {
  en: {
    title: "Sessions by Browser",
    unknownLabel: (index) => `Unknown ${index}`,
  },
  ko: {
    title: "브라우저별 세션 수",
    unknownLabel: (index) => `알 수 없음 ${index}`,
  },
}

export function getBrowserShareCopy(language?: string): BrowserShareCopy {
  return browserShareCopy[resolveWidgetLanguage(language)]
}
