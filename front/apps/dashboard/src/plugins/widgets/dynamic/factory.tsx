import { useEffect, useMemo, useState } from "react"

import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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

  return (
    <>
      <CardHeader className="pb-2">
        <CardTitle>{spec.title}</CardTitle>
        {spec.description && <CardDescription>{spec.description}</CardDescription>}
      </CardHeader>
      <CardContent className="pt-2" style={{ minHeight: 220 }}>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!error && isLoading && <p className="text-sm text-muted-foreground">{stateCopy.loading}</p>}
        {!error && !isLoading && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">{stateCopy.noData}</p>
        )}
        {!error && !isLoading && rows.length > 0 && (
          <DynamicChart
            chartType={chartType}
            chart={chartConfig}
            data={rowSeries}
            formatHint={chartConfig.value_format}
          />
        )}
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
}: {
  chartType: DynamicChartType
  data: SeriesResult
  chart: DynamicChartConfig
  formatHint?: string | null
}) {
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
          <XAxis dataKey="label" stroke="hsl(var(--border))" />
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
          <XAxis dataKey="label" stroke="hsl(var(--border))" />
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
        <XAxis dataKey="label" stroke="hsl(var(--border))" />
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
