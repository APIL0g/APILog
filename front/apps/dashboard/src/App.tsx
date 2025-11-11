import { useEffect, useState } from 'react'

import { initializeWidgets } from '@/core/init-widgets'
import DashboardPage from '@/pages/dashboards/[id]'
import AIReportPage from '@/pages/ai-report'

export default function App() {
  const [initialized, setInitialized] = useState(false)
  const [route, setRoute] = useState<string>(globalThis?.location?.hash || '#/')

  useEffect(() => {
    initializeWidgets()
    setInitialized(true)
    const onHash = () => setRoute(globalThis?.location?.hash || '#/')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (!initialized) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Initializing ApiLog...</p>
        </div>
      </div>
    )
  }

  if (route.startsWith('#/ai-report')) {
    return <AIReportPage />
  }
  return <DashboardPage />
}
