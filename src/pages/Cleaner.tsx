import React, { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Eraser, HardDrive, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react'
import { api } from '../lib/bridge'
import { useApp } from '../lib/store'
import { Panel, PanelBody, PanelHead } from '../components/ui/Panel'
import { Btn, Check } from '../components/ui/Controls'
import { Badge, ConfirmBar, Empty, StatCell } from '../components/ui/Feedback'
import { cn, formatBytes } from '../lib/utils'

export default function Cleaner() {
  const { t, pushToast } = useApp()
  const [scan, setScan] = useState<any>(null)
  const [scanning, setScanning] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [result, setResult] = useState<any>(null)

  const doScan = async () => {
    setScanning(true)
    setResult(null)
    try {
      const r = await api.cleanScan()
      setScan(r)
      setSelected((r.items || []).filter((i: any) => i.risk === 'safe').map((i: any) => i.id))
    } catch (err: any) {
      pushToast({ kind: 'error', title: t('common.failed'), body: String(err.message || err) })
    }
    setScanning(false)
  }

  const run = async () => {
    setBusy(true)
    try {
      const r = await api.cleanRun(selected)
      setResult(r)
      pushToast({ kind: 'ok', title: t('clean.finished'), body: `${t('clean.freed')} ${formatBytes(r.freed)}` })
      await doScan()
    } catch (err: any) {
      pushToast({ kind: 'error', title: t('common.failed'), body: String(err.message || err) })
    }
    setConfirm(false)
    setBusy(false)
  }

  const selectedSize = useMemo(
    () => (scan?.items || []).filter((i: any) => selected.includes(i.id)).reduce((n: number, i: any) => n + i.size, 0),
    [scan, selected]
  )

  return (
    <div className="p-5 space-y-4 anim-in">
      <Panel>
        <div className="flex flex-wrap items-center gap-4 p-5">
          <div className="w-12 h-12 flex-none flex items-center justify-center bg-brand text-white border border-brand">
            <Eraser size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="tag-plain mb-1">MODULE 08 / CLEANUP</div>
            <h2 className="display font-bold" style={{ fontSize: 'var(--fs-display)' }}>
              {t('clean.title')}
            </h2>
            <p className="text-[0.75rem] text-ink-3 mt-1">{t('clean.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <Btn onClick={doScan} disabled={scanning}>
              <RefreshCw size={13} className={scanning ? 'animate-spin' : ''} />
              {scanning ? t('clean.scanning') : t('clean.scan')}
            </Btn>
            <Btn variant="primary" onClick={() => setConfirm(true)} disabled={!selected.length || busy}>
              <Trash2 size={13} />
              {t('clean.run')}
            </Btn>
          </div>
        </div>
        {scan && (
          <div className="grid grid-cols-3 border-t border-line divide-x divide-line">
            <div className="px-4 py-3">
              <div className="stat-label mb-1">{t('clean.total')}</div>
              <div className="mono text-[0.9rem] font-bold">{formatBytes(scan.totalSize)}</div>
            </div>
            <div className="px-4 py-3">
              <div className="stat-label mb-1">selected</div>
              <div className="mono text-[0.9rem] font-bold text-brand">{formatBytes(selectedSize)}</div>
            </div>
            <div className="px-4 py-3">
              <div className="stat-label mb-1">items</div>
              <div className="mono text-[0.9rem] font-bold">
                {selected.length} / {scan.items?.length || 0}
              </div>
            </div>
          </div>
        )}
      </Panel>

      {confirm && (
        <ConfirmBar
          text={t('clean.confirmBody')}
          confirmText={t('common.confirm')}
          cancelText={t('common.cancel')}
          tone="danger"
          onConfirm={run}
          onCancel={() => setConfirm(false)}
        />
      )}

      {result && (
        <Panel className="border-l-[3px] border-l-ok">
          <PanelBody className="flex items-center gap-3">
            <CheckCircle2 size={18} className="text-ok flex-none" />
            <span className="text-[0.8rem] text-ink flex-1">
              {t('clean.finished')} · {t('clean.freed')} {formatBytes(result.freed)}
            </span>
            {(result.results || []).map((r: any) => (
              <Badge key={r.id} tone="ok">
                {r.name} · {formatBytes(r.freed)}
              </Badge>
            ))}
          </PanelBody>
        </Panel>
      )}

      <Panel>
        <PanelHead
          index="08-A"
          title={t('clean.title')}
          icon={<HardDrive size={14} />}
          right={
            scan?.items?.length ? (
              <div className="flex items-center gap-2">
                <Btn
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setSelected(
                      selected.length === scan.items.length ? [] : scan.items.map((i: any) => i.id)
                    )
                  }
                >
                  {selected.length === scan.items.length ? t('common.deselectAll') : t('common.selectAll')}
                </Btn>
                <Badge tone="brand">{formatBytes(selectedSize)}</Badge>
              </div>
            ) : null
          }
        />
        <PanelBody pad={false}>
          {scan?.items?.length ? (
            <div className="divide-y divide-line">
              {scan.items.map((item: any) => {
                const on = selected.includes(item.id)
                return (
                  <label
                    key={item.id}
                    className={cn('block px-4 py-3 cursor-pointer transition-colors', on ? 'bg-brand-soft/40' : 'hover:bg-surface-2')}
                  >
                    <div className="flex items-start gap-3">
                      <span className="pt-[2px]">
                        <Check
                          checked={on}
                          onChange={() =>
                            setSelected(on ? selected.filter((x) => x !== item.id) : [...selected, item.id])
                          }
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 flex-wrap">
                          <span className="text-[0.82rem] text-ink font-medium">{item.name}</span>
                          <Badge tone={item.risk === 'safe' ? 'ok' : 'warn'}>
                            {item.risk === 'safe' ? (
                              <>
                                <ShieldCheck size={10} />
                                {t('clean.riskSafe')}
                              </>
                            ) : (
                              <>
                                <AlertTriangle size={10} />
                                {t('clean.riskMedium')}
                              </>
                            )}
                          </Badge>
                          <span className="mono text-[0.72rem] text-ink-2 ml-auto">{formatBytes(item.size)}</span>
                        </span>
                        <span className="block text-[0.7rem] text-ink-3 leading-relaxed mt-1">{item.desc}</span>
                        <span className="block mono text-[0.64rem] text-ink-3/80 mt-1 break-all">
                          {item.path} · {item.files} {t('clean.files')}
                        </span>
                      </span>
                    </div>
                  </label>
                )
              })}
            </div>
          ) : (
            <Empty icon={<HardDrive size={18} />} title={t('clean.empty')} hint={t('clean.subtitle')} />
          )}
        </PanelBody>
      </Panel>

      <div className="flex items-start gap-2.5 px-4 py-3 border border-line bg-surface-panel">
        <ShieldCheck size={15} className="text-brand flex-none mt-[1px]" />
        <span className="text-[0.72rem] text-ink-2 leading-relaxed">
          {t('clean.confirmBody')}
        </span>
      </div>
    </div>
  )
}
