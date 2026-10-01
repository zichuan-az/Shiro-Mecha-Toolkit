import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 1536 → 1.5 KB */
export function formatBytes(n: number, digits = 1): string {
  if (!n || n < 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let v = n
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(i === 0 ? 0 : digits)} ${units[i]}`
}

/** 秒 → 02:31 / 1:04:12 */
export function formatDuration(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '--:--'
  const s = Math.floor(sec % 60)
  const m = Math.floor((sec / 60) % 60)
  const h = Math.floor(sec / 3600)
  const pad = (x: number) => String(x).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

export function formatSpeed(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec < 1) return '0 KB/s'
  return `${formatBytes(bytesPerSec, 1)}/s`
}

export function formatTime(ts: number): string {
  if (!ts) return '—'
  const d = new Date(ts)
  const pad = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatRelative(ts: number, lang: 'zh' | 'en' = 'zh'): string {
  if (!ts) return '—'
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60000)
  if (min < 1) return lang === 'zh' ? '刚刚' : 'just now'
  if (min < 60) return lang === 'zh' ? `${min} 分钟前` : `${min} min ago`
  const hour = Math.floor(min / 60)
  if (hour < 24) return lang === 'zh' ? `${hour} 小时前` : `${hour} h ago`
  const day = Math.floor(hour / 24)
  if (day < 30) return lang === 'zh' ? `${day} 天前` : `${day} d ago`
  return formatTime(ts).slice(0, 10)
}

export function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

/** 用短横线连接的稳定 key，避免列表里重复渲染 */
export function keyOf(...parts: (string | number | undefined)[]) {
  return parts.filter(Boolean).join('-')
}
