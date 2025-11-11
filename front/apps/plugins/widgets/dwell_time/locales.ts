import { resolveWidgetLanguage, type WidgetLanguage } from "../i18n"

interface DwellTimeCopy {
  title: string
  pageColumn: string
  avgTimeColumn: string
}

const dwellTimeCopy: Record<WidgetLanguage, DwellTimeCopy> = {
  en: {
    title: "Top Pages by Average Dwell Time",
    pageColumn: "Page",
    avgTimeColumn: "Avg Time",
  },
  ko: {
    title: "평균 체류 시간이 긴 페이지 Top",
    pageColumn: "페이지",
    avgTimeColumn: "평균 체류시간",
  },
}

export function getDwellTimeCopy(language?: string): DwellTimeCopy {
  return dwellTimeCopy[resolveWidgetLanguage(language)]
}
