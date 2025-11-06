import React, { useEffect, useRef, useState, useMemo } from "react"
// 1. deck.gl 관련 모듈 import
import { DeckGL } from "@deck.gl/react"
import { OrthographicView } from "@deck.gl/core"
import { HeatmapLayer } from "@deck.gl/aggregation-layers"
// 2. heatmap.js import 삭제
// import h337 from "heatmap.js"

import type { WidgetMeta, WidgetProps } from "@/core/registry"
import {
  Card,
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

// --- API 요청 로직 (변경 없음) ---

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ""

// 백엔드 API로부터 받을 데이터 타입 정의
interface HeatmapData {
  snapshot_url: string | null
  clicks: Array<{ x: any; y: any; value: any }>
}

/**
 * 백엔드에서 히트맵 데이터(스냅샷 URL, 클릭 좌표)를 가져옵니다.
 */
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

// (임시) 페이지 목록.
const MOCK_PAGES = ["/", "/cart", "/products", "/checkout"]

// --- 3. 위젯 컴포넌트 (deck.gl 적용 및 폴링) ---

export default function HeatmapWidget({ timeRange }: WidgetProps) {
  // --- 상태 관리 ---
  const [selectedPage, setSelectedPage] = useState<string>(MOCK_PAGES[0])
  const [selectedDevice, setSelectedDevice] = useState<"desktop" | "mobile">(
    "desktop"
  )
  const [data, setData] = useState<HeatmapData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasClickData, setHasClickData] = useState(true)
  

  // (추가) 로드된 스냅샷 이미지의 원본 크기를 저장할 상태
  const [imageDimensions, setImageDimensions] = useState<{
    width: number
    height: number
  } | null>(null)

  // (삭제) heatmap.js 관련 ref 삭제

  // --- API 데이터 연동 (폴링 기능 추가) ---
  useEffect(() => {
    // 폴링 중단 플래그
    let isCancelled = false
    let pollingTimeout: NodeJS.Timeout | null = null

    // 데이터를 폴링하는 비동기 함수
    const pollData = async () => {
      if (isCancelled) return

      setIsLoading(true) // 항상 로딩 상태로 시작

      try {
        const result = await fetchHeatmapData(selectedPage, selectedDevice)
        if (isCancelled) return // fetch 후에도 체크

        // 1. 스냅샷 URL이 있는 경우 (성공)
        if (result.snapshot_url) {
          setData(result)
          setError(null) // 성공했으니 에러 메시지(폴링 메시지 포함) 제거
          setIsLoading(false) // 로딩 완료!

          if (!result.clicks || result.clicks.length === 0) {
            setHasClickData(false)
          } else {
            setHasClickData(true)
          }
          // (imageDimensions는 handleImageLoad가 설정할 것임)
          
        } else {
          // 2. 스냅샷 URL이 없는 경우 (폴링)
          setData(null) // 이전 데이터가 보이지 않도록 함
          setHasClickData(true) // 클릭 데이터 상태 리셋
          // (수정) 에러 대신 로딩 상태 + 메시지 유지
          setError(
            "Creating a snapshot... It will refresh after a while."
          )
          setIsLoading(true) // 스피너를 계속 보여줌

          pollingTimeout = setTimeout(pollData, 1000)
        }
      } catch (err: any) {
        // 3. '진짜' 에러가 발생한 경우 (네트워크 오류 등)
        if (isCancelled) return
        setError(err.message || "fail to fetch data.")
        setIsLoading(false) // 로딩 중단
        setData(null)
      }
    }

    // 첫 번째 데이터 요청 시작
    pollData()

    // --- Cleanup 함수 ---
    // dependency(selectedPage, selectedDevice)가 변경되거나
    // 컴포넌트가 언마운트되면 실행됩니다.
    return () => {
      isCancelled = true
      if (pollingTimeout) {
        clearTimeout(pollingTimeout) // 예약된 다음 폴링을 취소
      }
    }
  }, [selectedPage, selectedDevice]) // 의존성은 동일


  // --- (변경) 이미지 로드 핸들러: 크기만 상태에 저장 ---
  const handleImageLoad = (
    event: React.SyntheticEvent<HTMLImageElement, Event>
  ) => {
    // <img> 태그가 로드되면, 해당 이미지의 원본 크기를 상태에 저장합니다.
    const img = event.currentTarget
    setImageDimensions({
      width: img.naturalWidth,
      height: img.naturalHeight,
    })
  }

  // --- (추가) deck.gl 데이터 포맷팅 ---
  const heatmapData = useMemo(() => {
    if (!data?.clicks || !imageDimensions) return []

    return data.clicks
      .map((pt) => ({
        // deck.gl의 HeatmapLayer는 getPosition으로 좌표를, getWeight로 가중치를 받습니다.
        coordinates: [
          Number(pt.x) * imageDimensions.width,
          Number(pt.y) * imageDimensions.height,
        ],
        weight: Number(pt.value),
      }))
      .filter(
        (pt) =>
          !isNaN(pt.coordinates[0]) &&
          !isNaN(pt.coordinates[1]) &&
          !isNaN(pt.weight)
      )
  }, [data?.clicks])

  // --- (추가) deck.gl 레이어 정의 (HeatmapLayer만 사용) ---
  const layers = [
    new HeatmapLayer({
      id: "heatmap-layer",
      data: hasClickData ? heatmapData : [],
      getPosition: (d: any) => d.coordinates,
      getWeight: (d: any) => d.weight,
      radiusPixels: 40,
      opacity: 0.8,
      blendMode: "multiply", 
    }),
  ]

  return (
    <>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Heatmap Widget</CardTitle>
        
        {/* --- 컨트롤러 (페이지/기기 선택) --- */}
        <div className="flex items-center space-x-2">
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
        {/* --- 스크롤 가능한 뷰포트 --- */}
        <div
          className="relative h-[600px] w-full overflow-auto rounded-md border"
        >
          {/* --- (변경) 로딩 및 에러 상태 표시 --- */}

          {/* 1. 로딩 중일 때: 스피너 + (있다면) 폴링 메시지 표시 */}
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-white/50 p-4">
              <Spinner className="h-8 w-8" />
              {/* error 상태를 폴링 메시지용으로 활용 */}
              {error && (
                <AlertDescription className="mt-2 text-center text-sm text-muted-foreground">
                  {error}
                </AlertDescription>
              )}
            </div>
          )}
          
          {/* 2. 로딩이 끝났는데, '진짜' 에러가 있을 때 (폴링 메시지 아님) */}
          {error && !isLoading && (
            <div className="absolute inset-0 flex items-center justify-center z-10 p-4">
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          )}

          {/* --- 백그라운드 스냅샷 + 히트맵 오버레이 --- */}
          {data?.snapshot_url && !isLoading && !error && (
            <div className="relative" style={{ width: "fit-content" }}>
                <img
                    src={`${API_BASE_URL}${data.snapshot_url}`}
                    alt={`snapshot (${selectedPage} - ${selectedDevice})`}
                    className="block"
                    style={{ 
                        opacity: 0.5,
                        maxWidth: "none",
                        display: "block"
                    }}
                    onLoad={handleImageLoad}
                />
                
                {imageDimensions && (
                    <DeckGL
                        style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            zIndex: 10,
                            width: `${imageDimensions.width}px`,
                            height: `${imageDimensions.height}px`,
                            pointerEvents: "none",
                            mixBlendMode: "multiply",
                        }}
                        views={new OrthographicView({ flipY: true })}
                        initialViewState={{
                            target: [
                            imageDimensions.width / 2,
                            imageDimensions.height / 2,
                            0,
                            ],
                            zoom: 0,
                        }}
                        controller={false} 
                        layers={layers}
                    />
                )}
            </div>
          )}
        </div>
      </CardContent>
    </>
  )
}

// --- 4. 위젯 메타데이터 (변경 없음) ---

export const widgetMeta: WidgetMeta = {
  id: "heatmap", // 고유 ID
  name: "heatmap widget", // 대시보드에 표시될 이름
  description: "페이지별 클릭 히트맵을 스냅샷 위에 표시합니다.",
  defaultWidth: 600, // 위젯 기본 너비
  defaultHeight: 700, // 위젯 기본 높이
}