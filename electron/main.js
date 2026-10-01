/**
 * Shiro Mecha Toolkit — 白机甲工坊
 * Electron 主进程入口
 *
 * Author: 岚川怀瑾 (LanChuanHuaJin)
 * License: MIT
 */

'use strict';

const { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage, dialog, clipboard } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const cfg = require('./modules/config');
const hosts = require('./modules/hosts');
const accelerator = require('./modules/accelerator');
const steam = require('./modules/steam');
const steamid = require('./modules/steamid');
const guard = require('./modules/guard');
const accounts = require('./modules/accounts');
const downloader = require('./modules/downloader');
const library = require('./modules/library');
const cleaner = require('./modules/cleaner');
const patcher = require('./modules/patcher');
const scriptbox = require('./modules/scriptbox');
const extract = require('./modules/extract');
const sysinfo = require('./modules/sysinfo');
const vault = require('./modules/vault');
const bypass = require('./modules/bypass');
const depot = require('./modules/depot');
const linkbay = require('./modules/linkbay');
const APP_META = require('./modules/meta');

const isDev = !!process.env.SHIRO_DEV;
let mainWindow = null;
let tray = null;
let quitting = false;

/* ------------------------------------------------------------------ */
/* 单实例                                                              */
/* ------------------------------------------------------------------ */
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

/* ------------------------------------------------------------------ */
/* 窗口                                                                */
/* ------------------------------------------------------------------ */
function createWindow() {
  const saved = cfg.get('window') || {};

  mainWindow = new BrowserWindow({
    width: saved.width || 1360,
    height: saved.height || 860,
    minWidth: 960,
    minHeight: 640,
    x: saved.x,
    y: saved.y,
    show: false,
    backgroundColor: '#eef3fb',
    title: 'Shiro Mecha Toolkit',
    autoHideMenuBar: true,
    // macOS 用系统交通灯内嵌，Windows / Linux 使用应用自绘标题栏
    frame: process.platform === 'darwin',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: process.platform === 'darwin' ? { x: 14, y: 16 } : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => mainWindow.show());

  const persistBounds = () => {
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isMinimized()) return;
    const b = mainWindow.getBounds();
    cfg.set('window', b);
  };
  mainWindow.on('resize', persistBounds);
  mainWindow.on('move', persistBounds);

  // 外链一律走系统浏览器，不在应用内开新窗口
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (cfg.get('behavior.closeToTray') && process.platform !== 'darwin') {
    mainWindow.on('close', (e) => {
      if (quitting) return;
      e.preventDefault();
      mainWindow.hide();
      if (cfg.get('behavior.notifyOnTray')) {
        notify('白机甲工坊仍在后台', '加速服务与下载任务会继续运行。');
      }
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/* ------------------------------------------------------------------ */
/* 托盘                                                                */
/* ------------------------------------------------------------------ */
function buildTray() {
  const iconPath = path.join(__dirname, '..', 'build', 'tray.png');
  let img = nativeImage.createFromPath(iconPath);
  if (img.isEmpty()) img = nativeImage.createEmpty();

  tray = new Tray(img);
  tray.setToolTip('Shiro Mecha Toolkit — 白机甲工坊');
  refreshTrayMenu();

  tray.on('click', () => {
    if (!mainWindow) return createWindow();
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });
}

function refreshTrayMenu() {
  if (!tray) return;
  const on = accelerator.isRunning();
  const menu = Menu.buildFromTemplate([
    { label: '白机甲工坊  v' + APP_META.version, enabled: false },
    { type: 'separator' },
    {
      label: on ? '● 加速服务：运行中' : '○ 加速服务：已停止',
      enabled: false
    },
    {
      label: on ? '停止加速服务' : '启动加速服务',
      click: async () => {
        try {
          on ? accelerator.stop() : await accelerator.start();
        } catch (err) {
          notify('操作失败', String(err && err.message ? err.message : err));
        }
        refreshTrayMenu();
        broadcast('accel:changed', accelerator.status());
      }
    },
    { type: 'separator' },
    { label: '打开主界面', click: () => (mainWindow ? (mainWindow.show(), mainWindow.focus()) : createWindow()) },
    {
      label: '退出',
      click: () => {
        quitting = true;
        accelerator.stop();
        downloader.stopAll();
        app.quit();
      }
    }
  ]);
  tray.setContextMenu(menu);
}

function notify(title, body) {
  try {
    const { Notification } = require('electron');
    if (Notification.isSupported()) new Notification({ title, body, silent: false }).show();
  } catch (_) {
    /* 忽略 */
  }
}

function broadcast(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

/* ------------------------------------------------------------------ */
/* IPC 注册                                                            */
/* ------------------------------------------------------------------ */
function ok(data) {
  return { ok: true, data };
}
function wrap(fn) {
  return async (_event, ...args) => {
    try {
      return ok(await fn(...args));
    } catch (err) {
      return { ok: false, error: String((err && err.message) || err) };
    }
  };
}

function registerIpc() {
  /* --- 应用元信息 --- */
  ipcMain.handle('app:meta', wrap(async () => ({
    ...APP_META,
    platform: process.platform,
    arch: process.arch,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    userData: app.getPath('userData'),
    admin: sysinfo.isElevated()
  })));

  ipcMain.handle('app:openExternal', wrap(async (url) => {
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) throw new Error('仅允许打开 http/https 链接');
    await shell.openExternal(url);
    return true;
  }));

  ipcMain.handle('app:copy', wrap(async (text) => {
    clipboard.writeText(String(text || ''));
    return true;
  }));

  /* --- 配置 --- */
  ipcMain.handle('config:all', wrap(async () => cfg.all()));
  ipcMain.handle('config:set', wrap(async (key, value) => {
    cfg.set(key, value);
    if (key === 'behavior.closeToTray' || key === 'behavior.notifyOnTray') refreshTrayMenu();
    return cfg.all();
  }));
  ipcMain.handle('config:reset', wrap(async () => cfg.reset()));

  /* --- hosts --- */
  ipcMain.handle('hosts:read', wrap(async () => hosts.read()));
  ipcMain.handle('hosts:preview', wrap(async (groupIds) => hosts.preview(groupIds)));
  ipcMain.handle('hosts:apply', wrap(async (groupIds) => hosts.apply(groupIds)));
  ipcMain.handle('hosts:restore', wrap(async (backupId) => hosts.restore(backupId)));
  ipcMain.handle('hosts:backups', wrap(async () => hosts.listBackups()));
  ipcMain.handle('hosts:groups', wrap(async () => hosts.groups()));

  /* --- 加速器 --- */
  ipcMain.handle('accel:status', wrap(async () => accelerator.status()));
  ipcMain.handle('accel:start', wrap(async (groupIds) => {
    const s = await accelerator.start(groupIds);
    refreshTrayMenu();
    return s;
  }));
  ipcMain.handle('accel:stop', wrap(async () => {
    const s = accelerator.stop();
    refreshTrayMenu();
    return s;
  }));
  ipcMain.handle('accel:probe', wrap(async (targets) => accelerator.probe(targets)));
  ipcMain.handle('accel:rules', wrap(async () => accelerator.rules()));
  ipcMain.handle('accel:saveRules', wrap(async (rules) => accelerator.saveRules(rules)));

  /* --- Steam --- */
  ipcMain.handle('steam:appDetails', wrap(async (appid, lang) => steam.appDetails(appid, lang)));
  ipcMain.handle('steam:search', wrap(async (term, lang) => steam.search(term, lang)));
  ipcMain.handle('steam:featured', wrap(async (lang) => steam.featured(lang)));
  ipcMain.handle('steam:freePromotions', wrap(async (cc, lang) => steam.freePromotions(cc, lang)));
  ipcMain.handle('steam:specials', wrap(async (cc, lang) => steam.specials(cc, lang)));
  ipcMain.handle('steam:playerSummary', wrap(async (steamId, apiKey) => steam.playerSummary(steamId, apiKey)));
  ipcMain.handle('steam:ownedGames', wrap(async (steamId, apiKey) => steam.ownedGames(steamId, apiKey)));
  ipcMain.handle('steam:achievements', wrap(async (steamId, appid, apiKey) => steam.achievements(steamId, appid, apiKey)));

  /* --- SteamID --- */
  ipcMain.handle('steamid:parse', wrap(async (input) => steamid.parse(input)));
  ipcMain.handle('steamid:resolveVanity', wrap(async (vanity, apiKey) => steamid.resolveVanity(vanity, apiKey)));

  /* --- Steam Guard 令牌 --- */
  ipcMain.handle('guard:code', wrap(async (sharedSecret, offset) => guard.code(sharedSecret, offset)));
  ipcMain.handle('guard:validate', wrap(async (sharedSecret) => guard.validateSecret(sharedSecret)));

  /* --- 账号一键切换 --- */
  ipcMain.handle('acc:list', wrap(async () => accounts.list()));
  ipcMain.handle('acc:save', wrap(async (account) => accounts.save(account)));
  ipcMain.handle('acc:remove', wrap(async (id) => accounts.remove(id)));
  ipcMain.handle('acc:switch', wrap(async (id) => accounts.switchTo(id)));

  /* --- 游戏库 / 官方或自有文件下载 --- */
  ipcMain.handle('lib:manifest', wrap(async () => library.manifest()));
  ipcMain.handle('lib:detail', wrap(async (appid, lang) => library.detail(appid, lang)));
  ipcMain.handle('lib:add', wrap(async (appid, options) => library.add(appid, options)));
  ipcMain.handle('lib:list', wrap(async () => library.list()));
  ipcMain.handle('lib:remove', wrap(async (id) => library.remove(id)));
  ipcMain.handle('lib:pickDir', wrap(async () => {
    const r = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory', 'createDirectory'] });
    return r.canceled ? null : r.filePaths[0];
  }));
  ipcMain.handle('lib:openFolder', wrap(async (p) => {
    await shell.openPath(p);
    return true;
  }));

  /* --- 下载管理 --- */
  ipcMain.handle('dl:start', wrap(async (task) => downloader.start(task)));
  ipcMain.handle('dl:pause', wrap(async (id) => downloader.pause(id)));
  ipcMain.handle('dl:resume', wrap(async (id) => downloader.resume(id)));
  ipcMain.handle('dl:cancel', wrap(async (id) => downloader.cancel(id)));
  ipcMain.handle('dl:list', wrap(async () => downloader.list()));
  ipcMain.handle('dl:extract', wrap(async (filePath, targetDir) => extract.extract(filePath, targetDir)));
  ipcMain.handle('dl:archiveInfo', wrap(async (filePath) => extract.listArchive(filePath)));
  ipcMain.handle('dl:pickFile', wrap(async () => {
    const r = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'] });
    return r.canceled ? null : r.filePaths[0];
  }));

  /* --- 清理 --- */
  ipcMain.handle('clean:scan', wrap(async () => cleaner.scan()));
  ipcMain.handle('clean:run', wrap(async (ids) => cleaner.run(ids)));

  /* --- 便携启动配置（仅管理用户已有文件，不绕过 Steam/DRM） --- */
  ipcMain.handle('patch:scan', wrap(async () => patcher.scan()));
  ipcMain.handle('patch:list', wrap(async () => patcher.list()));
  ipcMain.handle('patch:add', wrap(async (entry) => patcher.add(entry)));
  ipcMain.handle('patch:remove', wrap(async (id) => patcher.remove(id)));
  ipcMain.handle('patch:guide', wrap(async () => patcher.guide()));
  ipcMain.handle('patch:deploy', wrap(async (id, gameDir) => patcher.deploy(id, gameDir)));

  /* --- 入库工坊（Steam 库文件登记 + depot 清单缓存） --- */
  ipcMain.handle('vault:guard', wrap(async () => vault.guard()));
  ipcMain.handle('vault:libraries', wrap(async () => vault.libraries()));
  ipcMain.handle('vault:appInfo', wrap(async (appid, lang) => vault.appInfo(appid, lang)));
  ipcMain.handle('vault:install', wrap(async (input) => vault.install(input)));
  ipcMain.handle('vault:remove', wrap(async (id, options) => vault.remove(id, options)));
  ipcMain.handle('vault:list', wrap(async () => vault.list()));
  ipcMain.handle('vault:killSteam', wrap(async () => vault.killSteam()));
  ipcMain.handle('vault:backups', wrap(async () => vault.backupList()));
  ipcMain.handle('vault:restoreBackup', wrap(async (slot) => vault.restoreBackups(slot)));
  ipcMain.handle('vault:depotCache', wrap(async (library) => vault.depotCache(library)));
  ipcMain.handle('vault:importManifests', wrap(async (paths, library) => vault.importManifests(paths, library)));
  ipcMain.handle('vault:exportManifests', wrap(async (library, targetDir) => vault.exportManifests(library, targetDir)));
  ipcMain.handle('vault:pickFiles', wrap(async () => {
    const r = await dialog.showOpenDialog(mainWindow, { properties: ['openFile', 'multiSelections'], filters: [{ name: 'depot 清单', extensions: ['manifest'] }] });
    return r.canceled ? [] : r.filePaths;
  }));
  ipcMain.handle('vault:selftest', wrap(async () => vault.selftest()));

  /* --- 直链仓（站源目录 + 直链提取 + 排队下载） --- */
  ipcMain.handle('linkbay:all', wrap(async () => linkbay.payload()));
  ipcMain.handle('linkbay:addLink', wrap(async (target, link) => linkbay.addLink(target, link)));
  ipcMain.handle('linkbay:removeLink', wrap(async (target, index) => linkbay.removeLink(target, index)));
  ipcMain.handle('linkbay:addSite', wrap(async (site) => linkbay.addSite(site)));
  ipcMain.handle('linkbay:removeSite', wrap(async (id) => linkbay.removeSite(id)));
  ipcMain.handle('linkbay:extract', wrap(async (input) => linkbay.extract(input)));
  ipcMain.handle('linkbay:mirrors', wrap(async () => linkbay.probeMirrors()));
  ipcMain.handle('linkbay:mirrorize', wrap(async (url, id) => linkbay.mirrorize(url, id)));
  ipcMain.handle('linkbay:queue', wrap(async (input) => linkbay.queue(input)));
  ipcMain.handle('linkbay:patchFetch', wrap(async (input) => linkbay.patchFetch(input)));
  ipcMain.handle('linkbay:check', wrap(async (input) => linkbay.check(input)));
  ipcMain.handle('linkbay:pickDir', wrap(async () => {
    const r = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory', 'createDirectory'] });
    return r.canceled ? null : r.filePaths[0];
  }));

  /* --- 补丁中心（联机补丁 / 免 Steam / 联网验证屏蔽） --- */
  ipcMain.handle('bypass:guide', wrap(async () => bypass.guide()));
  ipcMain.handle('bypass:profiles', wrap(async () => bypass.profiles()));
  ipcMain.handle('bypass:saveProfile', wrap(async (p) => bypass.saveProfile(p)));
  ipcMain.handle('bypass:removeProfile', wrap(async (id) => bypass.removeProfile(id)));
  ipcMain.handle('bypass:analyze', wrap(async (dir) => bypass.analyze(dir)));
  ipcMain.handle('bypass:plan', wrap(async (profile) => bypass.settingsPlan(profile)));
  ipcMain.handle('bypass:deploy', wrap(async (id, dir) => bypass.deploy(id, dir)));
  ipcMain.handle('bypass:restore', wrap(async (id) => bypass.restore(id)));
  ipcMain.handle('bypass:restoreLatest', wrap(async () => bypass.restoreLatest()));
  ipcMain.handle('bypass:points', wrap(async () => bypass.points()));
  ipcMain.handle('bypass:removePoint', wrap(async (id) => bypass.removePoint(id)));
  ipcMain.handle('bypass:hosts', wrap(async () => bypass.hostsState()));
  ipcMain.handle('bypass:hostsWrite', wrap(async (domains) => bypass.writeHostsBlock(domains)));
  ipcMain.handle('bypass:firewallList', wrap(async () => bypass.firewallList()));
  ipcMain.handle('bypass:firewallAdd', wrap(async (exe) => bypass.firewallAdd(exe)));
  ipcMain.handle('bypass:firewallRemove', wrap(async (exe) => bypass.firewallRemove(exe)));

  /* --- 资源库（直链源 / depot 拉取 / 离线版） --- */
  ipcMain.handle('depot:sources', wrap(async () => depot.sources()));
  ipcMain.handle('depot:addSource', wrap(async (item) => depot.addSource(item)));
  ipcMain.handle('depot:updateSource', wrap(async (id, patch) => depot.updateSource(id, patch)));
  ipcMain.handle('depot:removeSource', wrap(async (id) => depot.removeSource(id)));
  ipcMain.handle('depot:importIndex', wrap(async (file, options) => depot.importIndex(file, options)));
  ipcMain.handle('depot:exportIndex', wrap(async (file) => depot.exportIndex(file)));
  ipcMain.handle('depot:queue', wrap(async (ids, options) => depot.queueMany(ids, options)));
  ipcMain.handle('depot:steamcmdState', wrap(async () => depot.steamcmdState()));
  ipcMain.handle('depot:installSteamcmd', wrap(async () => depot.installSteamcmd()));
  ipcMain.handle('depot:pull', wrap(async (input) => depot.depotPull(input)));
  ipcMain.handle('depot:jobs', wrap(async () => depot.depotJobs()));
  ipcMain.handle('depot:cancel', wrap(async (id) => depot.depotCancel(id)));
  ipcMain.handle('depot:clear', wrap(async (id) => depot.depotClear(id)));
  ipcMain.handle('depot:apply', wrap(async (jobId, dir, options) => depot.depotApply(jobId, dir, options)));
  ipcMain.handle('depot:offlinePrep', wrap(async (input) => depot.offlinePrep(input)));

  /* --- 脚本工坊 --- */
  ipcMain.handle('script:list', wrap(async () => scriptbox.list()));
  ipcMain.handle('script:save', wrap(async (item) => scriptbox.save(item)));
  ipcMain.handle('script:remove', wrap(async (id) => scriptbox.remove(id)));
  ipcMain.handle('script:run', wrap(async (id, payload) => scriptbox.run(id, payload)));

  /* --- 系统信息 --- */
  ipcMain.handle('sys:info', wrap(async () => sysinfo.snapshot()));
  ipcMain.handle('sys:pickFile', wrap(async (filters) => {
    const r = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'], filters: filters || [] });
    return r.canceled ? null : r.filePaths[0];
  }));
  ipcMain.handle('sys:openPath', wrap(async (p) => {
    const err = await shell.openPath(p);
    if (err) throw new Error(err);
    return true;
  }));

  /* --- 窗口控制 --- */
  ipcMain.handle('win:minimize', wrap(async () => (mainWindow.minimize(), true)));
  ipcMain.handle('win:hide', wrap(async () => (mainWindow.hide(), true)));
  ipcMain.handle('win:maximize', wrap(async () => {
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
    return mainWindow.isMaximized();
  }));
  ipcMain.handle('win:mini', wrap(async (mini) => {
    if (!mainWindow) return false;
    mainWindow.setAlwaysOnTop(!!mini, 'normal');
    mainWindow.setSize(mini ? 420 : (cfg.get('window')?.width || 1360), mini ? 300 : (cfg.get('window')?.height || 860));
    broadcast('win:mini', !!mini);
    return !!mini;
  }));
  ipcMain.handle('win:close', wrap(async () => (mainWindow.close(), true)));
}

/* ------------------------------------------------------------------ */
/* 生命周期                                                            */
/* ------------------------------------------------------------------ */
app.whenReady().then(() => {
  registerIpc();
  createWindow();

  try {
    buildTray();
  } catch (_) {
    /* 托盘不可用时不阻塞启动 */
  }

  downloader.attach(broadcast);
  accelerator.attach(broadcast);
  depot.attach(broadcast);

  // 记住上次的加速状态
  if (cfg.get('accelerator.autoStart') || cfg.get('accelerator.lastRunning')) {
    accelerator.start().then(() => {
      refreshTrayMenu();
      broadcast('accel:changed', accelerator.status());
    }).catch(() => { /* 权限不足时静默失败 */ });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else if (mainWindow) mainWindow.show();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !cfg.get('behavior.closeToTray')) {
    quitting = true;
    accelerator.stop();
    downloader.stopAll();
    app.quit();
  }
});

app.on('before-quit', () => {
  quitting = true;
  try {
    accelerator.stop();
    downloader.stopAll();
    hosts.flushOnExit();
  } catch (_) {
    /* 忽略 */
  }
});

process.on('uncaughtException', (err) => {
  // 桌面应用不应因单个异常整体崩溃
  console.error('[shiro] uncaught:', err);
});
process.on('unhandledRejection', (err) => {
  console.error('[shiro] unhandled rejection:', err);
});
