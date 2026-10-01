import React, { useEffect, useState } from 'react'
import { FolderOpen, Info, RotateCcw, Save, Settings as SettingsIcon, Globe } from 'lucide-react'
import { api } from '../lib/bridge'
import { useApp } from '../lib/store'
import { Panel, PanelBody, PanelHead, SectionTitle } from '../components/ui/Panel'
import { Btn, FieldRow, Input, Segmented, Select, Switch } from '../components/ui/Controls'
import { Badge, ConfirmBar, KV } from '../components/ui/Feedback'
import type { Lang } from '../lib/i18n'

type Dict = { [k: string]: unknown }

function pick<T>(source: Dict | undefined | null, key: string, fallback: T): T {
  const value = source ? source[key] : undefined
  return (value === undefined || value === null ? fallback : value) as T
}

export default function SettingsPage() {
  const { t, lang, setLang, config, patchConfig, reloadConfig, meta, pushToast } = useApp()
  const [confirmReset, setConfirmReset] = useState(false)
  const [pillar, setPillar] = useState<Dict | null>(null)

  useEffect(() => {
    if (config) setPillar(config as Dict)
  }, [config])

  if (!config) {
    return (
      <div className="p-5 anim-in">
        <Panel>
          <PanelBody>{t('common.loading')}</PanelBody>
        </Panel>
      </div>
    )
  }

  const accel = pick<Dict>(pillar, 'accelerator', {})
  const download = pick<Dict>(pillar, 'download', {})
  const steam = pick<Dict>(pillar, 'steam', {})
  const behavior = pick<Dict>(pillar, 'behavior', {})

  const save = async (key: string, value: unknown, message?: string) => {
    try {
      await patchConfig({ [key]: value })
      if (message) pushToast({ kind: 'ok', title: message })
    } catch (err) {
      pushToast({ kind: 'error', title: t('common.failed'), body: String(err instanceof Error ? err.message : err) })
    }
  }

  const pickDir = async () => {
    const dir = await api.libPickDir().catch(() => null)
    if (dir) await save('download.saveDir', dir, t('set.saved'))
  }

  const pickSteamDir = async () => {
    const dir = await api.libPickDir().catch(() => null)
    if (dir) await save('steam.steamPath', dir, t('set.saved'))
  }

  return (
    <div className="p-5 space-y-4 anim-in">
      <Panel>
        <div className="flex flex-wrap items-center gap-4 p-5">
          <div className="w-12 h-12 flex-none flex items-center justify-center bg-brand text-white border border-brand">
            <SettingsIcon size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="tag-plain mb-1">MODULE 09 / SETTINGS</div>
            <h2 className="display font-bold" style={{ fontSize: 'var(--fs-display)' }}>
              {t('set.title')}
            </h2>
            <p className="text-[0.75rem] text-ink-3 mt-1">{t('set.subtitle')}</p>
          </div>
          <Badge tone="brand">
            {t('about.version')} {meta?.version || '1.0.0'}
          </Badge>
        </div>
      </Panel>

      <div className="grid grid-cols-12 gap-4">
        {/* --------------------------- 通用 --------------------------- */}
        <Panel className="col-span-12 lg:col-span-6">
          <PanelHead index="09-A" title={t('set.general')} icon={<Globe size={14} />} />
          <PanelBody className="space-y-4">
            <FieldRow label={t('set.language')}>
              <Segmented<Lang>
                value={lang}
                onChange={(v) => setLang(v)}
                options={[
                  { value: 'zh', label: '简体中文' },
                  { value: 'en', label: 'English' }
                ]}
              />
            </FieldRow>

            <SectionTitle>{t('set.behavior')}</SectionTitle>

            <Switch
              checked={!!pick(behavior, 'closeToTray', true)}
              onChange={(v) => save('behavior.closeToTray', v, t('set.saved'))}
              label={t('set.closeToTray')}
            />
            <Switch
              checked={!!pick(behavior, 'notifyOnTray', true)}
              onChange={(v) => save('behavior.notifyOnTray', v, t('set.saved'))}
              label={t('set.notifyOnTray')}
            />
          </PanelBody>
        </Panel>

        {/* --------------------------- 加速 --------------------------- */}
        <Panel className="col-span-12 lg:col-span-6">
          <PanelHead index="09-B" title={t('nav.accelerator')} icon={<SettingsIcon size={14} />} />
          <PanelBody className="space-y-4">
            <Switch
              checked={!!pick(accel, 'autoStart', false)}
              onChange={(v) => save('accelerator.autoStart', v, t('set.saved'))}
              label={t('set.autoStart')}
            />
            <Switch
              checked={!!pick(accel, 'autoSetSystemProxy', false)}
              onChange={(v) => save('accelerator.autoSetSystemProxy', v, t('set.saved'))}
              label={t('set.systemProxy')}
            />
            <FieldRow label={t('set.port')}>
              <Input
                mono
                type="number"
                min={1024}
                max={65535}
                value={pick<number>(accel, 'listenPort', 51789)}
                onChange={(e) => save('accelerator.listenPort', Number(e.target.value) || 51789)}
              />
            </FieldRow>
            <div className="text-[0.68rem] text-ink-3 leading-relaxed">{t('accel.systemProxyHint')}</div>
          </PanelBody>
        </Panel>

        {/* --------------------------- 下载 --------------------------- */}
        <Panel className="col-span-12 lg:col-span-6">
          <PanelHead index="09-C" title={t('set.download')} icon={<FolderOpen size={14} />} />
          <PanelBody className="space-y-4">
            <FieldRow label={t('set.saveDir')}>
              <div className="flex gap-2">
                <Input
                  mono
                  value={pick<string>(download, 'saveDir', '')}
                  onChange={(e) => save('download.saveDir', e.target.value)}
                  placeholder="D:/Games/Downloads"
                />
                <Btn onClick={pickDir} className="flex-none">
                  <FolderOpen size={13} />
                </Btn>
              </div>
            </FieldRow>
            <div className="grid grid-cols-2 gap-3">
              <FieldRow label={t('set.concurrency')}>
                <Input
                  mono
                  type="number"
                  min={1}
                  max={16}
                  value={pick<number>(download, 'concurrency', 4)}
                  onChange={(e) => save('download.concurrency', Number(e.target.value) || 4)}
                />
              </FieldRow>
              <FieldRow label={t('set.speedLimit')}>
                <Input
                  mono
                  type="number"
                  min={0}
                  value={pick<number>(download, 'speedLimitKB', 0)}
                  onChange={(e) => save('download.speedLimitKB', Number(e.target.value) || 0)}
                />
              </FieldRow>
            </div>
            <Switch
              checked={!!pick(download, 'autoExtract', true)}
              onChange={(v) => save('download.autoExtract', v, t('set.saved'))}
              label={t('lib.autoExtract')}
            />
          </PanelBody>
        </Panel>

        {/* --------------------------- Steam --------------------------- */}
        <Panel className="col-span-12 lg:col-span-6">
          <PanelHead index="09-D" title={t('set.steam')} icon={<SettingsIcon size={14} />} />
          <PanelBody className="space-y-4">
            <FieldRow label={t('set.steamPath')}>
              <div className="flex gap-2">
                <Input
                  mono
                  value={pick<string>(steam, 'steamPath', '')}
                  onChange={(e) => save('steam.steamPath', e.target.value)}
                  placeholder="D:/Steam"
                />
                <Btn onClick={pickSteamDir} className="flex-none">
                  <FolderOpen size={13} />
                </Btn>
              </div>
            </FieldRow>
            <FieldRow label={t('set.apiKey')} hint={t('steam.apikeyHint')}>
              <Input
                mono
                type="password"
                value={pick<string>(steam, 'apiKey', '')}
                onChange={(e) => save('steam.apiKey', e.target.value.trim())}
                placeholder="XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
              />
            </FieldRow>
            <div className="grid grid-cols-2 gap-3">
              <FieldRow label={t('set.countryCode')}>
                <Input
                  mono
                  maxLength={2}
                  value={pick<string>(steam, 'countryCode', 'CN')}
                  onChange={(e) => save('steam.countryCode', e.target.value.toUpperCase())}
                />
              </FieldRow>
              <FieldRow label={t('set.storeLang')}>
                <Select
                  value={pick<string>(steam, 'language', 'schinese')}
                  onChange={(e) => save('steam.language', e.target.value, t('set.saved'))}
                >
                  <option value="schinese">{t('set.storeLangZh')}</option>
                  <option value="english">{t('set.storeLangEn')}</option>
                </Select>
              </FieldRow>
            </div>
          </PanelBody>
        </Panel>

        {/* --------------------------- 数据 --------------------------- */}
        <Panel className="col-span-12">
          <PanelHead index="09-E" title={t('set.data')} icon={<Info size={14} />} />
          <PanelBody>
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12 lg:col-span-7">
                <KV k={t('set.configPath')} v={<span className="mono text-[0.72rem] break-all">{meta?.userData || '—'}</span>} />
                <KV k={t('about.version')} v={<span className="mono">{meta?.version || '1.0.0'}</span>} />
                <KV k="Electron" v={<span className="mono">{meta?.electron || '—'}</span>} />
                <KV k="Node" v={<span className="mono">{meta?.node || '—'}</span>} />
                <KV k="Chrome" v={<span className="mono">{meta?.chrome || '—'}</span>} />
                <KV k={t('about.license')} v={<span className="mono">MIT</span>} />
              </div>
              <div className="col-span-12 lg:col-span-5 flex flex-col gap-3">
                <div className="panel-flat p-3 text-[0.7rem] text-ink-2 leading-relaxed">
                  {t('set.subtitle')}
                </div>
                <Btn variant="ghost" onClick={() => reloadConfig()}>
                  <RotateCcw size={13} />
                  {t('common.refresh')}
                </Btn>
                <Btn variant="danger" onClick={() => setConfirmReset(true)}>
                  <RotateCcw size={13} />
                  {t('set.reset')}
                </Btn>
                {confirmReset && (
                  <ConfirmBar
                    text={t('set.resetConfirm')}
                    confirmText={t('common.confirm')}
                    cancelText={t('common.cancel')}
                    tone="danger"
                    onCancel={() => setConfirmReset(false)}
                    onConfirm={async () => {
                      try {
                        await api.configReset()
                        await reloadConfig()
                        pushToast({ kind: 'ok', title: t('set.saved') })
                      } catch (err) {
                        pushToast({
                          kind: 'error',
                          title: t('common.failed'),
                          body: String(err instanceof Error ? err.message : err)
                        })
                      }
                      setConfirmReset(false)
                    }}
                  />
                )}
              </div>
            </div>
          </PanelBody>
        </Panel>
      </div>

      <div className="flex justify-end">
        <Btn
          variant="primary"
          onClick={async () => {
            await reloadConfig()
            pushToast({ kind: 'ok', title: t('set.saved') })
          }}
        >
          <Save size={13} />
          {t('common.save')}
        </Btn>
      </div>
    </div>
  )
}
