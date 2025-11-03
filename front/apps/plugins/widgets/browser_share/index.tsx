import { useEffect, useMemo, useState } from "react"
import { CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import type { WidgetMeta, WidgetProps } from "@/core/registry"
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "@/lib/recharts"

type Row = { browser: string; sessions: number }

const API_BASE = ""
async function fetchBrowserShare(range: string, top = 10): Promise<Row[]> {
  const url = `${API_BASE}/api/query/browser-share?range=${encodeURIComponent(range)}&top=${top}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(await res.text())
  const data = await res.json()
  return data?.rows ?? []
}

export default function BrowserShareWidget({ timeRange }: WidgetProps) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)

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
        name: r.browser || `Unknown ${i + 1}`,
        value: r.sessions || 0,
      })),
    [rows],
  )

  // Use theme chart colors
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
        <CardTitle>Sessions by Browser</CardTitle>
      </CardHeader>
      <CardContent className="pt-3 md:pt-4" style={{ height: 270 }}>
        {error && <div className="text-sm md:text-base text-red-500">Error: {error}</div>}
        {!rows && !error && <div className="text-sm md:text-base text-muted-foreground">Loading...</div>}
        {rows && rows.length === 0 && (
          <div className="text-sm md:text-base text-muted-foreground">No data</div>
        )}

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

export const widgetMeta: WidgetMeta = {
  id: "browser_share",
  name: "Browser Share",
  description: "원형(도넛) 차트로 브라우저별 세션 비율",
  defaultWidth: 620,
  defaultHeight: 360,
}
