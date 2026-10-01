'use strict';

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const https = require('node:https');
const crypto = require('node:crypto');
const { URL } = require('node:url');

const cfg = require('./config');

/**
 * 多线程下载器
 *
 * 特性：
 *   · 支持 HTTP Range 时自动分段并发下载，段数可调；
 *   · 断点续传（暂停后从已完成字节继续，不重新下）；
 *   · 实时速度 / 进度 / 剩余时间统计；
 *   · 支持限速。
 * 全程只连接你自己填写的下载地址，不经过任何中转服务器。
 */

const tasks = new Map();
let broadcast = () => {};
let ticker = null;

function attach(fn) {
  broadcast = typeof fn === 'function' ? fn : () => {};
  if (!ticker) {
    ticker = setInterval(() => {
      const snapshot = list();
      if (snapshot.length) broadcast('dl:progress', snapshot);
    }, 700);
    if (ticker.unref) ticker.unref();
  }
}

function publicTask(t) {
  const now = Date.now();
  const elapsed = (now - (t.startedAt || now)) / 1000;
  const speed = elapsed > 0 ? (t.received - (t.baseReceived || 0)) / elapsed : 0;
  const remain = t.total > 0 && speed > 0 ? (t.total - t.received) / speed : 0;
  return {
    id: t.id,
    url: t.url,
    name: t.name,
    saveDir: t.saveDir,
    filePath: t.filePath,
    total: t.total,
    received: t.received,
    percent: t.total > 0 ? Math.min(100, (t.received / t.total) * 100) : 0,
    speed,
    eta: remain,
    status: t.status,
    threads: t.threads,
    error: t.error || null,
    createdAt: t.createdAt,
    finishedAt: t.finishedAt || null
  };
}

function list() {
  return [...tasks.values()].map(publicTask).sort((a, b) => b.createdAt - a.createdAt);
}

function head(url, timeout = 12000) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const mod = u.protocol === 'http:' ? http : https;
    const req = mod.request(
      {
        method: 'HEAD',
        host: u.hostname,
        port: u.port || (u.protocol === 'http:' ? 80 : 443),
        path: u.pathname + u.search,
        timeout,
        headers: { 'User-Agent': 'ShiroMechaToolkit/1.0', Accept: '*/*' }
      },
      (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          res.resume();
          return resolve(head(new URL(res.headers.location, url).toString(), timeout));
        }
        res.resume();
        resolve({
          status: res.statusCode,
          length: Number(res.headers['content-length'] || 0),
          ranges: String(res.headers['accept-ranges'] || '').includes('bytes'),
          filename: filenameFrom(res.headers['content-disposition'], u.pathname),
          contentType: res.headers['content-type'] || ''
        });
      }
    );
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('探测文件信息超时'));
    });
    req.on('error', (e) => reject(new Error(`无法连接下载地址：${e.message}`)));
    req.end();
  });
}

function filenameFrom(disposition, pathname) {
  if (disposition) {
    const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
    if (m) return decodeURIComponent(m[1]);
  }
  const base = path.basename(decodeURIComponent(pathname || ''));
  return base || `download-${Date.now()}`;
}

function guessNameFromUrl(url) {
  try {
    return decodeURIComponent(path.basename(new URL(url).pathname)) || 'download';
  } catch (_) {
    return 'download';
  }
}

function safeFileName(name) {
  const normalized = String(name || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim();
  if (!normalized || normalized === '.' || normalized === '..') return `download-${Date.now()}`;
  return normalized.slice(0, 180);
}

/* ------------------------------ 分段下载 ------------------------------ */

function downloadSegment(task, seg, index) {
  return new Promise((resolve, reject) => {
    const u = new URL(task.url);
    const mod = u.protocol === 'http:' ? http : https;
    const start = seg.start + seg.received;
    if (start > seg.end) return resolve();

    const req = mod.request(
      {
        host: u.hostname,
        port: u.port || (u.protocol === 'http:' ? 80 : 443),
        path: u.pathname + u.search,
        method: 'GET',
        headers: {
          'User-Agent': 'ShiroMechaToolkit/1.0',
          Accept: '*/*',
          Range: `bytes=${start}-${seg.end}`
        }
      },
      (res) => {
        if (res.statusCode >= 400) {
          res.resume();
          return reject(new Error(`服务器返回 ${res.statusCode}`));
        }
        const stream = fs.createWriteStream(seg.file, { flags: 'a' });

        const cleanup = () => {
          try {
            stream.close();
          } catch (_) {
            /* noop */
          }
        };

        res.on('data', (chunk) => {
          if (task.status === 'paused' || task.cancelled) {
            res.destroy();
            cleanup();
            return resolve();
          }
          seg.received += chunk.length;
          task.received += chunk.length;

          const ok = stream.write(chunk);
          if (!ok) res.pause();
          seg.index = index;

          if (task.speedLimitKB > 0) {
            const expected = (task.received / (1024 * task.speedLimitKB)) * 1000;
            const actual = Date.now() - (task.startedAt || Date.now());
            if (expected > actual) {
              res.pause();
              setTimeout(() => {
                if (task.status === 'running') res.resume();
              }, Math.min(500, expected - actual));
            }
          }
        });
        res.on('end', () => {
          cleanup();
          resolve();
        });
        res.on('error', (e) => {
          cleanup();
          reject(e);
        });
        stream.on('drain', () => res.resume());
      }
    );

    req.on('error', reject);
    req.end();
  });
}

async function runTask(task) {
  task.status = 'running';
  task.startedAt = Date.now();
  task.baseReceived = task.received - task.baseReceived > 0 ? task.received : 0;

  try {
    if (task.segments.length === 1 && task.segments[0].end === 0) {
      // 不支持分段：整文件流式下载
      task.segments = [{ start: 0, end: Math.max(0, task.total - 1), received: 0, file: task.filePath + '.shiro-part0' }];
      if (task.total === 0) {
        task.segments = [{ start: 0, end: 0, received: 0, file: task.filePath + '.shiro-part0', unbounded: true }];
        await downloadUnbounded(task);
      } else {
        await downloadSegment(task, task.segments[0], 0);
      }
    } else {
      await Promise.all(task.segments.map((s, i) => downloadSegment(task, s, i)));
    }

    if (task.cancelled) return;
    if (task.status === 'paused') return;

    // 合并分片
    if (task.segments.length > 1) {
      task.status = 'merging';
      const out = fs.createWriteStream(task.filePath);
      for (const s of task.segments) {
        await new Promise((resolve, reject) => {
          const rs = fs.createReadStream(s.file);
          rs.on('data', (c) => out.write(c));
          rs.on('end', resolve);
          rs.on('error', reject);
        });
      }
      await new Promise((r) => out.end(r));
      for (const s of task.segments) {
        try {
          fs.unlinkSync(s.file);
        } catch (_) {
          /* noop */
        }
      }
    } else if (task.segments[0] && task.segments[0].file !== task.filePath) {
      try {
        fs.renameSync(task.segments[0].file, task.filePath);
      } catch (_) {
        /* 同目录重命名，正常不该失败 */
      }
    }

    task.status = 'done';
    task.finishedAt = Date.now();
    if (task.total === 0) task.total = task.received;
  } catch (err) {
    task.status = 'error';
    task.error = err.message;
  }
  broadcast('dl:progress', list());
}

function downloadUnbounded(task) {
  return new Promise((resolve, reject) => {
    const u = new URL(task.url);
    const mod = u.protocol === 'http:' ? http : https;
    const seg = task.segments[0];
    const stream = fs.createWriteStream(seg.file);

    const req = mod.get(
      {
        host: u.hostname,
        port: u.port || (u.protocol === 'http:' ? 80 : 443),
        path: u.pathname + u.search,
        headers: { 'User-Agent': 'ShiroMechaToolkit/1.0', Accept: '*/*' }
      },
      (res) => {
        if (res.statusCode >= 400) {
          res.resume();
          return reject(new Error(`服务器返回 ${res.statusCode}`));
        }
        res.on('data', (chunk) => {
          if (task.status === 'paused' || task.cancelled) {
            res.destroy();
            stream.close();
            return resolve();
          }
          seg.received += chunk.length;
          task.received += chunk.length;
          const ok = stream.write(chunk);
          if (!ok) res.pause();
        });
        stream.on('drain', () => res.resume());
        res.on('end', () => {
          stream.end();
          resolve();
        });
        res.on('error', reject);
      }
    );
    req.on('error', reject);
  });
}

async function start(input) {
  const url = String((input && input.url) || '').trim();
  if (!/^https?:\/\//i.test(url)) throw new Error('请填写以 http:// 或 https:// 开头的下载地址');
  const parsed = new URL(url);
  if (!parsed.hostname) throw new Error('下载地址缺少主机名');

  const saveDir = input.saveDir || cfg.get('download.saveDir') || path.join(require('node:os').homedir(), 'Downloads');
  fs.mkdirSync(saveDir, { recursive: true });

  const id = crypto.randomUUID();
  const info = await head(url).catch(() => ({ length: 0, ranges: false, filename: guessNameFromUrl(url) }));
  const name = safeFileName(input.name || info.filename || guessNameFromUrl(url));
  const filePath = path.join(saveDir, name);

  const threads = Math.max(1, Math.min(Number(input.threads || cfg.get('download.concurrency', 4)) || 4, 16));
  let segments = [];

  if (info.ranges && info.length > 4 * 1024 * 1024 && threads > 1) {
    const chunk = Math.ceil(info.length / threads);
    for (let i = 0; i < threads; i++) {
      const s = i * chunk;
      const e = Math.min(info.length - 1, s + chunk - 1);
      if (s > e) break;
      segments.push({ start: s, end: e, received: 0, file: `${filePath}.shiro-part${i}` });
    }
  } else {
    segments = [{ start: 0, end: Math.max(0, info.length - 1), received: 0, file: `${filePath}.shiro-part0` }];
  }

  const task = {
    id,
    url,
    name,
    saveDir,
    filePath,
    total: info.length || 0,
    received: 0,
    baseReceived: 0,
    threads: segments.length,
    segments,
    status: 'queued',
    speedLimitKB: Number(input.speedLimitKB || cfg.get('download.speedLimitKB', 0)) || 0,
    createdAt: Date.now(),
    cancelled: false
  };

  tasks.set(id, task);
  runTask(task);
  return publicTask(task);
}

function pause(id) {
  const t = tasks.get(id);
  if (!t || t.status === 'done') return list();
  t.status = 'paused';
  return list();
}

async function resume(id) {
  const t = tasks.get(id);
  if (!t || t.status === 'done' || t.status === 'running') return list();
  t.status = 'queued';
  runTask(t);
  return list();
}

function cancel(id) {
  const t = tasks.get(id);
  if (!t) return list();
  t.cancelled = true;
  t.status = 'cancelled';
  for (const s of t.segments) {
    try {
      fs.existsSync(s.file) && fs.unlinkSync(s.file);
    } catch (_) {
      /* noop */
    }
  }
  tasks.delete(id);
  return list();
}

function stopAll() {
  for (const t of tasks.values()) {
    t.cancelled = true;
    t.status = 'paused';
  }
  if (ticker) clearInterval(ticker);
  ticker = null;
}

module.exports = { attach, start, pause, resume, cancel, list, stopAll, head };
