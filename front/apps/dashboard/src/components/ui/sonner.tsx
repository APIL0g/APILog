'use client'

import type { CSSProperties } from 'react'

import { useTheme } from '@/components/theme-provider'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme()

  const styleOverrides = {
    '--normal-bg': 'var(--popover)',
    '--normal-text': 'var(--popover-foreground)',
    '--normal-border': 'var(--border)',
  } as CSSProperties

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      style={styleOverrides}
      {...props}
    />
  )
}

export { Toaster }
