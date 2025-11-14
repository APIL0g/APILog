import { resolveWidgetLanguage, type WidgetLanguage } from "../i18n"

interface DeviceShareCopy {
  title: string
  previewDescription: string
  unknownLabel: (index: number) => string
}

const deviceShareCopy: Record<WidgetLanguage, DeviceShareCopy> = {
  en: {
    title: "Users by Device",
    previewDescription: "Break down sessions by device type.",
    unknownLabel: (index) => `Unknown ${index}`,
  },
  ko: {
    title: "디바이스별 사용자 수",
    previewDescription: "디바이스 유형별 세션 비중을 보여줘요.",
    unknownLabel: (index) => `알 수 없음 ${index}`,
  },
}

export function getDeviceShareCopy(language?: string): DeviceShareCopy {
  return deviceShareCopy[resolveWidgetLanguage(language)]
}
