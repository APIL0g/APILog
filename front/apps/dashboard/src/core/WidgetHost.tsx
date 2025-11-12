"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { GripVertical, X } from "lucide-react"
import { widgetRegistry } from "./registry"

interface WidgetHostProps {
  type: string
  config?: Record<string, any>
  timeRange: string
  language?: string
  isEditMode: boolean
  onRemove: () => void
}

export function WidgetHost({ type, config, timeRange, language, isEditMode, onRemove }: WidgetHostProps) {
  const WidgetComponent = widgetRegistry[type]

  if (!WidgetComponent) {
    return (
      <Card className="border-destructive h-full flex flex-col">
        <CardHeader>
          <CardTitle className="text-destructive">Widget Not Found</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            The widget type "{type}" is not registered. Please check your widget registry.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="relative group flex h-full flex-col">
      {/* Edit Mode Controls */}
      {isEditMode && (
        <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 bg-background/80 backdrop-blur-sm hover:bg-background widget-drag-handle"
            aria-label="Drag widget"
          >
            <GripVertical className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 bg-background/80 backdrop-blur-sm hover:bg-destructive hover:text-destructive-foreground"
            onClick={onRemove}
            aria-label="Remove widget"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Widget Content */}
      <div className="flex-1 overflow-auto">
        <WidgetComponent config={config} timeRange={timeRange} language={language} />
      </div>
    </Card>
  )
}
