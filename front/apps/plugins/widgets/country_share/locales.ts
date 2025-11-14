import { resolveWidgetLanguage, type WidgetLanguage } from "../i18n"

interface CountryShareCopy {
  title: string
  previewDescription: string
  othersLabel: string
  unknownLabel: string
}

const countryShareCopy: Record<WidgetLanguage, CountryShareCopy> = {
  en: {
    title: "Sessions by Country",
    previewDescription: "See which countries drive the biggest portion of your traffic.",
    othersLabel: "Others",
    unknownLabel: "Unknown",
  },
  ko: {
    title: "국가별 세션 수",
    previewDescription: "트래픽 비중이 큰 국가 순위를 확인할 수 있어요.",
    othersLabel: "기타",
    unknownLabel: "알 수 없음",
  },
}

export function getCountryShareCopy(language?: string): CountryShareCopy {
  return countryShareCopy[resolveWidgetLanguage(language)]
}
