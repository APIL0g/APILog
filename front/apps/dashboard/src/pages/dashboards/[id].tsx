"use client"

import { useEffect, useMemo, useState } from "react"
import RGL, { WidthProvider, type Layout } from "react-grid-layout"
import "react-grid-layout/css/styles.css"
import "react-resizable/css/styles.css"
import { WidgetHost } from "@/core/WidgetHost"
import { widgetMetadata } from "@/core/registry"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CopyPlus, LayoutGrid, PenLine, Plus, Save, Trash2, ChevronsUpDown, Check } from "lucide-react"
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

interface PresetStorageState {
  activePresetId?: string
  presets?: Partial<DashboardConfig>[]
}

function generatePresetId() {
  const cryptoApi = typeof globalThis !== "undefined" ? (globalThis.crypto as Crypto | undefined) : undefined
  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID()
  }
  return `preset-${Math.random().toString(36).slice(2, 11)}`
}

function cloneDashboardConfig(config: DashboardConfig): DashboardConfig {
  return {
    ...config,
    widgets: config.widgets.map((widget) => ({
      ...widget,
      layout: widget.layout ? { ...widget.layout } : undefined,
      config: widget.config ? { ...widget.config } : undefined,
    })),
  }
}

function restoreWidgetsFromStorage(storedWidgets: StoredWidget[]): Widget[] {
  return storedWidgets
    .filter((widget): widget is StoredWidget & { type: string } => typeof widget?.type === "string")
    .map((widget, index) => {
      const meta = widgetMetadata[widget.type]
      const fallbackLayout = createFallbackLayout(
        index,
        (typeof widget.width === "number" && Number.isFinite(widget.width) ? widget.width : undefined) ?? meta?.defaultWidth,
        (typeof widget.height === "number" && Number.isFinite(widget.height) ? widget.height : undefined) ?? meta?.defaultHeight,
      )
      const layout = sanitizeLayout(
        widget.layout && typeof widget.layout === "object" ? (widget.layout as Partial<WidgetLayoutState>) : undefined,
        fallbackLayout,
      )

      return {
        ...widget,
        id: widget.id ?? `widget-${index + 1}`,
        position: index,
        layout,
        config: widget.config ?? meta?.defaultConfig,
      } as Widget
    })
}

function normalizeDashboardPreset(
  preset: Partial<DashboardConfig> | null | undefined,
  fallbackName: string,
  fallbackId?: string,
): DashboardConfig {
  const storedWidgets = Array.isArray(preset?.widgets) ? (preset?.widgets as StoredWidget[]) : []

  return {
    id: preset?.id ?? fallbackId ?? generatePresetId(),
    name: typeof preset?.name === "string" && preset.name.trim().length > 0 ? preset.name.trim() : fallbackName,
    widgets: restoreWidgetsFromStorage(storedWidgets),
  }
}

function createDefaultPreset(dashboardId: string): DashboardConfig {
  return {
    id: `${dashboardId}-default`,
    name: "Analytics Overview",
    widgets: [],
  }
}

function createBlankDashboardPreset(name: string): DashboardConfig {
  return {
    id: generatePresetId(),
    name,
    widgets: [],
  }
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
  const [presets, setPresets] = useState<DashboardConfig[]>([])
  const [activePresetId, setActivePresetId] = useState<string | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isSaveAsDialogOpen, setIsSaveAsDialogOpen] = useState(false)
  const [savePresetName, setSavePresetName] = useState("")
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false)
  const [renamePresetName, setRenamePresetName] = useState("")
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isFinishPresetDialogOpen, setIsFinishPresetDialogOpen] = useState(false)
  const [finishPresetName, setFinishPresetName] = useState("")
  const [isNewPresetDraft, setIsNewPresetDraft] = useState(false)

  const widgetMetadataKey = Object.keys(widgetMetadata).join(",")
  const availableWidgets = Object.values(widgetMetadata)
  const sortedAvailableWidgets = [...availableWidgets].sort((a, b) => {
    if (a.id === "example") return 1
    if (b.id === "example") return -1
    return 0
  })
  const presetStorageKey = `dashboard-presets-${dashboardId}`
  const legacyStorageKey = `dashboard-config-${dashboardId}`
  const activePreset = presets.find((preset) => preset.id === activePresetId) ?? presets[0]

  // Load dashboard configuration & presets
  useEffect(() => {
    const defaultPreset = createDefaultPreset(dashboardId)

    const applyState = (candidatePresets: DashboardConfig[], requestedActiveId?: string) => {
      const ensuredPresets = candidatePresets.length === 0 ? [defaultPreset] : candidatePresets
      const resolvedActiveId =
        requestedActiveId && ensuredPresets.some((preset) => preset.id === requestedActiveId)
          ? requestedActiveId
          : ensuredPresets[0].id
      const activePresetEntry =
        ensuredPresets.find((preset) => preset.id === resolvedActiveId) ?? ensuredPresets[0] ?? defaultPreset

      setPresets(ensuredPresets)
      setActivePresetId(resolvedActiveId)
      setDashboard(cloneDashboardConfig(activePresetEntry))
      setHasUnsavedChanges(false)
      setIsNewPresetDraft(false)
      setIsHydrated(true)
    }

    if (typeof window === "undefined") {
      applyState([defaultPreset], defaultPreset.id)
      return
    }

    const storedValue = localStorage.getItem(presetStorageKey)

    if (storedValue) {
      try {
        const parsed = JSON.parse(storedValue) as PresetStorageState
        const candidatePresets = Array.isArray(parsed.presets) ? parsed.presets : []
        const normalizedPresets = candidatePresets.map((preset, index) =>
          normalizeDashboardPreset(preset, `${defaultPreset.name} ${index + 1}`),
        )

        if (normalizedPresets.length > 0) {
          applyState(normalizedPresets, parsed.activePresetId)
          return
        }
      } catch (error) {
        console.warn("[dashboard] Failed to restore preset layouts from localStorage.", error)
      }
    }

    const legacyValue = localStorage.getItem(legacyStorageKey)

    if (legacyValue) {
      try {
        const parsedLegacy = JSON.parse(legacyValue) as Partial<DashboardConfig>
        const normalized = normalizeDashboardPreset(parsedLegacy, defaultPreset.name, defaultPreset.id)
        applyState([normalized], normalized.id)
        return
      } catch (error) {
        console.warn("[dashboard] Failed to restore legacy dashboard layout.", error)
      }
    }

    applyState([defaultPreset], defaultPreset.id)
  }, [dashboardId, legacyStorageKey, presetStorageKey, widgetMetadataKey])

  useEffect(() => {
    if (!isHydrated) return
    if (typeof window === "undefined") return
    if (presets.length === 0) return

    const payload: PresetStorageState = {
      activePresetId: activePresetId ?? undefined,
      presets,
    }

    localStorage.setItem(presetStorageKey, JSON.stringify(payload))
    localStorage.removeItem(legacyStorageKey)
  }, [activePresetId, isHydrated, legacyStorageKey, presetStorageKey, presets])

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

  const saveDashboardAsNewPreset = (source: DashboardConfig, nameOverride?: string) => {
    const fallbackName =
      nameOverride?.trim() && nameOverride.trim().length > 0
        ? nameOverride.trim()
        : source.name?.trim() && source.name.trim().length > 0
          ? source.name.trim()
          : `Preset ${presets.length + 1}`

    const newPresetId = generatePresetId()
    const presetClone = cloneDashboardConfig({
      ...source,
      id: newPresetId,
      name: fallbackName,
    })

    setPresets((prev) => [...prev, presetClone])
    setActivePresetId(newPresetId)
    setDashboard(cloneDashboardConfig(presetClone))
    setHasUnsavedChanges(false)
    setIsNewPresetDraft(false)
    setFinishPresetName(fallbackName)
  }

  const handlePresetSelect = (value: string) => {
    if (value === activePresetId) return

    if (hasUnsavedChanges && typeof window !== "undefined") {
      const shouldProceed = window.confirm("You have unsaved changes. Switch presets anyway?")
      if (!shouldProceed) return
    }

    const nextPreset = presets.find((preset) => preset.id === value)
    if (!nextPreset) return

    setActivePresetId(value)
    setDashboard(cloneDashboardConfig(nextPreset))
    setHasUnsavedChanges(false)
    setIsNewPresetDraft(false)
    setFinishPresetName(nextPreset.name)
  }

  const handleSavePresetChanges = (overrideDashboard?: DashboardConfig) => {
    const targetDashboard = overrideDashboard ?? dashboard
    if (!targetDashboard) return

    if (!activePresetId || isNewPresetDraft) {
      saveDashboardAsNewPreset(targetDashboard)
      return
    }

    const presetClone = cloneDashboardConfig({
      ...targetDashboard,
      id: activePresetId,
    })

    setPresets((prev) => prev.map((preset) => (preset.id === activePresetId ? presetClone : preset)))
    setDashboard(cloneDashboardConfig(presetClone))
    setHasUnsavedChanges(false)
    setIsNewPresetDraft(false)
    setFinishPresetName(presetClone.name)
  }

  const openSaveAsDialog = () => {
    const fallbackName =
      dashboard?.name && dashboard.name.trim().length > 0
        ? `${dashboard.name.trim()} Copy`
        : `Preset ${presets.length + 1}`
    setSavePresetName(fallbackName)
    setIsSaveAsDialogOpen(true)
  }

  const handleSavePresetAs = () => {
    if (!dashboard) return

    const trimmedName = savePresetName.trim().length > 0 ? savePresetName.trim() : `Preset ${presets.length + 1}`
    saveDashboardAsNewPreset(dashboard, trimmedName)
    setSavePresetName("")
    setIsSaveAsDialogOpen(false)
  }

  const openRenameDialog = () => {
    setRenamePresetName(dashboard?.name ?? "")
    setIsRenameDialogOpen(true)
  }

  const handleRenamePreset = () => {
    if (!activePresetId) return
    const trimmedName = renamePresetName.trim()
    if (!trimmedName) return

    setPresets((prev) => prev.map((preset) => (preset.id === activePresetId ? { ...preset, name: trimmedName } : preset)))
    setDashboard((prev) => (prev ? { ...prev, name: trimmedName } : prev))
    setIsRenameDialogOpen(false)
  }

  const handleDeletePreset = () => {
    if (!activePresetId) return

    setPresets((prev) => {
      const nextPresets = prev.filter((preset) => preset.id !== activePresetId)
      if (nextPresets.length === 0) {
        const fallbackPreset = createDefaultPreset(dashboardId)
        setActivePresetId(fallbackPreset.id)
        setDashboard(cloneDashboardConfig(fallbackPreset))
        setHasUnsavedChanges(false)
        setIsNewPresetDraft(false)
        return [fallbackPreset]
      }

      const nextActivePreset = nextPresets[0]
      setActivePresetId(nextActivePreset.id)
      setDashboard(cloneDashboardConfig(nextActivePreset))
      setHasUnsavedChanges(false)
      setIsNewPresetDraft(false)
      return nextPresets
    })
    setIsDeleteDialogOpen(false)
  }

  const handleStartNewLayout = () => {
    if (hasUnsavedChanges && typeof window !== "undefined") {
      const shouldProceed = window.confirm("You have unsaved changes. Start a new layout anyway?")
      if (!shouldProceed) return
    }

    const defaultName = `New Layout ${presets.length + 1}`
    const blankPreset = createBlankDashboardPreset(defaultName)

    setDashboard(cloneDashboardConfig(blankPreset))
    setActivePresetId(null)
    setIsEditMode(true)
    setHasUnsavedChanges(true)
    setIsNewPresetDraft(true)
    setFinishPresetName(defaultName)
  }

  const handleToggleEditMode = () => {
    if (!dashboard) return

    if (!isEditMode) {
      setIsEditMode(true)
      setFinishPresetName(dashboard.name)
      return
    }

    setFinishPresetName(dashboard.name)
    setIsFinishPresetDialogOpen(true)
  }

  const handleConfirmFinishEditing = () => {
    if (!dashboard) return

    const trimmedName = finishPresetName.trim() || dashboard.name || `Preset ${presets.length + 1}`
    const nextDashboard: DashboardConfig = {
      ...dashboard,
      name: trimmedName,
    }

    if (!activePresetId || isNewPresetDraft) {
      saveDashboardAsNewPreset(nextDashboard, trimmedName)
    } else {
      handleSavePresetChanges(nextDashboard)
    }
    setIsEditMode(false)
    setIsFinishPresetDialogOpen(false)
  }

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
    setHasUnsavedChanges(true)
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
    setHasUnsavedChanges(true)
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
    setHasUnsavedChanges(true)
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
        <div className="px-6 py-4 space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <img src="/dashboard-logo.png" alt="ApiLog" className="h-8" />
              <div className="h-6 w-px bg-border" />
              <div>
                <h1 className="text-xl font-semibold text-foreground">{dashboard.name}</h1>
                <p className="text-sm text-muted-foreground">Save and reuse layouts with presets.</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              {/* Theme Toggle Button */}
              <ThemeToggle />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="min-w-[220px] justify-between">
                    <span className="truncate">{activePreset?.name ?? dashboard?.name ?? "Select preset"}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64">
                  <DropdownMenuLabel>Presets</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {presets.length === 0 ? (
                    <DropdownMenuItem disabled>No presets yet</DropdownMenuItem>
                  ) : (
                    presets.map((preset) => (
                      <DropdownMenuItem key={preset.id} onSelect={() => handlePresetSelect(preset.id)}>
                        <div className="flex w-full items-center justify-between gap-2">
                          <span className="truncate">{preset.name}</span>
                          {preset.id === activePresetId && <Check className="h-4 w-4 text-primary" />}
                        </div>
                      </DropdownMenuItem>
                    ))
                  )}
                  {(hasUnsavedChanges || dashboard) && <DropdownMenuSeparator />}
                  {hasUnsavedChanges && (
                    <DropdownMenuItem
                      disabled={!activePresetId && !isNewPresetDraft}
                      onSelect={() => handleSavePresetChanges()}
                    >
                      <Save className="mr-2 h-4 w-4" />
                      Save changes
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onSelect={() => openSaveAsDialog()} disabled={!dashboard}>
                    <CopyPlus className="mr-2 h-4 w-4" />
                    Save as preset
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuItem onSelect={() => openRenameDialog()} disabled={!activePresetId}>
                    <PenLine className="mr-2 h-4 w-4" />
                    Rename preset
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    disabled={presets.length <= 1}
                    onSelect={() => setIsDeleteDialogOpen(true)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete preset
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {hasUnsavedChanges && (
                <Badge variant="secondary" className="uppercase tracking-wide">
                  Unsaved
                </Badge>
              )}

              {!isNewPresetDraft && (
                <Button variant="outline" size="sm" onClick={handleStartNewLayout}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Layout
                </Button>
              )}

              <Button variant={isEditMode ? "default" : "outline"} size="sm" onClick={handleToggleEditMode}>
                <LayoutGrid className="h-4 w-4 mr-2" />
                {isEditMode ? "Save" : "Edit Layout"}
              </Button>
            </div>
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

      <Dialog open={isFinishPresetDialogOpen} onOpenChange={setIsFinishPresetDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save layout as preset</DialogTitle>
            <DialogDescription>Give this preset a name and we&apos;ll save your latest changes.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={finishPresetName}
              onChange={(event) => setFinishPresetName(event.target.value)}
              placeholder="Preset name"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsFinishPresetDialogOpen(false)}>
                Continue editing
              </Button>
              <Button onClick={handleConfirmFinishEditing}>Save &amp; exit</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isSaveAsDialogOpen} onOpenChange={setIsSaveAsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save as Preset</DialogTitle>
            <DialogDescription>Store the current layout under a new preset.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={savePresetName}
              onChange={(event) => setSavePresetName(event.target.value)}
              placeholder="Preset name"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsSaveAsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSavePresetAs}>Save Preset</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Preset</DialogTitle>
            <DialogDescription>Update the display name for this preset.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={renamePresetName}
              onChange={(event) => setRenamePresetName(event.target.value)}
              placeholder="Preset name"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsRenameDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleRenamePreset} disabled={!renamePresetName.trim()}>
                Save Name
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete preset?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the preset and its layout. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleDeletePreset}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
