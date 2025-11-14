import { CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Sparkles } from "@/components/icons"
import type { WidgetMeta, WidgetProps } from "@/core/registry"
import dayjs from "dayjs"
import { exampleCopy, getExampleCopy, resolveExampleLanguage } from "./locales"
import previewImage from "./preview.png"

// Example widget showcasing how to build custom plugin widgets
export default function ExampleWidget({ timeRange, language }: WidgetProps) {
  const renderedAt = dayjs().format("YYYY-MM-DD HH:mm:ss")
  const copy = exampleCopy[resolveExampleLanguage(language)]
  const highlights = copy.highlights.map((item) => ({
    title: item.title,
    description: item.description({ timeRange, renderedAt }),
  }))

  return (
    <>
      <CardHeader className="flex-row items-center gap-3">
        <div className="rounded-full bg-primary/10 p-2">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <div>
          <CardTitle>{copy.headerTitle}</CardTitle>
          <CardDescription>{copy.headerDescription}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {highlights.map((item) => (
          <div key={item.title} className="rounded-lg border border-dashed border-border bg-muted/40 p-4">
            <p className="text-sm font-semibold">{item.title}</p>
            <p className="text-sm text-muted-foreground">{item.description}</p>
          </div>
        ))}
      </CardContent>
    </>
  )
}

const exampleLocales = {
  en: getExampleCopy("en"),
  ko: getExampleCopy("ko"),
}

export const widgetMeta: WidgetMeta = {
  id: "example",
  name: "Example Widget",
  description: "Starter widget registered automatically from the plugins directory.",
  defaultWidth: 520,
  defaultHeight: 300,
  previewImage,
  tags: ["samples"],
  localizations: {
    en: {
      title: exampleLocales.en.headerTitle,
      previewDescription: exampleLocales.en.previewDescription,
    },
    ko: {
      title: exampleLocales.ko.headerTitle,
      previewDescription: exampleLocales.ko.previewDescription,
    },
  },
}

