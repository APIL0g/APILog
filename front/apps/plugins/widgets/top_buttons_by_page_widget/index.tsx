import { useEffect, useMemo, useState } from "react"
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { WidgetMeta, WidgetProps } from "@/core/registry"
import { ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { getCommonWidgetCopy } from "../i18n"
import { getTopButtonsByPageCopy } from "./locales"

type Row = { site_id: string; element_text: string; count: number }
type PathOption = { path: string; count: number }

const looksLikeHtmlSnippet = (value: string): boolean => /<\/?[a-z][\s\S]*>/i.test(value)
const toPlainText = (value: string): string =>
  value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()

const API_BASE = ""
async function fetchPaths(range: string): Promise<PathOption[]> {
  const res = await fetch(`${API_BASE}/api/query/top-buttons/paths?range=${encodeURIComponent(range)}`)
  if (!res.ok) throw new Error(await res.text())
  const data = await res.json()
  const rows = Array.isArray(data?.rows) ? data.rows : []
  const options: PathOption[] = []

  if (rows.length) {
    for (const item of rows) {
      if (!item) continue
      const rawPath = typeof item.path === "string" ? item.path.trim() : ""
      if (!rawPath) continue
      const normalizedPath = rawPath.startsWith("/") ? rawPath : `/${rawPath.replace(/^\/+/, "")}`
      const count = Number(item.count ?? 0) || 0
      options.push({ path: normalizedPath, count })
    }
  }

  if (!options.length && Array.isArray(data?.paths)) {
    for (const path of data.paths) {
      if (typeof path !== "string") continue
      const trimmed = path.trim()
      if (!trimmed) continue
      const normalizedPath = trimmed.startsWith("/") ? trimmed : `/${trimmed.replace(/^\/+/, "")}`
      options.push({ path: normalizedPath, count: 0 })
    }
  }

  return options
}

async function fetchTopButtonsByPath(path: string, range: string): Promise<Row[]> {
  const res = await fetch(
    `${API_BASE}/api/query/top-buttons/by-path?path=${encodeURIComponent(path)}&range=${encodeURIComponent(range)}`,
  )
  if (!res.ok) throw new Error(await res.text())
  const data = await res.json()
  const rows = (data?.rows ?? []) as Array<any>
  return rows.map((r) => ({ site_id: path, element_text: r?.element_text ?? "unknown", count: Number(r?.count ?? 0) }))
}

export default function TopButtonsByPageWidget({ timeRange, language }: WidgetProps) {
  const [paths, setPaths] = useState<PathOption[]>([])
  const [pagePath, setPagePath] = useState<string>("")
  const [range, setRange] = useState<string>("7d")
  const [openRange, setOpenRange] = useState(false)
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const common = getCommonWidgetCopy(language)
  const copy = getTopButtonsByPageCopy(language)

  useEffect(() => {
    let cancelled = false
    fetchPaths(range || "7d")
      .then((list) => {
        if (cancelled) return
        const unique = new Map<string, PathOption>()
        for (const item of list) {
          const key = typeof item.path === "string" ? item.path.trim() : ""
          if (!key) continue
          const normalized = key.startsWith("/") ? key : `/${key.replace(/^\/+/, "")}`
          if (!normalized) continue
          const count = Number(item.count ?? 0) || 0
          if (!unique.has(normalized)) {
            unique.set(normalized, { path: normalized, count })
          } else {
            const prev = unique.get(normalized)!
            unique.set(normalized, { path: normalized, count: prev.count + count })
          }
        }
        const sanitized = Array.from(unique.values()).sort((a, b) => {
          const diff = (b.count || 0) - (a.count || 0)
          if (diff !== 0) return diff
          return b.path.localeCompare(a.path)
        })
        setPaths(sanitized)
        setPagePath((prev) => {
          if (prev && sanitized.some((opt) => opt.path === prev)) return prev
          return sanitized[0]?.path ?? ""
        })
        setError(null)
      })
      .catch((e) => {
        if (cancelled) return
        setError(String((e as any)?.message || "Failed to load page paths"))
        setPaths([])
        setPagePath("")
      })
    return () => {
      cancelled = true
    }
  }, [range])

  useEffect(() => {
    let cancelled = false
    setRows(null)
    if (!pagePath) return
    setError(null)
    fetchTopButtonsByPath(pagePath, range || "7d")
      .then((data) => {
        if (cancelled) return
        setRows(data)
      })
      .catch((e) => !cancelled && setError(String((e as any)?.message || e)))
    return () => {
      cancelled = true
    }
  }, [pagePath, range])

  const topSorted = useMemo(() => {
    const list = rows ? [...rows] : []
    return list.sort((a, b) => b.count - a.count).slice(0, 10)
  }, [rows])

  const totalPathCount = useMemo(() => {
    return paths.reduce((sum, item) => sum + (item.count || 0), 0)
  }, [paths])

  const fmt = (n: number) => new Intl.NumberFormat().format(n)
  const displayPath = (p: string) => {
    if (!p) return copy.pagePlaceholder
    if (p === "/") return "/"
    return p.replace(/^\/+/, "")
  }

  return (
    <>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>{copy.title}</CardTitle>
        <div className="ml-auto flex items-center gap-2">
          <Popover open={openRange} onOpenChange={setOpenRange}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 min-w-[16ch] px-3 gap-2 whitespace-nowrap justify-between shrink-0"
              >
                {range === "30d" ? copy.range30 : copy.range7}
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
        <div className="mb-2 flex items-center justify-end">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="w-auto min-w-[16ch] px-3 gap-2 whitespace-nowrap justify-between"
              >
                {displayPath(pagePath)}
                <ChevronDown className="h-4 w-4 opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-64" align="end">
              <Command>
                <CommandInput placeholder={copy.searchPlaceholder} />
                <CommandList>
                  <CommandEmpty>{copy.noResults}</CommandEmpty>
                  <CommandGroup>
                    {paths.map((p) => {
                      const percent = totalPathCount > 0 ? ((p.count / totalPathCount) * 100).toFixed(1) : null
                      return (
                        <CommandItem
                          key={p.path}
                          value={displayPath(p.path)}
                          onSelect={() => {
                            setPagePath(p.path)
                            setOpen(false)
                          }}
                        >
                          <div className="flex flex-col">
                            <span>{displayPath(p.path)}</span>
                            <span className="text-xs text-muted-foreground">
                              {fmt(p.count)} {copy.clicksLabel}{percent ? ` · ${percent}%` : ""}
                            </span>
                          </div>
                        </CommandItem>
                      )
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {error && <div className="text-sm text-red-500">{common.errorPrefix}: {error}</div>}
        {!error && rows === null && <div className="text-sm text-muted-foreground">{common.loading}</div>}
        {!error && rows && rows.length === 0 && <div className="text-sm text-muted-foreground">{common.noData}</div>}
        {!error && rows && rows.length > 0 && (
          <div className="divide-y">
            {topSorted.map((r, idx) => {
              const hasMarkup = typeof r.element_text === "string" && looksLikeHtmlSnippet(r.element_text)
              const previewHtml = hasMarkup ? r.element_text : null
              return (
                <div key={`${pagePath}-${idx}`} className="flex flex-col gap-2 py-4">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span className="text-xs tabular-nums">{copy.columnButton} {idx + 1}.</span>
                    <span className="text-xs uppercase tracking-wide">{copy.columnClicks}: {fmt(r.count)}</span>
                  </div>
                  <div className="rounded border bg-muted/30 p-2 overflow-visible">
                    {previewHtml && (
                      <div
                        className="pointer-events-none select-none w-full max-w-[50%] scale-75 origin-top-left [&_*]:pointer-events-none [&_*]:select-none [&_a]:text-primary"
                        dangerouslySetInnerHTML={{ __html: previewHtml }}
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </>
  )
}

export const widgetMeta: WidgetMeta = {
  id: "top-buttons-by-page-widget",
  name: "Top Button Clicks by Page",
  description: "Ranked button clicks grouped by page",
  defaultWidth: 420,
  defaultHeight: 360,
}
