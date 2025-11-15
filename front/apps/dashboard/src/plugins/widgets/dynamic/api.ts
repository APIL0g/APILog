import type {
  DynamicWidgetSpec,
  GenerateDynamicWidgetRequest,
  DynamicWidgetData,
  DynamicWidgetDataParams,
} from "./types"

const RAW_API_BASE = import.meta.env.VITE_API_BASE_URL
const API_BASE = RAW_API_BASE && RAW_API_BASE.trim() ? RAW_API_BASE.replace(/\/$/, "") : "/api"

async function readError(res: Response): Promise<string> {
  try {
    const data = await res.json()
    if (typeof data === "string") {
      return data
    }
    if (data?.detail) {
      if (typeof data.detail === "string") {
        return data.detail
      }
      if (typeof data.detail?.message === "string") {
        return data.detail.message
      }
    }
    if (data?.message) {
      return String(data.message)
    }
    return JSON.stringify(data)
  } catch (_err) {
    return res.statusText || `HTTP ${res.status}`
  }
}

export async function fetchDynamicWidgetSpecs(): Promise<DynamicWidgetSpec[]> {
  const res = await fetch(`${API_BASE}/widgets/dynamic`)
  if (!res.ok) {
    throw new Error(await readError(res))
  }
  const data = (await res.json()) as DynamicWidgetSpec[] | undefined
  if (!Array.isArray(data)) {
    return []
  }
  return data.filter((spec): spec is DynamicWidgetSpec => Boolean(spec?.id && spec?.title && spec?.sql))
}

export async function generateDynamicWidget(
  payload: GenerateDynamicWidgetRequest,
): Promise<DynamicWidgetSpec> {
  const res = await fetch(`${API_BASE}/widgets/dynamic/ai-generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    throw new Error(await readError(res))
  }
  const data = (await res.json()) as DynamicWidgetSpec | undefined
  if (!data?.id) {
    throw new Error("API returned an invalid widget specification")
  }
  return data
}

export async function fetchDynamicWidgetData(
  widgetId: string,
  params: DynamicWidgetDataParams = {},
): Promise<DynamicWidgetData> {
  const query = new URLSearchParams()
  if (params.from) query.set("from", params.from)
  if (params.to) query.set("to", params.to)
  if (params.bucket) query.set("bucket", params.bucket)
  if (params.siteId) query.set("site_id", params.siteId)
  const suffix = query.toString()
  const res = await fetch(`${API_BASE}/widgets/dynamic/${encodeURIComponent(widgetId)}/data${suffix ? `?${suffix}` : ""}`)
  if (!res.ok) {
    throw new Error(await readError(res))
  }
  const data = (await res.json()) as DynamicWidgetData | undefined
  if (!data || !Array.isArray(data.rows)) {
    return { rows: [], meta: data?.meta ?? {} }
  }
  return data
}
