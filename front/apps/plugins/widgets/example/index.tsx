import { CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Sparkles } from "@/components/icons"
import type { WidgetMeta, WidgetProps } from "@/core/registry"
import dayjs from "dayjs"

// Example widget showcasing how to build custom plugin widgets
export default function ExampleWidget({ timeRange }: WidgetProps) {
  const renderedAt = dayjs().format("YYYY-MM-DD HH:mm:ss")

  const highlights = [
    {
      title: "Getting Started",
      description: "This widget lives in front/apps/plugins and is registered through initializeWidgets().",
    },
    {
      title: "Time Range",
      description: `The dashboard requested data for ${timeRange}. Replace this with real analytics data.`,
    },
    {
      title: "Next Steps",
      description: "Clone this component to add more widgets or fetch data from your API.",
    },
    {
      title: "Rendered At",
      description: `The widget rendered at ${renderedAt} using dayjs formatting.`,
    },
  ]

  return (
    <>
      <CardHeader className="flex-row items-center gap-3">
        <div className="rounded-full bg-primary/10 p-2">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <div>
          <CardTitle>Example Widget</CardTitle>
          <CardDescription>Use this as a template for building real widgets.</CardDescription>
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

export const widgetMeta: WidgetMeta = {
  id: "example",
  name: "Example Widget",
  description: "Starter widget registered automatically from the plugins directory.",
  defaultWidth: 420,
  defaultHeight: 320,
}
