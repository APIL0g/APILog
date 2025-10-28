import { useEffect, useState } from 'react'

import { initializeWidgets } from '@/core/init-widgets'
import DashboardPage from '@/pages/dashboards/[id]'

export default function App() {
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    initializeWidgets()
    setInitialized(true)
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

  return <DashboardPage />
}
