import { useEffect, useMemo, useState } from "react"
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { WidgetMeta, WidgetProps } from "@/core/registry"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command"
import { ChevronDown } from "lucide-react"
import { getCommonWidgetCopy } from "../i18n"
import { getTopButtonsGlobalCopy } from "./locales"
import previewImage from "./preview.png"

type Row = { element_text: string; count: number }

const looksLikeHtmlSnippet = (value: string): boolean => /<\/?[a-z][\s\S]*>/i.test(value)

const API_BASE = ""
async function fetchTopButtonsGlobal(range: string): Promise<Row[]> {
  const res = await fetch(`${API_BASE}/api/query/top-buttons/global?range=${encodeURIComponent(range)}`)
  if (!res.ok) throw new Error(await res.text())
  const data = await res.json()
  const rows = (data?.rows ?? []) as Array<any>
  return rows.map((r) => ({
    element_text: r?.element_text ?? "unknown",
    count: Number(r?.count ?? 0),
  }))
}

export default function TopButtonsGlobalWidget({ timeRange, language }: WidgetProps) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<string>("7d")
  const [openRange, setOpenRange] = useState(false)
  const common = getCommonWidgetCopy(language)
  const copy = getTopButtonsGlobalCopy(language)

  useEffect(() => {
    let cancelled = false
    setRows(null)
    setError(null)
    fetchTopButtonsGlobal(range || "7d")
      .then((data) => {
        if (!cancelled) setRows(data)
      })
      .catch((e) => !cancelled && setError(String((e as any)?.message || e)))
    return () => {
      cancelled = true
    }
  }, [range])

  const topSorted = useMemo(() => {
    const list = rows ? [...rows] : []
    return list.sort((a, b) => b.count - a.count).slice(0, 10)
  }, [rows])

  const fmt = (n: number) => new Intl.NumberFormat().format(n)

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
        <div className="mb-2 flex items-center justify-between text-sm font-semibold text-foreground">
          <span>{copy.columnButton}</span>
          <span>{copy.columnClicks}</span>
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
                <div key={`${idx}`} className="flex flex-col gap-2 py-4">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span className="text-xs tabular-nums w-6 text-right">{idx + 1}.</span>
                    <span className="text-xs uppercase tracking-wide">{copy.columnClicks}: {fmt(r.count)}</span>
                  </div>
                  <div className="rounded border bg-muted/30 p-2 overflow-visible min-h-[72px]">
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

const topButtonsGlobalLocales = {
  en: getTopButtonsGlobalCopy("en"),
  ko: getTopButtonsGlobalCopy("ko"),
}

export const widgetMeta: WidgetMeta = {
  id: "top-buttons-global-widget",
  name: "Top Button Clicks (Global)",
  description: "Ranked button clicks across all pages",
  defaultWidth: 520,
  defaultHeight: 300,
  previewImage,
  tags: ["conversion"],
  localizations: {
    en: {
      title: topButtonsGlobalLocales.en.title,
      previewDescription: topButtonsGlobalLocales.en.previewDescription,
    },
    ko: {
      title: topButtonsGlobalLocales.ko.title,
      previewDescription: topButtonsGlobalLocales.ko.previewDescription,
    },
  },
}

