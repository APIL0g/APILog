"use client"

import { useEffect, useMemo, useState } from "react"
import RGL, { WidthProvider, type Layout } from "react-grid-layout"
import "react-grid-layout/css/styles.css"
import "react-resizable/css/styles.css"
import { WidgetHost } from "@/core/WidgetHost"
import { widgetMetadata } from "@/core/registry"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Settings, LayoutGrid } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"

const ReactGridLayout = WidthProvider(RGL)

const GRID_COLS = 12
const GRID_ROW_HEIGHT = 30
const GRID_MARGIN: [number, number] = [24, 24]
const MIN_WIDGET_W = 2
const MIN_WIDGET_H = 4
const DEFAULT_WIDGET_W = 4
const DEFAULT_WIDGET_H = 8
const APPROX_COL_WIDTH_PX = 120
const RESIZE_HANDLES: NonNullable<Layout["resizeHandles"]> = ["s", "n", "e", "w", "se", "sw", "ne", "nw"]

interface WidgetLayoutState {
  x: number
  y: number
  w: number
  h: number
}

interface Widget {
  id: string
  type: string
  position: number
  config?: Record<string, any>
  layout?: WidgetLayoutState
  width?: number
  height?: number
}

interface DashboardConfig {
  id: string
  name: string
  widgets: Widget[]
}

type StoredWidget = Partial<Widget> & {
  layout?: Partial<WidgetLayoutState>
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function pxToGridWidth(width?: number) {
  if (typeof width !== "number" || !Number.isFinite(width)) return DEFAULT_WIDGET_W
  return clamp(Math.round(width / APPROX_COL_WIDTH_PX) || DEFAULT_WIDGET_W, MIN_WIDGET_W, GRID_COLS)
}

function pxToGridHeight(height?: number) {
  if (typeof height !== "number" || !Number.isFinite(height)) return DEFAULT_WIDGET_H
  return Math.max(Math.round(height / GRID_ROW_HEIGHT) || DEFAULT_WIDGET_H, MIN_WIDGET_H)
}

function createFallbackLayout(index: number, width?: number, height?: number): WidgetLayoutState {
  const perRow = Math.max(1, Math.floor(GRID_COLS / DEFAULT_WIDGET_W))
  const w = pxToGridWidth(width)
  const h = pxToGridHeight(height)
  const tentativeX = (index % perRow) * DEFAULT_WIDGET_W
  const x = clamp(tentativeX, 0, GRID_COLS - w)
  const y = Math.floor(index / perRow) * DEFAULT_WIDGET_H
  return { x, y, w, h }
}

function sanitizeLayout(layout: Partial<WidgetLayoutState> | undefined, fallback: WidgetLayoutState): WidgetLayoutState {
  const candidate = layout ?? {}
  const rawW = Number.isFinite(candidate.w) ? (candidate.w as number) : fallback.w
  const w = clamp(Math.round(rawW), MIN_WIDGET_W, GRID_COLS)
  const rawH = Number.isFinite(candidate.h) ? (candidate.h as number) : fallback.h
  const h = Math.max(MIN_WIDGET_H, Math.round(rawH))
  const rawX = Number.isFinite(candidate.x) ? (candidate.x as number) : fallback.x
  const x = clamp(Math.round(rawX), 0, GRID_COLS - w)
  const rawY = Number.isFinite(candidate.y) ? (candidate.y as number) : fallback.y
  const y = Math.max(0, Math.round(rawY))
  return { x, y, w, h }
}

export default function DashboardPage() {
  const dashboardId = "default"
  const [dashboard, setDashboard] = useState<DashboardConfig | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)
  const [isAddingWidget, setIsAddingWidget] = useState(false)
  const [selectedWidgetType, setSelectedWidgetType] = useState<string>("")
  const timeRange = "12h"
  const [isEditMode, setIsEditMode] = useState(false)

  const widgetMetadataKey = Object.keys(widgetMetadata).join(",")
  const availableWidgets = Object.values(widgetMetadata)
  const sortedAvailableWidgets = [...availableWidgets].sort((a, b) => {
    if (a.id === "example") return 1
    if (b.id === "example") return -1
    return 0
  })
  const storageKey = `dashboard-config-${dashboardId}`

  // Load dashboard configuration
  useEffect(() => {
    const baseDashboard: DashboardConfig = {
      id: dashboardId,
      name: "Analytics Overview",
      widgets: [],
    }

    if (typeof window === "undefined") {
      setDashboard(baseDashboard)
      setIsHydrated(true)
      return
    }

    const storedValue = localStorage.getItem(storageKey)

    if (storedValue) {
      try {
        const parsed = JSON.parse(storedValue) as Partial<DashboardConfig>
        const storedWidgets = Array.isArray(parsed.widgets) ? (parsed.widgets as StoredWidget[]) : []

        const validWidgets = storedWidgets
          .filter((widget): widget is StoredWidget & { type: string } => typeof widget?.type === "string")
          .map((widget, index) => {
            const meta = widgetMetadata[widget.type]
            const rawLayout =
              widget.layout && typeof widget.layout === "object" ? (widget.layout as Partial<WidgetLayoutState>) : undefined
            const fallbackLayout = createFallbackLayout(
              index,
              (typeof widget.width === "number" && Number.isFinite(widget.width) ? widget.width : undefined) ??
                meta?.defaultWidth,
              (typeof widget.height === "number" && Number.isFinite(widget.height) ? widget.height : undefined) ??
                meta?.defaultHeight,
            )

            return {
              ...widget,
              id: widget.id ?? `widget-${index + 1}`,
              position: index,
              layout: sanitizeLayout(rawLayout, fallbackLayout),
              config: widget.config ?? meta?.defaultConfig,
            }
          })

        setDashboard({
          ...baseDashboard,
          ...parsed,
          widgets: validWidgets,
        })
        setIsHydrated(true)
        return
      } catch (error) {
        console.warn("[dashboard] Failed to restore widgets from localStorage.", error)
      }
    }

    setDashboard(baseDashboard)
    setIsHydrated(true)
  }, [dashboardId, storageKey, widgetMetadataKey])

  useEffect(() => {
    if (!dashboard) return
    if (!isHydrated) return
    if (typeof window === "undefined") return

    localStorage.setItem(storageKey, JSON.stringify(dashboard))
  }, [dashboard, isHydrated, storageKey])

  useEffect(() => {
    if (!selectedWidgetType) {
      if (sortedAvailableWidgets.length > 0) {
        setSelectedWidgetType(sortedAvailableWidgets[0].id)
      }
    }
  }, [selectedWidgetType, widgetMetadataKey])

  useEffect(() => {
    if (!isEditMode && isAddingWidget) {
      setIsAddingWidget(false)
      setSelectedWidgetType("")
    }
  }, [isEditMode, isAddingWidget])

  const handleAddWidget = () => {
    if (!selectedWidgetType || !dashboard) return

    const meta = widgetMetadata[selectedWidgetType]
    const fallbackLayout = createFallbackLayout(
      dashboard.widgets.length,
      meta?.defaultWidth ?? 400,
      meta?.defaultHeight ?? 300,
    )
    const nextY = dashboard.widgets.reduce(
      (max, widget) => Math.max(max, (widget.layout?.y ?? 0) + (widget.layout?.h ?? DEFAULT_WIDGET_H)),
      0,
    )
    const layout = sanitizeLayout({ ...fallbackLayout, y: nextY }, fallbackLayout)

    const newWidget: Widget = {
      id: `widget-${Date.now()}`,
      type: selectedWidgetType,
      position: dashboard.widgets.length,
      layout,
      config: meta?.defaultConfig,
    }

    setDashboard({
      ...dashboard,
      widgets: [...dashboard.widgets, newWidget],
    })

    setIsAddingWidget(false)
    setSelectedWidgetType("")
  }

  const handleRemoveWidget = (widgetId: string) => {
    if (!dashboard) return

    const updatedWidgets = dashboard.widgets
      .filter((w) => w.id !== widgetId)
      .map((widget, index) => ({
        ...widget,
        position: index,
      }))

    setDashboard({
      ...dashboard,
      widgets: updatedWidgets,
    })
  }

  const gridLayout = useMemo(() => {
    if (!dashboard) return []
    return dashboard.widgets.map((widget, index) => {
      const meta = widgetMetadata[widget.type]
      const fallback = createFallbackLayout(index, widget.width ?? meta?.defaultWidth, widget.height ?? meta?.defaultHeight)
      const layout = sanitizeLayout(widget.layout, fallback)
      return {
        i: widget.id,
        x: layout.x,
        y: layout.y,
        w: layout.w,
        h: layout.h,
        minW: MIN_WIDGET_W,
        minH: MIN_WIDGET_H,
      }
    })
  }, [dashboard, widgetMetadataKey])

  const handleLayoutChange = (updatedLayout: Layout[]) => {
    if (!dashboard || !isEditMode || updatedLayout.length === 0) return

    const layoutMap = updatedLayout.reduce<Record<string, Layout>>((acc, item) => {
      acc[item.i] = item
      return acc
    }, {})

    setDashboard({
      ...dashboard,
      widgets: dashboard.widgets
        .map((widget) => {
          const layout = layoutMap[widget.id]
          if (!layout) return widget

          return {
            ...widget,
            layout: {
              x: layout.x,
              y: layout.y,
              w: layout.w,
              h: layout.h,
            },
            position: layout.y * GRID_COLS + layout.x,
          }
        })
        .sort((a, b) => {
          const layoutA = a.layout
          const layoutB = b.layout

          if (layoutA && layoutB) {
            if (layoutA.y !== layoutB.y) return layoutA.y - layoutB.y
            if (layoutA.x !== layoutB.x) return layoutA.x - layoutB.x
          }

          return a.position - b.position
        }),
    })
  }

  if (!dashboard) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <img src="/dashboard-logo.png" alt="ApiLog" className="h-8" />
            <div className="h-6 w-px bg-border" />
            <h1 className="text-xl font-semibold text-foreground">{dashboard.name}</h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Theme Toggle Button */}
            <ThemeToggle />

            <Button variant={isEditMode ? "default" : "outline"} size="sm" onClick={() => setIsEditMode(!isEditMode)}>
              <LayoutGrid className="h-4 w-4 mr-2" />
              {isEditMode ? "Done" : "Edit Layout"}
            </Button>

            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6">
        <div className="space-y-6">
          <ReactGridLayout
            className="layout"
            layout={gridLayout}
            cols={GRID_COLS}
            rowHeight={GRID_ROW_HEIGHT}
            margin={GRID_MARGIN}
            isDraggable={isEditMode}
            isResizable={isEditMode}
            resizeHandles={RESIZE_HANDLES}
            compactType="vertical"
            draggableHandle=".widget-drag-handle"
            preventCollision={!isEditMode}
            onLayoutChange={handleLayoutChange}
          >
            {dashboard.widgets.map((widget) => (
              <div key={widget.id} className="h-full">
                <WidgetHost
                  type={widget.type}
                  config={widget.config}
                  timeRange={timeRange}
                  isEditMode={isEditMode}
                  onRemove={() => handleRemoveWidget(widget.id)}
                />
              </div>
            ))}
          </ReactGridLayout>

        </div>

        {/* Empty State */}
        {dashboard.widgets.length === 0 && !isEditMode && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="text-center max-w-md">
              <LayoutGrid className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-2xl font-semibold mb-2">No widgets yet</h2>
              <p className="text-muted-foreground mb-6">
                Start building your custom dashboard by adding widgets that matter to you.
              </p>
              <Button onClick={() => setIsEditMode(true)} size="lg">
                <Plus className="h-5 w-5 mr-2" />
                Add Your First Widget
              </Button>
            </div>
          </div>
        )}
      </main>

      {isEditMode && (
        <>
          <div className="fixed bottom-6 right-6 z-40 flex items-center gap-3">
            <span className="rounded-full bg-background/90 px-4 py-2 text-sm font-medium text-foreground shadow-lg shadow-primary/20">
              Add Widget
            </span>
            <Button
              size="icon"
              className="h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:bg-primary/90"
              onClick={() => setIsAddingWidget(true)}
              aria-label="Add widget"
            >
              <Plus className="h-6 w-6" />
            </Button>
          </div>
          <Dialog
            open={isAddingWidget}
            onOpenChange={(open) => {
              setIsAddingWidget(open)
              if (!open) {
                setSelectedWidgetType("")
              }
            }}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Widget</DialogTitle>
                <DialogDescription>Select a widget type to place on your dashboard.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Select value={selectedWidgetType} onValueChange={setSelectedWidgetType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a widget..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedAvailableWidgets.map((meta) => (
                      <SelectItem key={meta.id} value={meta.id}>
                        {meta.name ?? meta.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button onClick={handleAddWidget} disabled={!selectedWidgetType} className="flex-1">
                    Add
                  </Button>
                  <Button
                    onClick={() => {
                      setIsAddingWidget(false)
                      setSelectedWidgetType("")
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  )
}
