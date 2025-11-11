import { useEffect, useMemo, useState } from "react"
import { CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import type { WidgetMeta, WidgetProps } from "@/core/registry"
import { getCommonWidgetCopy } from "../i18n"
import { getTimeTopPagesCopy } from "./locales"

type Row = { path: string; total_views: number }
type Bucket = { bucket: string; rows: Row[] }

const API_BASE = ""

async function fetchTimeTop(params: { bucket: string; hours: number; limit: number }): Promise<Bucket[]> {
  const q = new URLSearchParams({
    bucket: params.bucket,
    hours: String(params.hours),
    limit: String(params.limit),
  })
  const res = await fetch(`${API_BASE}/api/query/time-top-pages?${q.toString()}`)
  if (!res.ok) throw new Error(await res.text())
  const data = await res.json()
  return data?.buckets ?? []
}

function formatBucketLabel(b: string): string {
  // Expect ISO-like timestamps; keep up to minutes for brevity
  if (!b) return ""
  // e.g., 2025-01-01T06:00:00Z -> 2025-01-01 06:00
  const t = b.replace("T", " ").replace("Z", "")
  return t.slice(0, 16)
}

export default function TimeTopPagesWidget({ language }: WidgetProps) {
  const [bucket, setBucket] = useState<"6h" | "12h">("6h")
  const [hours, setHours] = useState<number>(24)
  const [limit] = useState<number>(5)
  const [buckets, setBuckets] = useState<Bucket[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const common = getCommonWidgetCopy(language)
  const copy = getTimeTopPagesCopy(language)

  useEffect(() => {
    let alive = true
    setBuckets(null)
    setError(null)
    fetchTimeTop({ bucket, hours, limit })
      .then((r) => { if (alive) setBuckets(r) })
      .catch((e) => { if (alive) setError(String(e)) })
    return () => { alive = false }
  }, [bucket, hours, limit])

  const hasData = useMemo(() => (buckets?.some(b => (b.rows?.length ?? 0) > 0)) ?? false, [buckets])

  return (
    <>
      <CardHeader className="mb-2 md:mb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle>{copy.title}</CardTitle>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded border overflow-hidden">
              <button
                className={`px-3 py-1 text-sm ${bucket === '6h' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
                onClick={() => setBucket('6h')}
              >6h</button>
              <button
                className={`px-3 py-1 text-sm ${bucket === '12h' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
                onClick={() => setBucket('12h')}
              >12h</button>
            </div>
            <select
              className="px-2 py-1 text-sm rounded border bg-background"
              value={hours}
              onChange={(e) => setHours(parseInt(e.target.value) || 24)}
              title={copy.lookbackLabel}
            >
              <option value={24}>24h</option>
              <option value={48}>48h</option>
              <option value={72}>72h</option>
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-3 md:pt-4 space-y-4" style={{ maxHeight: 360, overflowY: 'auto' }}>
        {error && <div className="text-sm text-red-500">{common.errorPrefix}: {error}</div>}
        {!buckets && !error && <div className="text-sm text-muted-foreground">{common.loading}</div>}
        {buckets && !hasData && (
          <div className="text-sm text-muted-foreground">{common.noData}</div>
        )}
        {buckets && hasData && (
          <div className="space-y-4">
            {buckets.map((bk, i) => (
              <div key={`${bk.bucket}-${i}`} className="rounded-md border">
                <div className="px-3 py-2 text-xs text-muted-foreground border-b">
                  {copy.bucketLabelPrefix}: {formatBucketLabel(bk.bucket)}
                </div>
                <div className="divide-y">
                  {bk.rows.slice(0, limit).map((r, idx) => (
                    <div key={`${r.path}-${idx}`} className="flex items-center justify-between px-3 py-2 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="inline-flex w-6 justify-center text-xs text-muted-foreground">{idx + 1}</span>
                        <span className="truncate" title={r.path}>{r.path}</span>
                      </div>
                      <div className="tabular-nums text-muted-foreground">{r.total_views}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </>
  )
}

export const widgetMeta: WidgetMeta = {
  id: "time_top_pages",
  name: "Time Top Pages",
  description: "시간대(6h/12h) 버킷별 Top 페이지",
  defaultWidth: 520,
  defaultHeight: 400,
}

