'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const https = require('node:https');
const net = require('node:net');

/**
 * hosts 加速模块
 *
 * 原理说明（也是给用户看的说明）：
 *   1. 通过公共 DoH(DNS over HTTPS) 解析出目标域名的全部 A 记录；
 *   2. 对每个 IP 做 TCP 443 三次握手测速，取延迟最低的一个；
 *   3. 把结果写入系统 hosts 的独立区块（带 BEGIN/END 标记），不碰用户原有内容。
 *
 * 全程本地完成，不经过任何第三方服务器。
 */

const MARK_BEGIN = '# ===== Shiro Mecha Toolkit BEGIN (请勿手动修改本区块) =====';
const MARK_END = '# ===== Shiro Mecha Toolkit END =====';
const PROBE_TIMEOUT = 1200;

/* ---------------------------- 域名组 ---------------------------- */

const GROUPS = [
  {
    id: 'steam',
    name: 'Steam 商店与社区',
    nameEn: 'Steam Store & Community',
    icon: 'store',
    desc: '商店、社区、创意工坊、CDN',
    domains: [
      'store.steampowered.com',
      'api.steampowered.com',
      'steamcommunity.com',
      'help.steampowered.com',
      'checkout.steampowered.com',
      'login.steampowered.com',
      'store.steamstatic.com',
      'cdn.akamai.steamstatic.com',
      'community.akamai.steamstatic.com',
      'shared.akamai.steamstatic.com',
      'steamcdn-a.akamaihd.net',
      'media.steampowered.com'
    ]
  },
  {
    id: 'github',
    name: 'GitHub 代码托管',
    nameEn: 'GitHub',
    icon: 'code',
    desc: '仓库、Raw、Release、头像',
    domains: [
      'github.com',
      'api.github.com',
      'codeload.github.com',
      'raw.githubusercontent.com',
      'objects.githubusercontent.com',
      'gist.githubusercontent.com',
      'avatars.githubusercontent.com',
      'github.global.ssl.fastly.net'
    ]
  },
  {
    id: 'steamweb',
    name: 'Steam 图片与静态资源',
    nameEn: 'Steam Static Assets',
    icon: 'image',
    desc: '封面、截图、成就图标加速',
    domains: [
      'cdn.cloudflare.steamstatic.com',
      'cdn.steamstatic.com',
      'clan.cloudflare.steamstatic.com',
      'images.steamusercontent.com',
      'avatars.steamstatic.com'
    ]
  },
  {
    id: 'pixiv',
    name: 'Pixiv',
    nameEn: 'Pixiv',
    icon: 'palette',
    desc: '站内与图床',
    domains: ['www.pixiv.net', 'i.pximg.net', 'accounts.pixiv.net', 'source.pixiv.net', 'oi.pximg.net']
  },
  {
    id: 'discord',
    name: 'Discord',
    nameEn: 'Discord',
    icon: 'message',
    desc: '客户端网关与 CDN',
    domains: [
      'discord.com',
      'discordapp.com',
      'gateway.discord.gg',
      'cdn.discordapp.com',
      'media.discordapp.net',
      'images-ext-1.discordapp.net'
    ]
  },
  {
    id: 'epic',
    name: 'Epic Games',
    nameEn: 'Epic Games',
    icon: 'gamepad',
    desc: '启动器与商店',
    domains: [
      'epicgames.com',
      'www.epicgames.com',
      'launcher.epicgames.com',
      'store.epicgames.com',
      'cdn1.epicgames.com',
      'download.epicgames.com'
    ]
  },
  {
    id: 'onestore',
    name: '主机与云盘',
    nameEn: 'Cloud & Console',
    icon: 'cloud',
    desc: 'OneDrive / Twitch / EA / Ubisoft',
    domains: [
      'onedrive.live.com',
      'skyapi.onedrive.live.com',
      'www.twitch.tv',
      'api.twitch.tv',
      'www.ea.com',
      'origin-a.akamaihd.net',
      'ubisoftconnect.com',
      'api.ubisoft.com'
    ]
  },
  {
    id: 'dev',
    name: '开发者常用',
    nameEn: 'Developer Services',
    icon: 'terminal',
    desc: 'npm / Docker / HuggingFace',
    domains: [
      'registry.npmjs.org',
      'registry.npmmirror.com',
      'registry-1.docker.io',
      'production.cloudflare.docker.com',
      'huggingface.co',
      'cdn-lfs.huggingface.co',
      'files.pythonhosted.org',
      'pypi.org'
    ]
  }
];

/* ---------------------------- hosts 路径 ---------------------------- */

function hostsPath() {
  if (process.platform === 'win32') {
    const root = process.env.SystemRoot || 'C:\\Windows';
    return path.join(root, 'System32', 'drivers', 'etc', 'hosts');
  }
  return '/etc/hosts';
}

function backupDir() {
  try {
    const base = require('electron').app.getPath('userData');
    const dir = path.join(base, 'hosts-backups');
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  } catch (_) {
    const dir = path.join(os.homedir(), '.shiro-mecha-toolkit', 'hosts-backups');
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }
}

/* ---------------------------- 读写 ---------------------------- */

function read() {
  const p = hostsPath();
  try {
    const raw = fs.readFileSync(p, 'utf8');
    const managed = extractBlock(raw);
    return {
      path: p,
      writable: canWrite(p),
      managedEntries: parseEntries(managed),
      rawLength: raw.length,
      exists: true
    };
  } catch (err) {
    return { path: p, writable: false, managedEntries: [], exists: false, error: String(err.message || err) };
  }
}

function canWrite(p) {
  try {
    fs.accessSync(p, fs.constants.W_OK);
    return true;
  } catch (_) {
    return false;
  }
}

function extractBlock(raw) {
  const i = raw.indexOf(MARK_BEGIN);
  const j = raw.indexOf(MARK_END);
  if (i === -1 || j === -1 || j < i) return '';
  return raw.slice(i + MARK_BEGIN.length, j);
}

function parseEntries(block) {
  const out = {};
  for (const line of block.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const parts = t.split(/\s+/);
    if (parts.length >= 2) {
      const ip = parts[0];
      for (const host of parts.slice(1)) out[host] = ip;
    }
  }
  return out;
}

/* ---------------------------- DoH 解析 ---------------------------- */

const DOH_ENDPOINTS = [
  { host: '223.5.5.5', path: (n) => `/resolve?name=${n}&type=A` },
  { host: '1.12.12.12', path: (n) => `/resolve?name=${n}&type=A` },
  { host: 'cloudflare-dns.com', path: (n) => `/dns-query?name=${n}&type=A`, accept: 'application/dns-json' }
];

function dohQuery(domain, endpoint) {
  return new Promise((resolve) => {
    const options = {
      host: endpoint.host,
      path: endpoint.path(encodeURIComponent(domain)),
      method: 'GET',
      timeout: 4000,
      headers: {
        Accept: endpoint.accept || 'application/dns-json',
        'User-Agent': 'ShiroMechaToolkit/1.0'
      },
      // 这些公共 DNS 多数支持直连 IP，https 证书对域名生效，因此对 IP 直连需跳过校验
      rejectUnauthorized: !/^[\d.]+$/.test(endpoint.host),
      servername: /^[\d.]+$/.test(endpoint.host) ? undefined : endpoint.host
    };
    if (/^[\d.]+$/.test(endpoint.host)) options.headers.Host = endpoint.host;

    const req = https.request(options, (res) => {
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (buf += c));
      res.on('end', () => {
        try {
          const json = JSON.parse(buf);
          const ips = (json.Answer || [])
            .filter((a) => a.type === 1 || a.type === 28)
            .filter((a) => !/^(0\.|127\.|10\.|192\.168\.)/.test(a.data))
            .map((a) => a.data);
          resolve(ips);
        } catch (_) {
          resolve([]);
        }
      });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve([]);
    });
    req.on('error', () => resolve([]));
    req.end();
  });
}

async function resolveDomain(domain) {
  for (const ep of DOH_ENDPOINTS) {
    const ips = await dohQuery(domain, ep);
    if (ips.length) return ips;
  }
  return [];
}

/* ---------------------------- 延迟测试 ---------------------------- */

function probeIp(ip, port = 443) {
  return new Promise((resolve) => {
    const started = process.hrtime.bigint();
    const socket = new net.Socket();
    let done = false;
    const finish = (ms) => {
      if (done) return;
      done = true;
      try {
        socket.destroy();
      } catch (_) {
        /* 忽略 */
      }
      resolve(ms);
    };
    socket.setTimeout(PROBE_TIMEOUT);
    socket.once('connect', () => finish(Number(process.hrtime.bigint() - started) / 1e6));
    socket.once('timeout', () => finish(null));
    socket.once('error', () => finish(null));
    try {
      socket.connect(port, ip);
    } catch (_) {
      finish(null);
    }
  });
}

async function probeHost(host, port = 443) {
  const ips = await resolveDomain(host);
  if (!ips.length) return { host, ok: false, ip: null, ms: null };
  const results = await Promise.all(ips.slice(0, 4).map(async (ip) => ({ ip, ms: await probeIp(ip, port) })));
  const good = results.filter((r) => r.ms !== null).sort((a, b) => a.ms - b.ms);
  return good.length
    ? { host, ok: true, ip: good[0].ip, ms: Math.round(good[0].ms), candidates: good }
    : { host, ok: false, ip: null, ms: null };
}

/* ---------------------------- 生成与写入 ---------------------------- */

async function buildMapping(groupIds) {
  const groups = GROUPS.filter((g) => !groupIds || groupIds.includes(g.id));
  const domains = [...new Set(groups.flatMap((g) => g.domains))];
  const results = [];
  const queue = [...domains];

  // 并发 8 路解析，避免把公共 DNS 打爆
  const workers = Array.from({ length: Math.min(8, queue.length) }, async () => {
    while (queue.length) {
      const d = queue.shift();
      const r = await probeHost(d);
      results.push(r);
    }
  });
  await Promise.all(workers);

  const mapping = {};
  for (const r of results) {
    if (r.ok && r.ip) mapping[r.host] = r.ip;
  }
  return { mapping, results };
}

async function preview(groupIds) {
  const { mapping, results } = await buildMapping(groupIds);
  return {
    path: hostsPath(),
    writable: canWrite(hostsPath()),
    entries: mapping,
    count: Object.keys(mapping).length,
    details: results.map((r) => ({ host: r.host, ip: r.ip, ms: r.ms, ok: r.ok }))
  };
}

function renderBlock(mapping) {
  const lines = [MARK_BEGIN, `# 生成时间: ${new Date().toLocaleString('zh-CN')}`];
  const sorted = Object.keys(mapping).sort();
  for (const host of sorted) {
    lines.push(`${mapping[host]}\t${host}`);
  }
  lines.push(MARK_END);
  return lines.join('\n');
}

function applyBlock(raw, block) {
  const i = raw.indexOf(MARK_BEGIN);
  const j = raw.indexOf(MARK_END);
  const sep = raw.includes('\r\n') ? '\r\n' : '\n';
  const normalised = block.split('\n').join(sep);

  if (i !== -1 && j !== -1 && j > i) {
    return raw.slice(0, i) + normalised + raw.slice(j + MARK_END.length);
  }
  const head = raw.endsWith(sep) ? raw : raw + sep;
  return head + sep + normalised + sep;
}

async function apply(groupIds, options = {}) {
  const { mapping } = await buildMapping(groupIds);
  if (!Object.keys(mapping).length) {
    throw new Error('解析失败：没有任何域名拿到可用 IP，请检查网络后重试。');
  }

  const p = hostsPath();
  let raw = '';
  try {
    raw = fs.readFileSync(p, 'utf8');
  } catch (_) {
    raw = '';
  }

  // 每次覆盖前留一份备份
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupId = `${stamp}`;
  try {
    fs.writeFileSync(path.join(backupDir(), `hosts-${backupId}.bak`), raw, 'utf8');
  } catch (_) {
    /* 备份失败不阻断 */
  }

  const next = applyBlock(raw, renderBlock(mapping));

  try {
    fs.writeFileSync(p, next, 'utf8');
  } catch (err) {
    throw new Error(
      `写入 hosts 失败：${err.code === 'EACCES' || err.code === 'EPERM' ? '权限不足，请以管理员身份运行本程序' : err.message}`
    );
  }

  pruneBackups();
  return { ok: true, count: Object.keys(mapping).length, backupId, path: p, entries: mapping };
}

function listBackups() {
  try {
    const dir = backupDir();
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.bak'))
      .map((f) => {
        const st = fs.statSync(path.join(dir, f));
        return { id: f.replace(/^hosts-|\.bak$/g, ''), file: f, size: st.size, time: st.mtimeMs };
      })
      .sort((a, b) => b.time - a.time);
  } catch (_) {
    return [];
  }
}

function pruneBackups(keep = 20) {
  const list = listBackups();
  for (const item of list.slice(keep)) {
    try {
      fs.unlinkSync(path.join(backupDir(), item.file));
    } catch (_) {
      /* 忽略 */
    }
  }
}

function restore(backupId) {
  const list = listBackups();
  const target = backupId ? list.find((b) => b.id === backupId) : list[0];
  if (!target) throw new Error('没有可用的备份文件。');
  const content = fs.readFileSync(path.join(backupDir(), target.file), 'utf8');
  try {
    fs.writeFileSync(hostsPath(), content, 'utf8');
  } catch (err) {
    throw new Error(`还原失败：${err.code === 'EACCES' || err.code === 'EPERM' ? '权限不足，请以管理员身份运行' : err.message}`);
  }
  return { ok: true, restored: target.id, path: hostsPath() };
}

/** 退出时若配置了「退出时还原」，则清掉本程序写入的区块 */
function flushOnExit() {
  try {
    const cfg = require('./config');
    if (!cfg.get('hosts.restoreOnExit')) return;
    const p = hostsPath();
    const raw = fs.readFileSync(p, 'utf8');
    const i = raw.indexOf(MARK_BEGIN);
    const j = raw.indexOf(MARK_END);
    if (i === -1 || j === -1) return;
    const next = (raw.slice(0, i) + raw.slice(j + MARK_END.length)).replace(/\n{3,}/g, '\n\n');
    fs.writeFileSync(p, next, 'utf8');
  } catch (_) {
    /* 忽略 */
  }
}

module.exports = {
  GROUPS,
  groups: () => GROUPS,
  read,
  preview,
  apply,
  restore,
  listBackups,
  hostsPath,
  resolveDomain,
  probeHost,
  flushOnExit
};
