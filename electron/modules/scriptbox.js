'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

/**
 * 脚本工坊
 *
 * 用来放一些你自己写的小脚本（比如批量测速、批量拼 hosts 规则）。
 * 脚本在一个**受限沙箱**里运行：没有文件系统、没有网络、没有进程权限，
 * 只能调用下面这几个受控接口，并且有 5 秒执行上限。
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
  file = path.join(base, 'scripts.json');
  return file;
}

const SAMPLES = [
  {
    id: 'sample-ping',
    name: '批量测速（示例）',
    description: '对你填写的域名逐个测速，按延迟从低到高排序输出',
    code: [
      '// 沙箱内置：shi.mecha.probeHost(host) -> { host, ok, ip, ms }',
      'const targets = ["store.steampowered.com", "steamcommunity.com", "github.com"];',
      'const rows = [];',
      'for (const host of targets) {',
      '  rows.push(await shi.mecha.probeHost(host));',
      '}',
      'rows.sort((a, b) => (a.ms === null ? 1e9 : a.ms) - (b.ms === null ? 1e9 : b.ms));',
      'console.log(rows.map(r => `${r.host}  ${r.ms === null ? "失败" : r.ms + " ms"}  ${r.ip || ""}`).join("\\n"));',
      'return rows;'
    ].join('\n'),
    builtin: true,
    createdAt: 0
  },
  {
    id: 'sample-hosts',
    name: '生成 hosts 片段（示例）',
    description: '把一份「域名 → IP」表渲染成可以直接用的 hosts 文本',
    code: [
      'const table = {',
      '  "store.steampowered.com": "23.1.1.1",',
      '  "github.com": "140.82.112.4"',
      '};',
      'const text = Object.entries(table).map(([h, ip]) => ip + "\\t" + h).join("\\n");',
      'console.log(text);',
      'return text;'
    ].join('\n'),
    builtin: true,
    createdAt: 0
  }
];

function read() {
  try {
    const disk = JSON.parse(fs.readFileSync(storeFile(), 'utf8'));
    return [...disk];
  } catch (_) {
    return [];
  }
}

function write(list) {
  fs.writeFileSync(storeFile(), JSON.stringify(list, null, 2), 'utf8');
}

function list() {
  return { scripts: [...SAMPLES, ...read()] };
}

function save(item) {
  const list_ = read();
  const entry = {
    id: item.id && !String(item.id).startsWith('sample-') ? item.id : crypto.randomUUID(),
    name: String(item.name || '').trim() || '未命名脚本',
    description: String(item.description || '').slice(0, 200),
    code: String(item.code || ''),
    createdAt: item.createdAt || Date.now(),
    updatedAt: Date.now()
  };
  const idx = list_.findIndex((e) => e.id === entry.id);
  if (idx >= 0) list_[idx] = entry;
  else list_.push(entry);
  write(list_);
  return list();
}

function remove(id) {
  write(read().filter((e) => e.id !== id));
  return list();
}

/**
 * 在受限沙箱里执行脚本。
 * 暴露的能力刻意做得很少：只能测速、拼字符串、打日志。
 */
async function run(id, payload) {
  const all = [...SAMPLES, ...read()];
  const script = all.find((s) => s.id === id);
  if (!script) throw new Error('没有找到这个脚本');

  const lines = [];
  const con = {
    log: (...args) => lines.push(args.map(stringify).join(' ')),
    warn: (...args) => lines.push('[warn] ' + args.map(stringify).join(' ')),
    error: (...args) => lines.push('[error] ' + args.map(stringify).join(' ')),
    table: (obj) => lines.push(JSON.stringify(obj, null, 2))
  };

  const hostsMod = require('./hosts');

  const sandbox = {
    console: con,
    input: payload === undefined ? null : payload,
    shi: {
      mecha: {
        probeHost: async (host) => {
          const r = await hostsMod.probeHost(String(host));
          return { host: r.host, ok: r.ok, ip: r.ip, ms: r.ms };
        },
        resolveDomain: async (name) => hostsMod.resolveDomain(String(name))
      },
      util: {
        sortBy: (arr, key, desc) =>
          [...arr].sort((a, b) => {
            const x = a[key];
            const y = b[key];
            if (x === y) return 0;
            return (x > y ? 1 : -1) * (desc ? -1 : 1);
          }),
        formatBytes: (n) => {
          const units = ['B', 'KB', 'MB', 'GB', 'TB'];
          let i = 0;
          let v = Number(n) || 0;
          while (v >= 1024 && i < units.length - 1) {
            v /= 1024;
            i++;
          }
          return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
        }
      }
    },
    JSON,
    Math,
    Date,
    String,
    Number,
    Boolean,
    Array,
    Object,
    RegExp,
    Error,
    Promise,
    setTimeout: undefined,
    fetch: undefined,
    require: undefined,
    process: undefined,
    Buffer: undefined
  };

  const context = vm.createContext(sandbox);
  const wrapped = `(async () => {\n${script.code}\n})()`;

  const started = Date.now();
  let result = null;
  let error = null;

  try {
    const promise = vm.runInContext(wrapped, context, { timeout: 5000, displayErrors: true });
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('脚本执行超过 5 秒，已中断')), 5500)
    );
    result = await Promise.race([promise, timeout]);
  } catch (err) {
    error = String(err && err.message ? err.message : err);
  }

  return {
    id,
    name: script.name,
    output: lines,
    result: result === undefined ? null : safeJson(result),
    error,
    durationMs: Date.now() - started,
    startedAt: started
  };
}

function stringify(v) {
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v);
  } catch (_) {
    return String(v);
  }
}

function safeJson(v) {
  try {
    return JSON.parse(JSON.stringify(v));
  } catch (_) {
    return String(v);
  }
}

module.exports = { list, save, remove, run, SAMPLES };
