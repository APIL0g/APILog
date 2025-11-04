export type TVPoint = { t: string; v: number };

export type Digest = {
  version: string;
  time_window: { from: string; to: string; bucket: string };
  context: { site_id: string; filters: Record<string, any> };
  totals: { pageviews: number; sessions: number; users: number };
  series: { pageviews: TVPoint[]; error_rate: TVPoint[] };
  top_paths: { path: string; pv: number }[];
  errors: { by_code: any[]; top_endpoints: string[] };
  funnels: { name: string; conv: number }[];
  anomalies: { metric: string; at: string; z: number }[];
};

export type InsightItem = {
  title: string;
  severity?: "low" | "medium" | "high" | "critical";
  metric_refs?: string[];
  evidence?: Record<string, any>;
  explanation?: string;
  action?: string;
};

export type InsightsResp = {
  generated_at: string;
  insights: InsightItem[];
  meta?: Record<string, any>;
};
