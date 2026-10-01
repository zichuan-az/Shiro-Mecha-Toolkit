import React, { useEffect, useState } from 'react'
import { AlertTriangle, Archive, FileCheck2, FolderOpen, Info, Plus, Rocket, ScanLine, ShieldAlert, Trash2 } from 'lucide-react'
import { api } from '../lib/bridge'
import { useApp } from '../lib/store'
import { Panel, PanelBody, PanelHead, SectionTitle } from '../components/ui/Panel'
import { Btn, FieldRow, Input } from '../components/ui/Controls'
import { Badge, Empty, KV, Modal } from '../components/ui/Feedback'
import { formatBytes, formatRelative } from '../lib/utils'

export default function Patcher() {
  const { t, lang, pushToast } = useApp()
  const [guide, setGuide] = useState<any>(null)
  const [entries, setEntries] = useState<any[]>([])
  const [candidates, setCandidates] = useState<any[]>([])
  const [scanning, setScanning] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ name: '', gameName: '', sourcePath: '', targetDir: '', args: '', note: '' })
  const [deployResult, setDeployResult] = useState<any>(null)
  const [deploying, setDeploying] = useState<any>(null)

  const load = async () => {
    try {
      setGuide(await api.patchGuide())
    } catch (_) {
      /* 忽略 */
    }
    try {
      const r = await api.patchScan()
      setCandidates(r.candidates || [])
    } catch (_) {
      /* 忽略 */
    }
  }

  useEffect(() => {
    ;(async () => {
      await load()
      try {
        const r = await api.patchList()
        setEntries(r.entries || [])
      } catch (_) {
        /* 忽略 */
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const scan = async () => {
    setScanning(true)
    try {
      const r = await api.patchScan()
      setCandidates(r.candidates || [])
    } catch (err: any) {
      pushToast({ kind: 'error', title: t('common.failed'), body: String(err.message || err) })
    }
    setScanning(false)
  }

  const pickSource = async () => {
    const p = await api.sysPickFile().catch(() => null)
    if (p) setForm((f) => ({ ...f, sourcePath: p }))
  }

  const pickTarget = async () => {
    const p = await api.libPickDir().catch(() => null)
    if (p) setForm((f) => ({ ...f, targetDir: p }))
  }

  const save = async () => {
    try {
      const r = await api.patchAdd(form)
      setEntries(r.entries || [])
      setAddOpen(false)
      setForm({ name: '', gameName: '', sourcePath: '', targetDir: '', args: '', note: '' })
      pushToast({ kind: 'ok', title: t('common.saved') })
    } catch (err: any) {
      pushToast({ kind: 'error', title: t('common.failed'), body: String(err.message || err) })
    }
  }

  const deploy = async (entry: any) => {
    let dir = entry.targetDir
    if (!dir) {
      dir = (await api.libPickDir().catch(() => null)) || ''
      if (!dir) return
    }
    setDeploying(entry)
    try {
      const r = await api.patchDeploy(entry.id, dir)
      setDeployResult(r)
    } catch (err: any) {
      pushToast({ kind: 'error', title: t('common.failed'), body: String(err.message || err) })
    }
    setDeploying(null)
  }

  return (
    <div className="p-5 space-y-4 anim-in">
      <Panel>
        <div className="flex flex-wrap items-center gap-4 p-5">
          <div className="w-12 h-12 flex-none flex items-center justify-center bg-brand text-white border border-brand">
            <Archive size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="tag-plain mb-1">MODULE 06 / PORTABLE</div>
            <h2 className="display font-bold" style={{ fontSize: 'var(--fs-display)' }}>
              {t('patch.title')}
            </h2>
            <p className="text-[0.75rem] text-ink-3 mt-1">{t('patch.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="warn">{entries.length} configs</Badge>
            <Btn variant="primary" onClick={() => setAddOpen(true)}>
              <Plus size={13} />
              {t('patch.addEntry')}
            </Btn>
          </div>
        </div>
      </Panel>

      {/* 免责说明：显著但不刺眼 */}
      <div className="flex items-start gap-3 px-4 py-3 border border-[rgba(201,132,16,0.35)] bg-warn-soft">
        <ShieldAlert size={16} className="text-warn flex-none mt-[1px]" />
        <div className="min-w-0">
          <div className="text-[0.78rem] font-medium text-ink mb-1">{t('patch.disclaimer')}</div>
          <div className="text-[0.72rem] text-ink-2 leading-relaxed">{guide?.disclaimer}</div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <Panel className="col-span-12 xl:col-span-7">
          <PanelHead
            index="06-A"
            title={t('patch.entries')}
            icon={<FileCheck2 size={14} />}
            right={
              <Btn size="sm" onClick={() => setAddOpen(true)}>
                <Plus size={12} />
                {t('common.add')}
              </Btn>
            }
          />
          <PanelBody pad={false}>
            {entries.length ? (
              <div className="divide-y divide-line">
                {entries.map((e) => (
                  <div key={e.id} className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="min-w-0 flex-1">
                        <span className="block text-[0.8rem] text-ink truncate">{e.name}</span>
                        <span className="block text-[0.68rem] text-ink-3 truncate">
                          {e.gameName || '—'} · {formatRelative(e.createdAt, lang)}
                        </span>
                      </span>
                      <Btn size="sm" variant="primary" onClick={() => deploy(e)} disabled={deploying?.id === e.id}>
                        <Rocket size={12} />
                        {t('patch.deploy')}
                      </Btn>
                      <button
                        onClick={async () => {
                          const r = await api.patchRemove(e.id)
                          setEntries(r.entries || [])
                        }}
                        className="text-ink-3 hover:text-signal no-drag flex-none"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <div className="mt-2">
                      <KV k="source" v={<span className="mono text-[0.68rem] break-all">{e.sourcePath}</span>} />
                      {e.targetDir && <KV k="target" v={<span className="mono text-[0.68rem] break-all">{e.targetDir}</span>} />}
                      {e.args && <KV k="args" v={<span className="mono text-[0.68rem]">{e.args}</span>} />}
                      {e.note && <KV k={t('steam.accNote')} v={e.note} />}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty icon={<Archive size={18} />} title={t('patch.empty')} hint={t('patch.subtitle')} />
            )}
            {deployResult && (
              <div className="p-4 border-t border-line bg-ok-soft">
                <div className="text-[0.76rem] text-ink mb-1.5 mono">{deployResult.target}</div>
                {deployResult.actions?.map((a: string, i: number) => (
                  <div key={i} className="text-[0.7rem] text-ink-2 mono py-0.5">
                    › {a}
                  </div>
                ))}
              </div>
            )}
          </PanelBody>
        </Panel>

        <div className="col-span-12 xl:col-span-5 space-y-4">
          <Panel>
            <PanelHead index="06-B" title={t('patch.guide')} icon={<Info size={14} />} />
            <PanelBody>
              <div className="space-y-3">
                {(guide?.steps || []).map((s: any, i: number) => (
                  <div key={i} className="flex gap-3">
                    <span className="w-6 h-6 flex-none flex items-center justify-center bg-brand-soft text-brand border border-[rgba(30,95,209,0.22)] mono text-[0.66rem]">
                      {i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[0.78rem] text-ink font-medium">{s.title}</span>
                      <span className="block text-[0.7rem] text-ink-3 leading-relaxed mt-0.5">{s.detail}</span>
                    </span>
                  </div>
                ))}
              </div>
              {guide?.notes?.length > 0 && (
                <div className="mt-4 pt-3 border-t border-line">
                  {guide.notes.map((n: string, i: number) => (
                    <div key={i} className="flex gap-2 text-[0.7rem] text-ink-3 leading-relaxed py-0.5">
                      <span className="text-brand flex-none">·</span>
                      <span>{n}</span>
                    </div>
                  ))}
                </div>
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHead
              index="06-C"
              title={t('patch.scan')}
              hint={t('patch.scanHint')}
              icon={<ScanLine size={14} />}
              right={
                <Btn size="sm" onClick={scan} disabled={scanning}>
                  <ScanLine size={12} className={scanning ? 'animate-pulse' : ''} />
                  {t('common.scan')}
                </Btn>
              }
            />
            <PanelBody pad={false}>
              {candidates.length ? (
                <div className="max-h-[260px] overflow-y-auto divide-y divide-line">
                  {candidates.map((c: any) => (
                    <div key={c.dir}>
                      <div className="px-4 py-2 bg-surface-2 flex items-center gap-2">
                        <FolderOpen size={12} className="text-ink-3" />
                        <span className="text-[0.7rem] text-ink-2 truncate flex-1">{c.dir}</span>
                        <Badge>{c.label}</Badge>
                      </div>
                      {c.files.map((f: any) => (
                        <button
                          key={f.path}
                          onClick={() => {
                            setForm({
                              name: f.name,
                              gameName: '',
                              sourcePath: f.path,
                              targetDir: '',
                              args: '',
                              note: ''
                            })
                            setAddOpen(true)
                          }}
                          className="w-full flex items-center gap-3 px-4 py-1.5 hover:bg-surface-2 no-drag text-left"
                        >
                          <span className="mono text-[0.7rem] text-ink truncate flex-1">{f.name}</span>
                          <span className="mono text-[0.64rem] text-ink-3 flex-none">{formatBytes(f.size)}</span>
                          <Plus size={11} className="text-ink-3 flex-none" />
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <Empty icon={<ScanLine size={17} />} title={t('common.none')} hint={t('patch.scanHint')} />
              )}
            </PanelBody>
          </Panel>
        </div>
      </div>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={t('patch.addEntry')}
        footer={
          <>
            <Btn onClick={() => setAddOpen(false)}>{t('common.cancel')}</Btn>
            <Btn variant="primary" onClick={save}>
              {t('common.save')}
            </Btn>
          </>
        }
      >
        <div className="space-y-3">
          <FieldRow label={t('patch.entryName')} hint={t('common.required')}>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </FieldRow>
          <FieldRow label={t('patch.gameName')} hint={t('common.optional')}>
            <Input value={form.gameName} onChange={(e) => setForm({ ...form, gameName: e.target.value })} />
          </FieldRow>
          <FieldRow label={t('patch.sourcePath')} hint={t('common.required')}>
            <div className="flex gap-2">
              <Input mono value={form.sourcePath} onChange={(e) => setForm({ ...form, sourcePath: e.target.value })} />
              <Btn onClick={pickSource} className="flex-none">
                <FolderOpen size={13} />
              </Btn>
            </div>
          </FieldRow>
          <FieldRow label={t('patch.targetDir')} hint={t('common.optional')}>
            <div className="flex gap-2">
              <Input mono value={form.targetDir} onChange={(e) => setForm({ ...form, targetDir: e.target.value })} />
              <Btn onClick={pickTarget} className="flex-none">
                <FolderOpen size={13} />
              </Btn>
            </div>
          </FieldRow>
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label={t('patch.args')} hint={t('common.optional')}>
              <Input mono value={form.args} onChange={(e) => setForm({ ...form, args: e.target.value })} />
            </FieldRow>
            <FieldRow label={t('patch.note')} hint={t('common.optional')}>
              <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </FieldRow>
          </div>
          <div className="flex items-start gap-2.5 px-3 py-2 bg-warn-soft border border-[rgba(201,132,16,0.3)]">
            <AlertTriangle size={14} className="text-warn flex-none mt-[1px]" />
            <span className="text-[0.7rem] text-ink-2 leading-relaxed">{guide?.disclaimer}</span>
          </div>
        </div>
      </Modal>
    </div>
  )
}
