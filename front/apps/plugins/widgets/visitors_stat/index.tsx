import { useEffect, useMemo, useState } from "react"
import { CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import type { WidgetMeta, WidgetProps } from "@/core/registry"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from "@/lib/recharts"
import type { TooltipProps } from "recharts"
import { getCommonWidgetCopy } from "../i18n"
import { getVisitorsStatCopy } from "./locales"
import previewImage from "./preview.png"

interface VisitorHistoryEntry {
  date: string
  total_visitors: number
  new_visitors: number
  returning_visitors?: number
}

interface VisitorStatResponse extends VisitorHistoryEntry {
  history: VisitorHistoryEntry[]
}

const API_BASE = ""

function toIsoDate(value?: string): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const isoMatch = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed)
  return isoMatch ? isoMatch[1] : undefined
}

function coerceCount(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function normalizeDate(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const iso = toIsoDate(value)
  if (iso) return iso
  const parsed = new Date(value)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10)
  }
  return undefined
}

function normalizeEntry(input: any): VisitorHistoryEntry | null {
  const date = normalizeDate(input?.date) ?? null
  if (!date) return null
  const total = coerceCount(input?.total_visitors)
  const fresh = coerceCount(input?.new_visitors)
  const returningValue =
    typeof input?.returning_visitors !== "undefined"
      ? coerceCount(input?.returning_visitors)
      : Math.max(0, total - fresh)
  return {
    date,
    total_visitors: total,
    new_visitors: fresh,
    returning_visitors: returningValue,
  }
}

async function fetchVisitorStat(params: { date?: string; siteId?: string }): Promise<VisitorStatResponse> {
  const search = new URLSearchParams()
  if (params.date) search.set("date", params.date)
  if (params.siteId) search.set("site_id", params.siteId)

  const query = search.toString()
  const url = `${API_BASE}/api/query/visitor-stat${query ? `?${query}` : ""}`

  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(await res.text())
  }

  const data = await res.json()
  const current = normalizeEntry(data) ?? {
    date: new Date().toISOString().slice(0, 10),
    total_visitors: 0,
    new_visitors: 0,
    returning_visitors: 0,
  }

  const normalizedHistory = Array.isArray(data?.history)
    ? Array.from(
        data.history
          .map((entry: any) => normalizeEntry(entry))
          .filter((entry: VisitorHistoryEntry | null): entry is VisitorHistoryEntry => entry !== null)
          .reduce((acc, entry) => {
            acc.set(entry.date, entry)
            return acc
          }, new Map<string, VisitorHistoryEntry>())
          .values(),
      ).sort((a, b) => a.date.localeCompare(b.date))
    : []

  return {
    ...current,
    history: normalizedHistory,
  }
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value)
}

function formatDisplayDate(value?: string): string | undefined {
  if (!value) return undefined
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(parsed)
}

export default function VisitorStatWidget({ timeRange, config, language }: WidgetProps) {
  const [data, setData] = useState<VisitorStatResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const common = getCommonWidgetCopy(language)
  const copy = getVisitorsStatCopy(language)

  const typedConfig = config as { date?: string; siteId?: string; site_id?: string } | undefined
  const configuredDate = typedConfig?.date
  const configuredSiteId = typedConfig?.siteId ?? typedConfig?.site_id

  const resolvedDate = useMemo(() => {
    return toIsoDate(configuredDate) ?? toIsoDate(timeRange)
  }, [configuredDate, timeRange])

  useEffect(() => {
    let alive = true
    setError(null)
    setData(null)

    fetchVisitorStat({ date: resolvedDate, siteId: configuredSiteId })
      .then((payload) => {
        if (alive) setData(payload)
      })
      .catch((err) => {
        if (alive) setError(String(err))
      })

    return () => {
      alive = false
    }
  }, [resolvedDate, configuredSiteId])

  const returningVisitors = data?.returning_visitors ?? Math.max(0, (data?.total_visitors ?? 0) - (data?.new_visitors ?? 0))

  const displayDate = useMemo(() => formatDisplayDate(data?.date), [data])

  const chartData = useMemo(() => {
    if (!data?.history) return []
    return data.history.map((entry) => ({
      date: entry.date,
      label: entry.date.slice(5),
      total: entry.total_visitors,
      new: entry.new_visitors,
      returning: Math.max(0, (entry.returning_visitors ?? entry.total_visitors - entry.new_visitors)),
    }))
  }, [data])

  return (
    <>
      <CardHeader className="mb-2 md:mb-3">
        <CardTitle>{copy.title}</CardTitle>
        {data?.date && (
          <div className="text-xs text-muted-foreground md:text-sm">
            {displayDate ?? data.date}
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-3 md:pt-4">
        {error && <div className="text-sm text-red-500">{common.errorPrefix}: {error}</div>}
        {!data && !error && <div className="text-sm text-muted-foreground">{common.loading}</div>}
        {data && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric label={copy.metrics.total} value={formatNumber(data.total_visitors)} helper="" />
              <Metric
                label={copy.metrics.returning}
                value={formatNumber(returningVisitors)}
                helper=""
              />
              <Metric label={copy.metrics.new} value={formatNumber(data.new_visitors)} helper="" />
            </div>
            <div className="mt-6 h-64">
              {chartData.length === 0 ? (
                <div className="text-sm text-muted-foreground">{copy.noHistory}</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 16, right: 20, left: 4, bottom: 12 }}
                    style={{ color: "hsl(var(--foreground))" }}
                  >
                    <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.35} vertical={false} />
                    <XAxis
                      dataKey="label"
                      tickMargin={8}
                      stroke="hsl(var(--border))"
                      tick={{ fill: "currentColor", fontSize: 12 }}
                    />
                    <YAxis
                      stroke="hsl(var(--border))"
                      tick={{ fill: "currentColor", fontSize: 12 }}
                      tickFormatter={(value) => formatNumber(Number(value))}
                      allowDecimals={false}
                    />
                    <RechartsTooltip content={<HistoryTooltip />} />
                    <Line type="monotone" dataKey="total" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 3 }} name={copy.metrics.total} />
                    <Line type="monotone" dataKey="returning" stroke="var(--chart-2)" strokeWidth={2} dot={{ r: 3 }} name={copy.metrics.returning} />
                    <Line type="monotone" dataKey="new" stroke="var(--chart-3)" strokeWidth={2} dot={{ r: 3 }} name={copy.metrics.new} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </>
        )}
      </CardContent>
    </>
  )
}

function Metric({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="rounded-lg border bg-background/70 p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 text-3xl font-semibold tabular-nums text-foreground">{value}</div>
      {helper && <div className="mt-1 text-sm text-muted-foreground">{helper}</div>}
    </div>
  )
}

function HistoryTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null
  const datum = payload[0]?.payload as
    | { date: string; total: number; returning: number; new: number }
    | undefined
  if (!datum) return null

  const entries = payload
    .map((item) => {
      const key = item?.name ?? ""
      const value = typeof item?.value === "number" ? item.value : Number(item?.value ?? 0)
      return {
        key,
        value: Number.isFinite(value) ? value : 0,
        color: item?.color,
      }
    })
    .filter((item) => item.key)

  return (
    <div className="rounded-md border bg-background/90 p-3 text-xs shadow-sm backdrop-blur">
      <div className="font-medium text-muted-foreground">{formatDisplayDate(datum.date) ?? datum.date}</div>
      <div className="mt-2 space-y-1 text-foreground">
        {entries.map((entry) => (
          <div key={entry.key} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: entry.color ?? "currentColor" }} />
              {entry.key}
            </span>
            <span className="tabular-nums font-semibold">{formatNumber(entry.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const visitorsStatLocales = {
  en: getVisitorsStatCopy("en"),
  ko: getVisitorsStatCopy("ko"),
}

export const widgetMeta: WidgetMeta = {
  id: "visitor_stat",
  name: "Visitor Statistics",
  description: "Show total, returning, and new visitors with a 7-day trend chart",
  defaultWidth: 520,
  defaultHeight: 280,
  previewImage,
  tags: ["audience"],
  localizations: {
    en: {
      title: visitorsStatLocales.en.title,
      previewDescription: visitorsStatLocales.en.previewDescription,
    },
    ko: {
      title: visitorsStatLocales.ko.title,
      previewDescription: visitorsStatLocales.ko.previewDescription,
    },
  },
}

