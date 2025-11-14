type ExampleLanguage = "en" | "ko"

interface HighlightTemplate {
  title: string
  description: (context: { timeRange: string; renderedAt: string }) => string
}

interface ExampleCopy {
  headerTitle: string
  headerDescription: string
  previewDescription: string
  highlights: HighlightTemplate[]
}

export const exampleCopy: Record<ExampleLanguage, ExampleCopy> = {
  en: {
    headerTitle: "Example Widget",
    headerDescription: "Use this as a template for building real widgets.",
    previewDescription: "Starter template that demonstrates how widgets are built.",
    highlights: [
      {
        title: "Getting Started",
        description: () => "This widget lives in front/apps/plugins and is registered through initializeWidgets().",
      },
      {
        title: "Time Range",
        description: ({ timeRange }) =>
          `The dashboard requested data for ${timeRange}. Replace this with real analytics data.`,
      },
      {
        title: "Next Steps",
        description: () => "Clone this component to add more widgets or fetch data from your API.",
      },
      {
        title: "Rendered At",
        description: ({ renderedAt }) => `The widget rendered at ${renderedAt} using dayjs formatting.`,
      },
    ],
  },
  ko: {
    headerTitle: "예시 위젯",
    headerDescription: "이 템플릿을 사용해 실제 위젯을 만들어 보세요.",
    previewDescription: "위젯 제작 방식을 보여주는 예시 템플릿이에요.",
    highlights: [
      {
        title: "시작하기",
        description: () => "이 위젯은 front/apps/plugins 경로에 있으며 initializeWidgets()로 등록돼요.",
      },
      {
        title: "시간 범위",
        description: ({ timeRange }) => `대시보드가 요청한 기간은 ${timeRange} 입니다. 실제 분석 데이터로 바꿔 보세요.`,
      },
      {
        title: "다음 단계",
        description: () => "이 컴포넌트를 복제해 더 많은 위젯을 만들거나 API에서 데이터를 불러올 수 있어요.",
      },
      {
        title: "렌더링 시점",
        description: ({ renderedAt }) => `이 위젯은 dayjs 포맷으로 ${renderedAt} 에 렌더링됐어요.`,
      },
    ],
  },
}

export function resolveExampleLanguage(language?: string): ExampleLanguage {
  return language?.toLowerCase() === "ko" ? "ko" : "en"
}

export function getExampleCopy(language?: string): ExampleCopy {
  return exampleCopy[resolveExampleLanguage(language)]
}
