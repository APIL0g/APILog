"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import {
  Line,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts"

type TrafficDiagnosis = {
  focus: string
  finding: string
  widget: string
  severity?: string
  share?: string
  insight?: string
}

type PageIssue = {
  page: string
  issue: string
  dwell_time?: string
  exit_rate?: string
  insight?: string
  widget?: string
}

type InteractionInsight = {
  area: string
  insight: string
  action?: string
  widget?: string
}

type Recommendation = {
  category: string
  suggestion: string
  rationale?: string
  validation?: string
}

type Priority = {
  title: string
  priority: string
  impact: string
  effort?: string
  expected_metric_change?: { metric?: string; period?: string; target?: string; baseline?: number }
  business_outcome?: string
}

type MetricWatch = {
  metric: string
  widget: string
  reason: string
  target_change?: string
  timeframe?: string
}

type Prediction = {
  metric: string
  baseline: number
  expected: number
  unit?: string
  narrative?: string
}

type RadarScore = {
  axis: string
  score: number
  commentary?: string
}

type ReportTrendMeta = {
  label?: string
  change_pct?: number
  momentum_pct?: number
  days?: number
  last?: number
}

type ReportMeta = {
  mode?: string
  provider?: string
  model?: string
  time?: { from?: string; to?: string; bucket?: string }
  site_id?: string | null
  widgets?: string[]
  missing_widgets?: string[]
  trend?: ReportTrendMeta
  fallback?: boolean
  [key: string]: any
}

type Report = {
  generated_at: string
  title: string
  summary?: string
  diagnostics?: TrafficDiagnosis[]
  page_issues?: PageIssue[]
  interaction_insights?: InteractionInsight[]
  ux_recommendations?: Recommendation[]
  tech_recommendations?: Recommendation[]
  priorities?: Priority[]
  metrics_to_track?: MetricWatch[]
  predictions?: Prediction[]
  radar_scores?: RadarScore[]
  meta?: ReportMeta
}

const RADAR_AXIS_LABELS: Record<string, string> = {
  performance: "성능",
  experience: "사용자 경험",
  growth: "성장/전환",
  search: "검색 노출",
  stability: "기술 안정성",
}

type RadarAxisKey = keyof typeof RADAR_AXIS_LABELS

const RADAR_AXIS_KEYS = Object.keys(RADAR_AXIS_LABELS) as RadarAxisKey[]

// Allow LLM responses that localize axis labels to still map onto our canonical axes.
const RADAR_AXIS_NORMALIZERS: Array<{ key: RadarAxisKey; matches: string[] }> = [
  {
    key: "performance",
    matches: ["performance", "perf", "speed", RADAR_AXIS_LABELS.performance, "성능", "퍼포먼스", "속도"],
  },
  {
    key: "experience",
    matches: ["experience", "ux", RADAR_AXIS_LABELS.experience, "사용자 경험", "경험", "ux/ui"],
  },
  {
    key: "growth",
    matches: ["growth", "acquisition", RADAR_AXIS_LABELS.growth, "성장", "확장", "획득"],
  },
  {
    key: "search",
    matches: ["search", "seo", RADAR_AXIS_LABELS.search, "검색", "검색 노출", "탐색"],
  },
  {
    key: "stability",
    matches: ["stability", "reliability", RADAR_AXIS_LABELS.stability, "안정성", "안정 운영", "신뢰성"],
  },
]

function normalizeRadarAxis(value?: string): RadarAxisKey | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  if (!normalized) return null
  for (const { key, matches } of RADAR_AXIS_NORMALIZERS) {
    if (
      matches.some((token) => {
        const tokenValue = token?.trim().toLowerCase()
        if (!tokenValue) return false
        return normalized === tokenValue || normalized.includes(tokenValue)
      })
    ) {
      return key
    }
  }
  return null
}

const SEVERITY_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  high: "destructive",
  medium: "default",
  low: "secondary",
}

function nowIso() {
  return new Date().toISOString().replace(/\..*/, "")
}

export default function AIReportPage() {
  const [prompt, setPrompt] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<Report | null>(null)

  const defaultRange = useMemo(() => {
    const to = new Date()
    const from = new Date(Date.now() - 24 * 60 * 60 * 1000)
    return { from: from.toISOString().replace(/\..*/, ""), to: to.toISOString().replace(/\..*/, ""), bucket: "1h" }
  }, [])

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    setReport(null)
    try {
      const res = await fetch("/api/query/ai-report/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          time: { from: defaultRange.from, to: defaultRange.to, bucket: defaultRange.bucket },
          prompt,
          language: "ko",
          audience: "dev",
          word_limit: 700,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as Report
      setReport(data)
    } catch (e: any) {
      setError(e?.message || "리포트 생성 중 오류가 발생했습니다.")
      setReport({
        generated_at: nowIso(),
        title: "AI 컨디션 리포트",
        summary: "데이터 수집에 실패하여 샘플 진단을 노출합니다. 로그 파이프라인 상태를 확인해 주세요.",
        diagnostics: [],
        page_issues: [],
        interaction_insights: [],
        ux_recommendations: [],
        tech_recommendations: [],
        priorities: [],
        metrics_to_track: [
          { metric: "페이지별 이탈 비율", widget: "page_exit_rate", reason: "이탈 감소 여부 확인" },
          { metric: "페이지별 체류 시간", widget: "time_top_pages", reason: "UX 개선 검증" },
        ],
        predictions: [],
        radar_scores: [],
        meta: {
          fallback: true,
          mode: "fallback",
          provider: "insight-engine",
          model: "sample",
          trend: { label: "unknown" },
          missing_widgets: [],
        },
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <img src="/dashboard-logo.png" alt="ApiLog" className="h-8" />
            <div className="h-6 w-px bg-border" />
            <div>
              <h1 className="text-xl font-semibold text-foreground">AI 진단 리포트</h1>
              <p className="text-sm text-muted-foreground">실측 위젯 데이터를 기반으로 문제를 규명하고 실행 계획을 제안합니다.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => (globalThis.location.hash = "#/")}>
              대시보드로
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 p-6">
        <Card>
          <CardHeader>
            <CardTitle>리포트 생성</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm text-muted-foreground">사용자 메모 (선택 반영)</label>
                <Textarea
                  placeholder="예: 모바일 Chrome 이탈 원인을 진단하고, 성능 개선 방안을 우선 제안해줘."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="min-h-24"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">기간</label>
                <div className="rounded-md border bg-muted/30 p-3 text-sm">
                  <div>From: {defaultRange.from}</div>
                  <div>To: {defaultRange.to}</div>
                  <div>Bucket: {defaultRange.bucket}</div>
                </div>
                <Button onClick={handleGenerate} disabled={loading} className="w-full">
                  {loading ? "생성 중..." : "리포트 생성"}
                </Button>
                {error && <div className="text-sm text-destructive">{error}</div>}
              </div>
            </div>
          </CardContent>
        </Card>

        {report && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    {report.title}
                    <Badge variant="secondary" className="uppercase">
                      {report?.meta?.model || report?.meta?.provider || "AI"}
                    </Badge>
                    {report?.meta?.fallback && <Badge variant="destructive">Fallback</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm text-muted-foreground">생성 시각: {report.generated_at}</div>
                  {report.summary && <p className="whitespace-pre-wrap leading-7">{report.summary}</p>}
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {formatTimeWindow(report.meta) && <div>{formatTimeWindow(report.meta)}</div>}
                    {report.meta?.trend && (
                      <div>
                        트래픽 추세: {report.meta.trend.label || "-"} ({formatPercentDelta(report.meta.trend.change_pct)})
                      </div>
                    )}
                    {report.meta?.missing_widgets?.length ? (
                      <div>누락 위젯: {report.meta.missing_widgets.join(", ")}</div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              <ImpactChart report={report} />

              <Card>
                <CardHeader>
                  <CardTitle>환경 진단</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(report.diagnostics || []).length === 0 && (
                    <div className="text-sm text-muted-foreground">표시할 진단이 없습니다.</div>
                  )}
                  {(report.diagnostics || []).map((diag, i) => (
                    <div key={`${diag.focus}-${i}`} className="rounded-md border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">{diag.focus}</div>
                        <Badge variant={severityVariant(diag.severity)}>{diag.severity || "Info"}</Badge>
                      </div>
                      <div className="text-sm">{diag.finding}</div>
                      <div className="text-xs text-muted-foreground">
                        근거 위젯: {diag.widget}
                        {diag.share ? ` · 비중 ${diag.share}` : ""}
                      </div>
                      {diag.insight && <div className="text-xs text-muted-foreground">{diag.insight}</div>}
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>문제성 페이지</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(report.page_issues || []).length === 0 && (
                    <div className="text-sm text-muted-foreground">체류/이탈 이상 징후가 없습니다.</div>
                  )}
                  {(report.page_issues || []).map((page, i) => (
                    <div key={`${page.page}-${i}`} className="rounded-md border p-3 space-y-1.5">
                      <div className="flex items-center justify-between text-sm font-medium">
                        <span>{page.page}</span>
                        <Badge variant="outline">{page.widget || "page_exit_rate"}</Badge>
                      </div>
                      <div className="text-sm">{page.issue}</div>
                      <div className="text-xs text-muted-foreground">
                        체류: {page.dwell_time || "-"} · 이탈: {page.exit_rate || "-"}
                      </div>
                      {page.insight && <div className="text-xs text-muted-foreground">{page.insight}</div>}
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>상호작용 & 히트맵 인사이트</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(report.interaction_insights || []).length === 0 && (
                    <div className="text-sm text-muted-foreground">클릭/히트맵 이상 징후가 없습니다.</div>
                  )}
                  {(report.interaction_insights || []).map((insight, i) => (
                    <div key={`${insight.area}-${i}`} className="rounded-md border p-3 space-y-1.5">
                      <div className="flex items-center justify-between text-sm font-medium">
                        <span>{insight.area}</span>
                        {insight.widget && <Badge variant="outline">{insight.widget}</Badge>}
                      </div>
                      <div className="text-sm">{insight.insight}</div>
                      {insight.action && <div className="text-xs text-muted-foreground">조치: {insight.action}</div>}
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>실질적 해결 방안</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <RecommendationColumn title="디자인 · UX" items={report.ux_recommendations || []} />
                  <RecommendationColumn title="성능 · 기술" items={report.tech_recommendations || []} />
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>우선순위 및 영향도</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(report.priorities || []).length === 0 && (
                    <div className="text-sm text-muted-foreground">우선순위가 없습니다.</div>
                  )}
                  {(report.priorities || []).map((p, i) => (
                    <div key={`${p.title}-${i}`} className="rounded-md border p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">{p.title}</div>
                        <Badge variant={priorityVariant(p.priority)}>{p.priority}</Badge>
                      </div>
                      <div className="text-sm">{p.impact}</div>
                      <div className="text-xs text-muted-foreground">
                        노력도: {p.effort || "-"}
                        {p.business_outcome ? ` · ${p.business_outcome}` : ""}
                      </div>
                      {p.expected_metric_change && (
                        <div className="text-xs text-muted-foreground">
                          목표 지표: {p.expected_metric_change.metric || "-"} {p.expected_metric_change.target || ""}
                          {p.expected_metric_change.period ? ` / ${p.expected_metric_change.period}` : ""}
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>성과 측정 지표</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(report.metrics_to_track || []).length === 0 && (
                    <div className="text-sm text-muted-foreground">추적할 지표가 없습니다.</div>
                  )}
                  {(report.metrics_to_track || []).map((metric, i) => (
                    <div key={`${metric.metric}-${i}`} className="rounded-md border p-3 space-y-1">
                      <div className="flex items-center justify-between text-sm font-medium">
                        <span>{metric.metric}</span>
                        {metric.target_change && <Badge variant="outline">{metric.target_change}</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        위젯: {metric.widget} {metric.timeframe ? `· 기간 ${metric.timeframe}` : ""}
                      </div>
                      <div className="text-sm">{metric.reason}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>데이터 기반 예측치</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(report.predictions || []).length === 0 && (
                    <div className="text-sm text-muted-foreground">예상치를 계산할 데이터가 부족합니다.</div>
                  )}
                  {(report.predictions || []).map((pred, i) => (
                    <div key={`${pred.metric}-${i}`} className="rounded-md border p-3 space-y-1">
                      <div className="flex items-center justify-between text-sm font-medium">
                        <span>{pred.metric}</span>
                        <Badge variant="secondary">
                          {formatNumber(pred.expected)}{pred.unit || ""}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        현재 {formatNumber(pred.baseline)}
                        {pred.unit || ""} → 예상 {formatNumber(pred.expected)}
                        {pred.unit || ""}
                      </div>
                      {pred.narrative && <div className="text-sm">{pred.narrative}</div>}
                    </div>
                  ))}
                </CardContent>
              </Card>

              <RadarPentagon scores={report.radar_scores} />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function RecommendationColumn({ title, items }: { title: string; items: Recommendation[] }) {
  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold">{title}</div>
      {items.length === 0 && <div className="text-sm text-muted-foreground">추천 항목이 없습니다.</div>}
      {items.map((item, i) => (
        <div key={`${item.suggestion}-${i}`} className="rounded-md border p-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{item.category}</span>
          </div>
          <div className="text-sm">{item.suggestion}</div>
          {item.rationale && <div className="text-xs text-muted-foreground">근거: {item.rationale}</div>}
          {item.validation && <div className="text-xs text-muted-foreground">검증: {item.validation}</div>}
        </div>
      ))}
    </div>
  )
}

function formatTimeWindow(meta?: ReportMeta) {
  if (!meta?.time) return null
  const from = meta.time.from || "-"
  const to = meta.time.to || "-"
  const bucket = meta.time.bucket ? ` · Bucket ${meta.time.bucket}` : ""
  return `분석 구간: ${from} ~ ${to}${bucket}`
}

function formatPercentDelta(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return "-"
  const sign = value > 0 ? "+" : ""
  return `${sign}${value.toFixed(1)}%`
}

function severityVariant(level?: string) {
  if (!level) return "secondary"
  return SEVERITY_VARIANT[level.toLowerCase()] || "secondary"
}

function priorityVariant(level?: string) {
  if (!level) return "outline"
  const normalized = level.toLowerCase()
  if (normalized === "high") return "destructive"
  if (normalized === "medium") return "default"
  if (normalized === "low") return "secondary"
  return "outline"
}

function formatNumber(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return "-"
  return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2)
}

function buildPredictionSeries(report: Report | null) {
  const target = report?.predictions?.[0]
  const metricLabel = target?.metric || "Impact Index"
  const unit = target?.unit || ""
  const baseline = typeof target?.baseline === "number" ? target.baseline : 100
  const expected = typeof target?.expected === "number" ? target.expected : baseline * 1.05
  const midpoint = baseline + (expected - baseline) * 0.5
  const data = [
    { name: "현재", baseline, projected: baseline },
    { name: "+1주", baseline, projected: Math.round(midpoint * 10) / 10 },
    { name: "+2주", baseline, projected: Math.round(expected * 10) / 10 },
  ]
  return { data, metricLabel: unit ? `${metricLabel} (${unit})` : metricLabel, delta: expected - baseline }
}

function ImpactChart({ report }: { report: Report | null }) {
  const { data, metricLabel, delta } = useMemo(() => buildPredictionSeries(report), [report])
  const improvement = delta >= 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2)

  return (
    <Card>
      <CardHeader>
        <CardTitle>핵심 KPI 영향도 예측</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-xs text-muted-foreground">
          {metricLabel} 기준 2주 예측 Δ {improvement}
        </div>
        <ChartContainer
          config={{
            baseline: { label: "현재 추세", color: "hsl(var(--muted-foreground))" },
            projected: { label: "실행 시 예측", color: "hsl(var(--primary))" },
          }}
          className="w-full"
        >
          <LineChart data={data} margin={{ left: 12, right: 12 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="name" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} domain={["auto", "auto"]} />
            <ChartTooltip cursor content={<ChartTooltipContent />} />
            <Line type="monotone" dataKey="baseline" stroke="var(--color-baseline)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="projected" stroke="var(--color-projected)" strokeWidth={2} dot />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

function RadarPentagon({ scores }: { scores?: RadarScore[] }) {
  const normalizedScores = useMemo(() => {
    const map: Partial<Record<RadarAxisKey, RadarScore>> = {}
    for (const item of scores || []) {
      const axisKey = normalizeRadarAxis(item.axis)
      if (axisKey) {
        map[axisKey] = item
      }
    }
    return map
  }, [scores])

  const data = RADAR_AXIS_KEYS.map((axis) => {
    const found = normalizedScores[axis]
    return {
      axis: RADAR_AXIS_LABELS[axis],
      score: typeof found?.score === "number" ? found.score : 50,
      commentary: found?.commentary || "데이터 부족",
    }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>5각형 분포 점수</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ChartContainer
          config={{
            score: { label: "점수", color: "hsl(var(--primary))" },
          }}
          className="h-[320px] w-full"
        >
          <RadarChart data={data}>
            <PolarGrid strokeDasharray="3 3" />
            <PolarAngleAxis dataKey="axis" />
            <PolarRadiusAxis angle={90} domain={[0, 100]} tickCount={6} />
            <Radar
              name="score"
              dataKey="score"
              stroke="var(--color-score)"
              fill="var(--color-score)"
              fillOpacity={0.25}
            />
          </RadarChart>
        </ChartContainer>
        <div className="space-y-2 text-sm text-muted-foreground">
          {data.map((item) => (
            <div key={item.axis} className="flex items-center justify-between">
              <span>{item.axis}</span>
              <span className="font-medium text-foreground">{item.score}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
