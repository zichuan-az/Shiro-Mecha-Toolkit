'use strict';

/**
 * 资源库 · Depot Bay
 *
 * 三件事：
 *   1. 直链源管理      你自己维护一份源清单（直链 / 镜像 / 磁力 / JSON 索引），程序负责排队、断点、多线程、自动解压
 *   2. depot 拉取      用 Valve 官方的 steamcmd 走 download_depot，把 depot 内容拉到本地再归位到游戏目录
 *   3. 离线版处理      写好 steam_appid.txt、生成一个直启用的启动脚本、给出离线模式步骤
 *
 * 程序不内置任何下载链接，源清单完全由你自己维护，本地 JSON 存一份，不上传。
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const https = require('node:https');
const { spawn } = require('node:child_process');

const sysinfo = require('./sysinfo');

/* ================================================================== */
/* 存储                                                                */
/* ================================================================== */

let storePath = null;
let rootDir = null;

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
  storePath = path.join(base, 'depot-sources.json');
  return storePath;
}

function workDir() {
  if (rootDir) return rootDir;
  rootDir = path.join(userDataDir(), 'depot');
  fs.mkdirSync(rootDir, { recursive: true });
  return rootDir;
}

function read() {
  try {
    const raw = JSON.parse(fs.readFileSync(store(), 'utf8'));
    return Array.isArray(raw) ? raw : [];
  } catch (_) {
    return [];
  }
}

function write(list) {
  fs.writeFileSync(store(), JSON.stringify(list, null, 2), 'utf8');
  return list;
}

/* ================================================================== */
/* 源清单                                                              */
/* ================================================================== */

const KINDS = ['direct', 'mirror', 'magnet', 'index', 'api'];

function normalize(item) {
  const url = String(item.url || '').trim();
  let kind = KINDS.includes(item.kind) ? item.kind : '';
  if (!kind) {
    if (/^magnet:/i.test(url)) kind = 'magnet';
    else if (/\.(json|txt|csv)$/i.test(url)) kind = 'index';
    else kind = 'direct';
  }
  return {
    id: item.id || crypto.randomUUID(),
    name: String(item.name || '').trim() || '未命名资源',
    appid: String(item.appid || '').replace(/\D/g, ''),
    url,
    kind,
    version: String(item.version || '').slice(0, 40),
    size: Number(item.size || 0),
    note: String(item.note || '').slice(0, 300),
    tags: Array.isArray(item.tags) ? item.tags.map((t) => String(t).slice(0, 24)).slice(0, 8) : [],
    addedAt: item.addedAt || Date.now()
  };
}

function sources() {
  return { sources: read(), dirs: { work: workDir(), download: true } };
}

function addSource(item) {
  const list = read();
  const next = normalize(item || {});
  if (!next.url && next.kind !== 'index') throw new Error('请填写资源地址');
  const idx = list.findIndex((e) => e.id === next.id);
  if (idx >= 0) list[idx] = { ...list[idx], ...next };
  else list.push(next);
  write(list);
  return { sources: read(), item: next };
}

function removeSource(id) {
  return { sources: write(read().filter((e) => e.id !== id)) };
}

function updateSource(id, patch) {
  const list = read();
  const idx = list.findIndex((e) => e.id === id);
  if (idx < 0) throw new Error('没有找到这条资源');
  list[idx] = { ...list[idx], ...patch, id };
  write(list);
  return { sources: read() };
}

/** 从 JSON / CSV / TXT 索引里批量导入 */
function importIndex(filePath, options = {}) {
  const file = String(filePath || '').trim();
  if (!file || !fs.existsSync(file)) throw new Error('找不到这个索引文件');
  const text = fs.readFileSync(file, 'utf8');
  const items = [];
  const ext = path.extname(file).toLowerCase();

  const push = (raw) => {
    if (!raw) return;
    if (typeof raw === 'string') {
      const parts = raw.split(/[,|\t]/).map((s) => s.trim());
      const url = parts.find((p) => /^(https?:|magnet:)/i.test(p));
      if (!url) return;
      const name = parts.find((p) => p && p !== url) || path.basename(url).slice(0, 40) || '导入资源';
      const appid = (parts.find((p) => /^\d{3,8}$/.test(p)) || '');
      items.push(normalize({ name, url, appid }));
      return;
    }
    if (raw && typeof raw === 'object') {
      const url = raw.url || raw.link || raw.download || raw.magnet || '';
      if (!url) return;
      items.push(
        normalize({
          name: raw.name || raw.title || raw.game || '导入资源',
          url,
          appid: raw.appid || raw.appId || raw.id || '',
          kind: raw.kind,
          size: raw.size || raw.filesize || 0,
          version: raw.version || raw.buildid || '',
          note: raw.note || raw.desc || '',
          tags: raw.tags || (raw.tag ? [raw.tag] : [])
        })
      );
    }
  };

  if (ext === '.json') {
    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      throw new Error('JSON 解析失败：' + String(err.message || err));
    }
    if (Array.isArray(data)) data.forEach(push);
    else if (data && Array.isArray(data.items)) data.items.forEach(push);
    else if (data && Array.isArray(data.list)) data.list.forEach(push);
    else if (data && Array.isArray(data.games)) data.games.forEach(push);
    else if (data && typeof data === 'object') Object.values(data).forEach(push);
  } else {
    text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
      .forEach(push);
  }

  if (!items.length) throw new Error('这个文件里没解析出可用的地址');

  const list = read();
  const existing = new Set(list.map((e) => e.url));
  let added = 0;
  for (const it of items) {
    if (existing.has(it.url)) continue;
    existing.add(it.url);
    if (options.defaultName && !it.name) it.name = options.defaultName;
    list.push(it);
    added++;
  }
  write(list);
  return { sources: read(), parsed: items.length, added, skipped: items.length - added };
}

function exportIndex(filePath) {
  const out = filePath || path.join(os.homedir(), 'Desktop', `shiro-sources-${Date.now()}.json`);
  fs.writeFileSync(out, JSON.stringify(read(), null, 2), 'utf8');
  return { file: out, count: read().length };
}

/* ================================================================== */
/* 排队进多线程下载器                                                    */
/* ================================================================== */

async function queue(id, options = {}) {
  const item = read().find((e) => e.id === id);
  if (!item) throw new Error('没有找到这条资源');
  if (item.kind === 'magnet') throw new Error('磁力链需要 BT 客户端处理，把它复制出来丢进你的下载器就行');
  if (item.kind === 'index') throw new Error('这是一条索引，不是文件地址，请先导入它');

  const downloader = require('./downloader');
  const task = await downloader.start({
    url: item.url,
    name: item.name + (item.version ? ` ${item.version}` : ''),
    saveDir: options.saveDir || undefined
  });
  return { task, item };
}

async function queueMany(ids, options = {}) {
  const results = [];
  for (const id of Array.isArray(ids) ? ids : [ids]) {
    try {
      results.push({ id, ok: true, ...(await queue(id, options)) });
    } catch (err) {
      results.push({ id, ok: false, error: String((err && err.message) || err) });
    }
  }
  return { results };
}

/* ================================================================== */
/* steamcmd                                                            */
/* ================================================================== */

const STEAMCMD_URL = 'https://steamcdn-a.akamaihd.net/client/installer/steamcmd.zip';

function steamcmdRoot() {
  return path.join(workDir(), 'steamcmd');
}

function steamcmdPath() {
  const root = steamcmdRoot();
  if (process.platform === 'win32') {
    const exe = path.join(root, 'steamcmd.exe');
    if (fs.existsSync(exe)) return exe;
  }
  const sh = path.join(root, 'steamcmd.sh');
  if (fs.existsSync(sh)) return sh;
  return null;
}

function steamcmdState() {
  const exe = steamcmdPath();
  const jobs = [...jobMap.values()].map(publicJob);
  return {
    installed: !!exe,
    path: exe || '',
    root: steamcmdRoot(),
    url: STEAMCMD_URL,
    jobs: jobs.sort((a, b) => b.createdAt - a.createdAt)
  };
}

function downloadFile(url, dest, timeout = 120000) {
  return new Promise((resolve, reject) => {
    const tmp = `${dest}.part`;
    const file = fs.createWriteStream(tmp);
    const req = https.get(url, { timeout, headers: { 'user-agent': 'ShiroMechaToolkit/1.1' } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.rmSync(tmp, { force: true });
        return downloadFile(res.headers.location, dest, timeout).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.rmSync(tmp, { force: true });
        return reject(new Error(`下载失败，HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close(() => {
          fs.renameSync(tmp, dest);
          resolve({ file: dest, size: fs.statSync(dest).size });
        });
      });
    });
    req.on('timeout', () => req.destroy(new Error('下载超时')));
    req.on('error', (err) => {
      try {
        file.close();
      } catch (_) {
        /* 忽略 */
      }
      fs.rmSync(tmp, { force: true });
      reject(err);
    });
  });
}

async function installSteamcmd() {
  const root = steamcmdRoot();
  fs.mkdirSync(root, { recursive: true });
  const zip = path.join(root, 'steamcmd.zip');
  await downloadFile(STEAMCMD_URL, zip);

  let AdmZip;
  try {
    AdmZip = require('adm-zip');
  } catch (_) {
    throw new Error('缺少解压组件，无法展开 steamcmd 压缩包');
  }
  new AdmZip(zip).extractAllTo(root, true);

  const exe = steamcmdPath();
  if (!exe) throw new Error('展开完了但没找到 steamcmd 可执行文件');
  if (process.platform !== 'win32') {
    try {
      fs.chmodSync(exe, 0o755);
      for (const f of fs.readdirSync(root)) {
        if (f.endsWith('.sh')) fs.chmodSync(path.join(root, f), 0o755);
      }
    } catch (_) {
      /* 忽略 */
    }
  }
  return { path: exe, root };
}

/* ------------------------------ depot 任务 ------------------------------ */

const jobMap = new Map();
let broadcast = () => {};

function attach(fn) {
  broadcast = typeof fn === 'function' ? fn : () => {};
}

function publicJob(job) {
  return {
    id: job.id,
    appid: job.appid,
    depotId: job.depotId,
    manifestId: job.manifestId,
    targetDir: job.targetDir || '',
    status: job.status,
    progress: job.progress,
    downloaded: job.downloaded,
    total: job.total,
    speed: job.speed,
    output: job.output.slice(-80),
    message: job.message,
    createdAt: job.createdAt,
    finishedAt: job.finishedAt,
    outputDir: job.outputDir || ''
  };
}

async function depotPull(input = {}) {
  const appid = String(input.appid || '').replace(/\D/g, '');
  const depotId = String(input.depotId || '').replace(/\D/g, '');
  if (!/^\d+$/.test(appid)) throw new Error('AppID 必须是纯数字');
  if (!/^\d+$/.test(depotId)) throw new Error('DepotID 必须是纯数字');

  const exe = steamcmdPath();
  if (!exe) throw new Error('还没装 steamcmd，先点「下载 steamcmd」');

  const job = {
    id: crypto.randomUUID(),
    appid,
    depotId,
    manifestId: String(input.manifestId || '').replace(/\D/g, ''),
    targetDir: String(input.targetDir || '').trim(),
    status: 'running',
    progress: 0,
    downloaded: 0,
    total: 0,
    speed: 0,
    output: [],
    message: '正在启动 steamcmd…',
    createdAt: Date.now(),
    finishedAt: 0,
    outputDir: '',
    child: null
  };
  jobMap.set(job.id, job);
  broadcast('depot:progress', [...jobMap.values()].map(publicJob));

  const args = ['+force_install_dir', path.join(workDir(), 'steamcmd-out'), '+login', input.login || 'anonymous', '+download_depot', appid, depotId];
  if (job.manifestId) args.push(job.manifestId);
  args.push('+quit');

  let child;
  try {
    child = spawn(exe, args, { cwd: steamcmdRoot(), windowsHide: true });
  } catch (err) {
    job.status = 'failed';
    job.message = String(err.message || err);
    jobMap.set(job.id, job);
    throw err;
  }
  job.child = child;

  let lastBytes = 0;
  let lastAt = Date.now();

  const onData = (buf) => {
    const text = buf.toString();
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      job.output.push(line);
      if (job.output.length > 400) job.output.shift();

      const p = line.match(/progress:\s*([\d.]+)\s*\((\d+)\s*\/\s*(\d+)\)/i);
      if (p) {
        job.progress = Number(p[1]) / 100;
        job.downloaded = Number(p[2]);
        job.total = Number(p[3]);
        const now = Date.now();
        const dt = (now - lastAt) / 1000;
        if (dt > 0.4) {
          job.speed = Math.max(0, (job.downloaded - lastBytes) / dt);
          lastBytes = job.downloaded;
          lastAt = now;
        }
        job.message = `下载中 ${(job.progress * 100).toFixed(1)}%`;
      } else if (/Success\.\s*Downloaded depot/i.test(line)) {
        job.status = 'done';
        job.progress = 1;
        job.message = '拉取完成';
        const m = line.match(/to\s+"?([^"\n]+?)"?\s*$/i);
        if (m) job.outputDir = m[1].trim();
      } else if (/ERROR!|FAILED|No subscription|Invalid|Access Denied/i.test(line)) {
        job.status = 'failed';
        job.message = line.slice(0, 200);
      } else if (!/^Loading Steam API/i.test(line) && line.length > 3) {
        job.message = line.slice(0, 160);
      }
      broadcast('depot:progress', [...jobMap.values()].map(publicJob));
    }
  };

  child.stdout.on('data', onData);
  child.stderr.on('data', onData);
  child.on('error', (err) => {
    job.status = 'failed';
    job.message = String(err.message || err);
    broadcast('depot:progress', [...jobMap.values()].map(publicJob));
  });
  child.on('close', (code) => {
    job.finishedAt = Date.now();
    if (job.status === 'running') {
      job.status = code === 0 ? 'done' : 'failed';
      job.message = code === 0 ? 'steamcmd 已退出' : `steamcmd 退出码 ${code}`;
    }
    job.progress = job.status === 'done' ? 1 : job.progress;
    // 尝试定位输出目录
    if (!job.outputDir) {
      const guess = path.join(workDir(), 'steamcmd-out', 'steamapps', 'content', `app_${appid}`, `depot_${depotId}`);
      if (fs.existsSync(guess)) job.outputDir = guess;
    }
    broadcast('depot:progress', [...jobMap.values()].map(publicJob));
  });

  return publicJob(job);
}

function depotJobs() {
  return [...jobMap.values()].map(publicJob).sort((a, b) => b.createdAt - a.createdAt);
}

function depotCancel(id) {
  const job = jobMap.get(id);
  if (!job) throw new Error('没有找到这个任务');
  try {
    if (job.child) job.child.kill();
  } catch (_) {
    /* 忽略 */
  }
  job.status = 'cancelled';
  job.message = '已取消';
  broadcast('depot:progress', [...jobMap.values()].map(publicJob));
  return publicJob(job);
}

function depotClear(id) {
  if (id) jobMap.delete(id);
  else jobMap.clear();
  return depotJobs();
}

/** 把拉下来的 depot 内容归位到游戏目录（只补不覆盖已有文件，除非指定覆盖） */
function depotApply(jobId, targetDir, options = {}) {
  const job = jobMap.get(jobId);
  if (!job) throw new Error('没有找到这个任务');
  const src = String(job.outputDir || '').trim();
  if (!src || !fs.existsSync(src)) throw new Error('还没有可用的输出目录，等任务跑完再试');
  const dst = String(targetDir || '').trim();
  if (!dst || !fs.existsSync(dst)) throw new Error('目标游戏目录不存在');

  const actions = [];
  const walk = (from, to) => {
    for (const e of fs.readdirSync(from, { withFileTypes: true })) {
      const a = path.join(from, e.name);
      const b = path.join(to, e.name);
      if (e.isDirectory()) {
        fs.mkdirSync(b, { recursive: true });
        walk(a, b);
        continue;
      }
      if (fs.existsSync(b)) {
        if (!options.overwrite) {
          actions.push(`跳过已存在 ${e.name}`);
          continue;
        }
        const backup = `${b}.shiro-backup`;
        if (!fs.existsSync(backup)) fs.copyFileSync(b, backup);
      }
      fs.copyFileSync(a, b);
      actions.push(`${path.join(path.relative(dst, to), e.name)}`);
    }
  };
  walk(src, dst);
  return { target: dst, source: src, copied: actions.length, actions: actions.slice(0, 200) };
}

/* ================================================================== */
/* 离线版处理                                                          */
/* ================================================================== */

function offlinePrep(input = {}) {
  const dir = String(input.gameDir || '').trim();
  if (!dir || !fs.existsSync(dir)) throw new Error('游戏目录不存在');
  const appid = String(input.appid || '').replace(/\D/g, '');
  const actions = [];

  if (appid) {
    const f = path.join(dir, 'steam_appid.txt');
    if (fs.existsSync(f)) fs.copyFileSync(f, `${f}.shiro-backup`);
    fs.writeFileSync(f, `${appid}\n`, 'utf8');
    actions.push('写入 steam_appid.txt');
  }

  let exe = String(input.exeName || '').trim();
  if (!exe) {
    const found = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && /\.exe$/i.test(e.name))
      .map((e) => ({ name: e.name, size: fs.statSync(path.join(dir, e.name)).size }))
      .sort((a, b) => b.size - a.size);
    exe = found[0] ? found[0].name : '';
  }
  if (!exe) throw new Error('没找到可执行文件，请手动指定');

  const args = String(input.launchArgs || '').trim();
  let script;
  let scriptName;

  if (process.platform === 'win32') {
    scriptName = '离线启动.bat';
    script = [
      '@echo off',
      'chcp 65001 >nul',
      'title 离线启动 · ' + (input.name || exe),
      args ? `start "" "%~dp0${exe}" ${args}` : `start "" "%~dp0${exe}"`,
      ''
    ].join('\r\n');
  } else {
    scriptName = 'offline-launch.sh';
    script = ['#!/usr/bin/env bash', `cd "$(dirname "$0")"`, args ? `./"${exe}" ${args} &` : `./"${exe}" &`, ''].join('\n');
  }

  const scriptPath = path.join(dir, scriptName);
  fs.writeFileSync(scriptPath, script, 'utf8');
  if (process.platform !== 'win32') {
    try {
      fs.chmodSync(scriptPath, 0o755);
    } catch (_) {
      /* 忽略 */
    }
  }
  actions.push(`生成启动脚本 ${scriptName}`);

  return {
    dir,
    exe,
    script: scriptPath,
    actions,
    steps: [
      'Steam 客户端 → 左上角「Steam」→「进入离线模式」，确认后拔网线也能进库。',
      appid ? `游戏根目录已有 steam_appid.txt（${appid}），大多数游戏会跳过客户端校验。` : '没填 AppID，跳过了 steam_appid.txt。',
      `双击 ${scriptName} 直接起游戏，不需要经过 Steam 的启动流程。`,
      '首次运行前建议先让游戏生成一次配置文件，之后再断网跑。'
    ]
  };
}

module.exports = {
  attach,
  sources,
  addSource,
  removeSource,
  updateSource,
  importIndex,
  exportIndex,
  queue,
  queueMany,
  steamcmdState,
  installSteamcmd,
  steamcmdPath,
  depotPull,
  depotJobs,
  depotCancel,
  depotClear,
  depotApply,
  offlinePrep,
  workDir,
  storeFile: store
};
