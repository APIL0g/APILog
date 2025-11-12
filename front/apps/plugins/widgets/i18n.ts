export type WidgetLanguage = "en" | "ko"

export function resolveWidgetLanguage(language?: string): WidgetLanguage {
  return language?.toLowerCase() === "ko" ? "ko" : "en"
}

const commonCopy: Record<
  WidgetLanguage,
  {
    errorPrefix: string
    loading: string
    noData: string
  }
> = {
  en: {
    errorPrefix: "Error",
    loading: "Loading...",
    noData: "No data",
  },
  ko: {
    errorPrefix: "오류",
    loading: "불러오는 중...",
    noData: "데이터가 없습니다",
  },
}

export function getCommonWidgetCopy(language?: string) {
  return commonCopy[resolveWidgetLanguage(language)]
}
