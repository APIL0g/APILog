import type { ComponentType } from "react"

export interface WidgetProps {
  config?: Record<string, any>
  timeRange: string
}

export type WidgetComponent = ComponentType<WidgetProps>

export interface WidgetMeta {
  id: string
  name?: string
  description?: string
  defaultWidth?: number
  defaultHeight?: number
  defaultConfig?: Record<string, any>
}

// Widget registry - plugins register themselves here
export const widgetRegistry: Record<string, WidgetComponent> = {}
export const widgetMetadata: Record<string, WidgetMeta> = {}

function formatNameFromId(id: string) {
  return id
    .replace(/[-_/]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

// Register a widget
export function registerWidget(id: string, component: WidgetComponent, meta?: Partial<WidgetMeta>) {
  widgetRegistry[id] = component
  widgetMetadata[id] = {
    id,
    name: meta?.name ?? formatNameFromId(id),
    description: meta?.description,
    defaultWidth: meta?.defaultWidth,
    defaultHeight: meta?.defaultHeight,
    defaultConfig: meta?.defaultConfig,
  }
}

// Legacy placeholder - automatic registration happens in src/core/init-widgets.ts
export function initializeWidgets() {
  // Intentionally empty
}
