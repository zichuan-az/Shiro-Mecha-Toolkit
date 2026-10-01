import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRightLeft,
  Clock,
  Copy,
  Eye,
  EyeOff,
  Gift,
  KeyRound,
  Percent,
  RefreshCw,
  Search,
  Shield,
  ShoppingBag,
  Tag,
  UserCog,
  Users
} from 'lucide-react'
import { api } from '../lib/bridge'
import { useApp } from '../lib/store'
import { Panel, PanelBody, PanelHead, SectionTitle } from '../components/ui/Panel'
import { Btn, Check, FieldRow, Input, Segmented } from '../components/ui/Controls'
import { Badge, ConfirmBar, Empty, KV, Lamp, Modal, Progress } from '../components/ui/Feedback'
import { cn, formatBytes, formatRelative } from '../lib/utils'

export default function SteamTools() {
  const { t, lang, pushToast, config, patchConfig } = useApp()
  const [tab, setTab] = useState<'guard' | 'id' | 'account' | 'store'>('guard')

  /* --------------------------- Guard --------------------------- */
  const [secret, setSecret] = useState('')
  const [showSecret, setShowSecret] = useState(false)
  const [code, setCode] = useState<any>(null)
  const [tick, setTick] = useState(0)
  const [remember, setRemember] = useState(true)

  useEffect(() => {
    if (tick !== 0 && tick % 3 === 0 && secret) {
      api
        .guardCode(secret)
        .then(setCode)
        .catch(() => setCode(null))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick])

  useEffect(() => {
    if (!secret) {
      setCode(null)
      return
    }
    api
      .guardCode(secret)
      .then(setCode)
      .catch(() => setCode(null))
  }, [secret])

  useEffect(() => {
    const timer = setInterval(() => setTick((x) => x + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const saved = config?.steam?.guardSecret
    if (saved) setSecret(saved)
  }, [config])

  const copy = async (text: string, label?: string) => {
    try {
      await api.copy(text)
      pushToast({ kind: 'ok', title: t('common.copied'), body: label || text })
    } catch (_) {
      /* 忽略 */
    }
  }

  /* --------------------------- SteamID --------------------------- */
  const [idInput, setIdInput] = useState('')
  const [idResult, setIdResult] = useState<any>(null)
  const [idError, setIdError] = useState('')
  const apiKey = config?.steam?.apiKey || ''

  const convert = async () => {
    setIdError('')
    setIdResult(null)
    try {
      let r = await api.steamIdParse(idInput)
      if (r?.needApiKey && apiKey) {
        r = await api.steamIdResolve(r.vanity, apiKey)
      }
      setIdResult(r)
    } catch (err: any) {
      setIdError(String(err.message || err))
    }
  }

  /* --------------------------- 账号 --------------------------- */
  const [accounts, setAccounts] = useState<any>(null)
  const [accForm, setAccForm] = useState({ accountName: '', personaName: '', steamId64: '', note: '' })
  const [showAccForm, setShowAccForm] = useState(false)
  const [switchResult, setSwitchResult] = useState<any>(null)

  const loadAccounts = async () => {
    try {
      setAccounts(await api.accountsList())
    } catch (_) {
      /* 忽略 */
    }
  }
  useEffect(() => {
    loadAccounts()
  }, [])

  const saveAccount = async () => {
    try {
      setAccounts(await api.accountSave(accForm))
      setShowAccForm(false)
      setAccForm({ accountName: '', personaName: '', steamId64: '', note: '' })
      pushToast({ kind: 'ok', title: t('common.saved') })
    } catch (err: any) {
      pushToast({ kind: 'error', title: t('common.failed'), body: String(err.message || err) })
    }
  }

  const switchAccount = async (id: string) => {
    try {
      const r = await api.accountSwitch(id)
      setSwitchResult(r)
      await loadAccounts()
    } catch (err: any) {
      pushToast({ kind: 'error', title: t('common.failed'), body: String(err.message || err) })
    }
  }

  /* --------------------------- 商店 --------------------------- */
  const [appid, setAppid] = useState('')
  const [detail, setDetail] = useState<any>(null)
  const [free, setFree] = useState<any[]>([])
  const [specials, setSpecials] = useState<any[]>([])
  const [loadingStore, setLoadingStore] = useState(false)

  const fetchDetail = async () => {
    if (!appid.trim()) return
    setLoadingStore(true)
    try {
      setDetail(await api.libDetail(appid.trim()))
    } catch (err: any) {
      pushToast({ kind: 'error', title: t('common.failed'), body: String(err.message || err) })
    }
    setLoadingStore(false)
  }

  const loadStoreLists = async () => {
    try {
      setFree(await api.steamFree())
    } catch (_) {
      /* 忽略 */
    }
    try {
      setSpecials(await api.steamSpecials())
    } catch (_) {
      /* 忽略 */
    }
  }

  const secondsLeft = code ? Math.max(0, 30 - (Math.floor(Date.now() / 1000) % 30)) : 0

  const tabs = [
    { value: 'guard' as const, label: t('steam.guard'), icon: <Shield size={13} /> },
    { value: 'id' as const, label: t('steam.idTitle'), icon: <ArrowRightLeft size={13} /> },
    { value: 'account' as const, label: t('steam.accounts'), icon: <UserCog size={13} /> },
    { value: 'store' as const, label: t('steam.store'), icon: <ShoppingBag size={13} /> }
  ]

  return (
    <div className="p-5 space-y-4 anim-in">
      <Panel>
        <div className="flex flex-wrap items-center gap-4 p-5">
          <div className="w-12 h-12 flex-none flex items-center justify-center bg-brand text-white border border-brand">
            <Shield size={20} />
          </div>
          <div className="min-w-0">
            <div className="tag-plain mb-1">MODULE 05 / STEAM</div>
            <h2 className="display font-bold" style={{ fontSize: 'var(--fs-display)' }}>
              {t('steam.title')}
            </h2>
            <p className="text-[0.75rem] text-ink-3 mt-1">{t('steam.subtitle')}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {tabs.map((x) => (
              <button
                key={x.value}
                onClick={() => setTab(x.value)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-[0.75rem] border no-drag transition-colors',
                  tab === x.value ? 'bg-brand text-white border-brand' : 'bg-surface-panel border-line-2 text-ink-2 hover:bg-surface-2'
                )}
              >
                {x.icon}
                {x.label}
              </button>
            ))}
          </div>
        </div>
      </Panel>

      {/* ============================ Guard ============================ */}
      {tab === 'guard' && (
        <div className="grid grid-cols-12 gap-4">
          <Panel className="col-span-12 lg:col-span-5">
            <PanelHead index="05-A" title={t('steam.guardSecret')} hint={t('steam.guardHint')} icon={<KeyRound size={14} />} />
            <PanelBody className="space-y-4">
              <FieldRow label={t('steam.guardSecret')}>
                <div className="flex gap-2">
                  <Input
                    mono
                    type={showSecret ? 'text' : 'password'}
                    value={secret}
                    onChange={(e) => setSecret(e.target.value.trim())}
                    placeholder="cGFkZGluZ2Jhc2U2NHNlY3JldA=="
                  />
                  <Btn onClick={() => setShowSecret((s) => !s)} className="flex-none">
                    {showSecret ? <EyeOff size={13} /> : <Eye size={13} />}
                  </Btn>
                </div>
              </FieldRow>

              <Check
                checked={remember}
                onChange={async (v) => {
                  setRemember(v)
                  await patchConfig({ 'steam.guardSecret': v ? secret : '' })
                  pushToast({ kind: 'ok', title: v ? t('set.saved') : t('common.done') })
                }}
                label={lang === 'zh' ? '记住到本机配置文件' : 'Remember in local config'}
              />

              <div className="flex items-start gap-2.5 px-3 py-2 hatch border border-[rgba(228,71,77,0.3)]">
                <span className="text-signal mt-[1px] flex-none">!</span>
                <span className="text-[0.72rem] text-ink-2 leading-relaxed">{t('steam.guardDanger')}</span>
              </div>
            </PanelBody>
          </Panel>

          <Panel className="col-span-12 lg:col-span-7">
            <PanelHead
              index="05-B"
              title={t('steam.guardNow')}
              icon={<Clock size={14} />}
              right={
                <Btn size="sm" variant="ghost" onClick={() => secret && api.guardCode(secret).then(setCode).catch(() => {})}>
                  <RefreshCw size={12} />
                  {t('steam.guardRefresh')}
                </Btn>
              }
            />
            <PanelBody>
              {code ? (
                <>
                  <div className="flex items-end gap-4">
                    <div className="display font-bold tracking-[0.18em] text-brand leading-none" style={{ fontSize: 'clamp(2rem,5vw,3.2rem)' }}>
                      {code.code}
                    </div>
                    <Btn size="sm" onClick={() => copy(code.code)} className="mb-1">
                      <Copy size={12} />
                      {t('common.copy')}
                    </Btn>
                  </div>
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-[0.7rem] text-ink-3 mb-1.5">
                      <span>{t('common.seconds')}</span>
                      <span className="mono">{secondsLeft}s / 30s</span>
                    </div>
                    <Progress value={(secondsLeft / 30) * 100} tone={secondsLeft <= 5 ? 'danger' : 'brand'} />
                  </div>

                  <div className="mt-5 pt-4 border-t border-line">
                    <SectionTitle>{t('steam.guardNeighbours')}</SectionTitle>
                    <div className="grid grid-cols-3 gap-2.5">
                      {code.neighbours?.map((n: any) => (
                        <button
                          key={n.offset}
                          onClick={() => copy(n.code)}
                          className={cn(
                            'panel-flat px-3 py-2 text-center no-drag hover:border-line-3 transition-colors',
                            n.offset === 0 && 'border-brand bg-brand-soft'
                          )}
                        >
                          <div className="tag-plain mb-1">{n.offset > 0 ? '+' : ''}{n.offset}</div>
                          <div className="mono font-bold text-[0.9rem] tracking-widest">{n.code}</div>
                        </button>
                      ))}
                    </div>
                    <p className="text-[0.68rem] text-ink-3 mt-2 leading-relaxed">
                      {lang === 'zh'
                        ? '如果本机时间不准，令牌会和手机上差一档，用相邻的两个对照一下即可。'
                        : 'If your clock drifts, compare with the neighbours above.'}
                    </p>
                  </div>
                </>
              ) : (
                <Empty icon={<Shield size={17} />} title={t('steam.guardHint')} />
              )}
            </PanelBody>
          </Panel>
        </div>
      )}

      {/* ============================ SteamID ============================ */}
      {tab === 'id' && (
        <div className="grid grid-cols-12 gap-4">
          <Panel className="col-span-12 lg:col-span-7">
            <PanelHead index="05-C" title={t('steam.idTitle')} hint={t('steam.idHint')} icon={<ArrowRightLeft size={14} />} />
            <PanelBody>
              <div className="flex gap-2">
                <Input
                  mono
                  value={idInput}
                  onChange={(e) => setIdInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && convert()}
                  placeholder="76561198000000001 / STEAM_1:1:19867136 / [U:1:39734273] / 39734273"
                />
                <Btn variant="primary" onClick={convert} className="flex-none">
                  {t('steam.idConvert')}
                </Btn>
              </div>

              {idError && (
                <div className="mt-3 px-3 py-2 border border-[rgba(228,71,77,0.3)] bg-signal-soft text-[0.74rem] text-ink-2">
                  {idError}
                </div>
              )}

              {idResult && !idResult.needApiKey && (
                <div className="mt-4 space-y-0">
                  {idResult.vanity && <KV k="vanity" v={idResult.vanity} mono />}
                  {[
                    ['SteamID64', idResult.id64],
                    ['AccountID', idResult.accountId],
                    ['STEAM_X:Y:Z', idResult.steam2],
                    ['Steam3', idResult.steam3],
                    ['hex', idResult.hex]
                  ]
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <div key={k as string} className="flex items-center gap-3 py-2 border-b border-dashed border-line last:border-0">
                        <span className="text-[0.72rem] text-ink-3 w-28 flex-none">{k}</span>
                        <span className="mono text-[0.78rem] text-ink flex-1 min-w-0 break-all">{v as string}</span>
                        <button onClick={() => copy(String(v))} className="text-ink-3 hover:text-brand flex-none no-drag">
                          <Copy size={12} />
                        </button>
                      </div>
                    ))}
                  {idResult.profileUrl && (
                    <div className="pt-3">
                      <Btn size="sm" onClick={() => api.openExternal(idResult.profileUrl)}>
                        {t('common.open')}
                        <ArrowRightLeft size={12} className="rotate-90" />
                      </Btn>
                    </div>
                  )}
                </div>
              )}

              {idResult?.needApiKey && (
                <div className="mt-3 px-3 py-2 border border-line-2 bg-warn-soft text-[0.74rem] text-ink-2">
                  {t('steam.idVanity')}
                  {!apiKey && ' → ' + t('steam.apikeyHint')}
                </div>
              )}
            </PanelBody>
          </Panel>

          <Panel className="col-span-12 lg:col-span-5">
            <PanelHead index="05-D" title={t('steam.apikey')} hint={t('steam.apikeyHint')} icon={<KeyRound size={14} />} />
            <PanelBody>
              <FieldRow label={t('steam.apikey')}>
                <Input
                  mono
                  type="password"
                  value={apiKey}
                  onChange={(e) => patchConfig({ 'steam.apiKey': e.target.value.trim() })}
                  placeholder="XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                />
              </FieldRow>
              <div className="mt-3 space-y-0">
                <KV k="country" v={config?.steam?.countryCode || 'CN'} mono />
                <KV k="language" v={config?.steam?.language || 'schinese'} mono />
              </div>
              <p className="text-[0.68rem] text-ink-3 mt-3 leading-relaxed">{t('steam.apikeyHint')}</p>
              <div className="mt-3">
                <Btn size="sm" onClick={() => api.openExternal('https://steamcommunity.com/dev/apikey')}>
                  {t('common.open')}
                </Btn>
              </div>
            </PanelBody>
          </Panel>
        </div>
      )}

      {/* ============================ 账号切换 ============================ */}
      {tab === 'account' && (
        <div className="grid grid-cols-12 gap-4">
          <Panel className="col-span-12 lg:col-span-7">
            <PanelHead
              index="05-E"
              title={t('steam.accounts')}
              hint={t('steam.accountsHint')}
              icon={<Users size={14} />}
              right={
                <Btn size="sm" onClick={() => setShowAccForm(true)}>
                  {t('steam.accAdd')}
                </Btn>
              }
            />
            <PanelBody pad={false}>
              {accounts?.accounts?.length ? (
                <div className="divide-y divide-line">
                  {accounts.accounts.map((a: any) => (
                    <div key={a.id} className="row row-hover">
                      <span
                        className={cn(
                          'w-8 h-8 flex-none flex items-center justify-center border text-[0.75rem] font-bold display',
                          a.active ? 'bg-brand text-white border-brand' : 'bg-surface-2 text-ink-3 border-line-2'
                        )}
                      >
                        {(a.personaName || a.accountName || '?').slice(0, 1).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[0.8rem] text-ink truncate">{a.personaName || a.accountName}</span>
                        <span className="block mono text-[0.66rem] text-ink-3 truncate">
                          {a.accountName}
                          {a.steamId64 ? ` · ${a.steamId64}` : ''}
                        </span>
                      </span>
                      {a.active ? (
                        <Badge tone="ok">
                          <Lamp state="on" />
                          {t('steam.accActive')}
                        </Badge>
                      ) : (
                        <Btn size="sm" onClick={() => switchAccount(a.id)}>
                          {t('steam.accSwitch')}
                        </Btn>
                      )}
                      <button
                        onClick={async () => {
                          try {
                            setAccounts(await api.accountRemove(a.id))
                          } catch (_) {
                            /* 忽略 */
                          }
                        }}
                        className="text-ink-3 hover:text-signal no-drag flex-none"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty icon={<Users size={17} />} title={t('common.none')} hint={t('steam.accountsHint')} />
              )}
            </PanelBody>
          </Panel>

          <Panel className="col-span-12 lg:col-span-5">
            <PanelHead index="05-F" title={t('common.detail')} icon={<UserCog size={14} />} />
            <PanelBody>
              <KV k={t('dash.steamPath')} v={<span className="mono text-[0.72rem]">{accounts?.steamRoot || t('dash.notFound')}</span>} />
              <KV k="found" v={accounts?.found ? t('common.yes') : t('common.no')} />
              {switchResult && (
                <div className="mt-3 panel-flat p-3">
                  {switchResult.steps?.map((s: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-[0.72rem] text-ink-2 py-1 leading-relaxed">
                      <span className="text-brand flex-none mt-[2px]">›</span>
                      <span className="mono break-all">{s}</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[0.68rem] text-ink-3 mt-3 leading-relaxed">{t('steam.accountsHint')}</p>
            </PanelBody>
          </Panel>
        </div>
      )}

      {/* ============================ 商店 ============================ */}
      {tab === 'store' && (
        <div className="grid grid-cols-12 gap-4">
          <Panel className="col-span-12 lg:col-span-7">
            <PanelHead
              index="05-G"
              title={t('steam.store')}
              hint={t('steam.storeHint')}
              icon={<Search size={14} />}
              right={
                <Btn size="sm" variant="ghost" onClick={loadStoreLists}>
                  <RefreshCw size={12} />
                  {t('common.refresh')}
                </Btn>
              }
            />
            <PanelBody>
              <div className="flex gap-2">
                <Input
                  mono
                  value={appid}
                  onChange={(e) => setAppid(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && fetchDetail()}
                  placeholder="1091500"
                />
                <Btn variant="primary" onClick={fetchDetail} disabled={loadingStore} className="flex-none">
                  {loadingStore ? <RefreshCw size={13} className="animate-spin" /> : <Search size={13} />}
                  {t('common.search')}
                </Btn>
              </div>

              {detail && (
                <div className="mt-4">
                  <div className="flex gap-4">
                    {detail.headerImage && (
                      <img src={detail.headerImage} alt="" className="w-40 h-[75px] object-cover border border-line flex-none" />
                    )}
                    <div className="min-w-0">
                      <div className="display font-semibold text-[0.95rem] truncate">{detail.name}</div>
                      <div className="text-[0.7rem] text-ink-3 mt-0.5">
                        {detail.releaseDate} · {detail.developers?.join(', ')}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {(detail.genres || []).slice(0, 4).map((g: string) => (
                          <Badge key={g}>{g}</Badge>
                        ))}
                        {detail.metacritic && <Badge tone="brand">MC {detail.metacritic}</Badge>}
                      </div>
                    </div>
                  </div>
                  <p className="text-[0.75rem] text-ink-2 leading-relaxed mt-3">{detail.shortDescription}</p>
                  <div className="mt-3">
                    <KV k={t('lib.publisher')} v={detail.publishers?.join(', ')} />
                    <KV k={t('lib.reviews')} v={detail.recommendations?.toLocaleString()} mono />
                    <KV
                      k={t('lib.price')}
                      v={
                        detail.isFree ? (
                          <Badge tone="ok">FREE</Badge>
                        ) : detail.price ? (
                          <span className="mono">
                            {detail.price.formatted}
                            {detail.price.discount > 0 && <span className="text-signal ml-2">-{detail.price.discount}%</span>}
                          </span>
                        ) : (
                          '—'
                        )
                      }
                    />
                  </div>
                </div>
              )}
            </PanelBody>
          </Panel>

          <div className="col-span-12 lg:col-span-5 space-y-4">
            <Panel>
              <PanelHead index="05-H" title={t('steam.storeFree')} icon={<Gift size={14} />} />
              <PanelBody pad={false}>
                {free.length ? (
                  <div className="divide-y divide-line">
                    {free.slice(0, 8).map((g, i) => (
                      <div key={`${g.appid}-${i}`} className="row row-hover">
                        <span className="min-w-0 flex-1 text-[0.78rem] truncate">{g.name}</span>
                        <Badge tone="ok">FREE</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty icon={<Gift size={16} />} title={t('common.none')} hint={t('accel.probeHint')} />
                )}
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHead index="05-I" title={t('steam.storeSpecials')} icon={<Percent size={14} />} />
              <PanelBody pad={false}>
                {specials.length ? (
                  <div className="divide-y divide-line">
                    {specials.slice(0, 8).map((g, i) => (
                      <div key={`${g.appid}-${i}`} className="row row-hover">
                        <span className="min-w-0 flex-1 text-[0.78rem] truncate">{g.name}</span>
                        <span className="text-[0.72rem] text-signal mono">-{g.discount}%</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty icon={<Tag size={16} />} title={t('common.none')} />
                )}
              </PanelBody>
            </Panel>
          </div>
        </div>
      )}

      {/* --------------------------- 添加账号弹窗 --------------------------- */}
      <Modal
        open={showAccForm}
        onClose={() => setShowAccForm(false)}
        title={t('steam.accAdd')}
        footer={
          <>
            <Btn onClick={() => setShowAccForm(false)}>{t('common.cancel')}</Btn>
            <Btn variant="primary" onClick={saveAccount}>
              {t('common.save')}
            </Btn>
          </>
        }
      >
        <div className="space-y-3">
          <FieldRow label={t('steam.accName')} hint={t('common.required')}>
            <Input value={accForm.accountName} onChange={(e) => setAccForm({ ...accForm, accountName: e.target.value })} />
          </FieldRow>
          <FieldRow label={t('steam.accPersona')} hint={t('common.optional')}>
            <Input value={accForm.personaName} onChange={(e) => setAccForm({ ...accForm, personaName: e.target.value })} />
          </FieldRow>
          <FieldRow label={t('steam.accSteamId')} hint={t('common.optional')}>
            <Input
              mono
              value={accForm.steamId64}
              onChange={(e) => setAccForm({ ...accForm, steamId64: e.target.value.replace(/\D/g, '').slice(0, 17) })}
              placeholder="76561198000000001"
            />
          </FieldRow>
          <FieldRow label={t('steam.accNote')} hint={t('common.optional')}>
            <Input value={accForm.note} onChange={(e) => setAccForm({ ...accForm, note: e.target.value })} />
          </FieldRow>
          <p className="text-[0.68rem] text-ink-3 leading-relaxed">{t('steam.accountsHint')}</p>
        </div>
      </Modal>
    </div>
  )
}
