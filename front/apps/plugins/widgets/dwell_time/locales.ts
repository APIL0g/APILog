import { resolveWidgetLanguage, type WidgetLanguage } from "../i18n"

interface DwellTimeCopy {
  title: string
  previewDescription: string
  pageColumn: string
  avgTimeColumn: string
}

const dwellTimeCopy: Record<WidgetLanguage, DwellTimeCopy> = {
  en: {
    title: "Top Pages by Average Dwell Time",
    previewDescription: "Pages where visitors spend the most time.",
    pageColumn: "Page",
    avgTimeColumn: "Avg Time",
  },
  ko: {
    title: "평균 체류 시간이 긴 페이지 Top",
    previewDescription: "방문자가 오래 머무는 페이지 순위를 확인해요.",
    pageColumn: "페이지",
    avgTimeColumn: "평균 체류시간",
  },
}

export function getDwellTimeCopy(language?: string): DwellTimeCopy {
  return dwellTimeCopy[resolveWidgetLanguage(language)]
}
