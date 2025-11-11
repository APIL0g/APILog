import { useEffect, useMemo, useState } from "react"
import { CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import type { WidgetMeta, WidgetProps } from "@/core/registry"

type Row = { path: string; avgSeconds: number; sessions?: number }

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "")

async function fetchDwellTime(range: string, top = 10): Promise<Row[]> {
  const url = `${API_BASE}/api/query/dwell-time?range=${encodeURIComponent(range)}&top=${top}`
  const response = await fetch(url)
  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Failed to fetch dwell-time data (${response.status})`)
  }

  const rows = (await response.json())?.rows ?? []
  return rows.map((r: any) => ({
    path: r?.path ?? "",
    avgSeconds: Number(r?.avg_seconds ?? 0),
    sessions: r?.sessions != null ? Number(r.sessions) : undefined,
  }))
}

function displayPath(p: string) {
  if (!p || p === "/") return "/"
  try {
    const parsed = new URL(p, window.location.origin)
    return parsed.pathname.replace(/^\/+/, "") || "/"
  } catch {
    return p.replace(/^\/+/, "")
  }
}

function formatDuration(totalSeconds: number) {
  const s = Math.max(0, Math.round(totalSeconds || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
}

export default function DwellTimeWidget({ timeRange }: WidgetProps) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function load() {
      setRows(null)
      setError(null)
      const range = timeRange?.trim() || "7d"
      try {
        const data = await fetchDwellTime(range, 10)
        if (active) setRows(data)
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : String(err))
      }
    }

    load()
    return () => {
      active = false
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
              <div key={`${r.path}-${r.avgSeconds}-${idx}`} className="flex items-center justify-between py-2">
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
