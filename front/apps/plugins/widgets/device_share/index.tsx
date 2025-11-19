import { useEffect, useMemo, useState } from "react"
import { CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import type { WidgetMeta, WidgetProps } from "@/core/registry"
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "@/lib/recharts"
import { getCommonWidgetCopy } from "../i18n"
import { getDeviceShareCopy } from "./locales"
import previewImage from "./preview.png"

type Row = { device: string; sessions: number; pct?: number }

const API_BASE = ""

function parseDays(range?: string): number {
  if (!range) return 7
  // accepts forms like "7d", "14d", or numeric string
  const m = /^\s*(\d+)\s*d?\s*$/i.exec(range)
  const n = m ? parseInt(m[1], 10) : NaN
  return Number.isFinite(n) && n > 0 ? n : 7
}

async function fetchDeviceShare(days: number, limit: number): Promise<Row[]> {
  const url = `${API_BASE}/api/query/device-share?days=${days}&limit=${limit}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(await res.text())
  const data = await res.json()
  return data?.rows ?? []
}

export default function DeviceShareWidget({ timeRange, language, containerSize }: WidgetProps) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const common = getCommonWidgetCopy(language)
  const copy = getDeviceShareCopy(language)

  const days = useMemo(() => parseDays(timeRange), [timeRange])
  const limit = 3

  useEffect(() => {
    let alive = true
    setRows(null)
    setError(null)
    fetchDeviceShare(days, limit)
      .then((r) => {
        if (alive) setRows(r)
      })
      .catch((e) => {
        if (alive) setError(String(e))
      })
    return () => {
      alive = false
    }
  }, [days, limit])

  const total = useMemo(
    () => (rows ?? []).reduce((acc, r) => acc + (r.sessions || 0), 0),
    [rows],
  )

  const chartData = useMemo(
    () =>
      (rows ?? []).map((r, i) => ({
        name: r.device || copy.unknownLabel(i + 1),
        value: r.sessions || 0,
        pct: typeof r.pct === 'number' ? r.pct : 0,
      })),
    [rows, copy],
  )

  // Theme chart colors
  const COLORS = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
  ]

  const containerWidth = containerSize?.width ?? 0
  const containerHeight = containerSize?.height ?? 0
  const headerReserve = 120
  const bodyHeight = containerHeight > headerReserve ? containerHeight - headerReserve : containerHeight
  const MIN_CHART_HEIGHT = 150
  const MIN_LIST_HEIGHT = 110
  const SECTION_GAP = 16
  const fallbackStacked = { chart: 280, list: 180 }
  const stackedHeights = useMemo(() => {
    if (!bodyHeight || bodyHeight <= SECTION_GAP) return fallbackStacked
    const effective = Math.max(bodyHeight - SECTION_GAP, 0)
    if (effective <= 0) return fallbackStacked
    const minTotal = MIN_CHART_HEIGHT + MIN_LIST_HEIGHT
    if (effective >= minTotal) {
      const maxChart = effective - MIN_LIST_HEIGHT
      const preferred = effective * 0.55
      const chart = Math.max(MIN_CHART_HEIGHT, Math.min(maxChart, preferred))
      return { chart, list: effective - chart }
    }
    const ratio = MIN_CHART_HEIGHT / minTotal
    const chart = Math.max(70, effective * ratio)
    const list = Math.max(50, effective - chart)
    return { chart, list }
  }, [bodyHeight])
  const rowHeight = bodyHeight && bodyHeight > 0 ? bodyHeight : Math.max(fallbackStacked.chart, fallbackStacked.list)
  const showSideBySide = containerWidth >= 600 && rowHeight >= MIN_CHART_HEIGHT + 40
  const chartAreaHeight = showSideBySide ? rowHeight : stackedHeights.chart
  const listAreaHeight = showSideBySide ? rowHeight : stackedHeights.list

  return (
    <>
      <CardHeader className="mb-2 md:mb-3">
        <CardTitle>{copy.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4 overflow-hidden pt-3 md:pt-4">
        {error && <div className="text-sm md:text-base text-red-500">{common.errorPrefix}: {error}</div>}
        {!rows && !error && <div className="text-sm md:text-base text-muted-foreground">{common.loading}</div>}
        {rows && rows.length === 0 && (
          <div className="text-sm md:text-base text-muted-foreground">{common.noData}</div>
        )}

        {rows && rows.length > 0 && (
          <div
            className={`flex flex-1 min-h-0 gap-4 ${showSideBySide ? "flex-row" : "flex-col"}`}
          >
            {/* Chart */}
            <div
              className={`${showSideBySide ? "flex-1" : ""} min-w-0`}
              style={{ height: chartAreaHeight }}
            >
              <ResponsiveContainer width="100%" height={chartAreaHeight}>
                <PieChart margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                  <Tooltip formatter={(value: any, name: any) => [value, name]} />
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="50%"
                    outerRadius="85%"
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

            {/* Breakdown */}
            <div
              className={`${showSideBySide ? "flex-1" : ""} min-w-0`}
              style={{ height: listAreaHeight }}
            >
              <div className="h-full w-full rounded-md border bg-background/70 p-3 shadow-sm text-sm md:text-base">
                <div className="space-y-1">
                  {chartData.map((d, idx) => {
                    const pct = d.pct && d.pct > 0
                      ? Math.round(d.pct)
                      : (total ? Math.round(((d.value as number) / total) * 100) : 0)
                    return (
                      <div key={`legend-${idx}`} className="flex items-center justify-between leading-5 px-2">
                        <div className="flex items-center gap-1 min-w-0 flex-grow">
                          <span
                            className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]"
                            style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                          />
                          <span className="truncate text-muted-foreground ml-1">{d.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground tabular-nums w-8 text-right">{d.value}</span>
                          <span className="font-mono tabular-nums">{pct}%</span>
                        </div>
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

const deviceShareLocales = {
  en: getDeviceShareCopy("en"),
  ko: getDeviceShareCopy("ko"),
}

export const widgetMeta: WidgetMeta = {
  id: "device_share",
  name: "Device Share",
  description: "디바이스 유형별 사용자 수와 비중(원형 그래프)",
  defaultWidth: 520,
  defaultHeight: 300,
  previewImage,
  tags: ["audience"],
  localizations: {
    en: {
      title: deviceShareLocales.en.title,
      previewDescription: deviceShareLocales.en.previewDescription,
    },
    ko: {
      title: deviceShareLocales.ko.title,
      previewDescription: deviceShareLocales.ko.previewDescription,
    },
  },
}

