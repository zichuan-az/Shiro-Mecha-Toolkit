'use strict';

/**
 * 站源目录 —— 离线版 / 直链源 / 补丁源 清单
 *
 * ============================ 直 链 填 这 里 ============================
 * 下面的 SITES[].links 和 PATCHES[].links 两个数组就是留给你的位置。
 * 想给某个站挂直链，照这个格式写：
 *
 *   links: [
 *     { label: '黑神话 悟空 免安装版', url: 'https://你的直链/xxx.rar', size: 0, note: '解压密码 xxx' }
 *   ]
 *
 * links 是空数组时界面显示「未配置」，不会报错、不会联网猜地址。
 * 界面上的「直链仓」页签里也能直接填，填完会写回本地配置，不一定非得改这个文件。
 * =======================================================================
 */

const RISK = {
  low: 'low',
  mid: 'mid',
  high: 'high'
};

/** 站点类型：repack 重打包 / direct 直链站 / torrent 种子站 / fix 补丁站 / index 索引 */
const SITES = [
  {
    id: 'steamrip',
    name: 'SteamRIP',
    url: 'https://steamrip.com/',
    region: 'global',
    kind: 'direct',
    direct: true,
    risk: RISK.high,
    speed: 'fast',
    note: '预装版直出，页面上就是压好的直链，境外盘为主，挂梯子速度最稳。',
    noteEn: 'Pre-installed releases with direct links; mostly overseas hosts, fastest behind a VPN.',
    links: []
  },
  {
    id: 'fitgirl',
    name: 'FitGirl Repacks',
    url: 'https://fitgirl-repacks.site/',
    region: 'global',
    kind: 'repack',
    direct: false,
    risk: RISK.mid,
    speed: 'slow',
    note: '高压重打包，体积最小但安装很慢。链接走 filehoster 中转，不是纯直链。',
    noteEn: 'High-compression repacks - smallest size, slow install; links go through file hosters.',
    links: []
  },
  {
    id: 'dodi',
    name: 'DODI Repacks',
    url: 'https://dodi-repacks.site/',
    region: 'global',
    kind: 'repack',
    direct: false,
    risk: RISK.mid,
    speed: 'slow',
    note: '和 FitGirl 类似的压缩包流派，分流盘比较多。',
    noteEn: 'Same repack family as FitGirl, plenty of mirrors.',
    links: []
  },
  {
    id: 'gload',
    name: 'GLoad',
    url: 'https://gload.to/',
    region: 'global',
    kind: 'direct',
    direct: true,
    risk: RISK.high,
    speed: 'fast',
    note: '原 gload.cc，搬到了 gload.to。链接大多是 1fichier / ddownload 这类瞬传盘。',
    noteEn: 'Formerly gload.cc, now gload.to. Mostly 1fichier / ddownload links.',
    links: []
  },
  {
    id: 'steamunlocked',
    name: 'SteamUnlocked',
    url: 'https://steamunlocked.org/',
    region: 'global',
    kind: 'direct',
    direct: true,
    risk: RISK.high,
    speed: 'mid',
    note: '老牌免安装直链站，速度快但资源更新较慢，广告多。',
    noteEn: 'Long-running pre-installed direct-link site; quick but slow updates, heavy ads.',
    links: []
  },
  {
    id: 'ovagames',
    name: 'OVA Games',
    url: 'https://www.ovagames.com/',
    region: 'global',
    kind: 'repack',
    direct: false,
    risk: RISK.mid,
    speed: 'slow',
    note: '老站，多为分卷压缩 + 网盘，评论区常有直链补充。',
    noteEn: 'Veteran site, split archives + file hosts; direct links often appear in comments.',
    links: []
  },
  {
    id: 'freetp',
    name: 'FreeTP',
    url: 'https://freetp.org/',
    region: 'ru',
    kind: 'direct',
    direct: true,
    risk: RISK.high,
    speed: 'fast',
    note: '俄站，主打联机版（带 Online-Fix），页面里直接给 Yandex / Mail.ru 盘直链。',
    noteEn: 'Russian site focused on online-capable builds; direct Yandex / Mail.ru links on page.',
    links: []
  },
  {
    id: 'byrutgame',
    name: 'ByRutGame',
    url: 'https://byrutgame.org/',
    region: 'ru',
    kind: 'torrent',
    direct: false,
    risk: RISK.mid,
    speed: 'mid',
    note: '原 byrut.org。俄式重打包，主要走种子，做种的人多所以速度还行。',
    noteEn: 'Formerly byrut.org. Russian repacks, mostly torrents with healthy seeds.',
    links: []
  },
  {
    id: 'rutracker',
    name: 'RuTracker',
    url: 'https://rutracker.org/forum/index.php',
    region: 'ru',
    kind: 'torrent',
    direct: false,
    risk: RISK.mid,
    speed: 'fast',
    note: '俄最大资源论坛。本体是种子，但很多帖子里挂着网盘直链。需要注册账号。',
    noteEn: 'Russia\u2019s biggest tracker. Torrent-first, but threads often carry direct host links. Account needed.',
    links: []
  },
  {
    id: 'csrinru',
    name: 'CS.RIN.RU',
    url: 'https://cs.rin.ru/forum/',
    region: 'ru',
    kind: 'fix',
    direct: false,
    risk: RISK.mid,
    speed: 'mid',
    note: '逆向圈的核心论坛，联机补丁 / 免 Steam / DLC 解锁的一手源头都在这。Cloudflare 挡得比较凶。',
    noteEn: 'The core reverse-engineering forum - origin of most fixes and online patches. Heavy Cloudflare.',
    links: []
  },
  {
    id: 'onlinefix',
    name: 'Online-Fix',
    url: 'https://online-fix.me/',
    region: 'ru',
    kind: 'fix',
    direct: true,
    risk: RISK.high,
    speed: 'fast',
    note: '联机补丁的主力站，按游戏发 fix，页面里有 Yandex 盘直链。403 通常是 Cloudflare，挂梯子换节点就好。',
    noteEn: 'Main online-fix site, per-game fixes with direct Yandex links. 403 usually means Cloudflare - switch VPN node.',
    links: []
  },
  {
    id: 'xatab',
    name: 'Xatab',
    url: 'https://xatab-repack.com/',
    region: 'ru',
    kind: 'repack',
    direct: false,
    risk: RISK.mid,
    speed: 'mid',
    note: '俄式重打包老牌，种子 + 网盘并行。',
    noteEn: 'Veteran Russian repacker, torrent and file-host mirrors.',
    links: []
  },
  {
    id: 'dodi',
    name: 'DODI (Mirror)',
    url: 'https://dodi-repacks.download/',
    region: 'global',
    kind: 'repack',
    direct: false,
    risk: RISK.mid,
    speed: 'slow',
    note: 'DODI 的备用域名，主域打不开时用这个。',
    noteEn: 'DODI backup domain for when the main one is down.',
    links: []
  },
  {
    id: 'kaoskrew',
    name: 'KaOsKrew',
    url: 'https://kaoskrew.org/',
    region: 'global',
    kind: 'repack',
    direct: false,
    risk: RISK.mid,
    speed: 'mid',
    note: '小体量重打包，走种子和 1fichier。',
    noteEn: 'Smaller repack group, torrents plus 1fichier.',
    links: []
  },
  {
    id: 'goggames',
    name: 'GOG Games',
    url: 'https://gog-games.to/',
    region: 'global',
    kind: 'direct',
    direct: true,
    risk: RISK.high,
    speed: 'fast',
    note: 'GOG 版免 DRM 游戏，直链干净、不需要补丁。',
    noteEn: 'DRM-free GOG releases with clean direct links, no patching needed.',
    links: []
  },
  {
    id: 'torrentgalaxy',
    name: 'TorrentGalaxy',
    url: 'https://torrentgalaxy.to/',
    region: 'global',
    kind: 'torrent',
    direct: false,
    risk: RISK.mid,
    speed: 'mid',
    note: '综合种子站，游戏分区资源新。',
    noteEn: 'General tracker with a well-updated games section.',
    links: []
  },
  {
    id: '1337x',
    name: '1337x',
    url: 'https://1337x.to/',
    region: 'global',
    kind: 'torrent',
    direct: false,
    risk: RISK.mid,
    speed: 'mid',
    note: '综合种子站，搜「游戏名 + repack」命中率高。',
    noteEn: 'General tracker; searching "<game> repack" works well.',
    links: []
  },
  {
    id: 'dlpsgame',
    name: 'DLPS Game',
    url: 'https://dlpsgame.com/',
    region: 'global',
    kind: 'direct',
    direct: true,
    risk: RISK.high,
    speed: 'mid',
    note: '主机移植 + PC 免安装，Google Drive 直链为主。',
    noteEn: 'Console ports and PC pre-installed builds, mostly Google Drive links.',
    links: []
  },
  {
    id: 'apunkagames',
    name: 'Apunkagames',
    url: 'https://www.apunkagames.com/',
    region: 'global',
    kind: 'direct',
    direct: true,
    risk: RISK.high,
    speed: 'mid',
    note: '老站，分卷压缩 + 多网盘，东南亚用户多。',
    noteEn: 'Veteran site, split archives plus multiple file hosts.',
    links: []
  },
  {
    id: 'igg',
    name: 'IGGGAMES',
    url: 'https://igg-games.com/',
    region: 'global',
    kind: 'direct',
    direct: true,
    risk: RISK.high,
    speed: 'mid',
    note: '更新快，直链多为自建盘；广告和跳转特别多，注意别点错。',
    noteEn: 'Fast updates with self-hosted links; very heavy on ads and redirects.',
    links: []
  }
];

/** 补丁源 —— 联机补丁 / 免 Steam 补丁 的官方上游 */
const PATCHES = [
  {
    id: 'gbe_fork',
    kind: 'coop',
    name: 'Goldberg Emu (gbe_fork)',
    url: 'https://github.com/Detanup01/gbe_fork',
    region: 'global',
    license: 'GPL-3.0',
    note: '开源的 Steam 模拟层 + 联机实现，联机补丁就是它。Release 里下 steam_api64.dll 那套。',
    noteEn: 'Open-source Steam emulator with networking - this is what online fixes are built on.',
    links: []
  },
  {
    id: 'goldberg_emu',
    kind: 'coop',
    name: 'Goldberg SteamEmu',
    url: 'https://gitlab.com/Mr_Goldberg/goldberg_emulator',
    region: 'global',
    license: 'GPL-3.0',
    note: 'gbe_fork 的上游，更新少一些但历史版本全。',
    noteEn: 'Upstream of gbe_fork; fewer updates but the full archive.',
    links: []
  },
  {
    id: 'steamless',
    kind: 'drm',
    name: 'Steamless',
    url: 'https://github.com/atom0s/Steamless',
    region: 'global',
    license: 'CC BY-NC-ND 4.0',
    note: '剥 SteamStub 壳，给「DRM 绕过」档用，纯静态处理，不改运行行为。',
    noteEn: 'Unpacks SteamStub; used by the DRM removal profile.',
    links: []
  },
  {
    id: 'creamapi',
    kind: 'drm',
    name: 'CreamAPI',
    url: 'https://cs.rin.ru/forum/viewtopic.php?t=70515',
    region: 'ru',
    license: 'closed',
    note: '解锁已购买本体的 DLC，配置就是 cream_api.ini。',
    noteEn: 'Unlocks DLC for games you own; configured through cream_api.ini.',
    links: []
  },
  {
    id: 'smartsteamemu',
    kind: 'nosteam',
    name: 'SmartSteamEmu',
    url: 'https://cs.rin.ru/forum/viewtopic.php?t=62935',
    region: 'ru',
    license: 'closed',
    note: '免 Steam 直启的老方案，配置文件 SmartSteamEmu.ini + steam_appid.txt。',
    noteEn: 'Classic Steam-less launcher using SmartSteamEmu.ini plus steam_appid.txt.',
    links: []
  },
  {
    id: 'onlinefix_dl',
    kind: 'coop',
    name: 'Online-Fix 下载页',
    url: 'https://online-fix.me/',
    region: 'ru',
    license: 'closed',
    note: '按游戏名搜，页面里 Yandex 盘直链。这就是你要的「联机补丁直链」最稳的来源。',
    noteEn: 'Search by game name; direct Yandex links on the page.',
    links: []
  },
  {
    id: 'crowdin_goldberg',
    kind: 'nosteam',
    name: 'steam_api64.dll 直链位',
    url: '',
    region: 'custom',
    license: 'custom',
    note: '留给你自己填 dll 的直链。填了之后「免 Steam 补丁」按钮会多一个直接下载。',
    noteEn: 'Reserved for your own dll direct link.',
    links: []
  }
];

/**
 * 免费加速线路 —— 只收实测能通的。
 * prefix 型：把原始 URL 直接接在后面就能下（GitHub raw / release 用）。
 * 首次打开「直链仓」会自己测一遍延迟，谁最快谁排前面。
 */
const MIRRORS = [
  { id: 'ghproxy', name: 'gh-proxy.com', prefix: 'https://gh-proxy.com/', tag: 'github', note: 'release / raw 通吃', noteEn: 'Handles releases and raw' },
  { id: 'llkk', name: 'gh.llkk.cc', prefix: 'https://gh.llkk.cc/', tag: 'github', note: '延迟低', noteEn: 'Low latency' },
  { id: 'ghproxynet', name: 'ghproxy.net', prefix: 'https://ghproxy.net/', tag: 'github', note: '老牌，偶尔限速', noteEn: 'Veteran, occasionally throttled' },
  { id: 'ghfast', name: 'ghfast.top', prefix: 'https://ghfast.top/', tag: 'github', note: '备用', noteEn: 'Backup' },
  { id: 'moeyy', name: 'github.moeyy.xyz', prefix: 'https://github.moeyy.xyz/', tag: 'github', note: '不稳定，能用时很快', noteEn: 'Unstable but fast when up' },
  { id: 'gitmirror', name: 'hub.gitmirror.com', prefix: 'https://hub.gitmirror.com/', tag: 'github', note: 'raw 专用', noteEn: 'raw only' }
];

/** Steam 侧：官方 CDN 列表，配合加速中心的优选 IP 用 */
const STEAM_CDN = [
  { id: 'steamcdn', name: 'Steam CDN (Akamai)', host: 'steamcdn-a.akamaihd.net' },
  { id: 'akamai', name: 'Steam 内容 CDN', host: 'cdn.akamai.steamstatic.com' },
  { id: 'steamcontent', name: 'Steam 内容直连', host: 'steamcontent.com' },
  { id: 'steampipe', name: 'SteamPipe (内容)', host: 'steampipe.steamcontent.com' },
  { id: 'steamstore', name: 'Steam 商店', host: 'store.steampowered.com' },
  { id: 'steamapi', name: 'Steam API', host: 'api.steampowered.com' }
];

module.exports = { SITES, PATCHES, MIRRORS, STEAM_CDN, RISK };
