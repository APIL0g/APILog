import { useEffect, useMemo, useState } from "react"
import { CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import type { WidgetMeta, WidgetProps } from "@/core/registry"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList,
} from "@/lib/recharts"
import { getCommonWidgetCopy } from "../i18n"
import { getDailyCountCopy } from "./locales"

type Row = { date: string; cnt: number }

// "예쁜" 1/2/5 계열 보정 상한
function niceCeil(n: number): number {
  if (!isFinite(n) || n <= 0) return 10
  const exp = Math.floor(Math.log10(n))
  const base = Math.pow(10, exp)
  const m = n / base
  const nice = m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10
  return nice * base
}

function niceStep(n: number): number {
  if (!isFinite(n) || n <= 0) return 1
  const exp = Math.floor(Math.log10(n))
  const base = Math.pow(10, exp)
  const m = n / base
  const nice = m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10
  return nice * base
}

// 동일 오리진 프록시(/api/*) 사용 → 상대 경로 호출
const API_BASE = ""
async function fetchDaily(range: string): Promise<Row[]> {
  const res = await fetch(`${API_BASE}/api/query/daily-count?range=${encodeURIComponent(range)}`)
  if (!res.ok) throw new Error(await res.text())
  const data = await res.json()
  return data?.rows ?? []
}

export default function DailyCountWidget({ timeRange, language }: WidgetProps) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const common = getCommonWidgetCopy(language)
  const copy = getDailyCountCopy(language)

  useEffect(() => {
    let alive = true
    setRows(null)
    setError(null)
    fetchDaily(timeRange || "7d")
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

  const chartData = useMemo(
    () =>
      (rows ?? []).map((r) => ({
        // 표시 라벨: MM-DD
        label: r.date.slice(5),
        value: r.cnt,
      })),
    [rows],
  )

  // Y축 상한 고정: 최대값에 여유를 주고 1/2/5 계열로 맞춤
  const { yMax, yTicks } = useMemo(() => {
    const maxVal = chartData.reduce((m, d) => (d.value > m ? d.value : m), 0)
    const padded = maxVal * 1.12
    const maxNice = niceCeil(padded)
    const rough = maxNice / 5
    const step = niceStep(rough)
    const ticks: number[] = []
    for (let v = 0; v <= maxNice; v += step) ticks.push(v)
    if (ticks[ticks.length - 1] !== maxNice) ticks.push(maxNice)
    return { yMax: maxNice, yTicks: ticks }
  }, [chartData])

  return (
    <>
      <CardHeader className="mb-2 md:mb-3">
        <CardTitle>{copy.title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-3 md:pt-4" style={{ height: 280 }}>
        {error && <div className="text-sm text-red-500">{common.errorPrefix}: {error}</div>}
        {!rows && !error && <div className="text-sm text-muted-foreground">{common.loading}</div>}
        {rows && rows.length === 0 && (
          <div className="text-sm text-muted-foreground">{common.noData}</div>
        )}
        {rows && rows.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 24, right: 12, left: 4, bottom: 12 }}
              // Use currentColor so we can drive color via CSS variable
              style={{ color: 'hsl(var(--foreground))' }}
            >
              <CartesianGrid
                stroke="hsl(var(--border))"
                strokeOpacity={0.4}
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tickMargin={6}
                stroke="hsl(var(--border))"
                tick={{ fill: 'currentColor', fontSize: 12 }}
              />
              <YAxis
                width={36}
                stroke="hsl(var(--border))"
                tick={{ fill: 'currentColor', fontSize: 12 }}
                domain={[0, yMax]}
                ticks={yTicks}
                tickFormatter={(v) => `${v}`}
              />
              <Bar
                dataKey="value"
                fill="currentColor"
                radius={[6, 6, 0, 0]}
                maxBarSize={48}
              >
                <LabelList
                  dataKey="value"
                  position="top"
                  className="fill-foreground"
                  formatter={(v: number) => `${v}`}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </>
  )
}

export const widgetMeta: WidgetMeta = {
  id: "daily_count",
  name: "Daily Log Count",
  description: "최근 1주일 일자별 로그 합계를 막대 그래프로 표시",
  defaultWidth: 520,
  defaultHeight: 360,
}

