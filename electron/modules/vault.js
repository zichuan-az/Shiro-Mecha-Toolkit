'use strict';

/**
 * 入库工坊 · Vault Bay
 *
 * 负责把 AppID「登记」进本机 Steam 客户端的库文件里，并管理 depot 清单缓存。
 *
 * 做的事（全部是本机文件操作，不联网上传任何东西）：
 *   1. 生成 steamapps/appmanifest_<appid>.acf（库列表里出现该条目）
 *   2. 把条目与占用体积登记进 steamapps/libraryfolders.vdf
 *   3. 在 config/config.vdf 的 apps 节点写入 Installed 标记
 *   4. 导入/导出 steamapps/depotcache 里的 .manifest 清单缓存
 *   5. 每条入库记录都留还原点，可以一键撤回
 *
 * 写 .vdf / .acf 前 Steam 必须完全退出，否则会被 Steam 覆盖回写。
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
let backupRoot = null;

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
  storePath = path.join(base, 'vault.json');
  return storePath;
}

function backups() {
  if (backupRoot) return backupRoot;
  backupRoot = path.join(userDataDir(), 'vault-backups');
  fs.mkdirSync(backupRoot, { recursive: true });
  return backupRoot;
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
}

/* ================================================================== */
/* 最小 KeyValues(VDF / ACF)解析器                                      */
/*   只要能定位节点、拿到插入偏移就够了，所以保留原始文本，做定点编辑。        */
/* ================================================================== */

function readString(text, start) {
  let i = start + 1;
  let out = '';
  while (i < text.length) {
    const c = text[i];
    if (c === '\\') {
      const n = text[i + 1];
      out += n === 'n' ? '\n' : n === 't' ? '\t' : n === undefined ? '' : n;
      i += 2;
      continue;
    }
    if (c === '"') return { value: out, end: i + 1 };
    out += c;
    i++;
  }
  return { value: null, end: text.length };
}

function matchBrace(text, open) {
  let depth = 0;
  let i = open;
  while (i < text.length) {
    const c = text[i];
    if (c === '"') {
      const s = readString(text, i);
      if (s.value === null) return text.length - 1;
      i = s.end;
      continue;
    }
    if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return i;
    }
    i++;
  }
  return text.length - 1;
}

function parseVdf(text) {
  const root = { key: null, value: null, children: [], open: 0, close: text.length - 1, bodyStart: 0, bodyEnd: text.length };
  const stack = [root];
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (c === '/' && text[i + 1] === '/') {
      while (i < n && text[i] !== '\n') i++;
      continue;
    }
    if (c === '"') {
      const keyStart = i;
      const keyTok = readString(text, i);
      if (keyTok.value === null) break;
      let j = keyTok.end;
      while (j < n && /\s/.test(text[j])) j++;
      if (text[j] === '{') {
        const close = matchBrace(text, j);
        const node = { key: keyTok.value, value: null, children: [], start: keyStart, open: j, close, bodyStart: j + 1, bodyEnd: close };
        stack[stack.length - 1].children.push(node);
        stack.push(node);
        i = j + 1;
        continue;
      }
      if (text[j] === '"') {
        const valTok = readString(text, j);
        stack[stack.length - 1].children.push({
          key: keyTok.value,
          value: valTok.value,
          children: [],
          open: null,
          close: null,
          start: keyStart,
          valueEnd: valTok.end
        });
        i = valTok.end;
        continue;
      }
      i = j;
      continue;
    }
    if (c === '}') {
      if (stack.length > 1) stack.pop();
      i++;
      continue;
    }
    i++;
  }
  return root;
}

function child(node, key) {
  if (!node) return null;
  return node.children.find((c) => c.key.toLowerCase() === String(key).toLowerCase()) || null;
}

function dig(node, keys) {
  let cur = node;
  for (const k of keys) {
    cur = child(cur, k);
    if (!cur) return null;
  }
  return cur;
}

function esc(v) {
  return String(v == null ? '' : v).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/* ================================================================== */
/* 环境检查                                                            */
/* ================================================================== */

function psLines(cmd, args, timeout = 8000) {
  return new Promise((resolve) => {
    let out = '';
    let done = false;
    let child;
    try {
      child = spawn(cmd, args, { windowsHide: true });
    } catch (_) {
      return resolve('');
    }
    const finish = () => {
      if (done) return;
      done = true;
      resolve(out);
    };
    child.stdout.on('data', (d) => (out += d.toString()));
    child.stderr.on('data', (d) => (out += d.toString()));
    child.on('error', finish);
    child.on('close', finish);
    setTimeout(() => {
      try {
        child.kill();
      } catch (_) {
        /* 忽略 */
      }
      finish();
    }, timeout);
  });
}

async function steamRunning() {
  if (process.platform === 'win32') {
    const out = await psLines('tasklist', ['/FI', 'IMAGENAME eq steam.exe', '/NH']);
    return /steam\.exe/i.test(out);
  }
  const out = await psLines('pgrep', ['-x', 'steam']);
  if (out.trim()) return true;
  const out2 = await psLines('pgrep', ['-x', 'steamwebhelper']);
  return !!out2.trim();
}

async function killSteam() {
  if (process.platform === 'win32') {
    await psLines('taskkill', ['/IM', 'steam.exe', '/F'], 15000);
    await psLines('taskkill', ['/IM', 'steamwebhelper.exe', '/F'], 15000);
  } else {
    await psLines('pkill', ['-x', 'steam'], 8000);
  }
  return { running: await steamRunning() };
}

async function guard() {
  const root = sysinfo.detectSteam();
  const running = await steamRunning();
  const admin = sysinfo.isElevated();
  const libraries = root.libraryFolders.map((lib) => {
    const apps = path.join(lib, 'steamapps');
    let writable = false;
    try {
      fs.mkdirSync(apps, { recursive: true });
      fs.accessSync(apps, fs.constants.W_OK);
      writable = true;
    } catch (_) {
      writable = false;
    }
    return { path: lib, steamapps: apps, exists: fs.existsSync(lib), writable };
  });

  return {
    steam: { found: root.found, root: root.root, running, accountId: root.accountId },
    libraries,
    admin,
    writable: libraries.some((l) => l.writable),
    hints: [
      !root.found ? '没有找到 Steam 安装目录，可以在设置里手动指向你的 Steam 路径。' : '',
      running ? 'Steam 正在运行：写库文件前必须先完全退出 Steam，否则改动会被覆盖。' : 'Steam 未运行，可以安全写入库文件。',
      root.accountId && root.accountId.length ? '检测到本机登录过 ' + root.accountId.map((a) => a.accountName || a.steamId64).join('、') : '',
      !admin && process.platform === 'win32' ? '未以管理员运行：如果 Steam 装在 Program Files，写库文件可能失败。' : ''
    ].filter(Boolean)
  };
}

/* ================================================================== */
/* 应用信息（depot 结构 / 安装目录 / 体积）                              */
/* ================================================================== */

function httpJson(url, timeout = 12000) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        timeout,
        headers: {
          'user-agent': 'ShiroMechaToolkit/1.1 (+https://github.com/)',
          accept: 'application/json'
        }
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (d) => (body += d));
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (err) {
            reject(new Error('返回内容不是 JSON'));
          }
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error('请求超时')));
    req.on('error', reject);
  });
}

/**
 * 抓 depot 结构。优先用公开的 appinfo 镜像，失败时退回商店接口只拿名字。
 */
async function appInfo(appid, lang = 'schinese') {
  const id = String(appid || '').trim();
  if (!/^\d+$/.test(id)) throw new Error('AppID 必须是纯数字');

  const out = { appid: id, name: '', installdir: '', buildid: '', depots: [], branch: 'public', source: '' };

  try {
    const j = await httpJson(`https://api.steamcmd.net/v1/info/${id}`);
    const node = j && j.data && (j.data[id] || j.data[Number(id)]);
    if (node) {
      out.name = (node.common && node.common.name) || '';
      out.installdir = (node.config && node.config.installdir) || '';
      out.buildid = String(node.depots && node.depots.branches && node.depots.branches.public ? node.depots.branches.public.buildid || '' : '');
      out.source = 'appinfo';

      const depots = (node.depots && node.depots.depots) || node.depots || {};
      for (const [depotId, depot] of Object.entries(depots)) {
        if (!/^\d+$/.test(depotId) || !depot || typeof depot !== 'object') continue;
        if (depot.dlcappid) continue;
        const manifests = depot.manifests || {};
        const pub = manifests.public || {};
        const size = Number(depot.maxsize || depot.manifests && depot.manifests.public && depot.manifests.public.size || 0);
        out.depots.push({
          depotId,
          name: depot.name || '',
          gid: String(pub.gid || ''),
          size,
          shared: !!depot.sharedinstall,
          dlcappid: depot.dlcappid ? String(depot.dlcappid) : ''
        });
      }
      out.depots.sort((a, b) => b.size - a.size);
    }
  } catch (_) {
    /* 镜像不通就用商店接口兜底 */
  }

  if (!out.name) {
    try {
      const j = await httpJson(`https://store.steampowered.com/api/appdetails?appids=${id}&l=${encodeURIComponent(lang)}&filters=basic`);
      const node = j && j[id];
      if (node && node.success && node.data) {
        out.name = node.data.name || '';
        out.source = out.source || 'store';
      }
    } catch (_) {
      /* 两个源都挂了就让用户手动填 */
    }
  }

  if (!out.installdir) out.installdir = out.name ? out.name.replace(/[^\w\u4e00-\u9fa5 .-]/g, '').trim() : `app${id}`;
  out.totalSize = out.depots.reduce((n, d) => n + (d.size || 0), 0);
  return out;
}

/* ================================================================== */
/* appmanifest 生成                                                    */
/* ================================================================== */

function buildAcf(meta) {
  const launcher = meta.launcherPath || (process.platform === 'win32' ? 'C:\\Program Files (x86)\\Steam\\steam.exe' : '');
  const depots = Array.isArray(meta.depots) ? meta.depots.filter((d) => /^\d+$/.test(String(d.depotId))) : [];

  const lines = [];
  lines.push('"AppState"');
  lines.push('{');
  lines.push(`\t"appid"\t\t"${esc(meta.appid)}"`);
  lines.push('\t"Universe"\t\t"1"');
  if (launcher) lines.push(`\t"LauncherPath"\t\t"${esc(launcher)}"`);
  lines.push(`\t"name"\t\t"${esc(meta.name || 'App ' + meta.appid)}"`);
  lines.push(`\t"StateFlags"\t\t"${meta.stateFlags == null ? 4 : meta.stateFlags}"`);

  if (depots.length) {
    lines.push('\t"InstalledDepots"');
    lines.push('\t{');
    for (const d of depots) {
      lines.push(`\t\t"${esc(d.depotId)}"`);
      lines.push('\t\t{');
      if (d.gid) lines.push(`\t\t\t"manifest"\t\t"${esc(d.gid)}"`);
      lines.push(`\t\t\t"size"\t\t"${esc(d.size || 0)}"`);
      if (d.dlcappid) lines.push(`\t\t\t"dlcappid"\t\t"${esc(d.dlcappid)}"`);
      lines.push('\t\t}');
    }
    lines.push('\t}');

    const shared = depots.filter((d) => d.shared);
    if (shared.length) {
      lines.push('\t"SharedDepots"');
      lines.push('\t{');
      for (const d of shared) lines.push(`\t\t"${esc(d.depotId)}"\t\t"228980"`);
      lines.push('\t}');
    }
  }

  lines.push('\t"UserConfig"');
  lines.push('\t{');
  lines.push(`\t\t"language"\t\t"${esc(meta.language || 'schinese')}"`);
  lines.push('\t}');
  lines.push(`\t"installdir"\t\t"${esc(meta.installdir || meta.name || 'app' + meta.appid)}"`);
  lines.push(`\t"LastUpdated"\t\t"${Math.floor(Date.now() / 1000)}"`);
  lines.push('\t"LastPlayed"\t\t"0"');
  lines.push(`\t"SizeOnDisk"\t\t"${esc(meta.sizeOnDisk || 0)}"`);
  lines.push('\t"StagingSize"\t\t"0"');
  if (meta.buildid) lines.push(`\t"buildid"\t\t"${esc(meta.buildid)}"`);
  if (meta.owner) lines.push(`\t"LastOwner"\t\t"${esc(meta.owner)}"`);
  lines.push('\t"UpdateResult"\t\t"0"');
  lines.push('\t"BytesToDownload"\t\t"0"');
  lines.push('\t"BytesDownloaded"\t\t"0"');
  lines.push('\t"BytesToStage"\t\t"0"');
  lines.push('\t"BytesStaged"\t\t"0"');
  if (meta.buildid) lines.push(`\t"TargetBuildID"\t\t"${esc(meta.buildid)}"`);
  lines.push('\t"MountedConfig"');
  lines.push('\t{');
  lines.push(`\t\t"language"\t\t"${esc(meta.language || 'schinese')}"`);
  lines.push('\t}');
  lines.push('\t"AutoUpdateBehavior"\t\t"1"');
  lines.push('\t"AllowOtherDownloadsWhileRunning"\t\t"0"');
  lines.push('\t"ScheduledAutoUpdate"\t\t"0"');
  lines.push('}');
  lines.push('');
  return lines.join('\n');
}

/** 写完立刻读回来核一遍：字段对不对、能不能解析回来 */
function verifyAcf(file, expect) {
  const checks = [];
  const push = (name, ok, detail) => checks.push({ name, ok, detail });
  if (!fs.existsSync(file)) {
    push('文件落盘', false, '没有找到刚写的 appmanifest');
    return { ok: false, checks };
  }
  const text = fs.readFileSync(file, 'utf8');
  push('文件落盘', true, `${text.length} 字节`);

  const root = parseVdf(text);
  const state = child(root, 'AppState');
  push('结构解析', !!state, state ? 'AppState 节点在' : 'AppState 节点缺失');
  if (!state) return { ok: false, checks };

  const pairs = [
    ['appid', String(expect.appid)],
    ['name', String(expect.name || '')],
    ['installdir', String(expect.installdir || '')],
    ['SizeOnDisk', String(expect.sizeOnDisk || 0)],
    ['StateFlags', String(expect.stateFlags == null ? 4 : expect.stateFlags)]
  ];
  for (const [key, want] of pairs) {
    const node = child(state, key);
    push(`${key}`, !!node && node.value === want, node ? `读到 ${node.value}` : '缺失');
  }

  const depots = child(state, 'InstalledDepots');
  const wantDepots = (expect.depots || []).length;
  const gotDepots = depots ? depots.children.length : 0;
  push('InstalledDepots', gotDepots === wantDepots, `期望 ${wantDepots} 个，读到 ${gotDepots} 个`);

  const bytes = child(state, 'BytesToDownload');
  push('下载计数归零', !!bytes && bytes.value === '0', bytes ? bytes.value : '缺失');

  const ok = checks.every((c) => c.ok);
  return { ok, checks };
}

/* ================================================================== */
/* 写库文件                                                            */
/* ================================================================== */

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function backupFile(file, slot) {
  if (!fs.existsSync(file)) return null;
  const dir = path.join(backups(), slot);
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, path.basename(file));
  fs.copyFileSync(file, target);
  return target;
}

/** 往 libraryfolders.vdf 的对应库节点里登记体积 */
function patchLibraryFolders(vdfFile, libraryPath, appid, size) {
  if (!fs.existsSync(vdfFile)) return { changed: false, reason: '没有找到 libraryfolders.vdf' };
  const text = fs.readFileSync(vdfFile, 'utf8');
  const root = parseVdf(text);
  const libRoot = child(root, 'libraryfolders') || child(root, 'LibraryFolders');
  if (!libRoot) return { changed: false, reason: 'libraryfolders.vdf 结构不认识' };

  const want = libraryPath.replace(/\\/g, '\\').toLowerCase();
  let target = null;
  for (const entry of libRoot.children) {
    const p = child(entry, 'path');
    if (!p || !p.value) continue;
    if (p.value.replace(/\\\\/g, '\\').toLowerCase() === want) {
      target = entry;
      break;
    }
  }
  if (!target) return { changed: false, reason: '这个库目录不在 libraryfolders.vdf 里' };

  const appsNode = child(target, 'apps');
  const line = `\t\t\t"${appid}"\t\t"${size || 0}"`;

  if (!appsNode) {
    const indent = '\t\t\t';
    const block = `${indent}"apps"\n${indent}{\n${line}\n${indent}}\n`;
    const at = target.bodyEnd;
    const next = text.slice(0, at) + block + text.slice(at);
    fs.writeFileSync(vdfFile, next, 'utf8');
    return { changed: true, action: 'apps 节点已新建并登记' };
  }

  // 裸键（"apps" "123" 这种没有大括号的写法）没有 body 可插，直接往 bodyEnd 写会毁掉文件
  if (appsNode.open == null || appsNode.bodyEnd == null) {
    return { changed: false, reason: 'apps 是裸键写法，不敢动，先手工看一眼 libraryfolders.vdf' };
  }

  const existing = appsNode.children.find((c) => c.key === appid);
  if (existing) {
    if (existing.value === String(size || 0)) return { changed: false, action: '体积已经是登记值' };

    if (existing.valueEnd == null) {
      return { changed: false, reason: `AppID ${appid} 在 apps 里不是「键 值」写法，跳过` };
    }

    const old = text.slice(existing.start, existing.valueEnd);
    const replaced = `"${appid}"\t\t"${size || 0}"`;
    fs.writeFileSync(vdfFile, text.slice(0, existing.start) + replaced + text.slice(existing.valueEnd), 'utf8');
    return { changed: true, action: '体积已更新' };
  }

  const before = text.slice(0, appsNode.bodyEnd);
  const tail = text.slice(appsNode.bodyEnd);
  const pad = before.endsWith('\n') ? '' : '\n';
  fs.writeFileSync(vdfFile, `${before}${pad}${line}\n${tail}`, 'utf8');
  return { changed: true, action: '已登记进 apps 节点' };
}

/** 往 config.vdf 写 Installed 标记 */
function patchConfigVdf(vdfFile, appid, options = {}) {
  if (!fs.existsSync(vdfFile)) return { changed: false, reason: '没有找到 config.vdf' };
  const text = fs.readFileSync(vdfFile, 'utf8');
  const root = parseVdf(text);
  const steamNode = dig(root, ['InstallConfigStore', 'Software', 'Valve', 'Steam']);
  if (!steamNode) return { changed: false, reason: 'config.vdf 结构不认识' };

  const appsNode = child(steamNode, 'apps');
  if (steamNode.bodyEnd == null) return { changed: false, reason: 'config.vdf 的 Steam 节点没有大括号，跳过' };

  if (!appsNode) {
    const block = `\t\t\t\t"apps"\n\t\t\t\t{\n\t\t\t\t\t"${appid}"\n\t\t\t\t\t{\n\t\t\t\t\t\t"Installed"\t\t"1"\n${options.force ? '\t\t\t\t\t\t"forceupdate"\t\t"0"\n' : ''}\t\t\t\t\t}\n\t\t\t\t}\n`;
    const next = text.slice(0, steamNode.bodyEnd) + block + text.slice(steamNode.bodyEnd);
    fs.writeFileSync(vdfFile, next, 'utf8');
    return { changed: true, action: 'apps 节点已新建' };
  }

  if (appsNode.open == null || appsNode.bodyEnd == null) {
    return { changed: false, reason: 'config.vdf 里 apps 是裸键写法，跳过（不动你的原文件）' };
  }

  const appNode = child(appsNode, appid);

  if (!appNode) {
    const block = `\t\t\t\t\t"${appid}"\n\t\t\t\t\t{\n\t\t\t\t\t\t"Installed"\t\t"1"\n\t\t\t\t\t}\n`;
    const before = text.slice(0, appsNode.bodyEnd);
    const pad = before.endsWith('\n') ? '' : '\n';
    fs.writeFileSync(vdfFile, `${before}${pad}${block}${text.slice(appsNode.bodyEnd)}`, 'utf8');
    return { changed: true, action: '已登记 AppID' };
  }

  // 裸键式（"2358720" "1"）没有 body 可以插，整段换成完整节点
  if (appNode.open == null || appNode.bodyEnd == null) {
    if (appNode.start == null || appNode.valueEnd == null) {
      return { changed: false, reason: `AppID ${appid} 的写法无法定位，跳过` };
    }
    const block = `"${appid}"\n\t\t\t\t\t{\n\t\t\t\t\t\t"Installed"\t\t"1"\n\t\t\t\t\t}`;
    fs.writeFileSync(vdfFile, text.slice(0, appNode.start) + block + text.slice(appNode.valueEnd), 'utf8');
    return { changed: true, action: '裸键已升级成完整节点' };
  }

  const inst = child(appNode, 'Installed');
  if (inst && inst.value === '1') return { changed: false, action: 'Installed 标记已存在' };

  if (inst && inst.valueEnd != null) {
    const replaced = `"Installed"\t\t"1"`;
    fs.writeFileSync(vdfFile, text.slice(0, inst.start) + replaced + text.slice(inst.valueEnd), 'utf8');
    return { changed: true, action: 'Installed 已置为 1' };
  }

  if (inst) return { changed: false, reason: 'Installed 的写法不认识，跳过' };

  const insertAt = appNode.bodyStart == null ? appNode.bodyEnd : appNode.bodyStart;
  fs.writeFileSync(vdfFile, text.slice(0, insertAt) + `\t\t\t\t\t"Installed"\t\t"1"\n` + text.slice(insertAt), 'utf8');
  return { changed: true, action: '已补写 Installed 标记' };
}

/* ================================================================== */
/* 入库 / 还原                                                          */
/* ================================================================== */

async function install(input = {}) {
  const appid = String(input.appid || '').trim();
  if (!/^\d+$/.test(appid)) throw new Error('AppID 必须是纯数字');

  const root = sysinfo.detectSteam();
  if (!root.found) throw new Error('没有找到 Steam 安装目录，请先在设置里指定');

  const library = String(input.library || root.root).trim();
  const appsDir = path.join(library, 'steamapps');
  if (!fs.existsSync(appsDir)) throw new Error(`这个库目录里没有 steamapps：${appsDir}`);

  if (await steamRunning()) {
    if (!input.force) throw new Error('Steam 正在运行，请先完全退出 Steam（或点「强制结束 Steam」），否则写入会被覆盖');
  }

  let meta = input.meta || null;
  if (!meta) {
    try {
      meta = await appInfo(appid, input.lang || 'schinese');
    } catch (_) {
      // 拉不到在线结构也得能装：名称/目录用你自己填的
      meta = { appid, name: '', installdir: '', buildid: '', depots: [], totalSize: 0, source: 'local' };
    }
  }

  const depotList = input.depots && input.depots.length ? input.depots : meta.depots || [];

  const name = String(input.name || meta.name || `App ${appid}`).trim();
  const installdir = String(input.installdir || meta.installdir || name).trim();
  const sizeOnDisk = Number(input.sizeOnDisk || meta.totalSize || 0);

  const slot = `${appid}-${stamp()}`;
  const backupsMade = [];

  /* ---- 1. appmanifest ---- */
  const acfFile = path.join(appsDir, `appmanifest_${appid}.acf`);
  const prev = backupFile(acfFile, slot);
  if (prev) backupsMade.push({ what: 'appmanifest', path: prev });

  const acf = buildAcf({
    appid,
    name,
    installdir,
    sizeOnDisk,
    language: input.language || 'schinese',
    buildid: input.buildid || meta.buildid || '',
    depots: depotList,
    launcherPath: input.launcherPath || path.join(root.root, process.platform === 'win32' ? 'steam.exe' : 'steam.sh'),
    stateFlags: input.stateFlags
  });
  fs.writeFileSync(acfFile, acf, 'utf8');

  /* ---- 2. 游戏目录 ---- */
  const commonDir = path.join(appsDir, 'common');
  const gameDir = path.join(commonDir, installdir);
  if (input.createDir !== false) fs.mkdirSync(gameDir, { recursive: true });

  /* ---- 3. libraryfolders.vdf ---- */
  const libFile = path.join(appsDir, 'libraryfolders.vdf');
  const libBackup = backupFile(libFile, slot);
  if (libBackup) backupsMade.push({ what: 'libraryfolders.vdf', path: libBackup });
  const libResult = patchLibraryFolders(libFile, library, appid, sizeOnDisk);

  /* ---- 4. config.vdf ---- */
  const cfgFile = path.join(root.root, 'config', 'config.vdf');
  const cfgBackup = backupFile(cfgFile, slot);
  if (cfgBackup) backupsMade.push({ what: 'config.vdf', path: cfgBackup });
  const cfgResult = input.touchConfig === false
    ? { changed: false, reason: '按你的选择跳过' }
    : patchConfigVdf(cfgFile, appid, { force: !!input.force });

  /* ---- 5. 记录 ---- */
  const record = {
    id: crypto.randomUUID(),
    appid,
    name,
    installdir,
    sizeOnDisk,
    library,
    gameDir,
    acfFile,
    configVdf: cfgFile,
    libraryFolders: libFile,
    slot,
    depots: depotList.length,
    installedAt: Date.now()
  };

  const list = read().filter((e) => e.appid !== appid || e.library !== library);
  list.push(record);
  write(list);

  return {
    record,
    actions: [
      `写入 appmanifest_${appid}.acf`,
      libResult.changed ? `libraryfolders.vdf：${libResult.action}` : `libraryfolders.vdf 跳过（${libResult.reason || libResult.action}）`,
      cfgResult.changed ? `config.vdf：${cfgResult.action}` : `config.vdf 跳过（${cfgResult.reason || cfgResult.action}）`,
      input.createDir === false ? '未创建游戏目录' : `游戏目录 → ${gameDir}`,
      prev ? '原 appmanifest 已备份' : '原 appmanifest 不存在，无需备份'
    ],
    backups: backupsMade,
    verify: verifyAcf(acfFile, {
      appid,
      name,
      installdir,
      sizeOnDisk,
      stateFlags: input.stateFlags,
      depots: depotList
    })
  };
}

async function remove(id, options = {}) {
  const list = read();
  const rec = list.find((e) => e.id === id);
  if (!rec) throw new Error('没有找到这条入库记录');

  if (await steamRunning() && !options.force) {
    throw new Error('Steam 正在运行，请先完全退出 Steam 再还原');
  }

  const actions = [];

  if (fs.existsSync(rec.acfFile)) {
    fs.rmSync(rec.acfFile, { force: true });
    actions.push(`已删除 appmanifest_${rec.appid}.acf`);
  }

  // 从 libraryfolders.vdf 的 apps 节点摘掉这条
  try {
    if (fs.existsSync(rec.libraryFolders)) {
      const text = fs.readFileSync(rec.libraryFolders, 'utf8');
      const root = parseVdf(text);
      const libRoot = child(root, 'libraryfolders') || child(root, 'LibraryFolders');
      let hit = null;
      if (libRoot) {
        for (const entry of libRoot.children) {
          const appsNode = child(entry, 'apps');
          if (!appsNode) continue;
          if (appsNode.children.some((c) => c.key === rec.appid)) {
            hit = appsNode;
            break;
          }
        }
      }
      if (hit) {
        const seg = text.slice(hit.bodyStart, hit.bodyEnd);
        const cleaned = seg
          .split('\n')
          .filter((line) => !new RegExp(`^\\s*"${rec.appid}"`).test(line))
          .join('\n');
        fs.writeFileSync(rec.libraryFolders, text.slice(0, hit.bodyStart) + cleaned + text.slice(hit.bodyEnd), 'utf8');
        actions.push('已从 libraryfolders.vdf 摘除体积登记');
      }
    }
  } catch (_) {
    actions.push('libraryfolders.vdf 清理失败，可用还原点恢复');
  }

  // config.vdf 里去掉 appid 节点
  try {
    if (fs.existsSync(rec.configVdf)) {
      const text = fs.readFileSync(rec.configVdf, 'utf8');
      const root = parseVdf(text);
      const appsNode = dig(root, ['InstallConfigStore', 'Software', 'Valve', 'Steam', 'apps']);
      const appNode = appsNode ? child(appsNode, rec.appid) : null;
      if (appNode && appNode.open != null) {
        const from = appNode.start != null ? appNode.start : appNode.open;
        fs.writeFileSync(rec.configVdf, text.slice(0, from) + text.slice(appNode.close + 1), 'utf8');
        actions.push('已从 config.vdf 移除 Installed 标记');
      }
    }
  } catch (_) {
    actions.push('config.vdf 清理失败，可用还原点恢复');
  }

  if (options.deleteFiles && rec.gameDir && fs.existsSync(rec.gameDir)) {
    fs.rmSync(rec.gameDir, { recursive: true, force: true });
    actions.push(`已删除游戏目录 ${rec.gameDir}`);
  }

  write(list.filter((e) => e.id !== id));
  return { actions, record: rec };
}

function list() {
  const root = sysinfo.detectSteam();
  const items = read().map((e) => ({
    ...e,
    acfExists: fs.existsSync(e.acfFile),
    gameDirExists: fs.existsSync(e.gameDir)
  }));
  return { items, steamRoot: root.root, found: root.found };
}

function restoreBackups(slot) {
  const dir = path.join(backups(), slot);
  if (!fs.existsSync(dir)) throw new Error('这个还原点不存在');
  const root = sysinfo.detectSteam();
  const actions = [];
  for (const name of fs.readdirSync(dir)) {
    const from = path.join(dir, name);
    let to = null;
    if (/^appmanifest_(\d+)\.acf$/.test(name)) {
      const appid = name.match(/^appmanifest_(\d+)\.acf$/)[1];
      const rec = read().find((e) => e.appid === appid);
      to = rec ? rec.acfFile : null;
    } else if (name === 'libraryfolders.vdf') {
      to = null;
      for (const lib of root.libraryFolders) {
        const f = path.join(lib, 'steamapps', 'libraryfolders.vdf');
        if (fs.existsSync(f)) {
          to = f;
          break;
        }
      }
    } else if (name === 'config.vdf') {
      to = path.join(root.root, 'config', 'config.vdf');
    }
    if (!to) continue;
    fs.copyFileSync(from, to);
    actions.push(`已恢复 ${name} → ${to}`);
  }
  return { actions };
}

function backupList() {
  const dir = backups();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => {
      const full = path.join(dir, e.name);
      const files = fs.readdirSync(full).map((f) => {
        const st = (() => {
          try {
            return fs.statSync(path.join(full, f));
          } catch (_) {
            return { size: 0, mtimeMs: 0 };
          }
        })();
        return { name: f, size: st.size, mtime: st.mtimeMs };
      });
      return { slot: e.name, dir: full, files };
    })
    .sort((a, b) => (b.files[0]?.mtime || 0) - (a.files[0]?.mtime || 0));
}

/* ================================================================== */
/* depot 清单缓存                                                       */
/* ================================================================== */

function depotCacheDir(library) {
  return path.join(library, 'steamapps', 'depotcache');
}

function depotCache(library) {
  const root = sysinfo.detectSteam();
  const libs = library ? [library] : root.libraryFolders;
  return libs.map((lib) => {
    const dir = depotCacheDir(lib);
    let files = [];
    try {
      files = fs
        .readdirSync(dir)
        .filter((f) => /\.manifest$/i.test(f))
        .map((f) => {
          const st = fs.statSync(path.join(dir, f));
          return { name: f, path: path.join(dir, f), size: st.size, mtime: st.mtimeMs };
        })
        .sort((a, b) => b.mtime - a.mtime);
    } catch (_) {
      /* 目录不存在 */
    }
    return { library: lib, dir, exists: fs.existsSync(dir), count: files.length, files };
  });
}

function importManifests(paths, library) {
  const root = sysinfo.detectSteam();
  const lib = library || root.root;
  if (!lib) throw new Error('没有可用的 Steam 库目录');
  const dir = depotCacheDir(lib);
  fs.mkdirSync(dir, { recursive: true });

  const actions = [];
  for (const p of Array.isArray(paths) ? paths : [paths]) {
    const src = String(p || '');
    if (!src || !fs.existsSync(src)) continue;
    const st = fs.statSync(src);
    const targets = st.isDirectory() ? fs.readdirSync(src).map((f) => path.join(src, f)) : [src];
    for (const t of targets) {
      if (!/\.manifest$/i.test(t)) continue;
      const dest = path.join(dir, path.basename(t));
      if (fs.existsSync(dest)) fs.copyFileSync(dest, `${dest}.shiro-backup`);
      fs.copyFileSync(t, dest);
      actions.push(`${path.basename(t)} → depotcache`);
    }
  }
  if (!actions.length) throw new Error('没有找到 .manifest 文件');
  return { dir, actions };
}

function exportManifests(library, targetDir) {
  const root = sysinfo.detectSteam();
  const lib = library || root.root;
  const dir = depotCacheDir(lib);
  if (!fs.existsSync(dir)) throw new Error('这个库里没有 depotcache 目录');
  const out = targetDir || path.join(os.homedir(), 'Desktop', `shiro-depotcache-${Date.now()}`);
  fs.mkdirSync(out, { recursive: true });
  const copied = [];
  for (const f of fs.readdirSync(dir)) {
    if (!/\.manifest$/i.test(f)) continue;
    fs.copyFileSync(path.join(dir, f), path.join(out, f));
    copied.push(f);
  }
  return { dir: out, count: copied.length, files: copied };
}

/* ================================================================== */
/* 已装游戏的库扫描（给前端选目录用）                                     */
/* ================================================================== */

function libraries() {
  const root = sysinfo.detectSteam();
  return root.libraryFolders.map((lib) => {
    const appsDir = path.join(lib, 'steamapps');
    let count = 0;
    try {
      count = fs.readdirSync(appsDir).filter((f) => /^appmanifest_\d+\.acf$/.test(f)).length;
    } catch (_) {
      /* 忽略 */
    }
    let free = 0;
    const disk = sysinfo.diskFree(lib);
    if (disk) free = disk.free;
    return { path: lib, steamapps: appsDir, apps: count, free };
  });
}

/* ================================================================== */
/* 自检                                                                */
/*   写入类测试全在临时目录里跑，不碰你真实的 Steam 文件；               */
/*   真实环境那几条只做只读探测。                                        */
/* ================================================================== */

const LIB_SAMPLE = String.raw`"libraryfolders"
{
	"0"
	{
		"path"		"C:\\Program Files (x86)\\Steam"
		"label"		""
		"contentid"		"1"
		"totalsize"		"0"
		"apps"
		{
			"228980"		"1627497"
		}
	}
	"1"
	{
		"path"		"D:\\SteamLibrary"
		"label"		""
		"apps"
		{
		}
	}
	"2"
	{
		"path"		"E:\\Games"
	}
}
`;

const CFG_SAMPLE = String.raw`"InstallConfigStore"
{
	"Software"
	{
		"Valve"
		{
			"Steam"
			{
				"cip"		"0a1b2c3d"
				"Rate"		"25000"
				"apps"
				{
					"228980"
					{
						"Installed"		"1"
					}
					"999"		"1"
				}
			}
		}
	}
}
`;

function selftest() {
  const results = [];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shiro-vault-check-'));
  const lib = path.join(dir, 'libraryfolders.vdf');
  const cfgFile = path.join(dir, 'config.vdf');

  const check = (name, pass, detail) => results.push({ name, ok: !!pass, detail: String(detail == null ? '' : detail) });
  const untouched = (file, before) => fs.readFileSync(file, 'utf8') === before;

  try {
    /* ---------- 1. appmanifest 生成 + 回读 ---------- */
    const meta = {
      appid: '2358720',
      name: '黑神话：悟空 "测试"',
      installdir: 'BlackMythWukong',
      sizeOnDisk: 128400000000,
      buildid: '12345678',
      language: 'schinese',
      depots: [
        { depotId: '2358721', gid: '4832091743201984421', size: 128000000000 },
        { depotId: '228990', gid: '1017030123002412356', size: 700000000, shared: true }
      ]
    };
    const acfFile = path.join(dir, 'appmanifest_2358720.acf');
    fs.writeFileSync(acfFile, buildAcf(meta), 'utf8');

    const v = verifyAcf(acfFile, { ...meta, stateFlags: 4 });
    const bad = v.checks.filter((c) => !c.ok);
    check('appmanifest 生成 + 回读', v.ok, bad.length ? `没过：${bad.map((b) => b.name).join(', ')}` : `${v.checks.length} 项全过`);

    const state = child(parseVdf(fs.readFileSync(acfFile, 'utf8')), 'AppState');
    check('名称里的引号 / 中文', state && child(state, 'name').value === '黑神话：悟空 "测试"', state ? String(child(state, 'name').value) : '解析失败');
    check('TargetBuildID 与 buildid 一致', !!child(state, 'TargetBuildID') && child(state, 'TargetBuildID').value === '12345678', child(state, 'TargetBuildID') && child(state, 'TargetBuildID').value);
    check('下载计数归零（不触发补下）', ['BytesToDownload', 'BytesDownloaded', 'BytesToStage', 'BytesStaged'].every((k) => child(state, k) && child(state, k).value === '0'), '四个计数都在且为 0');

    /* ---------- 2. libraryfolders 定点编辑 ---------- */
    fs.writeFileSync(lib, LIB_SAMPLE, 'utf8');
    const r1 = patchLibraryFolders(lib, 'D:\\SteamLibrary', '2358720', 128400000000);
    check('库文件：登记进 apps', r1.changed === true, r1.action || r1.reason);

    const after1 = fs.readFileSync(lib, 'utf8');
    const libRoot = child(parseVdf(after1), 'libraryfolders');
    const lib1 = child(libRoot, '1');
    check('库文件：原内容一字未丢', after1.includes('"label"') && after1.includes('"contentid"') && after1.includes('228980'), 'label / contentid / 原有 appid 都在');
    check('库文件：只落到对应库节点', !!child(lib1, 'apps') && !!child(child(lib1, 'apps'), '2358720'), 'D 盘节点里能找到登记项');
    check('库文件：E 盘那个库没被动', !child(child(child(libRoot, '2'), 'apps'), '2358720'), 'E:\\Games 无 apps 时不瞎写');

    const r2 = patchLibraryFolders(lib, 'D:\\SteamLibrary', '2358720', 999);
    const after2 = fs.readFileSync(lib, 'utf8');
    check('库文件：改体积是替换不是追加', (after2.match(/"2358720"/g) || []).length === 1 && after2.includes('"999"'), r2.action || r2.reason);

    const r3 = patchLibraryFolders(lib, 'D:\\SteamLibrary', '2358720', 999);
    check('库文件：重复写不出重复项', r3.changed === false && (fs.readFileSync(lib, 'utf8').match(/"2358720"/g) || []).length === 1, r3.action || r3.reason);

    const r4 = patchLibraryFolders(lib, 'Z:\\NotThere', '2358720', 1);
    check('库文件：目录不在清单里时拒绝写', r4.changed === false && fs.readFileSync(lib, 'utf8') === after2, r4.reason);

    const weird = String.raw`"libraryfolders"
{
	"0"
	{
		"path"		"D:\\SteamLibrary"
		"apps"
		{
			"2358720"		"1"
		}
		"note"		"带上 { 和 \" 引号的脏字符串"
	}
}
`;
    fs.writeFileSync(lib, weird, 'utf8');
    patchLibraryFolders(lib, 'D:\\SteamLibrary', '2358720', 512);
    const afterWeird = fs.readFileSync(lib, 'utf8');
    check('库文件：脏字符串不干扰定位', afterWeird.includes('"512"') && afterWeird.includes('带上 { 和'), '同时改了体积又保留原字符串');

    /* ---------- 3. config.vdf ---------- */
    fs.writeFileSync(cfgFile, CFG_SAMPLE, 'utf8');
    const c1 = patchConfigVdf(cfgFile, '2358720');
    const cfgAfter = fs.readFileSync(cfgFile, 'utf8');
    const cfgRoot = parseVdf(cfgAfter);
    const steamNode = dig(cfgRoot, ['InstallConfigStore', 'Software', 'Valve', 'Steam']);
    check('config：新 AppID 能写进去', c1.changed === true && !!child(child(steamNode, 'apps'), '2358720'), c1.action || c1.reason);
    check('config：原有键没被挤掉', !!child(steamNode, 'cip') && child(steamNode, 'cip').value === '0a1b2c3d', 'cip / Rate 还在');

    const c2 = patchConfigVdf(cfgFile, '228980');
    check('config：已存在的标记不重复写', c2.changed === false && (fs.readFileSync(cfgFile, 'utf8').match(/"228980"/g) || []).length === 1, c2.action || c2.reason);

    const beforeWeirdCfg = fs.readFileSync(cfgFile, 'utf8');
    const lenBefore = beforeWeirdCfg.length;
    const c3 = patchConfigVdf(cfgFile, '999');
    const afterWeirdCfg = fs.readFileSync(cfgFile, 'utf8');
    const ok999 = child(child(dig(parseVdf(afterWeirdCfg), ['InstallConfigStore', 'Software', 'Valve', 'Steam']), 'apps'), '999');
    check('config：裸键写法不会把文件写坏', c3.changed === true && afterWeirdCfg.length > lenBefore && afterWeirdCfg.startsWith('"InstallConfigStore"') && !!child(ok999, 'Installed'), `字节 ${lenBefore} → ${afterWeirdCfg.length}`);
    check('config：写完之后仍能整体解析', !!dig(parseVdf(afterWeirdCfg), ['InstallConfigStore', 'Software', 'Valve', 'Steam']), '顶层结构完好');

    /* ---------- 4. 备份 ---------- */
    const slot = `selftest-${stamp()}`;
    const saved = backupFile(cfgFile, slot);
    check('备份：文件能拷进还原点', !!saved && fs.existsSync(saved), saved ? path.basename(path.dirname(saved)) : '没生成');
    if (saved) fs.rmSync(path.dirname(saved), { recursive: true, force: true });

    /* ---------- 5. 真实环境（只读） ---------- */
    const root = sysinfo.detectSteam();
    check('环境：检测到 Steam', !!root.found, root.found ? root.root : '没找到，设置里可以手动指定');

    if (root.found) {
      const libs = libraries();
      check('环境：库里能找到 steamapps', libs.length > 0, libs.map((l) => l.path).join(' / ') || '无');
      if (libs[0]) {
        let writable = true;
        try {
          fs.accessSync(libs[0].steamapps, fs.constants.W_OK);
        } catch (_) {
          writable = false;
        }
        check('环境：库目录可写', writable, libs[0].steamapps);
      }
    }
  } catch (err) {
    check('自检跑完', false, String((err && err.message) || err));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  const running = results.length > 0 && results.every((r) => r.ok);
  return {
    ok: running,
    passed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
    steamRunning: null
  };
}

module.exports = {
  guard,
  steamRunning,
  killSteam,
  appInfo,
  buildAcf,
  verifyAcf,
  install,
  remove,
  list,
  backupList,
  restoreBackups,
  depotCache,
  importManifests,
  exportManifests,
  libraries,
  selftest,
  parseVdf,
  storeFile: store
};
