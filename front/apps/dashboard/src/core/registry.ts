import type { ComponentType } from "react"

export interface WidgetProps {
  config?: Record<string, any>
  timeRange: string
  language?: string
  containerSize?: {
    width: number
    height: number
  }
}

export type WidgetComponent = ComponentType<WidgetProps>

export interface WidgetLocalization {
  title?: string
  previewDescription?: string
}

export interface WidgetMeta {
  id: string
  name?: string
  description?: string
  defaultWidth?: number
  defaultHeight?: number
  minWidth?: number
  minHeight?: number
  relaxedMinHeight?: number
  relaxedMinHeightBreakpointCols?: number
  defaultConfig?: Record<string, any>
  previewImage?: string
  tags?: string[]
  localizations?: Record<string, WidgetLocalization>
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
    minWidth: meta?.minWidth,
    minHeight: meta?.minHeight,
    relaxedMinHeight: meta?.relaxedMinHeight,
    relaxedMinHeightBreakpointCols: meta?.relaxedMinHeightBreakpointCols,
    defaultConfig: meta?.defaultConfig,
    previewImage: meta?.previewImage,
    tags: meta?.tags ?? [],
    localizations: meta?.localizations,
  }
}

// Legacy placeholder - automatic registration happens in src/core/init-widgets.ts
export function initializeWidgets() {
  // Intentionally empty
}
