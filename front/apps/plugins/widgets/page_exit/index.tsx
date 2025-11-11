import { useEffect, useMemo, useState } from "react"
import { CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import type { WidgetMeta, WidgetProps } from "@/core/registry"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command"
import { ChevronDown } from "lucide-react"
import { getCommonWidgetCopy } from "../i18n"
import { getPageExitCopy } from "./locales"

type Row = { path: string; views: number; exits: number; exit_rate: number }

const API_BASE = ""

function rangeToDays(range: string): 7 | 30 {
  return /^\s*30\s*d?\s*$/i.test(range) ? 30 : 7
}

async function fetchPageExit(days: 7 | 30): Promise<Row[]> {
  const res = await fetch(`${API_BASE}/api/query/page-exit-rate?days=${days}`)
  if (!res.ok) throw new Error(await res.text())
  const data = await res.json()
  return (data?.rows ?? []) as Row[]
}

function displayPath(p: string) {
  if (!p) return "/"
  if (p === "/") return "/"
  return p.replace(/^\/+/, "")
}

function formatPct(v: number) {
  const n = Number.isFinite(v) ? v : 0
  return `${n.toFixed(2)}%`
}

export default function PageExitWidget({ timeRange, language }: WidgetProps) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Independent range control like top_buttons_global_widget
  const [range, setRange] = useState<string>("7d")
  const [openRange, setOpenRange] = useState(false)
  const days = useMemo(() => rangeToDays(range), [range])
  const common = getCommonWidgetCopy(language)
  const copy = getPageExitCopy(language)

  useEffect(() => {
    let cancelled = false
    setRows(null)
    setError(null)
    fetchPageExit(days)
      .then((r) => {
        if (cancelled) return
        const sorted = [...r].sort((a, b) => {
          if ((b.exit_rate ?? 0) !== (a.exit_rate ?? 0)) return (b.exit_rate ?? 0) - (a.exit_rate ?? 0)
          return (b.views ?? 0) - (a.views ?? 0)
        })
        setRows(sorted)
      })
      .catch((e) => {
        if (!cancelled) setError(String(e))
      })
    return () => {
      cancelled = true
    }
  }, [days])

  const topSorted = useMemo(() => (rows ?? []).slice(0, 10), [rows])

  return (
    <>
      <CardHeader className="mb-2 md:mb-3 flex items-center justify-between">
        <CardTitle>{copy.title}</CardTitle>
        <div className="ml-auto flex items-center gap-2">
          <Popover open={openRange} onOpenChange={setOpenRange}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 min-w-[16ch] px-3 gap-2 whitespace-nowrap justify-between shrink-0"
              >
                {days === 30 ? copy.range30 : copy.range7}
                <ChevronDown className="h-4 w-4 opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[180px]" align="end">
              <Command>
                <CommandList>
                  <CommandEmpty>{copy.noOptions}</CommandEmpty>
                  <CommandGroup>
                    <CommandItem onSelect={() => { setRange("7d"); setOpenRange(false) }}>{copy.range7}</CommandItem>
                    <CommandItem onSelect={() => { setRange("30d"); setOpenRange(false) }}>{copy.range30}</CommandItem>
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="mb-2 flex items-center justify-between text-sm font-semibold text-foreground">
          <span>{copy.labels.page}</span>
          <span>{copy.labels.exitRate}</span>
        </div>

        {error && <div className="text-sm text-red-500">{common.errorPrefix}: {error}</div>}
        {!error && rows === null && <div className="text-sm text-muted-foreground">{common.loading}</div>}
        {!error && rows && rows.length === 0 && <div className="text-sm text-muted-foreground">{common.noData}</div>}
        {!error && rows && rows.length > 0 && (
          <div className="divide-y">
            {topSorted.map((r, idx) => (
              <div key={`${r.path}-${idx}`} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs tabular-nums text-muted-foreground w-6 text-right">{idx + 1}.</span>
                  <div className="min-w-0">
                    <div className="text-sm truncate" title={r.path}>{displayPath(r.path)}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      <span className="mr-3">
                        {copy.labels.exits}: <span className="tabular-nums">{r.exits ?? 0}</span>
                      </span>
                      <span>
                        {copy.labels.views}: <span className="tabular-nums">{r.views ?? 0}</span>
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-sm font-medium tabular-nums">{formatPct(r.exit_rate || 0)}</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </>
  )
}

export const widgetMeta: WidgetMeta = {
  id: "page_exit",
  name: "Page Exit Rate",
  description: "페이지별 세션 종료 비율 Top 10",
  defaultWidth: 520,
  defaultHeight: 360,
}
