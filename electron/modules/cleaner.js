'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const sysinfo = require('./sysinfo');

/**
 * 缓存清理
 *
 * 设计原则：**只清明确安全的目录**，每一项都告诉用户「这是什么、删了会怎样」，
 * 且默认只勾选风险最低的。不对系统目录做递归删除。
 */

function dirSize(dir, limit = 40000) {
  let total = 0;
  let count = 0;
  const stack = [dir];
  while (stack.length && count < limit) {
    const cur = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true });
    } catch (_) {
      continue;
    }
    for (const e of entries) {
      const full = path.join(cur, e.name);
      count++;
      if (count > limit) break;
      try {
        if (e.isDirectory()) stack.push(full);
        else if (e.isFile()) total += fs.statSync(full).size;
      } catch (_) {
        /* 没权限就跳过 */
      }
    }
  }
  return { size: total, count, truncated: count >= limit };
}

function tempDir() {
  return os.tmpdir();
}

function scan() {
  const steam = sysinfo.detectSteam();
  const items = [];

  if (steam.found) {
    const depot = path.join(steam.root, 'appcache', 'depotcache');
    if (fs.existsSync(depot)) {
      const s = dirSize(depot);
      items.push({
        id: 'steam-depotcache',
        name: 'Steam 下载缓存清单',
        path: depot,
        size: s.size,
        files: s.count,
        risk: 'safe',
        desc: '已经下完的游戏清单缓存。删掉后 Steam 会重新下载清单，不影响已装好的游戏。'
      });
    }

    const htmlcache = path.join(steam.root, 'appcache', 'httpcache');
    if (fs.existsSync(htmlcache)) {
      const s = dirSize(htmlcache);
      items.push({
        id: 'steam-httpcache',
        name: 'Steam 内置浏览器缓存',
        path: htmlcache,
        size: s.size,
        files: s.count,
        risk: 'safe',
        desc: '商店页面、社区页面的网页缓存。删除后首次打开会慢一点，无其它影响。'
      });
    }

    const logs = path.join(steam.root, 'logs');
    if (fs.existsSync(logs)) {
      const s = dirSize(logs);
      items.push({
        id: 'steam-logs',
        name: 'Steam 日志',
        path: logs,
        size: s.size,
        files: s.count,
        risk: 'safe',
        desc: '客户端运行日志，排障时才需要。可以放心删。'
      });
    }

    const dumps = path.join(steam.root, 'dumps');
    if (fs.existsSync(dumps)) {
      const s = dirSize(dumps);
      items.push({
        id: 'steam-dumps',
        name: 'Steam 崩溃转储',
        path: dumps,
        size: s.size,
        files: s.count,
        risk: 'safe',
        desc: '客户端崩溃时留下的内存转储文件，单个可能几百 MB，删掉不影响使用。'
      });
    }

    const shadercache = path.join(steam.root, 'steamapps', 'shadercache');
    if (fs.existsSync(shadercache)) {
      const s = dirSize(shadercache);
      items.push({
        id: 'steam-shadercache',
        name: '着色器预编译缓存',
        path: shadercache,
        size: s.size,
        files: s.count,
        risk: 'medium',
        desc: '某些支持预编译的游戏（如 Dota2、部分 Vulkan 游戏）的着色器缓存。删掉后首次进游戏会重新编译，可能卡一小会儿。'
      });
    }
  }

  const t = tempDir();
  if (fs.existsSync(t)) {
    const s = dirSize(t);
    items.push({
      id: 'system-temp',
      name: '用户临时文件夹',
      path: t,
      size: s.size,
      files: s.count,
      risk: 'medium',
      desc: '系统和各软件留下的临时文件。正在运行的程序占用的文件会自动跳过。'
    });
  }

  let appCache = null;
  try {
    const base = require('electron').app.getPath('userData');
    appCache = path.join(base, 'Cache');
  } catch (_) {
    appCache = path.join(os.homedir(), '.shiro-mecha-toolkit', 'Cache');
  }
  if (fs.existsSync(appCache)) {
    const s = dirSize(appCache);
    items.push({
      id: 'app-cache',
      name: '本程序界面缓存',
      path: appCache,
      size: s.size,
      files: s.count,
      risk: 'safe',
      desc: '本程序自己的界面缓存，删掉只会让首次打开稍慢。'
    });
  }

  return {
    items,
    totalSize: items.reduce((n, i) => n + i.size, 0),
    scannedAt: Date.now()
  };
}

function removeDirContents(dir) {
  let freed = 0;
  let removed = 0;
  let skipped = 0;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_) {
    return { freed, removed, skipped };
  }

  for (const e of entries) {
    const full = path.join(dir, e.name);
    try {
      if (e.isDirectory()) {
        const s = dirSize(full);
        fs.rmSync(full, { recursive: true, force: true });
        freed += s.size;
        removed++;
      } else if (e.isFile()) {
        const size = fs.statSync(full).size;
        fs.unlinkSync(full);
        freed += size;
        removed++;
      }
    } catch (_) {
      skipped++;
    }
  }
  return { freed, removed, skipped };
}

function run(ids) {
  const want = Array.isArray(ids) ? ids : [];
  const scanned = scan();
  const results = [];

  for (const item of scanned.items) {
    if (!want.includes(item.id)) continue;
    const r = removeDirContents(item.path);
    results.push({ id: item.id, name: item.name, path: item.path, ...r });
  }

  return {
    results,
    freed: results.reduce((n, r) => n + r.freed, 0),
    finishedAt: Date.now()
  };
}

module.exports = { scan, run, dirSize };
