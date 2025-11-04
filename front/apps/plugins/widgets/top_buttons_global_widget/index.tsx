import { useEffect, useMemo, useState } from "react"
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { WidgetMeta, WidgetProps } from "@/core/registry"
import {
  MousePointerClick,
  LogIn,
  UserPlus,
  ShoppingCart,
  Download,
  Search as SearchIcon,
  Filter,
  ArrowUpDown,
  Share2,
  Heart,
  CreditCard,
  TicketPercent,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command"
import { ChevronDown } from "lucide-react"

type Row = { element_text: string; count: number }

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

function normalizeLabel(s: string) {
  return (s || "")
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .trim()
}

function getIconFor(label: string) {
  const s = normalizeLabel(label)
  if (s.includes('sign in') || s.includes('signin') || s.includes('login')) return LogIn
  if (s.includes('sign up') || s.includes('signup') || s.includes('register')) return UserPlus
  if (s.includes('add to cart') || s.includes('cart')) return ShoppingCart
  if (s.includes('download')) return Download
  if (s.includes('search')) return SearchIcon
  if (s.includes('filter')) return Filter
  if (s.includes('sort')) return ArrowUpDown
  if (s.includes('share')) return Share2
  if (s.includes('wishlist') || s.includes('favorite') || s.includes('heart')) return Heart
  if (s.includes('pay') || s.includes('checkout')) return CreditCard
  if (s.includes('coupon')) return TicketPercent
  return MousePointerClick
}

export default function TopButtonsGlobalWidget({ timeRange }: WidgetProps) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<string>("7d")
  const [openRange, setOpenRange] = useState(false)

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
        <CardTitle>Top Button Clicks (Global)</CardTitle>
        <div className="ml-auto flex items-center gap-2">
          <Popover open={openRange} onOpenChange={setOpenRange}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 min-w-[16ch] px-3 gap-2 whitespace-nowrap justify-between shrink-0"
              >
                {range === "30d" ? "Last 30 days" : "Last 7 days"}
                <ChevronDown className="h-4 w-4 opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[180px]" align="end">
              <Command>
                <CommandList>
                  <CommandEmpty>No options</CommandEmpty>
                  <CommandGroup>
                    <CommandItem onSelect={() => { setRange("7d"); setOpenRange(false) }}>Last 7 days</CommandItem>
                    <CommandItem onSelect={() => { setRange("30d"); setOpenRange(false) }}>Last 30 days</CommandItem>
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {error && <div className="text-sm text-red-500">Error: {error}</div>}
        {!error && rows === null && <div className="text-sm text-muted-foreground">Loading...</div>}
        {!error && rows && rows.length === 0 && <div className="text-sm text-muted-foreground">No data</div>}
        {!error && rows && rows.length > 0 && (
          <div className="divide-y">
            <div className="mb-2 flex items-center justify-between text-sm font-semibold text-foreground">
              <span>Button</span>
              <span>Clicks</span>
            </div>
            {topSorted.map((r, idx) => (
              <div key={`${r.element_text}-${idx}`} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-muted grid place-items-center">
                    {(() => {
                      const Icon = getIconFor(r.element_text)
                      return <Icon className="h-4 w-4 text-muted-foreground" />
                    })()}
                  </div>
                  <span className="text-xs tabular-nums text-muted-foreground w-6 text-right">{idx + 1}.</span>
                  <div className="text-sm truncate">{r.element_text}</div>
                </div>
                <div className="text-sm font-medium tabular-nums">{fmt(r.count)}</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </>
  )
}

export const widgetMeta: WidgetMeta = {
  id: "top-buttons-global-widget",
  name: "Top Button Clicks (Global)",
  description: "Ranked button clicks across all pages",
  defaultWidth: 420,
  defaultHeight: 360,
}

