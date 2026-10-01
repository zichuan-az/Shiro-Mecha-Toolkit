'use strict';

/**
 * 直链仓 · Link Bay
 *
 * 站源目录（离线版 / 补丁源 / 加速线路）+ 直链提取 + 排队下载。
 * 不内置、不抓取、不分发任何文件本身：目录里的地址来自 data/catalog.js
 * 和你自己在界面上填的内容，本模块只负责把它们交给你已有的下载器。
 *
 * Author: 岚川怀瑾 (LanChuanHuaJin) · MIT
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const https = require('node:https');
const http = require('node:http');
const { URL } = require('node:url');

const cfg = require('./config');
const downloader = require('./downloader');
const extractor = require('./extract');
const catalog = require('../data/catalog');

let storePath = null;

function userDataDir() {
  try {
    return require('electron').app.getPath('userData');
  } catch (_) {
    return path.join(os.homedir(), '.shiro-mecha-toolkit');
  }
}

function store() {
  if (storePath) return storePath;
  const base = userDataDir();
  fs.mkdirSync(base, { recursive: true });
  storePath = path.join(base, 'linkbay.json');
  return storePath;
}

const EMPTY = { links: {}, patches: {}, sites: [], mirrors: {}, history: [] };

function read() {
  try {
    const raw = JSON.parse(fs.readFileSync(store(), 'utf8'));
    return { ...EMPTY, ...raw };
  } catch (_) {
    return { ...EMPTY };
  }
}

function write(state) {
  fs.writeFileSync(store(), JSON.stringify(state, null, 2), 'utf8');
  return state;
}

/* ------------------------------------------------------------------ */
/* 目录                                                                */
/* ------------------------------------------------------------------ */

function mergeLinks(base, own) {
  const out = (own || []).map((l) => ({ ...l, origin: 'user' }));
  for (const l of base || []) out.push({ ...l, origin: 'builtin' });
  return out;
}

function sites() {
  const s = read();
  return catalog.SITES.map((site) => ({
    ...site,
    links: mergeLinks(site.links, s.links[site.id]),
    linkCount: (site.links || []).length + ((s.links[site.id] || []).length)
  }));
}

function patches() {
  const s = read();
  return catalog.PATCHES.map((p) => ({
    ...p,
    links: mergeLinks(p.links, s.patches[p.id]),
    ready: !!(p.url || (p.links || []).length || (s.patches[p.id] || []).length)
  }));
}

function mirrors() {
  const s = read();
  return catalog.MIRRORS.map((m) => ({ ...m, ...(s.mirrors[m.id] || {}) }));
}

function payload() {
  const s = read();
  return {
    sites: sites(),
    patches: patches(),
    mirrors: mirrors(),
    steamCdn: catalog.STEAM_CDN,
    history: s.history.slice(-30).reverse(),
    customSites: s.sites || [],
    store: store()
  };
}

/* ------------------------------------------------------------------ */
/* 用户自填的链接                                                       */
/* ------------------------------------------------------------------ */

function addLink(target, link) {
  const url = String((link && link.url) || '').trim();
  const label = String((link && link.label) || '').trim();
  const note = String((link && link.note) || '').trim();
  if (!url && !label && !note) throw new Error('至少填一个字段');

  const s = read();
  const bucket = target && target.startsWith('patch:') ? 'patches' : 'links';
  const id = target && target.startsWith('patch:') ? target.slice(6) : target;

  const known = bucket === 'links' ? catalog.SITES.some((x) => x.id === id) : catalog.PATCHES.some((x) => x.id === id);
  if (!known) throw new Error(`目录里没有 ${id} 这个条目`);

  const list = s[bucket][id] || [];
  if (url && list.some((l) => l.url === url)) throw new Error('这条地址已经有了');
  list.push({ label: label || url.slice(-28) || '未命名', url, note });
  s[bucket][id] = list;
  write(s);
  return payload();
}

function removeLink(target, index) {
  const s = read();
  const bucket = target && target.startsWith('patch:') ? 'patches' : 'links';
  const id = target && target.startsWith('patch:') ? target.slice(6) : target;
  const list = s[bucket][id] || [];
  const at = Number(index);
  if (!Number.isInteger(at) || at < 0 || at >= list.length) throw new Error('这条链接不在列表里');
  list.splice(at, 1);
  s[bucket][id] = list;
  write(s);
  return payload();
}

function addSite(site) {
  const url = String((site && site.url) || '').trim();
  if (!/^https?:\/\//i.test(url)) throw new Error('站点地址要以 http:// 或 https:// 开头');
  const s = read();
  s.sites = s.sites || [];
  if (s.sites.some((x) => x.url === url)) throw new Error('这个站点已经在列表里了');
  s.sites.push({
    id: `own-${Date.now().toString(36)}`,
    name: String((site && site.name) || '').trim() || new URL(url).hostname,
    url,
    region: 'custom',
    kind: 'custom',
    direct: true,
    risk: 'mid',
    speed: 'unknown',
    note: String((site && site.note) || '').trim(),
    noteEn: '',
    links: [],
    own: true
  });
  write(s);
  return payload();
}

function removeSite(id) {
  const s = read();
  s.sites = (s.sites || []).filter((x) => x.id !== id);
  write(s);
  return payload();
}

/* ------------------------------------------------------------------ */
/* 抓页面                                                              */
/* ------------------------------------------------------------------ */

function fetchText(url, { timeout = 15000, redirect = 0, referer } = {}) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (_) {
      reject(new Error('地址格式不对'));
      return;
    }
    const lib = parsed.protocol === 'http:' ? http : https;
    const req = lib.get(
      url,
      {
        timeout,
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36',
          accept: 'text/html,application/json,text/plain,*/*',
          'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
          ...(referer ? { referer } : {})
        }
      },
      (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirect < 6) {
          res.resume();
          const next = new URL(res.headers.location, url).toString();
          resolve(fetchText(next, { timeout, redirect: redirect + 1, referer: url }));
          return;
        }
        let buf = '';
        res.setEncoding('utf8');
        res.on('data', (c) => {
          if (buf.length < 4 * 1024 * 1024) buf += c;
        });
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            finalUrl: url,
            type: res.headers['content-type'] || '',
            text: buf
          })
        );
      }
    );
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('请求超时，这个站可能在挡爬虫'));
    });
    req.on('error', (e) => reject(new Error(e.message || '请求失败')));
  });
}

/* 归档后缀 —— 只挑看得出是文件的东西 */
const FILE_RE = /\.(rar|zip|7z|tar|gz|iso|exe|msi|apk|bin|pak|part\d+\.rar)$/i;
const HOST_RE =
  /(1fichier|pixeldrain|mediafire|mega\.nz|gofile|buzzheavier|krakenfiles|ddownload|rapidgator|1cloudfile|filecrypt|drive\.google|yandex|disk\.yandex|filen|send\.cm|bowfile|vikingfile|rootz|clicknupload|usersdrive|uploadhaven|mixdrop|megaup|drop\.download)/i;

function classify(url) {
  if (/^magnet:/i.test(url)) return 'magnet';
  if (/\.torrent$/i.test(url)) return 'torrent';
  if (FILE_RE.test(new URL(url, 'https://x.invalid').pathname)) return 'file';
  if (HOST_RE.test(url)) return 'host';
  return 'page';
}

/** 从 HTML 里把候选直链抠出来：a[href] / data-url / JSON 里的 url 字段都扫 */
function pick(html, base) {
  const found = new Map();
  const push = (raw) => {
    if (!raw) return;
    let u = raw.trim().replace(/&amp;/g, '&').replace(/^["']|["']$/g, '');
    if (!u || u.startsWith('#') || /^(javascript|mailto|data):/i.test(u)) return;
    try {
      u = new URL(u, base).toString();
    } catch (_) {
      return;
    }
    const kind = classify(u);
    if (kind === 'page') return;
    if (!found.has(u)) found.set(u, { url: u, kind, host: new URL(u).hostname.replace(/^www\./, '') });
  };

  const attr = /(?:href|data-url|data-href|data-link|data-file|src)\s*=\s*["']([^"']{8,600})["']/gi;
  let m;
  while ((m = attr.exec(html))) push(m[1]);

  const inline = /["'](https?:\\?\/\\?\/[^"'\s\\]{10,400})["']/gi;
  while ((m = inline.exec(html))) push(m[1].replace(/\\\//g, '/'));

  const magnet = /magnet:\?xt=urn:[^"'\s<]{20,400}/gi;
  while ((m = magnet.exec(html))) push(m[0]);

  // 有些站把真地址塞在跳转参数或 base64 里，顺手解一层
  const embedded = /[?&](?:url|u|link|target|goto|redirect|r|file)=([^"'\s&<>]{16,800})/gi;
  while ((m = embedded.exec(html))) {
    let raw = m[1];
    try {
      raw = decodeURIComponent(raw);
    } catch (_) {
      /* 解不开就原样试 */
    }
    if (/^https?:\/\//i.test(raw)) push(raw);
    else if (raw.length >= 20 && /^[A-Za-z0-9+/=_-]+$/.test(raw)) {
      try {
        const text = Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
        const hit = text.match(/https?:\/\/[^\s"'<>]{8,500}/);
        if (hit) push(hit[0]);
      } catch (_) {
        /* 不是 base64 就算了 */
      }
    }
  }

  return [...found.values()];
}

async function extract(input = {}) {
  const url = String(input.url || '').trim();
  if (!/^https?:\/\//i.test(url)) throw new Error('要提取的页面地址得是 http(s) 开头');
  const page = await fetchText(url, { timeout: Number(input.timeout) || 18000 });
  if (page.status >= 400) {
    throw new Error(`页面返回 ${page.status}，可能在挡爬虫（挂上梯子换个节点再试）`);
  }

  let items = pick(page.text, page.finalUrl);
  if (input.mirror) {
    items = items.map((it) => ({ ...it, accelerated: mirrorize(it.url, input.mirror) }));
  }

  let jsonSiblings = 0;
  if (!items.length && /json/i.test(page.type)) {
    try {
      const data = JSON.parse(page.text);
      const walk = (node) => {
        if (typeof node === 'string') {
          if (/^https?:\/\//i.test(node)) items.push({ url: node, kind: classify(node), host: new URL(node).hostname });
          return;
        }
        if (Array.isArray(node)) return node.forEach(walk);
        if (node && typeof node === 'object') Object.values(node).forEach(walk);
      };
      walk(data);
      jsonSiblings = items.length;
    } catch (_) {
      /* 不是 JSON 就算了 */
    }
  }

  const byHost = new Map();
  for (const it of items) {
    const list = byHost.get(it.host) || [];
    list.push(it);
    byHost.set(it.host, list);
  }

  return {
    source: page.finalUrl,
    status: page.status,
    total: items.length,
    fromJson: jsonSiblings,
    items: items.slice(0, 200),
    hosts: [...byHost.entries()].map(([host, list]) => ({ host, count: list.length })).sort((a, b) => b.count - a.count)
  };
}

/* ------------------------------------------------------------------ */
/* 线路                                                                */
/* ------------------------------------------------------------------ */

function mirrorize(url, id) {
  const m = catalog.MIRRORS.find((x) => x.id === id);
  if (!m) return url;
  if (!/^https?:\/\//i.test(url)) return url;
  return m.prefix + url.replace(/^https?:\/\//i, '');
}

/** 拿一个小文件测每条线路的握手 + 首字节时间 */
function timeMirror(m) {
  return new Promise((resolve) => {
    const probeUrl = m.prefix + 'https://raw.githubusercontent.com/electron/electron/main/README.md';
    const started = Date.now();
    const req = https.get(
      probeUrl,
      { timeout: 8000, headers: { 'user-agent': 'ShiroMechaToolkit/1.2' } },
      (res) => {
        const ttfb = Date.now() - started;
        const ok = res.statusCode >= 200 && res.statusCode < 400;
        res.resume();
        resolve({ id: m.id, name: m.name, ok, status: res.statusCode, ms: ttfb });
      }
    );
    req.on('timeout', () => {
      req.destroy();
      resolve({ id: m.id, name: m.name, ok: false, status: 0, ms: -1, error: 'timeout' });
    });
    req.on('error', () => resolve({ id: m.id, name: m.name, ok: false, status: 0, ms: -1, error: 'connect' }));
  });
}

async function probeMirrors(ids) {
  const list = catalog.MIRRORS.filter((m) => !ids || !ids.length || ids.includes(m.id));
  const results = await Promise.all(list.map(timeMirror));
  const ok = results.filter((r) => r.ok).sort((a, b) => a.ms - b.ms);
  const bad = results.filter((r) => !r.ok);

  const s = read();
  for (const r of results) s.mirrors[r.id] = { lastMs: r.ms, lastOk: r.ok, checkedAt: Date.now() };
  write(s);

  return { ranked: ok, failed: bad, checkedAt: Date.now() };
}

/* ------------------------------------------------------------------ */
/* 下载                                                                */
/* ------------------------------------------------------------------ */

function record(entry) {
  const s = read();
  s.history = (s.history || []).concat([{ ...entry, at: Date.now() }]).slice(-30);
  write(s);
}

async function queue(input = {}) {
  const raw = String(input.url || '').trim();
  if (!raw) throw new Error('没有可下载的地址');
  const url = input.mirror ? mirrorize(raw, input.mirror) : raw;

  const task = await downloader.start({
    url,
    name: input.name,
    saveDir: input.saveDir || cfg.get('download.saveDir'),
    threads: input.threads
  });

  record({ what: 'download', name: task.name, url, origin: input.origin || 'linkbay' });
  return { task, url, byMirror: input.mirror || null };
}

/** 补丁归档：先下下来，需要的话顺手拆开，最后告诉你去哪部署 */
async function patchFetch(input = {}) {
  const id = String(input.id || '').trim();
  const patch = catalog.PATCHES.find((p) => p.id === id);
  if (!patch) throw new Error('补丁源不在目录里');

  const own = read().patches[id] || [];
  const picked = input.url || (own[input.index || 0] || {}).url || own[0]?.url || '';
  const url = String(picked || patch.url || '').trim();
  if (!url) throw new Error('这条还没有填直链，在「直链仓 → 补丁源」里填一条再点');

  if (/cs\.rin\.ru|online-fix\.me/i.test(url) && !input.force) {
    return {
      needsLink: true,
      page: url,
      message: '这是论坛/发布页，不是直链。打开页面拿到真实文件地址后填进来再下。'
    };
  }

  const task = await queue({ ...input, url, name: input.name || `${patch.name}${path.extname(new URL(url).pathname)}` });
  record({ what: 'patch', name: task.task.name, url, patch: id });

  let unpacked = null;
  if (input.extract) {
    unpacked = await extractor
      .extract(task.task.filePath, input.targetDir)
      .catch((e) => ({ error: e.message || String(e) }));
  }

  return { task: task.task, url, unpacked, deployHint: patch.kind };
}

/* ------------------------------------------------------------------ */
/* 环境体检：给「直链仓」顶部那块状态条用                                */
/* ------------------------------------------------------------------ */

async function check(input = {}) {
  const url = String(input.url || '').trim();
  if (!/^https?:\/\//i.test(url)) throw new Error('地址得是 http(s) 开头');
  try {
    const head = await downloader.head(url);
    return {
      url,
      reachable: true,
      length: head.length || 0,
      ranges: !!head.ranges,
      filename: head.filename || '',
      multiThread: !!(head.ranges && head.length > 4 * 1024 * 1024)
    };
  } catch (e) {
    return { url, reachable: false, error: e.message || '连不上' };
  }
}

module.exports = {
  payload,
  sites,
  patches,
  mirrors,
  addLink,
  removeLink,
  addSite,
  removeSite,
  extract,
  mirrorize,
  probeMirrors,
  queue,
  patchFetch,
  check,
  store
};
