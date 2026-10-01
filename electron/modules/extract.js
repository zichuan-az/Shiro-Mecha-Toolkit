'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');

/**
 * 解压
 *
 * · .zip —— 内置解压（纯 JS，无外部程序）
 * · .7z / .rar / .tar.* —— 交给系统上已安装的解压程序（7-Zip / WinRAR / 系统自带 tar）
 *   本程序不内置、不分发任何第三方解压软件。
 */

const KINDS = {
  '.zip': 'zip',
  '.7z': '7z',
  '.rar': 'rar',
  '.tar': 'tar',
  '.gz': 'gzip',
  '.tgz': 'gzip',
  '.xz': 'xz',
  '.bz2': 'bzip2'
};

function detect(filePath) {
  const lower = String(filePath || '').toLowerCase();
  const ext = path.extname(lower);
  return KINDS[ext] || 'unknown';
}

function uniqueDir(base) {
  if (!fs.existsSync(base)) return base;
  let i = 1;
  while (i < 500) {
    const next = `${base} (${i})`;
    if (!fs.existsSync(next)) return next;
    i++;
  }
  return `${base}-${Date.now()}`;
}

/** 解压 zip：优先用 adm-zip（纯 JS），不可用时退回系统 unzip / tar */
async function extractZip(filePath, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });

  let AdmZip;
  try {
    AdmZip = require('adm-zip');
  } catch (_) {
    AdmZip = null;
  }

  if (AdmZip) {
    const zip = new AdmZip(filePath);
    const entries = zip.getEntries();
    zip.extractAllTo(targetDir, true);
    return { engine: 'builtin', files: entries.length, targetDir };
  }

  // 退化路径：调用系统上的解压命令
  const tool = process.platform === 'win32' ? 'tar.exe' : 'unzip';
  const args = process.platform === 'win32' ? ['-xf', filePath, '-C', targetDir] : ['-o', filePath, '-d', targetDir];

  return new Promise((resolve, reject) => {
    execFile(tool, args, { maxBuffer: 4 * 1024 * 1024 }, (err) => {
      if (err) {
        reject(new Error(`系统未找到可用的解压程序，请先安装 7-Zip 后重试（错误：${err.message}）`));
        return;
      }
      resolve({ engine: tool, files: null, targetDir });
    });
  });
}

/** 非 zip：交给用户机器上的解压软件 */
function extractWithSystem(filePath, targetDir) {
  const candidates =
    process.platform === 'win32'
      ? [
          { cmd: '7z.exe', args: ['x', filePath, `-o${targetDir}`, '-y'] },
          { cmd: 'C:/Program Files/7-Zip/7z.exe', args: ['x', filePath, `-o${targetDir}`, '-y'] },
          { cmd: 'C:/Program Files/WinRAR/WinRAR.exe', args: ['x', '-ibck', '-y', filePath, targetDir + path.sep] }
        ]
      : [{ cmd: '7z', args: ['x', filePath, `-o${targetDir}`, '-y'] }, { cmd: 'unar', args: ['-o', targetDir, filePath] }];

  fs.mkdirSync(targetDir, { recursive: true });

  return new Promise((resolve, reject) => {
    let index = 0;
    const attempt = () => {
      if (index >= candidates.length) {
        reject(
          new Error(
            '没找到可用的解压程序。请先安装 7-Zip（免费开源）后重试，或直接用系统自带的解压功能打开这个文件。'
          )
        );
        return;
      }
      const c = candidates[index++];
      execFile(c.cmd, c.args, { maxBuffer: 4 * 1024 * 1024 }, (err) => {
        if (err) attempt();
        else resolve({ engine: c.cmd, files: null, targetDir });
      });
    };
    attempt();
  });
}

async function extract(filePath, targetDir) {
  if (!filePath || !fs.existsSync(filePath)) throw new Error('找不到要解压的文件');
  const st = fs.statSync(filePath);
  if (!st.isFile()) throw new Error('只能对文件解压');

  const kind = detect(filePath);
  const target = targetDir || uniqueDir(filePath.replace(/\.[^.]+$/, ''));
  if (fs.existsSync(target) && !targetDir) {
    return extract(filePath, target);
  }
  fs.mkdirSync(target, { recursive: true });

  if (kind === 'zip') return extractZip(filePath, target);
  if (kind === 'unknown') throw new Error('无法识别的压缩格式，请用系统自带的解压程序打开');
  return extractWithSystem(filePath, target);
}

function listArchive(filePath) {
  const kind = detect(filePath);
  let entries = [];
  if (kind === 'zip') {
    try {
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(filePath);
      entries = zip.getEntries().slice(0, 200).map((e) => ({ name: e.entryName, size: e.header.size, dir: e.isDirectory }));
    } catch (_) {
      entries = [];
    }
  }
  return { kind, entries, canExtract: kind !== 'unknown' };
}

module.exports = { extract, listArchive, detect, KINDS };
