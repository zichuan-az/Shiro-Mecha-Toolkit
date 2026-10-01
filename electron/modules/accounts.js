'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');

const sysinfo = require('./sysinfo');

/**
 * Steam 账号一键切换
 *
 * 做法（不保存账号密码，只做「把哪个账号设为默认登录」）：
 *   · Windows：写入 HKCU\Software\Valve\Steam 的 AutoLoginUser / RememberPassword，
 *              并同步 loginusers.vdf 里的 MostRecent 标记；
 *   · macOS / Linux：同步 loginusers.vdf 的 MostRecent 标记。
 * 密码始终由 Steam 客户端自己保管，本程序不接触、不存储。
 */

let file = null;

function storeFile() {
  if (file) return file;
  let base;
  try {
    base = require('electron').app.getPath('userData');
  } catch (_) {
    base = path.join(os.homedir(), '.shiro-mecha-toolkit');
  }
  fs.mkdirSync(base, { recursive: true });
  file = path.join(base, 'accounts.json');
  return file;
}

function readStore() {
  try {
    return JSON.parse(fs.readFileSync(storeFile(), 'utf8'));
  } catch (_) {
    return [];
  }
}

function writeStore(list) {
  fs.writeFileSync(storeFile(), JSON.stringify(list, null, 2), 'utf8');
}

function list() {
  const saved = readStore();
  const steam = sysinfo.detectSteam();
  const detected = (steam.accountId || []).map((u) => ({
    id: `auto-${u.steamId64}`,
    accountName: u.accountName,
    personaName: u.personaName,
    steamId64: u.steamId64,
    active: !!u.mostRecent,
    source: 'detected'
  }));

  const merged = saved.map((s) => {
    const hit = detected.find((d) => d.steamId64 === s.steamId64);
    return { ...s, personaName: (hit && hit.personaName) || s.personaName || '', active: !!(hit && hit.active), present: !!hit };
  });

  for (const d of detected) {
    if (!merged.some((m) => m.steamId64 === d.steamId64)) merged.push(d);
  }

  return { accounts: merged, steamRoot: steam.root, found: steam.found };
}

function save(account) {
  const list_ = readStore();
  const entry = {
    id: account.id || crypto.randomUUID(),
    accountName: String(account.accountName || '').trim(),
    personaName: String(account.personaName || '').trim(),
    steamId64: String(account.steamId64 || '').trim(),
    note: String(account.note || '').slice(0, 120),
    createdAt: Date.now()
  };
  if (!entry.accountName) throw new Error('请填写账号名（登录用户名）');

  const idx = list_.findIndex((a) => a.id === entry.id || (entry.steamId64 && a.steamId64 === entry.steamId64));
  if (idx >= 0) list_[idx] = { ...list_[idx], ...entry };
  else list_.push(entry);
  writeStore(list_);
  return list();
}

function remove(id) {
  writeStore(readStore().filter((a) => a.id !== id));
  return list();
}

/* --------------------------- loginusers.vdf --------------------------- */

function loginUsersPath() {
  const steam = sysinfo.detectSteam();
  if (!steam.found) throw new Error('没有找到 Steam 安装目录，请先在设置里手动指定');
  return path.join(steam.root, 'config', 'loginusers.vdf');
}

function setMostRecent(steamId64) {
  const p = loginUsersPath();
  if (!fs.existsSync(p)) throw new Error('没有找到 Steam 的登录记录文件 loginusers.vdf');

  const raw = fs.readFileSync(p, 'utf8');
  const lines = raw.split(/\r?\n/);
  const out = [];
  let currentId = null;

  for (const line of lines) {
    const idMatch = line.match(/^\s*"(\d{17})"\s*$/);
    if (idMatch) currentId = idMatch[1];

    if (currentId && /"MostRecent"\s+"[01]"/.test(line)) {
      const want = currentId === String(steamId64) ? '1' : '0';
      out.push(line.replace(/"MostRecent"\s+"[01]"/, `"MostRecent"\t\t"${want}"`));
      continue;
    }
    out.push(line);
  }

  const backup = `${p}.shiro-backup-${Date.now()}`;
  try {
    fs.writeFileSync(backup, raw, 'utf8');
  } catch (_) {
    /* 备份失败不阻断 */
  }
  fs.writeFileSync(p, out.join('\n'), 'utf8');
  return { file: p, backup };
}

function setWindowsAutoLogin(accountName) {
  return new Promise((resolve) => {
    const script =
      `$p='HKCU:\\Software\\Valve\\Steam'; ` +
      `if(!(Test-Path $p)){New-Item -Path $p -Force | Out-Null}; ` +
      `Set-ItemProperty -Path $p -Name AutoLoginUser -Value '${accountName.replace(/'/g, "''")}' -Force; ` +
      `Set-ItemProperty -Path $p -Name RememberPassword -Value 1 -Type DWord -Force`;
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], (err) => {
      resolve(!err);
    });
  });
}

async function switchTo(id) {
  const data = list();
  const account = data.accounts.find((a) => a.id === id);
  if (!account) throw new Error('没有找到这个账号');

  const steps = [];

  if (account.steamId64) {
    const r = setMostRecent(account.steamId64);
    steps.push(`已把 ${account.accountName || account.steamId64} 设为默认登录账号`);
    steps.push(`原文件已备份到 ${r.backup}`);
  }

  if (process.platform === 'win32' && account.accountName) {
    const ok = await setWindowsAutoLogin(account.accountName);
    steps.push(ok ? '已写入 Windows 自动登录项' : '写入 Windows 自动登录项失败（不影响下面手填）');
  }

  steps.push('请重启 Steam 客户端生效。密码依旧由 Steam 自己保管，本程序从不接触密码。');

  return { ok: true, steps, account: account.accountName || account.steamId64 };
}

module.exports = { list, save, remove, switchTo, storeFile };
