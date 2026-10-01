import React, { useEffect, useMemo, useState } from 'react'
import { Blocks, Copy, FileCode2, Play, Plus, Save, Terminal, Trash2 } from 'lucide-react'
import { api } from '../lib/bridge'
import { useApp } from '../lib/store'
import { Panel, PanelBody, PanelHead, SectionTitle } from '../components/ui/Panel'
import { Btn, FieldRow, Input, Textarea } from '../components/ui/Controls'
import { Badge, Empty, KV } from '../components/ui/Feedback'
import { cn, formatRelative } from '../lib/utils'

export default function ScriptStudio() {
  const { t, lang, pushToast } = useApp()
  const [scripts, setScripts] = useState<any[]>([])
  const [currentId, setCurrentId] = useState<string>('')
  const [draft, setDraft] = useState({ name: '', description: '', code: '' })
  const [output, setOutput] = useState<string[]>([])
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<any>(null)

  const current = useMemo(() => scripts.find((s) => s.id === currentId), [scripts, currentId])
  const isSample = !!current?.builtin

  const load = async (keep?: string) => {
    try {
      const r = await api.scriptList()
      setScripts(r.scripts || [])
      const id = keep || currentId || r.scripts?.[0]?.id
      if (id) {
        setCurrentId(id)
        const s = (r.scripts || []).find((x: any) => x.id === id)
        if (s) setDraft({ name: s.name, description: s.description || '', code: s.code })
      }
    } catch (err: any) {
      pushToast({ kind: 'error', title: t('common.failed'), body: String(err.message || err) })
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const select = (s: any) => {
    setCurrentId(s.id)
    setDraft({ name: s.name, description: s.description || '', code: s.code })
    setOutput([])
    setResult(null)
  }

  const saveAsMine = async () => {
    try {
      const r = await api.scriptSave({ name: draft.name, description: draft.description, code: draft.code })
      const list = r.scripts || []
      setScripts(list)
      const mine = list.find((s: any) => s.name === draft.name && !s.builtin)
      if (mine) setCurrentId(mine.id)
      pushToast({ kind: 'ok', title: t('common.saved') })
    } catch (err: any) {
      pushToast({ kind: 'error', title: t('common.failed'), body: String(err.message || err) })
    }
  }

  const newScript = async () => {
    try {
      const r = await api.scriptSave({ name: lang === 'zh' ? '新脚本' : 'New script', description: '', code: 'console.log("hello");\nreturn 1;' })
      const list = r.scripts || []
      setScripts(list)
      const mine = list.find((s: any) => !s.builtin && s.name === (lang === 'zh' ? '新脚本' : 'New script'))
      if (mine) select(mine)
      else if (list.length) select(list[list.length - 1])
    } catch (err: any) {
      pushToast({ kind: 'error', title: t('common.failed'), body: String(err.message || err) })
    }
  }

  const run = async () => {
    if (!currentId) return
    if (isSample) {
      pushToast({ kind: 'warn', title: t('script.sampleReadonly') })
    }
    setRunning(true)
    setOutput([])
    setResult(null)
    try {
      const r = await api.scriptRun(currentId)
      setOutput(r.output || [])
      setResult(r)
    } catch (err: any) {
      setOutput([`[error] ${String(err.message || err)}`])
    }
    setRunning(false)
  }

  return (
    <div className="p-5 space-y-4 anim-in">
      <Panel>
        <div className="flex flex-wrap items-center gap-4 p-5">
          <div className="w-12 h-12 flex-none flex items-center justify-center bg-brand text-white border border-brand">
            <Blocks size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="tag-plain mb-1">MODULE 07 / SCRIPT</div>
            <h2 className="display font-bold" style={{ fontSize: 'var(--fs-display)' }}>
              {t('script.title')}
            </h2>
            <p className="text-[0.75rem] text-ink-3 mt-1">{t('script.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <Btn onClick={newScript}>
              <Plus size={13} />
              {t('script.new')}
            </Btn>
            <Btn variant="primary" onClick={run} disabled={running || !currentId}>
              <Play size={13} />
              {t('script.run')}
            </Btn>
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-12 gap-4">
        <Panel className="col-span-12 lg:col-span-3">
          <PanelHead index="07-A" title={t('script.list')} icon={<FileCode2 size={14} />} />
          <PanelBody pad={false}>
            <div className="divide-y divide-line max-h-[440px] overflow-y-auto">
              {scripts.map((s) => (
                <button
                  key={s.id}
                  onClick={() => select(s)}
                  className={cn(
                    'w-full text-left px-4 py-2.5 no-drag transition-colors',
                    currentId === s.id ? 'bg-brand-soft' : 'hover:bg-surface-2'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[0.78rem] text-ink truncate flex-1">{s.name}</span>
                    {s.builtin && <Badge>sample</Badge>}
                  </div>
                  <div className="text-[0.66rem] text-ink-3 truncate mt-0.5">
                    {s.description || formatRelative(s.createdAt, lang)}
                  </div>
                </button>
              ))}
            </div>
          </PanelBody>
        </Panel>

        <Panel className="col-span-12 lg:col-span-6">
          <PanelHead
            index="07-B"
            title={t('script.editor')}
            icon={<Terminal size={14} />}
            right={
              <div className="flex items-center gap-2">
                {isSample && <Badge tone="warn">{t('script.sampleReadonly')}</Badge>}
                {!isSample && (
                  <>
                    <Btn size="sm" onClick={saveAsMine}>
                      <Save size={12} />
                      {t('common.save')}
                    </Btn>
                    <Btn
                      size="sm"
                      variant="danger"
                      onClick={async () => {
                        const r = await api.scriptRemove(currentId)
                        setScripts(r.scripts || [])
                        setCurrentId('')
                        setDraft({ name: '', description: '', code: '' })
                      }}
                    >
                      <Trash2 size={12} />
                    </Btn>
                  </>
                )}
                {isSample && (
                  <Btn size="sm" variant="primary" onClick={saveAsMine}>
                    <Copy size={12} />
                    {lang === 'zh' ? '另存为我的脚本' : 'Save as mine'}
                  </Btn>
                )}
              </div>
            }
          />
          <PanelBody className="space-y-3">
            <FieldRow label={t('common.name')}>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                disabled={isSample}
              />
            </FieldRow>
            <FieldRow label={t('lib.description')} hint={t('common.optional')}>
              <Input
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                disabled={isSample}
              />
            </FieldRow>
            <FieldRow label="code">
              <Textarea
                rows={16}
                spellCheck={false}
                value={draft.code}
                onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                disabled={isSample}
                readOnly={isSample}
                className="field-mono text-[0.72rem] leading-relaxed"
                style={{ background: '#08182c', color: '#cfe2ff', borderColor: '#16325c' }}
              />
            </FieldRow>
            <p className="text-[0.68rem] text-ink-3 leading-relaxed">{t('script.hint')}</p>
          </PanelBody>
        </Panel>

        <Panel className="col-span-12 lg:col-span-3">
          <PanelHead
            index="07-C"
            title={t('script.output')}
            icon={<Terminal size={14} />}
            right={<Btn size="sm" variant="ghost" onClick={() => { setOutput([]); setResult(null) }}>{t('common.clear')}</Btn>}
          />
          <PanelBody pad={false}>
            <div className="code rounded-none border-0 min-h-[200px] max-h-[360px] overflow-y-auto">
              {running ? (
                <div className="opacity-70">// running…</div>
              ) : output.length ? (
                output.map((line, i) => (
                  <div key={i} className="whitespace-pre-wrap break-all">
                    {line}
                  </div>
                ))
              ) : (
                <div className="opacity-60">// {t('common.none')}</div>
              )}
            </div>
            {result && (
              <div className="p-4 border-t border-line">
                <SectionTitle>result</SectionTitle>
                <KV k="duration" v={`${result.durationMs ?? 0} ms`} mono />
                {result.error && <KV k="error" v={<span className="text-signal">{result.error}</span>} />}
              </div>
            )}
          </PanelBody>
        </Panel>
      </div>
    </div>
  )
}
