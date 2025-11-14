import { resolveWidgetLanguage, type WidgetLanguage } from "../i18n"

interface AiInsightsErrors {
  model_downloading: string
  model_not_found: string
  ollama_unreachable: string
  status404: string
  status503: string
  fallback: string
}

export interface AiInsightsCopy {
  title: string
  previewDescription: string
  generateButton: string
  timeWindowLabel: string
  bucketLabel: string
  noInsights: string
  actionLabel: string
  errors: AiInsightsErrors
}

const aiInsightsCopy: Record<WidgetLanguage, AiInsightsCopy> = {
  en: {
    title: "AI Insights",
    previewDescription: "AI summarizes your logs to highlight the most important insights.",
    generateButton: "Generate",
    timeWindowLabel: "Time window",
    bucketLabel: "Bucket",
    noInsights: "No insights",
    actionLabel: "Action",
    errors: {
      model_downloading: "The model is downloading. Please try again shortly.",
      model_not_found: "Model not found. Download it first in Ollama.",
      ollama_unreachable: "Unable to reach the AI backend. Check Docker/Ollama.",
      status404: "The requested resource could not be found.",
      status503: "The service is temporarily unavailable. Please try again later.",
      fallback: "An unexpected error occurred.",
    },
  },
  ko: {
    title: "AI 인사이트",
    previewDescription: "AI가 로그 데이터를 분석해 가장 중요한 인사이트를 알려줘요.",
    generateButton: "생성",
    timeWindowLabel: "기간",
    bucketLabel: "버킷",
    noInsights: "인사이트 없음",
    actionLabel: "동작",
    errors: {
      model_downloading: "모델을 다운로드 중입니다. 잠시 후 다시 시도해주세요.",
      model_not_found: "모델을 찾을 수 없습니다. Ollama에서 해당 모델을 먼저 다운로드 해주세요.",
      ollama_unreachable: "AI 백엔드(Ollama)에 연결할 수 없습니다. Docker/Ollama 상태를 확인해주세요.",
      status404: "요청한 리소스를 찾을 수 없습니다.",
      status503: "서비스를 일시적으로 이용할 수 없습니다. 잠시 후 다시 시도해주세요.",
      fallback: "알 수 없는 오류가 발생했습니다.",
    },
  },
}

export function getAiInsightsCopy(language?: string): AiInsightsCopy {
  return aiInsightsCopy[resolveWidgetLanguage(language)]
}
