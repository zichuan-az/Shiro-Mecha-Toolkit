/**
 * Shiro Mecha Toolkit — 预加载脚本
 * 渲染进程与主进程之间的白名单桥。
 *
 * Author: 岚川怀瑾 (LanChuanHuaJin)
 * License: MIT
 */

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

const api = {
  app: {
    meta: () => invoke('app:meta'),
    openExternal: (url) => invoke('app:openExternal', url),
    copy: (text) => invoke('app:copy', text)
  },
  config: {
    all: () => invoke('config:all'),
    set: (key, value) => invoke('config:set', key, value),
    reset: () => invoke('config:reset')
  },
  hosts: {
    read: () => invoke('hosts:read'),
    preview: (ids) => invoke('hosts:preview', ids),
    apply: (ids) => invoke('hosts:apply', ids),
    restore: (id) => invoke('hosts:restore', id),
    backups: () => invoke('hosts:backups'),
    groups: () => invoke('hosts:groups')
  },
  accel: {
    status: () => invoke('accel:status'),
    start: (ids) => invoke('accel:start', ids),
    stop: () => invoke('accel:stop'),
    probe: (targets) => invoke('accel:probe', targets),
    rules: () => invoke('accel:rules'),
    saveRules: (rules) => invoke('accel:saveRules', rules)
  },
  steam: {
    appDetails: (appid, lang) => invoke('steam:appDetails', appid, lang),
    search: (term, lang) => invoke('steam:search', term, lang),
    featured: (lang) => invoke('steam:featured', lang),
    freePromotions: (cc, lang) => invoke('steam:freePromotions', cc, lang),
    specials: (cc, lang) => invoke('steam:specials', cc, lang),
    playerSummary: (id, key) => invoke('steam:playerSummary', id, key),
    ownedGames: (id, key) => invoke('steam:ownedGames', id, key),
    achievements: (id, appid, key) => invoke('steam:achievements', id, appid, key)
  },
  steamid: {
    parse: (input) => invoke('steamid:parse', input),
    resolveVanity: (v, key) => invoke('steamid:resolveVanity', v, key)
  },
  guard: {
    code: (secret, offset) => invoke('guard:code', secret, offset),
    validate: (secret) => invoke('guard:validate', secret)
  },
  accounts: {
    list: () => invoke('acc:list'),
    save: (a) => invoke('acc:save', a),
    remove: (id) => invoke('acc:remove', id),
    switchTo: (id) => invoke('acc:switch', id)
  },
  library: {
    manifest: () => invoke('lib:manifest'),
    detail: (appid, lang) => invoke('lib:detail', appid, lang),
    add: (appid, options) => invoke('lib:add', appid, options),
    list: () => invoke('lib:list'),
    remove: (id) => invoke('lib:remove', id),
    pickDir: () => invoke('lib:pickDir'),
    openFolder: (p) => invoke('lib:openFolder', p)
  },
  downloads: {
    start: (task) => invoke('dl:start', task),
    pause: (id) => invoke('dl:pause', id),
    resume: (id) => invoke('dl:resume', id),
    cancel: (id) => invoke('dl:cancel', id),
    list: () => invoke('dl:list'),
    pickFile: () => invoke('dl:pickFile'),
    extract: (filePath, targetDir) => invoke('dl:extract', filePath, targetDir),
    archiveInfo: (filePath) => invoke('dl:archiveInfo', filePath)
  },
  cleaner: {
    scan: () => invoke('clean:scan'),
    run: (ids) => invoke('clean:run', ids)
  },
  patches: {
    scan: () => invoke('patch:scan'),
    list: () => invoke('patch:list'),
    add: (e) => invoke('patch:add', e),
    remove: (id) => invoke('patch:remove', id),
    guide: () => invoke('patch:guide'),
    deploy: (id, dir) => invoke('patch:deploy', id, dir)
  },
  vault: {
    guard: () => invoke('vault:guard'),
    libraries: () => invoke('vault:libraries'),
    appInfo: (appid, lang) => invoke('vault:appInfo', appid, lang),
    list: () => invoke('vault:list'),
    install: (input) => invoke('vault:install', input),
    remove: (id, options) => invoke('vault:remove', id, options),
    killSteam: () => invoke('vault:killSteam'),
    backups: () => invoke('vault:backups'),
    restoreBackup: (slot) => invoke('vault:restoreBackup', slot),
    depotCache: (library) => invoke('vault:depotCache', library),
    importManifests: (paths, library) => invoke('vault:importManifests', paths, library),
    exportManifests: (library, targetDir) => invoke('vault:exportManifests', library, targetDir),
    pickManifests: () => invoke('vault:pickFiles'),
    selftest: () => invoke('vault:selftest')
  },
  linkbay: {
    all: () => invoke('linkbay:all'),
    addLink: (target, link) => invoke('linkbay:addLink', target, link),
    removeLink: (target, index) => invoke('linkbay:removeLink', target, index),
    addSite: (site) => invoke('linkbay:addSite', site),
    removeSite: (id) => invoke('linkbay:removeSite', id),
    extract: (input) => invoke('linkbay:extract', input),
    mirrors: () => invoke('linkbay:mirrors'),
    mirrorize: (url, id) => invoke('linkbay:mirrorize', url, id),
    queue: (input) => invoke('linkbay:queue', input),
    patchFetch: (input) => invoke('linkbay:patchFetch', input),
    check: (input) => invoke('linkbay:check', input),
    pickDir: () => invoke('linkbay:pickDir')
  },
  bypass: {
    guide: () => invoke('bypass:guide'),
    profiles: () => invoke('bypass:profiles'),
    saveProfile: (p) => invoke('bypass:saveProfile', p),
    removeProfile: (id) => invoke('bypass:removeProfile', id),
    analyze: (dir) => invoke('bypass:analyze', dir),
    plan: (profile) => invoke('bypass:plan', profile),
    deploy: (id, dir) => invoke('bypass:deploy', id, dir),
    restore: (id) => invoke('bypass:restore', id),
    restoreLatest: () => invoke('bypass:restoreLatest'),
    points: () => invoke('bypass:points'),
    removePoint: (id) => invoke('bypass:removePoint', id),
    hosts: () => invoke('bypass:hosts'),
    hostsWrite: (domains) => invoke('bypass:hostsWrite', domains),
    firewallList: () => invoke('bypass:firewallList'),
    firewallAdd: (exe) => invoke('bypass:firewallAdd', exe),
    firewallRemove: (exe) => invoke('bypass:firewallRemove', exe)
  },
  depot: {
    sources: () => invoke('depot:sources'),
    addSource: (item) => invoke('depot:addSource', item),
    updateSource: (id, patch) => invoke('depot:updateSource', id, patch),
    removeSource: (id) => invoke('depot:removeSource', id),
    importIndex: (file, options) => invoke('depot:importIndex', file, options),
    exportIndex: (file) => invoke('depot:exportIndex', file),
    queue: (ids, options) => invoke('depot:queue', ids, options),
    steamcmdState: () => invoke('depot:steamcmdState'),
    installSteamcmd: () => invoke('depot:installSteamcmd'),
    pull: (input) => invoke('depot:pull', input),
    jobs: () => invoke('depot:jobs'),
    cancel: (id) => invoke('depot:cancel', id),
    clear: (id) => invoke('depot:clear', id),
    apply: (jobId, dir, options) => invoke('depot:apply', jobId, dir, options),
    offlinePrep: (input) => invoke('depot:offlinePrep', input)
  },
  scripts: {
    list: () => invoke('script:list'),
    save: (s) => invoke('script:save', s),
    remove: (id) => invoke('script:remove', id),
    run: (id, payload) => invoke('script:run', id, payload)
  },
  sys: {
    info: () => invoke('sys:info'),
    pickFile: (filters) => invoke('sys:pickFile', filters),
    openPath: (p) => invoke('sys:openPath', p)
  },
  win: {
    minimize: () => invoke('win:minimize'),
    maximize: () => invoke('win:maximize'),
    hide: () => invoke('win:hide'),
    mini: (on) => invoke('win:mini', on),
    close: () => invoke('win:close')
  },
  on: (channel, handler) => {
    const allowed = ['dl:progress', 'accel:changed', 'win:mini', 'accel:log', 'depot:progress'];
    if (!allowed.includes(channel)) return () => {};
    const listener = (_e, payload) => handler(payload);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  }
};

contextBridge.exposeInMainWorld('shiro', api);
