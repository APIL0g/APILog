import { useEffect, useMemo, useState } from "react"
import { CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import type { WidgetMeta, WidgetProps } from "@/core/registry"

type Row = { path: string; avgSeconds: number; sessions?: number }

const API_BASE = ""
async function fetchDwellTime(range: string, top = 10): Promise<Row[]> {
  const url = `${API_BASE}/api/query/dwell-time?range=${encodeURIComponent(range)}&top=${top}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(await res.text())
  const data = await res.json()
  const rows = (data?.rows ?? []) as Array<any>
  return rows.map((r) => ({
    path: r?.path ?? "",
    avgSeconds: Number(r?.avg_seconds ?? r?.avg_dwell ?? r?.avg ?? 0),
    sessions: r?.sessions != null ? Number(r.sessions) : undefined,
  }))
}

function displayPath(p: string) {
  if (!p) return "/"
  if (p === "/") return "/"
  return p.replace(/^\/+/, "")
}

function formatDuration(totalSeconds: number) {
  const s = Math.max(0, Math.round(totalSeconds || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
  return `${m}:${String(sec).padStart(2, "0")}`
}

export default function DwellTimeWidget({ timeRange }: WidgetProps) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Mock data until backend is ready
  useEffect(() => {
    let cancelled = false
    setRows(null)
    setError(null)

    const MOCK_ROWS: Row[] = [
      { path: "/", avgSeconds: 185 },
      { path: "/pricing", avgSeconds: 142 },
      { path: "/blog/how-to-start", avgSeconds: 226 },
      { path: "/docs/getting-started", avgSeconds: 318 },
      { path: "/features", avgSeconds: 174 },
      { path: "/blog/performance-tips", avgSeconds: 261 },
      { path: "/dashboard", avgSeconds: 203 },
      { path: "/signup", avgSeconds: 97 },
      { path: "/changelog", avgSeconds: 156 },
      { path: "/careers", avgSeconds: 134 },
    ]

    const t = setTimeout(() => {
      if (!cancelled) setRows(MOCK_ROWS)
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [timeRange])

  const topSorted = useMemo(() => {
    const list = rows ? [...rows] : []
    return list.sort((a, b) => b.avgSeconds - a.avgSeconds).slice(0, 10)
  }, [rows])

  return (
    <>
      <CardHeader className="mb-2 md:mb-3">
        <CardTitle>Top Pages by Average Dwell Time</CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="mb-2 flex items-center justify-between text-sm font-semibold text-foreground">
          <span>Page</span>
          <span>Avg Time</span>
        </div>

        {error && <div className="text-sm text-red-500">Error: {error}</div>}
        {!error && rows === null && <div className="text-sm text-muted-foreground">Loading...</div>}
        {!error && rows && rows.length === 0 && <div className="text-sm text-muted-foreground">No data</div>}
        {!error && rows && rows.length > 0 && (
          <div className="divide-y">
            {topSorted.map((r, idx) => (
              <div key={`${r.path}-${idx}`} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs tabular-nums text-muted-foreground w-6 text-right">{idx + 1}.</span>
                  <div className="text-sm truncate">{displayPath(r.path)}</div>
                </div>
                <div className="text-sm font-medium tabular-nums">{formatDuration(r.avgSeconds)}</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </>
  )
}

export const widgetMeta: WidgetMeta = {
  id: "dwell-time",
  name: "Top Dwell Time",
  description: "페이지별 평균 체류시간 Top 10",
  defaultWidth: 520,
  defaultHeight: 360,
}
