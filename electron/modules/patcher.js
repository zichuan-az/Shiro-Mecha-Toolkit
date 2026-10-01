'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

/**
 * 便携启动配置管理
 *
 * ⚠️ 重要说明（也会原样显示给用户）：
 *   本程序**不包含、不下载、不分发**任何破解补丁或游戏本体文件。
 *   这里做的事情只有一件：把你**自己电脑上已有的**启动文件/配置登记下来，
 *   需要的时候一键复制到指定目录，并自动备份被覆盖的文件。
 *   请确认你使用的文件来自你本人合法拥有的副本，并遵守当地法律与游戏许可协议。
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
  file = path.join(base, 'launchers.json');
  return file;
}

function read() {
  try {
    return JSON.parse(fs.readFileSync(storeFile(), 'utf8'));
  } catch (_) {
    return [];
  }
}

function write(list) {
  fs.writeFileSync(storeFile(), JSON.stringify(list, null, 2), 'utf8');
}

function list() {
  return { entries: read() };
}

function scan() {
  const cfg = require('./config');
  const candidates = [];
  const dirs = new Set();

  const inspect = (dir, label) => {
    if (!dir || !fs.existsSync(dir)) return;
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_) {
      return;
    }
    const files = entries
      .filter((e) => e.isFile() && /\.(exe|sh|app|bat|cmd|so|dll|dylib|ini|cfg|json|txt|zip|7z|rar)$/i.test(e.name))
      .map((e) => {
        const full = path.join(dir, e.name);
        let size = 0;
        let mtime = 0;
        try {
          const st = fs.statSync(full);
          size = st.size;
          mtime = st.mtimeMs;
        } catch (_) {
          /* noop */
        }
        return { name: e.name, path: full, size, mtime };
      })
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, 60);
    if (files.length) candidates.push({ dir, label, files });
  };

  inspect(cfg.get('patcher.sourceDir', ''), '你设置的来源目录');
  inspect(path.join(os.homedir(), 'Downloads'), '下载文件夹');
  inspect(path.join(os.homedir(), 'Desktop'), '桌面');
  inspect(path.join(os.homedir(), 'Documents'), '文档');

  return { candidates, scannedAt: Date.now() };
}

function add(entry) {
  const list_ = read();
  const item = {
    id: entry.id || crypto.randomUUID(),
    name: String(entry.name || '').trim() || '未命名配置',
    gameName: String(entry.gameName || '').trim(),
    sourcePath: String(entry.sourcePath || '').trim(),
    targetDir: String(entry.targetDir || '').trim(),
    args: String(entry.args || '').trim(),
    note: String(entry.note || '').slice(0, 300),
    createdAt: entry.createdAt || Date.now()
  };
  if (!item.sourcePath) throw new Error('请选择你自己的启动文件路径');

  const idx = list_.findIndex((e) => e.id === item.id);
  if (idx >= 0) list_[idx] = item;
  else list_.push(item);
  write(list_);
  return { entries: read() };
}

function remove(id) {
  write(read().filter((e) => e.id !== id));
  return { entries: read() };
}

function uniquePath(dir, filename) {
  let target = path.join(dir, filename);
  if (!fs.existsSync(target)) return target;
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  let i = 1;
  while (i < 500) {
    target = path.join(dir, `${base}.shiro-backup${i}${ext}`);
    if (!fs.existsSync(target)) return target;
    i++;
  }
  return path.join(dir, `${base}.shiro-backup-${Date.now()}${ext}`);
}

function deploy(id, gameDir) {
  const entry = read().find((e) => e.id === id);
  if (!entry) throw new Error('没有找到这条配置');
  if (!entry.sourcePath || !fs.existsSync(entry.sourcePath)) throw new Error('来源文件不存在，请重新选择');

  const target = String(gameDir || entry.targetDir || '').trim();
  if (!target) throw new Error('请先选择要部署到的目录');
  if (!fs.existsSync(target)) throw new Error(`目标目录不存在：${target}`);

  const st = fs.statSync(entry.sourcePath);
  const actions = [];

  if (st.isDirectory()) {
    const names = fs.readdirSync(entry.sourcePath);
    for (const name of names) {
      const from = path.join(entry.sourcePath, name);
      const to = path.join(target, name);
      if (fs.existsSync(to)) {
        const backup = uniquePath(target, name);
        fs.copyFileSync(to, backup);
        actions.push(`备份原文件 → ${path.basename(backup)}`);
      }
      fs.cpSync(from, to, { recursive: true });
      actions.push(`写入 ${name}`);
    }
  } else {
    const name = path.basename(entry.sourcePath);
    const to = path.join(target, name);
    if (fs.existsSync(to)) {
      const backup = uniquePath(target, name);
      fs.copyFileSync(to, backup);
      actions.push(`备份原文件 → ${path.basename(backup)}`);
    }
    fs.copyFileSync(entry.sourcePath, to);
    actions.push(`写入 ${name}`);
  }

  return { ok: true, target, actions };
}

function guide() {
  return {
    disclaimer:
      '本程序不包含、不下载、不分发任何破解补丁或游戏本体。下面的配置管理功能只针对你本机已有的文件。' +
      '请确认文件来源合法（你本人购买或获得的副本），并遵守当地法律与游戏许可协议。',
    steps: [
      {
        title: '1. 确认你拥有这份游戏',
        detail: '请先在你的 Steam 账号里确认这个游戏已经在库中。这样你才拥有它的使用授权。'
      },
      {
        title: '2. 准备好你自己的启动文件',
        detail: '如果你手上有自制的启动脚本，或者从你自己的备份里拿到的文件，把它们放到一个好找的目录（例如下载文件夹）。'
      },
      {
        title: '3. 在这里登记一条配置',
        detail: '在「来源路径」里选中你的文件或文件夹，填上游戏名字，保存。程序会记住它，不会上传任何东西。'
      },
      {
        title: '4. 一键部署到游戏目录',
        detail: '点部署，选游戏安装目录。原文件会自动改名备份（.shiro-backupN），随时可以自己改回来。'
      },
      {
        title: '5. 按游戏支持的方式启动',
        detail: '部署完成后，请按游戏与发行平台支持的方式启动；本工具不会绕过 Steam、DRM 或联网验证。'
      }
    ],
    notes: [
      '本程序不会修改系统 hosts 之外的任何系统文件。',
      '所有备份都保留在原目录，文件名带 .shiro-backup，你可以自己删除或恢复。',
      '如果某个游戏需要联网验证或平台客户端，请按官方要求启动；本工具不提供绕过验证的功能。'
    ]
  };
}

module.exports = { list, scan, add, remove, deploy, guide, storeFile };
