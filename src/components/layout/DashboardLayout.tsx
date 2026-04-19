'use client'

import { useEffect, useState } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useUIStore } from '@/lib/store/ui.store'
import { findBackground, getActiveTheme } from '@/lib/backgrounds'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { backgroundId, customBackgroundUrl, customBackgroundTheme } = useUIStore()
  // Avoid hydration flicker — only apply persisted values after mount.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  let bgUrl: string | null = null
  if (mounted) {
    if (backgroundId === 'custom' && customBackgroundUrl) {
      bgUrl = customBackgroundUrl
    } else {
      const preset = findBackground(backgroundId)
      bgUrl = preset?.url ?? null
    }
  }

  // Default to 'light' on SSR / pre-mount to match the previous static-export render.
  const activeTheme = mounted
    ? getActiveTheme({ backgroundId, customBackgroundUrl, customBackgroundTheme })
    : 'light'

  const style: React.CSSProperties = bgUrl
    ? {
        backgroundImage: `url(${bgUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }
    : {}

  return (
    <div
      data-theme={activeTheme}
      // `group/theme` lets descendants opt into the chrome theme via
      // `group-data-[theme=dark]/theme:...` Tailwind variants.
      className="group/theme flex h-screen overflow-hidden bg-gray-100"
      style={style}
    >
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
