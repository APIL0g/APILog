import { useEffect, useState } from "react";
import { CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { WidgetMeta, WidgetProps } from "@/core/registry";
import type { Digest, InsightsResp } from "./types";
import { fetchDigest, explain, type ApiError } from "./api";
import { getCommonWidgetCopy, resolveWidgetLanguage } from "../i18n";
import { getAiInsightsCopy, type AiInsightsCopy } from "./locales";
import previewImage from "./preview.png";

function sevClass(s?: string) {
  switch (s) {
    case "critical": return "bg-red-500/10 text-red-600";
    case "high":     return "bg-orange-500/10 text-orange-600";
    case "medium":   return "bg-yellow-500/10 text-yellow-700";
    default:         return "bg-muted text-muted-foreground";
  }
}

function AiInsightsWidget({ timeRange, language }: WidgetProps) {
  const [digest, setDigest] = useState<Digest | null>(null);
  const [insights, setInsights] = useState<InsightsResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const resolvedLanguage = resolveWidgetLanguage(language);
  const common = getCommonWidgetCopy(resolvedLanguage);
  const copy = getAiInsightsCopy(resolvedLanguage);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null); setInsights(null);
    fetchDigest({ timeRange, site_id: "main" })
      .then(d => { if (alive) setDigest(d); })
      .catch(e => { if (alive) setError(e as ApiError); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [timeRange]);

  useEffect(() => {
    setInsights(null);
    setError(null);
  }, [resolvedLanguage]);

  const onExplain = async () => {
    if (!digest) return;
    setLoading(true); setError(null);
    try {
      const resp = await explain({ digest, language: resolvedLanguage, word_limit: 300, audience: "dev" });
      setInsights(resp);
    } catch (e: any) {
      setError(e as ApiError);
    } finally {
      setLoading(false);
    }
  };

  const renderError = (e: ApiError) => {
    const typedCode = e?.code as keyof AiInsightsCopy["errors"] | undefined;
    if (typedCode && copy.errors[typedCode]) {
      return copy.errors[typedCode];
    }
    if (e?.status === 404) return copy.errors.status404;
    if (e?.status === 503) return copy.errors.status503;
    return e?.message || copy.errors.fallback;
  };

  return (
    <>
      <CardHeader className="mb-2 md:mb-3">
        <CardTitle>{copy.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && <div className="text-sm text-muted-foreground">{common.loading}</div>}
        {error && (
          <div className="text-sm text-red-500">
            {common.errorPrefix}: <span>{renderError(error)}</span>
          </div>
        )}

        {digest && (
          <div className="text-sm text-muted-foreground">
            {copy.timeWindowLabel}: {digest.time_window.from} → {digest.time_window.to} ({copy.bucketLabel}: {digest.time_window.bucket})
          </div>
        )}

        <div className="flex gap-2">
          <button
            className="px-3 py-1 rounded bg-primary text-primary-foreground disabled:opacity-50"
            onClick={onExplain}
            disabled={!digest || loading}
          >
            {copy.generateButton}
          </button>
        </div>

        {insights && insights.insights.length === 0 && (
          <div className="text-sm text-muted-foreground">{copy.noInsights}</div>
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
                {it.action && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {copy.actionLabel}: {it.action}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </>
  );
}

export default AiInsightsWidget;


const aiInsightsLocales = {
  en: getAiInsightsCopy("en"),
  ko: getAiInsightsCopy("ko"),
};


export const widgetMeta: WidgetMeta = {
  id: "ai_insights",
  name: "AI Insights",
  description: "로그 집계 기반 AI 설명 위젯",
  defaultWidth: 520,
  defaultHeight: 360,
  previewImage,
  tags: ["ai"],
  localizations: {
    en: {
      title: aiInsightsLocales.en.title,
      previewDescription: aiInsightsLocales.en.previewDescription,
    },
    ko: {
      title: aiInsightsLocales.ko.title,
      previewDescription: aiInsightsLocales.ko.previewDescription,
    },
  },
};

