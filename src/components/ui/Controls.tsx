import React from 'react'
import { cn } from '../../lib/utils'

/* ------------------------------ 按钮 ------------------------------ */

type BtnProps = {
  variant?: 'default' | 'primary' | 'danger' | 'ghost'
  size?: 'md' | 'sm'
} & React.ButtonHTMLAttributes<HTMLButtonElement>

export function Btn({ variant = 'default', size = 'md', className, children, ...rest }: BtnProps) {
  return (
    <button
      className={cn(
        'btn no-drag',
        variant === 'primary' && 'btn-primary',
        variant === 'danger' && 'btn-danger',
        variant === 'ghost' && 'btn-ghost',
        size === 'sm' && 'btn-sm',
        className
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

/* ------------------------------ 开关 ------------------------------ */

export function Switch({
  checked,
  onChange,
  label,
  hint,
  disabled
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: React.ReactNode
  hint?: React.ReactNode
  disabled?: boolean
}) {
  const body = (
    <>
      <span className={cn('switch', checked && 'switch-on', disabled && 'opacity-50')} />
      <span className="min-w-0">
        {label && <span className="block text-[0.82rem] text-ink leading-snug">{label}</span>}
        {hint && <span className="block text-[0.7rem] text-ink-3 leading-snug mt-0.5">{hint}</span>}
      </span>
    </>
  )

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className="flex items-start gap-3 text-left no-drag w-full disabled:cursor-not-allowed"
    >
      {body}
    </button>
  )
}

/* ------------------------------ 输入 ------------------------------ */

export function FieldRow({
  label,
  hint,
  children,
  className
}: {
  label?: React.ReactNode
  hint?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <label className={cn('block', className)}>
      {label && (
        <span className="flex items-baseline gap-2 mb-1.5">
          <span className="text-[0.78rem] font-medium text-ink-2">{label}</span>
          {hint && <span className="text-[0.68rem] text-ink-3">{hint}</span>}
        </span>
      )}
      {children}
    </label>
  )
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }>(
  ({ className, mono, ...rest }, ref) => (
    <input ref={ref} className={cn('field', mono && 'field-mono', className)} {...rest} />
  )
)
Input.displayName = 'Input'

export function Textarea({ className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn('field', className)} {...rest} />
}

export function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn('field', 'cursor-pointer', className)} {...rest}>
      {children}
    </select>
  )
}

/* ------------------------------ 分段控件 ------------------------------ */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: React.ReactNode }[]
  className?: string
}) {
  return (
    <div className={cn('inline-flex border border-line-2 rounded-sm overflow-hidden', className)}>
      {options.map((o, i) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'px-3 py-1.5 text-[0.75rem] no-drag transition-colors',
            i > 0 && 'border-l border-line-2',
            value === o.value ? 'bg-brand text-white' : 'bg-surface-panel text-ink-2 hover:bg-surface-2'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ------------------------------ 勾选 ------------------------------ */

export function Check({
  checked,
  onChange,
  label,
  disabled
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: React.ReactNode
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2.5 no-drag text-left disabled:opacity-50"
    >
      <span
        className={cn(
          'w-[15px] h-[15px] flex-none border rounded-[1px] flex items-center justify-center transition-colors',
          checked ? 'bg-brand border-brand' : 'bg-surface-panel border-line-2'
        )}
      >
        {checked && (
          <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M2 6.4 4.6 9 10 3.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      {label && <span className="text-[0.8rem] text-ink min-w-0">{label}</span>}
    </button>
  )
}
