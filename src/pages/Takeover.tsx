import React, { useEffect, useState } from 'react'
import {
  AlertTriangle,
  Archive,
  Ban,
  Boxes,
  DownloadCloud,
  FileStack,
  Gauge,
  HardDriveDownload,
  Layers,
  Link2,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  ShieldOff,
  Trash2,
  Upload,
  Wrench
} from 'lucide-react'
import { api } from '../lib/bridge'
import { useApp } from '../lib/store'
import RiskBanner from '../components/RiskBanner'
import { Panel, PanelBody, PanelHead, SectionTitle } from '../components/ui/Panel'
import { Btn, Check, FieldRow, Input, Segmented, Select, Switch, Textarea } from '../components/ui/Controls'
import { Badge, Empty, KV, Modal, Progress, StatCell } from '../components/ui/Feedback'
import { formatBytes, formatRelative, formatSpeed } from '../lib/utils'

type Tab = 'vault' | 'sources' | 'patch' | 'shield'

const KINDS = ['coop', 'nosteam', 'drm', 'file'] as const

export default function Takeover() {
  const { t, lang, pushToast } = useApp()
  const [tab, setTab] = useState<Tab>('vault')

  const fail = (err: unknown) => {
    const msg = String((err as Error)?.message || err)
    pushToast({ kind: 'error', title: t('common.failed'), body: msg })
  }
  const done = (title: string, body?: string) => pushToast({ kind: 'ok', title, body })

  return (
    <div className="p-5 space-y-4 anim-in">
      <Panel>
        <div className="flex flex-wrap items-center gap-4 p-5">
          <div className="w-12 h-12 flex-none flex items-center justify-center bg-brand text-white border border-brand">
            <Boxes size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="tag-plain mb-1">MODULE 11 / TAKEOVER</div>
            <h2 className="display font-bold" style={{ fontSize: 'var(--fs-display)' }}>
              {t('tk.title')}
            </h2>
            <p className="text-[0.75rem] text-ink-3 mt-1">{t('tk.subtitle')}</p>
          </div>
          <Segmented<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { value: 'vault', label: t('tk.tabVault') },
              { value: 'sources', label: t('tk.tabSources') },
              { value: 'patch', label: t('tk.tabPatch') },
              { value: 'shield', label: t('tk.tabShield') }
            ]}
          />
        </div>
      </Panel>

      <RiskBanner compact title={t('lb.riskTitle')} body={t('lb.riskBody')} />

      {tab === 'vault' && <VaultTab onFail={fail} onDone={done} />}
      {tab === 'sources' && <SourcesTab onFail={fail} onDone={done} />}
      {tab === 'patch' && <PatchTab onFail={fail} onDone={done} />}
      {tab === 'shield' && <ShieldTab onFail={fail} onDone={done} />}

      <p className="text-[0.7rem] text-ink-3 leading-relaxed px-1">
        {t('tk.footnote')} · {lang === 'zh' ? '署名 岚川怀瑾' : 'by LanChuanHuaJin'}
      </p>
    </div>
  )
}

/* ==================================================================== */
/* 入库工坊                                                              */
/* ==================================================================== */

function VaultTab({ onFail, onDone }: { onFail: (e: unknown) => void; onDone: (t: string, b?: string) => void }) {
  const { t } = useApp()
  const [guard, setGuard] = useState<any>(null)
  const [testing, setTesting] = useState(false)
  const [report, setReport] = useState<any>(null)
  const [records, setRecords] = useState<any[]>([])
  const [cache, setCache] = useState<any[]>([])
  const [busy, setBusy] = useState('')
  const [form, setForm] = useState({
    appid: '',
    name: '',
    installdir: '',
    library: '',
    sizeOnDisk: 0,
    buildid: '',
    depots: [] as any[],
    createDir: true,
    touchConfig: true
  })
  const [info, setInfo] = useState<any>(null)
  const [lastActions, setLastActions] = useState<string[]>([])

  const refresh = async () => {
    try {
      const g = await api.vaultGuard()
      setGuard(g)
      setForm((f) => ({ ...f, library: f.library || (g.libraries[0] && g.libraries[0].path) || '' }))
    } catch (err) {
      onFail(err)
    }
    try {
      const r = await api.vaultList()
      setRecords(r.items || [])
    } catch (_) {
      /* 忽略 */
    }
    try {
      setCache(await api.vaultDepotCache())
    } catch (_) {
      /* 忽略 */
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchInfo = async () => {
    setBusy('fetch')
    try {
      const r = await api.vaultAppInfo(form.appid)
      setInfo(r)
      setForm((f) => ({
        ...f,
        name: r.name || f.name,
        installdir: r.installdir || f.installdir,
        sizeOnDisk: r.totalSize || f.sizeOnDisk,
        buildid: r.buildid || f.buildid,
        depots: r.depots || []
      }))
      onDone(t('tk.infoFetched'), r.name || form.appid)
    } catch (err) {
      onFail(err)
    }
    setBusy('')
  }

  const install = async () => {
    setBusy('install')
    try {
      const r = await api.vaultInstall({ ...form })
      setLastActions(r.actions || [])
      onDone(t('tk.installed'), r.record?.name)
      if (r.verify && !r.verify.ok) {
        const bad = (r.verify.checks || []).filter((c: any) => !c.ok).map((c: any) => c.name).join(', ')
        onFail(new Error(`${t('tk.verifyBad')}：${bad}`))
      }
      await refresh()
    } catch (err) {
      onFail(err)
    }
    setBusy('')
  }

  const remove = async (rec: any) => {
    setBusy(rec.id)
    try {
      const r = await api.vaultRemove(rec.id, {})
      onDone(t('tk.uninstalled'), (r.actions || []).join(' · '))
      await refresh()
    } catch (err) {
      onFail(err)
    }
    setBusy('')
  }

  const killSteam = async () => {
    setBusy('kill')
    try {
      await api.vaultKillSteam()
      onDone(t('tk.steamKilled'))
      await refresh()
    } catch (err) {
      onFail(err)
    }
    setBusy('')
  }

  const importManifest = async () => {
    try {
      const paths = await api.vaultPickManifests()
      if (!paths || !paths.length) return
      const r = await api.vaultImportManifests(paths, guard?.libraries?.[0]?.path)
      onDone(t('tk.manifestImported'), (r.actions || []).join(' · '))
      await refresh()
    } catch (err) {
      onFail(err)
    }
  }

  const runSelfTest = async () => {
    setTesting(true)
    try {
      setReport(await api.vaultSelftest())
    } catch (err) {
      onFail(err)
    }
    setTesting(false)
  }

  const steam = guard?.steam || {}

  return (
    <>
      <div className="grid md:grid-cols-3 gap-3">
        <StatCell label={t('tk.steamState')} value={steam.found ? t('tk.steamFound') : t('tk.steamMissing')} sub={steam.root || '—'} tone={steam.found ? 'ok' : 'warn'} />
        <StatCell
          label={t('tk.processState')}
          value={steam.running ? t('tk.running') : t('tk.stopped')}
          sub={steam.running ? t('tk.mustClose') : t('tk.safeToWrite')}
          tone={steam.running ? 'warn' : 'ok'}
        />
        <StatCell label={t('tk.privilege')} value={guard?.admin ? t('tk.adminYes') : t('tk.adminNo')} sub={guard?.writable ? t('tk.writable') : t('tk.notWritable')} tone={guard?.admin ? 'ok' : 'neutral'} />
      </div>

      <Panel>
        <PanelHead
          index="11.1"
          icon={<FileStack size={15} />}
          title={t('tk.vaultTitle')}
          hint={t('tk.vaultHint')}
          right={
            <>
              <Btn size="sm" onClick={refresh}>
                <RefreshCw size={13} />
                {t('common.refresh')}
              </Btn>
              {steam.running && (
                <Btn size="sm" variant="danger" onClick={killSteam} disabled={busy === 'kill'}>
                  <Ban size={13} />
                  {t('tk.killSteam')}
                </Btn>
              )}
            </>
          }
        />
        <PanelBody className="space-y-4">
          {(guard?.hints || []).length > 0 && (
            <div className="border border-line-2 bg-surface-2 px-3 py-2 space-y-1">
              {guard.hints.map((h: string, i: number) => (
                <div key={i} className="flex items-start gap-2 text-[0.72rem] text-ink-2">
                  <AlertTriangle size={12} className="text-warn mt-[2px] flex-none" />
                  <span>{h}</span>
                </div>
              ))}
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="space-y-3">
              <SectionTitle>{t('tk.vaultNew')}</SectionTitle>
              <FieldRow label={t('tk.appid')} hint={t('tk.appidHint')}>
                <div className="flex gap-2">
                  <Input
                    className="flex-1"
                    mono
                    value={form.appid}
                    placeholder="2358720"
                    onChange={(e) => setForm({ ...form, appid: e.target.value.replace(/\D/g, '') })}
                  />
                  <Btn onClick={fetchInfo} disabled={!form.appid || busy === 'fetch'}>
                    <DownloadCloud size={13} />
                    {busy === 'fetch' ? t('common.loading') : t('tk.fetchInfo')}
                  </Btn>
                </div>
              </FieldRow>

              <FieldRow label={t('common.name')}>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </FieldRow>

              <FieldRow label={t('tk.installdir')} hint={t('tk.installdirHint')}>
                <Input value={form.installdir} onChange={(e) => setForm({ ...form, installdir: e.target.value })} />
              </FieldRow>

              <FieldRow label={t('tk.library')}>
                <Select value={form.library} onChange={(e) => setForm({ ...form, library: e.target.value })}>
                  {(guard?.libraries || []).map((l: any) => (
                    <option key={l.path} value={l.path}>
                      {l.path}
                      {l.writable ? '' : ` (${t('tk.notWritable')})`}
                    </option>
                  ))}
                </Select>
              </FieldRow>

              <div className="grid grid-cols-2 gap-3">
                <FieldRow label={t('tk.sizeOnDisk')}>
                  <Input
                    mono
                    type="number"
                    value={form.sizeOnDisk}
                    onChange={(e) => setForm({ ...form, sizeOnDisk: Number(e.target.value) })}
                  />
                </FieldRow>
                <FieldRow label="BuildID">
                  <Input mono value={form.buildid} onChange={(e) => setForm({ ...form, buildid: e.target.value })} />
                </FieldRow>
              </div>

              <div className="space-y-2 pt-1">
                <Switch checked={form.createDir} onChange={(v) => setForm({ ...form, createDir: v })} label={t('tk.optCreateDir')} hint={t('tk.optCreateDirHint')} />
                <Switch checked={form.touchConfig} onChange={(v) => setForm({ ...form, touchConfig: v })} label={t('tk.optConfig')} hint={t('tk.optConfigHint')} />
              </div>

              <Btn variant="primary" className="w-full justify-center" onClick={install} disabled={!form.appid || busy === 'install'}>
                <Layers size={14} />
                {busy === 'install' ? t('common.loading') : t('tk.install')}
              </Btn>
            </div>

            <div>
              <SectionTitle
                right={
                  info ? (
                    <Btn size="sm" variant="ghost" onClick={() => api.openExternal(`https://store.steampowered.com/app/${form.appid}/`).catch(() => {})}>
                      {t('common.open')}
                    </Btn>
                  ) : undefined
                }
              >
                {t('tk.depotPlan')}
              </SectionTitle>
              {!info ? (
                <Empty icon={<Gauge size={18} />} title={t('tk.noPlan')} hint={t('tk.noPlanHint')} />
              ) : (
                <div className="space-y-3">
                  <div className="border border-line-2 bg-surface-2 p-3">
                    <KV k={t('tk.appid')} v={info.appid} mono />
                    <KV k={t('common.name')} v={info.name || '—'} />
                    <KV k={t('tk.source')} v={info.source === 'appinfo' ? t('tk.sourceAppinfo') : t('tk.sourceStore')} />
                    <KV k="BuildID" v={info.buildid || '—'} mono />
                    <KV k={t('common.size')} v={formatBytes(info.totalSize || 0)} mono />
                  </div>
                  <div className="max-h-[280px] overflow-auto border border-line-2">
                    <table className="w-full text-[0.72rem]">
                      <thead className="bg-surface-2 sticky top-0">
                        <tr>
                          <th className="text-left px-2 py-1.5 font-medium text-ink-3">Depot</th>
                          <th className="text-left px-2 py-1.5 font-medium text-ink-3">Manifest</th>
                          <th className="text-right px-2 py-1.5 font-medium text-ink-3">{t('common.size')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(info.depots || []).map((d: any) => (
                          <tr key={d.depotId} className="border-t border-line">
                            <td className="px-2 py-1.5 mono">
                              {d.depotId}
                              {d.shared && <Badge tone="brand" className="ml-1">shared</Badge>}
                            </td>
                            <td className="px-2 py-1.5 mono text-ink-3 truncate max-w-[180px]">{d.gid || '—'}</td>
                            <td className="px-2 py-1.5 mono text-right">{formatBytes(d.size || 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>

          {lastActions.length > 0 && (
            <div className="border border-line-2 bg-surface-2 p-3">
              <SectionTitle>{t('tk.lastActions')}</SectionTitle>
              <ul className="space-y-1">
                {lastActions.map((a, i) => (
                  <li key={i} className="text-[0.74rem] text-ink-2 flex gap-2">
                    <span className="text-brand flex-none">›</span>
                    <span className="break-all">{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHead index="11.2" icon={<Archive size={15} />} title={t('tk.records')} hint={t('tk.recordsHint')} right={<Badge tone="brand">{records.length}</Badge>} />
        <PanelBody pad={false}>
          {!records.length ? (
            <Empty icon={<Layers size={18} />} title={t('common.none')} hint={t('tk.recordsEmpty')} />
          ) : (
            <div className="divide-y divide-[var(--line)]">
              {records.map((r) => (
                <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="w-10 h-10 flex-none bg-surface-3 border border-line flex items-center justify-center mono text-[0.7rem] text-ink-3">
                    {r.appid.slice(-4)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[0.82rem] text-ink truncate">{r.name}</div>
                    <div className="text-[0.68rem] text-ink-3 mono truncate">{r.gameDir}</div>
                  </div>
                  <div className="hidden md:flex flex-col items-end gap-1">
                    <Badge tone={r.acfExists ? 'ok' : 'warn'}>{r.acfExists ? 'acf' : 'no-acf'}</Badge>
                    <span className="text-[0.66rem] text-ink-3">{formatBytes(r.sizeOnDisk || 0)}</span>
                  </div>
                  <Btn size="sm" variant="ghost" onClick={() => api.openFolder(r.library).catch(() => {})}>
                    {t('common.openFolder')}
                  </Btn>
                  <Btn size="sm" variant="danger" onClick={() => remove(r)} disabled={busy === r.id}>
                    <Trash2 size={13} />
                    {t('tk.uninstall')}
                  </Btn>
                </div>
              ))}
            </div>
          )}
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHead
          index="11.3"
          icon={<HardDriveDownload size={15} />}
          title={t('tk.cacheTitle')}
          hint={t('tk.cacheHint')}
          right={
            <>
              <Btn size="sm" onClick={importManifest}>
                <Upload size={13} />
                {t('tk.importManifest')}
              </Btn>
              <Btn
                size="sm"
                variant="ghost"
                onClick={async () => {
                  try {
                    const r = await api.vaultExportManifests()
                    onDone(t('tk.exported'), r.dir)
                  } catch (err) {
                    onFail(err)
                  }
                }}
              >
                {t('tk.exportManifest')}
              </Btn>
            </>
          }
        />
        <PanelBody>
          {!cache.length ? (
            <Empty icon={<HardDriveDownload size={18} />} title={t('common.none')} />
          ) : (
            <div className="space-y-3">
              {cache.map((c) => (
                <div key={c.library} className="border border-line-2 bg-surface-2 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="mono text-[0.74rem] text-ink truncate flex-1">{c.dir}</span>
                    <Badge tone={c.count ? 'ok' : 'neutral'}>{c.count} manifests</Badge>
                  </div>
                  {c.count > 0 && (
                    <div className="max-h-[140px] overflow-auto space-y-[3px]">
                      {c.files.slice(0, 40).map((f: any) => (
                        <div key={f.name} className="flex items-center gap-2 text-[0.7rem] text-ink-2">
                          <span className="mono truncate flex-1">{f.name}</span>
                          <span className="mono text-ink-3">{formatBytes(f.size)}</span>
                          <span className="text-ink-3">{formatRelative(f.mtime)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHead
          index="11.4"
          icon={<Wrench size={15} />}
          title={t('tk.selftest')}
          hint={t('tk.selftestHint')}
          right={
            <Btn size="sm" variant="primary" onClick={runSelfTest} disabled={testing}>
              <ShieldCheck size={13} />
              {testing ? t('tk.selftestRunning') : t('tk.selftestRun')}
            </Btn>
          }
        />
        <PanelBody>
          {!report && <Empty icon={<Wrench size={18} />} title={t('tk.selftest')} hint={t('tk.selftestHint')} />}
          {report && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge tone={report.ok ? 'ok' : 'danger'}>{report.ok ? t('tk.selftestPass') : t('tk.selftestFail')}</Badge>
                <span className="mono text-[0.72rem] text-ink-3">
                  {report.passed} / {report.passed + report.failed}
                </span>
              </div>
              <div className="divide-y divide-line border border-line">
                {(report.results || []).map((r: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-1.5">
                    <span className={r.ok ? 'text-ok' : 'text-signal'}>{r.ok ? <ShieldCheck size={13} /> : <AlertTriangle size={13} />}</span>
                    <span className="text-[0.75rem] text-ink-2 flex-1 truncate">{r.name}</span>
                    <span className="mono text-[0.66rem] text-ink-3 truncate max-w-[46%]">{r.detail}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </PanelBody>
      </Panel>
    </>
  )
}

/* ==================================================================== */
/* 资源库                                                                */
/* ==================================================================== */

function SourcesTab({ onFail, onDone }: { onFail: (e: unknown) => void; onDone: (t: string, b?: string) => void }) {
  const { t } = useApp()
  const [sources, setSources] = useState<any[]>([])
  const [jobs, setJobs] = useState<any[]>([])
  const [cmd, setCmd] = useState<any>(null)
  const [busy, setBusy] = useState('')
  const [sel, setSel] = useState<string[]>([])
  const [form, setForm] = useState({ name: '', url: '', appid: '', version: '', note: '', tags: '' })
  const [pullForm, setPullForm] = useState({ appid: '', depotId: '', manifestId: '' })
  const [offline, setOffline] = useState<any>(null)

  const refresh = async () => {
    try {
      const r = await api.depotSources()
      setSources(r.sources || [])
    } catch (err) {
      onFail(err)
    }
    try {
      setCmd(await api.depotSteamcmd())
    } catch (_) {
      /* 忽略 */
    }
    try {
      setJobs(await api.depotJobs())
    } catch (_) {
      /* 忽略 */
    }
  }

  useEffect(() => {
    refresh()
    const off = api.on('depot:progress', (list: any[]) => setJobs(list || []))
    const timer = setInterval(() => {
      api
        .depotJobs()
        .then((l) => setJobs(l || []))
        .catch(() => {})
    }, 2500)
    return () => {
      off && off()
      clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const add = async () => {
    try {
      await api.depotAddSource({ ...form, tags: form.tags.split(/[,，\s]+/).filter(Boolean) })
      setForm({ name: '', url: '', appid: '', version: '', note: '', tags: '' })
      onDone(t('common.saved'))
      await refresh()
    } catch (err) {
      onFail(err)
    }
  }

  const importIndex = async () => {
    try {
      const file = await api.sysPickFile([{ name: 'JSON / CSV / TXT', extensions: ['json', 'csv', 'txt'] }])
      if (!file) return
      const r = await api.depotImportIndex(file)
      onDone(t('tk.indexImported'), `+${r.added} / ${r.parsed}`)
      await refresh()
    } catch (err) {
      onFail(err)
    }
  }

  const queue = async () => {
    if (!sel.length) return
    setBusy('queue')
    try {
      const r = await api.depotQueue(sel, {})
      const good = (r.results || []).filter((x: any) => x.ok).length
      onDone(t('tk.queued'), `${good}/${r.results.length}`)
      setSel([])
    } catch (err) {
      onFail(err)
    }
    setBusy('')
  }

  const installCmd = async () => {
    setBusy('cmd')
    try {
      const r = await api.depotInstallSteamcmd()
      onDone(t('tk.cmdInstalled'), r.path)
      await refresh()
    } catch (err) {
      onFail(err)
    }
    setBusy('')
  }

  const pull = async () => {
    setBusy('pull')
    try {
      await api.depotPull(pullForm)
      onDone(t('tk.pullStarted'))
      await refresh()
    } catch (err) {
      onFail(err)
    }
    setBusy('')
  }

  const offlinePrep = async (job: any) => {
    setBusy('offline')
    try {
      const dir = await api.libPickDir()
      if (!dir) return
      const r = await api.depotOfflinePrep({ gameDir: dir, appid: job.appid })
      setOffline(r)
      onDone(t('tk.offlineReady'), r.script)
    } catch (err) {
      onFail(err)
    }
    setBusy('')
  }

  const apply = async (job: any) => {
    setBusy('apply')
    try {
      const dir = await api.libPickDir()
      if (!dir) return
      const r = await api.depotApply(job.id, dir, {})
      onDone(t('tk.applied'), `${r.copied} files`)
    } catch (err) {
      onFail(err)
    }
    setBusy('')
  }

  return (
    <>
      <Panel>
        <PanelHead
          index="11.4"
          icon={<Link2 size={15} />}
          title={t('tk.sourcesTitle')}
          hint={t('tk.sourcesHint')}
          right={
            <>
              <Btn size="sm" onClick={importIndex}>
                <Upload size={13} />
                {t('tk.importIndex')}
              </Btn>
              <Btn
                size="sm"
                variant="ghost"
                onClick={async () => {
                  try {
                    const r = await api.depotExportIndex()
                    onDone(t('tk.exported'), r.file)
                  } catch (err) {
                    onFail(err)
                  }
                }}
              >
                {t('tk.exportIndex')}
              </Btn>
              <Btn size="sm" variant="primary" onClick={queue} disabled={!sel.length || busy === 'queue'}>
                <DownloadCloud size={13} />
                {t('tk.queueSelected')} {sel.length ? `(${sel.length})` : ''}
              </Btn>
            </>
          }
        />
        <PanelBody className="space-y-4">
          <div className="grid lg:grid-cols-4 gap-3">
            <FieldRow label={t('common.name')}>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </FieldRow>
            <FieldRow label="URL / magnet" className="lg:col-span-2">
              <Input mono value={form.url} placeholder="https://… 或 magnet:?xt=…" onChange={(e) => setForm({ ...form, url: e.target.value })} />
            </FieldRow>
            <FieldRow label={t('tk.appid')} hint={t('common.optional')}>
              <Input mono value={form.appid} onChange={(e) => setForm({ ...form, appid: e.target.value.replace(/\D/g, '') })} />
            </FieldRow>
            <FieldRow label={t('tk.version')} hint={t('common.optional')}>
              <Input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} />
            </FieldRow>
            <FieldRow label={t('tk.tags')} hint="逗号分隔">
              <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
            </FieldRow>
            <FieldRow label={t('tk.note')} hint={t('common.optional')} className="lg:col-span-2">
              <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </FieldRow>
          </div>
          <Btn variant="primary" onClick={add} disabled={!form.url}>
            <Plus size={13} />
            {t('tk.addSource')}
          </Btn>

          <p className="text-[0.7rem] text-ink-3 leading-relaxed">{t('tk.sourceScope')}</p>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHead index="11.5" title={t('tk.sourceList')} right={<Badge tone="brand">{sources.length}</Badge>} />
        <PanelBody pad={false}>
          {!sources.length ? (
            <Empty icon={<Link2 size={18} />} title={t('common.none')} hint={t('tk.sourceEmpty')} />
          ) : (
            <div className="divide-y divide-[var(--line)]">
              {sources.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                  <Check checked={sel.includes(s.id)} onChange={(v) => setSel(v ? [...sel, s.id] : sel.filter((x) => x !== s.id))} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[0.82rem] text-ink truncate">{s.name}</span>
                      <Badge tone={s.kind === 'magnet' ? 'warn' : s.kind === 'index' ? 'neutral' : 'brand'}>{s.kind}</Badge>
                      {s.version && <Badge tone="neutral">{s.version}</Badge>}
                    </div>
                    <div className="text-[0.68rem] text-ink-3 mono truncate">{s.url}</div>
                  </div>
                  <Btn size="sm" variant="ghost" onClick={() => api.copy(s.url).then(() => onDone(t('common.copied')))}>
                    {t('common.copy')}
                  </Btn>
                  <Btn
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      try {
                        await api.depotRemoveSource(s.id)
                        setSel(sel.filter((x) => x !== s.id))
                        await refresh()
                      } catch (err) {
                        onFail(err)
                      }
                    }}
                  >
                    <Trash2 size={13} />
                  </Btn>
                </div>
              ))}
            </div>
          )}
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHead
          index="11.6"
          icon={<Wrench size={15} />}
          title={t('tk.cmdTitle')}
          hint={t('tk.cmdHint')}
          right={
            cmd?.installed ? (
              <Badge tone="ok">{t('tk.cmdReady')}</Badge>
            ) : (
              <Btn size="sm" variant="primary" onClick={installCmd} disabled={busy === 'cmd'}>
                <DownloadCloud size={13} />
                {busy === 'cmd' ? t('common.loading') : t('tk.cmdInstall')}
              </Btn>
            )
          }
        />
        <PanelBody className="space-y-3">
          {cmd?.installed && <div className="mono text-[0.72rem] text-ink-3 break-all">{cmd.path}</div>}
          <div className="grid lg:grid-cols-4 gap-3 items-end">
            <FieldRow label={t('tk.appid')}>
              <Input mono value={pullForm.appid} onChange={(e) => setPullForm({ ...pullForm, appid: e.target.value.replace(/\D/g, '') })} />
            </FieldRow>
            <FieldRow label="DepotID">
              <Input mono value={pullForm.depotId} onChange={(e) => setPullForm({ ...pullForm, depotId: e.target.value.replace(/\D/g, '') })} />
            </FieldRow>
            <FieldRow label="ManifestID" hint={t('common.optional')}>
              <Input mono value={pullForm.manifestId} onChange={(e) => setPullForm({ ...pullForm, manifestId: e.target.value.replace(/\D/g, '') })} />
            </FieldRow>
            <Btn variant="primary" className="justify-center" onClick={pull} disabled={!pullForm.appid || !pullForm.depotId || busy === 'pull'}>
              <DownloadCloud size={13} />
              {t('tk.pullStart')}
            </Btn>
          </div>
          <p className="text-[0.7rem] text-ink-3 leading-relaxed">{t('tk.pullHint')}</p>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHead index="11.7" title={t('tk.jobs')} hint={t('tk.jobsHint')} right={<Badge tone="neutral">{jobs.length}</Badge>} />
        <PanelBody className="space-y-3">
          {!jobs.length ? (
            <Empty icon={<DownloadCloud size={18} />} title={t('common.none')} />
          ) : (
            jobs.map((j) => (
              <div key={j.id} className="border border-line-2 bg-surface-2 p-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge tone={j.status === 'done' ? 'ok' : j.status === 'failed' ? 'danger' : j.status === 'cancelled' ? 'neutral' : 'brand'}>{j.status}</Badge>
                  <span className="mono text-[0.74rem] text-ink">
                    app {j.appid} · depot {j.depotId}
                  </span>
                  <span className="flex-1" />
                  <span className="mono text-[0.72rem] text-ink-3">
                    {formatBytes(j.downloaded)} / {formatBytes(j.total)} · {formatSpeed(j.speed || 0)}
                  </span>
                </div>
                <Progress value={(j.progress || 0) * 100} tone={j.status === 'failed' ? 'danger' : j.status === 'done' ? 'ok' : 'brand'} />
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[0.7rem] text-ink-3 flex-1 truncate">{j.message}</span>
                  {j.status === 'running' && (
                    <Btn size="sm" variant="ghost" onClick={() => api.depotCancel(j.id).catch(onFail)}>
                      {t('common.stop')}
                    </Btn>
                  )}
                  {j.outputDir && (
                    <Btn size="sm" variant="primary" onClick={() => apply(j)} disabled={busy === 'apply'}>
                      {t('tk.applyDepot')}
                    </Btn>
                  )}
                  <Btn size="sm" variant="ghost" onClick={() => offlinePrep(j)} disabled={busy === 'offline'}>
                    {t('tk.offlinePrep')}
                  </Btn>
                </div>
                {j.output && j.output.length > 0 && (
                  <pre className="max-h-[120px] overflow-auto bg-surface-sunken border border-line p-2 text-[0.66rem] mono text-ink-3 leading-relaxed">
                    {j.output.slice(-12).join('\n')}
                  </pre>
                )}
              </div>
            ))
          )}
        </PanelBody>
      </Panel>

      {offline && (
        <Panel>
          <PanelHead index="11.8" title={t('tk.offlineTitle')} hint={offline.script} />
          <PanelBody className="space-y-2">
            {offline.actions.map((a: string, i: number) => (
              <div key={i} className="text-[0.76rem] text-ink-2 flex gap-2">
                <span className="text-ok flex-none">›</span>
                <span>{a}</span>
              </div>
            ))}
            <div className="pt-2 space-y-1.5">
              {offline.steps.map((s: string, i: number) => (
                <div key={i} className="text-[0.74rem] text-ink-3 flex gap-2">
                  <span className="mono flex-none">{String(i + 1).padStart(2, '0')}</span>
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </PanelBody>
        </Panel>
      )}
    </>
  )
}

/* ==================================================================== */
/* 补丁中心                                                              */
/* ==================================================================== */

function PatchTab({ onFail, onDone }: { onFail: (e: unknown) => void; onDone: (t: string, b?: string) => void }) {
  const { t } = useApp()
  const [profiles, setProfiles] = useState<any[]>([])
  const [points, setPoints] = useState<any[]>([])
  const [edit, setEdit] = useState<any>(null)
  const [scan, setScan] = useState<any>(null)
  const [plan, setPlan] = useState<any[]>([])
  const [busy, setBusy] = useState('')

  const refresh = async () => {
    try {
      const r = await api.bypassProfiles()
      setProfiles(r.profiles || [])
    } catch (err) {
      onFail(err)
    }
    try {
      setPoints(await api.bypassPoints())
    } catch (_) {
      /* 忽略 */
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const blank = () => ({
    id: '',
    name: '',
    gameName: '',
    appid: '',
    kind: 'coop',
    gameDir: '',
    files: [] as string[],
    note: '',
    options: {
      accountName: 'ShiroPlayer',
      language: 'schinese',
      broadcast: '',
      dlc: '',
      depots: '',
      launchArgs: '',
      writeHosts: false,
      firewall: false,
      exeName: ''
    }
  })

  const openEditor = async (p?: any) => {
    const next = p ? { ...p, options: { ...(p.options || {}) } } : blank()
    setEdit(next)
    setPlan([])
    setScan(null)
    if (next.gameDir) {
      try {
        const s = await api.bypassAnalyze(next.gameDir)
        setScan(s)
      } catch (_) {
        /* 目录还没选 */
      }
    }
  }

  const pickDir = async () => {
    const dir = await api.libPickDir().catch(() => null)
    if (!dir || !edit) return
    const next = { ...edit, gameDir: dir }
    setEdit(next)
    try {
      setScan(await api.bypassAnalyze(dir))
    } catch (err) {
      onFail(err)
    }
  }

  const addFile = async () => {
    const f = await api.sysPickFile().catch(() => null)
    if (!f || !edit) return
    setEdit({ ...edit, files: Array.from(new Set([...(edit.files || []), f])) })
  }

  const previewPlan = async () => {
    if (!edit) return
    try {
      setPlan(await api.bypassPlan(edit))
    } catch (err) {
      onFail(err)
    }
  }

  const save = async () => {
    if (!edit) return
    try {
      await api.bypassSaveProfile(edit)
      setEdit(null)
      onDone(t('common.saved'))
      await refresh()
    } catch (err) {
      onFail(err)
    }
  }

  const deploy = async (p: any) => {
    setBusy(p.id)
    try {
      const r = await api.bypassDeploy(p.id, p.gameDir || undefined)
      onDone(t('tk.deployed'), (r.actions || []).slice(0, 3).join(' · '))
      await refresh()
    } catch (err) {
      onFail(err)
    }
    setBusy('')
  }

  const restorePoint = async (id: string) => {
    setBusy(id)
    try {
      const r = await api.bypassRestore(id)
      onDone(t('tk.restored'), (r.log || []).slice(0, 3).join(' · '))
      await refresh()
    } catch (err) {
      onFail(err)
    }
    setBusy('')
  }

  return (
    <>
      <Panel>
        <PanelHead
          index="11.9"
          icon={<Archive size={15} />}
          title={t('tk.patchTitle')}
          hint={t('tk.patchHint')}
          right={
            <>
              <Btn size="sm" variant="ghost" onClick={async () => {
                try {
                  const r = await api.bypassRestoreLatest()
                  onDone(t('tk.restored'), (r.log || []).slice(0, 3).join(' · '))
                  await refresh()
                } catch (err) {
                  onFail(err)
                }
              }}>
                <RotateCcw size={13} />
                {t('tk.undoLatest')}
              </Btn>
              <Btn size="sm" variant="primary" onClick={() => openEditor()}>
                <Plus size={13} />
                {t('tk.newProfile')}
              </Btn>
            </>
          }
        />
        <PanelBody pad={false}>
          {!profiles.length ? (
            <Empty icon={<Archive size={18} />} title={t('common.none')} hint={t('tk.patchEmpty')} />
          ) : (
            <div className="divide-y divide-[var(--line)]">
              {profiles.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 flex-wrap">
                  <Badge tone="brand">{t(`tk.kind_${p.kind}`)}</Badge>
                  <div className="min-w-0 flex-1">
                    <div className="text-[0.82rem] text-ink truncate">
                      {p.name}
                      {p.appid && <span className="mono text-[0.7rem] text-ink-3 ml-2">app {p.appid}</span>}
                    </div>
                    <div className="text-[0.68rem] text-ink-3 mono truncate">{p.gameDir || t('tk.noDir')}</div>
                  </div>
                  <span className="text-[0.68rem] text-ink-3">{p.files?.length || 0} files</span>
                  <Btn size="sm" variant="primary" onClick={() => deploy(p)} disabled={busy === p.id}>
                    <Wrench size={13} />
                    {t('tk.deploy')}
                  </Btn>
                  <Btn size="sm" variant="ghost" onClick={() => openEditor(p)}>
                    {t('common.edit')}
                  </Btn>
                  <Btn
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      try {
                        await api.bypassRemoveProfile(p.id)
                        await refresh()
                      } catch (err) {
                        onFail(err)
                      }
                    }}
                  >
                    <Trash2 size={13} />
                  </Btn>
                </div>
              ))}
            </div>
          )}
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHead index="11.10" icon={<RotateCcw size={15} />} title={t('tk.points')} hint={t('tk.pointsHint')} right={<Badge tone={points.length ? 'warn' : 'neutral'}>{points.length}</Badge>} />
        <PanelBody pad={false}>
          {!points.length ? (
            <Empty icon={<RotateCcw size={18} />} title={t('common.none')} />
          ) : (
            <div className="divide-y divide-[var(--line)]">
              {points.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 flex-wrap">
                  <span className="mono text-[0.7rem] text-ink-3">{formatRelative(p.createdAt)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[0.8rem] text-ink truncate">{p.profileName || p.kind}</div>
                    <div className="text-[0.68rem] text-ink-3 mono truncate">{p.gameDir}</div>
                  </div>
                  <Badge tone={p.restoredAt ? 'neutral' : 'ok'}>{p.restoredAt ? t('tk.pointRestored') : t('tk.pointLive')}</Badge>
                  <Btn size="sm" variant={p.restoredAt ? 'ghost' : 'primary'} onClick={() => restorePoint(p.id)} disabled={busy === p.id || !!p.restoredAt}>
                    <RotateCcw size={13} />
                    {t('tk.restore')}
                  </Btn>
                </div>
              ))}
            </div>
          )}
        </PanelBody>
      </Panel>

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={t('tk.profileTitle')}
        width="max-w-3xl"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setEdit(null)}>
              {t('common.cancel')}
            </Btn>
            <Btn variant="primary" onClick={save}>
              {t('common.save')}
            </Btn>
          </>
        }
      >
        {edit && (
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-3">
              <FieldRow label={t('common.name')}>
                <Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
              </FieldRow>
              <FieldRow label={t('tk.gameName')} hint={t('common.optional')}>
                <Input value={edit.gameName} onChange={(e) => setEdit({ ...edit, gameName: e.target.value })} />
              </FieldRow>
              <FieldRow label={t('tk.appid')}>
                <Input mono value={edit.appid} onChange={(e) => setEdit({ ...edit, appid: e.target.value.replace(/\D/g, '') })} />
              </FieldRow>
              <FieldRow label={t('tk.kind')}>
                <Select value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value })}>
                  {KINDS.map((k) => (
                    <option key={k} value={k}>
                      {t(`tk.kind_${k}`)}
                    </option>
                  ))}
                </Select>
              </FieldRow>
            </div>

            <FieldRow label={t('tk.gameDir')}>
              <div className="flex gap-2">
                <Input className="flex-1" mono value={edit.gameDir} onChange={(e) => setEdit({ ...edit, gameDir: e.target.value })} />
                <Btn onClick={pickDir}>{t('common.pickDir')}</Btn>
              </div>
            </FieldRow>

            {scan && (
              <div className="border border-line-2 bg-surface-2 p-3">
                <SectionTitle right={<Badge tone={scan.patched ? 'warn' : 'neutral'}>{scan.patched ? t('tk.patched') : t('tk.clean')}</Badge>}>
                  {t('tk.scanTitle')}
                </SectionTitle>
                <KV k="steam_api" v={scan.apiFiles.length ? scan.apiFiles.map((f: any) => f.name).join(' · ') : '—'} mono />
                <KV k={t('tk.mainExe')} v={scan.exe ? scan.exe.name : '—'} mono />
                <KV k={t('tk.markers')} v={scan.markers.length ? scan.markers.join(' · ') : '—'} mono />
                <KV k={t('tk.backupsFound')} v={scan.backups.length ? String(scan.backups.length) : '0'} mono />
                <KV k={t('tk.writable')} v={scan.writable ? '✓' : '✗'} />
              </div>
            )}

            <div>
              <SectionTitle
                right={
                  <Btn size="sm" onClick={addFile}>
                    <Plus size={13} />
                    {t('tk.addFile')}
                  </Btn>
                }
              >
                {t('tk.filesTitle')}
              </SectionTitle>
              {!edit.files?.length ? (
                <p className="text-[0.72rem] text-ink-3">{t('tk.filesEmpty')}</p>
              ) : (
                <div className="space-y-1">
                  {edit.files.map((f: string, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-[0.74rem] text-ink-2">
                      <span className="mono truncate flex-1">{f}</span>
                      <button
                        onClick={() => setEdit({ ...edit, files: edit.files.filter((x: string) => x !== f) })}
                        className="text-ink-3 hover:text-signal"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid md:grid-cols-3 gap-3">
              <FieldRow label={t('tk.accountName')} hint={t('common.optional')}>
                <Input value={edit.options.accountName} onChange={(e) => setEdit({ ...edit, options: { ...edit.options, accountName: e.target.value } })} />
              </FieldRow>
              <FieldRow label={t('tk.language')}>
                <Select value={edit.options.language} onChange={(e) => setEdit({ ...edit, options: { ...edit.options, language: e.target.value } })}>
                  <option value="schinese">简体中文</option>
                  <option value="tchinese">繁體中文</option>
                  <option value="english">English</option>
                  <option value="japanese">日本語</option>
                </Select>
              </FieldRow>
              <FieldRow label={t('tk.broadcast')} hint={t('common.optional')}>
                <Input value={edit.options.broadcast} onChange={(e) => setEdit({ ...edit, options: { ...edit.options, broadcast: e.target.value } })} />
              </FieldRow>
              <FieldRow label="DLC IDs" hint="逗号分隔">
                <Input mono value={edit.options.dlc} onChange={(e) => setEdit({ ...edit, options: { ...edit.options, dlc: e.target.value } })} />
              </FieldRow>
              <FieldRow label="Depot IDs" hint="逗号分隔">
                <Input mono value={edit.options.depots} onChange={(e) => setEdit({ ...edit, options: { ...edit.options, depots: e.target.value } })} />
              </FieldRow>
              <FieldRow label={t('tk.launchArgs')} hint={t('common.optional')}>
                <Input mono value={edit.options.launchArgs} onChange={(e) => setEdit({ ...edit, options: { ...edit.options, launchArgs: e.target.value } })} />
              </FieldRow>
            </div>

            <div className="space-y-2">
              <Switch
                checked={edit.options.writeHosts}
                onChange={(v) => setEdit({ ...edit, options: { ...edit.options, writeHosts: v } })}
                label={t('tk.optHosts')}
                hint={t('tk.optHostsHint')}
              />
              <Switch
                checked={edit.options.firewall}
                onChange={(v) => setEdit({ ...edit, options: { ...edit.options, firewall: v } })}
                label={t('tk.optFirewall')}
                hint={t('tk.optFirewallHint')}
              />
            </div>

            <FieldRow label={t('tk.note')} hint={t('common.optional')}>
              <Textarea rows={2} value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} />
            </FieldRow>

            <div>
              <SectionTitle
                right={
                  <Btn size="sm" onClick={previewPlan}>
                    <Gauge size={13} />
                    {t('tk.previewPlan')}
                  </Btn>
                }
              >
                {t('tk.planTitle')}
              </SectionTitle>
              {!plan.length ? (
                <p className="text-[0.72rem] text-ink-3">{t('tk.planEmpty')}</p>
              ) : (
                <div className="space-y-1">
                  {plan.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 text-[0.72rem]">
                      <Badge tone="neutral">file</Badge>
                      <span className="mono truncate flex-1 text-ink-2">{p.rel}</span>
                      <span className="text-ink-3 truncate max-w-[220px]">{p.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

/* ==================================================================== */
/* 屏蔽                                                                  */
/* ==================================================================== */

function ShieldTab({ onFail, onDone }: { onFail: (e: unknown) => void; onDone: (t: string, b?: string) => void }) {
  const { t } = useApp()
  const [hosts, setHosts] = useState<any>(null)
  const [domains, setDomains] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [rules, setRules] = useState<any[]>([])
  const [exe, setExe] = useState('')
  const [busy, setBusy] = useState('')

  const refresh = async () => {
    try {
      const h = await api.bypassHosts()
      setHosts(h)
      setDomains(h.domains || [])
    } catch (err) {
      onFail(err)
    }
    try {
      const f = await api.bypassFirewallList()
      setRules(f.rules || [])
    } catch (_) {
      /* 非 Windows 直接空着 */
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const writeHosts = async (list: string[]) => {
    setBusy('hosts')
    try {
      const r = await api.bypassHostsWrite(list)
      setDomains(r.domains || [])
      onDone(t('tk.hostsWritten'), `${(r.domains || []).length} domains`)
      await refresh()
    } catch (err) {
      onFail(err)
    }
    setBusy('')
  }

  const addFirewall = async () => {
    setBusy('fw')
    try {
      const target = exe || (await api.sysPickFile([{ name: '可执行文件', extensions: ['exe'] }])) || ''
      if (!target) return
      const r = await api.bypassFirewallAdd(target)
      setExe('')
      onDone(t('tk.fwAdded'), r.name)
      await refresh()
    } catch (err) {
      onFail(err)
    }
    setBusy('')
  }

  return (
    <>
      <Panel>
        <PanelHead
          index="11.11"
          icon={<ShieldOff size={15} />}
          title={t('tk.hostsTitle')}
          hint={hosts?.path || ''}
          right={
            <>
              <Badge tone={hosts?.writable ? 'ok' : 'warn'}>{hosts?.writable ? t('tk.writable') : t('tk.notWritable')}</Badge>
              <Btn size="sm" onClick={() => writeHosts([])} disabled={busy === 'hosts'}>
                <Trash2 size={13} />
                {t('tk.clearBlock')}
              </Btn>
            </>
          }
        />
        <PanelBody className="space-y-3">
          <div className="flex gap-2">
            <Input
              className="flex-1"
              mono
              placeholder="activation.example.com"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <Btn
              onClick={() => {
                const d = input.trim()
                if (!d) return
                setInput('')
                writeHosts(Array.from(new Set([...domains, d])))
              }}
              disabled={busy === 'hosts'}
            >
              <Plus size={13} />
              {t('tk.addDomain')}
            </Btn>
          </div>

          <div>
            <SectionTitle>{t('tk.blockedNow')}</SectionTitle>
            {!domains.length ? (
              <p className="text-[0.72rem] text-ink-3">{t('tk.blockedEmpty')}</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {domains.map((d) => (
                  <span key={d} className="inline-flex items-center gap-1.5 border border-line-2 bg-surface-2 px-2 py-[3px] text-[0.72rem]">
                    <span className="mono">{d}</span>
                    <button onClick={() => writeHosts(domains.filter((x) => x !== d))} className="text-ink-3 hover:text-signal">
                      <Trash2 size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <SectionTitle>{t('tk.presetTitle')}</SectionTitle>
            <div className="flex flex-wrap gap-1.5">
              {(hosts?.preset || []).map((p: any) => {
                const on = domains.includes(p.domain)
                return (
                  <button
                    key={p.domain}
                    onClick={() => writeHosts(on ? domains.filter((x) => x !== p.domain) : Array.from(new Set([...domains, p.domain])))}
                    className={`inline-flex items-center gap-1.5 border px-2 py-[3px] text-[0.72rem] no-drag transition-colors ${
                      on ? 'border-brand bg-brand-soft text-brand' : 'border-line-2 bg-surface-panel text-ink-2 hover:bg-surface-2'
                    }`}
                  >
                    <span className="mono">{p.domain}</span>
                    <span className="text-ink-3">{p.label}</span>
                  </button>
                )
              })}
            </div>
            <p className="text-[0.7rem] text-ink-3 mt-2 leading-relaxed">{t('tk.hostsNote')}</p>
          </div>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHead
          index="11.12"
          icon={<Ban size={15} />}
          title={t('tk.fwTitle')}
          hint={t('tk.fwHint')}
          right={
            <Btn size="sm" variant="primary" onClick={addFirewall} disabled={busy === 'fw'}>
              <Plus size={13} />
              {t('tk.fwAdd')}
            </Btn>
          }
        />
        <PanelBody pad={false}>
          {!rules.length ? (
            <Empty icon={<Ban size={18} />} title={t('common.none')} hint={t('tk.fwEmpty')} />
          ) : (
            <div className="divide-y divide-[var(--line)]">
              {rules.map((r) => (
                <div key={r.name} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="text-[0.78rem] text-ink mono truncate">{r.program || r.name}</div>
                    <div className="text-[0.66rem] text-ink-3 mono truncate">{r.name} · {r.action || ''}</div>
                  </div>
                  <Btn
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      try {
                        await api.bypassFirewallRemove(r.program || '')
                        await refresh()
                      } catch (err) {
                        onFail(err)
                      }
                    }}
                    disabled={!r.program}
                  >
                    <Trash2 size={13} />
                  </Btn>
                </div>
              ))}
            </div>
          )}
        </PanelBody>
      </Panel>
    </>
  )
}
