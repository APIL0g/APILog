import type { Digest, InsightsResp } from "./types";

const API_BASE = ""; // 동일 오리진 프록시(/api/*) 경유

function rangeToParams(r?: string) {
  const now = new Date();
  const to = now.toISOString();
  const map: Record<string, { hours: number; bucket: "1h" | "6h" | "1d" }> = {
    "1h":  { hours: 1, bucket: "1h" },
    "6h":  { hours: 6,  bucket: "1h" },
    "12h": { hours: 12, bucket: "1h" },
    "24h": { hours: 24, bucket: "1h" },
    "7d":  { hours: 168, bucket: "6h" },
    "30d": { hours: 720, bucket: "1d" },
  };
  const picked = map[r ?? "24h"] ?? map["24h"];
  const from = new Date(now.getTime() - picked.hours * 3600 * 1000).toISOString();
  return { from, to, bucket: picked.bucket };
}

export async function fetchDigest(
  params: { timeRange?: string; site_id?: string } = {}
): Promise<Digest> {
  const { from, to, bucket } = rangeToParams(params.timeRange);
  const q = new URLSearchParams();
  q.set("from", from);
  q.set("to", to);
  q.set("bucket", bucket);
  if (params.site_id) q.set("site_id", params.site_id);

  const res = await fetch(`${API_BASE}/api/query/widgets/ai_insights/aggregate?${q.toString()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

export async function explain(body: {
  digest: Digest;
  language?: string;
  word_limit?: number;
  audience?: string;
}): Promise<InsightsResp> {
  const res = await fetch(`${API_BASE}/api/query/widgets/ai_insights/explain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}
