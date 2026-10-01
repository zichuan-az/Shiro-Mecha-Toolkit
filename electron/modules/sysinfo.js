'use strict';

const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');

/**
 * 本机信息采集 + Steam 安装位置探测。
 * 只读取本机信息用于界面展示，不做任何上传。
 */

function home() {
  return os.homedir();
}

function isElevated() {
  if (process.platform === 'win32') {
    try {
      // 由 server 端在启动时写入的标记（见 win/README）
      return !!process.env.SHIRO_ELEVATED;
    } catch (_) {
      return false;
    }
  }
  return typeof process.getuid === 'function' ? process.getuid() === 0 : false;
}

function existsSafe(p) {
  try {
    return fs.existsSync(p);
  } catch (_) {
    return false;
  }
}

function steamRoots() {
  const list = [];
  const add = (p) => {
    if (p && !list.includes(p)) list.push(p);
  };

  if (process.platform === 'win32') {
    const pf = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const pf64 = process.env['ProgramFiles'] || 'C:\\Program Files';
    add(path.join(pf, 'Steam'));
    add(path.join(pf64, 'Steam'));
    add('C:\\Steam');
    add('D:\\Steam');
    add('E:\\Steam');
  } else if (process.platform === 'darwin') {
    add(path.join(home(), 'Library', 'Application Support', 'Steam'));
  } else {
    add(path.join(home(), '.steam', 'steam'));
    add(path.join(home(), '.steam', 'root'));
    add(path.join(home(), '.local', 'share', 'Steam'));
    add(path.join(home(), 'snap', 'steam', 'common', '.local', 'share', 'Steam'));
    add('/usr/share/steam');
  }
  return list;
}

function detectSteam() {
  for (const root of steamRoots()) {
    if (!existsSafe(root)) continue;
    const libFile = path.join(root, 'steamapps', 'libraryfolders.vdf');
    const libs = [];
    if (existsSafe(libFile)) {
      try {
        const text = fs.readFileSync(libFile, 'utf8');
        const re = /"path"\s+"([^"]+)"/g;
        let m;
        while ((m = re.exec(text))) {
          const p = m[1].replace(/\\\\/g, '\\');
          if (!libs.includes(p)) libs.push(p);
        }
      } catch (_) {
        /* 忽略解析失败 */
      }
    }
    return {
      found: true,
      root,
      libraryFolders: libs.length ? libs : [root],
      accountId: readLoginUsers(root)
    };
  }
  return { found: false, root: '', libraryFolders: [], accountId: null };
}

function readLoginUsers(root) {
  const f = path.join(root, 'config', 'loginusers.vdf');
  if (!existsSafe(f)) return null;
  try {
    const text = fs.readFileSync(f, 'utf8');
    const blocks = text.split(/\n\s*"(\d{17})"\s*\n\s*\{/g);
    const users = [];
    for (let i = 1; i < blocks.length; i += 2) {
      const id = blocks[i];
      const body = blocks[i + 1] || '';
      const name = (body.match(/"AccountName"\s+"([^"]*)"/) || [])[1] || '';
      const persona = (body.match(/"PersonaName"\s+"([^"]*)"/) || [])[1] || '';
      const mostRecent = /"MostRecent"\s+"1"/.test(body);
      users.push({ steamId64: id, accountName: name, personaName: persona, mostRecent });
    }
    return users.length ? users : null;
  } catch (_) {
    return null;
  }
}

function diskFree(p) {
  try {
    const st = fs.statfsSync ? fs.statfsSync(p) : null;
    if (!st) return null;
    return { total: st.blocks * st.bsize, free: st.bavail * st.bsize };
  } catch (_) {
    return null;
  }
}

function snapshot() {
  const steam = detectSteam();
  const nets = Object.entries(os.networkInterfaces()).flatMap(([name, addrs]) =>
    (addrs || [])
      .filter((a) => !a.internal && a.family === 'IPv4')
      .map((a) => ({ name, address: a.address, mac: a.mac }))
  );

  const cpus = os.cpus() || [];

  return {
    os: {
      platform: process.platform,
      release: os.release(),
      version: os.version ? os.version() : '',
      arch: process.arch,
      hostname: os.hostname(),
      uptime: os.uptime()
    },
    cpu: {
      model: cpus.length ? cpus[0].model.trim() : 'unknown',
      cores: cpus.length,
      speedMHz: cpus.length ? cpus[0].speed : 0,
      load1: os.loadavg ? os.loadavg()[0] : 0
    },
    memory: {
      total: os.totalmem(),
      free: os.freemem(),
      used: os.totalmem() - os.freemem()
    },
    networks: nets,
    steam,
    admin: isElevated(),
    home: home()
  };
}

module.exports = { snapshot, detectSteam, isElevated, steamRoots, diskFree, existsSafe };
