import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Activity,
  Copy,
  Gauge,
  Globe,
  History,
  Link2,
  Play,
  RotateCcw,
  Save,
  Square,
  Terminal,
  Zap
} from 'lucide-react'
import { api } from '../lib/bridge'
import { useApp } from '../lib/store'
import { Panel, PanelBody, PanelHead, SectionTitle } from '../components/ui/Panel'
import { Btn, Check, Switch, Textarea } from '../components/ui/Controls'
import { Badge, ConfirmBar, Empty, KV, Lamp, Progress, StatCell, type Tone } from '../components/ui/Feedback'
import { cn, formatBytes, formatDuration } from '../lib/utils'

export default function Accelerator() {
  const { t, lang, pushToast, config, patchConfig } = useApp()
  const [status, setStatus] = useState<any>(null)
  const [rules, setRules] = useState<any>(null)
  const [active, setActive] = useState<string[]>([])
  const [custom, setCustom] = useState('')
  const [probe, setProbe] = useState<any[]>([])
  const [probing, setProbing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [hosts, setHosts] = useState<any>(null)
  const [hostsPreview, setHostsPreview] = useState<any>(null)
  const [hostBusy, setHostBusy] = useState(false)
  const [confirmHosts, setConfirmHosts] = useState(false)
  const [confirmRestore, setConfirmRestore] = useState(false)
  const [restoreList, setRestoreList] = useState<any[]>([])
  const logRef = useRef<HTMLDivElement>(null)

  const loadStatus = async () => {
    try {
      setStatus(await api.accelStatus())
    } catch (_) {
      /* 忽略 */
    }
  }

  useEffect(() => {
    ;(async () => {
      try {
        const r = await api.accelRules()
        setRules(r)
        setActive(r.activeGroups || [])
        setCustom(
          (r.custom || [])
            .filter((c: any) => c.enabled !== false)
            .map((c: any) => c.host)
            .join('\n')
        )
      } catch (_) {
        /* 忽略 */
      }
      try {
        setHosts(await api.hostsRead())
      } catch (_) {
        /* 忽略 */
      }
      try {
        setRestoreList(await api.hostsBackups())
      } catch (_) {
        /* 忽略 */
      }
      loadStatus()
    })()

    const timer = setInterval(loadStatus, 2000)
    const off = api.on('accel:log', (entry: any) => {
      setStatus((s: any) => (s ? { ...s, logs: [entry, ...(s.logs || [])].slice(0, 40) } : s))
    })
    return () => {
      clearInterval(timer)
      off && off()
    }
  }, [])

  const toggle = async () => {
    setBusy(true)
    try {
      const s = status?.running ? await api.accelStop() : await api.accelStart(active)
      setStatus(s)
      pushToast({ kind: 'ok', title: s.running ? t('accel.running') : t('accel.stopped') })
    } catch (err: any) {
      pushToast({ kind: 'error', title: t('common.failed'), body: String(err.message || err) })
    }
    setBusy(false)
  }

  const toggleGroup = async (id: string) => {
    const next = active.includes(id) ? active.filter((x) => x !== id) : [...active, id]
    setActive(next)
    try {
      const r = await api.accelSaveRules({ activeGroups: next })
      setRules(r)
      if (status?.running) {
        // 运行中热更新：重启服务以套用新名单
        await api.accelStop()
        await api.accelStart(next)
        loadStatus()
      }
    } catch (err: any) {
      pushToast({ kind: 'error', title: t('common.failed'), body: String(err.message || err) })
    }
  }

  const saveCustom = async () => {
    const lines = custom
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((host) => ({ host, enabled: true }))
    try {
      const r = await api.accelSaveRules({ custom: lines })
      setRules(r)
      pushToast({ kind: 'ok', title: t('common.saved') })
      if (status?.running) {
        await api.accelStop()
        await api.accelStart(active)
        loadStatus()
      }
    } catch (err: any) {
      pushToast({ kind: 'error', title: t('common.failed'), body: String(err.message || err) })
    }
  }

  const runProbe = async () => {
    setProbing(true)
    try {
      setProbe(await api.accelProbe())
    } catch (err: any) {
      pushToast({ kind: 'error', title: t('common.failed'), body: String(err.message || err) })
    }
    setProbing(false)
  }

  const previewHosts = async () => {
    setHostBusy(true)
    try {
      setHostsPreview(await api.hostsPreview(active))
      setConfirmHosts(true)
    } catch (err: any) {
      pushToast({ kind: 'error', title: t('common.failed'), body: String(err.message || err) })
    }
    setHostBusy(false)
  }

  const applyHosts = async () => {
    setHostBusy(true)
    try {
      const r = await api.hostsApply(active)
      pushToast({ kind: 'ok', title: t('common.saved'), body: `${r.count} records → ${r.path}` })
      setHosts(await api.hostsRead())
      setRestoreList(await api.hostsBackups())
    } catch (err: any) {
      pushToast({ kind: 'error', title: t('common.failed'), body: String(err.message || err) })
    }
    setConfirmHosts(false)
    setHostBusy(false)
  }

  const restoreHosts = async (id?: string) => {
    setHostBusy(true)
    try {
      await api.hostsRestore(id)
      pushToast({ kind: 'ok', title: t('common.done') })
      setHosts(await api.hostsRead())
      setRestoreList(await api.hostsBackups())
    } catch (err: any) {
      pushToast({ kind: 'error', title: t('common.failed'), body: String(err.message || err) })
    }
    setConfirmRestore(false)
    setHostBusy(false)
  }

  const copy = async (text: string) => {
    try {
      await api.copy(text)
      pushToast({ kind: 'ok', title: t('common.copied'), body: text })
    } catch (_) {
      /* 忽略 */
    }
  }

  const totalBytes = (status?.stats?.bytesDown || 0) + (status?.stats?.bytesUp || 0)
  const gradeTone = (grade: string): Tone =>
    grade === 'excellent' ? 'ok' : grade === 'good' ? 'brand' : grade === 'fair' ? 'warn' : 'danger'

  const customCount = useMemo(() => custom.split('\n').filter((l) => l.trim()).length, [custom])

  return (
    <div className="p-5 space-y-4 anim-in">
      {/* ------------------------- 主控条 ------------------------- */}
      <Panel>
        <div className="flex flex-wrap items-center gap-5 p-5">
          <div className="flex items-center gap-4 min-w-0">
            <div
              className={cn(
                'w-14 h-14 flex-none flex items-center justify-center border relative scanline',
                status?.running ? 'bg-brand text-white border-brand' : 'bg-surface-2 text-ink-3 border-line-2'
              )}
            >
              <Zap size={24} />
            </div>
            <div className="min-w-0">
              <div className="tag-plain mb-1">MODULE 02 / ACCELERATOR</div>
              <h2 className="display font-bold text-ink" style={{ fontSize: 'var(--fs-display)' }}>
                {t('accel.title')}
              </h2>
              <p className="text-[0.75rem] text-ink-3 mt-1">{t('accel.subtitle')}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Badge tone={status?.running ? 'ok' : 'neutral'}>
              <Lamp state={status?.running ? 'on' : 'off'} />
              {status?.running ? t('accel.running') : t('accel.stopped')}
            </Badge>
            <Badge>{status?.ruleCount ?? 0} rules</Badge>
            <Btn variant={status?.running ? 'default' : 'primary'} onClick={toggle} disabled={busy}>
              {status?.running ? <Square size={12} /> : <Play size={12} />}
              {status?.running ? t('common.stop') : t('common.start')}
            </Btn>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 border-t border-line divide-x divide-line">
          {[
            { label: t('accel.proxyAddr'), value: status?.proxyAddress || '—', copyable: true },
            { label: t('accel.pacUrl'), value: status?.pacUrl || '—', copyable: true },
            { label: t('dash.uptime'), value: status?.running ? formatDuration((status.uptime || 0) / 1000) : '—' },
            { label: t('dash.traffic'), value: formatBytes(totalBytes) }
          ].map((cell: any) => (
            <div key={cell.label} className="px-4 py-3 min-w-0">
              <div className="stat-label mb-1">{cell.label}</div>
              <div className="flex items-center gap-2">
                <span className="mono text-[0.78rem] text-ink truncate">{cell.value}</span>
                {cell.copyable && cell.value !== '—' && (
                  <button onClick={() => copy(cell.value)} className="text-ink-3 hover:text-brand flex-none no-drag">
                    <Copy size={12} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid grid-cols-12 gap-4">
        {/* ------------------------- 加速名单 ------------------------- */}
        <Panel className="col-span-12 xl:col-span-6">
          <PanelHead
            index="02-A"
            title={t('accel.ruleGroups')}
            hint={t('accel.ruleGroupsHint')}
            icon={<Globe size={14} />}
            right={<Badge tone="brand">{active.length} / {rules?.groups?.length || 0}</Badge>}
          />
          <PanelBody pad={false}>
            <div className="divide-y divide-line max-h-[330px] overflow-y-auto">
              {(rules?.groups || []).map((g: any) => {
                const on = active.includes(g.id)
                return (
                  <label
                    key={g.id}
                    className={cn('flex items-start gap-3 px-4 py-2.5 cursor-pointer transition-colors', on ? 'bg-brand-soft/40' : 'hover:bg-surface-2')}
                  >
                    <span className="pt-[2px]">
                      <Check checked={on} onChange={() => toggleGroup(g.id)} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.8rem] font-medium text-ink truncate">
                        {lang === 'en' ? g.nameEn || g.name : g.name}
                      </span>
                      <span className="block text-[0.68rem] text-ink-3 truncate">{g.desc}</span>
                    </span>
                    <span className="mono text-[0.66rem] text-ink-3 flex-none">{g.domains?.length || 0}</span>
                  </label>
                )
              })}
            </div>

            <div className="p-4 border-t border-line">
              <SectionTitle>{t('accel.custom')}</SectionTitle>
              <Textarea
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                rows={3}
                spellCheck={false}
                placeholder={'example.com\n.cdn-example.net'}
                className="field-mono text-[0.72rem]"
              />
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[0.68rem] text-ink-3 flex-1">{t('accel.customHint')}</span>
                <Badge>{customCount}</Badge>
                <Btn size="sm" onClick={saveCustom}>
                  <Save size={12} />
                  {t('accel.customSave')}
                </Btn>
              </div>
            </div>
          </PanelBody>
        </Panel>

        {/* ------------------------- 统计 + 测速 ------------------------- */}
        <div className="col-span-12 xl:col-span-6 space-y-4">
          <Panel>
            <PanelHead index="02-B" title={t('accel.stats')} icon={<Activity size={14} />} />
            <PanelBody>
              <div className="grid grid-cols-3 gap-2.5">
                <StatCell label={t('accel.connections')} value={status?.stats?.connections ?? 0} />
                <StatCell label={t('accel.tunnelled')} value={status?.stats?.tunnelled ?? 0} tone="ok" />
                <StatCell label={t('accel.errors')} value={status?.stats?.errors ?? 0} tone={(status?.stats?.errors || 0) > 0 ? 'warn' : 'neutral'} />
              </div>
              <div className="grid grid-cols-2 gap-2.5 mt-2.5">
                <div className="panel-flat px-3 py-2 flex items-center gap-2">
                  <ArrowDownToLine size={14} className="text-brand" />
                  <span className="text-[0.7rem] text-ink-3">{t('accel.down')}</span>
                  <span className="mono text-[0.78rem] ml-auto">{formatBytes(status?.stats?.bytesDown || 0)}</span>
                </div>
                <div className="panel-flat px-3 py-2 flex items-center gap-2">
                  <ArrowUpFromLine size={14} className="text-brand-cyan" />
                  <span className="text-[0.7rem] text-ink-3">{t('accel.up')}</span>
                  <span className="mono text-[0.78rem] ml-auto">{formatBytes(status?.stats?.bytesUp || 0)}</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-line">
                <Switch
                  checked={!!config?.accelerator?.autoSetSystemProxy}
                  onChange={async (v) => {
                    await patchConfig({ 'accelerator.autoSetSystemProxy': v })
                    if (status?.running) {
                      try {
                        await api.accelStop()
                        await api.accelStart(active)
                        loadStatus()
                      } catch (_) {
                        /* 忽略 */
                      }
                    }
                  }}
                  label={t('accel.systemProxy')}
                  hint={t('accel.systemProxyHint')}
                />
              </div>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHead
              index="02-C"
              title={t('accel.probe')}
              hint={t('accel.probeHint')}
              icon={<Gauge size={14} />}
              right={
                <Btn size="sm" onClick={runProbe} disabled={probing}>
                  {probing ? <RotateCcw size={12} className="animate-spin" /> : <Play size={12} />}
                  {t('accel.probeRun')}
                </Btn>
              }
            />
            <PanelBody pad={false}>
              {probe.length ? (
                <div className="divide-y divide-line max-h-[220px] overflow-y-auto">
                  {probe.map((p) => (
                    <div key={p.host} className="row row-hover">
                      <span className="min-w-0 flex-1">
                        <span className="block mono text-[0.74rem] text-ink truncate">{p.host}</span>
                        {p.ip && <span className="block mono text-[0.66rem] text-ink-3">{p.ip}</span>}
                      </span>
                      <span className="mono text-[0.78rem] text-ink-2 w-16 text-right">{p.ms === null ? '—' : `${p.ms} ms`}</span>
                      <Badge tone={gradeTone(p.grade)}>{p.grade}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty icon={<Gauge size={17} />} title={t('common.none')} hint={t('accel.probeHint')} />
              )}
            </PanelBody>
          </Panel>
        </div>

        {/* ------------------------- hosts ------------------------- */}
        <Panel className="col-span-12">
          <PanelHead
            index="02-D"
            title={t('accel.hostsTitle')}
            hint={t('accel.hostsHint')}
            icon={<Link2 size={14} />}
            right={
              <div className="flex items-center gap-2">
                <Badge tone={hosts?.writable ? 'ok' : 'warn'}>
                  {hosts?.writable ? 'writable' : t('common.notAdmin')}
                </Badge>
                <Btn size="sm" onClick={previewHosts} disabled={hostBusy || !active.length}>
                  <Zap size={12} />
                  {t('common.applyHosts')}
                </Btn>
                <Btn size="sm" variant="ghost" onClick={() => setConfirmRestore(true)} disabled={hostBusy || !restoreList.length}>
                  <History size={12} />
                  {t('common.retry')}
                </Btn>
              </div>
            }
          />
          <PanelBody>
            {!hosts?.writable && (
              <div className="flex items-start gap-2.5 px-3 py-2 mb-3 hatch border border-[rgba(228,71,77,0.3)] rounded-sm">
                <span className="text-signal flex-none mt-[1px]">
                  <Activity size={13} />
                </span>
                <span className="text-[0.74rem] text-ink-2 leading-relaxed">{t('accel.hostsNeedAdmin')}</span>
              </div>
            )}

            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12 lg:col-span-7">
                <SectionTitle>hosts</SectionTitle>
                <KV k={t('common.path')} v={<span className="mono text-[0.72rem]">{hosts?.path || '—'}</span>} />
                <KV
                  k="managed"
                  v={
                    <span className="mono text-[0.72rem]">
                      {Object.keys(hosts?.managedEntries || {}).length} records
                    </span>
                  }
                />
                <KV
                  k="backups"
                  v={<span className="mono text-[0.72rem]">{restoreList.length}</span>}
                />
                {confirmHosts && hostsPreview && (
                  <div className="mt-3">
                    <ConfirmBar
                      text={`${hostsPreview.count} records → ${hostsPreview.path}`}
                      confirmText={t('common.confirm')}
                      cancelText={t('common.cancel')}
                      onConfirm={applyHosts}
                      onCancel={() => setConfirmHosts(false)}
                    />
                  </div>
                )}
                {confirmRestore && (
                  <div className="mt-3">
                    <ConfirmBar
                      text={restoreList[0] ? `← ${restoreList[0].file}` : t('common.none')}
                      confirmText={t('common.confirm')}
                      cancelText={t('common.cancel')}
                      tone="danger"
                      onConfirm={() => restoreHosts(restoreList[0]?.id)}
                      onCancel={() => setConfirmRestore(false)}
                    />
                  </div>
                )}
              </div>

              <div className="col-span-12 lg:col-span-5">
                <SectionTitle>{t('common.detail')}</SectionTitle>
                <div className="max-h-[140px] overflow-y-auto panel-flat p-3 code text-[0.68rem]">
                  {hostsPreview?.details?.length
                    ? hostsPreview.details.map((d: any) => (
                        <div key={d.host} className="whitespace-nowrap">
                          {d.ok ? `${d.ip}\t${d.host}` : `# fail\t${d.host}`}
                        </div>
                      ))
                    : Object.entries(hosts?.managedEntries || {}).map(([h, ip]) => (
                        <div key={h} className="whitespace-nowrap">
                          {String(ip)}
                          {'\t'}
                          {h}
                        </div>
                      ))}
                </div>
              </div>
            </div>
          </PanelBody>
        </Panel>

        {/* ------------------------- 日志 ------------------------- */}
        <Panel className="col-span-12">
          <PanelHead
            index="02-E"
            title={t('accel.log')}
            icon={<Terminal size={14} />}
            right={<Btn size="sm" variant="ghost" onClick={() => setStatus((s: any) => ({ ...s, logs: [] }))}>{t('common.clear')}</Btn>}
          />
          <PanelBody pad={false}>
            <div ref={logRef} className="max-h-[200px] overflow-y-auto code rounded-none border-0">
              {status?.logs?.length ? (
                status.logs.map((l: any, i: number) => (
                  <div key={i} className={cn('whitespace-pre-wrap break-all', l.level === 'error' && 'text-[#ff9aa0]')}>
                    {`[${new Date(l.t).toTimeString().slice(0, 8)}] ${l.message}`}
                  </div>
                ))
              ) : (
                <div className="opacity-60">// {t('common.none')}</div>
              )}
            </div>
          </PanelBody>
        </Panel>
      </div>
    </div>
  )
}
