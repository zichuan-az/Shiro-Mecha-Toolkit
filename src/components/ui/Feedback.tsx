import React, { useEffect } from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { cn, formatBytes } from '../../lib/utils'
import { useApp } from '../../lib/store'
import { Btn } from './Controls'

/* ------------------------------ 状态灯 ------------------------------ */

export function Lamp({ state = 'off' }: { state?: 'on' | 'off' | 'warn' | 'error' }) {
  return <span className={cn('lamp', state === 'on' && 'lamp-on', state === 'warn' && 'lamp-warn', state === 'error' && 'lamp-error', state === 'off' && 'lamp-off')} />
}

/* ------------------------------ 徽标 ------------------------------ */

export type Tone = 'neutral' | 'brand' | 'ok' | 'warn' | 'danger'

export function Badge({
  children,
  tone = 'neutral',
  className
}: {
  children: React.ReactNode
  tone?: Tone
  className?: string
}) {
  const tones: Record<Tone, string> = {
    neutral: 'bg-surface-3 text-ink-2 border-line-2',
    brand: 'bg-brand-soft text-brand border-[rgba(30,95,209,0.25)]',
    ok: 'bg-ok-soft text-ok border-[rgba(18,148,106,0.28)]',
    warn: 'bg-warn-soft text-warn border-[rgba(201,132,16,0.3)]',
    danger: 'bg-signal-soft text-signal border-[rgba(228,71,77,0.3)]'
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-[1px] text-[0.65rem] font-medium border rounded-[1px] whitespace-nowrap',
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  )
}

/* ------------------------------ 进度条 ------------------------------ */

export function Progress({
  value,
  className,
  tone = 'brand',
  showTrack = true
}: {
  value: number
  className?: string
  tone?: 'brand' | 'ok' | 'danger' | 'warn'
  showTrack?: boolean
}) {
  const colors = { brand: 'bg-brand', ok: 'bg-ok', danger: 'bg-signal', warn: 'bg-warn' }
  return (
    <div className={cn('h-[6px] w-full rounded-[1px] overflow-hidden', showTrack && 'bg-surface-sunken border border-line', className)}>
      <div
        className={cn('h-full transition-[width] duration-500 ease-smooth', colors[tone])}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  )
}

/* ------------------------------ 空状态 ------------------------------ */

export function Empty({ icon, title, hint }: { icon?: React.ReactNode; title: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="w-11 h-11 flex items-center justify-center border border-dashed border-line-2 text-ink-3 mb-3">
        {icon || <Info size={18} />}
      </div>
      <div className="text-[0.85rem] text-ink-2">{title}</div>
      {hint && <div className="text-[0.72rem] text-ink-3 mt-1 max-w-sm leading-relaxed">{hint}</div>}
    </div>
  )
}

/* ------------------------------ 弹窗 ------------------------------ */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 'max-w-lg'
}: {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  children?: React.ReactNode
  footer?: React.ReactNode
  width?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 no-drag">
      <div className="absolute inset-0 bg-[rgba(10,26,47,0.32)] backdrop-blur-[2px]" onClick={onClose} />
      <div className={cn('relative w-full panel corners anim-in', width)}>
        <div className="panel-head">
          <span className="display text-[0.9rem] font-semibold">{title}</span>
          <span className="flex-1" />
          <button onClick={onClose} className="text-ink-3 hover:text-ink p-0.5">
            <X size={15} />
          </button>
        </div>
        <div className="p-4 max-h-[62vh] overflow-auto">{children}</div>
        {footer && <div className="flex justify-end gap-2 px-4 py-3 border-t border-line bg-surface-2">{footer}</div>}
      </div>
    </div>
  )
}

/* ------------------------------ 全局提示 ------------------------------ */

export function Toasts() {
  const { toasts, dismissToast } = useApp()
  if (!toasts.length) return null

  const icons = {
    info: <Info size={15} className="text-brand" />,
    ok: <CheckCircle2 size={15} className="text-ok" />,
    warn: <AlertTriangle size={15} className="text-warn" />,
    error: <XCircle size={15} className="text-signal" />
  }

  return (
    <div className="fixed bottom-10 right-4 z-[60] flex flex-col gap-2 w-[320px] no-drag">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="panel corners anim-in px-3 py-2.5 flex items-start gap-2.5 shadow-md"
          style={{ borderLeft: '3px solid var(--blue)' }}
        >
          <span className="mt-[1px] flex-none">{icons[t.kind]}</span>
          <div className="min-w-0 flex-1">
            <div className="text-[0.8rem] font-medium text-ink">{t.title}</div>
            {t.body && <div className="text-[0.7rem] text-ink-3 mt-1 leading-relaxed break-words">{t.body}</div>}
          </div>
          <button onClick={() => dismissToast(t.id)} className="text-ink-3 hover:text-ink flex-none p-0.5">
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------ 确认条 ------------------------------ */

export function ConfirmBar({
  text,
  onConfirm,
  onCancel,
  confirmText,
  cancelText,
  tone = 'brand'
}: {
  text: React.ReactNode
  onConfirm: () => void
  onCancel: () => void
  confirmText: string
  cancelText: string
  tone?: 'brand' | 'danger'
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 border border-line-2 bg-surface-2 rounded-sm">
      <span className="text-[0.78rem] text-ink-2 flex-1 min-w-0">{text}</span>
      <Btn size="sm" variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm}>
        {confirmText}
      </Btn>
      <Btn size="sm" variant="ghost" onClick={onCancel}>
        {cancelText}
      </Btn>
    </div>
  )
}

/** 键值对行 */
export function KV({ k, v, mono, className }: { k: React.ReactNode; v: React.ReactNode; mono?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-baseline gap-3 py-[5px] border-b border-dashed border-line last:border-0', className)}>
      <span className="text-[0.72rem] text-ink-3 flex-none w-24">{k}</span>
      <span className={cn('text-[0.78rem] text-ink min-w-0 flex-1 break-words', mono && 'mono tnum')}>{v}</span>
    </div>
  )
}

/** 数值格 */
export function StatCell({
  label,
  value,
  sub,
  tone = 'brand'
}: {
  label: React.ReactNode
  value: React.ReactNode
  sub?: React.ReactNode
  tone?: 'brand' | 'ok' | 'warn' | 'neutral'
}) {
  const borders = {
    brand: 'border-l-brand',
    ok: 'border-l-ok',
    warn: 'border-l-warn',
    neutral: 'border-l-line-3'
  }
  return (
    <div className={cn('stat', borders[tone])}>
      <span className="stat-label">{label}</span>
      <span className="stat-value truncate">{value}</span>
      {sub && <span className="text-[0.68rem] text-ink-3">{sub}</span>}
    </div>
  )
}

export { formatBytes }
