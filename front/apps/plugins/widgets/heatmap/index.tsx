import React, { useEffect, useRef, useState, useCallback } from "react"
import type { WidgetMeta, WidgetProps } from "@/core/registry"
import {
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ChevronDown, Smartphone, Tablet } from "lucide-react"

// deck.gl imports
import { HeatmapLayer } from "@deck.gl/aggregation-layers"
import { Deck, OrthographicView, OrthographicViewState } from "@deck.gl/core"

// --- Types ---

interface ApiClickData {
  x: number // percentage (0-100)
  y: number // percentage (0-100)
  value: number
}

interface HeatmapData {
  snapshot_url: string | null
  clicks: ApiClickData[]
}

// --- API Functions ---

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ""

async function fetchHeatmapData(
  path: string,
  deviceType: string
): Promise<HeatmapData> {
  const apiUrl = `${API_BASE_URL}/api/query/heatmap?path=${encodeURIComponent(
    path
  )}&deviceType=${deviceType}`

  const response = await fetch(apiUrl)
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`)
  }
  const result: HeatmapData = await response.json()
  return result
}

async function generateSnapshot(
  path: string,
  deviceType: string
): Promise<void> {
  const apiUrl = `${API_BASE_URL}/api/query/heatmap/generate?path=${encodeURIComponent(
    path
  )}&deviceType=${deviceType}`

  const response = await fetch(apiUrl, { method: "POST" })
  if (!response.ok) {
    throw new Error(`Failed to generate snapshot: ${response.status}`)
  }
}

const MOCK_PAGES = ["/", "/cart", "/products", "/checkout"]

// --- Main Widget Component ---

export default function HeatmapWidget({ timeRange }: WidgetProps) {
  const [selectedPage, setSelectedPage] = useState<string>(MOCK_PAGES[0])
  const [selectedDevice, setSelectedDevice] = useState<"desktop" | "mobile">(
    "desktop"
  )
  const [data, setData] = useState<HeatmapData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageDimensions, setImageDimensions] = useState<{
    width: number
    height: number
  } | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const deckRef = useRef<Deck | null>(null)

  // Polling for snapshot generation
  const pollForSnapshot = useCallback(async () => {
    let attempts = 0
    const maxAttempts = 30 // 30 seconds max

    while (attempts < maxAttempts) {
      try {
        const result = await fetchHeatmapData(selectedPage, selectedDevice)
        if (result.snapshot_url) {
          setData(result)
          setIsGenerating(false)
          setIsLoading(false)
          return
        }
      } catch (err) {
        // Continue polling
      }

      await new Promise((resolve) => setTimeout(resolve, 1000))
      attempts++
    }

    setError("Snapshot generation timed out. Please try again.")
    setIsGenerating(false)
    setIsLoading(false)
  }, [selectedPage, selectedDevice])

  // Fetch data and handle snapshot generation
  useEffect(() => {
    setIsLoading(true)
    setError(null)
    setData(null)
    setImageDimensions(null)
    setIsGenerating(false)

    // Cleanup deck.gl instance
    if (deckRef.current) {
      deckRef.current.finalize()
      deckRef.current = null
    }

    fetchHeatmapData(selectedPage, selectedDevice)
      .then((result) => {
        if (!result.snapshot_url) {
          // No snapshot exists, generate it
          setIsGenerating(true)
          generateSnapshot(selectedPage, selectedDevice)
            .then(() => pollForSnapshot())
            .catch((err) => {
              setError(err.message || "Failed to generate snapshot")
              setIsLoading(false)
              setIsGenerating(false)
            })
        } else {
          setData(result)
          setIsLoading(false)
        }
      })
      .catch((err: any) => {
        setError(err.message || "Failed to fetch data")
        setIsLoading(false)
      })
  }, [selectedPage, selectedDevice, pollForSnapshot])

  // Handle image load and set dimensions
  const handleImageLoad = (
    event: React.SyntheticEvent<HTMLImageElement, Event>
  ) => {
    const img = event.currentTarget
    const { naturalWidth, naturalHeight } = img

    if (!containerRef.current || !data) return

    // Get container width to scale image
    const containerWidth = containerRef.current.offsetWidth
    const scale = containerWidth / naturalWidth
    const scaledHeight = naturalHeight * scale

    setImageDimensions({
      width: containerWidth,
      height: scaledHeight,
    })
  }

  // Initialize deck.gl heatmap
  const initializeDeck = useCallback((
    width: number,
    height: number,
    clicks: ApiClickData[]
  ) => {
    if (!canvasContainerRef.current) {
      console.log("Canvas container ref not available")
      return
    }

    // Clean up previous instance
    if (deckRef.current) {
      deckRef.current.finalize()
    }

    // Convert percentage coordinates to pixel coordinates
    const points = clicks.map((click) => ({
      position: [click.x * width, click.y * height] as [
        number,
        number
      ],
      weight: click.value,
    }))

    console.log("Initializing deck.gl with:", {
      width,
      height,
      pointsCount: points.length,
      samplePoint: points[0],
    })

    const INITIAL_VIEW_STATE = {
      target: [width/2, height/2, 0],
      zoom: 0
    };

    // Create deck.gl instance - use parent element, not canvas ID
    const deck = new Deck({
      parent: canvasContainerRef.current,
      width,
      height,
      viewState: INITIAL_VIEW_STATE,
      controller: false,
      views: [
        new OrthographicView({
          id: 'ortho',
          controller: false,
          flipY : true,
        })
      ],
      layers: [
        new HeatmapLayer({
        id: "heatmap-layer",
        data: points,
        getPosition: (d: any) => d.position,
        getWeight: (d: any) => d.weight,
        radiusPixels: 40,
        intensity: 2,
          threshold: 0.05,
          opacity: 0.2,
          colorRange: [
            [0, 0, 255, 25], // transparent blue
            [0, 128, 255, 102], // light blue
            [0, 255, 255, 153], // cyan
            [0, 255, 0, 204], // green
            [255, 255, 0, 230], // yellow
            [255, 128, 0, 255], // orange
            [255, 0, 0, 255], // red
          ],
        }),
      ]
    })

    deckRef.current = deck
    
    // Force a redraw
    deck.redraw(true)
  }, [])

  // Initialize deck.gl after dimensions are set and canvas container is available
  useEffect(() => {
    if (!imageDimensions || !data?.clicks || !canvasContainerRef.current) {
      return
    }

    if (data.clicks.length === 0) {
      return
    }

    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      initializeDeck(imageDimensions.width, imageDimensions.height, data.clicks)
    }, 100)

    return () => clearTimeout(timer)
  }, [imageDimensions, data, initializeDeck])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (deckRef.current) {
        deckRef.current.finalize()
      }
    }
  }, [])

  return (
    <>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Page Heatmap</CardTitle>
        <div className="flex items-center space-x-2">
          {/* Page Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                <span className="truncate max-w-xs">{selectedPage}</span>
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {MOCK_PAGES.map((page) => (
                <DropdownMenuItem
                  key={page}
                  onSelect={() => setSelectedPage(page)}
                >
                  {page}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Device Toggle */}
          <ToggleGroup
            type="single"
            value={selectedDevice}
            onValueChange={(value) => {
              if (value) setSelectedDevice(value as "desktop" | "mobile")
            }}
            size="sm"
          >
            <ToggleGroupItem value="desktop" aria-label="Desktop">
              <Tablet className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="mobile" aria-label="Mobile">
              <Smartphone className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </CardHeader>
      <CardContent>
        {/* Scrollable Viewport */}
        <div
          ref={containerRef}
          className="relative w-full h-[600px] overflow-auto rounded-md border"
          style={{ background: "#f9f9f9" }}
        >
          {/* Loading State */}
          {(isLoading || isGenerating) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-white/80">
              <Spinner className="h-8 w-8 mb-4" />
              <p className="text-sm text-muted-foreground">
                {isGenerating
                  ? "Creating a snapshot... It will refresh after a while."
                  : "Loading..."}
              </p>
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && !isGenerating && (
            <div className="absolute inset-0 flex items-center justify-center z-10 p-4">
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          )}

          {/* No Click Data */}
          {data &&
            data.snapshot_url &&
            (!data.clicks || data.clicks.length === 0) &&
            !isLoading &&
            !isGenerating && (
              <div className="absolute inset-0 flex items-center justify-center z-10 p-4">
                <Alert>
                  <AlertDescription>
                    No click data available for this page.
                  </AlertDescription>
                </Alert>
              </div>
            )}

          {/* Background Image + Heatmap Overlay */}
          {data?.snapshot_url && !isLoading && !isGenerating && (
            <div className="relative" style={{ width: "100%" }}>
              {/* Background Snapshot */}
              <img
                src={`${API_BASE_URL}${data.snapshot_url}`}
                alt={`Snapshot (${selectedPage} - ${selectedDevice})`}
                style={{
                  width: "100%",
                  height: "auto",
                  display: "block",
                }}
                onLoad={handleImageLoad}
              />

              {/* deck.gl Canvas Overlay */}
              {imageDimensions && data.clicks && data.clicks.length > 0 && (
                <div
                  ref={canvasContainerRef}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: `${imageDimensions.width}px`,
                    height: `${imageDimensions.height}px`,
                    pointerEvents: "none",
                  }}
                />
              )}
            </div>
          )}
        </div>
      </CardContent>
    </>
  )
}

// --- Widget Metadata ---

export const widgetMeta: WidgetMeta = {
  id: "heatmap",
  name: "Page Heatmap",
  description: "Displays click heatmap overlayed on page snapshots using deck.gl",
  defaultWidth: 600,
  defaultHeight: 700,
}