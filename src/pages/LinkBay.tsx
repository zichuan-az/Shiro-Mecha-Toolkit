import React, { useEffect, useMemo, useState } from 'react'
import {
  Anchor,
  ArrowUpRight,
  Copy,
  Download,
  FileArchive,
  FolderOpen,
  Gauge,
  Globe2,
  Link2,
  Plus,
  RefreshCw,
  ScanSearch,
  ShieldAlert,
  Trash2,
  Zap
} from 'lucide-react'
import { api } from '../lib/bridge'
import { useApp } from '../lib/store'
import RiskBanner from '../components/RiskBanner'
import { Panel, PanelBody, PanelHead, SectionTitle } from '../components/ui/Panel'
import { Btn, FieldRow, Input, Segmented, Select, Switch } from '../components/ui/Controls'
import { Badge, Empty, Modal, StatCell } from '../components/ui/Feedback'
import { cn, formatRelative } from '../lib/utils'

type Tab = 'sites' | 'extract' | 'patches' | 'lines'
type Region = 'all' | 'global' | 'ru' | 'custom'

type LinkEntry = {
  label: string
  url: string
  note?: string
  origin?: string
}

type Site = {
  id: string
  name: string
  url: string
  region: string
  kind: string
  direct: boolean
  risk: string
  speed: string
  note: string
  noteEn: string
  links: LinkEntry[]
  own?: boolean
}

type Patch = {
  id: string
  kind: string
  name: string
  url: string
  region: string
  note: string
  noteEn: string
  links: LinkEntry[]
  ready: boolean
}

type Mirror = {
  id: string
  name: string
  prefix: string
  note: string
  lastMs?: number
  lastOk?: boolean
}

type ProbeItem = { url: string; kind: string; host: string }
type ExtractResult = { source: string; status: number; total: number; items: ProbeItem[]; hosts: { host: string; count: number }[] }

const KINDS: Record<string, { zh: string; en: string; tone: 'neutral' | 'brand' | 'warn' | 'danger' | 'ok' }> = {
  direct: { zh: 'lb.kindDirect', en: 'lb.kindDirect', tone: 'brand' },
  repack: { zh: 'lb.kindRepack', en: 'lb.kindRepack', tone: 'neutral' },
  torrent: { zh: 'lb.kindTorrent', en: 'lb.kindTorrent', tone: 'neutral' },
  fix: { zh: 'lb.kindFix', en: 'lb.kindFix', tone: 'danger' },
  custom: { zh: 'lb.kindCustom', en: 'lb.kindCustom', tone: 'neutral' }
}

const SPEEDS: Record<string, string> = { fast: 'lb.speedFast', mid: 'lb.speedMid', slow: 'lb.speedSlow' }

export default function LinkBay() {
  const { t, pushToast } = useApp()
  const [tab, setTab] = useState<Tab>('sites')
  const [sites, setSites] = useState<Site[]>([])
  const [patches, setPatches] = useState<Patch[]>([])
  const [mirrors, setMirrors] = useState<Mirror[]>([])
  const [steamCdn, setSteamCdn] = useState<{ id: string; name: string; host: string }[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [storePath, setStorePath] = useState('')
  const [busy, setBusy] = useState(false)

  const fail = (err: unknown) => pushToast({ kind: 'error', title: t('common.failed'), body: String((err as Error)?.message || err) })

  const apply = (data: any) => {
    setSites([...(data.sites || []), ...(data.customSites || [])])
    setPatches(data.patches || [])
    setMirrors(data.mirrors || [])
    setSteamCdn(data.steamCdn || [])
    setHistory(data.history || [])
    if (data.store) setStorePath(data.store)
  }

  const load = async () => {
    setBusy(true)
    try {
      apply(await api.linkbayAll())
    } catch (err) {
      fail(err)
    }
    setBusy(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const saveLink = async (target: string, link: LinkEntry) => {
    if (!link.url && !link.label) return
    try {
      apply(await api.linkbayAddLink(target, link))
      pushToast({ kind: 'ok', title: t('lb.linkAdded') })
    } catch (err) {
      fail(err)
    }
  }

  const dropLink = async (target: string, index: number) => {
    try {
      apply(await api.linkbayRemoveLink(target, index))
      pushToast({ kind: 'ok', title: t('lb.linkRemoved') })
    } catch (err) {
      fail(err)
    }
  }

  const openUrl = (url: string) => {
    if (!url) return
    api.openExternal(url).catch(() => {})
  }

  return (
    <div className="p-5 space-y-4 anim-in">
      <Panel>
        <div className="flex flex-wrap items-center gap-4 p-5">
          <div className="w-12 h-12 flex-none flex items-center justify-center bg-brand text-white border border-brand">
            <Anchor size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="tag-plain mb-1">MODULE 12 / LINK BAY</div>
            <h2 className="display font-bold" style={{ fontSize: 'var(--fs-display)' }}>
              {t('lb.title')}
            </h2>
            <p className="text-[0.75rem] text-ink-3 mt-1">{t('lb.subtitle')}</p>
          </div>
          <Segmented<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { value: 'sites', label: t('lb.tabSites') },
              { value: 'extract', label: t('lb.tabExtract') },
              { value: 'patches', label: t('lb.tabPatches') },
              { value: 'lines', label: t('lb.tabLines') }
            ]}
          />
          <Btn size="sm" variant="ghost" onClick={load} disabled={busy}>
            <RefreshCw size={13} className={cn(busy && 'animate-spin')} />
          </Btn>
        </div>
        <div className="px-5 pb-5">
          <RiskBanner title={t('lb.riskTitle')} body={t('lb.riskBody')} />
        </div>
      </Panel>

      {tab === 'sites' && <SitesTab sites={sites} mirrors={mirrors} onSave={saveLink} onDrop={dropLink} onOpen={openUrl} onGoto={setTab} onReload={load} onFail={fail} />}
      {tab === 'extract' && <ExtractTab mirrors={mirrors} history={history} onFail={fail} onReload={load} />}
      {tab === 'patches' && <PatchesTab patches={patches} onSave={saveLink} onDrop={dropLink} onOpen={openUrl} onReload={load} onFail={fail} />}
      {tab === 'lines' && <LinesTab mirrors={mirrors} steamCdn={steamCdn} onReload={load} onFail={fail} />}

      <p className="text-[0.7rem] text-ink-3 leading-relaxed px-1">
        {t('lb.fillHere')}
        {storePath ? ` · ${t('lb.storePath')} ${storePath}` : ''}
      </p>
    </div>
  )
}

/* ==================================================================== */
/* 站源大全                                                              */
/* ==================================================================== */

function SitesTab({
  sites,
  mirrors,
  onSave,
  onDrop,
  onOpen,
  onGoto,
  onReload,
  onFail
}: {
  sites: Site[]
  mirrors: Mirror[]
  onSave: (target: string, link: LinkEntry) => void
  onDrop: (target: string, index: number) => void
  onOpen: (url: string) => void
  onGoto: (t: Tab) => void
  onReload: () => void
  onFail: (e: unknown) => void
}) {
  const { t, lang } = useApp()
  const [query, setQuery] = useState('')
  const [region, setRegion] = useState<Region>('all')
  const [editing, setEditing] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [draft, setDraft] = useState({ name: '', url: '', note: '' })

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return sites.filter((s) => {
      if (region !== 'all' && (s.region || 'global') !== region) return false
      if (!q) return true
      return (
        s.name.toLowerCase().includes(q) ||
        (s.note || '').toLowerCase().includes(q) ||
        (s.url || '').toLowerCase().includes(q)
      )
    })
  }, [sites, query, region])

  const addSite = async () => {
    try {
      await api.linkbayAddSite(draft)
      setAddOpen(false)
      setDraft({ name: '', url: '', note: '' })
      onReload()
    } catch (err) {
      onFail(err)
    }
  }

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHead
          index="12-A"
          icon={<Globe2 size={15} />}
          title={t('lb.tabSites')}
          hint={t('lb.subtitle')}
          right={
            <>
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('lb.search')} className="!w-44 !py-1" />
              <Segmented<Region>
                value={region}
                onChange={setRegion}
                options={[
                  { value: 'all', label: t('lb.all') },
                  { value: 'global', label: t('lb.global') },
                  { value: 'ru', label: t('lb.ru') },
                  { value: 'custom', label: t('lb.custom') }
                ]}
              />
              <Btn size="sm" onClick={() => setAddOpen(true)}>
                <Plus size={13} /> {t('lb.addSite')}
              </Btn>
            </>
          }
        />
        <PanelBody>
          {list.length === 0 && <Empty icon={<Globe2 size={18} />} title={t('common.none')} />}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {list.map((site) => (
              <div key={site.id} className="panel-flat p-3 flex flex-col gap-2">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="display text-[0.88rem] font-semibold text-ink truncate">{site.name}</div>
                    <button
                      onClick={() => onOpen(site.url)}
                      className="mono text-[0.66rem] text-brand hover:underline truncate max-w-full text-left no-drag"
                      title={site.url}
                    >
                      {site.url}
                    </button>
                  </div>
                  {site.own && (
                    <button
                      className="text-ink-3 hover:text-signal no-drag flex-none"
                      title={t('common.delete')}
                      onClick={async () => {
                        try {
                          await api.linkbayRemoveSite(site.id)
                          onReload()
                        } catch (err) {
                          onFail(err)
                        }
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={(KINDS[site.kind] || KINDS.custom).tone}>{t(KINDS[site.kind]?.zh || 'lb.kindCustom')}</Badge>
                  <Badge tone={site.direct ? 'ok' : 'neutral'}>{site.direct ? t('lb.directYes') : t('lb.directNo')}</Badge>
                  <Badge tone={site.risk === 'high' ? 'danger' : 'warn'}>{site.risk === 'high' ? t('lb.riskHigh') : t('lb.riskMid')}</Badge>
                  {SPEEDS[site.speed] && <Badge tone="brand">{t(SPEEDS[site.speed])}</Badge>}
                  {site.region === 'ru' && <Badge tone="neutral">RU</Badge>}
                </div>

                <p className="text-[0.7rem] text-ink-3 leading-relaxed flex-1">{lang === 'en' && site.noteEn ? site.noteEn : site.note}</p>

                <div className="border-t border-line pt-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="tag-plain">{t('lb.links')} · {site.links.length}</span>
                    <button className="text-[0.68rem] text-brand hover:underline no-drag" onClick={() => setEditing(editing === site.id ? null : site.id)}>
                      {t('lb.addLink')}
                    </button>
                  </div>

                  {site.links.length === 0 && <div className="text-[0.68rem] text-ink-3">{t('lb.noLinks')}</div>}

                  {site.links.map((l, i) => (
                    <div key={`${site.id}-${i}`} className="flex items-center gap-2 text-[0.68rem]">
                      <span className="text-ink-2 truncate flex-1" title={l.url}>
                        {l.label}
                      </span>
                      <button className="text-ink-3 hover:text-brand no-drag" title={t('lb.copyUrl')} onClick={() => api.copy(l.url)}>
                        <Copy size={12} />
                      </button>
                      <button className="text-ink-3 hover:text-brand no-drag" title={t('lb.queue')} onClick={() => api.linkbayQueue({ url: l.url, name: l.label, origin: site.id }).catch(onFail)}>
                        <Download size={12} />
                      </button>
                      {l.origin === 'user' && (
                        <button className="text-ink-3 hover:text-signal no-drag" title={t('common.delete')} onClick={() => onDrop(site.id, site.links.filter((x) => x.origin === 'user').indexOf(l))}>
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  ))}

                  {editing === site.id && (
                    <LinkForm
                      onSubmit={(link) => {
                        onSave(site.id, link)
                        setEditing(null)
                      }}
                      onCancel={() => setEditing(null)}
                    />
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Btn size="sm" onClick={() => onOpen(site.url)}>
                    <ArrowUpRight size={12} /> {t('lb.open')}
                  </Btn>
                  <Btn
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      onGoto('extract')
                    }}
                    title={t('lb.extractHint')}
                  >
                    <ScanSearch size={12} /> {t('lb.extract')}
                  </Btn>
                </div>
              </div>
            ))}
          </div>
        </PanelBody>
      </Panel>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={t('lb.addSite')}
        footer={
          <>
            <Btn onClick={() => setAddOpen(false)}>{t('common.cancel')}</Btn>
            <Btn variant="primary" onClick={addSite} disabled={!draft.url}>
              {t('common.save')}
            </Btn>
          </>
        }
      >
        <div className="space-y-3">
          <FieldRow label={t('lb.siteName')}>
            <Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
          </FieldRow>
          <FieldRow label={t('lb.siteUrl')}>
            <Input mono value={draft.url} onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))} placeholder="https://" />
          </FieldRow>
          <FieldRow label={t('lb.siteNote')} hint={t('common.optional')}>
            <Input value={draft.note} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} />
          </FieldRow>
        </div>
      </Modal>

      <MirrorStrip mirrors={mirrors} />
    </div>
  )
}

function LinkForm({ onSubmit, onCancel }: { onSubmit: (l: LinkEntry) => void; onCancel: () => void }) {
  const { t } = useApp()
  const [link, setLink] = useState({ label: '', url: '', note: '' })
  return (
    <div className="mt-2 space-y-2 border border-dashed border-line-2 p-2 bg-surface-2">
      <Input className="!py-1 !text-[0.7rem]" placeholder={t('lb.linkLabel')} value={link.label} onChange={(e) => setLink((l) => ({ ...l, label: e.target.value }))} />
      <Input
        className="!py-1 !text-[0.7rem]"
        mono
        placeholder={t('lb.linkUrl')}
        value={link.url}
        onChange={(e) => setLink((l) => ({ ...l, url: e.target.value }))}
      />
      <Input className="!py-1 !text-[0.7rem]" placeholder={t('lb.linkNote')} value={link.note} onChange={(e) => setLink((l) => ({ ...l, note: e.target.value }))} />
      <div className="flex gap-2">
        <Btn size="sm" variant="primary" onClick={() => onSubmit(link)} disabled={!link.url}>
          {t('common.save')}
        </Btn>
        <Btn size="sm" variant="ghost" onClick={onCancel}>
          {t('common.cancel')}
        </Btn>
      </div>
    </div>
  )
}

/* ==================================================================== */
/* 直链提取                                                              */
/* ==================================================================== */

function ExtractTab({
  mirrors,
  history,
  onFail,
  onReload
}: {
  mirrors: Mirror[]
  history: any[]
  onFail: (e: unknown) => void
  onReload: () => void
}) {
  const { t } = useApp()
  const [url, setUrl] = useState('')
  const [mirror, setMirror] = useState('')
  const [targetDir, setTargetDir] = useState('')
  const [threads, setThreads] = useState(4)
  const [result, setResult] = useState<ExtractResult | null>(null)
  const [running, setRunning] = useState(false)
  const [checked, setChecked] = useState<Record<string, string>>({})

  const run = async () => {
    if (!url.trim()) return
    setRunning(true)
    setResult(null)
    try {
      setResult(await api.linkbayExtract({ url: url.trim(), mirror: mirror || undefined }))
    } catch (err) {
      onFail(err)
    }
    setRunning(false)
  }

  const probe = async (item: ProbeItem) => {
    setChecked((c) => ({ ...c, [item.url]: '…' }))
    try {
      const r = await api.linkbayCheck({ url: item.url })
      setChecked((c) => ({ ...c, [item.url]: r.reachable ? (r.multiThread ? t('lb.checkOk') : t('lb.checkOkSingle')) : t('lb.checkFail') }))
    } catch (_) {
      setChecked((c) => ({ ...c, [item.url]: t('lb.checkFail') }))
    }
  }

  const queue = async (item: ProbeItem) => {
    try {
      await api.linkbayQueue({ url: item.url, mirror: mirror || undefined, saveDir: targetDir || undefined, threads, origin: result?.source })
      onReload()
    } catch (err) {
      onFail(err)
    }
  }

  const total = result?.total || 0

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHead index="12-B" icon={<ScanSearch size={15} />} title={t('lb.extractTitle')} hint={t('lb.extractHint')} />
        <PanelBody className="space-y-3">
          <FieldRow label={t('lb.extractUrl')}>
            <div className="flex gap-2">
              <Input mono value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://steamrip.com/xxx/" onKeyDown={(e) => e.key === 'Enter' && run()} />
              <Btn variant="primary" onClick={run} disabled={running || !url.trim()}>
                <ScanSearch size={13} /> {running ? t('lb.extractRunning') : t('lb.extractRun')}
              </Btn>
            </div>
          </FieldRow>

          <div className="grid gap-3 md:grid-cols-3">
            <FieldRow label={t('lb.fillFrom')}>
              <div className="flex gap-2">
                <Input mono value={targetDir} onChange={(e) => setTargetDir(e.target.value)} placeholder={t('common.optional')} />
                <Btn
                  onClick={async () => {
                    const dir = await api.linkbayPickDir().catch(() => null)
                    if (dir) setTargetDir(dir)
                  }}
                >
                  <FolderOpen size={13} />
                </Btn>
              </div>
            </FieldRow>
            <FieldRow label={t('lb.threads')}>
              <Input type="number" min={1} max={16} value={threads} onChange={(e) => setThreads(Math.max(1, Math.min(16, Number(e.target.value) || 4)))} />
            </FieldRow>
            <FieldRow label={t('lb.mirrorSelect')} hint={t('lb.mirrorHint')}>
              <Select value={mirror} onChange={(e) => setMirror(e.target.value)}>
                <option value="">{t('lb.mirrorNone')}</option>
                {mirrors.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {m.lastMs && m.lastMs > 0 ? ` · ${m.lastMs}ms` : ''}
                  </option>
                ))}
              </Select>
            </FieldRow>
          </div>

          {result && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
              <StatCell label={t('lb.extractCopy')} value={total} />
              <StatCell label={t('lb.extractHosts')} value={(result.hosts || []).length} />
              <StatCell label={t('common.status')} value={result.status} />
              <StatCell label={t('lb.mirrorSelect')} value={mirror ? mirrors.find((m) => m.id === mirror)?.name || mirror : t('lb.mirrorNone')} />
            </div>
          )}
        </PanelBody>
      </Panel>

      {result && (
        <Panel>
          <PanelHead
            index="12-B.2"
            icon={<Link2 size={15} />}
            title={t('lb.extractCopy')}
            hint={t('lb.extractNote')}
            right={
              <div className="flex flex-wrap gap-1.5">
                {(result.hosts || []).slice(0, 6).map((h) => (
                  <Badge key={h.host} tone="neutral">
                    {h.host} × {h.count}
                  </Badge>
                ))}
              </div>
            }
          />
          <PanelBody pad={false}>
            {total === 0 ? (
              <Empty icon={<ScanSearch size={18} />} title={t('lb.extractEmpty')} />
            ) : (
              <div className="divide-y divide-line">
                {result.items.map((item) => (
                  <div key={item.url} className="row items-center gap-3">
                    <Badge tone={item.kind === 'file' ? 'ok' : item.kind === 'magnet' ? 'warn' : 'brand'}>
                      {item.kind === 'file' ? 'FILE' : item.kind.toUpperCase()}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <div className="mono text-[0.7rem] text-ink-2 truncate" title={item.url}>
                        {item.url}
                      </div>
                      <div className="text-[0.66rem] text-ink-3">{item.host}{checked[item.url] ? ` · ${checked[item.url]}` : ''}</div>
                    </div>
                    <Btn size="sm" onClick={() => probe(item)}>
                      <Gauge size={12} /> {t('lb.check')}
                    </Btn>
                    <Btn size="sm" onClick={() => api.copy(item.url)}>
                      <Copy size={12} />
                    </Btn>
                    <Btn size="sm" variant="primary" onClick={() => queue(item)} disabled={item.kind === 'magnet'}>
                      <Download size={12} /> {t('lb.queue')}
                    </Btn>
                  </div>
                ))}
              </div>
            )}
          </PanelBody>
        </Panel>
      )}

      <Panel>
        <PanelHead index="12-B.3" icon={<Zap size={15} />} title={t('lb.history')} />
        <PanelBody pad={false}>
          {history.length === 0 ? (
            <Empty icon={<Zap size={18} />} title={t('lb.historyEmpty')} />
          ) : (
            <div className="divide-y divide-line">
              {history.map((h, i) => (
                <div key={i} className="row items-center gap-3">
                  <Badge tone={h.what === 'patch' ? 'danger' : 'brand'}>{h.what}</Badge>
                  <span className="text-[0.74rem] text-ink-2 truncate flex-1">{h.name}</span>
                  <span className="text-[0.66rem] text-ink-3">{formatRelative(h.at)}</span>
                </div>
              ))}
            </div>
          )}
        </PanelBody>
      </Panel>
    </div>
  )
}

/* ==================================================================== */
/* 补丁源                                                                */
/* ==================================================================== */

function PatchesTab({
  patches,
  onSave,
  onDrop,
  onOpen,
  onReload,
  onFail
}: {
  patches: Patch[]
  onSave: (target: string, link: LinkEntry) => void
  onDrop: (target: string, index: number) => void
  onOpen: (url: string) => void
  onReload: () => void
  onFail: (e: unknown) => void
}) {
  const { t, lang } = useApp()
  const [editing, setEditing] = useState<string | null>(null)
  const [targetDir, setTargetDir] = useState('')
  const [autoUnpack, setAutoUnpack] = useState(false)
  const [working, setWorking] = useState('')

  const fetchPatch = async (patch: Patch) => {
    setWorking(patch.id)
    try {
      const r = await api.linkbayPatchFetch({ id: patch.id, targetDir: targetDir || undefined, extract: autoUnpack })
      if (r.needsLink) {
        onOpen(r.page)
        onFail(new Error(t('lb.patchNeedLink')))
      } else {
        onReload()
      }
    } catch (err) {
      onFail(err)
    }
    setWorking('')
  }

  const label = (kind: string) =>
    kind === 'coop' ? t('lb.patchCoop') : kind === 'nosteam' ? t('lb.patchNoSteam') : kind === 'drm' ? t('lb.patchDrm') : t('lb.patchFile')

  const tone = (kind: string) => (kind === 'coop' ? 'danger' : kind === 'nosteam' ? 'warn' : 'neutral') as 'danger' | 'warn' | 'neutral'

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHead
          index="12-C"
          icon={<ShieldAlert size={15} />}
          title={t('lb.patchTitle')}
          hint={t('lb.patchHint')}
          right={
            <div className="flex items-center gap-3">
              <FieldRow label="" className="!mb-0">
                <div className="flex gap-2">
                  <Input mono className="!py-1 !w-52" value={targetDir} onChange={(e) => setTargetDir(e.target.value)} placeholder={t('lb.fillFrom')} />
                  <Btn
                    size="sm"
                    onClick={async () => {
                      const dir = await api.linkbayPickDir().catch(() => null)
                      if (dir) setTargetDir(dir)
                    }}
                  >
                    <FolderOpen size={12} />
                  </Btn>
                </div>
              </FieldRow>
              <Switch checked={autoUnpack} onChange={setAutoUnpack} label={t('lb.patchExtract')} />
            </div>
          }
        />
        <PanelBody className="space-y-3">
          <RiskBanner
            compact
            title={t('lb.patchCoop') + ' / ' + t('lb.patchNoSteam')}
            body={lang === 'en' ? t('lb.patchHint') : '补丁本体不随程序分发。点下载按钮是把你在下面填的那条直链拉下来，拉完可以自动解包，之后去「接管舱 → 补丁中心」部署到游戏目录并留还原点。来源不明的 dll 有风险，自己确认来源再用。'}
          />

          <div className="grid gap-3 lg:grid-cols-2">
            {patches.map((patch) => (
              <div key={patch.id} className="panel-flat p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="display text-[0.88rem] font-semibold text-ink truncate">{patch.name}</div>
                    {patch.url ? (
                      <button onClick={() => onOpen(patch.url)} className="mono text-[0.66rem] text-brand hover:underline truncate max-w-full text-left no-drag">
                        {patch.url}
                      </button>
                    ) : (
                      <span className="mono text-[0.66rem] text-ink-3">{t('lb.patchNotReady')}</span>
                    )}
                  </div>
                  <Badge tone={tone(patch.kind)}>{label(patch.kind)}</Badge>
                </div>

                <p className="text-[0.7rem] text-ink-3 leading-relaxed">{lang === 'en' && patch.noteEn ? patch.noteEn : patch.note}</p>

                {patch.links.length > 0 && (
                  <div className="space-y-1 border-t border-line pt-2">
                    {patch.links.map((l, i) => (
                      <div key={i} className="flex items-center gap-2 text-[0.68rem]">
                        <FileArchive size={12} className="text-ink-3 flex-none" />
                        <span className="text-ink-2 truncate flex-1" title={l.url}>
                          {l.label}
                        </span>
                        {l.origin === 'user' && (
                          <button className="text-ink-3 hover:text-signal no-drag" onClick={() => onDrop(`patch:${patch.id}`, patch.links.filter((x) => x.origin === 'user').indexOf(l))}>
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Btn size="sm" variant={patch.kind === 'coop' || patch.kind === 'nosteam' ? 'primary' : 'default'} onClick={() => fetchPatch(patch)} disabled={working === patch.id}>
                    <Download size={12} /> {patch.kind === 'coop' ? t('lb.patchCoop') : patch.kind === 'nosteam' ? t('lb.patchNoSteam') : t('lb.patchDownload')}
                  </Btn>
                  {patch.url && (
                    <Btn size="sm" onClick={() => onOpen(patch.url)}>
                      <ArrowUpRight size={12} /> {t('lb.patchOpen')}
                    </Btn>
                  )}
                  <Btn size="sm" variant="ghost" onClick={() => setEditing(editing === patch.id ? null : patch.id)}>
                    <Plus size={12} /> {t('lb.addLink')}
                  </Btn>
                </div>

                {editing === patch.id && (
                  <LinkForm
                    onSubmit={(link) => {
                      onSave(`patch:${patch.id}`, link)
                      setEditing(null)
                    }}
                    onCancel={() => setEditing(null)}
                  />
                )}
              </div>
            ))}
          </div>
        </PanelBody>
      </Panel>
    </div>
  )
}

/* ==================================================================== */
/* 加速线路                                                              */
/* ==================================================================== */

function LinesTab({
  mirrors,
  steamCdn,
  onReload,
  onFail
}: {
  mirrors: Mirror[]
  steamCdn: { id: string; name: string; host: string }[]
  onReload: () => void
  onFail: (e: unknown) => void
}) {
  const { t } = useApp()
  const [probing, setProbing] = useState(false)
  const [ranked, setRanked] = useState<{ id: string; name: string; ms: number }[] | null>(null)
  const [failed, setFailed] = useState<{ id: string; name: string }[]>([])
  const [testUrl, setTestUrl] = useState('')
  const [pick, setPick] = useState('')

  const probe = async () => {
    setProbing(true)
    try {
      const r = await api.linkbayMirrors()
      setRanked(r.ranked || [])
      setFailed(r.failed || [])
      onReload()
    } catch (err) {
      onFail(err)
    }
    setProbing(false)
  }

  const accelerated = testUrl && pick ? `${mirrors.find((m) => m.id === pick)?.prefix || ''}${testUrl.replace(/^https?:\/\//, '')}` : ''

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHead
          index="12-D"
          icon={<Zap size={15} />}
          title={t('lb.linesTitle')}
          hint={t('lb.mirrorHint')}
          right={
            <Btn size="sm" variant="primary" onClick={probe} disabled={probing}>
              <Gauge size={13} /> {probing ? t('lb.mirrorProbing') : t('lb.mirrorProbe')}
            </Btn>
          }
        />
        <PanelBody className="space-y-3">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {mirrors.map((m) => {
              const rank = ranked?.findIndex((r) => r.id === m.id)
              const ms = ranked ? ranked.find((r) => r.id === m.id)?.ms : m.lastMs
              const dead = failed.some((f) => f.id === m.id) || m.lastOk === false
              return (
                <div key={m.id} className="panel-flat p-3 flex items-center gap-3">
                  <span className={cn('w-1.5 h-8 flex-none', dead ? 'bg-signal' : ms && ms > 0 ? 'bg-ok' : 'bg-line-3')} />
                  <div className="min-w-0 flex-1">
                    <div className="mono text-[0.78rem] text-ink truncate">{m.name}</div>
                    <div className="text-[0.66rem] text-ink-3 truncate">{m.note}</div>
                  </div>
                  <div className="text-right flex-none">
                    <div className="mono text-[0.78rem] text-ink-2">{ms && ms > 0 ? `${ms}ms` : dead ? t('lb.mirrorFailed') : '—'}</div>
                    {rank === 0 && <div className="text-[0.62rem] text-ok display">#1</div>}
                  </div>
                  <Btn size="sm" variant="ghost" onClick={() => setPick(m.id)} title={t('lb.pick')}>
                    <Anchor size={12} />
                  </Btn>
                </div>
              )
            })}
          </div>

          <SectionTitle>{t('lb.copyMirror')}</SectionTitle>
          <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
            <Input mono value={testUrl} onChange={(e) => setTestUrl(e.target.value)} placeholder="https://github.com/xxx/releases/download/…" />
            <Select value={pick} onChange={(e) => setPick(e.target.value)} className="md:!w-52">
              <option value="">{t('lb.mirrorNone')}</option>
              {mirrors.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
            <Btn disabled={!accelerated} onClick={() => api.copy(accelerated)}>
              <Copy size={13} /> {t('lb.copyUrl')}
            </Btn>
          </div>
          {accelerated && <div className="mono text-[0.68rem] text-brand break-all">{accelerated}</div>}

          <SectionTitle>{t('lb.steamCdn')}</SectionTitle>
          <p className="text-[0.7rem] text-ink-3 -mt-1 mb-2">{t('lb.steamCdnHint')}</p>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {steamCdn.map((c) => (
              <div key={c.id} className="panel-flat px-3 py-2 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[0.76rem] text-ink truncate">{c.name}</div>
                  <div className="mono text-[0.66rem] text-ink-3 truncate">{c.host}</div>
                </div>
                <Btn size="sm" variant="ghost" onClick={() => api.copy(c.host)}>
                  <Copy size={12} />
                </Btn>
              </div>
            ))}
          </div>

        </PanelBody>
      </Panel>
    </div>
  )
}

function MirrorStrip({ mirrors }: { mirrors: Mirror[] }) {
  const { t } = useApp()
  const [probing, setProbing] = useState(false)
  const [result, setResult] = useState<{ id: string; name: string; ms: number }[] | null>(null)

  const probe = async () => {
    setProbing(true)
    try {
      const r = await api.linkbayMirrors()
      setResult(r.ranked || [])
    } catch (_) {
      /* 静默，主面板会报 */
    }
    setProbing(false)
  }

  const best = result && result[0]

  return (
    <Panel>
      <PanelHead
        index="12-A.2"
        icon={<Zap size={15} />}
        title={t('lb.linesTitle')}
        hint={t('lb.linesHint')}
        right={
          <>
            {best && (
              <Badge tone="ok">
                #1 {best.name} · {best.ms}ms
              </Badge>
            )}
            <Btn size="sm" onClick={probe} disabled={probing}>
              <Gauge size={12} /> {probing ? t('lb.mirrorProbing') : t('lb.mirrorProbe')}
            </Btn>
          </>
        }
      />
      <PanelBody>
        <div className="flex flex-wrap gap-2">
          {mirrors.map((m) => {
            const hit = result?.find((r) => r.id === m.id)
            return (
              <span key={m.id} className="panel-flat px-2.5 py-1.5 flex items-center gap-2">
                <span className={cn('w-1.5 h-1.5 rounded-full', hit ? 'bg-ok' : 'bg-line-3')} />
                <span className="mono text-[0.7rem] text-ink-2">{m.name}</span>
                <span className="mono text-[0.66rem] text-ink-3">{hit ? `${hit.ms}ms` : m.lastMs && m.lastMs > 0 ? `${m.lastMs}ms` : '—'}</span>
              </span>
            )
          })}
        </div>
      </PanelBody>
    </Panel>
  )
}
