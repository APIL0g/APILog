"use client"

import { useEffect, useRef, useState } from "react"
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
  const contentRef = useRef<HTMLDivElement | null>(null)
  const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(null)

  useEffect(() => {
    if (typeof window === "undefined" || typeof ResizeObserver === "undefined") return
    const element = contentRef.current
    if (!element) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      setContainerSize((prev) => {
        if (prev && prev.width === width && prev.height === height) return prev
        return { width, height }
      })
    })

    observer.observe(element)
    return () => {
      observer.disconnect()
    }
  }, [])

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
        <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
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
      <div ref={contentRef} className="flex-1 overflow-auto">
        <WidgetComponent config={config} timeRange={timeRange} language={language} containerSize={containerSize ?? undefined} />
      </div>
    </Card>
  )
}
