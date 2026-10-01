'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const sysinfo = require('./sysinfo');
const steam = require('./steam');

/**
 * 游戏库
 *   · 已安装：扫描各个 Steam 库目录里的 appmanifest_*.acf
 *   · 想玩的：本地「待入库清单」，可以挂上下载直链，交给下载器多线程拉取
 *   · 详情：封面、简介、截图、发行商等，全部来自 Steam 官方商店接口
 */

let storePath = null;

function store() {
  if (storePath) return storePath;
  let base;
  try {
    base = require('electron').app.getPath('userData');
  } catch (_) {
    base = path.join(os.homedir(), '.shiro-mecha-toolkit');
  }
  fs.mkdirSync(base, { recursive: true });
  storePath = path.join(base, 'library.json');
  return storePath;
}

function readWishlist() {
  try {
    return JSON.parse(fs.readFileSync(store(), 'utf8'));
  } catch (_) {
    return [];
  }
}

function writeWishlist(list) {
  fs.writeFileSync(store(), JSON.stringify(list, null, 2), 'utf8');
}

/* --------------------------- appmanifest --------------------------- */

function parseAcf(text) {
  const pick = (key) => {
    const m = text.match(new RegExp(`"${key}"\\s+"([^"]*)"`));
    return m ? m[1] : '';
  };
  const size = Number(pick('SizeOnDisk') || 0);
  return {
    appid: pick('appid'),
    name: pick('name'),
    installDir: pick('installdir'),
    sizeOnDisk: size,
    stateFlags: Number(pick('StateFlags') || 0),
    lastUpdated: Number(pick('LastUpdated') || 0),
    buildId: pick('buildid')
  };
}

function installed() {
  const out = [];
  const seen = new Set();
  const root = sysinfo.detectSteam();
  if (!root.found) return out;

  for (const lib of root.libraryFolders) {
    const appsDir = path.join(lib, 'steamapps');
    if (!fs.existsSync(appsDir)) continue;
    let files = [];
    try {
      files = fs.readdirSync(appsDir).filter((f) => /^appmanifest_\d+\.acf$/.test(f));
    } catch (_) {
      continue;
    }
    for (const f of files) {
      try {
        const parsed = parseAcf(fs.readFileSync(path.join(appsDir, f), 'utf8'));
        if (!parsed.appid || seen.has(parsed.appid)) continue;
        seen.add(parsed.appid);
        const full = path.join(appsDir, 'common', parsed.installDir);
        out.push({
          appid: parsed.appid,
          name: parsed.name,
          sizeOnDisk: parsed.sizeOnDisk,
          lastUpdated: parsed.lastUpdated,
          installDir: full,
          installed: fs.existsSync(full),
          library: lib,
          coverUrl: `https://cdn.cloudflare.steamstatic.com/steam/apps/${parsed.appid}/header.jpg`,
          capsuleUrl: `https://cdn.cloudflare.steamstatic.com/steam/apps/${parsed.appid}/capsule_231x87.jpg`
        });
      } catch (_) {
        /* 单个文件坏了不影响整体 */
      }
    }
  }
  return out.sort((a, b) => b.lastUpdated - a.lastUpdated);
}

function manifest() {
  const root = sysinfo.detectSteam();
  const games = installed();
  return {
    steam: { found: root.found, root: root.root, libraryFolders: root.libraryFolders },
    installed: games,
    totalSize: games.reduce((n, g) => n + (g.sizeOnDisk || 0), 0),
    wishlist: readWishlist()
  };
}

async function detail(appid, lang = 'schinese') {
  const data = await steam.appDetails(appid, lang);
  const dlc = (data.dlc || []).length;
  return {
    appid: String(appid),
    name: data.name,
    type: data.type,
    shortDescription: data.short_description,
    detailedDescription: data.detailed_description,
    headerImage: data.header_image,
    capsuleImage: data.capsule_image,
    background: data.background,
    screenshots: (data.screenshots || []).slice(0, 8).map((s) => ({ thumb: s.path_thumbnail, full: s.path_full })),
    movies: (data.movies || []).slice(0, 4).map((m) => ({ thumb: m.thumbnail, webm: (m.webm && m.webm.max) || '' })),
    developers: data.developers || [],
    publishers: data.publishers || [],
    genres: (data.genres || []).map((g) => g.description),
    categories: (data.categories || []).slice(0, 12).map((c) => c.description),
    releaseDate: (data.release_date || {}).date,
    comingSoon: !!(data.release_date || {}).coming_soon,
    platforms: data.platforms || {},
    metacritic: (data.metacritic || {}).score || null,
    recommendations: (data.recommendations || {}).total || 0,
    dlcCount: dlc,
    isFree: data.is_free,
    price: data.price_overview
      ? {
          currency: data.price_overview.currency,
          initial: data.price_overview.initial,
          final: data.price_overview.final,
          discount: data.price_overview.discount_percent,
          formatted: data.price_overview.final_formatted
        }
      : null,
    requirements: data.pc_requirements || null,
    website: data.website || '',
    storeUrl: `https://store.steampowered.com/app/${appid}/`
  };
}

function add(appid, options = {}) {
  const list_ = readWishlist();
  const id = String(appid).trim();
  if (!/^\d+$/.test(id)) throw new Error('AppID 必须是纯数字');

  const entry = {
    id: crypto.randomUUID(),
    appid: id,
    name: options.name || `App ${id}`,
    coverUrl: options.coverUrl || `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/header.jpg`,
    downloadUrl: String(options.downloadUrl || '').trim(),
    extractDir: String(options.extractDir || '').trim(),
    note: String(options.note || '').slice(0, 200),
    autoExtract: options.autoExtract !== false,
    addedAt: Date.now()
  };

  const idx = list_.findIndex((e) => e.appid === id);
  if (idx >= 0) list_[idx] = { ...list_[idx], ...entry, id: list_[idx].id };
  else list_.push(entry);
  writeWishlist(list_);
  return { list: readWishlist() };
}

function list() {
  return { list: readWishlist(), installed: installed() };
}

function remove(id) {
  writeWishlist(readWishlist().filter((e) => e.id !== id));
  return { list: readWishlist() };
}

module.exports = { manifest, detail, add, list, remove, installed, parseAcf };
