import React, { useEffect, useState } from 'react'
import { Download, FolderOpen, HardDrive, PackageOpen, Pause, Play, Plus, Trash2, X } from 'lucide-react'
import { api } from '../lib/bridge'
import { useApp } from '../lib/store'
import { Panel, PanelBody, PanelHead, SectionTitle } from '../components/ui/Panel'
import { Btn, FieldRow, Input } from '../components/ui/Controls'
import { Badge, Empty, KV, Progress, StatCell, type Tone } from '../components/ui/Feedback'
import { cn, formatBytes, formatDuration, formatSpeed } from '../lib/utils'

export default function Downloads() {
  const { t, pushToast, config } = useApp()
  const [tasks, setTasks] = useState<any[]>([])
  const [form, setForm] = useState({ url: '', name: '', saveDir: '', threads: 4 })
  const [showForm, setShowForm] = useState(false)

  const load = async () => {
    try {
      setTasks(await api.dlList())
    } catch (_) {
      /* 忽略 */
    }
  }

  useEffect(() => {
    load()
    setForm((f) => ({ ...f, saveDir: config?.download?.saveDir || '', threads: config?.download?.concurrency || 4 }))
    const off = api.on('dl:progress', (list: any[]) => setTasks(list))
    const timer = setInterval(load, 4000)
    return () => {
      off && off()
      clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config])

  const start = async () => {
    if (!form.url.trim()) return
    try {
      await api.dlStart({
        url: form.url.trim(),
        name: form.name.trim() || undefined,
        saveDir: form.saveDir || undefined,
        threads: Number(form.threads) || 4
      })
      setForm({ ...form, url: '', name: '' })
      setShowForm(false)
      pushToast({ kind: 'ok', title: t('dl.start') })
      load()
    } catch (err: any) {
      pushToast({ kind: 'error', title: t('common.failed'), body: String(err.message || err) })
    }
  }

  const extractTask = async (task: { filePath?: string; saveDir?: string }) => {
    if (!task.filePath) return
    try {
      const info = await api.dlArchiveInfo(task.filePath)
      if (!info.canExtract) {
        pushToast({ kind: 'warn', title: t('dl.extractUnsupported'), body: t('dl.extractHint') })
        return
      }
      pushToast({ kind: 'info', title: t('dl.extracting'), body: task.filePath })
      const r = await api.dlExtract(task.filePath)
      pushToast({ kind: 'ok', title: t('dl.extractDone'), body: r.targetDir })
    } catch (err) {
      pushToast({
        kind: 'error',
        title: t('common.failed'),
        body: String(err instanceof Error ? err.message : err)
      })
    }
  }

  const pickDir = async () => {
    const dir = await api.libPickDir().catch(() => null)
    if (dir) setForm({ ...form, saveDir: dir })
  }

  const safeTasks = Array.isArray(tasks) ? tasks : []
  const running = safeTasks.filter((d) => d.status === 'running')
  const totalSpeed = running.reduce((n, d) => n + (d.speed || 0), 0)

  const toneOf = (status: string): Tone =>
    status === 'done' ? 'ok' : status === 'running' ? 'brand' : status === 'error' ? 'danger' : status === 'paused' ? 'warn' : 'neutral'

  return (
    <div className="p-5 space-y-4 anim-in">
      <Panel>
        <div className="flex flex-wrap items-center gap-4 p-5">
          <div className="w-12 h-12 flex-none flex items-center justify-center bg-brand text-white border border-brand">
            <Download size={20} />
          </div>
          <div className="min-w-0">
            <div className="tag-plain mb-1">MODULE 04 / DOWNLOADS</div>
            <h2 className="display font-bold" style={{ fontSize: 'var(--fs-display)' }}>
              {t('dl.title')}
            </h2>
            <p className="text-[0.75rem] text-ink-3 mt-1">{t('dl.subtitle')}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Badge tone={running.length ? 'brand' : 'neutral'}>
              {running.length} {t('common.running')}
            </Badge>
            <Badge>{formatSpeed(totalSpeed)}</Badge>
            <Btn variant="primary" onClick={() => setShowForm((s) => !s)}>
              <Plus size={13} />
              {t('dl.new')}
            </Btn>
          </div>
        </div>
      </Panel>

      {showForm && (
        <Panel>
          <PanelHead index="04-A" title={t('dl.new')} icon={<Plus size={14} />} />
          <PanelBody className="space-y-3">
            <FieldRow label={t('dl.url')} hint={t('common.required')}>
              <Input
                mono
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && start()}
                placeholder="https://…"
              />
            </FieldRow>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <FieldRow label={t('dl.filename')} hint={t('common.optional')}>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </FieldRow>
              <FieldRow label={t('dl.threads')}>
                <Input
                  type="number"
                  min={1}
                  max={16}
                  value={form.threads}
                  onChange={(e) => setForm({ ...form, threads: Number(e.target.value) })}
                />
              </FieldRow>
              <FieldRow label={t('dl.saveDir')}>
                <div className="flex gap-2">
                  <Input mono value={form.saveDir} onChange={(e) => setForm({ ...form, saveDir: e.target.value })} />
                  <Btn onClick={pickDir} className="flex-none">
                    <FolderOpen size={13} />
                  </Btn>
                </div>
              </FieldRow>
            </div>
            <div className="flex justify-end gap-2">
              <Btn variant="ghost" onClick={() => setShowForm(false)}>
                {t('common.cancel')}
              </Btn>
              <Btn variant="primary" onClick={start}>
                <Play size={12} />
                {t('dl.start')}
              </Btn>
            </div>
          </PanelBody>
        </Panel>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCell label={t('dl.title')} value={safeTasks.length} />
        <StatCell label={t('common.running')} value={running.length} tone={running.length ? 'brand' : 'neutral'} />
        <StatCell label={t('dl.speed')} value={formatSpeed(totalSpeed)} tone={totalSpeed ? 'ok' : 'neutral'} />
        <StatCell
          label={t('common.done')}
          value={safeTasks.filter((d) => d.status === 'done').length}
          sub={formatBytes(safeTasks.filter((d) => d.status === 'done').reduce((n, d) => n + (d.total || 0), 0))}
        />
      </div>

      <Panel>
        <PanelHead index="04-B" title={t('dl.title')} icon={<HardDrive size={14} />} />
        <PanelBody pad={false}>
          {safeTasks.length ? (
            <div className="divide-y divide-line">
              {safeTasks.map((d) => (
                <div key={d.id} className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.8rem] text-ink truncate">{d.name}</span>
                      <span className="block mono text-[0.66rem] text-ink-3 truncate">{d.url}</span>
                    </span>
                    <Badge tone={toneOf(d.status)}>
                      {d.status === 'done'
                        ? t('common.done')
                        : d.status === 'running'
                        ? t('common.running')
                        : d.status === 'paused'
                        ? t('common.paused')
                        : d.status === 'merging'
                        ? t('common.merging')
                        : d.status}
                    </Badge>
                  </div>

                  <div className="mt-2.5">
                    <Progress
                      value={d.percent}
                      tone={d.status === 'done' ? 'ok' : d.status === 'error' ? 'danger' : 'brand'}
                    />
                    <div className="flex items-center gap-4 mt-1.5 text-[0.66rem] text-ink-3 mono">
                      <span>{d.percent?.toFixed(1)}%</span>
                      <span>
                        {formatBytes(d.received)} / {formatBytes(d.total)}
                      </span>
                      <span>{formatSpeed(d.speed || 0)}</span>
                      {d.status === 'running' && d.eta > 0 && <span>{t('dl.eta')} {formatDuration(d.eta)}</span>}
                      <span className="ml-auto">{d.threads} threads</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-2.5">
                    {d.status === 'running' ? (
                      <Btn size="sm" onClick={async () => setTasks(await api.dlPause(d.id))}>
                        <Pause size={11} />
                        {t('dl.pause')}
                      </Btn>
                    ) : d.status === 'paused' || d.status === 'error' ? (
                      <Btn size="sm" onClick={async () => setTasks(await api.dlResume(d.id))}>
                        <Play size={11} />
                        {t('dl.resume')}
                      </Btn>
                    ) : null}
                    {d.filePath && (
                      <Btn size="sm" variant="ghost" onClick={() => api.openFolder(d.saveDir).catch(() => {})}>
                        <FolderOpen size={11} />
                        {t('common.openFolder')}
                      </Btn>
                    )}
                    {d.status === 'done' && d.filePath && /\.(zip|7z|rar|tar|gz|tgz|xz|bz2)$/i.test(d.filePath) && (
                      <Btn size="sm" onClick={() => extractTask(d)}>
                        <PackageOpen size={11} />
                        {t('dl.extract')}
                      </Btn>
                    )}
                    <span className="flex-1" />
                    <Btn size="sm" variant="danger" onClick={async () => setTasks(await api.dlCancel(d.id))}>
                      <X size={11} />
                      {t('dl.cancel')}
                    </Btn>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty icon={<Download size={18} />} title={t('dl.empty')} hint={t('dl.subtitle')} />
          )}
        </PanelBody>
      </Panel>
    </div>
  )
}
