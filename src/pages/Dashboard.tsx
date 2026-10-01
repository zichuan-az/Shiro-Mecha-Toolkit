import React, { useEffect, useState } from 'react'
import {
  Activity,
  ArrowRight,
  Download,
  Gamepad2,
  Globe2,
  HardDrive,
  ListChecks,
  MemoryStick,
  Monitor,
  RefreshCw,
  Shield,
  Trash2,
  Zap
} from 'lucide-react'
import { api } from '../lib/bridge'
import { useApp } from '../lib/store'
import { Panel, PanelBody, PanelHead, SectionTitle } from '../components/ui/Panel'
import { Btn } from '../components/ui/Controls'
import { Badge, Empty, KV, Lamp, StatCell } from '../components/ui/Feedback'
import { formatBytes, formatDuration, formatRelative } from '../lib/utils'
import type { PageKey } from '../components/AppShell'
import pilotHero from '../assets/pilot-hero.png'

export default function Dashboard({ onNavigate }: { onNavigate: (p: PageKey) => void }) {
  const { t, lang, pushToast, patchConfig } = useApp()
  const [accel, setAccel] = useState<any>(null)
  const [hosts, setHosts] = useState<any>(null)
  const [manifest, setManifest] = useState<any>(null)
  const [downloads, setDownloads] = useState<any[]>([])
  const [sys, setSys] = useState<any>(null)
  const [busy, setBusy] = useState(false)

  const load = async () => {
    setBusy(true)
    const safe = async <T,>(fn: () => Promise<T>, fallback: T): Promise<T> => {
      try {
        return await fn()
      } catch (_) {
        return fallback
      }
    }
    const [a, h, m, d, s] = await Promise.all([
      safe(() => api.accelStatus(), null),
      safe(() => api.hostsRead(), null),
      safe(() => api.libManifest(), null),
      safe(() => api.dlList(), []),
      safe(() => api.sysInfo(), null)
    ])
    setAccel(a)
    setHosts(h)
    setManifest(m)
    setDownloads(Array.isArray(d) ? d : [])
    setSys(s)
    setBusy(false)
  }

  useEffect(() => {
    load()
    const timer = setInterval(load, 6000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleAccel = async () => {
    setBusy(true)
    try {
      const s = accel?.running ? await api.accelStop() : await api.accelStart([])
      setAccel(s)
      pushToast({ kind: 'ok', title: s.running ? t('accel.running') : t('accel.stopped') })
    } catch (err: any) {
      pushToast({ kind: 'error', title: t('common.failed'), body: String(err.message || err) })
    }
    setBusy(false)
  }

  const goPage = (p: PageKey) => {
    patchConfig({ 'ui.lastPage': p }).catch(() => {})
    onNavigate(p)
  }

  const installed = manifest?.installed?.length || 0
  const safeDownloads = Array.isArray(downloads) ? downloads : []
  const running = safeDownloads.filter((d) => d.status === 'running' || d.status === 'queued')
  const log = (accel?.logs || []).slice(0, 6)

  return (
    <div className="p-5 space-y-4 anim-in">
      {/* ----------------------------- Hero ----------------------------- */}
      <div className="grid grid-cols-12 gap-4">
        <Panel className="col-span-12 xl:col-span-8 overflow-hidden">
          <div className="relative flex items-stretch min-h-[212px]">
            <div className="flex-1 p-6 min-w-0 relative z-10">
              <div className="tag-plain mb-2">SYS / OVERVIEW</div>
              <h1
                className="display font-bold text-ink leading-tight"
                style={{ fontSize: 'var(--fs-hero)', letterSpacing: '-0.01em' }}
              >
                {t('dash.title')}
              </h1>
              <p className="text-ink-2 mt-2 max-w-md leading-relaxed" style={{ fontSize: 'var(--fs-sub)' }}>
                {t('dash.subtitle')}
              </p>

              <div className="flex flex-wrap items-center gap-2 mt-5">
                <Btn variant={accel?.running ? 'default' : 'primary'} onClick={toggleAccel} disabled={busy}>
                  <Zap size={14} />
                  {accel?.running ? t('common.stop') : t('common.start')}
                </Btn>
                <Btn onClick={() => goPage('accelerator')}>
                  {t('nav.accelerator')}
                  <ArrowRight size={13} />
                </Btn>
                <Btn variant="ghost" onClick={load} disabled={busy}>
                  <RefreshCw size={13} className={busy ? 'animate-spin' : ''} />
                  {t('common.refresh')}
                </Btn>
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-4 text-[0.72rem] text-ink-3">
                <span className="flex items-center gap-1.5">
                  <Lamp state={accel?.running ? 'on' : 'off'} />
                  {accel?.running ? t('accel.running') : t('accel.stopped')}
                </span>
                <span className="mono">{accel?.proxyAddress || '—'}</span>
                <span className="mono">
                  {t('dash.rules')} {accel?.ruleCount ?? 0}
                </span>
              </div>
            </div>

            {/* 立绘：只占右侧留白，不压文字 */}
            <div className="hidden md:block relative w-[220px] xl:w-[260px] flex-none">
              <div className="absolute inset-0 blueprint-fine opacity-60" />
              <img
                src={pilotHero}
                alt=""
                className="absolute bottom-0 right-2 h-[236px] object-contain float-soft pointer-events-none select-none"
                style={{ filter: 'drop-shadow(0 10px 24px rgba(16,54,127,0.18))' }}
              />
              <div className="absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-surface-panel to-transparent" />
            </div>
          </div>
          <div className="ruler opacity-60" />
        </Panel>

        <Panel className="col-span-12 xl:col-span-4">
          <PanelHead index="SYS" title={t('dash.sysinfo')} icon={<Monitor size={14} />} />
          <PanelBody className="pt-2">
            {sys ? (
              <div>
                <KV k="OS" v={`${sys.os.version || sys.os.platform} · ${sys.os.arch}`} />
                <KV k="CPU" v={sys.cpu.model} />
                <KV k="Cores" v={`${sys.cpu.cores} · ${(sys.cpu.speedMHz / 1000).toFixed(1)} GHz`} mono />
                <KV
                  k={t('set.download')}
                  v={
                    <span className="flex items-center gap-2">
                      <MemoryStick size={12} className="text-ink-3" />
                      {formatBytes(sys.memory.used)} / {formatBytes(sys.memory.total)}
                    </span>
                  }
                />
                <KV
                  k={t('dash.steamPath')}
                  v={
                    sys.steam?.found ? (
                      <span className="mono text-[0.72rem]">{sys.steam.root}</span>
                    ) : (
                      <span className="text-ink-3">{t('dash.notFound')}</span>
                    )
                  }
                />
                <KV
                  k={t('common.status')}
                  v={
                    sys.steam?.libraryFolders?.length ? (
                      <span className="flex items-center gap-2">
                        <Badge tone="ok">{sys.steam.libraryFolders.length} libraries</Badge>
                      </span>
                    ) : (
                      <Badge>—</Badge>
                    )
                  }
                />
              </div>
            ) : (
              <Empty title={t('common.loading')} />
            )}
          </PanelBody>
        </Panel>
      </div>

      {/* ----------------------------- 状态格 ----------------------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        <StatCell
          label={t('dash.accel')}
          value={accel?.running ? t('accel.running') : t('accel.stopped')}
          sub={accel?.running ? `${t('dash.uptime')} ${formatDuration((accel?.uptime || 0) / 1000)}` : accel?.proxyAddress}
          tone={accel?.running ? 'ok' : 'neutral'}
        />
        <StatCell
          label={t('dash.hosts')}
          value={Object.keys(hosts?.managedEntries || {}).length}
          sub={hosts?.writable ? 'writable' : t('common.notAdmin')}
          tone={Object.keys(hosts?.managedEntries || {}).length ? 'brand' : 'neutral'}
        />
        <StatCell label={t('dash.library')} value={installed} sub={`${formatBytes(manifest?.totalSize || 0)}`} />
        <StatCell
          label={t('dash.downloads')}
          value={running.length}
          sub={safeDownloads.length ? `${safeDownloads.length} total` : t("common.none")}
          tone={running.length ? 'brand' : 'neutral'}
        />
        <StatCell
          label={t('dash.traffic')}
          value={formatBytes((accel?.stats?.bytesDown || 0) + (accel?.stats?.bytesUp || 0))}
          sub={`${accel?.stats?.connections || 0} conn · ${accel?.stats?.errors || 0} err`}
        />
      </div>

      {/* ----------------------------- 动态 + 快捷 ----------------------------- */}
      <div className="grid grid-cols-12 gap-4">
        <Panel className="col-span-12 xl:col-span-7">
          <PanelHead
            index={t('nav.accelerator')}
            title={t('dash.recentLog')}
            icon={<Activity size={14} />}
            right={<Badge tone={accel?.running ? 'ok' : 'neutral'}>{accel?.running ? 'LIVE' : 'IDLE'}</Badge>}
          />
          <PanelBody pad={false}>
            {log.length ? (
              <div className="divide-y divide-line">
                {log.map((l: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-2">
                    <span className="mono text-[0.64rem] text-ink-3 flex-none pt-[2px] w-16">
                      {new Date(l.t).toTimeString().slice(0, 8)}
                    </span>
                    <Lamp state={l.level === 'error' ? 'error' : 'on'} />
                    <span className="text-[0.75rem] text-ink-2 leading-relaxed min-w-0 flex-1">{l.message}</span>
                  </div>
                ))}
              </div>
            ) : (
              <Empty icon={<Activity size={17} />} title={t('common.none')} hint={t('accel.log')} />
            )}
          </PanelBody>
        </Panel>

        <Panel className="col-span-12 xl:col-span-5">
          <PanelHead index="QUICK" title={t('dash.quick')} icon={<ListChecks size={14} />} />
          <PanelBody className="space-y-2.5">
            <SectionTitle>{t('nav.groupTools')}</SectionTitle>
            {[
              { icon: <Shield size={14} />, label: t('steam.guard'), page: 'steam' as PageKey, sub: t('steam.guardHint') },
              { icon: <Globe2 size={14} />, label: t('steam.idTitle'), page: 'steam' as PageKey, sub: t('steam.idHint') },
              { icon: <Gamepad2 size={14} />, label: t('lib.wishlist'), page: 'library' as PageKey, sub: t('lib.wishlistHint') },
              { icon: <Trash2 size={14} />, label: t('clean.title'), page: 'cleaner' as PageKey, sub: t('clean.subtitle') }
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => goPage(item.page)}
                className="w-full flex items-center gap-3 px-3 py-2 border border-line bg-surface-2 hover:bg-surface-panel hover:border-line-2 no-drag transition-colors text-left"
              >
                <span className="w-7 h-7 flex-none flex items-center justify-center bg-brand-soft text-brand border border-[rgba(30,95,209,0.2)]">
                  {item.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.8rem] text-ink font-medium truncate">{item.label}</span>
                  <span className="block text-[0.68rem] text-ink-3 truncate">{item.sub}</span>
                </span>
                <ArrowRight size={13} className="text-ink-3 flex-none" />
              </button>
            ))}
          </PanelBody>
        </Panel>
      </div>

      {/* ----------------------------- 下载概况 ----------------------------- */}
      {safeDownloads.length > 0 && (
        <Panel>
          <PanelHead
            index={t('nav.downloads')}
            title={t('dl.title')}
            icon={<Download size={14} />}
            right={
              <Btn size="sm" variant="ghost" onClick={() => goPage('downloads')}>
                {t('common.detail')}
                <ArrowRight size={12} />
              </Btn>
            }
          />
          <PanelBody pad={false}>
            {safeDownloads.slice(0, 3).map((d) => (
              <div key={d.id} className="row">
                <HardDrive size={14} className="text-ink-3 flex-none" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.78rem] text-ink truncate">{d.name}</span>
                  <span className="block text-[0.68rem] text-ink-3 mt-0.5 mono">
                    {formatBytes(d.received)} / {formatBytes(d.total)}
                  </span>
                </span>
                <Badge tone={d.status === 'done' ? 'ok' : d.status === 'running' ? 'brand' : 'neutral'}>
                  {d.status === 'done' ? t('common.done') : d.status === 'running' ? t('common.running') : d.status}
                </Badge>
                <span className="mono text-[0.72rem] text-ink-2 w-14 text-right">{d.percent?.toFixed(0)}%</span>
              </div>
            ))}
          </PanelBody>
        </Panel>
      )}

      <div className="flex items-center justify-center gap-2 pt-1 pb-2 text-[0.66rem] text-ink-3">
        <span className="w-8 h-px bg-line" />
        {t('about.subtitle')}
        <span className="w-8 h-px bg-line" />
      </div>
    </div>
  )
}
