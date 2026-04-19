'use client'

import { useEffect, useState } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useUIStore } from '@/lib/store/ui.store'
import { findBackground } from '@/lib/backgrounds'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { backgroundId, customBackgroundUrl } = useUIStore()
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
      className="flex h-screen overflow-hidden bg-gray-100"
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
