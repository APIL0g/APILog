import { useEffect, useMemo, useState } from "react"
import { CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import type { WidgetMeta, WidgetProps } from "@/core/registry"
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "@/lib/recharts"
import { getCommonWidgetCopy } from "../i18n"
import { getCountryShareCopy } from "./locales"
import previewImage from "./preview.png"

type Row = { code: string; label: string; sessions: number }
type ApiResponse = { rows?: Row[]; total?: number }

const API_BASE = ""
const DEFAULT_RANGE = "7d"

async function fetchCountryShare(range: string, top = 5, signal?: AbortSignal): Promise<{ rows: Row[]; total: number }> {
  const url = `${API_BASE}/api/query/country-share?range=${encodeURIComponent(range)}&top=${top}`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(await res.text())
  const data: ApiResponse = await res.json()
  const rows = Array.isArray(data?.rows) ? data.rows : []
  const total = typeof data?.total === "number" ? data.total : rows.reduce((sum, r) => sum + (r.sessions || 0), 0)
  return {
    rows: rows.map((row, idx) => ({
      code: row?.code || `UNKNOWN-${idx}`,
      label: row?.label || row?.code || "",
      sessions: Number(row?.sessions || 0),
    })),
    total,
  }
}

export default function CountryShareWidget({ timeRange: _timeRange, language }: WidgetProps) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [total, setTotal] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)
  const effectiveRange = DEFAULT_RANGE
  const common = getCommonWidgetCopy(language)
  const copy = getCountryShareCopy(language)

  useEffect(() => {
    const controller = new AbortController()
    setRows(null)
    setError(null)
    fetchCountryShare(effectiveRange, 5, controller.signal)
      .then((res) => {
        setRows(res.rows)
        setTotal(res.total)
      })
      .catch((e) => {
        if ((e as Error)?.name === "AbortError") return
        setError(String(e))
      })
    return () => {
      controller.abort()
    }
  }, [effectiveRange])

  const chartData = useMemo(
    () =>
      (rows ?? []).map((row) => ({
        name: row.label || row.code || copy.unknownLabel,
        code: row.code,
        value: row.sessions || 0,
      })),
    [rows, copy],
  )

  const totalSessions = useMemo(() => (rows ? total || rows.reduce((sum, r) => sum + r.sessions, 0) : 0), [rows, total])

  const COLORS = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
    "var(--chart-6)",
  ]

  return (
    <>
      <CardHeader className="mb-2 md:mb-3">
        <CardTitle>{copy.title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-3 md:pt-4" style={{ height: 270 }}>
        {error && <div className="text-sm md:text-base text-red-500">{common.errorPrefix}: {error}</div>}
        {!rows && !error && <div className="text-sm md:text-base text-muted-foreground">{common.loading}</div>}
        {rows && rows.length === 0 && <div className="text-sm md:text-base text-muted-foreground">{common.noData}</div>}

        {rows && rows.length > 0 && (
          <div className="flex h-full gap-3">
            <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip formatter={(value: any, name: any) => [value, name]} />
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={100}
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

            <div className="flex-1">
              <div className="h-full rounded-md border bg-background/70 p-3 shadow-sm text-sm md:text-base">
                <div className="space-y-1.5">
                  {chartData.map((d, idx) => {
                    const pct = totalSessions ? Math.round(((d.value as number) / totalSessions) * 100) : 0
                    const code = d.code || ""
                    const display =
                      code === "OTHERS"
                        ? copy.othersLabel
                        : code.startsWith("UNKNOWN")
                          ? copy.unknownLabel
                          : d.name || copy.unknownLabel
                    return (
                      <div key={`legend-${idx}`} className="flex items-center justify-between leading-6">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]"
                            style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                          />
                          <span className="truncate text-muted-foreground">
                            {display}
                          </span>
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

const countryShareLocales = {
  en: getCountryShareCopy("en"),
  ko: getCountryShareCopy("ko"),
}

export const widgetMeta: WidgetMeta = {
  id: "country_share",
  name: "Sessions by Country",
  description: "Top countries by session share (pie)",
  defaultWidth: 520,
  defaultHeight: 300,
  previewImage,
  tags: ["audience"],
  localizations: {
    en: {
      title: countryShareLocales.en.title,
      previewDescription: countryShareLocales.en.previewDescription,
    },
    ko: {
      title: countryShareLocales.ko.title,
      previewDescription: countryShareLocales.ko.previewDescription,
    },
  },
}

