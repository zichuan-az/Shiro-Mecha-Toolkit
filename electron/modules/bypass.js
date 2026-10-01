'use strict';

/**
 * 补丁中心 · Patch Bay
 *
 * 四个能力放在一起，因为它们共用同一套「部署 → 备份 → 还原」机制：
 *
 *   1. 补丁部署     把你本机已有的文件（dll / exe / 配置）部署进游戏目录，覆盖前自动备份
 *   2. 联机补丁     生成 steam_settings 这一套配置文件（账号、语言、广播名、DLC、depot）
 *   3. 免 Steam    生成 steam_appid.txt、启动参数，让游戏脱离 Steam 客户端直接起
 *   4. 联网验证屏蔽  hosts 托管区 + 出站防火墙规则，把校验域名/进程流量掐掉
 *
 * 所有改动都写进「还原点」，随时可以一键撤回原状。
 * 程序本身不内置、不下载任何补丁文件，只管理你自己放进去的东西。
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const sysinfo = require('./sysinfo');

/* ================================================================== */
/* 存储                                                                */
/* ================================================================== */

const HOSTS_BEGIN = '# ==== SHIRO BYPASS BEGIN ====';
const HOSTS_END = '# ==== SHIRO BYPASS END ====';

const PRESET_DOMAINS = [
  { domain: 'denuvo.com', label: 'Denuvo 激活与校验' },
  { domain: 'securom.com', label: 'SecuROM 在线校验' },
  { domain: 'solidshield.com', label: 'SolidShield 校验' },
  { domain: 'tages.com', label: 'TAGES 校验' },
  { domain: 'star-force.com', label: 'StarForce 校验' },
  { domain: 'safedisc.com', label: 'SafeDisc 校验' },
  { domain: 'activation.denuvo.com', label: 'Denuvo 激活入口' }
];

function userDataDir() {
  try {
    return require('electron').app.getPath('userData');
  } catch (_) {
    return path.join(os.homedir(), '.shiro-mecha-toolkit');
  }
}

let storePath = null;
let pointPath = null;

function store() {
  if (storePath) return storePath;
  const base = userDataDir();
  fs.mkdirSync(base, { recursive: true });
  storePath = path.join(base, 'bypass.json');
  return storePath;
}

function pointStore() {
  if (pointPath) return pointPath;
  const base = userDataDir();
  fs.mkdirSync(base, { recursive: true });
  pointPath = path.join(base, 'bypass-points.json');
  return pointPath;
}

function readJson(file, fallback) {
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    return raw == null ? fallback : raw;
  } catch (_) {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
}

/* ================================================================== */
/* 工具                                                                */
/* ================================================================== */

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function uniquePath(dir, filename) {
  let target = path.join(dir, filename);
  if (!fs.existsSync(target)) return target;
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  let i = 1;
  while (i < 999) {
    target = path.join(dir, `${base}.shiro-backup${i}${ext}`);
    if (!fs.existsSync(target)) return target;
    i++;
  }
  return path.join(dir, `${base}.shiro-backup-${Date.now()}${ext}`);
}

function run(cmd, args, timeout = 20000) {
  return new Promise((resolve) => {
    let out = '';
    let done = false;
    let child;
    try {
      child = spawn(cmd, args, { windowsHide: true });
    } catch (err) {
      return resolve({ ok: false, output: String(err.message || err) });
    }
    const finish = (code) => {
      if (done) return;
      done = true;
      resolve({ ok: code === 0, code, output: out.trim() });
    };
    child.stdout.on('data', (d) => (out += d.toString()));
    child.stderr.on('data', (d) => (out += d.toString()));
    child.on('error', (err) => {
      out += String(err.message || err);
      finish(-1);
    });
    child.on('close', finish);
    setTimeout(() => {
      try {
        child.kill();
      } catch (_) {
        /* 忽略 */
      }
      finish(-2);
    }, timeout);
  });
}

function hostsFile() {
  return process.platform === 'win32'
    ? 'C:\\Windows\\System32\\drivers\\etc\\hosts'
    : '/etc/hosts';
}

function isAdmin() {
  return sysinfo.isElevated();
}

/* ================================================================== */
/* 配置档案                                                            */
/* ================================================================== */

const EMPTY_DB = { profiles: [], settings: { domains: [], firewall: [] } };

function db() {
  const raw = readJson(store(), EMPTY_DB);
  return {
    profiles: Array.isArray(raw.profiles) ? raw.profiles : [],
    settings: {
      domains: Array.isArray(raw.settings && raw.settings.domains) ? raw.settings.domains : [],
      firewall: Array.isArray(raw.settings && raw.settings.firewall) ? raw.settings.firewall : []
    }
  };
}

function saveDb(next) {
  writeJson(store(), next);
  return next;
}

function profiles() {
  return { profiles: db().profiles };
}

function saveProfile(input = {}) {
  const list = db();
  const item = {
    id: input.id || crypto.randomUUID(),
    name: String(input.name || '').trim() || '未命名档案',
    gameName: String(input.gameName || '').trim(),
    appid: String(input.appid || '').replace(/\D/g, ''),
    kind: ['coop', 'nosteam', 'drm', 'file'].includes(input.kind) ? input.kind : 'file',
    gameDir: String(input.gameDir || '').trim(),
    files: Array.isArray(input.files) ? input.files.map(String).filter(Boolean) : [],
    options: {
      accountName: String((input.options && input.options.accountName) || 'ShiroPlayer').slice(0, 32),
      language: String((input.options && input.options.language) || 'schinese'),
      broadcast: String((input.options && input.options.broadcast) || '').slice(0, 32),
      dlc: String((input.options && input.options.dlc) || ''),
      depots: String((input.options && input.options.depots) || ''),
      launchArgs: String((input.options && input.options.launchArgs) || ''),
      writeHosts: !!(input.options && input.options.writeHosts),
      firewall: !!(input.options && input.options.firewall),
      exeName: String((input.options && input.options.exeName) || '').trim()
    },
    note: String(input.note || '').slice(0, 300),
    updatedAt: Date.now(),
    createdAt: input.createdAt || Date.now()
  };

  const idx = list.profiles.findIndex((p) => p.id === item.id);
  if (idx >= 0) list.profiles[idx] = { ...list.profiles[idx], ...item };
  else list.profiles.push(item);
  saveDb(list);
  return { profiles: db().profiles, profile: item };
}

function removeProfile(id) {
  const list = db();
  list.profiles = list.profiles.filter((p) => p.id !== id);
  saveDb(list);
  return { profiles: list.profiles };
}

/* ================================================================== */
/* 游戏目录体检                                                        */
/* ================================================================== */

const API_NAMES = ['steam_api64.dll', 'steam_api.dll', 'steamclient64.dll', 'steamclient.dll', 'steam_emu.ini', 'ColdClientLoader.ini'];

function analyze(gameDir) {
  const dir = String(gameDir || '').trim();
  if (!dir || !fs.existsSync(dir)) throw new Error('游戏目录不存在');
  if (!fs.statSync(dir).isDirectory()) throw new Error('请选择一个目录');

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const apiFiles = [];
  const exes = [];
  const extras = [];
  const backups = [];

  for (const e of entries) {
    if (!e.isFile()) continue;
    const lower = e.name.toLowerCase();
    if (API_NAMES.includes(lower)) apiFiles.push({ name: e.name, path: path.join(dir, e.name), size: fs.statSync(path.join(dir, e.name)).size });
    else if (lower.endsWith('.exe')) exes.push({ name: e.name, path: path.join(dir, e.name), size: fs.statSync(path.join(dir, e.name)).size });
    if (lower.startsWith('steam_appid.txt') || lower.endsWith('.shiro-backup') || lower.includes('.shiro-backup.')) extras.push(e.name);
    if (lower.includes('.shiro-backup')) backups.push(e.name);
  }

  // 补丁工具常见的子目录 / 配置
  const markers = [];
  for (const m of ['steam_settings', 'steam_settings.ini', 'Goldberg', 'onlinefix.ini', 'SmartSteamEmu.ini', 'cream_api.ini', 'ColdClientLoader.ini']) {
    if (fs.existsSync(path.join(dir, m))) markers.push(m);
  }

  const exe = exes.sort((a, b) => b.size - a.size)[0] || null;

  return {
    dir,
    apiFiles,
    exes: exes.sort((a, b) => b.size - a.size).slice(0, 30),
    exe,
    extras,
    backups,
    markers,
    patched: markers.length > 0 || apiFiles.some((f) => fs.existsSync(`${f.path}.shiro-backup`)),
    writable: (() => {
      try {
        fs.accessSync(dir, fs.constants.W_OK);
        return true;
      } catch (_) {
        return false;
      }
    })(),
    admin: isAdmin()
  };
}

/* ================================================================== */
/* steam_settings 生成                                                 */
/* ================================================================== */

function splitIds(text) {
  return String(text || '')
    .split(/[\s,;，、]+/)
    .map((s) => s.trim())
    .filter((s) => /^\d+$/.test(s));
}

function settingsPlan(profile) {
  const o = profile.options || {};
  const appid = String(profile.appid || '').replace(/\D/g, '');
  const dlc = splitIds(o.dlc);
  const depots = splitIds(o.depots);

  const files = [];

  if (appid) {
    files.push({
      rel: 'steam_appid.txt',
      content: `${appid}\n`,
      label: '游戏根目录的 steam_appid.txt'
    });
    files.push({
      rel: path.join('steam_settings', 'steam_appid.txt'),
      content: `${appid}\n`,
      label: 'steam_settings/steam_appid.txt'
    });
  }

  files.push({
    rel: path.join('steam_settings', 'account_name.txt'),
    content: `${o.accountName || 'ShiroPlayer'}\n`,
    label: '仿真账号名（联机时其他人看到的名字）'
  });

  files.push({
    rel: path.join('steam_settings', 'language.txt'),
    content: `${o.language || 'schinese'}\n`,
    label: '界面语言'
  });

  files.push({
    rel: path.join('steam_settings', 'configs.user.ini'),
    content: [
      '[user::general]',
      `account_name=${o.accountName || 'ShiroPlayer'}`,
      'account_steamid=76561197960287930',
      `language=${o.language || 'schinese'}`,
      'ip_country=CN',
      '',
      '[user::saves]',
      'saves_folder_name=ShiroSaves',
      ''
    ].join('\n'),
    label: '用户侧配置（账号 / 语言 / 存档目录）'
  });

  files.push({
    rel: path.join('steam_settings', 'configs.app.ini'),
    content: [
      '[app::general]',
      `appid=${appid || '0'}`,
      'force_account_name=1',
      'disable_steamhttp=0',
      '',
      '[app::dlc]',
      `unlock_all=${dlc.length ? 0 : 1}`,
      ...dlc.map((id) => `${id}=1`),
      '',
      '[app::depots]',
      ...depots.map((id) => `${id}=1`),
      ''
    ].join('\n'),
    label: '应用侧配置（AppID / DLC / depot 解锁）'
  });

  if (o.broadcast) {
    files.push({
      rel: path.join('steam_settings', 'custom_broadcasts.txt'),
      content: `${o.broadcast}\n`,
      label: '自定义广播名（联机房间靠这个互相找到）'
    });
  }

  if (profile.kind === 'coop') {
    files.push({
      rel: path.join('steam_settings', 'disable_lan_only.txt'),
      content: '',
      label: '联机模式开关（允许非局域网互联）'
    });
  }

  if (dlc.length) {
    files.push({
      rel: path.join('steam_settings', 'DLC.txt'),
      content: dlc.map((id) => `${id}=已解锁`).join('\n') + '\n',
      label: `DLC 列表（${dlc.length} 项）`
    });
  }

  if (depots.length) {
    files.push({
      rel: path.join('steam_settings', 'depots.txt'),
      content: depots.map((id) => `${id}=已解锁`).join('\n') + '\n',
      label: `depot 列表（${depots.length} 项）`
    });
  }

  if (profile.kind === 'nosteam' && o.launchArgs) {
    files.push({
      rel: '.shiro-launch-args.txt',
      content: `${o.launchArgs}\n`,
      label: '启动参数记录（供快捷方式使用）'
    });
  }

  return files;
}

/* ================================================================== */
/* hosts 托管区                                                        */
/* ================================================================== */

function readHosts() {
  const f = hostsFile();
  try {
    return fs.readFileSync(f, 'utf8');
  } catch (_) {
    return '';
  }
}

function hostsBlock() {
  const text = readHosts();
  const i = text.indexOf(HOSTS_BEGIN);
  const j = text.indexOf(HOSTS_END);
  if (i < 0 || j < 0) return { domains: [], raw: '' };
  const body = text.slice(i + HOSTS_BEGIN.length, j);
  const domains = body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.replace(/^0\.0\.0\.0\s+/, '').trim())
    .filter(Boolean);
  return { domains, raw: body };
}

function stripHostsBlock(text) {
  const i = text.indexOf(HOSTS_BEGIN);
  const j = text.indexOf(HOSTS_END);
  if (i < 0 || j < 0) return text;
  const after = j + HOSTS_END.length;
  return (text.slice(0, i) + text.slice(after)).replace(/\n{3,}/g, '\n\n');
}

function writeHostsBlock(domains) {
  const f = hostsFile();
  const list = (domains || []).map((d) => String(d).trim()).filter(Boolean);
  let text = readHosts();
  if (!text) throw new Error('读不到 hosts 文件');
  text = stripHostsBlock(text);
  const body = list.length
    ? `\n${HOSTS_BEGIN}\n# 由 白机甲工坊 · 补丁中心 写入，删除这一段即可完全恢复\n${list.map((d) => `0.0.0.0 ${d}`).join('\n')}\n${HOSTS_END}\n`
    : '';
  const backupDir = path.join(userDataDir(), 'bypass-backups');
  fs.mkdirSync(backupDir, { recursive: true });
  try {
    fs.copyFileSync(f, path.join(backupDir, `hosts.${stamp()}.bak`));
  } catch (_) {
    /* 备份失败不阻塞 */
  }
  fs.writeFileSync(f, text.replace(/\s*$/, '\n') + body, 'utf8');
  return { path: f, domains: list };
}

function hostsState() {
  const f = hostsFile();
  let writable = false;
  try {
    fs.accessSync(f, fs.constants.W_OK);
    writable = true;
  } catch (_) {
    writable = false;
  }
  return { path: f, writable, admin: isAdmin(), ...hostsBlock(), preset: PRESET_DOMAINS };
}

/* ================================================================== */
/* 防火墙（出站阻断）                                                    */
/* ================================================================== */

function ruleName(exePath) {
  return `ShiroMecha_Block_${crypto.createHash('sha1').update(String(exePath)).digest('hex').slice(0, 10)}`;
}

async function firewallAdd(exePath) {
  if (process.platform !== 'win32') throw new Error('防火墙规则目前只支持 Windows');
  const exe = String(exePath || '').trim();
  if (!exe || !fs.existsSync(exe)) throw new Error('找不到这个可执行文件');
  const name = ruleName(exe);
  const args = ['advfirewall', 'firewall', 'add', 'rule', `name=${name}`, 'dir=out', 'program=' + exe, 'action=block', 'enable=yes'];
  const r = await run('netsh', args);
  if (!r.ok) throw new Error(r.output || '写入防火墙规则失败（多半是没以管理员运行）');
  return { name, exe, output: r.output };
}

async function firewallRemove(exePath) {
  if (process.platform !== 'win32') throw new Error('防火墙规则目前只支持 Windows');
  const name = ruleName(exePath);
  const r = await run('netsh', ['advfirewall', 'firewall', 'delete', 'rule', `name=${name}`]);
  return { name, ok: r.ok, output: r.output };
}

async function firewallList() {
  if (process.platform !== 'win32') return { rules: [] };
  const r = await run('netsh', ['advfirewall', 'firewall', 'show', 'rule', 'name=all', 'dir=out']);
  const rules = [];
  let cur = null;
  for (const line of r.output.split('\n')) {
    const m = line.match(/^Rule Name:\s*(.+)$/i);
    if (m) {
      cur = { name: m[1].trim() };
      rules.push(cur);
    } else if (cur) {
      const p = line.match(/^Program:\s*(.+)$/i);
      if (p) cur.program = p[1].trim();
      const a = line.match(/^Action:\s*(.+)$/i);
      if (a) cur.action = a[1].trim();
    }
  }
  return { rules: rules.filter((x) => /^ShiroMecha_Block_/.test(x.name)), total: rules.length };
}

/* ================================================================== */
/* 还原点                                                              */
/* ================================================================== */

function points() {
  const list = readJson(pointStore(), []);
  return Array.isArray(list) ? list : [];
}

function savePoints(list) {
  writeJson(pointStore(), list);
  return list;
}

function openPoint(meta) {
  const list = points();
  const point = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    profileId: meta.profileId || '',
    profileName: meta.profileName || '',
    kind: meta.kind || 'file',
    gameDir: meta.gameDir || '',
    created: [],
    overwritten: [],
    firewall: [],
    hosts: [],
    actions: []
  };
  list.push(point);
  savePoints(list);
  return point;
}

function updatePoint(id, patch) {
  const list = points();
  const idx = list.findIndex((p) => p.id === id);
  if (idx < 0) return null;
  list[idx] = { ...list[idx], ...patch };
  savePoints(list);
  return list[idx];
}

async function deploy(profileId, gameDirOverride) {
  const profile = db().profiles.find((p) => p.id === profileId);
  if (!profile) throw new Error('没有找到这个补丁档案');

  const dir = String(gameDirOverride || profile.gameDir || '').trim();
  if (!dir) throw new Error('请先选择游戏安装目录');
  if (!fs.existsSync(dir)) throw new Error(`游戏目录不存在：${dir}`);
  if (!fs.statSync(dir).isDirectory()) throw new Error('目标必须是一个目录');

  const point = openPoint({ profileId: profile.id, profileName: profile.name, kind: profile.kind, gameDir: dir });
  const log = [];

  try {
    /* ---- 1. 部署用户自带的文件 ---- */
    for (const src of profile.files) {
      if (!src || !fs.existsSync(src)) {
        log.push(`跳过（找不到源文件）：${src}`);
        continue;
      }
      const st = fs.statSync(src);
      const targets = st.isDirectory()
        ? fs.readdirSync(src).map((f) => path.join(src, f))
        : [src];

      for (const from of targets) {
        if (fs.statSync(from).isDirectory()) {
          const sub = path.join(dir, path.basename(from));
          fs.cpSync(from, sub, { recursive: true });
          point.created.push(sub);
          log.push(`写入目录 ${path.basename(from)}`);
          continue;
        }
        const name = path.basename(from);
        const to = path.join(dir, name);
        if (fs.existsSync(to)) {
          const backup = uniquePath(dir, name);
          fs.copyFileSync(to, backup);
          point.overwritten.push({ file: to, backup });
          log.push(`备份 ${name} → ${path.basename(backup)}`);
        }
        fs.copyFileSync(from, to);
        point.created.push(to);
        log.push(`写入 ${name}`);
      }
    }

    /* ---- 2. 生成配置文件 ---- */
    const plan = settingsPlan(profile);
    for (const item of plan) {
      const to = path.join(dir, item.rel);
      const existedBefore = fs.existsSync(to);
      fs.mkdirSync(path.dirname(to), { recursive: true });
      if (existedBefore) {
        const backup = uniquePath(path.dirname(to), path.basename(to));
        fs.copyFileSync(to, backup);
        point.overwritten.push({ file: to, backup });
      }
      fs.writeFileSync(to, item.content, 'utf8');
      if (!existedBefore) point.created.push(to);
      log.push(`${existedBefore ? '更新' : '新建'} ${item.rel}`);
    }

    /* ---- 3. hosts 屏蔽 ---- */
    if (profile.options && profile.options.writeHosts) {
      const current = hostsBlock().domains;
      const next = Array.from(new Set([...current, ...PRESET_DOMAINS.map((d) => d.domain)]));
      try {
        writeHostsBlock(next);
        point.hosts = next;
        log.push(`hosts 已屏蔽 ${next.length} 条校验域名`);
      } catch (err) {
        log.push(`hosts 写入失败（${String(err.message || err)}）`);
      }
    }

    /* ---- 4. 出站防火墙 ---- */
    if (profile.options && profile.options.firewall) {
      let exe = profile.options.exeName ? path.join(dir, profile.options.exeName) : '';
      if (!exe || !fs.existsSync(exe)) {
        try {
          const found = analyze(dir);
          exe = found.exe ? found.exe.path : '';
        } catch (_) {
          exe = '';
        }
      }
      if (exe) {
        try {
          const r = await firewallAdd(exe);
          point.firewall.push(exe);
          log.push(`已屏蔽 ${path.basename(exe)} 的出站连接`);
        } catch (err) {
          log.push(`防火墙规则失败：${String(err.message || err)}`);
        }
      } else {
        log.push('没找到可执行文件，跳过防火墙规则');
      }
    }
  } catch (err) {
    log.push(`部署中断：${String((err && err.message) || err)}`);
    updatePoint(point.id, {
      created: point.created,
      overwritten: point.overwritten,
      hosts: point.hosts,
      firewall: point.firewall,
      actions: log
    });
    throw err;
  }

  updatePoint(point.id, { created: point.created, overwritten: point.overwritten, hosts: point.hosts, firewall: point.firewall, actions: log });

  return { pointId: point.id, gameDir: dir, actions: log, plan: settingsPlan(profile) };
}

async function restore(pointId) {
  const list = points();
  const point = list.find((p) => p.id === pointId);
  if (!point) throw new Error('没有找到这个还原点');
  const log = [];

  for (const f of point.created || []) {
    try {
      if (fs.existsSync(f)) {
        fs.rmSync(f, { recursive: true, force: true });
        log.push(`删除 ${path.relative(point.gameDir, f) || f}`);
      }
    } catch (err) {
      log.push(`删除失败 ${f}：${String((err && err.message) || err)}`);
    }
  }

  for (const o of point.overwritten || []) {
    try {
      if (o.backup && fs.existsSync(o.backup)) {
        fs.copyFileSync(o.backup, o.file);
        fs.rmSync(o.backup, { force: true });
        log.push(`还原 ${path.basename(o.file)}`);
      }
    } catch (err) {
      log.push(`还原失败 ${o.file}：${String((err && err.message) || err)}`);
    }
  }

  for (const exe of point.firewall || []) {
    try {
      const r = await firewallRemove(exe);
      log.push(r.ok ? `已移除防火墙规则 ${r.name}` : `防火墙规则移除失败：${r.output}`);
    } catch (err) {
      log.push(`防火墙规则移除失败：${String((err && err.message) || err)}`);
    }
  }

  const next = points().map((p) => (p.id === pointId ? { ...p, restoredAt: Date.now(), restoreLog: log } : p));
  savePoints(next);
  return { log, pointId };
}

function removePoint(pointId) {
  savePoints(points().filter((p) => p.id !== pointId));
  return { points: points() };
}

async function restoreLatest() {
  const list = points().filter((p) => !p.restoredAt);
  if (!list.length) throw new Error('没有可还原的部署点');
  list.sort((a, b) => b.createdAt - a.createdAt);
  return restore(list[0].id);
}

/* ================================================================== */
/* 说明（原样显示给用户）                                                */
/* ================================================================== */

function guide() {
  return {
    kind: [
      { id: 'coop', name: '联机补丁', hint: '生成 steam_settings 一整套（账号名 / 广播名 / DLC / depot），配合你自己的仿真 dll 使用' },
      { id: 'nosteam', name: '免 Steam 补丁', hint: '写 steam_appid.txt + 启动参数，让游戏脱离 Steam 客户端直启' },
      { id: 'drm', name: 'DRM / 联网验证绕过', hint: '部署你的文件 + hosts 屏蔽校验域名 + 出站防火墙规则' },
      { id: 'file', name: '纯文件部署', hint: '只做文件复制和备份，不生成任何配置' }
    ],
    steps: [
      { title: '1. 选游戏目录', detail: '在「目录体检」里选中游戏安装目录，程序会告诉你有几个 steam_api 文件、主程序是哪个、有没有已经打过补丁。' },
      { title: '2. 建一条档案', detail: '选类型、填 AppID、把你自己电脑上的补丁文件加进来，需要联机的填广播名。' },
      { title: '3. 一键部署', detail: '原文件自动改名备份（.shiro-backupN），生成的配置写在 steam_settings，同时留下还原点。' },
      { title: '4. 一键还原', detail: '任何时候点还原，删干净新建的文件、把备份换回去、撤掉防火墙规则，回到部署前的样子。' }
    ],
    notes: [
      '程序不内置、不下载、不分发任何补丁或游戏本体，所有文件都来自你自己。',
      'hosts 和防火墙两项需要管理员权限，不加也能部署，只是这两项不可用。',
      'hosts 只动自己那一段托管区，你原来的内容一个字不改，还原时整段删掉。'
    ]
  };
}

module.exports = {
  profiles,
  saveProfile,
  removeProfile,
  analyze,
  settingsPlan,
  deploy,
  restore,
  restoreLatest,
  points,
  removePoint,
  hostsState,
  writeHostsBlock,
  stripHostsBlock,
  firewallAdd,
  firewallRemove,
  firewallList,
  guide,
  PRESET_DOMAINS,
  storeFile: store
};
