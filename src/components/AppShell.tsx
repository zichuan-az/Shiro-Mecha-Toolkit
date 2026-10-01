import React, { useEffect, useState } from 'react'
import { ChevronLeft, Cpu, Info, Minus, Sparkles, Square, X } from 'lucide-react'
import { cn } from '../lib/utils'
import { useApp, isNative } from '../lib/store'
import { api } from '../lib/bridge'
import { ChevronRail, MechaEmblem, MechaIcon, type MechaName } from './ui/MechaIcons'
import pilotFull from '../assets/pilot-full.png'
import { Lamp } from './ui/Feedback'

export type PageKey =
  | 'dashboard'
  | 'accelerator'
  | 'steam'
  | 'library'
  | 'downloads'
  | 'takeover'
  | 'linkbay'
  | 'patcher'
  | 'scripts'
  | 'cleaner'
  | 'settings'
  | 'about'

const NAV: { group: string; items: { key: PageKey; icon: MechaName; label: string; index: string }[] }[] = [
  {
    group: 'nav.groupMain',
    items: [
      { key: 'dashboard', icon: 'dashboard', label: 'nav.dashboard', index: '01' },
      { key: 'accelerator', icon: 'accelerator', label: 'nav.accelerator', index: '02' },
      { key: 'library', icon: 'library', label: 'nav.library', index: '03' },
      { key: 'downloads', icon: 'downloads', label: 'nav.downloads', index: '04' }
    ]
  },
  {
    group: 'nav.groupTools',
    items: [
      { key: 'takeover', icon: 'takeover', label: 'nav.takeover', index: '05' },
      { key: 'linkbay', icon: 'linkbay', label: 'nav.linkbay', index: '06' },
      { key: 'steam', icon: 'steam', label: 'nav.steam', index: '07' },
      { key: 'patcher', icon: 'patcher', label: 'nav.patcher', index: '08' },
      { key: 'scripts', icon: 'scripts', label: 'nav.scripts', index: '09' },
      { key: 'cleaner', icon: 'cleaner', label: 'nav.cleaner', index: '10' }
    ]
  },
  {
    group: 'nav.groupAbout',
    items: [
      { key: 'settings', icon: 'settings', label: 'nav.settings', index: '11' },
      { key: 'about', icon: 'about', label: 'nav.about', index: '12' }
    ]
  }
]

export function AppShell({
  page,
  onNavigate,
  children
}: {
  page: PageKey
  onNavigate: (p: PageKey) => void
  children: React.ReactNode
}) {
  const { t, meta } = useApp()
  const [collapsed, setCollapsed] = useState(false)
  const [accelOn, setAccelOn] = useState(false)
  const [dlSpeed, setDlSpeed] = useState(0)
  const [mini, setMini] = useState(false)

  useEffect(() => {
    let alive = true
    const poll = async () => {
      try {
        const s = await api.accelStatus()
        if (alive) setAccelOn(!!s.running)
      } catch (_) {
        /* 忽略 */
      }
      try {
        const list = await api.dlList()
        if (alive) setDlSpeed(list.filter((d: any) => d.status === 'running').reduce((n: number, d: any) => n + (d.speed || 0), 0))
      } catch (_) {
        /* 忽略 */
      }
    }
    poll()
    const timer = setInterval(poll, 2500)
    const off = api.on('dl:progress', (list: any[]) => {
      setDlSpeed(list.filter((d) => d.status === 'running').reduce((n, d) => n + (d.speed || 0), 0))
    })
    return () => {
      alive = false
      clearInterval(timer)
      off && off()
    }
  }, [])

  const toggleMini = async () => {
    const next = !mini
    setMini(next)
    try {
      await api.winMini(next)
    } catch (_) {
      /* 忽略 */
    }
  }

  return (
    <div className="h-full flex flex-col bg-surface blueprint">
      {/* --------------------------- 顶部标题栏 --------------------------- */}
      <header className="drag flex-none h-[var(--topbar-h)] flex items-stretch border-b border-line bg-surface-panel relative">
        <div className="topline absolute top-0 left-0 right-0" />
        <div className="flex items-center gap-3 pl-4 pr-3 border-r border-line">
          <MechaEmblem size={24} />
          <div className="leading-none">
            <div className="display text-[0.82rem] font-bold tracking-wide text-ink">
              SHIRO<span className="text-brand">·</span>MECHA
            </div>
            <div className="tag-plain text-[0.58rem] mt-[3px]">{t('app.name')}</div>
          </div>
        </div>

        <div className="flex items-center gap-4 px-4 flex-1 min-w-0">
          <span className="flex items-center gap-2 text-[0.72rem] text-ink-2">
            <Lamp state={accelOn ? 'on' : 'off'} />
            {accelOn ? t('accel.running') : t('accel.stopped')}
          </span>
          {dlSpeed > 0 && (
            <span className="mono text-[0.7rem] text-brand-cyan">
              ↓ {(dlSpeed / 1024 / 1024).toFixed(1)} MB/s
            </span>
          )}
          {!isNative && <span className="tag-index">{t('app.demo')}</span>}
          {meta && !meta.admin && (
            <span className="hidden lg:flex items-center gap-1.5 text-[0.68rem] text-ink-3">
              <Info size={11} />
              {t('common.notAdmin')}
            </span>
          )}
        </div>

        <div className="flex items-center no-drag pr-2">
          <button
            onClick={toggleMini}
            className="px-2 h-full text-ink-3 hover:text-brand hover:bg-surface-2 transition-colors"
            title="迷你模式"
          >
            <Sparkles size={13} />
          </button>
          <button onClick={() => api.winMinimize().catch(() => {})} className="px-3 h-full text-ink-3 hover:text-ink hover:bg-surface-2 transition-colors">
            <Minus size={14} />
          </button>
          <button onClick={() => api.winMaximize().catch(() => {})} className="px-3 h-full text-ink-3 hover:text-ink hover:bg-surface-2 transition-colors">
            <Square size={11} />
          </button>
          <button onClick={() => api.winClose().catch(() => {})} className="px-3 h-full text-ink-3 hover:text-signal hover:bg-signal-soft transition-colors">
            <X size={14} />
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* --------------------------- 侧栏 --------------------------- */}
        <nav
          className={cn(
            'flex-none flex flex-col border-r border-line bg-surface-panel transition-[width] duration-300 ease-smooth',
            collapsed ? 'w-[var(--rail-collapsed)]' : 'w-[var(--rail)]'
          )}
        >
          <div className="flex-1 overflow-y-auto overflow-x-hidden py-3">
            {NAV.map((group) => (
              <div key={group.group} className="mb-3">
                {!collapsed && (
                  <div className="tag-plain px-4 mb-1.5 flex items-center gap-2">
                    {t(group.group)}
                    <span className="flex-1 h-px bg-line" />
                  </div>
                )}
                {group.items.map((item) => {
                  const active = page === item.key
                  return (
                    <button
                      key={item.key}
                      onClick={() => onNavigate(item.key)}
                      title={t(item.label)}
                      className={cn(
                        'w-full flex items-center gap-3 no-drag relative transition-colors',
                        collapsed ? 'px-0 py-2.5 justify-center' : 'px-4 py-[7px]',
                        active ? 'bg-brand-soft text-brand' : 'text-ink-2 hover:bg-surface-2 hover:text-ink'
                      )}
                    >
                      {active && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-brand" />}
                      <span className={cn('flex-none', active ? 'text-brand' : 'text-ink-3')}>
                        <MechaIcon name={item.icon} size={15} />
                      </span>
                      {!collapsed && (
                        <>
                          <span className="text-[0.8rem] font-medium flex-1 text-left truncate">{t(item.label)}</span>
                          <span className="mono text-[0.6rem] text-ink-3">{item.index}</span>
                        </>
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>

          {/* 侧栏底部：立绘 + 折叠 */}
          <div className="flex-none border-t border-line">
            {!collapsed && (
              <div className="relative overflow-hidden" style={{ height: 132 }}>
                <img
                  src={pilotFull}
                  alt=""
                  className="absolute left-1/2 -translate-x-1/2 bottom-0 h-[150px] object-contain opacity-95 pointer-events-none select-none"
                />
                <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-surface-panel to-transparent" />
                <ChevronRail className="absolute top-1 right-2 w-[110px] text-brand pointer-events-none select-none" />
                <div className="absolute top-2 left-3 tag-plain text-[0.58rem] leading-tight">
                  SHIRO
                  <br />
                  UNIT-01
                </div>
              </div>
            )}
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="w-full flex items-center justify-center gap-2 py-2 text-ink-3 hover:text-brand hover:bg-surface-2 no-drag transition-colors border-t border-line"
            >
              <ChevronLeft size={14} className={cn('transition-transform duration-300', collapsed && 'rotate-180')} />
              {!collapsed && <span className="text-[0.68rem]">{t('app.name')} v{meta?.version || '1.0.0'}</span>}
            </button>
          </div>
        </nav>

        {/* --------------------------- 主内容 --------------------------- */}
        <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>
      </div>

      {/* --------------------------- 底部状态条 --------------------------- */}
      <footer className="flex-none h-[var(--statusbar-h)] flex items-center gap-4 px-4 border-t border-line bg-surface-panel text-[0.66rem] text-ink-3">
        <span className="flex items-center gap-1.5">
          <Lamp state={accelOn ? 'on' : 'off'} />
          {accelOn ? t('accel.running') : t('accel.stopped')}
        </span>
        <span className="flex items-center gap-1.5">
          <Cpu size={11} />
          {meta?.platform || '—'} · {meta?.arch || '—'}
        </span>
        <span className="flex-1" />
        <span className="mono">{meta?.electron ? `Electron ${meta.electron}` : ''}</span>
        <span className="mono">{t('about.license')} MIT</span>
        <span className="display font-semibold text-ink-2">{t('app.name')} v{meta?.version || '1.0.0'}</span>
      </footer>
    </div>
  )
}
