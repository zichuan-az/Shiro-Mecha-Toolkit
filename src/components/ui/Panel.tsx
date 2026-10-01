import React from 'react'
import { cn } from '../../lib/utils'

/** 主体面板：细线 + 四角工程标记 */
export function Panel({
  children,
  className,
  corners = true,
  flat = false,
  ...rest
}: {
  children?: React.ReactNode
  className?: string
  corners?: boolean
  flat?: boolean
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn(flat ? 'panel-flat' : 'panel', corners && 'corners', className)} {...rest}>
      {children}
    </div>
  )
}

/** 面板顶部标题条：编号 + 标题 + 右侧操作位 */
export function PanelHead({
  index,
  title,
  hint,
  right,
  icon,
  className
}: {
  index?: string
  title: React.ReactNode
  hint?: React.ReactNode
  right?: React.ReactNode
  icon?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('panel-head', className)}>
      {index && <span className="tag-index">{index}</span>}
      {icon && <span className="text-brand flex-none">{icon}</span>}
      <div className="min-w-0 flex-1">
        <div className="display text-[0.95rem] font-semibold text-ink truncate">{title}</div>
        {hint && <div className="text-[0.7rem] text-ink-3 leading-snug mt-0.5">{hint}</div>}
      </div>
      {right && <div className="flex items-center gap-2 flex-none no-drag">{right}</div>}
    </div>
  )
}

/** 面板内容区 */
export function PanelBody({
  children,
  className,
  pad = true,
  ...rest
}: { children?: React.ReactNode; className?: string; pad?: boolean } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn(pad && 'p-4', className)} {...rest}>
      {children}
    </div>
  )
}

/** 分区小标题：左侧一根蓝竖线 + 等宽小字 */
export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="w-[3px] h-[13px] bg-brand flex-none" />
      <span className="display text-[0.8rem] font-semibold tracking-wide text-ink-2 uppercase">{children}</span>
      <span className="flex-1 h-px bg-line" />
      {right}
    </div>
  )
}

/** 斜切装饰条 */
export function NotchBar({ className }: { className?: string }) {
  return <div className={cn('notch bg-brand h-1 w-16', className)} />
}
