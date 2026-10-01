import React, { useEffect, useState } from 'react'
import { AppProvider, useApp } from './lib/store'
import { AppShell, type PageKey } from './components/AppShell'
import { Toasts } from './components/ui/Feedback'
import ErrorBoundary from './components/ErrorBoundary'
import Dashboard from './pages/Dashboard'
import Accelerator from './pages/Accelerator'
import SteamTools from './pages/SteamTools'
import GameLibrary from './pages/GameLibrary'
import Downloads from './pages/Downloads'
import Takeover from './pages/Takeover'
import LinkBay from './pages/LinkBay'
import Patcher from './pages/Patcher'
import ScriptStudio from './pages/ScriptStudio'
import Cleaner from './pages/Cleaner'
import SettingsPage from './pages/SettingsPage'
import About from './pages/About'

const VALID: PageKey[] = [
  'dashboard',
  'accelerator',
  'steam',
  'library',
  'downloads',
  'takeover',
  'linkbay',
  'patcher',
  'scripts',
  'cleaner',
  'settings',
  'about'
]

function readHash(): PageKey | null {
  const h = (typeof window !== 'undefined' ? window.location.hash : '').replace(/^#\/?/, '')
  return VALID.includes(h as PageKey) ? (h as PageKey) : null
}

function Shell() {
  const { config, patchConfig } = useApp()
  const [page, setPage] = useState<PageKey>(() => readHash() || 'dashboard')
  const [restored, setRestored] = useState(false)

  // 恢复上次停留的页面（hash 优先）
  useEffect(() => {
    if (restored || !config) return
    const last = readHash() || ((config.ui?.lastPage || 'dashboard') as PageKey)
    if (VALID.includes(last)) setPage(last)
    setRestored(true)
  }, [config, restored])

  // 支持前进/后退与外部深链
  useEffect(() => {
    const onHash = () => {
      const next = readHash()
      if (next) setPage(next)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const navigate = (next: PageKey) => {
    setPage(next)
    if (window.location.hash !== `#${next}`) window.location.hash = next
    patchConfig({ 'ui.lastPage': next }).catch(() => {})
  }

  return (
    <AppShell page={page} onNavigate={navigate}>
      {page === 'dashboard' && <Dashboard onNavigate={navigate} />}
      {page === 'accelerator' && <Accelerator />}
      {page === 'steam' && <SteamTools />}
      {page === 'library' && <GameLibrary />}
      {page === 'downloads' && <Downloads />}
      {page === 'takeover' && <Takeover />}
      {page === 'linkbay' && <LinkBay />}
      {page === 'patcher' && <Patcher />}
      {page === 'scripts' && <ScriptStudio />}
      {page === 'cleaner' && <Cleaner />}
      {page === 'settings' && <SettingsPage />}
      {page === 'about' && <About />}
    </AppShell>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <Shell />
        <Toasts />
      </AppProvider>
    </ErrorBoundary>
  )
}
