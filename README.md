<div align="center">

<img src="build/icon.png" width="128" alt="Shiro Mecha Toolkit" />

# Shiro Mecha Toolkit · 白机甲工坊

**跨平台 Steam 玩家工具箱 · 纯本地运行 · 开源免费**

[![License: MIT](https://img.shields.io/badge/License-MIT-1E5FD1.svg)](./LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-1E5FD1.svg)](#下载与安装)
[![Electron](https://img.shields.io/badge/Electron-31-1E5FD1.svg)](https://www.electronjs.org/)
[![No Telemetry](https://img.shields.io/badge/telemetry-none-12946A.svg)](#隐私)

[English](./README.en.md) · [简体中文](./README.md)

</div>

---

## 这是什么

**Shiro Mecha Toolkit（白机甲工坊）** 是一个跨平台的 Steam 工具箱桌面应用。它把日常最常用的几件事收在一个界面里：网络加速、hosts 管理、Steam Guard 令牌、SteamID 转换、账号切换、游戏库与下载管理、空间清理。

设计原则只有三条：

- **纯本地**：没有账号体系，没有云端，没有统计上报。所有配置都写在你自己的电脑上。
- **无捆绑**：不含任何广告、导航站劫持、静默安装的第三方程序。
- **可审阅**：MIT 许可，代码不混淆、不加密，你可以逐行看完再运行。
- **分层安全**：本体是干净的那一半——加速、hosts、令牌、SteamID、账号、游戏库、下载器、清理、便携启动，这些不含混淆、后门、挖矿、捆绑。有风险的是另一半：**接管舱**（假入库、补丁部署、验证屏蔽）和**直链仓**（离线版/破解版直链、联机补丁、免 Steam 补丁）。这部分程序本身仍然干净，它只是**按你给的地址去下载、按你放的文件去部署**——风险来自你引进来的那些文件，来源不明的破解补丁可能带木马、挖矿或勒索。用不用、用哪个，你自己判断。

---

## 功能一览

### 🚀 加速中心

- **本机回环代理**：只监听 `127.0.0.1`，不对局域网或公网开放。
- **优选 IP 解析**：命中加速名单的域名会先通过公共 DNS over HTTPS 解析出全部 A 记录，逐个 TCP 握手测速，取延迟最低的那个 IP 连接。
- **不改证书、不改 SNI**：域名校验照常通过，只是绕开了慢的解析结果。
- **一键名单**：Steam 商店/社区、Steam 静态资源、GitHub、Pixiv、Discord、Epic、云盘与主机、开发者服务，共 8 组；也可自行添加自定义域名或整个后缀。
- **PAC 自动配置**：`http://127.0.0.1:<端口>/proxy.pac`，浏览器可以直接用。
- **可选系统代理**：需要时一键接管系统代理，关掉即还原。
- **hosts 加速**：把优选 IP 写进系统 hosts 的独立区块（带 `BEGIN/END` 标记），不碰你原来的任何一行；每次写入前自动备份，随时一键还原。
- **线路测速**：对任意域名测出延迟并给出评级。

### 🛡️ Steam 工具

- **Steam Guard 令牌**：用你自己的 `shared_secret` 在本机离线计算当前验证码，带倒计时进度条与前后相邻时段（时钟有偏差时可对照）。**计算过程不联网。**
- **SteamID 转换**：SteamID64 ⇄ `STEAM_X:Y:Z` ⇄ `[U:1:x]` ⇄ 好友码 ⇄ 主页链接，互相换算，纯本地计算。
- **账号一键切换**：登记多个账号，一键设为默认登录（同步 `loginusers.vdf` 的 `MostRecent` 标记，Windows 下同时写入自动登录项）。**从不接触、不存储你的密码。**
- **商店查询**：按 AppID 拉取封面、简介、开发商、发行商、价格、媒体评分；另有「当前免费」与「正在打折」列表。
- **Web API 集成**：填上你自己的 Steam Web API Key 后可查玩家资料、游戏库、成就进度（Key 只保存在本机配置文件）。

### 🎮 游戏库 与 ⬇️ 下载管理

- **已安装游戏**：扫描所有 Steam 库目录的 `appmanifest_*.acf`，列出名称、占用空间、最后更新时间，一键打开安装目录。
- **商店详情**：封面、截图、简介、开发商、价格，支持在应用内直接查看。
- **愿望清单**：登记想玩的游戏，可填写官方发布地址或你有权使用的自有文件地址。
- **多线程下载器**：支持 HTTP Range 时自动分段并发（1–16 线程）、断点续传、暂停/继续/取消、实时速度与剩余时间、限速。
- **下载完就能解压**：`.zip` 用内置解压（纯 JS，不需要装任何东西），下载完成点一下「解压」就出目录；`.7z / .rar` 会自动调用你机器上的 7-Zip。本程序**不内置、不分发**任何解压软件。

### 📦 便携启动配置

用来管理**你自己已有的**启动文件：登记来源路径，一键部署到游戏安装目录，被覆盖的原文件自动改名备份（`.shiro-backupN`）。

> ⚠️ **本程序不包含、不下载、不分发任何破解补丁或游戏本体文件，也不会伪造入库或绕过 Steam/DRM。** 该功能只做「把你本机已有的启动配置复制到你指定的目录」这一件事。请确认文件来源是你本人合法拥有的副本，并遵守当地法律与游戏许可协议。

### 🛠️ 接管舱

接管舱把四件事收在一个页面里，它们共用同一套「部署 → 备份 → 一键还原」机制。

#### 20.1 入库工坊

往本机 Steam 客户端的库文件里登记一个 AppID，让它在库列表里出现：

- **appmanifest 生成**：按 Steam 的 `AppState` 结构完整写出（appid / name / StateFlags / InstalledDepots / SharedDepots / installdir / buildid / SizeOnDisk / AutoUpdateBehavior 等），落进指定库的 `steamapps/` 目录。
- **体积登记**：往 `libraryfolders.vdf` 对应库节点的 `apps` 里写占用字节数。
- **所有权标记**：往 `config/config.vdf` 的 `InstallConfigStore → Software → Valve → Steam → apps` 下写 `"Installed" "1"`。这一项可以关掉。
- **depot 结构拉取**：填 AppID 点一下，自动带出名称、安装目录、BuildID、depot 列表和总体积；appinfo 镜像不通时退回商店接口只取名称。
- **清单缓存管理**：`steamapps/depotcache` 里的 `.manifest` 可以一键导入、一键导出到桌面。
- **VDF 定点编辑**：自带一套最小 KeyValues 解析器，只改自己要改的那几行，其余格式原样保留，不会把 Steam 的配置文件重排。
- **还原点**：每次写入前把 `appmanifest` / `libraryfolders.vdf` / `config.vdf` 完整备份到 `vault-backups/<appid>-<时间戳>/`，一条记录一个还原点，点一下整份换回去。
- **进程守卫**：检测 `steam.exe` 是否在跑，在跑就拒绝写入（会被 Steam 覆盖回写），也可以一键强制结束。

#### 20.2 资源库

- **直链源清单**：自己维护一份地址清单，支持直链 / 镜像 / 磁力 / JSON 索引四类；选中后直接丢进多线程下载器，断点续传、限速、自动解压全套继承。
- **索引批量导入**：JSON 数组、`{items:[]}`、`{games:[]}`、每行一条的 CSV / TXT 都能吃；重复地址自动去重，导入结果会告诉你有多少条新增、多少条跳过。
- **清单导出**：把整份源清单导出成 JSON，换机器直接带走。
- **SteamCMD 集成**：一键从 Valve 官方 CDN 下载 steamcmd 并展开（内置解压，不需要额外工具），然后走 `download_depot <appid> <depotid> [manifestid]` 拉取 depot 内容。
- **实时进度解析**：从 steamcmd 的输出里解析百分比、已下载字节、速度，进度条和日志同时刷新，可以随时取消。
- **归位**：拉完直接把 depot 内容合进游戏目录，已存在的文件默认跳过，需要覆盖时自动留 `.shiro-backup`。
- **离线版处理**：写 `steam_appid.txt`，生成一个「离线启动」脚本（Windows 是 `.bat`，Linux/macOS 是 `.sh`），并把离线模式的步骤列出来。

#### 20.3 补丁中心

- **四种档案类型**：联机补丁 / 免 Steam 补丁 / DRM 与联网验证绕过 / 纯文件部署。
- **目录体检**：扫描游戏目录里的 `steam_api64.dll`、`steam_api.dll`、`steamclient*.dll`、主程序 exe，以及 `steam_settings`、`onlinefix.ini`、`SmartSteamEmu.ini`、`cream_api.ini` 等常见标记，并判断是否已经有补丁痕迹和已有备份。
- **文件部署**：把你本机已有的文件（单个文件或整个目录）复制进游戏目录，覆盖前自动改名备份为 `.shiro-backupN`。
- **配置生成**：按类型自动生成一整套

  ```
  steam_appid.txt
  steam_settings/steam_appid.txt
  steam_settings/account_name.txt        仿真账号名
  steam_settings/language.txt            语言
  steam_settings/configs.user.ini        用户侧（账号 / SteamID / 语言 / 存档目录）
  steam_settings/configs.app.ini         应用侧（AppID / DLC / depot 解锁）
  steam_settings/custom_broadcasts.txt   自定义广播名（联机用这个互相找到房间）
  steam_settings/disable_lan_only.txt    允许非局域网互联
  steam_settings/DLC.txt                 按你填的 DLC ID 生成
  steam_settings/depots.txt              按你填的 depot ID 生成
  ```

- **部署前预览**：点一下「预览配置」，把将要生成的文件清单和每个文件的作用先列出来。
- **还原点**：记录本次新建了哪些文件、覆盖了哪些（含备份路径）、加了哪些防火墙规则，一键撤回就是把新建的删掉、备份的换回去、规则撤掉。

#### 20.4 屏蔽台

- **hosts 托管区**：写在 `# ==== SHIRO BYPASS BEGIN ====` 和 `# ==== SHIRO BYPASS END ====` 之间，只动自己这一段，你原来的内容一个字不改；写入前整份备份到 `bypass-backups/`；点「清空屏蔽」整段删掉，回到最初的样子。
- **常用校验域名**：Denuvo、SecuROM、SolidShield、TAGES、StarForce、SafeDisc 等一组预置域名，点一下加入或移除；也可以自己填任意域名。
- **出站防火墙**：按可执行文件路径用 `netsh advfirewall` 建出站阻断规则，规则名带路径哈希（`ShiroMecha_Block_<hash>`），支持列出和一键删除。比 hosts 更彻底，因为它是按进程掐流量。

> ⚠️ **关于接管舱的边界**：这四个模块**不内置、不下载、不分发**任何补丁文件、游戏本体或下载地址。需要文件的地方一律由你自己提供，需要地址的地方由你自己维护清单（填在 `electron/data/catalog.js` 或在「直链仓」界面里填），程序只做登记、复制、生成配置、写库文件、备份和还原。下载动作在「直链仓」里做，部署动作在这里做。
> hosts 与防火墙两项需要管理员权限；不授权也能用，只是这两项不可用。
> 入库登记会修改你的 Steam 库文件，**动手前请先完全退出 Steam**，每次写入都会留还原点。

### 🔗 直链仓

直链仓管的是「去哪儿拿文件」这件事，四块：

**站源大全** —— 内置一份离线版/重打包/直链站/补丁站的目录（SteamRIP、FitGirl、DODI、GLoad、SteamUnlocked、OVA、FreeTP、ByRutGame、RuTracker、CS.RIN.RU、Online-Fix、Xatab、GOG Games、DLPS Game 等 20 个），标了站点类型、是不是页面直出直链、地区、大致速度和风险等级。可以自己再加站。

**直链提取** —— 粘一个发布页地址，程序只**读**那个页面，把里面的归档文件链接和网盘链接挑出来（`.rar / .zip / .7z / .part1.rar / .iso / .torrent / magnet:` 以及几十个常见网盘域名），去重、按站点归类、逐条显示。挑出来的链接可以一键探测（看通不通、支不支持多线程、能不能断点续传），也可以直接丢进下载器。

**补丁源** —— 联机补丁、免 Steam 补丁、DRM 绕过、纯文件部署，四个档案。每条源都带真实上游地址（Goldberg/gbe_fork、Steamless、CreamAPI、SmartSteamEmu、Online-Fix），卡片上直接是大按钮：`下载联机补丁` / `免 Steam 补丁`。程序**不内置任何补丁文件**，点下载就是去拉你在下面填的那条直链，拉完可以自动解包，之后去「接管舱 → 补丁中心」部署并留还原点。

**加速线路** —— 一组实测能用的 GitHub 公共反代（gh-proxy.com、gh.llkk.cc、ghproxy.net、ghfast.top…），一键测延迟排个序，谁快用谁；下面配 Steam 官方 CDN 列表，可以拿去加速中心做优选 IP 的靶子。

> 🔗 **要填直链就改这里**：`electron/data/catalog.js` → 每个站点/补丁条目的 `links: []` 数组，格式是
> ```js
> links: [
>   { label: '黑神话 悟空 免安装版', url: 'https://你的直链/xxx.rar', note: '解压密码 123' }
> ]
> ```
> 不想动代码也行——在「直链仓」页面对应卡片上点「填一条直链」，填完会写进本地配置（`linkbay.json`）。两种方式等价，界面上填的优先级更高。
> `links` 留空就是「未配置」，程序不会瞎猜地址、也不会报错。

> ⚠️ **风险提示**：单机离线版、破解版、各种补丁包，来源都不受任何平台背书。同一个游戏在不同站点打包质量差很多，压缩包里塞挖矿脚本、静默安装器、窃密程序是这行的老问题；改写 Steam 库文件本身也可能被客户端判定异常。这些风险**不来自本程序**——本程序只是执行器，风险来自你选择放进去的文件。装之前先用杀软扫一遍、看清楚解压出来的东西，是个好习惯。

> 🔒 **关于「假入库」**：接管舱的入库工坊写的是**真实的 Steam 库文件**（`appmanifest_<appid>.acf` + `libraryfolders.vdf` 体积登记 + `config.vdf` 的 `Installed` 标记），所以 Steam 启动后确实能在库里看到这一条。但要清楚它**只写清单、不写文件内容**：游戏目录是空的，缩略图和「已安装」状态是有的。要真的能玩，你得自己把本体文件放进去（或者用 depot 拉取）。库里那条记录点「移除」就干净回滚，写入前自动留还原点。

### 🧩 脚本工坊

写点自己的小脚本（例如批量测速、生成 hosts 片段），在**受限沙箱**里运行：

- 没有文件系统权限、没有网络权限、没有进程权限；
- 只开放 `shi.mecha.probeHost()` / `shi.mecha.resolveDomain()` / `shi.util.*` 几个受控接口；
- 单次执行超过 5 秒自动中断。

### 🧹 空间清理

扫描 Steam 下载缓存清单、内置浏览器缓存、日志、崩溃转储、着色器预编译缓存、用户临时文件夹与应用自身缓存。

每一项都会告诉你是「这是什么、删了会怎样」，默认只勾选风险最低的；正在被占用的文件自动跳过，绝不强制删除。

### ⚙️ 其它

- **中英双语界面**，随时切换。
- **深/浅色随系统**，白蓝机甲主题，工程图纸质感。
- **托盘常驻**、关闭最小化、开机自启加速、迷你模式。
- **配置全部本地**：单文件 JSON，路径在「设置 → 数据」里可见。

---

## 隐私

| 项目 | 说明 |
|---|---|
| 账号体系 | 无 |
| 云端同步 | 无 |
| 使用统计 / 埋点 | 无 |
| 崩溃上报 | 无 |
| 网络请求 | 仅在你主动触发功能时发起：Steam 官方公开接口、公共 DoH 解析、官方或你有权使用的下载地址 |
| 本地存储 | `config.json`、`accounts.json`、`library.json`、`launchers.json`、`scripts.json`、`vault.json`、`bypass.json`、`bypass-points.json`、`depot-sources.json`，以及 hosts / 库文件的备份目录 |

`shared_secret` 与 Steam Web API Key 属于敏感信息，请勿分享给任何人，也不要提交到公开仓库。

---

## 下载与安装

### 预编译包

到 [Releases](https://github.com/Jingluohi/Shiro-Mecha-Toolkit/releases) 下载对应平台的安装包：

| 平台 | 文件 | 说明 |
|---|---|---|
| Windows | `ShiroMechaToolkit-Setup-x.y.z-x64.exe` | 安装版，可自选目录 |
| Windows | `ShiroMechaToolkit-Portable-x.y.z-x64.exe` | 免安装便携版 |
| Linux | `ShiroMechaToolkit-x.y.z-x86_64.AppImage` | `chmod +x` 后直接运行 |
| macOS | `ShiroMechaToolkit-x.y.z-arm64.dmg` | 需自行签名，或用下方的自构建方式 |

> **写入 hosts、切换账号登录项需要管理员权限。** Windows 上请右键「以管理员身份运行」，Linux 上用 `sudo`，macOS 会弹系统授权框。不授权也能用，只是这两项功能不可用，其它功能不受影响。

### 从源码构建

需要 Node.js 18+（推荐 20 LTS）。

```bash
git clone https://github.com/Jinglohi/Shiro-Mecha-Toolkit.git
cd Shiro-Mecha-Toolkit
npm install

# 开发模式（前端热更新 + Electron）
npm run dev          # 终端 A：起 Vite 开发服务器（默认 5173）
SHIRO_DEV=1 npm start # 终端 B：起 Electron 并指向开发服务器

# 构建安装包
npm run dist:win     # Windows
npm run dist:linux   # Linux AppImage
npm run dist:mac     # macOS dmg
```

产物在 `release/` 目录。macOS 打包需要 macOS 环境；Windows 安装包在 Linux 上交叉构建时依赖 wine。

---

## 项目结构

```
Shiro-Mecha-Toolkit/
├─ electron/                 # 主进程（Node 侧）
│  ├─ main.js                # 窗口、托盘、IPC 注册
│  ├─ preload.js             # 白名单桥（contextBridge）
│  ├─ data/
│  │  └─ catalog.js          # 站源目录 ← 要填直链就改这里
│  └─ modules/
│     ├─ config.js           # 本地配置读写
│     ├─ hosts.js            # hosts 管理 + DoH 解析 + 优选 IP
│     ├─ accelerator.js      # 本地回环代理 + PAC + 系统代理
│     ├─ steam.js            # Steam 商店 / WebAPI 客户端
│     ├─ steamid.js          # SteamID 格式互转
│     ├─ guard.js            # Steam Guard TOTP
│     ├─ accounts.js         # 账号一键切换
│     ├─ library.js          # 游戏库 / 待入库清单
│     ├─ downloader.js       # 多线程下载器
│     ├─ cleaner.js          # 缓存清理
│     ├─ patcher.js          # 便携启动配置管理
│     ├─ vault.js            # 入库工坊：VDF/ACF 定点编辑 + 清单缓存 + 还原点
│     ├─ bypass.js           # 补丁中心：文件部署 + 配置生成 + hosts/防火墙
│     ├─ depot.js            # 资源库：直链源清单 + steamcmd + 离线版处理
│     ├─ linkbay.js          # 直链仓：站源目录 + 直链提取 + 补丁下载 + 线路测速
│     ├─ scriptbox.js        # 受限沙箱脚本运行
│     └─ sysinfo.js          # 本机信息 / Steam 路径探测
├─ src/                      # 渲染层（React）
│  ├─ components/            # AppShell + UI 组件 + 错误边界
│  ├─ pages/                 # 12 个功能页（含接管舱 Takeover、直链仓 LinkBay）
│  ├─ lib/                   # 桥接、i18n、工具函数
│  └─ assets/                # 字体与主视觉
├─ build/                    # 打包图标
└─ .github/workflows/        # 三平台自动打包
```

### 技术栈

- **Electron 31** + 原生 Node 模块（`http` / `https` / `net` / `crypto` / `vm`），核心能力零重型依赖
- **React 19** + **Vite** + **Tailwind CSS v3** + **Framer Motion** + **Lucide**
- **electron-builder** 三平台打包
- 渲染层通过 `contextBridge` 暴露的**白名单 IPC** 与主进程通信：`contextIsolation: true`、`nodeIntegration: false`

---

## 常见问题

**加速没效果？**
先在「加速中心 → 线路测速」确认目标域名当前能否拿到更快的 IP。如果你的网络本身已经能直连，加速不会有体感差异。端口被占用时在「设置 → 加速」里换一个。

**写入 hosts 失败？**
需要管理员权限。Windows 右键「以管理员身份运行」，Linux 用 `sudo`，macOS 会弹授权框。另外部分安全软件会锁定 hosts 文件，需要先放行。

**担心 hosts 被改坏？**
每次写入前都会自动备份到用户数据目录的 `hosts-backups/`，「加速中心 → hosts」里可以一键还原；本程序只操作自己写入的 `BEGIN/END` 区块，你原有的内容不会被改动。

**账号切换会保存密码吗？**
不会。程序只改「默认登录哪个账号」这一个标记，密码始终由 Steam 客户端自己保管。

**`shared_secret` 存在哪里？**
只有在你勾选「记住到本机配置文件」后才会写入本机的 `config.json`，不联网、不上传。清除勾选即可删除。

**杀毒软件报毒？**
Electron 应用被加壳工具误报是常见现象。所有代码都在仓库里，你可以自行构建一份（见上文「从源码构建」），对比构建产物。

---

## 参与贡献

欢迎提 Issue 和 PR。提交前请确保：

- `npm run build` 通过；
- 不引入任何联网上报、广告或闭源二进制；
- 新增的用户可见文案同时提供中英文。

---

## 许可

[MIT](./LICENSE) © 岚川怀瑾 (LanChuanHuaJin)

---

## 免责声明

本程序按「现状」提供，不附带任何形式的担保。使用本程序产生的任何后果由使用者自行承担。

关于安全，说清楚分界：加速中心、hosts 管理、Steam Guard、SteamID、账号切换、游戏库、下载器、空间清理、便携启动、脚本工坊，这些模块**不含恶意代码、不捆绑、不联网上报**，代码全开源可逐行审阅，可以当普通工具放心用。

**接管舱**（假入库 / 补丁部署 / 验证屏蔽）和**直链仓**（离线版直链 / 联机补丁 / 免 Steam 补丁）属于高风险区：它们会改写本机 Steam 库文件、部署第三方文件、访问你指定或目录里列出的外部地址。这些功能本身仍然只是执行器——程序不包含、不内置、不分发任何第三方补丁文件、游戏本体或受版权保护的内容，也不替你判断文件是否可信。**潜在风险（病毒木马、挖矿、账号异常、版权问题）来自你引入的文件和你的使用方式**，请自行确认授权、自行扫描文件、遵守当地法律与平台服务条款。写入类操作都带备份和一键还原，出事能回滚，但不能代替你自己的判断。

功能设计上参考了 [Watt Toolkit](https://github.com/BeyondDimension/SteamTools) 与 [SteamToolPlus](https://github.com/Jingluohi/SteamToolPlus) 的公开思路，界面与实现均为本项目原创。
