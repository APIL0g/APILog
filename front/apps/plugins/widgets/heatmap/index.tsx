import React, { useEffect, useRef, useState } from "react"
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

// 1. (수정) D3.js를 임포트합니다.
import * as d3 from "d3"

// --- API 요청 로직 ---

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ""

// 2. (수정) API가 반환하는 타입 (값이 문자열일 수 있음)
interface ApiClickData {
  x: any
  y: any
  value: any
}

// D3가 사용할, 숫자로 변환된 데이터 타입
interface ClickPoint {
  x: number
  y: number
  value: number
}

interface HeatmapData {
  snapshot_url: string | null
  clicks: ApiClickData[]
}

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

const MOCK_PAGES = ["/", "/cart", "/products", "/checkout"]

// --- 3. 위젯 컴포넌트 ---

export default function HeatmapWidget({ timeRange }: WidgetProps) {
  const [selectedPage, setSelectedPage] = useState<string>(MOCK_PAGES[0])
  const [selectedDevice, setSelectedDevice] = useState<"desktop" | "mobile">(
    "desktop"
  )
  const [data, setData] = useState<HeatmapData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasClickData, setHasClickData] = useState(true)

  // 4. (수정) D3가 SVG를 그릴 컨테이너를 참조합니다.
  const svgContainerRef = useRef<HTMLDivElement>(null)

  // --- API 데이터 연동 ---
  useEffect(() => {
    setIsLoading(true)
    setError(null)
    setData(null)
    setHasClickData(true)

    // 5. (수정) D3 렌더링을 위해 이전에 그려진 SVG를 지웁니다.
    if (svgContainerRef.current) {
      d3.select(svgContainerRef.current).selectAll("svg").remove()
    }

    fetchHeatmapData(selectedPage, selectedDevice)
      .then((result) => {
        setData(result)

        if (!result.snapshot_url) {
          setError(
            "스냅샷이 없습니다. 백엔드가 생성 중입니다. 15초 후 다시 시도해 주세요."
          )
        }
        if (!result.clicks || result.clicks.length === 0) {
          setHasClickData(false)
        }
      })
      .catch((err: any) => {
        setError(err.message || "데이터를 불러오는 데 실패했습니다.")
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [selectedPage, selectedDevice])

  // --- 6. (!!! 핵심 수정 !!!) D3.js 히트맵 렌더링 로직 ---
  const handleImageLoad = (
    event: React.SyntheticEvent<HTMLImageElement, Event>
  ) => {
    if (!svgContainerRef.current || !data || !data.clicks) {
      return
    }

    const img = event.currentTarget
    const { naturalWidth, naturalHeight } = img

    // 1. 데이터 파싱: API 데이터를 숫자로 명시적 변환
    const validData: ClickPoint[] = data.clicks
      .map((pt) => ({
        x: Number(pt.x), // 'x'가 문자열일 수 있으므로 Number()로 변환
        y: Number(pt.y), // 'y'가 문자열일 수 있으므로 Number()로 변환
        value: Number(pt.value), // 'value'가 문자열일 수 있으므로 Number()로 변환
      }))
      .filter((pt) => !isNaN(pt.x) && !isNaN(pt.y) && !isNaN(pt.value)) // 유효하지 않은 데이터(NaN) 제거

    // 2. 데이터가 없으면 렌더링 중단
    if (validData.length === 0) {
      setHasClickData(false)
      return
    }

    // 3. D3를 사용해 이전에 그린 SVG가 있다면 삭제 (중복 방지)
    d3.select(svgContainerRef.current).selectAll("svg").remove()

    // 4. D3로 SVG 캔버스 생성 (이미지 크기와 동일하게)
    const svg = d3
      .select(svgContainerRef.current)
      .append("svg")
      .attr("width", naturalWidth)
      .attr("height", naturalHeight)
      .style("position", "absolute")
      .style("top", 0)
      .style("left", 0)

    // 5. 'value' (클릭 횟수)에 따른 색상 스케일 정의
    const maxClicks = d3.max(validData, (d) => d.value) || 1
    const colorScale = d3
      .scaleLinear<string>()
      .domain([1, maxClicks])
      // 6. 히트맵 색상: 투명한 파란색 -> 불투명한 빨간색
      .range(["rgba(0, 0, 255, 0.1)", "rgba(255, 0, 0, 1)"])

    // 7. (선택사항) 히트맵처럼 보이게 하는 SVG 블러(blur) 필터 정의
    const defs = svg.append("defs")
    const filter = defs.append("filter").attr("id", "heatmap-blur")
    filter
      .append("feGaussianBlur")
      .attr("in", "SourceGraphic")
      .attr("stdDeviation", 15) // 블러 반경 (조절 가능)

    // 8. 데이터 바인딩: 각 클릭 데이터를 SVG 원(circle)으로 그리기
    svg
      .selectAll("circle")
      .data(validData)
      .enter()
      .append("circle")
      .attr("cx", (d) => d.x) // x 좌표
      .attr("cy", (d) => d.y) // y 좌표
      .attr("r", 20) // 원의 반경 (조절 가능)
      .style("fill", (d) => colorScale(d.value)) // 클릭 횟수에 따라 색상 적용
      .style("filter", "url(#heatmap-blur)") // 7번에서 만든 블러 필터 적용
  }

  return (
    <>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">페이지 히트맵</CardTitle>
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
          style={{ background: "#f9f9f9" }}
        >
          {/* 로딩 및 에러 상태 표시 */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center z-20 bg-white/50">
              <Spinner className="h-8 w-8" />
            </div>
          )}
          {error && !isLoading && (
            <div className="absolute inset-0 flex items-center justify-center z-10 p-4">
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          )}
          {!hasClickData && !isLoading && !error && data?.snapshot_url && (
            <div className="absolute inset-0 flex items-center justify-center z-10 p-4">
              <Alert>
                <AlertDescription>
                  선택된 페이지의 클릭 데이터가 없습니다.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* --- 백그라운드 스냅샷 + 히트맵 오버레이 --- */}
          {data?.snapshot_url && !isLoading && (
            <div className="relative" style={{ width: "fit-content" }}>
              {/* (A) 백그라운드 스냅샷 이미지 */}
              <img
                src={`${API_BASE_URL}${data.snapshot_url}`}
                alt={`스냅샷 (${selectedPage} - ${selectedDevice})`}
                // 7. (수정) D3가 SVG를 100% 덮어쓰므로 이미지 투명도 제거
                onLoad={handleImageLoad}
              />

              {/* (B) D3가 SVG를 그릴 컨테이너 (이미지 위에 겹침) */}
              <div
                ref={svgContainerRef}
                className="absolute top-0 left-0"
              />
            </div>
          )}
        </div>
      </CardContent>
    </>
  )
}

// --- 4. 위젯 메타데이터 (등록) ---

export const widgetMeta: WidgetMeta = {
  id: "heatmap",
  name: "페이지 히트맵",
  description: "페이지별 클릭 히트맵을 스냅샷 위에 표시합니다.",
  defaultWidth: 600,
  defaultHeight: 700,
}