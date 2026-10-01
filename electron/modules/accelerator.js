'use strict';

const http = require('node:http');
const net = require('node:net');
const tls = require('node:tls');
const { URL } = require('node:url');

const hostsMod = require('./hosts');
const cfg = require('./config');

/**
 * 本地加速服务
 *
 * 工作原理（大白话版）：
 *   本机起一个只监听 127.0.0.1 的代理端口。命中加速名单的域名，
 *   代理会先用 DoH 解析出**延迟最低**的那个 IP，再连过去；
 *   其它域名照常直连。整个过程不改变 TLS 证书与 SNI，
 *   所以浏览器和游戏客户端域名校验依旧通过，只是「绕开了慢的解析结果」。
 *
 * 只监听本机回环地址，不对外网开放，不转发、不记录任何内容。
 */

const state = {
  running: false,
  port: 51789,
  server: null,
  ruleHosts: new Set(),
  stats: { connections: 0, tunnelled: 0, bytesUp: 0, bytesDown: 0, startedAt: 0, errors: 0 },
  dnsCache: new Map(),
  logs: []
};

let emitter = () => {};
function attach(fn) {
  emitter = typeof fn === 'function' ? fn : () => {};
}

function log(level, message) {
  const entry = { t: Date.now(), level, message };
  state.logs.unshift(entry);
  if (state.logs.length > 200) state.logs.pop();
  emitter('accel:log', entry);
}

/* ------------------------------ 规则 ------------------------------ */

function rebuildRules() {
  const custom = cfg.get('accelerator.customRules', []) || [];
  const baseGroups = cfg.get('accelerator.lastGroups', ['steam', 'github']) || [];
  const ids = [...new Set([...baseGroups, ...custom.map((c) => c.group).filter(Boolean)])];

  const set = new Set();
  for (const g of hostsMod.GROUPS) {
    if (ids.includes(g.id)) g.domains.forEach((d) => set.add(d));
  }
  for (const c of custom) {
    if (c.enabled === false) continue;
    const host = String(c.host || '').trim().toLowerCase();
    if (!host) continue;
    if (host.startsWith('*.')) {
      // 泛域名：命中即视为匹配后缀
      set.add(host.slice(2).replace(/^\./, ''));
    } else {
      set.add(host);
    }
  }
  state.ruleHosts = set;
  return [...set];
}

function matchRule(host) {
  const h = String(host || '').toLowerCase().split(':')[0];
  if (!h) return false;
  if (state.ruleHosts.has(h)) return true;
  for (const rule of state.ruleHosts) {
    if (rule.startsWith('.') && h.endsWith(rule)) return true;
  }
  return false;
}

function rules() {
  const custom = cfg.get('accelerator.customRules', []) || [];
  return {
    groups: hostsMod.GROUPS,
    activeGroups: cfg.get('accelerator.lastGroups', []),
    custom,
    effectiveCount: state.ruleHosts.size
  };
}

function saveRules(payload) {
  const next = payload || {};
  if (Array.isArray(next.activeGroups)) cfg.set('accelerator.lastGroups', next.activeGroups);
  if (Array.isArray(next.custom)) cfg.set('accelerator.customRules', next.custom);
  rebuildRules();
  return rules();
}

/* --------------------------- DNS 优选缓存 --------------------------- */

async function bestIp(host) {
  const hit = state.dnsCache.get(host);
  if (hit && Date.now() - hit.time < 5 * 60 * 1000) return hit.ip;

  const ips = await hostsMod.resolveDomain(host);
  if (!ips.length) return null;

  let best = null;
  let bestMs = Infinity;
  for (const ip of ips.slice(0, 4)) {
    const ms = await new Promise((resolve) => {
      const started = Date.now();
      const s = new net.Socket();
      let done = false;
      const end = (v) => {
        if (done) return;
        done = true;
        try {
          s.destroy();
        } catch (_) {
          /* noop */
        }
        resolve(v);
      };
      s.setTimeout(1000);
      s.once('connect', () => end(Date.now() - started));
      s.once('timeout', () => end(null));
      s.once('error', () => end(null));
      try {
        s.connect(443, ip);
      } catch (_) {
        end(null);
      }
    });
    if (ms !== null && ms < bestMs) {
      bestMs = ms;
      best = ip;
    }
  }

  if (best) state.dnsCache.set(host, { ip: best, time: Date.now(), ms: bestMs });
  return best;
}

/* ------------------------------ 代理核心 ------------------------------ */

function tunnel(clientSocket, head, host, port) {
  state.stats.connections++;

  const onConnected = (target) => {
    if (head && head.length) target.write(head);
    clientSocket.write('HTTP/1.1 200 Connection Established\r\nProxy-Agent: ShiroMechaToolkit\r\n\r\n');

    target.on('data', (chunk) => {
      state.stats.bytesDown += chunk.length;
      if (!clientSocket.write(chunk)) target.pause();
    });
    clientSocket.on('drain', () => target.resume());

    clientSocket.on('data', (chunk) => {
      state.stats.bytesUp += chunk.length;
      if (!target.write(chunk)) clientSocket.pause();
    });
    target.on('drain', () => clientSocket.resume());

    const bye = () => {
      target.destroy();
      clientSocket.destroy();
    };
    target.on('end', bye);
    target.on('error', bye);
    clientSocket.on('end', bye);
    clientSocket.on('error', bye);
    clientSocket.on('close', bye);
    target.on('close', bye);
  };

  const goDirect = () => {
    const target = net.connect(port, host, () => onConnected(target));
    target.on('error', () => {
      state.stats.errors++;
      try {
        clientSocket.end('HTTP/1.1 502 Bad Gateway\r\n\r\n');
      } catch (_) {
        /* noop */
      }
    });
  };

  if (matchRule(host)) {
    bestIp(host)
      .then((ip) => {
        if (!ip) return goDirect();
        state.stats.tunnelled++;
        const target = net.connect(port, ip, () => onConnected(target));
        target.on('error', () => goDirect());
      })
      .catch(goDirect);
  } else {
    goDirect();
  }
}

function handlePlainRequest(clientReq, clientRes) {
  let target;
  try {
    target = new URL(clientReq.url);
  } catch (_) {
    clientRes.writeHead(400);
    clientRes.end('Bad Request');
    return;
  }

  const host = target.hostname;
  const useIp = matchRule(host);

  const run = (address) => {
    const options = {
      host: address,
      port: target.port || 80,
      path: target.pathname + target.search,
      method: clientReq.method,
      headers: { ...clientReq.headers, host: target.host }
    };
    const upstream = http.request(options, (upstreamRes) => {
      clientRes.writeHead(upstreamRes.statusCode, upstreamRes.headers);
      upstreamRes.on('data', (c) => {
        state.stats.bytesDown += c.length;
        clientRes.write(c);
      });
      upstreamRes.on('end', () => clientRes.end());
    });
    upstream.on('error', () => {
      state.stats.errors++;
      try {
        clientRes.writeHead(502);
        clientRes.end('Bad Gateway');
      } catch (_) {
        /* noop */
      }
    });
    clientReq.pipe(upstream);
  };

  if (useIp) {
    bestIp(host).then((ip) => run(ip || host)).catch(() => run(host));
  } else {
    run(host);
  }
}

/* ------------------------------ PAC ------------------------------ */

function pacScript(port) {
  const rules = [...state.ruleHosts];
  return `// Shiro Mecha Toolkit — 自动代理配置
// 由本机加速服务生成，只会把加速名单内的域名交给本地代理
function FindProxyForURL(url, host) {
  var list = ${JSON.stringify(rules)};
  var h = host.toLowerCase();
  for (var i = 0; i < list.length; i++) {
    var r = list[i];
    if (r.charAt(0) === '.') { if (h.length >= r.length && h.slice(-r.length) === r) return "PROXY 127.0.0.1:${port}; DIRECT"; }
    else if (h === r) return "PROXY 127.0.0.1:${port}; DIRECT";
  }
  return "DIRECT";
}
`;
}

/* ------------------------------ 启停 ------------------------------ */

function start(groupIds) {
  if (state.running) return Promise.resolve(status());

  if (Array.isArray(groupIds)) cfg.set('accelerator.lastGroups', groupIds);
  const port = Number(cfg.get('accelerator.listenPort', 51789)) || 51789;
  state.port = port;
  rebuildRules();

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (req.url === '/proxy.pac' || req.url === '/pac') {
        res.writeHead(200, { 'Content-Type': 'application/x-ns-proxy-autoconfig; charset=utf-8' });
        res.end(pacScript(state.port));
        return;
      }
      handlePlainRequest(req, res);
    });

    server.on('connect', (req, clientSocket, head) => {
      const [host, portStr] = req.url.split(':');
      tunnel(clientSocket, head, host, Number(portStr) || 443);
    });

    server.on('error', (err) => {
      state.running = false;
      state.server = null;
      state.stats.errors++;
      log('error', `加速服务启动失败：${err.message}`);
      reject(new Error(err.code === 'EADDRINUSE' ? `端口 ${port} 已被占用，请在设置里换一个端口` : err.message));
    });

    server.listen(port, '127.0.0.1', () => {
      state.server = server;
      state.running = true;
      state.stats.startedAt = Date.now();
      state.stats.connections = 0;
      state.stats.bytesUp = 0;
      state.stats.bytesDown = 0;
      log('info', `加速服务已启动，监听 127.0.0.1:${port}，规则 ${state.ruleHosts.size} 条`);

      if (cfg.get('accelerator.autoSetSystemProxy')) setSystemProxy(true, port);

      resolve(status());
    });
  });
}

function stop() {
  if (state.server) {
    try {
      state.server.close();
    } catch (_) {
      /* noop */
    }
  }
  if (cfg.get('accelerator.autoSetSystemProxy')) setSystemProxy(false);
  state.server = null;
  state.running = false;
  state.dnsCache.clear();
  log('info', '加速服务已停止');
  return status();
}

function status() {
  return {
    running: state.running,
    port: state.port,
    proxyAddress: `127.0.0.1:${state.port}`,
    pacUrl: `http://127.0.0.1:${state.port}/proxy.pac`,
    ruleCount: state.ruleHosts.size,
    startedAt: state.stats.startedAt,
    uptime: state.running ? Date.now() - state.stats.startedAt : 0,
    stats: {
      connections: state.stats.connections,
      tunnelled: state.stats.tunnelled,
      bytesUp: state.stats.bytesUp,
      bytesDown: state.stats.bytesDown,
      errors: state.stats.errors
    },
    logs: state.logs.slice(0, 40),
    systemProxy: cfg.get('accelerator.autoSetSystemProxy')
  };
}

/* --------------------------- 系统代理（可选） --------------------------- */

function setSystemProxy(enable, port) {
  const { execFile } = require('node:child_process');
  const p = port || state.port;
  try {
    if (process.platform === 'win32') {
      const script = enable
        ? `Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings' -Name ProxyServer -Value '127.0.0.1:${p}'; Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings' -Name ProxyEnable -Value 1`
        : `Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings' -Name ProxyEnable -Value 0`;
      execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], () => {});
    } else if (process.platform === 'darwin') {
      const services = ['Wi-Fi', 'Ethernet'];
      for (const svc of services) {
        if (enable) {
          execFile('networksetup', ['-setwebproxy', svc, '127.0.0.1', String(p)], () => {});
          execFile('networksetup', ['-setsecurewebproxy', svc, '127.0.0.1', String(p)], () => {});
        } else {
          execFile('networksetup', ['-setwebproxystate', svc, 'off'], () => {});
          execFile('networksetup', ['-setsecurewebproxystate', svc, 'off'], () => {});
        }
      }
    } else {
      const mode = enable ? 'manual' : 'none';
      const args = enable
        ? ['set', 'org.gnome.system.proxy', 'mode', mode]
        : ['set', 'org.gnome.system.proxy', 'mode', mode];
      execFile('gsettings', args, () => {
        if (!enable) return;
        execFile('gsettings', ['set', 'org.gnome.system.proxy.http', 'host', '127.0.0.1'], () => {});
        execFile('gsettings', ['set', 'org.gnome.system.proxy.http', 'port', String(p)], () => {});
        execFile('gsettings', ['set', 'org.gnome.system.proxy.https', 'host', '127.0.0.1'], () => {});
        execFile('gsettings', ['set', 'org.gnome.system.proxy.https', 'port', String(p)], () => {});
      });
    }
    log('info', enable ? '已设置系统代理' : '已取消系统代理');
  } catch (err) {
    log('error', `设置系统代理失败：${err.message}`);
  }
}

/* ------------------------------ 测速 ------------------------------ */

async function probe(targets) {
  const hosts = Array.isArray(targets) && targets.length
    ? targets
    : ['store.steampowered.com', 'steamcommunity.com', 'github.com', 'api.github.com', 'cdn.cloudflare.steamstatic.com'];

  const out = [];
  for (const h of hosts) {
    const r = await hostsMod.probeHost(h);
    out.push({
      host: h,
      ok: r.ok,
      ip: r.ip,
      ms: r.ms,
      grade: r.ms === null ? 'fail' : r.ms < 60 ? 'excellent' : r.ms < 150 ? 'good' : r.ms < 300 ? 'fair' : 'poor'
    });
  }
  return out;
}

module.exports = {
  attach,
  start,
  stop,
  status,
  isRunning: () => state.running,
  rules,
  saveRules,
  rebuildRules,
  probe,
  bestIp,
  setSystemProxy,
  pacScript
};
