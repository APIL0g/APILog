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
import { getTopPagesCopy } from "./locales"
import previewImage from "./preview.png"

type Row = { path: string; total_views: number }

// 1/2/5 계열 보정용 nice 함수
function niceCeil(n: number): number {
  if (!isFinite(n) || n <= 0) return 10
  const exp = Math.floor(Math.log10(n))
  const base = Math.pow(10, exp)
  const m = n / base
  const nice = m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10
  return nice * base
}

// X축 눈금 간격을 1/2/5 계열로 계산
function niceStep(n: number): number {
  if (!isFinite(n) || n <= 0) return 1
  const exp = Math.floor(Math.log10(n))
  const base = Math.pow(10, exp)
  const m = n / base
  const nice = m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10
  return nice * base
}

// API 호출
const API_BASE = ""
async function fetchTopPages(limit = 5): Promise<Row[]> {
  const res = await fetch(`${API_BASE}/api/query/top-pages?limit=${limit}`)
  if (!res.ok) throw new Error(await res.text())
  const data = await res.json()
  return data?.rows ?? []
}

// 메인 컴포넌트
export default function TopPagesWidget({ timeRange, language }: WidgetProps) {
  // API 응답 데이터
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const common = getCommonWidgetCopy(language)
  const copy = getTopPagesCopy(language)
  
  // timeRange 변경될 때마다 데이터 재조회
  useEffect(() => {
    let alive = true
    setRows(null)
    setError(null)
    fetchTopPages(5)
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
        label: r.path,
        value: r.total_views ?? 0,
      })),
    [rows], 
  )

  // X축을 깔끔하게 고정 (최댓값 패딩 + 1/2/5 계열)
  const { xMax, xTicks } = useMemo(() => {
    const maxVal = chartData.reduce((m, d) => (d.value > m ? d.value : m), 0)
    const padded = maxVal * 1.12
    const maxNice = niceCeil(padded)
    const rough = maxNice / 5
    const step = niceStep(rough)
    const ticks: number[] = []
    for (let v = 0; v <= maxNice; v += step) ticks.push(v)
    if (ticks[ticks.length - 1] !== maxNice) ticks.push(maxNice)
    return { xMax: maxNice, xTicks: ticks }
  }, [chartData])

  return (
    <>
      <CardHeader className="mb-2 md:mb-3">
        <CardTitle>{copy.title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-3 md:pt-4" style={{ height: 320 }}>
        {/* 에러 상태 */}
        {error && <div className="text-sm text-red-500">{common.errorPrefix}: {error}</div>}
        {/* 로딩 상태 */}
        {!rows && !error && <div className="text-sm text-muted-foreground">{common.loading}</div>}
        {/* 데이터 없음 */}
        {rows && rows.length === 0 && (
          <div className="text-sm text-muted-foreground">{common.noData}</div>
        )}
        {/* 차트 렌더링 */}
        {rows && rows.length > 0 && (
          <TopPagesChart chartData={chartData} xMax={xMax} xTicks={xTicks} />
        )}
      </CardContent>
    </>
  )
}

// 분리: 긴 경로 라벨 측정 및 차트 렌더
type ChartDatum = { label: string; value: number }
function measureTextPx(text: string, font = "12px sans-serif"): number {
  if (typeof document === 'undefined') return text.length * 8
  const canvas = measureTextPx._canvas || (measureTextPx._canvas = document.createElement('canvas'))
  const ctx = canvas.getContext('2d')
  if (!ctx) return text.length * 8
  ctx.font = font
  return ctx.measureText(text).width
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(measureTextPx as any)._canvas = undefined as HTMLCanvasElement | undefined

// 차트 컴포넌트
function TopPagesChart({ chartData, xMax, xTicks }: { chartData: ChartDatum[]; xMax: number; xTicks: number[] }) {
  const yAxisWidth = useMemo(() => {
    const max = chartData.reduce((m, d) => Math.max(m, measureTextPx(d.label, '12px sans-serif')), 0)
    // 최소/최대 폭 제한으로 차트 영역 과도 점유 방지
    const MIN = 140
    const MAX = 320
    const PAD = 14
    return Math.max(MIN, Math.min(MAX, Math.ceil(max + PAD)))
  }, [chartData])

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 16, right: 16, left: 8, bottom: 8 }}
        style={{ color: 'hsl(var(--foreground))' }}
      >
        <CartesianGrid
          stroke="hsl(var(--border))"
          strokeOpacity={0.4}
          horizontal={true}
          vertical={false}
        />
        <XAxis
          type="number"
          domain={[0, xMax]}
          ticks={xTicks}
          stroke="hsl(var(--border))"
          tick={{ fill: 'currentColor', fontSize: 12 }}
        />
        <YAxis
          type="category"
          dataKey="label"
          width={yAxisWidth}
          stroke="hsl(var(--border))"
          tick={{ fill: 'currentColor', fontSize: 12 }}
        />
        <Bar dataKey="value" fill="currentColor" radius={[0, 6, 6, 0]} maxBarSize={36}>
          <LabelList
            dataKey="value"
            position="right"
            className="fill-foreground"
            formatter={(v: number) => `${v}`}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

const topPagesLocales = {
  en: getTopPagesCopy("en"),
  ko: getTopPagesCopy("ko"),
}

export const widgetMeta: WidgetMeta = {
  id: "top_pages",
  name: "Top Pages",
  description: "인기 페이지 Top 5를 가로 막대로 표시",
  defaultWidth: 520,
  defaultHeight: 300,
  previewImage,
  tags: ["traffic"],
  localizations: {
    en: {
      title: topPagesLocales.en.title,
      previewDescription: topPagesLocales.en.previewDescription,
    },
    ko: {
      title: topPagesLocales.ko.title,
      previewDescription: topPagesLocales.ko.previewDescription,
    },
  },
}