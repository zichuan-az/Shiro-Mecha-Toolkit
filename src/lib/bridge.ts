/**
 * 渲染层 ↔ 主进程 的桥
 *
 * · 在 Electron 里走 preload 暴露的 window.shiro
 * · 在纯浏览器里（开发预览）自动降级成一套演示数据，方便调界面
 */

export type Result<T> = { ok: true; data: T } | { ok: false; error: string }

/** preload 通过 contextBridge 挂上来的对象；结构由主进程保证，这里只做存在性判断 */
declare global {
  interface Window {
    shiro?: unknown
  }
}

const native: unknown = typeof window !== 'undefined' ? window.shiro : undefined

export const hasNative = native !== undefined && native !== null

/** 统一解包：失败时抛错，交给调用方 try/catch */
async function unwrap<T>(p: Promise<Result<T>>): Promise<T> {
  const r = (await p) as Result<T> | undefined
  if (!r || r.ok !== true) {
    throw new Error((r && 'error' in r && r.error) || '操作失败')
  }
  return r.data
}

/* ==========================================================================
   演示数据（仅浏览器预览时使用）
   ========================================================================== */

const DEMO: any = {
  version: '1.2.0',
  name: 'Shiro Mecha Toolkit',
  nameZh: '白机甲工坊',
  author: '岚川怀瑾',
  license: 'MIT',
  repository: 'https://github.com/Jingluohi/Shiro-Mecha-Toolkit',
  platform: 'win32',
  arch: 'x64',
  electron: '31.7.7',
  chrome: '126',
  node: '20.18',
  userData: '%APPDATA%/ShiroMechaToolkit',
  admin: false,
  donate: { afdian: 'https://afdian.com/', kofi: 'https://ko-fi.com/', github: 'https://github.com/sponsors/' }
}

const DEMO_GROUPS = [
  { id: 'steam', name: 'Steam 商店与社区', nameEn: 'Steam Store & Community', desc: '商店、社区、创意工坊、CDN', domains: new Array(12).fill('x') },
  { id: 'github', name: 'GitHub 代码托管', nameEn: 'GitHub', desc: '仓库、Raw、Release、头像', domains: new Array(8).fill('x') },
  { id: 'steamweb', name: 'Steam 图片与静态资源', nameEn: 'Steam Static Assets', desc: '封面、截图、成就图标加速', domains: new Array(5).fill('x') },
  { id: 'pixiv', name: 'Pixiv', nameEn: 'Pixiv', desc: '站内与图床', domains: new Array(5).fill('x') },
  { id: 'discord', name: 'Discord', nameEn: 'Discord', desc: '客户端网关与 CDN', domains: new Array(6).fill('x') },
  { id: 'epic', name: 'Epic Games', nameEn: 'Epic Games', desc: '启动器与商店', domains: new Array(6).fill('x') },
  { id: 'onestore', name: '主机与云盘', nameEn: 'Cloud & Console', desc: 'OneDrive / Twitch / EA / Ubisoft', domains: new Array(8).fill('x') },
  { id: 'dev', name: '开发者常用', nameEn: 'Developer Services', desc: 'npm / Docker / HuggingFace', domains: new Array(8).fill('x') }
]

// 演示数据跨多个页面复用；显式标注为可扩展结构，避免 mock 页面被过窄的字面量推断卡住。
const demo: any = {
  config: {
    schema: 1,
    language: 'zh',
    accelerator: { autoStart: false, lastRunning: true, lastGroups: ['steam', 'github'], listenPort: 51789, autoSetSystemProxy: false, customRules: [] },
    download: { saveDir: 'D:/Games/Downloads', concurrency: 4, segmentSize: 8, speedLimitKB: 0, autoExtract: true },
    steam: { apiKey: '', countryCode: 'CN', language: 'schinese', libraryPaths: [], steamPath: 'D:/Steam' },
    behavior: { closeToTray: true, notifyOnTray: true, autoUpdateCheck: false, compactMode: false },
    ui: { lastPage: 'dashboard', minimizeToGame: false }
  },

  accelStatus: () => ({
    running: true,
    port: 51789,
    proxyAddress: '127.0.0.1:51789',
    pacUrl: 'http://127.0.0.1:51789/proxy.pac',
    ruleCount: 38,
    startedAt: Date.now() - 1000 * 60 * 42,
    uptime: 1000 * 60 * 42,
    stats: { connections: 214, tunnelled: 168, bytesUp: 18_400_000, bytesDown: 246_000_000, errors: 3 },
    logs: [
      { t: Date.now() - 42000, level: 'info', message: '加速服务已启动，监听 127.0.0.1:51789，规则 38 条' },
      { t: Date.now() - 30000, level: 'info', message: '命中 steam：cdn.cloudflare.steamstatic.com → 23.62.18.4 (32 ms)' },
      { t: Date.now() - 12000, level: 'info', message: '命中 github：codeload.github.com → 140.82.113.9 (88 ms)' }
    ],
    systemProxy: false
  }),

  probe: [
    { host: 'store.steampowered.com', ok: true, ip: '23.62.18.4', ms: 32, grade: 'excellent' },
    { host: 'steamcommunity.com', ok: true, ip: '23.62.18.6', ms: 41, grade: 'excellent' },
    { host: 'github.com', ok: true, ip: '140.82.113.4', ms: 88, grade: 'good' },
    { host: 'api.github.com', ok: true, ip: '140.82.113.6', ms: 96, grade: 'good' },
    { host: 'cdn.cloudflare.steamstatic.com', ok: true, ip: '104.18.4.9', ms: 174, grade: 'fair' }
  ],

  sys: {
    os: { platform: 'win32', release: '10.0.22631', version: 'Windows 11 Pro', arch: 'x64', hostname: 'AKARI-PC', uptime: 86400 * 3 },
    cpu: { model: 'AMD Ryzen 7 7800X3D 8-Core Processor', cores: 16, speedMHz: 4200, load1: 0.42 },
    memory: { total: 34_359_738_368, free: 21_474_836_480, used: 12_884_901_888 },
    networks: [{ name: 'Wi-Fi', address: '192.168.1.42', mac: 'a4:5e:60:11:22:33' }],
    steam: { found: true, root: 'D:/Steam', libraryFolders: ['D:/Steam', 'E:/SteamLibrary'], accountId: [{ steamId64: '76561198000000001', accountName: 'lanchuan', personaName: '岚川怀瑾', mostRecent: true }] },
    admin: false,
    home: 'C:/Users/Akari'
  },

  games: [
    { appid: '730', name: 'Counter-Strike 2', sizeOnDisk: 32_000_000_000, lastUpdated: Date.now() - 86400000, installDir: 'D:/Steam/steamapps/common/Counter-Strike Global Offensive', installed: true, library: 'D:/Steam' },
    { appid: '1091500', name: 'Cyberpunk 2077', sizeOnDisk: 74_000_000_000, lastUpdated: Date.now() - 86400000 * 6, installDir: 'E:/SteamLibrary/steamapps/common/Cyberpunk 2077', installed: true, library: 'E:/SteamLibrary' },
    { appid: '1245620', name: 'ELDEN RING', sizeOnDisk: 49_000_000_000, lastUpdated: Date.now() - 86400000 * 12, installDir: 'D:/Steam/steamapps/common/ELDEN RING', installed: true, library: 'D:/Steam' },
    { appid: '570', name: 'Dota 2', sizeOnDisk: 41_000_000_000, lastUpdated: Date.now() - 86400000 * 3, installDir: 'D:/Steam/steamapps/common/dota 2 beta', installed: true, library: 'D:/Steam' },
    { appid: '2358720', name: 'Black Myth: Wukong', sizeOnDisk: 128_000_000_000, lastUpdated: Date.now() - 86400000 * 2, installDir: 'E:/SteamLibrary/steamapps/common/BlackMythWukong', installed: true, library: 'E:/SteamLibrary' }
  ],

  wishlist: [
    { id: 'w1', appid: '3164500', name: 'Schedule I', downloadUrl: '', autoExtract: true, note: '等正式版', addedAt: Date.now() - 86400000 * 2 },
    { id: 'w2', appid: '2868840', name: 'SUPERVIVE', downloadUrl: '', autoExtract: true, note: '', addedAt: Date.now() - 86400000 }
  ],

  downloads: [
    { id: 'd1', name: 'BlackMythWukong-Update-1.0.8.14860.rar', url: 'https://example.com/a.rar', saveDir: 'D:/Games/Downloads', filePath: 'D:/Games/Downloads/a.rar', total: 8_400_000_000, received: 5_922_000_000, percent: 70.5, speed: 12_400_000, eta: 200, status: 'running', threads: 8, createdAt: Date.now() - 400000 },
    { id: 'd2', name: 'vcredist_x64.exe', url: 'https://example.com/b.exe', saveDir: 'D:/Games/Downloads', filePath: 'D:/Games/Downloads/b.exe', total: 25_000_000, received: 25_000_000, percent: 100, speed: 0, eta: 0, status: 'done', threads: 4, createdAt: Date.now() - 900000, finishedAt: Date.now() - 800000 }
  ],

  clean: {
    items: [
      { id: 'steam-depotcache', name: 'Steam 下载缓存清单', path: 'D:/Steam/appcache/depotcache', size: 1_240_000_000, files: 412, risk: 'safe', desc: '已经下完的游戏清单缓存。删掉后 Steam 会重新下载清单，不影响已装好的游戏。' },
      { id: 'steam-httpcache', name: 'Steam 内置浏览器缓存', path: 'D:/Steam/appcache/httpcache', size: 684_000_000, files: 2841, risk: 'safe', desc: '商店页面、社区页面的网页缓存。删除后首次打开会慢一点，无其它影响。' },
      { id: 'steam-logs', name: 'Steam 日志', path: 'D:/Steam/logs', size: 24_600_000, files: 36, risk: 'safe', desc: '客户端运行日志，排障时才需要。可以放心删。' },
      { id: 'steam-dumps', name: 'Steam 崩溃转储', path: 'D:/Steam/dumps', size: 512_000_000, files: 4, risk: 'safe', desc: '客户端崩溃时留下的内存转储文件，单个可能几百 MB，删掉不影响使用。' },
      { id: 'steam-shadercache', name: '着色器预编译缓存', path: 'D:/Steam/steamapps/shadercache', size: 2_100_000_000, files: 1893, risk: 'medium', desc: '某些支持预编译的游戏的着色器缓存。删掉后首次进游戏会重新编译。' },
      { id: 'system-temp', name: '用户临时文件夹', path: 'C:/Users/Akari/AppData/Local/Temp', size: 3_800_000_000, files: 9204, risk: 'medium', desc: '系统和各软件留下的临时文件。正在运行的程序占用的文件会自动跳过。' }
    ],
    totalSize: 8_364_600_000,
    scannedAt: Date.now()
  },

  scripts: [
    { id: 'sample-ping', name: '批量测速（示例）', description: '对你填写的域名逐个测速，按延迟从低到高排序输出', code: 'const targets = ["store.steampowered.com", "github.com"];\nfor (const host of targets) {\n  console.log(await shi.mecha.probeHost(host));\n}', builtin: true, createdAt: 0 },
    { id: 's1', name: '我的节点对比', description: '对比几个 CDN 节点的延迟', code: 'console.log("hello")', createdAt: Date.now() - 86400000 }
  ],

  launchers: [
    { id: 'l1', name: 'Cyberpunk 便携启动', gameName: 'Cyberpunk 2077', sourcePath: 'C:/Users/Akari/Downloads/my-launcher.exe', targetDir: 'E:/SteamLibrary/steamapps/common/Cyberpunk 2077', args: '--skip-launcher', note: '我自己做的启动脚本', createdAt: Date.now() - 86400000 * 4 }
  ],

  bypassProfiles: [
    { id: 'b1', name: '赛博朋克 · 联机', gameName: 'Cyberpunk 2077', appid: '1091500', kind: 'coop', gameDir: 'E:/SteamLibrary/steamapps/common/Cyberpunk 2077', files: ['C:/Users/Akari/Downloads/steam_api64.dll'], options: { accountName: 'ShiroPlayer', language: 'schinese', broadcast: 'SHIRO-ROOM', dlc: '1,2,3', depots: '1091501', launchArgs: '', writeHosts: true, firewall: false, exeName: '' }, note: '自己备份的 dll', createdAt: Date.now() - 86400000 * 2, updatedAt: Date.now() - 86400000 },
    { id: 'b2', name: '艾尔登法环 · 免 Steam', gameName: 'ELDEN RING', appid: '1245620', kind: 'nosteam', gameDir: 'D:/Steam/steamapps/common/ELDEN RING', files: [], options: { accountName: 'ShiroPlayer', language: 'schinese', broadcast: '', dlc: '', depots: '', launchArgs: '-offline', writeHosts: false, firewall: true, exeName: 'eldenring.exe' }, note: '', createdAt: Date.now() - 86400000 * 5, updatedAt: Date.now() - 86400000 * 5 }
  ],

  sources: [
    { id: 's1', name: '示例 · 更新包镜像', appid: '', url: 'https://example.com/patch-1.0.8.rar', kind: 'direct', version: '1.0.8', size: 8_400_000_000, note: '换成你自己的地址', tags: ['更新包'], addedAt: Date.now() - 86400000 },
    { id: 's2', name: '示例 · 离线包索引', appid: '', url: 'https://example.com/index.json', kind: 'index', version: '', size: 0, note: '一个 JSON 索引，导入后会展开成多条', tags: ['索引'], addedAt: Date.now() - 3600000 }
  ],

  depotJobs: [
    { id: 'j1', appid: '2358720', depotId: '2358721', manifestId: '4832091743201984421', targetDir: 'D:/Steam/steamapps/common/BlackMythWukong', status: 'running', progress: 0.42, downloaded: 53_900_000_000, total: 128_400_000_000, speed: 24_800_000, output: ['Loading Steam API... OK', 'Downloading depot 2358721 (42%)'], message: '下载中 42.0%', createdAt: Date.now() - 600_000, finishedAt: 0, outputDir: '' }
  ],

  sites: [
    { id: 'steamrip', name: 'SteamRIP', url: 'https://steamrip.com/', region: 'global', kind: 'direct', direct: true, risk: 'high', speed: 'fast', note: '预装版直出，页面上就是压好的直链。', noteEn: 'Pre-installed releases with direct links.', links: [], linkCount: 0 },
    { id: 'freetp', name: 'FreeTP', url: 'https://freetp.org/', region: 'ru', kind: 'direct', direct: true, risk: 'high', speed: 'fast', note: '俄站，主打联机版，带 Online-Fix。', noteEn: 'Russian site, online-capable builds with Online-Fix.', links: [], linkCount: 0 },
    { id: 'csrinru', name: 'CS.RIN.RU', url: 'https://cs.rin.ru/forum/', region: 'ru', kind: 'fix', direct: false, risk: 'mid', speed: 'mid', note: '联机补丁 / 免 Steam / DLC 解锁的一手源头。', noteEn: 'Origin of most fixes.', links: [], linkCount: 0 }
  ],

  patches: [
    { id: 'gbe_fork', kind: 'coop', name: 'Goldberg Emu (gbe_fork)', url: 'https://github.com/Detanup01/gbe_fork', region: 'global', note: '开源的 Steam 模拟层 + 联机实现。', noteEn: 'Open-source Steam emulator with networking.', links: [], ready: true },
    { id: 'crowdin_goldberg', kind: 'nosteam', name: 'steam_api64.dll 直链位', url: '', region: 'custom', note: '留给你自己填 dll 的直链。', noteEn: 'Reserved for your own dll link.', links: [], ready: false }
  ],

  mirrors: [
    { id: 'ghproxy', name: 'gh-proxy.com', prefix: 'https://gh-proxy.com/', tag: 'github', note: 'release / raw 通吃', lastMs: 402, lastOk: true },
    { id: 'llkk', name: 'gh.llkk.cc', prefix: 'https://gh.llkk.cc/', tag: 'github', note: '延迟低', lastMs: 186, lastOk: true }
  ],

  steamCdn: [
    { id: 'steamcdn', name: 'Steam CDN (Akamai)', host: 'steamcdn-a.akamaihd.net' },
    { id: 'steampipe', name: 'SteamPipe (内容)', host: 'steampipe.steamcontent.com' }
  ],

  accounts: {
    accounts: [
      { id: 'a1', accountName: 'lanchuan', personaName: '岚川怀瑾', steamId64: '76561198000000001', active: true, present: true },
      { id: 'a2', accountName: 'akari_alt', personaName: 'Akari (Alt)', steamId64: '76561198000000002', active: false, present: true }
    ],
    steamRoot: 'D:/Steam',
    found: true
  },

  hosts: {
    path: 'C:/Windows/System32/drivers/etc/hosts',
    writable: false,
    managedEntries: { 'store.steampowered.com': '23.62.18.4', 'github.com': '140.82.113.4' },
    exists: true
  },

  patchGuide: {
    disclaimer: '本程序不包含、不下载、不分发任何破解补丁或游戏本体。下面的配置管理功能只针对你本机已有的文件。请确认文件来源合法（你本人购买或获得的副本），并遵守当地法律与游戏许可协议。',
    steps: [
      { title: '1. 确认你拥有这份游戏', detail: '请先在你的 Steam 账号里确认这个游戏已经在库中。这样你才拥有它的使用授权。' },
      { title: '2. 准备好你自己的启动文件', detail: '如果你手上有自制的启动脚本，或者从你自己的备份里拿到的文件，把它们放到一个好找的目录。' },
      { title: '3. 在这里登记一条配置', detail: '在「来源路径」里选中你的文件或文件夹，填上游戏名字，保存。' },
      { title: '4. 一键部署到游戏目录', detail: '点部署，选游戏安装目录。原文件会自动改名备份（.shiro-backupN）。' },
      { title: '5. 从游戏目录启动', detail: '部署完成后，直接双击游戏目录里的可执行文件即可。' }
    ],
    notes: ['本程序不会修改系统 hosts 之外的任何系统文件。', '所有备份都保留在原目录，文件名带 .shiro-backup。']
  }

}

/* ==========================================================================
   Mock 实现
   ========================================================================== */

const delay = <T,>(v: T, ms = 90) => new Promise<Result<T>>((r) => setTimeout(() => r({ ok: true, data: v }), ms))

const mock: any = {
  app: {
    meta: () => delay(DEMO),
    openExternal: () => delay(true),
    copy: () => delay(true)
  },
  config: {
    all: () => delay(DEMO.config),
    set: (k: string, v: any) => {
      const parts = k.split('.')
      let cur: any = DEMO.config
      for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]]
      cur[parts[parts.length - 1]] = v
      return delay(DEMO.config)
    },
    reset: () => delay(DEMO.config)
  },
  hosts: {
    read: () => delay(DEMO.hosts),
    preview: () => delay({ path: DEMO.hosts.path, writable: false, entries: DEMO.hosts.managedEntries, count: 2, details: DEMO.probe }),
    apply: () => ({ ok: false, error: '演示模式：写入 hosts 需要管理员权限' }),
    restore: () => delay({ ok: true }),
    backups: () => delay([{ id: '2026-09-29T08-00-00-000Z', file: 'hosts-demo.bak', size: 824, time: Date.now() - 86400000 }]),
    groups: () => delay(DEMO_GROUPS)
  },
  accel: {
    status: () => delay(DEMO.accelStatus()),
    start: () => delay({ ...DEMO.accelStatus(), running: true }),
    stop: () => delay({ ...DEMO.accelStatus(), running: false }),
    probe: () => delay(DEMO.probe, 600),
    rules: () => delay({ groups: DEMO_GROUPS, activeGroups: DEMO.config.accelerator.lastGroups, custom: [], effectiveCount: 38 }),
    saveRules: (p: any) => delay({ groups: DEMO_GROUPS, activeGroups: p?.activeGroups || [], custom: p?.custom || [], effectiveCount: 38 })
  },
  steam: {
    appDetails: (id: any) => delay({
      appid: String(id), name: 'Cyberpunk 2077', type: 'game',
      shortDescription: '《赛博朋克 2077》是一款开放世界动作冒险 RPG。故事发生在夜之城，一座五光十色、危机四伏的大都会。',
      detailedDescription: '扮演一名野心勃勃的雇佣兵 V，追寻一种独一无二的植入体……',
      headerImage: 'https://cdn.cloudflare.steamstatic.com/steam/apps/1091500/header.jpg',
      capsuleImage: '', background: '',
      screenshots: [], movies: [], developers: ['CD PROJEKT RED'], publishers: ['CD PROJEKT RED'],
      genres: ['角色扮演', '动作'], categories: ['单人', '成就'],
      releaseDate: '2020 年 12 月 10 日', comingSoon: false,
      platforms: { windows: true, mac: false, linux: false }, metacritic: 86, recommendations: 612_000,
      dlcCount: 1, isFree: false,
      price: { currency: 'CNY', initial: 29800, final: 14900, discount: 50, formatted: '¥ 149.00' },
      requirements: null, website: '', storeUrl: `https://store.steampowered.com/app/${id}/`
    }, 400),
    search: () => delay([
      { id: 1091500, name: 'Cyberpunk 2077', tiny_image: '', price: { final: 14900, currency: 'CNY' } },
      { id: 2358720, name: 'Black Myth: Wukong', tiny_image: '', price: { final: 26800, currency: 'CNY' } }
    ]),
    featured: () => delay({}),
    freePromotions: () => delay([
      { appid: 730, name: 'Counter-Strike 2', logo: '' },
      { appid: 570, name: 'Dota 2', logo: '' }
    ]),
    specials: () => delay([
      { appid: 1091500, name: 'Cyberpunk 2077', discount: 50, final: 14900, header: '' },
      { appid: 1245620, name: 'ELDEN RING', discount: 30, final: 20860, header: '' }
    ]),
    playerSummary: () => delay({ steamId: '76561198000000001', name: '岚川怀瑾', avatar: '', profileUrl: '', state: 1, visibility: 3, created: 1300000000 }),
    ownedGames: () => delay({ count: 214, games: DEMO.games }),
    achievements: () => delay({ gameName: 'Cyberpunk 2077', total: 45, unlocked: 12, list: [] })
  },
  steamid: {
    parse: () => delay({ id64: '76561198000000001', accountId: '39734273', steam2: 'STEAM_1:1:19867136', steam3: '[U:1:39734273]', friendCode: '39734273', hex: '110000104B615001', profileUrl: 'https://steamcommunity.com/profiles/76561198000000001', source: 'steamid64' }),
    resolveVanity: () => delay({ id64: '76561198000000001' })
  },
  guard: {
    code: () => delay({ code: 'K4M9R', secondsRemaining: 21, period: 30, progress: 0.3, neighbours: [{ offset: -1, code: 'P2XQA' }, { offset: 0, code: 'K4M9R' }, { offset: 1, code: 'B7NHT' }], generatedAt: Date.now() }),
    validate: () => delay({ valid: true, length: 28, preview: 'cGFk****Zz09' })
  },
  accounts: {
    list: () => delay(DEMO.accounts),
    save: () => delay(DEMO.accounts),
    remove: () => delay(DEMO.accounts),
    switchTo: () => delay({ ok: true, steps: ['已把 lanchuan 设为默认登录账号', '请重启 Steam 客户端生效。'], account: 'lanchuan' })
  },
  library: {
    manifest: () => delay({ steam: { found: true, root: 'D:/Steam', libraryFolders: ['D:/Steam', 'E:/SteamLibrary'] }, installed: DEMO.games, totalSize: 324_000_000_000, wishlist: DEMO.wishlist }, 300),
    detail: (id: any) => mock.steam.appDetails(id),
    add: () => delay({ list: DEMO.wishlist }),
    list: () => delay({ list: DEMO.wishlist, installed: DEMO.games }),
    remove: () => delay({ list: DEMO.wishlist }),
    pickDir: () => delay('D:/Games/Downloads'),
    openFolder: () => delay(true)
  },
  downloads: {
    start: () => delay(DEMO.downloads[0]),
    pause: () => delay(DEMO.downloads),
    resume: () => delay(DEMO.downloads),
    cancel: () => delay(DEMO.downloads),
    list: () => delay(DEMO.downloads),
    pickFile: () => delay('C:/Users/Akari/Downloads/patch.zip'),
    extract: () => delay({ engine: 'builtin', files: 4218, targetDir: 'D:/Games/Downloads/BlackMythWukong' }),
    archiveInfo: () => delay({ kind: 'zip', canExtract: true, entries: [] })
  },
  cleaner: {
    scan: () => delay(DEMO.clean, 700),
    run: () => delay({ results: [{ id: 'steam-logs', name: 'Steam 日志', freed: 24_600_000, removed: 36, skipped: 0 }], freed: 24_600_000, finishedAt: Date.now() }, 900)
  },
  patches: {
    scan: () => delay({ candidates: [{ dir: 'C:/Users/Akari/Downloads', label: '下载文件夹', files: [{ name: 'my-launcher.exe', path: 'C:/Users/Akari/Downloads/my-launcher.exe', size: 2_400_000, mtime: Date.now() - 3600000 }] }] }, 500),
    list: () => delay({ entries: DEMO.launchers }),
    add: () => delay({ entries: DEMO.launchers }),
    remove: () => delay({ entries: DEMO.launchers }),
    guide: () => delay(DEMO.patchGuide),
    deploy: () => delay({ ok: true, target: 'E:/SteamLibrary/steamapps/common/Cyberpunk 2077', actions: ['备份原文件 → my-launcher.shiro-backup1.exe', '写入 my-launcher.exe'] })
  },
  vault: {
    guard: () => delay({
      steam: { found: true, root: 'D:/Steam', running: false, accountId: [{ steamId64: '76561198000000001', accountName: 'lanchuan', personaName: '岚川怀瑾', mostRecent: true }] },
      libraries: [
        { path: 'D:/Steam', steamapps: 'D:/Steam/steamapps', exists: true, writable: true },
        { path: 'E:/SteamLibrary', steamapps: 'E:/SteamLibrary/steamapps', exists: true, writable: true }
      ],
      admin: true,
      writable: true,
      hints: ['Steam 未运行，可以安全写入库文件。', '检测到本机登录过 lanchuan']
    }),
    libraries: () => delay([
      { path: 'D:/Steam', steamapps: 'D:/Steam/steamapps', apps: 128, free: 412_000_000_000 },
      { path: 'E:/SteamLibrary', steamapps: 'E:/SteamLibrary/steamapps', apps: 43, free: 1_240_000_000_000 }
    ]),
    appInfo: (appid: any) => delay({
      appid: String(appid), name: 'Black Myth: Wukong', installdir: 'BlackMythWukong',
      buildid: '15234871', source: 'appinfo',
      depots: [
        { depotId: '2358721', name: 'Black Myth: Wukong Content', gid: '4832091743201984421', size: 128_400_000_000, shared: false, dlcappid: '' },
        { depotId: '228990', name: 'Steamworks Common Redistributables', gid: '1017030123002412356', size: 700_000_000, shared: true, dlcappid: '' }
      ],
      totalSize: 129_100_000_000
    }, 500),
    list: () => delay({
      found: true, steamRoot: 'D:/Steam',
      items: [
        { id: 'v1', appid: '2358720', name: 'Black Myth: Wukong', installdir: 'BlackMythWukong', sizeOnDisk: 128_400_000_000, library: 'D:/Steam', gameDir: 'D:/Steam/steamapps/common/BlackMythWukong', acfFile: 'D:/Steam/steamapps/appmanifest_2358720.acf', acfExists: true, gameDirExists: true, depots: 2, installedAt: Date.now() - 86_400_000 },
        { id: 'v2', appid: '3164500', name: 'Schedule I', installdir: 'Schedule I', sizeOnDisk: 1_800_000_000, library: 'E:/SteamLibrary', gameDir: 'E:/SteamLibrary/steamapps/common/Schedule I', acfFile: 'E:/SteamLibrary/steamapps/appmanifest_3164500.acf', acfExists: true, gameDirExists: false, depots: 1, installedAt: Date.now() - 3_600_000 }
      ]
    }),
    install: () => delay({ record: { id: 'v3', appid: '1245620', name: 'ELDEN RING' }, actions: ['写入 appmanifest_1245620.acf', 'libraryfolders.vdf：已登记进 apps 节点', 'config.vdf：已登记 AppID', '游戏目录 → D:/Steam/steamapps/common/ELDEN RING'], backups: [] }, 700),
    remove: () => delay({ actions: ['已删除 appmanifest_1245620.acf', '已从 libraryfolders.vdf 摘除体积登记', '已从 config.vdf 移除 Installed 标记'] }),
    killSteam: () => delay({ running: false }),
    backups: () => delay([{ slot: '2358720-2026-09-30T08-00-00-000Z', dir: '%APPDATA%/ShiroMechaToolkit/vault-backups/2358720-2026-09-30T08-00-00-000Z', files: [{ name: 'config.vdf', size: 682_114, mtime: Date.now() - 86_400_000 }] }]),
    restoreBackup: () => delay({ actions: ['已恢复 config.vdf → D:/Steam/config/config.vdf'] }),
    depotCache: () => delay([
      { library: 'D:/Steam', dir: 'D:/Steam/steamapps/depotcache', exists: true, count: 3, files: [{ name: '2358721_4832091743201984421.manifest', path: 'D:/Steam/steamapps/depotcache/2358721_4832091743201984421.manifest', size: 2_140_000, mtime: Date.now() - 3_600_000 }] }
    ]),
    importManifests: () => delay({ dir: 'D:/Steam/steamapps/depotcache', actions: ['2358721_4832091743201984421.manifest → depotcache'] }, 600),
    exportManifests: () => delay({ dir: 'C:/Users/Akari/Desktop/shiro-depotcache-1', count: 3, files: ['a.manifest', 'b.manifest', 'c.manifest'] }),
    pickManifests: () => delay(['C:/Users/Akari/Downloads/2358721_4832091743201984421.manifest']),
    selftest: () =>
      delay({
        ok: true,
        passed: 18,
        failed: 0,
        results: [
          { name: 'appmanifest 生成 + 回读', ok: true, detail: '9 项全过' },
          { name: '库文件：登记进 apps', ok: true, detail: '已登记进 apps 节点' },
          { name: 'config：裸键写法不会把文件写坏', ok: true, detail: '字节 231 → 289' },
          { name: '环境：检测到 Steam', ok: true, detail: 'D:/Steam' }
        ]
      })
  },
  linkbay: {
    all: () =>
      delay({
        sites: DEMO.sites,
        patches: DEMO.patches,
        mirrors: DEMO.mirrors,
        steamCdn: DEMO.steamCdn,
        history: [],
        customSites: [],
        store: '%APPDATA%/ShiroMechaToolkit/linkbay.json'
      }, 300),
    addLink: () => delay({ sites: DEMO.sites, patches: DEMO.patches, mirrors: DEMO.mirrors, history: [], customSites: [] }),
    removeLink: () => delay({ sites: DEMO.sites, patches: DEMO.patches, mirrors: DEMO.mirrors, history: [], customSites: [] }),
    addSite: () => delay({ sites: DEMO.sites, patches: DEMO.patches, mirrors: DEMO.mirrors, history: [], customSites: [] }),
    removeSite: () => delay({ sites: DEMO.sites, patches: DEMO.patches, mirrors: DEMO.mirrors, history: [], customSites: [] }),
    extract: () =>
      delay({
        source: 'https://steamrip.com/example/',
        status: 200,
        total: 6,
        fromJson: 0,
        items: [
          { url: 'https://pixeldrain.com/u/AbCdEf', kind: 'host', host: 'pixeldrain.com' },
          { url: 'https://1fichier.com/?abcdef', kind: 'host', host: '1fichier.com' },
          { url: 'https://example.com/game.part1.rar', kind: 'file', host: 'example.com' }
        ],
        hosts: [
          { host: 'pixeldrain.com', count: 2 },
          { host: '1fichier.com', count: 2 },
          { host: 'example.com', count: 2 }
        ]
      }, 900),
    mirrors: () =>
      delay({
        ranked: [
          { id: 'llkk', name: 'gh.llkk.cc', ok: true, status: 200, ms: 186 },
          { id: 'ghproxy', name: 'gh-proxy.com', ok: true, status: 200, ms: 402 },
          { id: 'ghproxynet', name: 'ghproxy.net', ok: true, status: 200, ms: 688 }
        ],
        failed: [],
        checkedAt: Date.now()
      }, 1400),
    mirrorize: () => delay('https://gh-proxy.com/https://github.com/x/y/releases/download/v1/a.zip'),
    queue: () => delay({ task: DEMO.downloads[0], url: 'https://example.com/a.rar', byMirror: null }, 400),
    patchFetch: () => delay({ task: DEMO.downloads[0], url: 'https://example.com/fix.rar', unpacked: null, deployHint: 'coop' }, 700),
    check: () => delay({ url: 'https://example.com/a.rar', reachable: true, length: 8_400_000_000, ranges: true, filename: 'a.rar', multiThread: true }, 500),
    pickDir: () => delay('D:/Downloads')
  },
  bypass: {
    guide: () => delay({
      kind: [
        { id: 'coop', name: '联机补丁', hint: '生成 steam_settings 一整套（账号名 / 广播名 / DLC / depot）' },
        { id: 'nosteam', name: '免 Steam 补丁', hint: '写 steam_appid.txt + 启动参数，脱离客户端直启' },
        { id: 'drm', name: 'DRM / 联网验证绕过', hint: '部署文件 + hosts 屏蔽 + 出站防火墙规则' },
        { id: 'file', name: '纯文件部署', hint: '只做文件复制和备份' }
      ],
      steps: [
        { title: '1. 选游戏目录', detail: '体检后能看到 steam_api 文件、主程序和已有补丁痕迹。' },
        { title: '2. 建一条档案', detail: '选类型、填 AppID、勾上你自己的补丁文件。' },
        { title: '3. 一键部署', detail: '原文件自动备份，配置写进 steam_settings，同时留还原点。' },
        { title: '4. 一键还原', detail: '删干净新建文件、换回备份、撤掉防火墙规则。' }
      ],
      notes: ['程序不内置任何补丁文件。', 'hosts 和防火墙需要管理员权限。']
    }),
    profiles: () => delay({ profiles: DEMO.bypassProfiles }),
    saveProfile: () => delay({ profiles: DEMO.bypassProfiles, profile: DEMO.bypassProfiles[0] }),
    removeProfile: () => delay({ profiles: [] }),
    analyze: () => delay({
      dir: 'E:/SteamLibrary/steamapps/common/Cyberpunk 2077',
      apiFiles: [{ name: 'steam_api64.dll', path: 'E:/SteamLibrary/steamapps/common/Cyberpunk 2077/bin/x64/steam_api64.dll', size: 268_000 }],
      exes: [{ name: 'Cyberpunk2077.exe', path: 'E:/SteamLibrary/steamapps/common/Cyberpunk 2077/bin/x64/Cyberpunk2077.exe', size: 74_000_000 }],
      exe: { name: 'Cyberpunk2077.exe', path: 'E:/SteamLibrary/steamapps/common/Cyberpunk 2077/bin/x64/Cyberpunk2077.exe', size: 74_000_000 },
      extras: [],
      backups: [],
      markers: [],
      patched: false,
      writable: true,
      admin: true
    }, 600),
    plan: () => delay([
      { rel: 'steam_appid.txt', content: '1091500\n', label: '游戏根目录的 steam_appid.txt' },
      { rel: 'steam_settings/account_name.txt', content: 'ShiroPlayer\n', label: '仿真账号名' },
      { rel: 'steam_settings/custom_broadcasts.txt', content: 'SHIRO-ROOM\n', label: '自定义广播名' }
    ]),
    deploy: () => delay({ pointId: 'p1', gameDir: 'E:/SteamLibrary/steamapps/common/Cyberpunk 2077', actions: ['备份 steam_api64.dll → steam_api64.shiro-backup.dll', '写入 steam_api64.dll', '新建 steam_settings/account_name.txt', 'hosts 已屏蔽 7 条校验域名'], plan: [] }, 900),
    restore: () => delay({ pointId: 'p1', log: ['删除 steam_settings', '还原 steam_api64.dll', '已移除防火墙规则 ShiroMecha_Block_a1b2c3'] }, 700),
    restoreLatest: () => delay({ pointId: 'p1', log: ['删除 steam_settings', '还原 steam_api64.dll'] }),
    points: () => delay([{ id: 'p1', profileId: 'b1', profileName: '赛博朋克 · 联机', kind: 'coop', gameDir: 'E:/SteamLibrary/steamapps/common/Cyberpunk 2077', createdAt: Date.now() - 3_600_000, created: ['steam_settings'], overwritten: [], firewall: [], hosts: ['denuvo.com'], actions: ['新建 steam_settings/account_name.txt'] }]),
    removePoint: () => delay({ points: [] }),
    hosts: () => delay({ path: 'C:/Windows/System32/drivers/etc/hosts', writable: true, admin: true, domains: ['denuvo.com', 'securom.com'], raw: '', preset: [{ domain: 'denuvo.com', label: 'Denuvo 激活与校验' }, { domain: 'securom.com', label: 'SecuROM 在线校验' }] }),
    hostsWrite: () => delay({ path: 'C:/Windows/System32/drivers/etc/hosts', domains: ['denuvo.com'] }),
    firewallList: () => delay({ rules: [{ name: 'ShiroMecha_Block_a1b2c3d4e5', program: 'E:/SteamLibrary/steamapps/common/Cyberpunk 2077/bin/x64/Cyberpunk2077.exe', action: 'Block' }], total: 214 }),
    firewallAdd: () => delay({ name: 'ShiroMecha_Block_a1b2c3d4e5', exe: 'E:/game.exe', output: 'Ok.' }),
    firewallRemove: () => delay({ name: 'ShiroMecha_Block_a1b2c3d4e5', ok: true, output: 'Ok.' })
  },
  depot: {
    sources: () => delay({ sources: DEMO.sources, dirs: { work: '%APPDATA%/ShiroMechaToolkit/depot', download: true } }),
    addSource: () => delay({ sources: DEMO.sources, item: DEMO.sources[0] }),
    updateSource: () => delay({ sources: DEMO.sources }),
    removeSource: () => delay({ sources: [] }),
    importIndex: () => delay({ sources: DEMO.sources, parsed: 12, added: 9, skipped: 3 }, 800),
    exportIndex: () => delay({ file: 'C:/Users/Akari/Desktop/shiro-sources-1.json', count: 2 }),
    queue: () => delay({ results: [{ id: 's1', ok: true, task: DEMO.downloads[0] }] }, 400),
    steamcmdState: () => delay({ installed: true, path: 'C:/Users/Akari/AppData/Roaming/ShiroMechaToolkit/depot/steamcmd/steamcmd.exe', root: 'C:/Users/Akari/AppData/Roaming/ShiroMechaToolkit/depot/steamcmd', url: 'https://steamcdn-a.akamaihd.net/client/installer/steamcmd.zip', jobs: DEMO.depotJobs }),
    installSteamcmd: () => delay({ path: 'C:/Users/Akari/AppData/Roaming/ShiroMechaToolkit/depot/steamcmd/steamcmd.exe', root: '...' }, 1200),
    pull: () => delay(DEMO.depotJobs[0], 500),
    jobs: () => delay(DEMO.depotJobs),
    cancel: () => delay({ ...DEMO.depotJobs[0], status: 'cancelled' }),
    clear: () => delay([]),
    apply: () => delay({ target: 'D:/Steam/steamapps/common/BlackMythWukong', source: '...', copied: 4218, actions: ['b1/Content/Paks/pakchunk0.pak'] }, 900),
    offlinePrep: () => delay({ dir: 'D:/Steam/steamapps/common/BlackMythWukong', exe: 'b1.exe', script: 'D:/Steam/steamapps/common/BlackMythWukong/离线启动.bat', actions: ['写入 steam_appid.txt', '生成启动脚本 离线启动.bat'], steps: ['Steam 客户端 →「进入离线模式」', '双击 离线启动.bat 直接起游戏'] }, 700)
  },
  scripts: {
    list: () => delay({ scripts: DEMO.scripts }),
    save: () => delay({ scripts: DEMO.scripts }),
    remove: () => delay({ scripts: DEMO.scripts }),
    run: () => delay({ id: 'sample-ping', name: '批量测速（示例）', output: ['store.steampowered.com  32 ms  23.62.18.4', 'github.com  88 ms  140.82.113.4'], result: null, durationMs: 420 })
  },
  sys: {
    info: () => delay(DEMO.sys, 300),
    pickFile: () => delay('C:/Users/Akari/Downloads/patch.zip'),
    openPath: () => delay(true)
  },
  win: {
    minimize: () => delay(true),
    maximize: () => delay(true),
    hide: () => delay(true),
    mini: () => delay(true),
    close: () => delay(true)
  },
  on: () => () => {}
}

export const bridge: any = native || mock

export const api = {
  meta: () => unwrap<any>(bridge.app.meta()),
  openExternal: (url: string) => unwrap<boolean>(bridge.app.openExternal(url)),
  copy: (t: string) => unwrap<boolean>(bridge.app.copy(t)),

  configAll: () => unwrap<any>(bridge.config.all()),
  configSet: (k: string, v: any) => unwrap<any>(bridge.config.set(k, v)),
  configReset: () => unwrap<any>(bridge.config.reset()),

  hostsRead: () => unwrap<any>(bridge.hosts.read()),
  hostsPreview: (ids: string[]) => unwrap<any>(bridge.hosts.preview(ids)),
  hostsApply: (ids: string[]) => unwrap<any>(bridge.hosts.apply(ids)),
  hostsRestore: (id?: string) => unwrap<any>(bridge.hosts.restore(id)),
  hostsBackups: () => unwrap<any[]>(bridge.hosts.backups()),
  hostGroups: () => unwrap<any[]>(bridge.hosts.groups()),

  accelStatus: () => unwrap<any>(bridge.accel.status()),
  accelStart: (ids: string[]) => unwrap<any>(bridge.accel.start(ids)),
  accelStop: () => unwrap<any>(bridge.accel.stop()),
  accelProbe: (t?: string[]) => unwrap<any[]>(bridge.accel.probe(t)),
  accelRules: () => unwrap<any>(bridge.accel.rules()),
  accelSaveRules: (p: any) => unwrap<any>(bridge.accel.saveRules(p)),

  steamAppDetails: (id: string, lang?: string) => unwrap<any>(bridge.steam.appDetails(id, lang)),
  steamSearch: (q: string, lang?: string) => unwrap<any[]>(bridge.steam.search(q, lang)),
  steamFree: () => unwrap<any[]>(bridge.steam.freePromotions()),
  steamSpecials: () => unwrap<any[]>(bridge.steam.specials()),
  steamPlayer: (id: string, key: string) => unwrap<any>(bridge.steam.playerSummary(id, key)),
  steamOwned: (id: string, key: string) => unwrap<any>(bridge.steam.ownedGames(id, key)),

  steamIdParse: (v: string) => unwrap<any>(bridge.steamid.parse(v)),
  steamIdResolve: (v: string, key: string) => unwrap<any>(bridge.steamid.resolveVanity(v, key)),

  guardCode: (secret: string, offset?: number) => unwrap<any>(bridge.guard.code(secret, offset)),
  guardValidate: (secret: string) => unwrap<any>(bridge.guard.validate(secret)),

  accountsList: () => unwrap<any>(bridge.accounts.list()),
  accountSave: (a: any) => unwrap<any>(bridge.accounts.save(a)),
  accountRemove: (id: string) => unwrap<any>(bridge.accounts.remove(id)),
  accountSwitch: (id: string) => unwrap<any>(bridge.accounts.switchTo(id)),

  libManifest: () => unwrap<any>(bridge.library.manifest()),
  libDetail: (id: string, lang?: string) => unwrap<any>(bridge.library.detail(id, lang)),
  libAdd: (id: string, o: any) => unwrap<any>(bridge.library.add(id, o)),
  libList: () => unwrap<any>(bridge.library.list()),
  libRemove: (id: string) => unwrap<any>(bridge.library.remove(id)),
  libPickDir: () => unwrap<string | null>(bridge.library.pickDir()),
  openFolder: (p: string) => unwrap<boolean>(bridge.library.openFolder(p)),

  dlStart: (t: any) => unwrap<any>(bridge.downloads.start(t)),
  dlPause: (id: string) => unwrap<any>(bridge.downloads.pause(id)),
  dlResume: (id: string) => unwrap<any>(bridge.downloads.resume(id)),
  dlCancel: (id: string) => unwrap<any>(bridge.downloads.cancel(id)),
  dlList: () => unwrap<any[]>(bridge.downloads.list()),
  dlPickFile: () => unwrap<string | null>(bridge.downloads.pickFile()),
  dlExtract: (filePath: string, targetDir?: string) => unwrap<{ engine: string; files: number | null; targetDir: string }>(bridge.downloads.extract(filePath, targetDir)),
  dlArchiveInfo: (filePath: string) => unwrap<{ kind: string; canExtract: boolean; entries: { name: string; size: number; dir: boolean }[] }>(bridge.downloads.archiveInfo(filePath)),

  cleanScan: () => unwrap<any>(bridge.cleaner.scan()),
  cleanRun: (ids: string[]) => unwrap<any>(bridge.cleaner.run(ids)),

  patchScan: () => unwrap<any>(bridge.patches.scan()),
  patchList: () => unwrap<any>(bridge.patches.list()),
  patchAdd: (e: any) => unwrap<any>(bridge.patches.add(e)),
  patchRemove: (id: string) => unwrap<any>(bridge.patches.remove(id)),
  patchGuide: () => unwrap<any>(bridge.patches.guide()),
  patchDeploy: (id: string, dir: string) => unwrap<any>(bridge.patches.deploy(id, dir)),

  vaultGuard: () => unwrap<any>(bridge.vault.guard()),
  vaultLibraries: () => unwrap<any[]>(bridge.vault.libraries()),
  vaultAppInfo: (appid: string, lang?: string) => unwrap<any>(bridge.vault.appInfo(appid, lang)),
  vaultList: () => unwrap<any>(bridge.vault.list()),
  vaultInstall: (input: any) => unwrap<any>(bridge.vault.install(input)),
  vaultRemove: (id: string, options?: any) => unwrap<any>(bridge.vault.remove(id, options)),
  vaultKillSteam: () => unwrap<any>(bridge.vault.killSteam()),
  vaultBackups: () => unwrap<any[]>(bridge.vault.backups()),
  vaultRestoreBackup: (slot: string) => unwrap<any>(bridge.vault.restoreBackup(slot)),
  vaultDepotCache: (library?: string) => unwrap<any[]>(bridge.vault.depotCache(library)),
  vaultImportManifests: (paths: string[], library?: string) => unwrap<any>(bridge.vault.importManifests(paths, library)),
  vaultExportManifests: (library?: string, targetDir?: string) => unwrap<any>(bridge.vault.exportManifests(library, targetDir)),
  vaultPickManifests: () => unwrap<string[]>(bridge.vault.pickManifests()),
  vaultSelftest: () => unwrap<any>(bridge.vault.selftest()),

  linkbayAll: () => unwrap<any>(bridge.linkbay.all()),
  linkbayAddLink: (target: string, link: any) => unwrap<any>(bridge.linkbay.addLink(target, link)),
  linkbayRemoveLink: (target: string, index: number) => unwrap<any>(bridge.linkbay.removeLink(target, index)),
  linkbayAddSite: (site: any) => unwrap<any>(bridge.linkbay.addSite(site)),
  linkbayRemoveSite: (id: string) => unwrap<any>(bridge.linkbay.removeSite(id)),
  linkbayExtract: (input: any) => unwrap<any>(bridge.linkbay.extract(input)),
  linkbayMirrors: () => unwrap<any>(bridge.linkbay.mirrors()),
  linkbayMirrorize: (url: string, id: string) => unwrap<string>(bridge.linkbay.mirrorize(url, id)),
  linkbayQueue: (input: any) => unwrap<any>(bridge.linkbay.queue(input)),
  linkbayPatchFetch: (input: any) => unwrap<any>(bridge.linkbay.patchFetch(input)),
  linkbayCheck: (input: any) => unwrap<any>(bridge.linkbay.check(input)),
  linkbayPickDir: () => unwrap<string | null>(bridge.linkbay.pickDir()),

  bypassGuide: () => unwrap<any>(bridge.bypass.guide()),
  bypassProfiles: () => unwrap<any>(bridge.bypass.profiles()),
  bypassSaveProfile: (p: any) => unwrap<any>(bridge.bypass.saveProfile(p)),
  bypassRemoveProfile: (id: string) => unwrap<any>(bridge.bypass.removeProfile(id)),
  bypassAnalyze: (dir: string) => unwrap<any>(bridge.bypass.analyze(dir)),
  bypassPlan: (p: any) => unwrap<any[]>(bridge.bypass.plan(p)),
  bypassDeploy: (id: string, dir?: string) => unwrap<any>(bridge.bypass.deploy(id, dir)),
  bypassRestore: (id: string) => unwrap<any>(bridge.bypass.restore(id)),
  bypassRestoreLatest: () => unwrap<any>(bridge.bypass.restoreLatest()),
  bypassPoints: () => unwrap<any[]>(bridge.bypass.points()),
  bypassRemovePoint: (id: string) => unwrap<any>(bridge.bypass.removePoint(id)),
  bypassHosts: () => unwrap<any>(bridge.bypass.hosts()),
  bypassHostsWrite: (domains: string[]) => unwrap<any>(bridge.bypass.hostsWrite(domains)),
  bypassFirewallList: () => unwrap<any>(bridge.bypass.firewallList()),
  bypassFirewallAdd: (exe: string) => unwrap<any>(bridge.bypass.firewallAdd(exe)),
  bypassFirewallRemove: (exe: string) => unwrap<any>(bridge.bypass.firewallRemove(exe)),

  depotSources: () => unwrap<any>(bridge.depot.sources()),
  depotAddSource: (item: any) => unwrap<any>(bridge.depot.addSource(item)),
  depotUpdateSource: (id: string, patch: any) => unwrap<any>(bridge.depot.updateSource(id, patch)),
  depotRemoveSource: (id: string) => unwrap<any>(bridge.depot.removeSource(id)),
  depotImportIndex: (file: string, options?: any) => unwrap<any>(bridge.depot.importIndex(file, options)),
  depotExportIndex: (file?: string) => unwrap<any>(bridge.depot.exportIndex(file)),
  depotQueue: (ids: string[], options?: any) => unwrap<any>(bridge.depot.queue(ids, options)),
  depotSteamcmd: () => unwrap<any>(bridge.depot.steamcmdState()),
  depotInstallSteamcmd: () => unwrap<any>(bridge.depot.installSteamcmd()),
  depotPull: (input: any) => unwrap<any>(bridge.depot.pull(input)),
  depotJobs: () => unwrap<any[]>(bridge.depot.jobs()),
  depotCancel: (id: string) => unwrap<any>(bridge.depot.cancel(id)),
  depotClear: (id?: string) => unwrap<any[]>(bridge.depot.clear(id)),
  depotApply: (jobId: string, dir: string, options?: any) => unwrap<any>(bridge.depot.apply(jobId, dir, options)),
  depotOfflinePrep: (input: any) => unwrap<any>(bridge.depot.offlinePrep(input)),

  scriptList: () => unwrap<any>(bridge.scripts.list()),
  scriptSave: (s: any) => unwrap<any>(bridge.scripts.save(s)),
  scriptRemove: (id: string) => unwrap<any>(bridge.scripts.remove(id)),
  scriptRun: (id: string) => unwrap<any>(bridge.scripts.run(id)),

  sysInfo: () => unwrap<any>(bridge.sys.info()),
  sysPickFile: (f?: any) => unwrap<string | null>(bridge.sys.pickFile(f)),
  sysOpenPath: (p: string) => unwrap<boolean>(bridge.sys.openPath(p)),

  winMinimize: () => unwrap<boolean>(bridge.win.minimize()),
  winMaximize: () => unwrap<boolean>(bridge.win.maximize()),
  winHide: () => unwrap<boolean>(bridge.win.hide()),
  winMini: (on: boolean) => unwrap<boolean>(bridge.win.mini(on)),
  winClose: () => unwrap<boolean>(bridge.win.close()),

  on: (channel: string, handler: (p: any) => void) => bridge.on(channel, handler)
}
