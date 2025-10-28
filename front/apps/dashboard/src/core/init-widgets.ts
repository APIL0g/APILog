import { registerWidget, widgetMetadata, widgetRegistry } from "./registry"
import type { WidgetComponent, WidgetMeta } from "./registry"

type WidgetModule = {
  default?: WidgetComponent
  widgetMeta?: Partial<WidgetMeta>
}

const widgetModules = import.meta.glob<WidgetModule>("@plugins/widgets/**/index.tsx", {
  eager: true,
})

function widgetIdFromPath(path: string) {
  const match = path.split("/widgets/")[1]
  if (!match) return undefined

  return match
    .replace(/^\/+/, "")
    .replace(/\/index\.(jsx|tsx|js|ts)$/, "")
    .replace(/\.(jsx|tsx|js|ts)$/, "")
    .replace(/\//g, "-")
}

export function initializeWidgets() {
  Object.keys(widgetRegistry).forEach((key) => {
    delete widgetRegistry[key]
  })

  Object.keys(widgetMetadata).forEach((key) => {
    delete widgetMetadata[key]
  })

  Object.entries(widgetModules).forEach(([path, module]) => {
    const component = module.default
    if (!component) {
      console.warn(`[widgets] Skipping ${path} because it does not have a default export.`)
      return
    }

    const inferredId = widgetIdFromPath(path)
    const meta = module.widgetMeta ?? {}
    const widgetId = meta.id ?? inferredId

    if (!widgetId) {
      console.warn(`[widgets] Skipping ${path} because its widget id could not be inferred.`)
      return
    }

    registerWidget(widgetId, component, { ...meta, id: widgetId })
  })
}
