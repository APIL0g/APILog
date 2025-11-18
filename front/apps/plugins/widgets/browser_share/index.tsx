import { useEffect, useMemo, useState } from "react"
import { CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import type { WidgetMeta, WidgetProps } from "@/core/registry"
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "@/lib/recharts"
import { getCommonWidgetCopy } from "../i18n"
import { getBrowserShareCopy } from "./locales"
import previewImage from "./preview.png"

type Row = { browser: string; sessions: number }

const API_BASE = ""
async function fetchBrowserShare(range: string, top = 10): Promise<Row[]> {
  const url = `${API_BASE}/api/query/browser-share?range=${encodeURIComponent(range)}&top=${top}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(await res.text())
  const data = await res.json()
  return data?.rows ?? []
}

export default function BrowserShareWidget({ timeRange, language, containerSize }: WidgetProps) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const common = getCommonWidgetCopy(language)
  const copy = getBrowserShareCopy(language)

  useEffect(() => {
    let alive = true
    setRows(null)
    setError(null)
    fetchBrowserShare(timeRange || "7d", 10)
      .then((r) => {
        if (alive) setRows(r)
      })
      .catch((e) => {
        if (alive) setError(String(e))
      })
    return () => {
      alive = false
    }
  }, [timeRange])

  const total = useMemo(() => (rows ?? []).reduce((acc, r) => acc + (r.sessions || 0), 0), [rows])
  const chartData = useMemo(
    () =>
      (rows ?? []).map((r, i) => ({
        name: r.browser || copy.unknownLabel(i + 1),
        value: r.sessions || 0,
      })),
    [rows, copy],
  )

  // Use theme chart colors
  const COLORS = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
  ]

  const containerWidth = containerSize?.width ?? 0
  const containerHeight = containerSize?.height ?? 0
  const isCompactLayout = !containerWidth || containerWidth < 520
  const headerReserve = 96
  const bodyHeight = containerHeight > headerReserve ? containerHeight - headerReserve : containerHeight
  const MIN_CHART_HEIGHT = 160
  const MIN_LEGEND_HEIGHT = 120
  const SECTION_GAP = 20
  const fallbackStacked = { chart: 300, legend: 200 }
  const stackedHeights = useMemo(() => {
    if (!bodyHeight || bodyHeight <= SECTION_GAP) return fallbackStacked
    const effective = Math.max(bodyHeight - SECTION_GAP, 0)
    if (effective <= 0) return fallbackStacked
    const minTotal = MIN_CHART_HEIGHT + MIN_LEGEND_HEIGHT
    if (effective >= minTotal) {
      const maxChart = effective - MIN_LEGEND_HEIGHT
      const preferred = effective * 0.6
      const chart = Math.max(MIN_CHART_HEIGHT, Math.min(maxChart, preferred))
      return { chart, legend: effective - chart }
    }
    const ratio = MIN_CHART_HEIGHT / minTotal
    const chart = Math.max(80, effective * ratio)
    const legend = Math.max(60, effective - chart)
    return { chart, legend }
  }, [bodyHeight])
  const rowHeight = bodyHeight && bodyHeight > 0 ? bodyHeight : Math.max(fallbackStacked.chart, fallbackStacked.legend)
  const chartHeight = isCompactLayout ? stackedHeights.chart : rowHeight
  const legendHeight = isCompactLayout ? stackedHeights.legend : rowHeight

  return (
    <>
      <CardHeader className="mb-2 md:mb-3">
        <CardTitle>{copy.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4 pt-3 md:pt-4 overflow-hidden">
        {error && <div className="text-sm md:text-base text-red-500">{common.errorPrefix}: {error}</div>}
        {!rows && !error && <div className="text-sm md:text-base text-muted-foreground">{common.loading}</div>}
        {rows && rows.length === 0 && (
          <div className="text-sm md:text-base text-muted-foreground">{common.noData}</div>
        )}

        {rows && rows.length > 0 && (
          <div className={`flex flex-1 min-h-0 gap-4 ${isCompactLayout ? "flex-col" : "flex-row"}`}>
            <div
              className={`${isCompactLayout ? "" : "flex-1"} min-w-0`}
              style={{ height: chartHeight }}
            >
              <ResponsiveContainer width="100%" height={chartHeight}>
                <PieChart>
                  <Tooltip formatter={(value: any, name: any) => [value, name]} />
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="45%"
                    outerRadius="80%"
                    paddingAngle={2}
                    isAnimationActive={false}
                    label={false}
                  >
                    {chartData.map((_, idx) => (
                      <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className={`${isCompactLayout ? "" : "flex-1"} min-w-0`} style={{ height: legendHeight }}>
              <div className="h-full rounded-md border bg-background/70 p-3 shadow-sm text-sm md:text-base">
                <div className="space-y-1.5">
                  {chartData.map((d, idx) => {
                    const pct = total ? Math.round(((d.value as number) / total) * 100) : 0
                    return (
                      <div key={`legend-${idx}`} className="flex items-center justify-between leading-6">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]"
                            style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                          />
                          <span className="truncate text-muted-foreground">{d.name}</span>
                        </div>
                        <span className="font-mono tabular-nums">{pct}%</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </>
  )
}
const browserShareLocales = {
  en: getBrowserShareCopy("en"),
  ko: getBrowserShareCopy("ko"),
}

export const widgetMeta: WidgetMeta = {
  id: "browser_share",
  name: "Browser Share",
  description: "원형(도넛) 차트로 브라우저별 세션 비율",
  defaultWidth: 520,
  defaultHeight: 300,
  minWidth: 420,
  minHeight: 320,
  relaxedMinHeight: 200,
  relaxedMinHeightBreakpointCols: 6,
  previewImage,
  tags: ["audience"],
  localizations: {
    en: {
      title: browserShareLocales.en.title,
      previewDescription: browserShareLocales.en.previewDescription,
    },
    ko: {
      title: browserShareLocales.ko.title,
      previewDescription: browserShareLocales.ko.previewDescription,
    },
  },
}
