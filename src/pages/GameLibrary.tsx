import React, { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, FolderOpen, Gamepad2, Info, Library as LibraryIcon, RefreshCw, Search } from 'lucide-react'
import { api } from '../lib/bridge'
import { useApp } from '../lib/store'
import { Panel, SectionTitle } from '../components/ui/Panel'
import { Btn, Input } from '../components/ui/Controls'
import { Badge, Empty, KV, Modal } from '../components/ui/Feedback'
import { formatBytes, formatRelative } from '../lib/utils'

export default function GameLibrary() {
  const { t, lang, pushToast, config, patchConfig } = useApp()
  const [manifest, setManifest] = useState<any>(null)
  const [query, setQuery] = useState('')
  const [detail, setDetail] = useState<any>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = async () => {
    setBusy(true)
    try {
      setManifest(await api.libManifest())
    } catch (err: any) {
      pushToast({ kind: 'error', title: t('common.failed'), body: String(err.message || err) })
    }
    setBusy(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const installed = manifest?.installed || []
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return installed
    return installed.filter((g: any) => g.name?.toLowerCase().includes(q) || g.appid?.includes(q))
  }, [installed, query])

  const openDetail = async (appid: string) => {
    setDetailLoading(true)
    setDetail({ appid, loading: true })
    try {
      setDetail(await api.libDetail(appid, config?.steam?.language || 'schinese'))
    } catch (err: any) {
      pushToast({ kind: 'error', title: t('common.failed'), body: String(err.message || err) })
      setDetail(null)
    }
    setDetailLoading(false)
  }

  return (
    <div className="p-5 space-y-4 anim-in">
      <Panel>
        <div className="flex flex-wrap items-center gap-4 p-5">
          <div className="w-12 h-12 flex-none flex items-center justify-center bg-brand text-white border border-brand">
            <LibraryIcon size={20} />
          </div>
          <div className="min-w-0">
            <div className="tag-plain mb-1">MODULE 03 / LIBRARY</div>
            <h2 className="display font-bold" style={{ fontSize: 'var(--fs-display)' }}>
              {t('lib.title')}
            </h2>
            <p className="text-[0.75rem] text-ink-3 mt-1">{t('lib.subtitle')}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Btn size="sm" onClick={load} disabled={busy}>
              <RefreshCw size={12} className={busy ? 'animate-spin' : ''} />
              {t('common.refresh')}
            </Btn>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 border-t border-line divide-x divide-line">
          <div className="px-4 py-3">
            <div className="stat-label mb-1">{t('dash.library')}</div>
            <div className="mono text-[0.9rem] font-bold">{installed.length}</div>
          </div>
          <div className="px-4 py-3">
            <div className="stat-label mb-1">{t('lib.totalSize')}</div>
            <div className="mono text-[0.9rem] font-bold">{formatBytes(manifest?.totalSize || 0)}</div>
          </div>
          <div className="px-4 py-3 min-w-0">
            <div className="stat-label mb-1">{t('dash.steamPath')}</div>
            <div className="mono text-[0.72rem] truncate">{manifest?.steam?.root || t('dash.notFound')}</div>
          </div>
          <div className="px-4 py-3">
            <div className="stat-label mb-1">libraries</div>
            <div className="mono text-[0.9rem] font-bold">{manifest?.steam?.libraryFolders?.length || 0}</div>
          </div>
        </div>
      </Panel>

      <div className="flex items-start gap-3 px-4 py-3 border border-[rgba(228,71,77,0.55)] bg-[rgba(253,233,234,0.92)] text-signal">
        <AlertTriangle size={17} className="flex-none mt-[1px]" />
        <div className="min-w-0">
          <div className="text-[0.8rem] font-semibold mb-1">{t('lib.safetyTitle')}</div>
          <div className="text-[0.72rem] leading-relaxed text-ink-2">{t('lib.safetyBody')}</div>
        </div>
      </div>

      {!manifest?.steam?.found && (
        <div className="flex items-center gap-3 px-4 py-3 hatch border border-[rgba(228,71,77,0.3)]">
          <Info size={15} className="text-signal flex-none" />
          <span className="text-[0.78rem] text-ink-2">{t('lib.notFound')}</span>
        </div>
      )}

      <>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('common.search')} className="pl-8" />
            </div>
          </div>

          {filtered.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filtered.map((g: any) => (
                <Panel key={g.appid} className="overflow-hidden group">
                  <div className="relative h-[76px] bg-surface-2 overflow-hidden">
                    <img
                      src={g.capsuleUrl}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={(e) => ((e.target as HTMLImageElement).style.opacity = '0')}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[rgba(10,26,47,0.55)] to-transparent" />
                    <div className="absolute bottom-2 left-3 right-3 flex items-end gap-2">
                      <span className="text-white text-[0.82rem] font-medium truncate display flex-1">{g.name}</span>
                    </div>
                    <span className="absolute top-2 right-2 tag-index">{g.appid}</span>
                  </div>
                  <div className="px-3 py-2.5 flex items-center gap-2">
                    <span className="mono text-[0.68rem] text-ink-3 flex-1 truncate">{formatBytes(g.sizeOnDisk)}</span>
                    <span className="text-[0.66rem] text-ink-3">{formatRelative(g.lastUpdated, lang)}</span>
                    <Btn size="sm" variant="ghost" onClick={() => openDetail(g.appid)}>
                      {t('common.detail')}
                    </Btn>
                    <button
                      onClick={() => api.openFolder(g.installDir).catch(() => {})}
                      className="text-ink-3 hover:text-brand no-drag"
                      title={t('common.openFolder')}
                    >
                      <FolderOpen size={13} />
                    </button>
                  </div>
                </Panel>
              ))}
            </div>
          ) : (
            <Panel>
              <Empty icon={<Gamepad2 size={18} />} title={t('common.none')} hint={t('lib.installedHint')} />
            </Panel>
          )}
        </>

      {/* 待入库清单已并入「接管舱 → 入库工坊」，这里不再保留第二套入口 */}

      {/* 详情弹窗 */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.name || t('common.loading')} width="max-w-3xl">
        {detail?.loading ? (
          <Empty title={t('common.loading')} />
        ) : detail ? (
          <div className="space-y-4">
            <div className="flex gap-4">
              {detail.headerImage && (
                <img src={detail.headerImage} alt="" className="w-56 h-[105px] object-cover border border-line flex-none" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {(detail.genres || []).map((g: string) => (
                    <Badge key={g} tone="brand">
                      {g}
                    </Badge>
                  ))}
                  {detail.metacritic && <Badge tone="ok">MC {detail.metacritic}</Badge>}
                </div>
                <p className="text-[0.78rem] text-ink-2 leading-relaxed">{detail.shortDescription}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-6">
              <KV k={t('lib.developer')} v={detail.developers?.join(', ')} />
              <KV k={t('lib.publisher')} v={detail.publishers?.join(', ')} />
              <KV k={t('lib.release')} v={detail.releaseDate} />
              <KV k={t('lib.reviews')} v={detail.recommendations?.toLocaleString()} mono />
              <KV
                k={t('lib.price')}
                v={
                  detail.isFree ? (
                    <Badge tone="ok">FREE</Badge>
                  ) : detail.price ? (
                    <span className="mono">
                      {detail.price.formatted} {detail.price.discount > 0 && <span className="text-signal">-{detail.price.discount}%</span>}
                    </span>
                  ) : (
                    '—'
                  )
                }
              />
              <KV k="dlc" v={detail.dlcCount} mono />
            </div>

            {detail.screenshots?.length > 0 && (
              <div>
                <SectionTitle>{t('lib.screenshots')}</SectionTitle>
                <div className="grid grid-cols-3 gap-2">
                  {detail.screenshots.slice(0, 6).map((s: any, i: number) => (
                    <img key={i} src={s.thumb} alt="" className="w-full h-[70px] object-cover border border-line" />
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Btn onClick={() => api.openExternal(detail.storeUrl)}>{t('common.open')}</Btn>
            </div>
          </div>
        ) : null}
      </Modal>

    </div>
  )
}
