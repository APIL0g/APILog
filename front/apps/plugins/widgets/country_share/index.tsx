import { useEffect, useMemo, useState } from "react"
import { CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import type { WidgetMeta, WidgetProps } from "@/core/registry"
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "@/lib/recharts"

type Row = { code: string; label: string; sessions: number }
type ApiResponse = { rows?: Row[]; total?: number }

const API_BASE = ""

async function fetchCountryShare(range: string, top = 5): Promise<{ rows: Row[]; total: number }> {
  const url = `${API_BASE}/api/query/country-share?range=${encodeURIComponent(range)}&top=${top}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(await res.text())
  const data: ApiResponse = await res.json()
  const rows = Array.isArray(data?.rows) ? data.rows : []
  const total = typeof data?.total === "number" ? data.total : rows.reduce((sum, r) => sum + (r.sessions || 0), 0)
  return {
    rows: rows.map((row, idx) => ({
      code: row?.code || `UNKNOWN-${idx}`,
      label: row?.label || row?.code || "Unknown",
      sessions: Number(row?.sessions || 0),
    })),
    total,
  }
}

export default function CountryShareWidget({ timeRange }: WidgetProps) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [total, setTotal] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setRows(null)
    setError(null)
    fetchCountryShare(timeRange || "7d", 5)
      .then((res) => {
        if (!alive) return
        setRows(res.rows)
        setTotal(res.total)
      })
      .catch((e) => {
        if (alive) setError(String(e))
      })
    return () => {
      alive = false
    }
  }, [timeRange])

  const chartData = useMemo(
    () =>
      (rows ?? []).map((row) => ({
        name: row.label || row.code || "Unknown",
        code: row.code,
        value: row.sessions || 0,
      })),
    [rows],
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
        <CardTitle>Sessions by Country</CardTitle>
      </CardHeader>
      <CardContent className="pt-3 md:pt-4" style={{ height: 270 }}>
        {error && <div className="text-sm md:text-base text-red-500">Error: {error}</div>}
        {!rows && !error && <div className="text-sm md:text-base text-muted-foreground">Loading...</div>}
        {rows && rows.length === 0 && <div className="text-sm md:text-base text-muted-foreground">No data</div>}

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
                    const display = d.code === "UNKNOWN" ? "Unknown" : d.name
                    return (
                      <div key={`legend-${idx}`} className="flex items-center justify-between leading-6">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]"
                            style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                          />
                          <span className="truncate text-muted-foreground">
                            {d.code === "OTHERS" ? "Others" : display}
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

export const widgetMeta: WidgetMeta = {
  id: "country_share",
  name: "Sessions by Country",
  description: "Top countries by session share (pie)",
  defaultWidth: 620,
  defaultHeight: 360,
}
