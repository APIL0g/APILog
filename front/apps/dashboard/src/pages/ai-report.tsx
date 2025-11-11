"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"

type Report = {
  generated_at: string
  title: string
  summary?: string
  diagnostics?: { widget: string; finding: string; pattern?: string }[]
  recommendations?: { category: string; suggestion: string; rationale?: string }[]
  priorities?: { title: string; priority: string; impact: string; effort?: string; expected_metric_change?: any }[]
  metrics_to_track?: string[]
  meta?: Record<string, any>
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
        title: "AI 리포트",
        summary: "기본 리포트를 표시합니다. 서버 응답을 확인하세요.",
        diagnostics: [],
        recommendations: [],
        priorities: [],
        metrics_to_track: ["페이지별 이탈 비율", "페이지별 체류시간"],
        meta: { fallback: true },
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/dashboard-logo.png" alt="ApiLog" className="h-8" />
            <div className="h-6 w-px bg-border" />
            <div>
              <h1 className="text-xl font-semibold text-foreground">AI 리포트</h1>
              <p className="text-sm text-muted-foreground">데이터 기반 진단과 실행 가능한 제안을 자동 생성</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => (globalThis.location.hash = "#/")}>대시보드로</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>리포트 생성</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="md:col-span-2 space-y-2">
                <label className="text-sm text-muted-foreground">사용자 프롬프트 (선택, 가볍게 반영)</label>
                <Textarea
                  placeholder="예: 모바일 Chrome 이탈 원인에 초점을 맞춰줘"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="min-h-24"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">기간</label>
                <div className="text-sm rounded-md border bg-muted/30 p-3">
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
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    {report.title}
                    <Badge variant="secondary" className="uppercase">{report?.meta?.model || report?.meta?.provider || "AI"}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm text-muted-foreground">생성 시각: {report.generated_at}</div>
                  {report.summary && <p className="leading-7 whitespace-pre-wrap">{report.summary}</p>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>진단 및 패턴 분석</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(report.diagnostics || []).length === 0 && (
                    <div className="text-sm text-muted-foreground">표시할 진단이 없습니다.</div>
                  )}
                  {(report.diagnostics || []).map((d, i) => (
                    <div key={i} className="rounded-md border p-3">
                      <div className="text-sm font-medium">{d.widget}</div>
                      <div className="text-sm">{d.finding}</div>
                      {d.pattern && <div className="text-xs text-muted-foreground mt-1">패턴: {d.pattern}</div>}
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>실질적인 해결 방안</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(report.recommendations || []).length === 0 && (
                    <div className="text-sm text-muted-foreground">표시할 제안이 없습니다.</div>
                  )}
                  {(report.recommendations || []).map((r, i) => (
                    <div key={i} className="rounded-md border p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{r.category}</span>
                      </div>
                      <div className="text-sm">{r.suggestion}</div>
                      {r.rationale && (
                        <div className="text-xs text-muted-foreground mt-1">근거: {r.rationale}</div>
                      )}
                    </div>
                  ))}
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
                    <div className="text-sm text-muted-foreground">표시할 항목이 없습니다.</div>
                  )}
                  {(report.priorities || []).map((p, i) => (
                    <div key={i} className="rounded-md border p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">{p.title}</div>
                        <Badge variant={p.priority === "High" ? "default" : "secondary"}>{p.priority}</Badge>
                      </div>
                      <div className="text-sm">영향: {p.impact}</div>
                      {p.effort && <div className="text-xs text-muted-foreground">노력: {p.effort}</div>}
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>성과 측정 지표</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(report.metrics_to_track || []).length === 0 && (
                    <div className="text-sm text-muted-foreground">표시할 지표가 없습니다.</div>
                  )}
                  <ul className="list-disc pl-5 space-y-1 text-sm">
                    {(report.metrics_to_track || []).map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

