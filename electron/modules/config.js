'use strict';

const fs = require('node:fs');
const path = require('node:path');

/**
 * 极简配置存储：单个 JSON 文件，落在用户数据目录。
 * 不联网、不上传、不收集任何信息。
 */

const DEFAULTS = {
  schema: 1,
  language: 'zh',
  theme: 'shiro',
  accelerator: {
    autoStart: false,
    lastRunning: false,
    lastGroups: ['steam', 'github'],
    listenPort: 51789,
    mode: 'system-proxy',
    autoSetSystemProxy: false,
    customRules: []
  },
  download: {
    saveDir: '',
    concurrency: 4,
    segmentSize: 8,
    speedLimitKB: 0,
    autoExtract: true
  },
  steam: {
    apiKey: '',
    countryCode: 'CN',
    language: 'schinese',
    libraryPaths: [],
    steamPath: ''
  },
  behavior: {
    closeToTray: true,
    notifyOnTray: true,
    autoUpdateCheck: false,
    compactMode: false
  },
  ui: {
    lastPage: 'dashboard',
    minimizeToGame: false
  }
};

let state = null;
let file = null;

function resolveFile() {
  if (file) return file;
  // 尽量使用 Electron 的用户数据目录；脱离 Electron 环境时退回系统配置目录
  let base;
  try {
    base = require('electron').app.getPath('userData');
  } catch (_) {
    const home = process.env.HOME || process.env.USERPROFILE || '.';
    base = path.join(home, '.shiro-mecha-toolkit');
  }
  try {
    fs.mkdirSync(base, { recursive: true });
  } catch (_) {
    /* 目录已存在或不可写 */
  }
  file = path.join(base, 'config.json');
  return file;
}

function deepMerge(target, source) {
  const out = Array.isArray(target) ? [...target] : { ...target };
  for (const [k, v] of Object.entries(source || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && target && typeof target[k] === 'object' && !Array.isArray(target[k])) {
      out[k] = deepMerge(target[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function load() {
  if (state) return state;
  const f = resolveFile();
  let disk = {};
  try {
    disk = JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch (_) {
    disk = {};
  }
  state = deepMerge(DEFAULTS, disk);
  return state;
}

function save() {
  const f = resolveFile();
  try {
    fs.writeFileSync(f, JSON.stringify(state, null, 2), 'utf8');
  } catch (_) {
    /* 写入失败不阻塞运行 */
  }
}

function all() {
  return JSON.parse(JSON.stringify(load()));
}

function get(dotKey, fallback) {
  const s = load();
  const parts = String(dotKey).split('.');
  let cur = s;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return fallback;
    cur = cur[p];
  }
  return cur === undefined ? fallback : cur;
}

function set(dotKey, value) {
  const s = load();
  const parts = String(dotKey).split('.');
  let cur = s;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
  save();
  return all();
}

function reset() {
  state = JSON.parse(JSON.stringify(DEFAULTS));
  save();
  return all();
}

module.exports = { all, get, set, reset, DEFAULTS, path: resolveFile };
