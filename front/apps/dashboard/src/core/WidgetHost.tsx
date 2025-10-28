"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { GripVertical, X } from "lucide-react"
import { widgetRegistry } from "./registry"

interface WidgetHostProps {
  id: string
  type: string
  config?: Record<string, any>
  timeRange: string
  isEditMode: boolean
  onRemove: () => void
  width?: number
  height?: number
  onResize?: (width: number, height: number) => void
}

export function WidgetHost({
  id,
  type,
  config,
  timeRange,
  isEditMode,
  onRemove,
  width = 400,
  height = 300,
  onResize,
}: WidgetHostProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !isEditMode,
  })

  const [isResizing, setIsResizing] = useState(false)
  const [currentWidth, setCurrentWidth] = useState(width)
  const [currentHeight, setCurrentHeight] = useState(height)
  const resizeRef = useRef<{ startX: number; startY: number; startWidth: number; startHeight: number } | null>(null)

  useEffect(() => {
    setCurrentWidth(width)
    setCurrentHeight(height)
  }, [width, height])

  const handleResizeStart = (e: React.MouseEvent, direction: "se" | "e" | "s") => {
    e.preventDefault()
    e.stopPropagation()

    setIsResizing(true)
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startWidth: currentWidth,
      startHeight: currentHeight,
    }

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizeRef.current) return

      const deltaX = moveEvent.clientX - resizeRef.current.startX
      const deltaY = moveEvent.clientY - resizeRef.current.startY

      if (direction === "se" || direction === "e") {
        const newWidth = Math.max(300, resizeRef.current.startWidth + deltaX)
        setCurrentWidth(newWidth)
      }

      if (direction === "se" || direction === "s") {
        const newHeight = Math.max(200, resizeRef.current.startHeight + deltaY)
        setCurrentHeight(newHeight)
      }
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      if (onResize && resizeRef.current) {
        onResize(currentWidth, currentHeight)
      }
      resizeRef.current = null
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isResizing ? "none" : transition,
    opacity: isDragging ? 0.5 : 1,
    width: `${currentWidth}px`,
    height: `${currentHeight}px`,
  }

  const WidgetComponent = widgetRegistry[type]

  if (!WidgetComponent) {
    return (
      <Card ref={setNodeRef} style={style} className="border-destructive">
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
    <Card ref={setNodeRef} style={style} className="relative group flex flex-col">
      {/* Edit Mode Controls */}
      {isEditMode && (
        <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 bg-background/80 backdrop-blur-sm hover:bg-background"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 bg-background/80 backdrop-blur-sm hover:bg-destructive hover:text-destructive-foreground"
            onClick={onRemove}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {isEditMode && (
        <>
          {/* Corner resize handle (bottom-right) */}
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity z-20"
            onMouseDown={(e) => handleResizeStart(e, "se")}
          >
            <div className="absolute bottom-1 right-1 w-3 h-3 border-r-2 border-b-2 border-primary rounded-br" />
          </div>

          {/* Right edge resize handle */}
          <div
            className="absolute top-0 right-0 w-2 h-full cursor-e-resize opacity-0 group-hover:opacity-50 hover:opacity-100 transition-opacity z-10"
            onMouseDown={(e) => handleResizeStart(e, "e")}
          >
            <div className="absolute top-1/2 right-0 w-1 h-12 -translate-y-1/2 bg-primary rounded-l" />
          </div>

          {/* Bottom edge resize handle */}
          <div
            className="absolute bottom-0 left-0 w-full h-2 cursor-s-resize opacity-0 group-hover:opacity-50 hover:opacity-100 transition-opacity z-10"
            onMouseDown={(e) => handleResizeStart(e, "s")}
          >
            <div className="absolute bottom-0 left-1/2 w-12 h-1 -translate-x-1/2 bg-primary rounded-t" />
          </div>
        </>
      )}

      {/* Widget Content */}
      <div className="flex-1 overflow-auto">
        <WidgetComponent config={config} timeRange={timeRange} />
      </div>
    </Card>
  )
}
