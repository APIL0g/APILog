"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ThemeToggle } from "@/components/theme-toggle"
import { useTheme } from "@/components/theme-provider"
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

const RADAR_AXIS_KEYS = ["performance", "experience", "growth", "search", "stability"] as const
type RadarAxisKey = typeof RADAR_AXIS_KEYS[number]
const BASE_RADAR_AXIS_LABELS: Record<RadarAxisKey, string> = {
  performance: "Performance",
  experience: "User Experience",
  growth: "Growth / Conversion",
  search: "Search Visibility",
  stability: "Technical Stability",
}

type LanguageCode = "en" | "ko"
const LANGUAGE_STORAGE_KEY = "dashboard-language"
const LANGUAGE_LABELS: Record<LanguageCode, string> = { en: "English", ko: "한국어" }
const RADAR_CHART_LABELS: Record<LanguageCode, Record<RadarAxisKey, string>> = {
  en: {
    performance: "Performance",
    experience: "User Exp",
    growth: "Growth / Conversion",
    search: "Search Visibility",
    stability: "Stability",
  },
  ko: {
    performance: "성능",
    experience: "사용자 경험",
    growth: "전환 / 성장",
    search: "검색 가시성",
    stability: "기술 안정성",
  },
}
const RADAR_LABELS: Record<LanguageCode, Record<RadarAxisKey, string>> = {
  en: {
    performance: "Performance",
    experience: "User Experience",
    growth: "Growth / Conversion",
    search: "Search Visibility",
    stability: "Technical Stability",
  },
  ko: {
    performance: "성능",
    experience: "사용자 경험",
    growth: "전환 / 성장",
    search: "검색 가시성",
    stability: "기술 안정성",
  },
}

type Copy = {
  headerTitle: string
  headerSubtitle: string
  languageLabel: string
  backToDashboard: string
  generateCardTitle: string
  analystNote: string
  promptPlaceholder: string
  timeRangeLabel: string
  timeStart: string
  timeEnd: string
  timeInterval: string
  generateButton: string
  generatingButton: string
  generatedAt: string
  trafficChangeLabel: string
  missingWidgets: string
  impactChartTitle: string
  envDiagnosticsTitle: string
  noDiagnostics: string
  sourceWidget: string
  pageIssuesTitle: string
  noPageIssues: string
  dwellLabel: string
  exitLabel: string
  interactionTitle: string
  noInteractions: string
  recommendationsTitle: string
  designColumnTitle: string
  techColumnTitle: string
  noRecommendations: string
  prioritiesTitle: string
  noPriorities: string
  effortLabel: string
  metricsTitle: string
  noMetrics: string
  widgetLabel: string
  predictionsTitle: string
  noPredictions: string
  radarTitle: string
  analysisWindow: string
}

const COPY: Record<LanguageCode, Copy> = {
  en: {
    headerTitle: "AI Diagnostic Report",
    headerSubtitle: "Uses live widget data to surface issues and suggest concrete fixes.",
    languageLabel: "Language",
    backToDashboard: "Back to dashboard",
    generateCardTitle: "Generate AI report",
    analystNote: "Analyst note (optional)",
    promptPlaceholder: "Ex: Diagnose mobile Chrome exits first and list performance quick wins.",
    timeRangeLabel: "Time range (UTC)",
    timeStart: "Start",
    timeEnd: "End",
    timeInterval: "Interval",
    generateButton: "Generate Report",
    generatingButton: "Generating...",
    generatedAt: "Generated at",
    trafficChangeLabel: "Traffic change",
    missingWidgets: "Missing widgets (no data)",
    impactChartTitle: "Projected KPI impact",
    envDiagnosticsTitle: "Environment health diagnostics",
    noDiagnostics: "No diagnostics available.",
    sourceWidget: "Source widget",
    pageIssuesTitle: "Pages with elevated exits",
    noPageIssues: "No dwell/exit anomalies.",
    dwellLabel: "Dwell",
    exitLabel: "Exit",
    interactionTitle: "Interaction and heatmap insights",
    noInteractions: "No interaction anomalies.",
    recommendationsTitle: "Actionable recommendations",
    designColumnTitle: "Design / UX",
    techColumnTitle: "Performance / Engineering",
    noRecommendations: "No recommendations available.",
    prioritiesTitle: "Priorities & expected impact",
    noPriorities: "No prioritized actions.",
    effortLabel: "Effort",
    metricsTitle: "Key metrics to watch",
    noMetrics: "No metrics defined.",
    widgetLabel: "Widget",
    predictionsTitle: "Projected performance",
    noPredictions: "Not enough data to project.",
    radarTitle: "Experience radar (0-100)",
    analysisWindow: "Analysis window",
  },
  ko: {
    headerTitle: "AI 진단 리포트",
    headerSubtitle: "실시간 위젯 데이터를 분석해 문제를 찾고 실행 방향을 제안합니다.",
    languageLabel: "언어",
    backToDashboard: "대시보드로 돌아가기",
    generateCardTitle: "AI 리포트 생성",
    analystNote: "분석 메모 (선택)",
    promptPlaceholder: "예: 모바일 Chrome 이탈 원인을 먼저 분석하고 성능 개선안을 정리해줘.",
    timeRangeLabel: "분석 기간 (UTC)",
    timeStart: "시작",
    timeEnd: "종료",
    timeInterval: "집계 간격",
    generateButton: "리포트 생성",
    generatingButton: "생성 중...",
    generatedAt: "생성 시각",
    trafficChangeLabel: "트래픽 변화",
    missingWidgets: "데이터 없음 위젯",
    impactChartTitle: "예상 KPI 영향",
    envDiagnosticsTitle: "환경 진단",
    noDiagnostics: "진단 정보가 없습니다.",
    sourceWidget: "데이터 출처",
    pageIssuesTitle: "이탈이 높은 페이지",
    noPageIssues: "이탈 이상이 없습니다.",
    dwellLabel: "체류",
    exitLabel: "이탈",
    interactionTitle: "인터랙션 및 히트맵 인사이트",
    noInteractions: "인터랙션 이상이 없습니다.",
    recommendationsTitle: "실행 가능한 권고안",
    designColumnTitle: "디자인 / UX",
    techColumnTitle: "성능 / 엔지니어링",
    noRecommendations: "권고안이 없습니다.",
    prioritiesTitle: "우선순위 및 기대 효과",
    noPriorities: "우선순위가 없습니다.",
    effortLabel: "투입도",
    metricsTitle: "주시해야 할 지표",
    noMetrics: "정의된 지표가 없습니다.",
    widgetLabel: "위젯",
    predictionsTitle: "예상 성과",
    noPredictions: "예측할 데이터가 부족합니다.",
    radarTitle: "경험 레이더 (0-100)",
    analysisWindow: "분석 기간",
  },
}

// Allow LLM responses that localize axis labels to still map onto our canonical axes.
const RADAR_AXIS_NORMALIZERS: Array<{ key: RadarAxisKey; matches: string[] }> = [
  {
    key: "performance",
    matches: ["performance", "perf", "speed", BASE_RADAR_AXIS_LABELS.performance],
  },
  {
    key: "experience",
    matches: ["experience", "ux", BASE_RADAR_AXIS_LABELS.experience, "ux/ui"],
  },
  {
    key: "growth",
    matches: ["growth", "acquisition", BASE_RADAR_AXIS_LABELS.growth],
  },
  {
    key: "search",
    matches: ["search", "seo", BASE_RADAR_AXIS_LABELS.search],
  },
  {
    key: "stability",
    matches: ["stability", "reliability", BASE_RADAR_AXIS_LABELS.stability],
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
  const [language, setLanguage] = useState<LanguageCode>("en")
  const copy = COPY[language]

  const defaultRange = useMemo(() => {
    const to = new Date()
    const from = new Date(Date.now() - 24 * 60 * 60 * 1000)
    return { from: from.toISOString().replace(/\..*/, ""), to: to.toISOString().replace(/\..*/, ""), bucket: "1h" }
  }, [])

  useEffect(() => {
    const stored = window.localStorage?.getItem(LANGUAGE_STORAGE_KEY)
    if (stored === "ko" || stored === "en") {
      setLanguage(stored)
      return
    }
    const locales: string[] = []
    if (Array.isArray(window.navigator.languages)) {
      locales.push(...window.navigator.languages)
    }
    if (window.navigator.language) {
      locales.push(window.navigator.language)
    }
    if (locales.some((loc) => loc?.toLowerCase().startsWith("ko"))) {
      setLanguage("ko")
    }
  }, [])

  useEffect(() => {
    window.localStorage?.setItem(LANGUAGE_STORAGE_KEY, language)
  }, [language])

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
          language,
          audience: "dev",
          word_limit: 700,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as Report
      setReport(data)
    } catch (e: any) {
      setError(e?.message || "Failed to generate the report. Please try again.")
      setReport({
        generated_at: nowIso(),
        title: "AI Traffic Diagnosis Report",
        summary: "Widget data is unavailable, so we are showing a sample. Please verify the log pipeline and try again.",
        diagnostics: [],
        page_issues: [],
        interaction_insights: [],
        ux_recommendations: [],
        tech_recommendations: [],
        priorities: [],
        metrics_to_track: [
          { metric: "Page exit rate", widget: "page_exit_rate", reason: "Confirms whether exits decrease" },
          { metric: "Top page dwell time", widget: "time_top_pages", reason: "Validates UX improvements" },
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
              <h1 className="text-xl font-semibold text-foreground">{copy.headerTitle}</h1>
              <p className="text-sm text-muted-foreground">{copy.headerSubtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={language} onValueChange={(value) => (value === "ko" || value === "en" ? setLanguage(value) : null)}>
              <SelectTrigger className="w-[140px]" aria-label={copy.languageLabel}>
                <SelectValue placeholder={copy.languageLabel}>{LANGUAGE_LABELS[language]}</SelectValue>
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="ko">한국어</SelectItem>
              </SelectContent>
            </Select>
            <ThemeToggle />
            <Button variant="outline" onClick={() => (globalThis.location.hash = "#/")}>
              {copy.backToDashboard}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 p-6">
        <Card>
          <CardHeader>
            <CardTitle>{copy.generateCardTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm text-muted-foreground">{copy.analystNote}</label>
                <Textarea
                  placeholder={copy.promptPlaceholder}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="min-h-24"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">{copy.timeRangeLabel}</label>
                <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
                  <div className="text-sm text-foreground font-medium">
                    {formatPrettyDate(defaultRange.from, language)} → {formatPrettyDate(defaultRange.to, language)}
                  </div>
                  <div>
                    {copy.timeInterval}: {defaultRange.bucket || "-"}
                  </div>
                </div>
                <Button onClick={handleGenerate} disabled={loading} className="w-full">
                  {loading ? copy.generatingButton : copy.generateButton}
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
                  <div className="text-sm text-muted-foreground">
                    {copy.generatedAt}: {formatHumanDate(report.generated_at, language)}
                  </div>
                  {report.summary && <p className="whitespace-pre-wrap leading-7">{report.summary}</p>}
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {formatTimeWindow(report.meta, copy, language)}
                    {report.meta?.trend && (
                      <div>
                        {copy.trafficChangeLabel}: {report.meta.trend.label || "-"} (Δ {formatPercentDelta(report.meta.trend.change_pct)})
                      </div>
                    )}
                    {report.meta?.missing_widgets?.length ? (
                      <div>
                        {copy.missingWidgets}: {report.meta.missing_widgets.join(", ")}
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              <ImpactChart report={report} title={copy.impactChartTitle} />

              <Card>
                <CardHeader>
                  <CardTitle>{copy.envDiagnosticsTitle}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(report.diagnostics || []).length === 0 && (
                    <div className="text-sm text-muted-foreground">{copy.noDiagnostics}</div>
                  )}
                  {(report.diagnostics || []).map((diag, i) => (
                    <div key={`${diag.focus}-${i}`} className="rounded-md border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">{diag.focus}</div>
                        <Badge variant={severityVariant(diag.severity)}>{diag.severity || "Info"}</Badge>
                      </div>
                      <div className="text-sm">{diag.finding}</div>
                      <div className="text-xs text-muted-foreground">
                        {copy.sourceWidget}: {diag.widget}
                        {diag.share ? ` · ${diag.share}` : ""}
                      </div>
                      {diag.insight && <div className="text-xs text-muted-foreground">{diag.insight}</div>}
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{copy.pageIssuesTitle}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(report.page_issues || []).length === 0 && (
                    <div className="text-sm text-muted-foreground">{copy.noPageIssues}</div>
                  )}
                  {(report.page_issues || []).map((page, i) => {
                    const dwellText = page.dwell_time && page.dwell_time !== "-" ? page.dwell_time : null
                    const exitText = page.exit_rate && page.exit_rate !== "-" ? page.exit_rate : null
                    return (
                      <div key={`${page.page}-${i}`} className="rounded-md border p-3 space-y-1.5">
                        <div className="flex items-center justify-between text-sm font-medium">
                          <span>{page.page}</span>
                          <Badge variant="outline">{page.widget || "page_exit_rate"}</Badge>
                        </div>
                        <div className="text-sm">{page.issue}</div>
                        {(dwellText || exitText) && (
                          <div className="text-xs text-muted-foreground">
                            {dwellText ? `${copy.dwellLabel}: ${dwellText}` : ""}
                            {dwellText && exitText ? " · " : ""}
                            {exitText ? `${copy.exitLabel}: ${exitText}` : ""}
                          </div>
                        )}
                        {page.insight && <div className="text-xs text-muted-foreground">{page.insight}</div>}
                      </div>
                    )
                  })}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{copy.interactionTitle}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(report.interaction_insights || []).length === 0 && (
                    <div className="text-sm text-muted-foreground">{copy.noInteractions}</div>
                  )}
                  {(report.interaction_insights || []).map((insight, i) => (
                    <div key={`${insight.area}-${i}`} className="rounded-md border p-3 space-y-1.5">
                      <div className="flex items-center justify-between text-sm font-medium">
                        <span>{insight.area}</span>
                        {insight.widget && <Badge variant="outline">{insight.widget}</Badge>}
                      </div>
                      <div className="text-sm">{insight.insight}</div>
                      {insight.action && <div className="text-xs text-muted-foreground">Action: {insight.action}</div>}
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{copy.recommendationsTitle}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <RecommendationColumn title={copy.designColumnTitle} items={report.ux_recommendations || []} emptyText={copy.noRecommendations} />
                  <RecommendationColumn title={copy.techColumnTitle} items={report.tech_recommendations || []} emptyText={copy.noRecommendations} />
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{copy.prioritiesTitle}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(report.priorities || []).length === 0 && (
                    <div className="text-sm text-muted-foreground">{copy.noPriorities}</div>
                  )}
                  {(report.priorities || []).map((p, i) => (
                    <div key={`${p.title}-${i}`} className="rounded-md border p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">{p.title}</div>
                        <Badge variant={priorityVariant(p.priority)}>{p.priority}</Badge>
                      </div>
                      <div className="text-sm">{p.impact}</div>
                      <div className="text-xs text-muted-foreground">
                        {copy.effortLabel}: {p.effort || "-"}
                        {p.business_outcome ? ` - ${p.business_outcome}` : ""}
                      </div>
                      {p.expected_metric_change && (
                        <div className="text-xs text-muted-foreground">
                          Target metric: {p.expected_metric_change.metric || "-"} {p.expected_metric_change.target || ""}
                          {p.expected_metric_change.period ? ` / ${p.expected_metric_change.period}` : ""}
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{copy.metricsTitle}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(report.metrics_to_track || []).length === 0 && (
                    <div className="text-sm text-muted-foreground">{copy.noMetrics}</div>
                  )}
                  {(report.metrics_to_track || []).map((metric, i) => (
                    <div key={`${metric.metric}-${i}`} className="rounded-md border p-3 space-y-1">
                      <div className="flex items-center justify-between text-sm font-medium">
                        <span>{metric.metric}</span>
                        {metric.target_change && <Badge variant="outline">{metric.target_change}</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {copy.widgetLabel}: {metric.widget} {metric.timeframe ? ` - Period ${metric.timeframe}` : ""}
                      </div>
                      <div className="text-sm">{metric.reason}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{copy.predictionsTitle}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(report.predictions || []).length === 0 && (
                    <div className="text-sm text-muted-foreground">{copy.noPredictions}</div>
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
                        Now {formatNumber(pred.baseline)}
                        {pred.unit || ""} -&gt; Expected {formatNumber(pred.expected)}
                        {pred.unit || ""}
                      </div>
                      {pred.narrative && <div className="text-sm">{pred.narrative}</div>}
                    </div>
                  ))}
                </CardContent>
              </Card>

              <RadarPentagon scores={report.radar_scores} title={copy.radarTitle} language={language} />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function RecommendationColumn({ title, items, emptyText }: { title: string; items: Recommendation[]; emptyText: string }) {
  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold">{title}</div>
      {items.length === 0 && <div className="text-sm text-muted-foreground">{emptyText}</div>}
      {items.map((item, i) => (
        <div key={`${item.suggestion}-${i}`} className="rounded-md border p-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{item.category}</span>
          </div>
          <div className="text-sm">{item.suggestion}</div>
        {item.rationale && <div className="text-xs text-muted-foreground">Rationale: {item.rationale}</div>}
        {item.validation && <div className="text-xs text-muted-foreground">Validation: {item.validation}</div>}
        </div>
      ))}
    </div>
  )
}

function formatTimeWindow(meta?: ReportMeta, copy?: Copy, locale: LanguageCode = "en") {
  if (!meta?.time?.from || !meta.time?.to) return null
  const { from, to, bucket } = meta.time
  const info = buildHumanRange(from, to, bucket, locale)
  return (
    <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
      <div className="text-sm font-medium text-foreground">
        {copy?.analysisWindow ? `${copy.analysisWindow}: ${info.primary}` : info.primary}
      </div>
      <div>{info.secondary}</div>
    </div>
  )
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

function formatPrettyDate(value?: string, locale: LanguageCode = "en") {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  const intlLocale = locale === "ko" ? "ko-KR" : "en-US"
  const options: Intl.DateTimeFormatOptions =
    locale === "ko"
      ? { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }
      : { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
  return new Intl.DateTimeFormat(intlLocale, options).format(date)
}

function formatHumanDate(value?: string, locale: LanguageCode = "en") {
  return formatPrettyDate(value, locale)
}

function describeRange(from?: string, to?: string) {
  if (!from || !to) return null
  const start = new Date(from)
  const end = new Date(to)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  const diffMs = Math.abs(end.getTime() - start.getTime())
  const hours = Math.round(diffMs / (1000 * 60 * 60))
  return { hours, days: hours / 24 }
}

function buildHumanRange(from?: string, to?: string, bucket?: string, locale: LanguageCode = "en") {
  const diff = describeRange(from, to)
  const fromPretty = formatPrettyDate(from, locale)
  const toPretty = formatPrettyDate(to, locale)
  if (!diff) {
    return {
      primary: locale === "ko" ? `기간 없음` : "No time window",
      secondary: `${fromPretty} → ${toPretty}`,
    }
  }
  const intervalText = bucket || "-"
  if (locale === "ko") {
    const spanText = diff.days >= 1 ? `최근 ${diff.days}일` : `최근 ${diff.hours}시간`
    return {
      primary: `${spanText} · ${intervalText} 단위`,
      secondary: `${fromPretty} → ${toPretty}`,
    }
  }
  const spanText = diff.hours >= 24 ? `Last ${diff.days}d` : `Last ${diff.hours}h`
  return {
    primary: `${spanText} · ${intervalText} interval`,
    secondary: `${fromPretty} → ${toPretty}`,
  }
}

function buildPredictionSeries(report: Report | null) {
  const target = report?.predictions?.[0]
  const metricLabel = target?.metric || "Impact Index"
  const unit = target?.unit || ""
  const baseline = typeof target?.baseline === "number" ? target.baseline : 100
  const expected = typeof target?.expected === "number" ? target.expected : baseline * 1.05
  const midpoint = baseline + (expected - baseline) * 0.5
  const data = [
    { name: "Now", baseline, projected: baseline },
    { name: "+1 wk", baseline, projected: Math.round(midpoint * 10) / 10 },
    { name: "+2 wk", baseline, projected: Math.round(expected * 10) / 10 },
  ]
  return { data, metricLabel: unit ? `${metricLabel} (${unit})` : metricLabel, delta: expected - baseline }
}

function ImpactChart({ report, title }: { report: Report | null; title: string }) {
  const { theme } = useTheme()
  const { baselineColor, projectedColor, dotStroke, gridColor, axisColor } = useMemo(() => {
    const isDark = theme === "dark"
    return {
      baselineColor: isDark ? "rgba(248,250,252,0.5)" : "rgba(15,23,42,0.35)",
      projectedColor: isDark ? "rgba(167,210,255,0.75)" : "rgba(15,23,42,0.5)",
      dotStroke: isDark ? "rgba(2,6,23,0.85)" : "rgba(255,255,255,0.85)",
      gridColor: isDark ? "rgba(248,250,252,0.15)" : "rgba(15,23,42,0.08)",
      axisColor: isDark ? "rgba(248,250,252,0.6)" : "rgba(15,23,42,0.5)",
    }
  }, [theme])
  const { data, metricLabel, delta } = useMemo(() => buildPredictionSeries(report), [report])
  const improvement = delta >= 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-xs text-muted-foreground">
          {metricLabel} Two-week delta {improvement}
        </div>
        <ChartContainer
          config={{
            baseline: { label: "Current trend", color: baselineColor },
            projected: { label: "Projected after action", color: projectedColor },
          }}
          className="w-full"
        >
          <LineChart data={data} margin={{ left: 12, right: 12 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={gridColor} />
            <XAxis
              dataKey="name"
              tickLine={false}
              axisLine={{ stroke: axisColor }}
              tick={{ fill: axisColor }}
            />
            <YAxis
              tickLine={false}
              axisLine={{ stroke: axisColor }}
              tick={{ fill: axisColor }}
              domain={["auto", "auto"]}
            />
            <ChartTooltip cursor content={<ChartTooltipContent />} />
            <Line
              type="monotone"
              dataKey="baseline"
              stroke={baselineColor}
              strokeWidth={2}
              dot={{ r: 4, fill: baselineColor, stroke: dotStroke, strokeWidth: 2 }}
              activeDot={{ r: 5, fill: baselineColor, stroke: dotStroke, strokeWidth: 2 }}
            />
            <Line
              type="monotone"
              dataKey="projected"
              stroke={projectedColor}
              strokeWidth={2}
              dot={{ r: 4.5, fill: projectedColor, stroke: dotStroke, strokeWidth: 2 }}
              activeDot={{ r: 6, fill: projectedColor, stroke: dotStroke, strokeWidth: 2 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

function RadarPentagon({ scores, title, language }: { scores?: RadarScore[]; title: string; language: LanguageCode }) {
  const { theme } = useTheme()
  const { gridColor, axisColor, radarStroke, radarFill } = useMemo(() => {
    const isDark = theme === "dark"
    return {
      gridColor: isDark ? "rgba(248,250,252,0.18)" : "rgba(15,23,42,0.08)",
      axisColor: isDark ? "rgba(248,250,252,0.7)" : "rgba(15,23,42,0.65)",
      radarStroke: isDark ? "rgba(167,210,255,0.8)" : "rgba(15,23,42,0.55)",
      radarFill: isDark ? "rgba(167,210,255,0.22)" : "rgba(15,23,42,0.15)",
    }
  }, [theme])
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
      axisShort: RADAR_CHART_LABELS[language][axis],
      axisLong: RADAR_LABELS[language][axis],
      score: typeof found?.score === "number" ? found.score : 50,
      commentary: found?.commentary || "Insufficient data",
    }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ChartContainer
          config={{
            score: { label: "Score", color: radarStroke },
          }}
          className="h-[320px] w-full"
        >
          <RadarChart
            data={data}
            outerRadius="78%"
            margin={{ top: 16, right: 28, bottom: 16, left: 28 }}
          >
            <PolarGrid strokeDasharray="3 3" stroke={gridColor} />
            <PolarAngleAxis
              dataKey="axisShort"
              radius={92}
              stroke={axisColor}
              tickLine={false}
              tick={{ fill: axisColor, fontSize: 12 }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tickCount={6}
              stroke={axisColor}
              tick={{ fill: axisColor, fontSize: 10 }}
            />
            <Radar
              name="score"
              dataKey="score"
              stroke={radarStroke}
              strokeWidth={2}
              fill={radarFill}
              fillOpacity={1}
            />
          </RadarChart>
        </ChartContainer>
        <div className="space-y-2 text-sm text-muted-foreground">
          {data.map((item) => (
            <div key={item.axisLong} className="flex items-center justify-between">
              <span>{item.axisLong}</span>
              <span className="font-medium text-foreground">{item.score}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
