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
import {
  CopyPlus,
  LayoutGrid,
  PenLine,
  Plus,
  Save,
  Trash2,
  ChevronsUpDown,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { getAiInsightsCopy } from "@plugins/widgets/ai_insights/locales"
import { getBrowserShareCopy } from "@plugins/widgets/browser_share/locales"
import { getCountryShareCopy } from "@plugins/widgets/country_share/locales"
import { getDailyCountCopy } from "@plugins/widgets/daily_count/locales"
import { getDeviceShareCopy } from "@plugins/widgets/device_share/locales"
import { getDwellTimeCopy } from "@plugins/widgets/dwell_time/locales"
import { getHeatmapCopy } from "@plugins/widgets/heatmap/locales"
import { getPageExitCopy } from "@plugins/widgets/page_exit/locales"
import { getTimeTopPagesCopy } from "@plugins/widgets/time_top_pages/locales"
import { getTopButtonsByPageCopy } from "@plugins/widgets/top_buttons_by_page_widget/locales"
import { getTopButtonsGlobalCopy } from "@plugins/widgets/top_buttons_global_widget/locales"
import { getTopPagesCopy } from "@plugins/widgets/top_pages/locales"
import { getVisitorsStatCopy } from "@plugins/widgets/visitors_stat/locales"
import tutorialGifStep1En from "@/assets/dashboard-tutorial-1_en.gif"
import tutorialGifStep2En from "@/assets/dashboard-tutorial-2_en.gif"
import tutorialGifStep3En from "@/assets/dashboard-tutorial-3_en.gif"
import tutorialGifStep1Kr from "@/assets/dashboard-tutorial-1_kr.gif"
import tutorialGifStep2Kr from "@/assets/dashboard-tutorial-2_kr.gif"
import tutorialGifStep3Kr from "@/assets/dashboard-tutorial-3_kr.gif"

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
const DASHBOARD_TUTORIAL_STORAGE_KEY = "apilog-dashboard-tutorial-seen"
const tutorialGifSourcesByLanguage = {
  en: [tutorialGifStep1En, tutorialGifStep2En, tutorialGifStep3En] as const,
  ko: [tutorialGifStep1Kr, tutorialGifStep2Kr, tutorialGifStep3Kr] as const,
}

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

type LanguageCode = "en" | "ko"

interface DashboardCopy {
  tagline: string
  emptyTitle: string
  emptySubtitle: string
  emptyCta: string
  addWidgetHint: string
  addWidgetTitle: string
  addWidgetDescription: string
  addWidgetSelectPlaceholder: string
  addWidgetConfirm: string
  addWidgetCancel: string
  addWidgetButtonAria: string
  languageLabel: string
  presetButtonPlaceholder: string
  presetMenuTitle: string
  noPresets: string
  saveChanges: string
  saveAsPreset: string
  actionsTitle: string
  renamePreset: string
  deletePreset: string
  unsavedBadge: string
  newLayout: string
  editLayout: string
  saveLayout: string
  aiReport: string
  cancelEdit: string
}

interface TutorialStepCopy {
  title: string
  description: string
  details: string
}

interface TutorialDialogCopy {
  title: string
  subtitle: string
  primaryCta: string
  imageAlt: string
  steps: TutorialStepCopy[]
}

interface EditSnapshot {
  dashboard: DashboardConfig | null
  activePresetId: string | null
  isNewPresetDraft: boolean
}

const dashboardCopy: Record<LanguageCode, DashboardCopy> = {
  en: {
    tagline: "Save and reuse layouts with presets.",
    emptyTitle: "No widgets yet",
    emptySubtitle: "Start building your custom dashboard by adding widgets that matter to you.",
    emptyCta: "Add Your First Widget",
    addWidgetHint: "Add Widget",
    addWidgetTitle: "Add Widget",
    addWidgetDescription: "Select a widget type to place on your dashboard.",
    addWidgetSelectPlaceholder: "Choose a widget...",
    addWidgetConfirm: "Add",
    addWidgetCancel: "Cancel",
    addWidgetButtonAria: "Add widget",
    languageLabel: "Language",
    presetButtonPlaceholder: "Select preset",
    presetMenuTitle: "Presets",
    noPresets: "No presets yet",
    saveChanges: "Save changes",
    saveAsPreset: "Save as preset",
    actionsTitle: "Actions",
    renamePreset: "Rename preset",
    deletePreset: "Delete preset",
    unsavedBadge: "Unsaved",
    newLayout: "New Layout",
    editLayout: "Edit Layout",
    saveLayout: "Save",
    aiReport: "AI Report",
    cancelEdit: "Cancel",
  },
  ko: {
    tagline: "프리셋으로 레이아웃을 저장하고 다시 불러올 수 있어요.",
    emptyTitle: "아직 위젯이 없어요",
    emptySubtitle: "필요한 위젯을 추가하면서 나만의 대시보드를 만들어 보세요.",
    emptyCta: "첫 번째 위젯 추가하기",
    addWidgetHint: "위젯 추가",
    addWidgetTitle: "위젯 추가",
    addWidgetDescription: "대시보드에 추가할 위젯 종류를 선택하세요.",
    addWidgetSelectPlaceholder: "위젯을 선택하세요...",
    addWidgetConfirm: "추가",
    addWidgetCancel: "취소",
    addWidgetButtonAria: "위젯 추가",
    languageLabel: "언어",
    presetButtonPlaceholder: "프리셋 선택",
    presetMenuTitle: "프리셋",
    noPresets: "아직 프리셋이 없어요",
    saveChanges: "변경사항 저장",
    saveAsPreset: "프리셋으로 저장",
    actionsTitle: "작업",
    renamePreset: "프리셋 이름 변경",
    deletePreset: "프리셋 삭제",
    unsavedBadge: "미저장",
    newLayout: "새 레이아웃",
    editLayout: "레이아웃 편집",
    saveLayout: "저장",
    aiReport: "AI 리포트",
    cancelEdit: "취소",
  },
}

const tutorialDialogCopy: Record<LanguageCode, TutorialDialogCopy> = {
  en: {
    title: "First-time Tutorial",
    subtitle: "Follow these three quick steps whenever you start a dashboard layout.",
    primaryCta: "Start building",
    imageAlt: "Animated preview for arranging widgets on the dashboard",
    steps: [
      {
        title: "Create a new layout & pick widgets",
        description: "Begin with a fresh layout, then select the widgets that matter to your team.",
        details: "Use the New Layout button or choose an existing preset as a base. Press “Add Widget” to drop analytics cards you want to monitor first.",
      },
      {
        title: "Arrange and resize widgets",
        description: "Drag cards to the right spot and use resize handles to fine-tune their dimensions.",
        details: "Use the drag handle to reposition cards and resize handles to adjust the grid footprint. Tweak until KPIs feel balanced and scannable.",
      },
      {
        title: "Save, edit, or delete layouts",
        description: "Turn the layout into a preset, revisit it later, or clean it up when it is no longer needed.",
        details: "Give the layout a clear name, then save. You can reopen it to edit, duplicate promising variations, or delete presets you don’t need.",
      },
    ],
  },
  ko: {
    title: "대시보드 튜토리얼",
    subtitle: "처음 진입 시 아래 3단계만 따라 하면 레이아웃을 금방 완성할 수 있어요.",
    primaryCta: "대시보드 시작하기",
    imageAlt: "위젯 배치 과정을 담은 더미 튜토리얼 GIF",
    steps: [
      {
        title: "새 레이아웃 만들고 위젯 선택",
        description: "새 레이아웃을 만든 뒤 필요한 위젯을 골라 배치 준비를 마치세요.",
        details: "“새 레이아웃” 버튼을 누르거나 기존 프리셋을 복제한 뒤, 추가 버튼으로 가장 중요한 위젯부터 채워 넣어 보세요.",
      },
      {
        title: "위젯 배치와 크기 조절",
        description: "드래그와 리사이즈 핸들로 위젯 위치와 크기를 자유롭게 조정하세요.",
        details: "카드 상단을 잡아 옮기고 모서리 핸들로 크기를 바꾸면 열·행 단위로 딱 맞게 정렬됩니다. 한눈에 읽기 좋게 간격을 맞춰 주세요.",
      },
      {
        title: "레이아웃 저장 · 편집 · 삭제",
        description: "만족스러운 구성이면 저장해두고, 필요할 때 다시 편집하거나 삭제할 수 있습니다.",
        details: "레이아웃 이름을 붙여 저장한 뒤, 나중에 다시 열어 수정하거나 복제·삭제할 수 있어요. 팀별 프리셋을 만들어 두면 더 편리합니다.",
      },
    ],
  },
}

const widgetTitleProviders: Record<string, (language: LanguageCode) => string> = {
  ai_insights: (language) => getAiInsightsCopy(language).title,
  browser_share: (language) => getBrowserShareCopy(language).title,
  country_share: (language) => getCountryShareCopy(language).title,
  daily_count: (language) => getDailyCountCopy(language).title,
  device_share: (language) => getDeviceShareCopy(language).title,
  "dwell-time": (language) => getDwellTimeCopy(language).title,
  heatmap: (language) => getHeatmapCopy(language).title,
  page_exit: (language) => getPageExitCopy(language).title,
  time_top_pages: (language) => getTimeTopPagesCopy(language).title,
  "top-buttons-by-page-widget": (language) => getTopButtonsByPageCopy(language).title,
  "top-buttons-global-widget": (language) => getTopButtonsGlobalCopy(language).title,
  top_pages: (language) => getTopPagesCopy(language).title,
  visitor_stat: (language) => getVisitorsStatCopy(language).title,
}

const localizedWidgetNames: Record<LanguageCode, Record<string, string>> = {
  en: {},
  ko: {},
}

Object.entries(widgetTitleProviders).forEach(([widgetId, getTitle]) => {
  localizedWidgetNames.en[widgetId] = getTitle("en")
  localizedWidgetNames.ko[widgetId] = getTitle("ko")
})

const LANGUAGE_STORAGE_KEY = "dashboard-language"

function isKoreanLocale(locale: string | null | undefined) {
  if (!locale) return false
  const normalized = locale.toLowerCase()
  return normalized.startsWith("ko") || normalized.endsWith("-kr") || normalized.includes("kr")
}

function detectPreferredLanguage(): LanguageCode {
  if (typeof navigator === "undefined") {
    return "en"
  }

  const locales: string[] = []

  if (Array.isArray(navigator.languages)) {
    locales.push(...navigator.languages)
  }

  if (navigator.language) {
    locales.push(navigator.language)
  }

  if (typeof Intl !== "undefined" && typeof Intl.DateTimeFormat === "function") {
    try {
      const intlLocale = new Intl.DateTimeFormat().resolvedOptions().locale
      if (intlLocale) {
        locales.push(intlLocale)
      }
    } catch {
      // Ignore Intl errors and fall back to navigator data
    }
  }

  return locales.some((locale) => isKoreanLocale(locale)) ? "ko" : "en"
}

function readStoredLanguage(): LanguageCode | null {
  if (typeof window === "undefined") {
    return null
  }

  const stored = window.localStorage?.getItem(LANGUAGE_STORAGE_KEY)
  return stored === "ko" || stored === "en" ? stored : null
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
  const [language, setLanguage] = useState<LanguageCode>("en")
  const [editSnapshot, setEditSnapshot] = useState<EditSnapshot | null>(null)
  const [isTutorialOpen, setIsTutorialOpen] = useState(false)
  const [activeTutorialIndex, setActiveTutorialIndex] = useState(0)

  const captureEditSnapshot = () => {
    setEditSnapshot({
      dashboard: dashboard ? cloneDashboardConfig(dashboard) : null,
      activePresetId,
      isNewPresetDraft,
    })
  }

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
  const copy = dashboardCopy[language]
  const tutorialContent = tutorialDialogCopy[language]
  const tutorialGifSources = tutorialGifSourcesByLanguage[language] ?? tutorialGifSourcesByLanguage.en
  const tutorialSlides = useMemo(
    () =>
      tutorialContent.steps.map((step, index) => ({
        ...step,
        gif: tutorialGifSources[index % tutorialGifSources.length],
      })),
    [tutorialContent, tutorialGifSources],
  )
  const activeTutorialSlide = tutorialSlides[activeTutorialIndex] ?? tutorialSlides[0]
  const activeTutorialImage = activeTutorialSlide?.gif ?? tutorialGifSources[0]
  const totalTutorialSlides = tutorialSlides.length
  const presetButtonLabel = activePreset?.name ?? dashboard?.name ?? copy.presetButtonPlaceholder

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

  useEffect(() => {
    const storedLanguage = readStoredLanguage()
    if (storedLanguage) {
      setLanguage(storedLanguage)
      return
    }
    setLanguage(detectPreferredLanguage())
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage?.setItem(LANGUAGE_STORAGE_KEY, language)
  }, [language])

  useEffect(() => {
    if (typeof window === "undefined") return
    const hasSeenTutorial = window.localStorage?.getItem(DASHBOARD_TUTORIAL_STORAGE_KEY)
    if (!hasSeenTutorial) {
      setIsTutorialOpen(true)
    }
  }, [])

  useEffect(() => {
    if (totalTutorialSlides === 0) return
    if (activeTutorialIndex >= totalTutorialSlides) {
      setActiveTutorialIndex(0)
    }
  }, [activeTutorialIndex, totalTutorialSlides])

  const dismissTutorial = () => {
    if (typeof window !== "undefined") {
      window.localStorage?.setItem(DASHBOARD_TUTORIAL_STORAGE_KEY, "1")
    }
    setIsTutorialOpen(false)
  }

  const handleTutorialStepClick = (index: number) => {
    if (index < 0 || index >= totalTutorialSlides) return
    setActiveTutorialIndex(index)
  }

  const goToPreviousTutorialSlide = () => {
    if (totalTutorialSlides === 0) return
    setActiveTutorialIndex((prev) => (prev - 1 + totalTutorialSlides) % totalTutorialSlides)
  }

  const goToNextTutorialSlide = () => {
    if (totalTutorialSlides === 0) return
    setActiveTutorialIndex((prev) => (prev + 1) % totalTutorialSlides)
  }

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

    captureEditSnapshot()

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
      captureEditSnapshot()
      setIsEditMode(true)
      setFinishPresetName(dashboard.name)
      return
    }

    setFinishPresetName(dashboard.name)
    setIsFinishPresetDialogOpen(true)
  }

  const handleCancelEditing = () => {
    if (editSnapshot) {
      setDashboard(editSnapshot.dashboard ? cloneDashboardConfig(editSnapshot.dashboard) : null)
      setActivePresetId(editSnapshot.activePresetId ?? null)
      setIsNewPresetDraft(editSnapshot.isNewPresetDraft)
      setFinishPresetName(editSnapshot.dashboard?.name ?? "")
    }

    setHasUnsavedChanges(false)
    setIsEditMode(false)
    setIsFinishPresetDialogOpen(false)
    setEditSnapshot(null)
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
    setEditSnapshot(null)
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
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
              <div className="flex items-center gap-4">
                <img src="/dashboard-logo.png" alt="ApiLog" className="h-8" />
                <div className="h-6 w-px bg-border" />
                <div>
                  <h1 className="text-xl font-semibold text-foreground">{dashboard.name}</h1>
                  <p className="text-sm text-muted-foreground">{copy.tagline}</p>
                </div>
              </div>
              <Button
                size="lg"
                className="w-full sm:w-auto font-semibold shadow-sm"
                onClick={() => (globalThis.location.hash = "#/ai-report")}
                aria-label={copy.aiReport}
              >
                {copy.aiReport}
              </Button>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="min-w-[220px] justify-between">
                    <span className="truncate">{presetButtonLabel}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64">
                  <DropdownMenuLabel>{copy.presetMenuTitle}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {presets.length === 0 ? (
                    <DropdownMenuItem disabled>{copy.noPresets}</DropdownMenuItem>
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
                      {copy.saveChanges}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onSelect={() => openSaveAsDialog()} disabled={!dashboard}>
                    <CopyPlus className="mr-2 h-4 w-4" />
                    {copy.saveAsPreset}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>{copy.actionsTitle}</DropdownMenuLabel>
                  <DropdownMenuItem onSelect={() => openRenameDialog()} disabled={!activePresetId}>
                    <PenLine className="mr-2 h-4 w-4" />
                    {copy.renamePreset}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    disabled={presets.length <= 1}
                    onSelect={() => setIsDeleteDialogOpen(true)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {copy.deletePreset}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {hasUnsavedChanges && (
                <Badge variant="secondary" className="uppercase tracking-wide">
                  {copy.unsavedBadge}
                </Badge>
              )}

              {!isEditMode && !isNewPresetDraft && (
                <Button variant="outline" size="sm" onClick={handleStartNewLayout}>
                  <Plus className="h-4 w-4 mr-2" />
                  {copy.newLayout}
                </Button>
              )}

              {isEditMode && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelEditing}
                  className="text-destructive hover:text-destructive focus:text-destructive"
                >
                  <X className="h-4 w-4 mr-2" />
                  {copy.cancelEdit}
                </Button>
              )}

              <Button variant={isEditMode ? "default" : "outline"} size="sm" onClick={handleToggleEditMode}>
                <LayoutGrid className="h-4 w-4 mr-2" />
                {isEditMode ? copy.saveLayout : copy.editLayout}
              </Button>

              <div className="flex items-center gap-2 pl-3 border-l border-border">
                <Select value={language} onValueChange={(value) => (value === "ko" || value === "en" ? setLanguage(value) : null)}>
                  <SelectTrigger className="w-[140px]" aria-label={copy.languageLabel}>
                    <SelectValue placeholder={copy.languageLabel} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="ko">한국어</SelectItem>
                  </SelectContent>
                </Select>
                <ThemeToggle />
              </div>
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
                  language={language}
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
              <h2 className="text-2xl font-semibold mb-2">{copy.emptyTitle}</h2>
              <p className="text-muted-foreground mb-6">{copy.emptySubtitle}</p>
              <Button onClick={() => setIsEditMode(true)} size="lg">
                <Plus className="h-5 w-5 mr-2" />
                {copy.emptyCta}
              </Button>
            </div>
          </div>
        )}
      </main>

      {isEditMode && (
        <>
          <div className="fixed bottom-6 right-6 z-40 flex items-center gap-3">
            <span className="rounded-full bg-background/90 px-4 py-2 text-sm font-medium text-foreground shadow-lg shadow-primary/20">
              {copy.addWidgetHint}
            </span>
            <Button
              size="icon"
              className="h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:bg-primary/90"
              onClick={() => setIsAddingWidget(true)}
              aria-label={copy.addWidgetButtonAria}
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
                <DialogTitle>{copy.addWidgetTitle}</DialogTitle>
                <DialogDescription>{copy.addWidgetDescription}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Select value={selectedWidgetType} onValueChange={setSelectedWidgetType}>
                  <SelectTrigger>
                    <SelectValue placeholder={copy.addWidgetSelectPlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedAvailableWidgets.map((meta) => (
                      <SelectItem key={meta.id} value={meta.id}>
                        {localizedWidgetNames[language]?.[meta.id] ?? meta.name ?? meta.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button onClick={handleAddWidget} disabled={!selectedWidgetType} className="flex-1">
                    {copy.addWidgetConfirm}
                  </Button>
                  <Button
                    onClick={() => {
                      setIsAddingWidget(false)
                      setSelectedWidgetType("")
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    {copy.addWidgetCancel}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}

      <Dialog
        open={isTutorialOpen}
        onOpenChange={(open) => {
          if (!open) {
            dismissTutorial()
          }
        }}
      >
        <DialogContent className="flex w-[min(90vw,1200px)] max-h-[90vh] max-w-none flex-col overflow-hidden sm:max-w-none">
          <DialogHeader>
            <DialogTitle>{tutorialContent.title}</DialogTitle>
            <DialogDescription>{tutorialContent.subtitle}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-1 flex-col gap-6 overflow-hidden">
            <div className="flex-1 rounded-xl border bg-muted/20 p-4">
              <div className="mb-4 flex flex-wrap items-center justify-center gap-3">
                {tutorialSlides.map((step, index) => {
                  const isActive = index === activeTutorialIndex
                  return (
                    <button
                      key={`${step.title}-${index}`}
                      type="button"
                      className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
                        isActive
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border/70 bg-background text-muted-foreground hover:border-primary/40"
                      }`}
                      onClick={() => handleTutorialStepClick(index)}
                    >
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-base font-semibold ${
                          isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {index + 1}
                      </span>
                      <span className="hidden text-left sm:block">{step.title}</span>
                    </button>
                  )
                })}
              </div>
              <div className="relative flex h-full min-h-[55vh] items-center justify-center rounded-lg bg-background shadow-lg">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={goToPreviousTutorialSlide}
                  disabled={totalTutorialSlides === 0}
                  aria-label="Previous tutorial preview"
                  className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-background/80 shadow-lg backdrop-blur"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <img
                  src={activeTutorialImage}
                  alt={`${tutorialContent.imageAlt} - ${activeTutorialSlide?.title ?? ""}`}
                  className="max-h-full max-w-full object-contain"
                  style={{ aspectRatio: "16 / 9" }}
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={goToNextTutorialSlide}
                  disabled={totalTutorialSlides === 0}
                  aria-label="Next tutorial preview"
                  className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-background/80 shadow-lg backdrop-blur"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-background/90 p-5 shadow-inner">
              <div>
                <p className="text-base font-semibold text-foreground flex items-center gap-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-primary bg-background text-lg text-primary">
                    {activeTutorialIndex + 1}
                  </span>
                  {activeTutorialSlide?.title}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{activeTutorialSlide?.description}</p>
                {activeTutorialSlide?.details && (
                  <p className="mt-2 text-sm text-muted-foreground opacity-90">{activeTutorialSlide.details}</p>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <span className="text-sm text-muted-foreground">
                  {totalTutorialSlides > 0 ? `${activeTutorialIndex + 1} / ${totalTutorialSlides}` : null}
                </span>
                <Button variant="default" onClick={dismissTutorial} className="whitespace-nowrap">
                  {tutorialContent.primaryCta}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
