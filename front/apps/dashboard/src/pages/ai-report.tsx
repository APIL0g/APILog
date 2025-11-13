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
  performance: "Performance",
  experience: "User Experience",
  growth: "Growth / Conversion",
  search: "Search Visibility",
  stability: "Technical Stability",
}

type RadarAxisKey = keyof typeof RADAR_AXIS_LABELS

const RADAR_AXIS_KEYS = Object.keys(RADAR_AXIS_LABELS) as RadarAxisKey[]

// Allow LLM responses that localize axis labels to still map onto our canonical axes.
const RADAR_AXIS_NORMALIZERS: Array<{ key: RadarAxisKey; matches: string[] }> = [
  {
    key: "performance",
    matches: ["performance", "perf", "speed", RADAR_AXIS_LABELS.performance],
  },
  {
    key: "experience",
    matches: ["experience", "ux", RADAR_AXIS_LABELS.experience, "ux/ui"],
  },
  {
    key: "growth",
    matches: ["growth", "acquisition", RADAR_AXIS_LABELS.growth],
  },
  {
    key: "search",
    matches: ["search", "seo", RADAR_AXIS_LABELS.search],
  },
  {
    key: "stability",
    matches: ["stability", "reliability", RADAR_AXIS_LABELS.stability],
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
          language: "en",
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
              <h1 className="text-xl font-semibold text-foreground">AI Diagnostic Report</h1>
              <p className="text-sm text-muted-foreground">Synthesises live widget data to flag issues and recommend decisive actions.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => (globalThis.location.hash = "#/")}>
              Back to dashboard
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Generate Report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm text-muted-foreground">Analyst note (optional)</label>
                <Textarea
                  placeholder="Ex: Diagnose mobile Chrome exits first and list performance quick wins."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="min-h-24"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Time range</label>
                <div className="rounded-md border bg-muted/30 p-3 text-sm">
                  <div>From: {defaultRange.from}</div>
                  <div>To: {defaultRange.to}</div>
                  <div>Bucket: {defaultRange.bucket}</div>
                </div>
                <Button onClick={handleGenerate} disabled={loading} className="w-full">
                  {loading ? "Generating..." : "Generate Report"}
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
                  <div className="text-sm text-muted-foreground">Generated at: {report.generated_at}</div>
                  {report.summary && <p className="whitespace-pre-wrap leading-7">{report.summary}</p>}
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {formatTimeWindow(report.meta) && <div>{formatTimeWindow(report.meta)}</div>}
                    {report.meta?.trend && (
                      <div>
                        Traffic trend: {report.meta.trend.label || "-"} ({formatPercentDelta(report.meta.trend.change_pct)})
                      </div>
                    )}
                    {report.meta?.missing_widgets?.length ? (
                      <div>Missing widgets: {report.meta.missing_widgets.join(", ")}</div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              <ImpactChart report={report} />

              <Card>
                <CardHeader>
                  <CardTitle>Environment diagnostics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(report.diagnostics || []).length === 0 && (
                    <div className="text-sm text-muted-foreground">No diagnostics available.</div>
                  )}
                  {(report.diagnostics || []).map((diag, i) => (
                    <div key={`${diag.focus}-${i}`} className="rounded-md border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">{diag.focus}</div>
                        <Badge variant={severityVariant(diag.severity)}>{diag.severity || "Info"}</Badge>
                      </div>
                      <div className="text-sm">{diag.finding}</div>
                      <div className="text-xs text-muted-foreground">
                        Source widget: {diag.widget}
                        {diag.share ? ` - Share ${diag.share}` : ""}
                      </div>
                      {diag.insight && <div className="text-xs text-muted-foreground">{diag.insight}</div>}
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Problem pages</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(report.page_issues || []).length === 0 && (
                    <div className="text-sm text-muted-foreground">No dwell/exit anomalies.</div>
                  )}
                  {(report.page_issues || []).map((page, i) => (
                    <div key={`${page.page}-${i}`} className="rounded-md border p-3 space-y-1.5">
                      <div className="flex items-center justify-between text-sm font-medium">
                        <span>{page.page}</span>
                        <Badge variant="outline">{page.widget || "page_exit_rate"}</Badge>
                      </div>
                      <div className="text-sm">{page.issue}</div>
                      <div className="text-xs text-muted-foreground">
                        Dwell: {page.dwell_time || "-"} - Exit: {page.exit_rate || "-"}
                      </div>
                      {page.insight && <div className="text-xs text-muted-foreground">{page.insight}</div>}
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Interaction & heatmap insights</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(report.interaction_insights || []).length === 0 && (
                    <div className="text-sm text-muted-foreground">No interaction anomalies.</div>
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
                  <CardTitle>Actionable recommendations</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <RecommendationColumn title="Design / UX" items={report.ux_recommendations || []} />
                  <RecommendationColumn title="Performance / Engineering" items={report.tech_recommendations || []} />
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Priorities & impact</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(report.priorities || []).length === 0 && (
                    <div className="text-sm text-muted-foreground">No prioritized actions.</div>
                  )}
                  {(report.priorities || []).map((p, i) => (
                    <div key={`${p.title}-${i}`} className="rounded-md border p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">{p.title}</div>
                        <Badge variant={priorityVariant(p.priority)}>{p.priority}</Badge>
                      </div>
                      <div className="text-sm">{p.impact}</div>
                      <div className="text-xs text-muted-foreground">
                        Effort: {p.effort || "-"}
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
                  <CardTitle>Metrics to watch</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(report.metrics_to_track || []).length === 0 && (
                    <div className="text-sm text-muted-foreground">No metrics defined.</div>
                  )}
                  {(report.metrics_to_track || []).map((metric, i) => (
                    <div key={`${metric.metric}-${i}`} className="rounded-md border p-3 space-y-1">
                      <div className="flex items-center justify-between text-sm font-medium">
                        <span>{metric.metric}</span>
                        {metric.target_change && <Badge variant="outline">{metric.target_change}</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Widget: {metric.widget} {metric.timeframe ? ` - Period ${metric.timeframe}` : ""}
                      </div>
                      <div className="text-sm">{metric.reason}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Data-backed projections</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(report.predictions || []).length === 0 && (
                    <div className="text-sm text-muted-foreground">Not enough data to project.</div>
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
      {items.length === 0 && <div className="text-sm text-muted-foreground">No recommendations available.</div>}
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

function formatTimeWindow(meta?: ReportMeta) {
  if (!meta?.time) return null
  const from = meta.time.from || "-"
  const to = meta.time.to || "-"
  const bucket = meta.time.bucket ? ` | Bucket ${meta.time.bucket}` : ""
  return `Analysis window: ${from} -> ${to}${bucket}`
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
    { name: "Now", baseline, projected: baseline },
    { name: "+1 wk", baseline, projected: Math.round(midpoint * 10) / 10 },
    { name: "+2 wk", baseline, projected: Math.round(expected * 10) / 10 },
  ]
  return { data, metricLabel: unit ? `${metricLabel} (${unit})` : metricLabel, delta: expected - baseline }
}

function ImpactChart({ report }: { report: Report | null }) {
  const { data, metricLabel, delta } = useMemo(() => buildPredictionSeries(report), [report])
  const improvement = delta >= 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Impact KPI forecast</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-xs text-muted-foreground">
          {metricLabel} Two-week delta {improvement}
        </div>
        <ChartContainer
          config={{
            baseline: { label: "Current trend", color: "hsl(var(--muted-foreground))" },
            projected: { label: "Projected after action", color: "hsl(var(--primary))" },
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
      commentary: found?.commentary || "Insufficient data",
    }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Radar distribution scores</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ChartContainer
          config={{
            score: { label: "Score", color: "hsl(var(--primary))" },
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
