import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, hasNative } from './bridge'
import { translate, type Lang } from './i18n'

/* ------------------------------ 全局状态 ------------------------------ */

export type Toast = {
  id: string
  kind: 'info' | 'ok' | 'warn' | 'error'
  title: string
  body?: string
}

type Ctx = {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string, fallback?: string) => string
  config: any
  patchConfig: (patch: Record<string, any>) => Promise<void>
  reloadConfig: () => Promise<void>
  meta: any
  toasts: Toast[]
  pushToast: (t: Omit<Toast, 'id'>) => void
  dismissToast: (id: string) => void
  admin: boolean
}

const AppCtx = createContext<Ctx | null>(null)

export function useApp(): Ctx {
  const ctx = useContext(AppCtx)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>')
  return ctx
}

/** 便捷 hook：只要翻译函数 */
export function useT() {
  return useApp().t
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<any>(null)
  const [meta, setMeta] = useState<any>(null)
  const [toasts, setToasts] = useState<Toast[]>([])

  const lang: Lang = config?.language === 'en' ? 'en' : 'zh'

  const t = useCallback((key: string, fallback?: string) => translate(lang, key, fallback), [lang])

  const pushToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { ...toast, id }])
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), toast.kind === 'error' ? 7000 : 4200)
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((x) => x.id !== id))
  }, [])

  const reloadConfig = useCallback(async () => {
    try {
      const c = await api.configAll()
      setConfig(c)
    } catch (err: any) {
      pushToast({ kind: 'error', title: '读取配置失败', body: String(err.message || err) })
    }
  }, [pushToast])

  const patchConfig = useCallback(
    async (patch: Record<string, any>) => {
      let next = config
      for (const [k, v] of Object.entries(patch)) {
        next = await api.configSet(k, v)
      }
      setConfig(next)
    },
    [config]
  )

  const setLang = useCallback(
    (l: Lang) => {
      patchConfig({ language: l })
    },
    [patchConfig]
  )

  useEffect(() => {
    ;(async () => {
      await reloadConfig()
      try {
        setMeta(await api.meta())
      } catch (_) {
        /* 元信息失败不影响使用 */
      }
    })()
  }, [reloadConfig])

  const value = useMemo<Ctx>(
    () => ({
      lang,
      setLang,
      t,
      config,
      patchConfig,
      reloadConfig,
      meta,
      toasts,
      pushToast,
      dismissToast,
      admin: !!meta?.admin
    }),
    [lang, setLang, t, config, patchConfig, reloadConfig, meta, toasts, pushToast, dismissToast]
  )

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}

/** 统一包装：把 bridge 抛出的错误转成一条 toast */
export function useAction(pushToast: Ctx['pushToast'], t: Ctx['t']) {
  return useCallback(
    async function run<T>(fn: () => Promise<T>, okTitle?: string): Promise<T | null> {
      try {
        const r = await fn()
        if (okTitle) pushToast({ kind: 'ok', title: okTitle })
        return r
      } catch (err: any) {
        pushToast({ kind: 'error', title: t('common.failed'), body: String(err?.message || err) })
        return null
      }
    },
    [pushToast, t]
  )
}

export const isNative = hasNative
