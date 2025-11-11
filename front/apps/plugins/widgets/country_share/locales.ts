import { resolveWidgetLanguage, type WidgetLanguage } from "../i18n"

interface CountryShareCopy {
  title: string
  othersLabel: string
  unknownLabel: string
}

const countryShareCopy: Record<WidgetLanguage, CountryShareCopy> = {
  en: {
    title: "Sessions by Country",
    othersLabel: "Others",
    unknownLabel: "Unknown",
  },
  ko: {
    title: "국가별 세션 수",
    othersLabel: "기타",
    unknownLabel: "알 수 없음",
  },
}

export function getCountryShareCopy(language?: string): CountryShareCopy {
  return countryShareCopy[resolveWidgetLanguage(language)]
}
