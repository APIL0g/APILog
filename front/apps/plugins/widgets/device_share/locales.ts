import { resolveWidgetLanguage, type WidgetLanguage } from "../i18n"

interface DeviceShareCopy {
  title: string
  unknownLabel: (index: number) => string
}

const deviceShareCopy: Record<WidgetLanguage, DeviceShareCopy> = {
  en: {
    title: "Users by Device",
    unknownLabel: (index) => `Unknown ${index}`,
  },
  ko: {
    title: "디바이스별 사용자 수",
    unknownLabel: (index) => `알 수 없음 ${index}`,
  },
}

export function getDeviceShareCopy(language?: string): DeviceShareCopy {
  return deviceShareCopy[resolveWidgetLanguage(language)]
}
