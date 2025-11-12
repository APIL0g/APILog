import { useEffect, useState } from "react";
import { CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { WidgetMeta, WidgetProps } from "@/core/registry";
import type { Digest, InsightsResp } from "./types";
import { fetchDigest, explain, type ApiError } from "./api";

function sevClass(s?: string) {
  switch (s) {
    case "critical": return "bg-red-500/10 text-red-600";
    case "high":     return "bg-orange-500/10 text-orange-600";
    case "medium":   return "bg-yellow-500/10 text-yellow-700";
    default:         return "bg-muted text-muted-foreground";
  }
}

function AiInsightsWidget({ timeRange }: WidgetProps) {
  const [digest, setDigest] = useState<Digest | null>(null);
  const [insights, setInsights] = useState<InsightsResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null); setInsights(null);
    fetchDigest({ timeRange, site_id: "main" })
      .then(d => { if (alive) setDigest(d); })
      .catch(e => { if (alive) setError(e as ApiError); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [timeRange]);

  const onExplain = async () => {
    if (!digest) return;
    setLoading(true); setError(null);
    try {
      const resp = await explain({ digest, language: "ko", word_limit: 300, audience: "dev" });
      setInsights(resp);
    } catch (e: any) {
      setError(e as ApiError);
    } finally {
      setLoading(false);
    }
  };

  const renderError = (e: ApiError) => {
    const code = e?.code;
    if (code === "model_downloading") {
      return "모델을 다운로드 중입니다. 잠시 후 다시 시도해주세요.";
    }
    if (code === "model_not_found") {
      return "모델을 찾을 수 없습니다. Ollama에서 해당 모델을 먼저 다운로드 해주세요.";
    }
    if (code === "ollama_unreachable") {
      return "AI 백엔드(Ollama)에 연결할 수 없습니다. Docker/Ollama 상태를 확인해주세요.";
    }
    if ((e as any)?.status === 404) return "요청한 리소스를 찾을 수 없습니다.";
    if ((e as any)?.status === 503) return "서비스를 일시적으로 이용할 수 없습니다. 잠시 후 다시 시도해주세요.";
    return e?.message || String(e);
  };

  return (
    <>
      <CardHeader className="mb-2 md:mb-3">
        <CardTitle>AI Insights</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {error && <div className="text-sm text-red-500">Error: {renderError(error)}</div>}

        {digest && (
          <div className="text-sm text-muted-foreground">
            기간: {digest.time_window.from} → {digest.time_window.to} (bucket={digest.time_window.bucket})
          </div>
        )}

        <div className="flex gap-2">
          <button
            className="px-3 py-1 rounded bg-primary text-primary-foreground disabled:opacity-50"
            onClick={onExplain}
            disabled={!digest || loading}
          >
            Generate
          </button>
        </div>

        {insights && insights.insights.length === 0 && (
          <div className="text-sm text-muted-foreground">인사이트 없음</div>
        )}
        {insights && insights.insights.length > 0 && (
          <ul className="space-y-3">
            {insights.insights.map((it, i) => (
              <li key={i} className="rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${sevClass(it.severity)}`}>
                    {it.severity ?? "low"}
                  </span>
                  <div className="font-medium">{it.title}</div>
                </div>
                {it.explanation && <div className="mt-1 text-sm">{it.explanation}</div>}
                {it.action && <div className="mt-1 text-xs text-muted-foreground">Action: {it.action}</div>}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </>
  );
}

export const widgetMeta: WidgetMeta = {
  id: "ai_insights",
  name: "AI Insights",
  description: "로그 집계 기반 AI 설명 위젯",
  defaultWidth: 520,
  defaultHeight: 360,
};

export default AiInsightsWidget;
