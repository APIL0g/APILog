import React from 'react'
import ReactDOM from 'react-dom/client'

import App from './App'
import '@/styles/globals.css'
import { ThemeProvider } from '@/components/theme-provider'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element with id "root" not found')
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)
