import { useEffect, useMemo, useState } from "react"

import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import type { WidgetComponent, WidgetProps } from "@/core/registry"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  LabelList,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from "@/lib/recharts"
import { AlertTriangle, Info } from "lucide-react"

import { fetchDynamicWidgetData } from "./api"
import type {
  DynamicChartConfig,
  DynamicWidgetData,
  DynamicWidgetSpec,
  DynamicChartType,
  DynamicWidgetDataParams,
} from "./types"
import { registerWidget } from "@/core/registry"

const COLOR_PALETTE = [
  "#2563eb",
  "#7c3aed",
  "#f97316",
  "#06b6d4",
  "#22c55e",
  "#f43f5e",
  "#a855f7",
  "#0ea5e9",
  "#fde047",
  "#10b981",
]

const SIZE_BY_TYPE: Record<DynamicChartType, { width: number; height: number }> = {
  line: { width: 520, height: 360 },
  area: { width: 520, height: 360 },
  bar: { width: 520, height: 360 },
  pie: { width: 420, height: 360 },
  table: { width: 520, height: 420 },
  metric: { width: 360, height: 220 },
}

type DataRow = Record<string, unknown> & { label?: string; rawX?: unknown }

interface SeriesResult {
  data: DataRow[]
  seriesKeys: string[]
}

interface DynamicWidgetRendererProps extends WidgetProps {
  spec: DynamicWidgetSpec
}

export function dynamicWidgetTypeFromSpecId(specId: string): string {
  return `dynamic:${specId}`
}

export function registerDynamicWidget(spec: DynamicWidgetSpec): string {
  const widgetType = dynamicWidgetTypeFromSpecId(spec.id)
  const component = createDynamicWidgetComponent(spec)
  const chartType = spec.chart?.type ?? "line"
  const defaults = SIZE_BY_TYPE[chartType as DynamicChartType] ?? SIZE_BY_TYPE.line
  registerWidget(widgetType, component, {
    id: widgetType,
    name: spec.title,
    description: spec.description,
    defaultWidth: defaults.width,
    defaultHeight: defaults.height,
    defaultConfig: {
      siteId: spec.site_id ?? undefined,
    },
  })
  return widgetType
}

export function createDynamicWidgetComponent(spec: DynamicWidgetSpec): WidgetComponent {
  const DynamicWidget = (props: WidgetProps) => <DynamicWidgetRenderer spec={spec} {...props} />
  DynamicWidget.displayName = `DynamicWidget(${spec.id})`
  return DynamicWidget
}

function DynamicWidgetRenderer({ spec, config, language }: DynamicWidgetRendererProps) {
  const [data, setData] = useState<DynamicWidgetData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  const queryParams = useMemo<DynamicWidgetDataParams>(() => {
    const bucket = typeof config?.bucket === "string" ? config.bucket : undefined
    return {
      from: typeof config?.from === "string" ? config.from : undefined,
      to: typeof config?.to === "string" ? config.to : undefined,
      bucket: bucket ?? (typeof spec.meta?.bucket === "string" ? (spec.meta.bucket as string) : undefined),
      siteId: typeof config?.siteId === "string" ? config.siteId : spec.site_id ?? undefined,
    }
  }, [config?.bucket, config?.from, config?.siteId, config?.to, spec.meta?.bucket, spec.site_id])

  const queryKey = useMemo(() => JSON.stringify(queryParams), [queryParams])

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)
    fetchDynamicWidgetData(spec.id, queryParams)
      .then((payload) => {
        if (cancelled) return
        setData(payload)
        setIsLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : String(err))
        setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [queryKey, spec.id])

  const rows = data?.rows ?? []
  const chartConfig = spec.chart ?? { type: "line", x: "t", y: "v" }
  const chartType = (chartConfig.type ?? "line") as DynamicChartType
  const rowSeries = useMemo(() => buildSeries(rows, chartConfig), [rows, chartConfig])
  const stateCopy = buildCommonCopy(language)
  const chartLabel = formatChartType(chartType)
  const siteLabel = formatSiteLabel(
    ensureString(queryParams.siteId) ?? ensureString(spec.site_id) ?? ensureString(data?.meta?.site_id),
  )
  const rangeLabel = formatRangeLabel(ensureString(data?.meta?.from), ensureString(data?.meta?.to))
  const bucketLabel = formatBucketLabel(
    ensureString(data?.meta?.bucket) ?? ensureString(spec.meta?.bucket) ?? ensureString(queryParams.bucket),
  )

  return (
    <>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold md:text-lg">{spec.title}</CardTitle>
            {spec.description && (
              <CardDescription className="text-sm text-muted-foreground line-clamp-2">
                {spec.description}
              </CardDescription>
            )}
          </div>
          <Badge variant="secondary" className="uppercase tracking-wide text-[10px] md:text-xs">
            {chartLabel}
          </Badge>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
          {rangeLabel && <MetaBadge label="Range" value={rangeLabel} />}
          {bucketLabel && <MetaBadge label="Bucket" value={bucketLabel} />}
          {siteLabel && <MetaBadge label="Site" value={siteLabel} />}
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="space-y-4">
          {error && (
            <StateMessage
              variant="error"
              title="데이터를 불러오지 못했습니다"
              description={error}
            />
          )}
          {!error && isLoading && (
            <div className="rounded-xl border border-dashed bg-muted/20 p-6">
              <Skeleton className="h-48 w-full rounded-lg" />
            </div>
          )}
          {!error && !isLoading && rows.length === 0 && (
            <StateMessage
              variant="muted"
              title={stateCopy.noData}
              description="조건을 바꾸거나 다른 기간을 선택해 보세요."
            />
          )}
          {!error && !isLoading && rows.length > 0 && (
            <div className="rounded-xl border bg-background/70 p-2 md:p-3">
              <DynamicChart
                chartType={chartType}
                chart={chartConfig}
                data={rowSeries}
                formatHint={chartConfig.value_format}
                language={language}
              />
            </div>
          )}
        </div>
      </CardContent>
    </>
  )
}

function buildSeries(rows: Array<Record<string, unknown>>, chart: DynamicChartConfig): SeriesResult {
  const xField = chart.x || "t"
  const yField = chart.y || "v"
  const seriesField = chart.series_field || undefined
  const map = new Map<string, DataRow>()
  const seriesSet = new Set<string>()

  rows.forEach((row) => {
    const xValue = row[xField]
    const label = formatLabel(xValue)
    const key = typeof xValue === "string" ? xValue : label
    if (!map.has(key)) {
      map.set(key, { label, rawX: xValue })
    }
    const entry = map.get(key)!
    const numericValue = toNumber(row[yField])
    if (seriesField) {
      const seriesName = formatLabel(row[seriesField]) || "value"
      entry[seriesName] = numericValue
      seriesSet.add(seriesName)
    } else {
      entry.value = numericValue
    }
  })

  const data = Array.from(map.values()).sort((a, b) => compareRawValues(a.rawX, b.rawX))
  const seriesKeys = seriesField ? Array.from(seriesSet) : ["value"]
  return { data, seriesKeys }
}

function compareRawValues(a: unknown, b: unknown) {
  const aTs = Date.parse(String(a ?? ""))
  const bTs = Date.parse(String(b ?? ""))
  if (!Number.isNaN(aTs) && !Number.isNaN(bTs)) {
    return aTs - bTs
  }
  return String(a ?? "").localeCompare(String(b ?? ""))
}

function formatLabel(value: unknown): string {
  if (value == null) return "n/a"
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function formatValue(value: unknown, formatHint?: string | null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return String(value ?? "")
  }
  switch (formatHint) {
    case "percent":
      return `${(value * 100).toFixed(1)}%`
    case "duration_ms":
      return `${value.toLocaleString()} ms`
    case "currency":
      return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 1 }).format(
        value,
      )
    default:
      return value.toLocaleString()
  }
}

function DynamicChart({
  chartType,
  data,
  chart,
  formatHint,
  language,
}: {
  chartType: DynamicChartType
  data: SeriesResult
  chart: DynamicChartConfig
  formatHint?: string | null
  language?: string
}) {
  const axisTicks = useMemo(() => buildAxisTicks(data.data), [data.data])

  if (chartType === "table") {
    return <DynamicTable data={data.data} />
  }
  if (chartType === "metric") {
    const first = data.data[0]
    const key = data.seriesKeys[0]
    return (
      <div className="flex h-full flex-col items-start justify-center gap-2">
        <p className="text-sm text-muted-foreground">{chart.title ?? chart.y ?? "Value"}</p>
        <p className="text-4xl font-semibold">{formatValue(first?.[key], formatHint)}</p>
      </div>
    )
  }

  if (chartType === "pie") {
    return (
      <ResponsiveContainer width="100%" height={320}>
        <PieChart>
          <Tooltip formatter={(value: unknown) => formatValue(value, formatHint)} />
          <Legend />
          <Pie data={data.data} dataKey={data.seriesKeys[0]} nameKey="label" outerRadius={120}>
            {data.data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLOR_PALETTE[index % COLOR_PALETTE.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    )
  }

  if (chartType === "bar") {
    return (
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data.data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="label"
            stroke="hsl(var(--border))"
            ticks={axisTicks}
            tickFormatter={(value) => formatAxisLabel(value, language)}
          />
          <YAxis stroke="hsl(var(--border))" />
          <Tooltip formatter={(value: unknown) => formatValue(value, formatHint)} />
          <Legend />
          {data.seriesKeys.map((seriesKey, index) => (
            <Bar key={seriesKey} dataKey={seriesKey} fill={COLOR_PALETTE[index % COLOR_PALETTE.length]} radius={[4, 4, 0, 0]}>
              <LabelList position="top" formatter={(value: unknown) => formatValue(value, formatHint)} />
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    )
  }

  if (chartType === "area") {
    return (
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={data.data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="label"
            stroke="hsl(var(--border))"
            ticks={axisTicks}
            tickFormatter={(value) => formatAxisLabel(value, language)}
          />
          <YAxis stroke="hsl(var(--border))" />
          <Tooltip formatter={(value: unknown) => formatValue(value, formatHint)} />
          <Legend />
          {data.seriesKeys.map((seriesKey, index) => (
            <Area
              key={seriesKey}
              type="monotone"
              dataKey={seriesKey}
              stroke={COLOR_PALETTE[index % COLOR_PALETTE.length]}
              fill={COLOR_PALETTE[index % COLOR_PALETTE.length]}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data.data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="label"
          stroke="hsl(var(--border))"
          ticks={axisTicks}
          tickFormatter={(value) => formatAxisLabel(value, language)}
        />
        <YAxis stroke="hsl(var(--border))" />
        <Tooltip formatter={(value: unknown) => formatValue(value, formatHint)} />
        <Legend />
        {data.seriesKeys.map((seriesKey, index) => (
          <Line
            key={seriesKey}
            type="monotone"
            dataKey={seriesKey}
            stroke={COLOR_PALETTE[index % COLOR_PALETTE.length]}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

function DynamicTable({ data }: { data: DataRow[] }) {
  if (data.length === 0) return null
  const columns = Array.from(
    data.reduce((set, row) => {
      Object.keys(row).forEach((key) => {
        if (key !== "rawX") {
          set.add(key)
        }
      })
      return set
    }, new Set<string>()),
  )
  return (
    <div className="max-h-80 overflow-auto rounded border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-3 py-2 font-medium">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={idx} className="border-t border-border/60">
              {columns.map((column) => (
                <td key={column} className="px-3 py-2">
                  {String(row[column] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function buildCommonCopy(language?: string) {
  if (language === "ko") {
    return {
      loading: "데이터를 불러오는 중...",
      noData: "표시할 데이터가 없습니다.",
    }
  }
  return {
    loading: "Loading data...",
    noData: "No data available.",
  }
}

function MetaBadge({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-background/80 px-2 py-0.5 text-[10px] uppercase tracking-wide">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium normal-case text-foreground">{value}</span>
    </span>
  )
}

function buildAxisTicks(rows: DataRow[]): Array<string | number> | undefined {
  const seen = new Set<string>()
  const ticks: Array<string | number> = []
  rows.forEach((row) => {
    const raw = row.rawX ?? row.label
    const rawString = raw == null ? undefined : String(raw)
    const ts = Date.parse(rawString ?? "")
    if (Number.isNaN(ts)) {
      return
    }
    const date = new Date(ts)
    const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`
    if (seen.has(key)) {
      return
    }
    seen.add(key)
    let tickValue: string | number
    if (typeof raw === "number" && Number.isFinite(raw)) {
      tickValue = raw
    } else if (typeof row.label === "string" && row.label.length > 0) {
      tickValue = row.label
    } else if (rawString) {
      tickValue = rawString
    } else {
      tickValue = key
    }
    ticks.push(tickValue)
  })
  return ticks.length > 0 ? ticks : undefined
}

function formatAxisLabel(value: unknown, language?: string): string {
  if (typeof value === "number") {
    return Number.isFinite(value) ? `${value}` : ""
  }
  const str = ensureString(value)
  if (!str) return ""
  const parsed = new Date(str)
  if (!Number.isNaN(parsed.getTime())) {
    const month = `${parsed.getUTCMonth() + 1}`.padStart(2, "0")
    const day = `${parsed.getUTCDate()}`.padStart(2, "0")
    return `${month}/${day}`
  }
  return str.length > 18 ? `${str.slice(0, 16)}…` : str
}

function StateMessage({
  variant,
  title,
  description,
}: {
  variant: "error" | "muted"
  title: string
  description?: string
}) {
  const Icon = variant === "error" ? AlertTriangle : Info
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border p-4 ${
        variant === "error" ? "border-destructive/40 bg-destructive/5 text-destructive" : "border-muted bg-muted/20 text-muted-foreground"
      }`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="space-y-1 text-sm">
        <p className="font-medium">{title}</p>
        {description && <p className="text-xs leading-relaxed">{description}</p>}
      </div>
    </div>
  )
}

function formatChartType(type: DynamicChartType): string {
  switch (type) {
    case "bar":
      return "Bar"
    case "pie":
      return "Pie"
    case "table":
      return "Table"
    case "metric":
      return "Metric"
    case "area":
      return "Area"
    default:
      return "Line"
  }
}

function formatRangeLabel(from?: string, to?: string): string | undefined {
  if (!from || !to) return undefined
  const start = new Date(from)
  const end = new Date(to)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return undefined
  const formatter = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  })
  return `${formatter.format(start)} - ${formatter.format(end)}`
}

function formatBucketLabel(bucket?: string): string | undefined {
  if (!bucket) return undefined
  const match = bucket.match(/(\d+)([smhd])/i)
  if (!match) return bucket
  const value = match[1]
  const unit = match[2].toLowerCase()
  const label = { s: "sec", m: "min", h: "hour", d: "day" }[unit] ?? unit
  return `${value} ${label}`
}

function formatSiteLabel(site?: string | null): string | undefined {
  if (!site || site === "none") return undefined
  return site
}

function ensureString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined
}
