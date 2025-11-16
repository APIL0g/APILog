export type DynamicChartType = "line" | "bar" | "pie" | "table" | "metric" | "area"

export interface DynamicChartConfig {
  type: DynamicChartType
  x?: string
  y?: string
  title?: string
  series_field?: string | null
  value_format?: string | null
  options?: Record<string, unknown>
}

export interface DynamicWidgetSpec {
  id: string
  title: string
  description?: string
  sql: string
  chart: DynamicChartConfig
  language?: string
  site_id?: string | null
  created_at?: string | null
  meta?: Record<string, unknown>
}

export interface DynamicWidgetMeta {
  widget_id?: string
  from?: string
  to?: string
  bucket?: string
  site_id?: string | null
  sql?: string
  created_at?: string | null
  title?: string
  chart?: DynamicChartConfig
}

export interface DynamicWidgetData {
  rows: Array<Record<string, unknown>>
  meta: DynamicWidgetMeta
}

export interface GenerateDynamicWidgetRequest {
  requirement: string
  language?: string
  site_id?: string
  preferred_chart?: DynamicChartType | ""
}

export interface DynamicWidgetDataParams {
  from?: string
  to?: string
  bucket?: string
  siteId?: string
}
