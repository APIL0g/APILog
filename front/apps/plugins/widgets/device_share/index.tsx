import { useEffect, useMemo, useState } from "react"
import { CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import type { WidgetMeta, WidgetProps } from "@/core/registry"
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "@/lib/recharts"

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

export default function DeviceShareWidget({ timeRange }: WidgetProps) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)

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
        name: r.device || `Unknown ${i + 1}`,
        value: r.sessions || 0,
        pct: typeof r.pct === 'number' ? r.pct : 0,
      })),
    [rows],
  )

  // Theme chart colors
  const COLORS = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
  ]

  return (
    <>
      <CardHeader className="mb-2 md:mb-3">
        <CardTitle>Users by Device</CardTitle>
      </CardHeader>
      <CardContent className="pt-3 md:pt-4" style={{ height: 360 }}>
        {error && <div className="text-sm md:text-base text-red-500">Error: {error}</div>}
        {!rows && !error && <div className="text-sm md:text-base text-muted-foreground">Loading...</div>}
        {rows && rows.length === 0 && (
          <div className="text-sm md:text-base text-muted-foreground">No data</div>
        )}

        {rows && rows.length > 0 && (
          <div className="flex h-full flex-col gap-1">
            {/* Top: Donut chart */}
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
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

            {/* Bottom: Wide rectangular panel for device breakdown */}
            <div className="h-28 w-full">
              <div className="h-full w-full rounded-md border bg-background/70 p-2 shadow-sm text-sm md:text-base">
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

export const widgetMeta: WidgetMeta = {
  id: "device_share",
  name: "Device Share",
  description: "디바이스 유형별 사용자 수와 비중(원형 그래프)",
  defaultWidth: 403,
  defaultHeight: 452,
}
