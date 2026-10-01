import React from 'react'
import { AlertTriangle } from 'lucide-react'
import { cn } from '../lib/utils'

/**
 * 风险提示条：高风险模块顶上挂一条，别让它长得像普通功能。
 * 不吸顶、不遮挡，正常占位。
 */
export default function RiskBanner({
  title,
  body,
  className,
  compact = false
}: {
  title: React.ReactNode
  body: React.ReactNode
  className?: string
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        'flex gap-3 border border-[rgba(228,71,77,0.32)] bg-[linear-gradient(90deg,rgba(228,71,77,0.07),transparent_65%)] rounded-[2px]',
        compact ? 'px-3 py-2' : 'px-4 py-3',
        className
      )}
      role="note"
    >
      <span className="text-signal flex-none mt-[2px]">
        <AlertTriangle size={compact ? 14 : 16} />
      </span>
      <div className="min-w-0">
        <div className="display text-[0.78rem] font-semibold text-signal tracking-wide uppercase">{title}</div>
        <div className={cn('text-ink-2 leading-relaxed mt-1', compact ? 'text-[0.69rem]' : 'text-[0.73rem]')}>{body}</div>
      </div>
    </div>
  )
}
