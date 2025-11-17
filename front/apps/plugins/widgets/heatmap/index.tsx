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
import { getCommonWidgetCopy } from "../i18n"
import { getHeatmapCopy, type HeatmapKnownError } from "./locales"
import previewImage from "./preview.png"

// deck.gl imports
import { HeatmapLayer } from "@deck.gl/aggregation-layers"
import { Deck, OrthographicView, OrthographicViewState } from "@deck.gl/core"

// --- Types ---

interface ApiClickData {
  x: number // normalized viewport ratio (0-1)
  y: number // normalized viewport ratio (0-1)
  value: number
  element_rel_x?: number | null
  element_rel_y?: number | null
  element_rect_x?: number | null
  element_rect_y?: number | null
  element_rect_w?: number | null
  element_rect_h?: number | null
  element_hash?: string | null
}

interface HeatmapElementMetadataEntry {
  tag_name: string | null
  id: string | null
  classes: string | null
  text: string | null
  x: number
  y: number
  width: number
  height: number
  rel_x: number | null
  rel_y: number | null
  rel_width: number | null
  rel_height: number | null
  element_hash?: string | null
}

interface SnapshotElementMetadata {
  doc_width: number
  doc_height: number
  viewport_width: number
  viewport_height: number
  screenshot_width?: number | null
  screenshot_height?: number | null
  selectors?: string
  elements: HeatmapElementMetadataEntry[]
}

interface HeatmapData {
  snapshot_url: string | null
  clicks: ApiClickData[]
  element_metadata?: SnapshotElementMetadata | null
}

const DEFAULT_RELATIVE_POSITION = 0.5

function hasSnapshotAssets(payload: HeatmapData | null): payload is HeatmapData {
  return Boolean(payload && (payload.snapshot_html_url || payload.snapshot_url))
}

function isSnapshotPayloadReady(payload: HeatmapData | null): payload is HeatmapData {
  return Boolean(hasSnapshotAssets(payload) && payload?.element_metadata)
}

function resolveBaseDimensions(metadata?: SnapshotElementMetadata | null) {
  const baseWidth =
    metadata?.screenshot_width ||
    metadata?.viewport_width ||
    metadata?.doc_width ||
    null
  const baseHeight =
    metadata?.screenshot_height ||
    metadata?.viewport_height ||
    metadata?.doc_height ||
    null
  return { baseWidth, baseHeight }
}

function getElementMetric(value?: number | null, fallback?: number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  if (typeof fallback === "number" && Number.isFinite(fallback)) {
    return fallback
  }
  return null
}

function matchElementForClick(
  click: ApiClickData,
  metadata?: SnapshotElementMetadata | null
): HeatmapElementMetadataEntry | null {
  if (!metadata?.elements || metadata.elements.length === 0) {
    return null
  }

  const normalizedHash = (click.element_hash ?? "").trim()
  let candidates = metadata.elements

  if (normalizedHash && normalizedHash.toLowerCase() !== "unknown") {
    const hashMatches = metadata.elements.filter(
      (element) => (element.element_hash ?? "").trim() === normalizedHash
    )
    if (hashMatches.length === 1) {
      return hashMatches[0]
    }
    if (hashMatches.length > 1) {
      candidates = hashMatches
    }
  }

  let bestElement: HeatmapElementMetadataEntry | null = null
  let bestScore = Number.POSITIVE_INFINITY

  for (const element of candidates) {
    const diffs: number[] = []

    const pairs: Array<[number | null | undefined, number | null | undefined]> = [
      [click.element_rect_x, element.rel_x],
      [click.element_rect_y, element.rel_y],
      [click.element_rect_w, element.rel_width],
      [click.element_rect_h, element.rel_height],
    ]

    for (const [clickValue, elementValue] of pairs) {
      if (
        typeof clickValue === "number" &&
        Number.isFinite(clickValue) &&
        typeof elementValue === "number" &&
        Number.isFinite(elementValue)
      ) {
        diffs.push(Math.abs(clickValue - elementValue))
      }
    }

    if (diffs.length === 0) {
      continue
    }

    const score = diffs.reduce((sum, diff) => sum + diff, 0) / diffs.length
    if (score < bestScore) {
      bestScore = score
      bestElement = element
    }
  }

  if (bestElement) {
    return bestElement
  }

  if (
    normalizedHash &&
    normalizedHash.toLowerCase() !== "unknown" &&
    candidates.length > 0
  ) {
    return candidates[0]
  }

  return null
}

function projectClickToSnapshot(
  click: ApiClickData,
  metadata: SnapshotElementMetadata | null | undefined,
  renderWidth: number,
  renderHeight: number
): [number, number] {
  const { baseWidth, baseHeight } = resolveBaseDimensions(metadata)

  if (
    metadata &&
    baseWidth &&
    baseWidth > 0 &&
    baseHeight &&
    baseHeight > 0
  ) {
    const matchedElement = matchElementForClick(click, metadata)

    if (matchedElement) {
      const elementLeft =
        getElementMetric(matchedElement.rel_x, matchedElement.x / baseWidth) ??
        0
      const elementTop =
        getElementMetric(matchedElement.rel_y, matchedElement.y / baseHeight) ??
        0
      const elementWidth =
        getElementMetric(
          matchedElement.rel_width,
          matchedElement.width / baseWidth
        ) ?? 0
      const elementHeight =
        getElementMetric(
          matchedElement.rel_height,
          matchedElement.height / baseHeight
        ) ?? 0

      const offsetX =
        getElementMetric(click.element_rel_x, DEFAULT_RELATIVE_POSITION) ??
        DEFAULT_RELATIVE_POSITION
      const offsetY =
        getElementMetric(click.element_rel_y, DEFAULT_RELATIVE_POSITION) ??
        DEFAULT_RELATIVE_POSITION

      const snapshotX =
        (elementLeft * baseWidth) + offsetX * elementWidth * baseWidth
      const snapshotY =
        (elementTop * baseHeight) + offsetY * elementHeight * baseHeight

      const scaleX = renderWidth / baseWidth
      const scaleY = renderHeight / baseHeight

      return [snapshotX * scaleX, snapshotY * scaleY]
    }
  }

  return [click.x * renderWidth, click.y * renderHeight]
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
  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to generate snapshot: ${response.status}`)
  }
}

async function fetchPaths(): Promise<string[]> {
  // 백엔드 라우터에 prefix가 /api/query/heatmap으로 설정되었으므로
  const apiUrl = `${API_BASE_URL}/api/query/heatmap/paths`

  const response = await fetch(apiUrl, { method: "GET" })
  if (!response.ok) {
    throw new Error("Failed to fetch page list")
  }
  return response.json() // API는 string[]을 반환
}

// --- Main Widget Component ---

type HeatmapErrorState =
  | { code: HeatmapKnownError; details?: string }
  | { message: string }
  | null

export default function HeatmapWidget({ timeRange, language }: WidgetProps) {
  const [selectedPage, setSelectedPage] = useState<string>("")
  const [selectedDevice, setSelectedDevice] = useState<"desktop" | "mobile">(
    "desktop"
  )
  const [data, setData] = useState<HeatmapData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<HeatmapErrorState>(null)
  const [imageDimensions, setImageDimensions] = useState<{
    width: number
    height: number
  } | null>(null)

  const [paths, setPaths] = useState<string[]>([])
  const [pathsLoading, setPathsLoading] = useState(true)

  const containerRef = useRef<HTMLDivElement>(null)
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const deckRef = useRef<Deck | null>(null)
  const naturalImageSizeRef = useRef<{ width: number; height: number } | null>(null)
  const common = getCommonWidgetCopy(language)
  const copy = getHeatmapCopy(language)
  const [isSnapshotReady, setIsSnapshotReady] = useState(false)
  const resolvedErrorMessage = error
    ? "code" in error
      ? error.details
        ? `${copy.errors[error.code]} (${error.details})`
        : copy.errors[error.code]
      : "message" in error && error.message
        ? `${common.errorPrefix}: ${error.message}`
        : null
    : null

  // Polling for snapshot generation
  const pollForSnapshot = useCallback(async () => {
    let attempts = 0
    const maxAttempts = 30 // 30 seconds max

    while (attempts < maxAttempts) {
      try {
        const result = await fetchHeatmapData(selectedPage, selectedDevice)
        if (isSnapshotPayloadReady(result)) {
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

    setError({ code: "SNAPSHOT_TIMEOUT" })
    setIsGenerating(false)
    setIsLoading(false)
  }, [selectedPage, selectedDevice])

  // Fetch data and handle snapshot generation
  useEffect(() => {
    setIsLoading(true)
    setError(null)
    setData(null)
    setImageDimensions(null)
    naturalImageSizeRef.current = null
    setIsSnapshotReady(false)
    setIsGenerating(false)

    // Cleanup deck.gl instance
    if (deckRef.current) {
      deckRef.current.finalize()
      deckRef.current = null
    }

  fetchHeatmapData(selectedPage, selectedDevice)
  .then((result) => {
    const assetsReady = hasSnapshotAssets(result)
    const metadataReady = Boolean(result.element_metadata)

    if (!assetsReady) {
      setIsGenerating(true)
      setError(null)

      generateSnapshot(selectedPage, selectedDevice)
        .then(() => {
          pollForSnapshot().catch(() => {})
        })
        .catch((genErr) => {
          setError({
            code: "GENERATION_START_FAILED",
            details: genErr instanceof Error ? genErr.message : String(genErr),
          })
          setIsLoading(false)
          setIsGenerating(false)
        })
    } else if (!metadataReady) {
      setIsGenerating(true)
      pollForSnapshot().catch(() => {})
    } else {
      setData(result)
      setIsLoading(false)
    }
  })
  .catch((err: any) => {
    // 맨 처음 fetchHeatmapData가 실패한 경우
    setError({
      code: "FETCH_DATA_FAILED",
      details: err instanceof Error ? err.message : String(err),
    })
    setIsLoading(false)
  })
  }, [selectedPage, selectedDevice, pollForSnapshot])

  // Handle image load and set dimensions
  const updateImageDimensions = useCallback(() => {
    if (!containerRef.current || !naturalImageSizeRef.current) return
    const containerWidth = containerRef.current.offsetWidth
    if (containerWidth === 0) return

    const { width: naturalWidth, height: naturalHeight } = naturalImageSizeRef.current
    const scale = containerWidth / naturalWidth
    const scaledHeight = naturalHeight * scale

    setImageDimensions((prev) => {
      if (
        prev &&
        Math.abs(prev.width - containerWidth) < 0.5 &&
        Math.abs(prev.height - scaledHeight) < 0.5
      ) {
        return prev
      }
      return {
        width: containerWidth,
        height: scaledHeight,
      }
    })
  }, [])

  const handleImageLoad = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement, Event>) => {
      const img = event.currentTarget
      const { naturalWidth, naturalHeight } = img

      naturalImageSizeRef.current = { width: naturalWidth, height: naturalHeight }
      setIsSnapshotReady(true)
      updateImageDimensions()
    },
    [updateImageDimensions]
  )

  useEffect(() => {
    if (!isSnapshotReady || !naturalImageSizeRef.current) return
    const el = containerRef.current
    if (!el) return

    const observer = new ResizeObserver(() => {
      updateImageDimensions()
    })

    observer.observe(el)
    const handleWindowResize = () => updateImageDimensions()
    window.addEventListener("resize", handleWindowResize)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", handleWindowResize)
    }
  }, [isSnapshotReady, updateImageDimensions])

  // Initialize deck.gl heatmap
  const initializeDeck = useCallback((
    width: number,
    height: number,
    clicks: ApiClickData[],
    metadata?: SnapshotElementMetadata | null
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
    const points = clicks.map((click) => {
      const [x, y] = projectClickToSnapshot(click, metadata, width, height)
      return {
        position: [x, y] as [number, number],
        weight: click.value,
      }
    })

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

  // Initialize paths
  useEffect(() => {
    setPathsLoading(true)
    fetchPaths()
      .then((arrays) => {
        setPaths(arrays)
        // 페이지 목록을 성공적으로 가져오면, 첫 번째 페이지를 기본값으로 설정
        if (arrays.length > 0) {
          setSelectedPage(arrays[0]) 
        } else {
          // 조회 가능한 페이지가 없음
          setError({ code: "NO_PAGE_DATA" })
        }
      })
      .catch((err) => {
        setError({
          code: "PAGE_LIST_FAILED",
          details: err instanceof Error ? err.message : String(err),
        })
      })
      .finally(() => {
        setPathsLoading(false)
      })
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
      initializeDeck(
        imageDimensions.width,
        imageDimensions.height,
        data.clicks,
        data.element_metadata
      )
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
        <CardTitle className="text-sm font-medium">{copy.title}</CardTitle>
        <div className="flex items-center space-x-2">
          {/* Page Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8" disabled={pathsLoading || paths.length === 0}>
                <span className="truncate max-w-xs">{selectedPage || copy.pagePlaceholder}</span>
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {paths.length === 0 ? (
                <DropdownMenuItem disabled>{common.noData}</DropdownMenuItem>
              ) : (
                paths.map((page) => (
                  <DropdownMenuItem
                    key={page}
                    onSelect={() => setSelectedPage(page)}
                  >
                    {page}
                  </DropdownMenuItem>
                ))
              )}
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
            <ToggleGroupItem value="desktop" aria-label={copy.deviceLabel.desktop}>
              <Tablet className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="mobile" aria-label={copy.deviceLabel.mobile}>
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
                  ? copy.generatingSnapshot
                  : common.loading}
              </p>
            </div>
          )}

          {/* Error State */}
          {resolvedErrorMessage && !isLoading && !isGenerating && (
            <div className="absolute inset-0 flex items-center justify-center z-10 p-4">
              <Alert variant="destructive">
                <AlertDescription>{resolvedErrorMessage}</AlertDescription>
              </Alert>
            </div>
          )}

          {/* Background Image + Heatmap Overlay */}
          {data?.snapshot_url && !isLoading && !isGenerating && (
            <div className="relative" style={{ width: "100%" }}>
              {/* Background Snapshot */}
                <img
                  src={`${API_BASE_URL}${data.snapshot_url}`}
                  alt={`${copy.title} (${selectedPage || copy.pagePlaceholder} - ${copy.deviceLabel[selectedDevice]})`}
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
const heatmapLocales = {
  en: getHeatmapCopy("en"),
  ko: getHeatmapCopy("ko"),
}

export const widgetMeta: WidgetMeta = {
  id: "heatmap",
  name: "Heatmap",
  description: "Displays click heatmap overlayed on page snapshots using deck.gl",
  defaultWidth: 520,
  defaultHeight: 300,
  previewImage,
  tags: ["behavior"],
  localizations: {
    en: {
      title: heatmapLocales.en.title,
      previewDescription: heatmapLocales.en.previewDescription,
    },
    ko: {
      title: heatmapLocales.ko.title,
      previewDescription: heatmapLocales.ko.previewDescription,
    },
  },
}
