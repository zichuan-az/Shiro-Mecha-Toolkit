import React from 'react'

/**
 * 机甲图标集
 * 全部手写矢量：直角、细线、方头线帽，跟工程图纸那套视觉一套。
 * 自绘的原因很实际——位图会糊、会挡内容、还得跟着主题换色；矢量跟着 currentColor 走。
 */

export type MechaName =
  | 'dashboard'
  | 'accelerator'
  | 'library'
  | 'downloads'
  | 'takeover'
  | 'linkbay'
  | 'steam'
  | 'patcher'
  | 'scripts'
  | 'cleaner'
  | 'settings'
  | 'about'
  | 'risk'
  | 'extract'
  | 'lines'

const PATHS: Record<MechaName, string[]> = {
  dashboard: ['M3 3h8v8H3z', 'M13 3h8v4.5h-8z', 'M13 9.5h8v11.5h-8z', 'M3 13h8v8H3z'],
  accelerator: ['M6 4.5L12 12l-6 7.5', 'M13 4.5L19 12l-6 7.5', 'M3 12h1.4'],
  library: ['M4 4h13.5L20 6.5V20H4z', 'M8 8h7v5H8z', 'M8 16.5h8', 'M17.5 4v3.5H20'],
  downloads: ['M12 3v10', 'M7 9l5 5 5-5', 'M4 17.5V20h16v-2.5'],
  takeover: ['M12 2.5l8 4.6v9.8L12 21.5l-8-4.6V7.1z', 'M12 8.2l3.4 2v3.9L12 16.1l-3.4-2v-3.9z'],
  linkbay: ['M4 9V4h5v5z', 'M15 20v-5h5v5z', 'M6.5 4h7l5.5 5.5v4', 'M17.5 20h-7L5 14.5V9'],
  steam: ['M12 2.5l8 3.2v6.6c0 4.8-3.6 7.9-8 9.7-4.4-1.8-8-4.9-8-9.7V5.7z', 'M9 12l2.2 2.2L15.5 9'],
  patcher: ['M5 4h9l5 5v11H5z', 'M14 4v5h5', 'M12 17v-6', 'M9.5 13.5L12 11l2.5 2.5'],
  scripts: ['M8 6L4 12l4 6', 'M16 6l4 6-4 6', 'M12.5 5l-1.5 14'],
  cleaner: ['M5 8h14l-1.4 12.5H6.4z', 'M9 8V4.5h6V8', 'M10 12v5', 'M14 12v5'],
  settings: ['M12 2.5l8.2 4.8v9.4L12 21.5l-8.2-4.8V7.3z', 'M12 8.5l3.4 2v3.7L12 16.2l-3.4-2v-3.7z', 'M12 11.2v1.6'],
  about: ['M12 20.5L4 12l3-6.5 5 4 5-4 3 6.5z', 'M12 5.5V3'],
  risk: ['M12 3l9 16.5H3z', 'M12 9.5v4.5', 'M12 17h.01'],
  extract: ['M3 7h6l2 2.5h10V19H3z', 'M8.5 14.5h7', 'M12 11.5v6', 'M9.5 14.5l2.5 3 2.5-3'],
  lines: ['M3 15.5h4l3.5-8 3 12 3-9 2 5h2.5', 'M20.5 6.5h.01']
}

export function MechaIcon({
  name,
  size = 16,
  className,
  strokeWidth = 1.5
}: {
  name: MechaName
  size?: number
  className?: string
  strokeWidth?: number
}) {
  const paths = PATHS[name] || PATHS.dashboard
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  )
}

/** 品牌徽记：机甲胸甲 + 冰蓝棱线，可缩放，比位图徽记清楚得多 */
export function MechaEmblem({ size = 34, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="shiro-emb" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2a6ee0" />
          <stop offset="1" stopColor="#10367f" />
        </linearGradient>
      </defs>
      <path d="M24 3l18 10.4v21.2L24 45 6 34.6V13.4z" fill="url(#shiro-emb)" />
      <path d="M24 8.5l13.2 7.6v15.8L24 39.5 10.8 31.9V16.1z" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.1" />
      <path d="M24 14.5l7.6 4.4v9L24 32.3l-7.6-4.4v-9z" fill="rgba(255,255,255,0.92)" />
      <path d="M24 18.6l3.8 2.2v4.5L24 27.5l-3.8-2.2v-4.5z" fill="none" stroke="#10367f" strokeWidth="1.2" />
      <path d="M24 3v5.5M6 13.4l4.8 2.7M42 13.4l-4.8 2.7" stroke="rgba(255,255,255,0.45)" strokeWidth="1" />
    </svg>
  )
}

/** 页面眉标上的装饰棱线：纯装饰，绝对定位在留白处，不压内容 */
export function ChevronRail({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 24" className={className} height="20" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path d="M0 22h18l8-8 8 8h18l8-8 8 8h44" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="square" opacity="0.5" />
      <path d="M84 6h14l6 6" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="square" opacity="0.28" />
    </svg>
  )
}

export default MechaIcon
