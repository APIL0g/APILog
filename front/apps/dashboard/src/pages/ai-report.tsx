"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ThemeToggle } from "@/components/theme-toggle"
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts"

type TrafficDiagnosis = {
  focus: string
  finding: string
  widget: string
  severity?: string
  share?: string
  insight?: string
  delta_pct?: number
}

type PageIssue = {
  page: string
  issue: string
  dwell_time?: string
  exit_rate?: string
  insight?: string
  widget?: string
}

type ErrorAnalysisItem = {
  path: string
  browser: string
  error_rate: number
  detail?: string
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
  partial_failures?: string[]
  trend?: ReportTrendMeta
  fallback?: boolean
  [key: string]: any
}

type HealthScore = {
  stability: number | null
  engagement: number | null
  content_consumption: number | null
  retention: number | null
  interactivity: number | null
}

type Report = {
  generated_at: string
  title: string
  summary?: string
  health_score?: HealthScore | null
  diagnostics?: TrafficDiagnosis[]
  page_issues?: PageIssue[]
  error_analysis?: ErrorAnalysisItem[]
  ux_recommendations?: Recommendation[]
  tech_recommendations?: Recommendation[]
  priorities?: Priority[]
  metrics_to_track?: MetricWatch[]
  meta?: ReportMeta
}

type LanguageCode = "en" | "ko"
const LANGUAGE_STORAGE_KEY = "dashboard-language"
const LANGUAGE_LABELS: Record<LanguageCode, string> = { en: "English", ko: "한국어" }

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
  partialFailures: string
  envDiagnosticsTitle: string
  noDiagnostics: string
  sourceWidget: string
  pageIssuesTitle: string
  noPageIssues: string
  dwellLabel: string
  exitLabel: string
  errorAnalysisTitle: string
  noErrors: string
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
  analysisWindow: string
  errorReportTitle: string
  errorReportRetry: string
  healthScoreTitle: string
  healthInsufficient: string
  hsStability: string
  hsEngagement: string
  hsContentConsumption: string
  hsRetention: string
  hsInteractivity: string
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
    partialFailures: "Incomplete sections",
    envDiagnosticsTitle: "Environment health diagnostics",
    noDiagnostics: "No diagnostics available.",
    sourceWidget: "Source widget",
    pageIssuesTitle: "Pages with elevated exits",
    noPageIssues: "No dwell/exit anomalies.",
    dwellLabel: "Dwell",
    exitLabel: "Exit",
    errorAnalysisTitle: "Error analysis by path & browser",
    noErrors: "No significant errors detected.",
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
    analysisWindow: "Analysis window",
    errorReportTitle: "Report generation failed",
    errorReportRetry: "Please try again. If the problem persists, check LLM provider settings.",
    healthScoreTitle: "Health Score",
    healthInsufficient: "Insufficient data",
    hsStability: "Stability",
    hsEngagement: "Engagement",
    hsContentConsumption: "Content",
    hsRetention: "Retention",
    hsInteractivity: "Interactivity",
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
    partialFailures: "불완전한 섹션",
    envDiagnosticsTitle: "환경 진단",
    noDiagnostics: "진단 정보가 없습니다.",
    sourceWidget: "데이터 출처",
    pageIssuesTitle: "이탈이 높은 페이지",
    noPageIssues: "이탈 이상이 없습니다.",
    dwellLabel: "체류",
    exitLabel: "이탈",
    errorAnalysisTitle: "경로·브라우저별 에러 분석",
    noErrors: "유의미한 에러가 감지되지 않았습니다.",
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
    analysisWindow: "분석 기간",
    errorReportTitle: "리포트 생성 실패",
    errorReportRetry: "다시 시도해주세요. 문제가 지속되면 LLM 설정을 확인하세요.",
    healthScoreTitle: "Health Score",
    healthInsufficient: "데이터 부족",
    hsStability: "안정성",
    hsEngagement: "참여도",
    hsContentConsumption: "콘텐츠 소비",
    hsRetention: "유지력",
    hsInteractivity: "상호작용",
  },
}

const SEVERITY_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  high: "destructive",
  medium: "default",
  low: "secondary",
}

function nowIso() {
  return new Date().toISOString().replace(/\..*/, "")
}

const AI_REPORT_STORAGE_KEY = "ai-report-data"

export default function AIReportPage() {
  const [prompt, setPrompt] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [language, setLanguage] = useState<LanguageCode>("en")
  const copy = COPY[language]

  const [defaultRange, setDefaultRange] = useState(() => {
    const to = new Date()
    const from = new Date(Date.now() - 24 * 60 * 60 * 1000)
    return { from: from.toISOString().replace(/\..*/, ""), to: to.toISOString().replace(/\..*/, ""), bucket: "1h" }
  })

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const stored = window.localStorage?.getItem(AI_REPORT_STORAGE_KEY)
      if (!stored) return
      const parsed: { report?: Report; prompt?: string; range?: typeof defaultRange; language?: LanguageCode } = JSON.parse(stored)
      if (parsed.prompt) setPrompt(parsed.prompt)
      if (parsed.report) setReport(parsed.report)
      if (parsed.range?.from && parsed.range?.to) setDefaultRange(parsed.range)
      if (parsed.language === "ko" || parsed.language === "en") setLanguage(parsed.language)
    } catch (err) {
      console.warn("Failed to restore AI report state", err)
    }
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

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      window.localStorage?.setItem(
        AI_REPORT_STORAGE_KEY,
        JSON.stringify({ prompt, report, range: defaultRange, language }),
      )
    } catch (err) {
      console.warn("Failed to persist AI report state", err)
    }
  }, [prompt, report, defaultRange, language])

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
    } finally {
      setLoading(false)
    }
  }

  const isErrorMode = report?.meta?.mode === "error"

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <img src="/dashboard-logo.png" alt="ApiLog" className="h-8" />
            <div className="h-6 w-px bg-border" />
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-foreground">{copy.headerTitle}</h1>
              <p className="text-sm text-muted-foreground">{copy.headerSubtitle}</p>
            </div>
          </div>
          <div className="flex w-full flex-row flex-wrap items-center justify-end gap-2 sm:w-auto">
            <Select value={language} onValueChange={(value) => (value === "ko" || value === "en" ? setLanguage(value) : null)}>
              <SelectTrigger className="w-full min-w-[160px] sm:w-[140px]" aria-label={copy.languageLabel}>
                <SelectValue placeholder={copy.languageLabel}>{LANGUAGE_LABELS[language]}</SelectValue>
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="ko">한국어</SelectItem>
              </SelectContent>
            </Select>
            <ThemeToggle />
            <Button
              variant="outline"
              onClick={() => {
                try {
                  globalThis.location.hash = "#/"
                } catch (err) {
                  console.error("Failed to navigate to dashboard", err)
                }
              }}
              className="w-full sm:w-auto"
            >
              {copy.backToDashboard}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
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

        {report && isErrorMode && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">{copy.errorReportTitle}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {report.summary && <p className="text-sm">{report.summary}</p>}
              <p className="text-sm text-muted-foreground">{copy.errorReportRetry}</p>
              <Button onClick={handleGenerate} disabled={loading} variant="outline">
                {loading ? copy.generatingButton : copy.generateButton}
              </Button>
            </CardContent>
          </Card>
        )}

        {report && !isErrorMode && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <Card>
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="flex items-center gap-2">
                    {report.title}
                    <Badge variant="secondary" className="uppercase">
                      {report?.meta?.model || report?.meta?.provider || "AI"}
                    </Badge>
                    {report?.meta?.mode === "template" && <Badge variant="outline">Template</Badge>}
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
                        {copy.trafficChangeLabel}: {report.meta.trend.label || "-"} ({"\u0394"} {formatPercentDelta(report.meta.trend.change_pct)})
                      </div>
                    )}
                    {report.meta?.missing_widgets?.length ? (
                      <div>
                        {copy.missingWidgets}: {report.meta.missing_widgets.join(", ")}
                      </div>
                    ) : null}
                    {report.meta?.partial_failures?.length ? (
                      <div className="text-amber-600">
                        {copy.partialFailures}: {report.meta.partial_failures.join(", ")}
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              <ReportSection<TrafficDiagnosis>
                title={copy.envDiagnosticsTitle}
                items={report.diagnostics || []}
                emptyText={copy.noDiagnostics}
                keyFn={(diag, i) => `${diag.focus}-${i}`}
              >
                {(diag) => (
                  <div className="rounded-md border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{diag.focus}</span>
                        {typeof diag.delta_pct === "number" && (
                          <span className={`text-xs font-semibold ${diag.delta_pct > 0 ? "text-emerald-600" : diag.delta_pct < 0 ? "text-red-500" : "text-muted-foreground"}`}>
                            {diag.delta_pct > 0 ? "\u25B2" : diag.delta_pct < 0 ? "\u25BC" : ""} {Math.abs(diag.delta_pct).toFixed(1)}%
                          </span>
                        )}
                      </div>
                      <Badge variant={severityVariant(diag.severity)}>{diag.severity || "Info"}</Badge>
                    </div>
                    <div className="text-sm">{diag.finding}</div>
                    <div className="text-xs text-muted-foreground">
                      {copy.sourceWidget}: {diag.widget}
                      {diag.share ? ` \u00b7 ${diag.share}` : ""}
                    </div>
                    {diag.insight && <div className="text-xs text-muted-foreground">{diag.insight}</div>}
                  </div>
                )}
              </ReportSection>

              <ReportSection<PageIssue>
                title={copy.pageIssuesTitle}
                items={report.page_issues || []}
                emptyText={copy.noPageIssues}
                keyFn={(page, i) => `${page.page}-${i}`}
              >
                {(page) => {
                  const dwellText = page.dwell_time && page.dwell_time !== "-" ? page.dwell_time : null
                  const exitText = page.exit_rate && page.exit_rate !== "-" ? page.exit_rate : null
                  return (
                    <div className="rounded-md border p-3 space-y-1.5">
                      <div className="flex items-center justify-between text-sm font-medium">
                        <span>{page.page}</span>
                        <Badge variant="outline">{page.widget || "page_exit_rate"}</Badge>
                      </div>
                      <div className="text-sm">{page.issue}</div>
                      {(dwellText || exitText) && (
                        <div className="text-xs text-muted-foreground">
                          {dwellText ? `${copy.dwellLabel}: ${dwellText}` : ""}
                          {dwellText && exitText ? " \u00b7 " : ""}
                          {exitText ? `${copy.exitLabel}: ${exitText}` : ""}
                        </div>
                      )}
                      {page.insight && <div className="text-xs text-muted-foreground">{page.insight}</div>}
                    </div>
                  )
                }}
              </ReportSection>

              <ReportSection<ErrorAnalysisItem>
                title={copy.errorAnalysisTitle}
                items={report.error_analysis || []}
                emptyText={copy.noErrors}
                keyFn={(err, i) => `${err.path}-${err.browser}-${i}`}
              >
                {(err) => (
                  <div className="rounded-md border p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-sm font-medium">
                      <span>{err.path}</span>
                      <Badge variant={err.error_rate >= 5 ? "destructive" : "default"}>
                        {err.error_rate.toFixed(1)}%
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">{err.browser}</div>
                    {err.detail && <div className="text-sm">{err.detail}</div>}
                  </div>
                )}
              </ReportSection>

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
              {report.health_score && <HealthScoreCard score={report.health_score} copy={copy} />}

              <ReportSection<Priority>
                title={copy.prioritiesTitle}
                items={report.priorities || []}
                emptyText={copy.noPriorities}
                keyFn={(p, i) => `${p.title}-${i}`}
              >
                {(p) => (
                  <div className="rounded-md border p-3 space-y-1.5">
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
                )}
              </ReportSection>

              <ReportSection<MetricWatch>
                title={copy.metricsTitle}
                items={report.metrics_to_track || []}
                emptyText={copy.noMetrics}
                keyFn={(m, i) => `${m.metric}-${i}`}
              >
                {(metric) => (
                  <div className="rounded-md border p-3 space-y-1">
                    <div className="flex items-center justify-between text-sm font-medium">
                      <span>{metric.metric}</span>
                      {metric.target_change && <Badge variant="outline">{metric.target_change}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {copy.widgetLabel}: {metric.widget} {metric.timeframe ? ` - Period ${metric.timeframe}` : ""}
                    </div>
                    <div className="text-sm">{metric.reason}</div>
                  </div>
                )}
              </ReportSection>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

const HEALTH_AXIS_KEYS: (keyof HealthScore)[] = ["stability", "engagement", "content_consumption", "retention", "interactivity"]

function HealthScoreCard({ score, copy }: { score: HealthScore; copy: Copy }) {
  const labelMap: Record<keyof HealthScore, string> = {
    stability: copy.hsStability,
    engagement: copy.hsEngagement,
    content_consumption: copy.hsContentConsumption,
    retention: copy.hsRetention,
    interactivity: copy.hsInteractivity,
  }

  const data = HEALTH_AXIS_KEYS.map((key) => ({
    axis: labelMap[key],
    value: score[key] ?? 0,
    isNull: score[key] === null || score[key] === undefined,
  }))

  const hasAnyData = data.some((d) => !d.isNull)
  const nullAxes = data.filter((d) => d.isNull)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.healthScoreTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasAnyData ? (
          <div className="text-sm text-muted-foreground">{copy.healthInsufficient}</div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
                <PolarGrid
                  gridType="polygon"
                  stroke="hsl(var(--border))"
                  strokeWidth={1}
                  radialLines={true}
                  polarRadius={[20, 40, 60, 80, 100].map((v) => v * 0.7)}
                />
                <PolarAngleAxis
                  dataKey="axis"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))", fontWeight: 500 }}
                  axisLine={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1.5, strokeOpacity: 0.5 }}
                />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 100]}
                  tick={false}
                  axisLine={false}
                />
                <Radar
                  name="Health"
                  dataKey="value"
                  stroke="hsl(142, 71%, 45%)"
                  fill="hsl(142, 71%, 45%)"
                  fillOpacity={0.2}
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "hsl(142, 71%, 45%)", strokeWidth: 0 }}
                />
              </RadarChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-3">
              {data.map((d) => (
                <div key={d.axis} className="text-center min-w-[80px]">
                  <div className={`text-lg font-bold ${d.isNull ? "text-muted-foreground" : scoreColor(d.value)}`}>
                    {d.isNull ? "—" : d.value.toFixed(0)}
                  </div>
                  <div className="text-xs text-muted-foreground">{d.axis}</div>
                </div>
              ))}
            </div>
            {nullAxes.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {copy.healthInsufficient}: {nullAxes.map((d) => d.axis).join(", ")}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function scoreColor(value: number): string {
  if (value >= 80) return "text-emerald-600"
  if (value >= 50) return "text-amber-500"
  return "text-red-500"
}

function ReportSection<T>({
  title, items, emptyText, keyFn, children, contentClassName,
}: {
  title: string
  items: T[]
  emptyText: string
  keyFn: (item: T, index: number) => string
  children: (item: T, index: number) => React.ReactNode
  contentClassName?: string
}) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className={contentClassName || "space-y-3"}>
        {items.length === 0 && <div className="text-sm text-muted-foreground">{emptyText}</div>}
        {items.map((item, i) => <div key={keyFn(item, i)}>{children(item, i)}</div>)}
      </CardContent>
    </Card>
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
