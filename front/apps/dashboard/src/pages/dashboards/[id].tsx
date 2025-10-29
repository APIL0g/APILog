"use client"

import { useState, useEffect } from "react"
import { DndContext, type DragEndEvent, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core"
import { SortableContext, arrayMove, rectSortingStrategy } from "@dnd-kit/sortable"
import { WidgetHost } from "@/core/WidgetHost"
import { widgetMetadata } from "@/core/registry"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Settings, LayoutGrid } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"

interface Widget {
  id: string
  type: string
  position: number
  config?: Record<string, any>
  width?: number
  height?: number
}

interface DashboardConfig {
  id: string
  name: string
  widgets: Widget[]
}

export default function DashboardPage() {
  const id = "default"
  const [dashboard, setDashboard] = useState<DashboardConfig | null>(null)
  const [isAddingWidget, setIsAddingWidget] = useState(false)
  const [selectedWidgetType, setSelectedWidgetType] = useState<string>("")
  const [timeRange, setTimeRange] = useState("12h")
  const [isEditMode, setIsEditMode] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  )

  const widgetMetadataKey = Object.keys(widgetMetadata).join(",")
  const availableWidgets = Object.values(widgetMetadata)

  // Load dashboard configuration
  useEffect(() => {
    const metadataList = Object.values(widgetMetadata)

    const widgets = metadataList.map((meta, index) => ({
      id: `widget-${index + 1}`,
      type: meta.id,
      position: index,
      width: meta.defaultWidth ?? 400,
      height: meta.defaultHeight ?? 300,
      config: meta.defaultConfig,
    }))

    setDashboard({
      id: id || "default",
      name: "Analytics Overview",
      widgets,
    })
  }, [id, widgetMetadataKey])

  useEffect(() => {
    if (!selectedWidgetType) {
      const metadataList = Object.values(widgetMetadata)
      if (metadataList.length > 0) {
        setSelectedWidgetType(metadataList[0].id)
      }
    }
  }, [selectedWidgetType, widgetMetadataKey])

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id && dashboard) {
      const oldIndex = dashboard.widgets.findIndex((w) => w.id === active.id)
      const newIndex = dashboard.widgets.findIndex((w) => w.id === over.id)

      const newWidgets = arrayMove(dashboard.widgets, oldIndex, newIndex).map((widget, index) => ({
        ...widget,
        position: index,
      }))

      setDashboard({
        ...dashboard,
        widgets: newWidgets,
      })
    }
  }

  const handleAddWidget = () => {
    if (!selectedWidgetType || !dashboard) return

    const meta = widgetMetadata[selectedWidgetType]

    const newWidget: Widget = {
      id: `widget-${Date.now()}`,
      type: selectedWidgetType,
      position: dashboard.widgets.length,
      width: meta?.defaultWidth ?? 400,
      height: meta?.defaultHeight ?? 300,
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

    setDashboard({
      ...dashboard,
      widgets: dashboard.widgets.filter((w) => w.id !== widgetId),
    })
  }

  const handleResize = (widgetId: string, width: number, height: number) => {
    if (!dashboard) return

    setDashboard({
      ...dashboard,
      widgets: dashboard.widgets.map((w) => (w.id === widgetId ? { ...w, width, height } : w)),
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
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Last 1 hour</SelectItem>
                <SelectItem value="6h">Last 6 hours</SelectItem>
                <SelectItem value="12h">Last 12 hours</SelectItem>
                <SelectItem value="24h">Last 24 hours</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
              </SelectContent>
            </Select>

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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={dashboard.widgets.map((w) => w.id)} strategy={rectSortingStrategy}>
            <div className="flex flex-wrap gap-6">
              {dashboard.widgets.map((widget) => (
                <WidgetHost
                  key={widget.id}
                  id={widget.id}
                  type={widget.type}
                  config={widget.config}
                  timeRange={timeRange}
                  isEditMode={isEditMode}
                  onRemove={() => handleRemoveWidget(widget.id)}
                  width={widget.width}
                  height={widget.height}
                  onResize={(width, height) => handleResize(widget.id, width, height)}
                />
              ))}

              {/* Add Widget Card */}
              {isEditMode && (
                <Card
                  className="border-2 border-dashed border-border bg-card/50 hover:bg-card/80 transition-colors"
                  style={{ width: 400, minHeight: 300 }}
                >
                  <div className="flex flex-col items-center justify-center p-8 min-h-[300px]">
                    {!isAddingWidget ? (
                      <Button onClick={() => setIsAddingWidget(true)} variant="outline" size="lg">
                        <Plus className="h-5 w-5 mr-2" />
                        Add Widget
                      </Button>
                    ) : (
                      <div className="w-full max-w-sm space-y-4">
                        <h3 className="text-lg font-semibold text-center">Select Widget Type</h3>
                        <Select value={selectedWidgetType} onValueChange={setSelectedWidgetType}>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a widget..." />
                          </SelectTrigger>
                          <SelectContent>
                            {availableWidgets.map((meta) => (
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
                    )}
                  </div>
                </Card>
              )}
            </div>
          </SortableContext>
        </DndContext>

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
    </div>
  )
}
