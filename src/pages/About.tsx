import React, { useState } from 'react'
import { Code2, Coffee, ExternalLink, Heart, Info, Scale, ShieldCheck, Sparkles } from 'lucide-react'
import { api } from '../lib/bridge'
import { useApp } from '../lib/store'
import { Panel, PanelBody, PanelHead, SectionTitle } from '../components/ui/Panel'
import { Btn } from '../components/ui/Controls'
import { Badge, KV } from '../components/ui/Feedback'
import pilotFull from '../assets/pilot-full.png'
import emblem from '../assets/emblem.png'

export default function About() {
  const { t, meta } = useApp()
  const [active, setActive] = useState<'afdian' | 'kofi' | 'github'>('afdian')

  const donate = (meta?.donate || {}) as Record<string, string | undefined>
  const links: { key: 'afdian' | 'kofi' | 'github'; label: string; url?: string; icon: React.ReactNode; desc: string }[] = [
    {
      key: 'afdian',
      label: t('about.donateAfdian'),
      url: donate.afdian,
      icon: <Heart size={14} />,
      desc: 'afdian.com'
    },
    { key: 'kofi', label: t('about.donateKofi'), url: donate.kofi, icon: <Coffee size={14} />, desc: 'ko-fi.com' },
    {
      key: 'github',
      label: t('about.donateGithub'),
      url: donate.github,
      icon: <Code2 size={14} />,
      desc: 'github.com/sponsors'
    }
  ]

  return (
    <div className="p-5 space-y-4 anim-in">
      {/* --------------------------- 头部 --------------------------- */}
      <Panel className="overflow-hidden">
        <div className="flex flex-col md:flex-row items-stretch">
          <div className="flex-1 p-6 min-w-0">
            <div className="flex items-center gap-3 mb-3">
              <img src={emblem} alt="" className="w-9 h-9 object-contain" />
              <div>
                <div className="tag-plain">SHIRO MECHA TOOLKIT</div>
                <div className="display font-bold text-[1.05rem]">{t('app.name')}</div>
              </div>
            </div>

            <h2 className="display font-bold text-ink leading-tight" style={{ fontSize: 'var(--fs-display)' }}>
              {t('about.title')}
            </h2>
            <p className="text-[0.8rem] text-ink-2 leading-relaxed mt-2 max-w-xl">{t('about.intro')}</p>

            <div className="flex flex-wrap items-center gap-2 mt-4">
              <Badge tone="ok">
                <ShieldCheck size={11} />
                {t('common.no')} telemetry
              </Badge>
              <Badge tone="brand">MIT</Badge>
              <Badge>v{meta?.version || '1.0.0'}</Badge>
              <Badge>{meta?.platform || '—'}</Badge>
            </div>

            <div className="flex flex-wrap gap-2 mt-5">
              <Btn variant="primary" onClick={() => meta?.repository && api.openExternal(meta.repository)}>
                <Code2 size={13} />
                {t('about.repo')}
              </Btn>
              <Btn onClick={() => api.openExternal('https://github.com/Jingluohi/SteamToolPlus')}>
                <ExternalLink size={13} />
                SteamToolPlus
              </Btn>
              <Btn onClick={() => api.openExternal('https://github.com/BeyondDimension/SteamTools')}>
                <ExternalLink size={13} />
                Watt Toolkit
              </Btn>
            </div>
          </div>

          <div className="relative w-full md:w-[240px] flex-none min-h-[180px]">
            <div className="absolute inset-0 blueprint-fine opacity-70" />
            <img src={pilotFull} alt="" className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[250px] object-contain float-soft pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-r from-surface-panel via-transparent to-transparent md:from-surface-panel/90" />
          </div>
        </div>
        <div className="ruler opacity-60" />
      </Panel>

      <div className="grid grid-cols-12 gap-4">
        {/* --------------------------- 许可证 --------------------------- */}
        <Panel className="col-span-12 lg:col-span-6">
          <PanelHead index="10-A" title={t('about.opensource')} icon={<Scale size={14} />} />
          <PanelBody>
            <div className="flex items-start gap-3 mb-4">
              <span className="w-9 h-9 flex-none flex items-center justify-center bg-brand-soft text-brand border border-[rgba(30,95,209,0.22)]">
                <Scale size={16} />
              </span>
              <p className="text-[0.78rem] text-ink-2 leading-relaxed">{t('about.openSourceDesc')}</p>
            </div>
            <KV k={t('about.author')} v={`${meta?.author || '岚川怀瑾'}`} />
            <KV k={t('about.version')} v={<span className="mono">{meta?.version || '1.0.0'}</span>} />
            <KV k={t('about.license')} v={<span className="mono">MIT License</span>} />
            <KV k="repository" v={<span className="mono text-[0.7rem] break-all">{meta?.repository || '—'}</span>} />

            <div className="mt-4 p-3 bg-surface-2 border border-line">
              <div className="text-[0.68rem] text-ink-3 mb-1.5">MIT LICENSE</div>
              <p className="text-[0.68rem] text-ink-2 leading-relaxed">
                Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
                associated documentation files, to deal in the Software without restriction, including without
                limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies.
              </p>
            </div>
          </PanelBody>
        </Panel>

        {/* --------------------------- 捐赠 --------------------------- */}
        <Panel className="col-span-12 lg:col-span-6">
          <PanelHead index="10-B" title={t('about.donate')} icon={<Heart size={14} />} />
          <PanelBody>
            <p className="text-[0.78rem] text-ink-2 leading-relaxed mb-4">{t('about.donateDesc')}</p>

            <div className="space-y-2.5">
              {links.map((l) => (
                <button
                  key={l.key}
                  onClick={() => setActive(l.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 border no-drag text-left transition-colors ${
                    active === l.key ? 'border-brand bg-brand-soft' : 'border-line bg-surface-2 hover:bg-surface-panel'
                  }`}
                >
                  <span
                    className={`w-8 h-8 flex-none flex items-center justify-center border ${
                      active === l.key ? 'bg-brand text-white border-brand' : 'bg-surface-panel text-ink-3 border-line-2'
                    }`}
                  >
                    {l.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.8rem] text-ink font-medium">{l.label}</span>
                    <span className="block mono text-[0.66rem] text-ink-3">{l.desc}</span>
                  </span>
                  <ExternalLink size={13} className="text-ink-3 flex-none" />
                </button>
              ))}
            </div>

            <div className="flex gap-2 mt-4">
              <Btn
                variant="primary"
                className="flex-1"
                onClick={() => {
                  const url = links.find((l) => l.key === active)?.url
                  if (url) api.openExternal(url)
                }}
              >
                <Heart size={13} />
                {t('about.donate')}
              </Btn>
            </div>

            <div className="mt-4 p-3 border border-[rgba(201,132,16,0.3)] bg-warn-soft">
              <div className="flex items-center gap-2 mb-1.5">
                <Info size={13} className="text-warn" />
                <span className="text-[0.75rem] font-medium text-ink">{t('about.legal')}</span>
              </div>
              <p className="text-[0.7rem] text-ink-2 leading-relaxed">{t('about.legalDesc')}</p>
            </div>
          </PanelBody>
        </Panel>

        {/* --------------------------- 环境 --------------------------- */}
        <Panel className="col-span-12">
          <PanelHead index="10-C" title={t('about.env')} icon={<Sparkles size={14} />} />
          <PanelBody>
            <div className="grid grid-cols-12 gap-x-6">
              <div className="col-span-12 md:col-span-4">
                <SectionTitle>runtime</SectionTitle>
                <KV k="Electron" v={<span className="mono">{meta?.electron || '—'}</span>} />
                <KV k="Chromium" v={<span className="mono">{meta?.chrome || '—'}</span>} />
                <KV k="Node" v={<span className="mono">{meta?.node || '—'}</span>} />
                <KV k="platform" v={<span className="mono">{meta?.platform || '—'}</span>} />
                <KV k="arch" v={<span className="mono">{meta?.arch || '—'}</span>} />
              </div>
              <div className="col-span-12 md:col-span-4">
                <SectionTitle>data</SectionTitle>
                <KV k={t('set.configPath')} v={<span className="mono text-[0.68rem] break-all">{meta?.userData || '—'}</span>} />
                <KV k={t('common.notAdmin')} v={meta?.admin ? t('common.no') : t('common.yes')} />
              </div>
              <div className="col-span-12 md:col-span-4">
                <SectionTitle>credits</SectionTitle>
                <div className="text-[0.72rem] text-ink-2 leading-relaxed space-y-1.5">
                  <div>· 功能设计参考了 Watt Toolkit (SteamTools) 与 SteamToolPlus 的公开思路</div>
                  <div>· 界面与实现均为本项目原创，MIT 许可</div>
                  <div>· {t('about.thanks')}</div>
                </div>
              </div>
            </div>
          </PanelBody>
        </Panel>
      </div>
    </div>
  )
}
