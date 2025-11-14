import { describe, expect, it } from 'vitest'

type ComponentModule = Record<string, unknown>

const uiModules = import.meta.glob<ComponentModule>('@/components/ui/*.tsx', {
  eager: true,
})

const shouldSkipModule = (path: string) =>
  path.endsWith('.test.tsx') || /\/use-[^/]+\.tsx$/i.test(path)

describe('UI Modules Smoke Coverage', () => {
  Object.entries(uiModules)
    .filter(([path]) => !shouldSkipModule(path))
    .forEach(([path, module]) => {
      it(`[Smoke] ${path} should import without crashing`, () => {
        expect(module).toBeTruthy()

        const exportedValues = Object.values(module ?? {})
        const hasRenderableExport = exportedValues.some((value) => {
          if (typeof value === 'function') return true
          if (typeof value === 'object' && value !== null) return true
          return false
        })

        expect(hasRenderableExport).toBe(true)
      })
    })
})
