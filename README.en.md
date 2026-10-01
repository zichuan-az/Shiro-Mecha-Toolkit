<div align="center">

<img src="build/icon.png" width="128" alt="Shiro Mecha Toolkit" />

# Shiro Mecha Toolkit

**A cross-platform Steam toolkit · Runs fully offline · Open source & free**

[![License: MIT](https://img.shields.io/badge/License-MIT-1E5FD1.svg)](./LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-1E5FD1.svg)](#download)
[![Electron](https://img.shields.io/badge/Electron-31-1E5FD1.svg)](https://www.electronjs.org/)
[![No Telemetry](https://img.shields.io/badge/telemetry-none-12946A.svg)](#privacy)

[English](./README.en.md) · [简体中文](./README.md)

</div>

---

## What it is

**Shiro Mecha Toolkit** puts the day-to-day chores of a Steam user behind one window: network acceleration, hosts management, Steam Guard codes, SteamID conversion, account switching, a game library with a download manager, and disk cleanup.

Three principles:

- **Local only** — no accounts, no cloud, no telemetry. Every setting lives on your own machine.
- **No bundling** — no ads, no browser-hijacking, no silently installed third-party software.
- **Auditable** — MIT licensed, no obfuscation, no encrypted blobs. Read every line before you run it.
- **Split-risk, stated plainly** — the first half of the app is clean: acceleration, hosts, Guard codes, SteamID, accounts, library, downloader, cleanup, portable launch. No obfuscation, no backdoors, no miners, no bundles. The second half is the risk zone: **Takeover Bay** (library registration, patch deployment, verification blocking) and **Link Bay** (offline/cracked direct links, online fixes, Steam-free patches). That code is still clean — it is an executor: it downloads from addresses you provide and deploys files you place. **The risk comes from the files you bring in**; unknown cracked patches can carry trojans, miners or ransomware. Your call which half you use.

---

## Features

### 🚀 Accelerator

- **Loopback proxy** — listens on `127.0.0.1` only; never exposed to LAN or the internet.
- **Best-IP resolution** — for domains on the rule list, all A records are resolved over public DNS-over-HTTPS, each candidate is probed with a TCP handshake, and the lowest-latency IP is used.
- **No certificate or SNI tampering** — hostname validation still passes; you simply bypass a slow resolver.
- **Rule sets** — Steam Store/Community, Steam static assets, GitHub, Pixiv, Discord, Epic, cloud & console, developer services. Add your own domains or whole suffixes.
- **PAC support** — `http://127.0.0.1:<port>/proxy.pac`.
- **Optional system proxy** — one toggle on, one toggle off, fully reverted.
- **hosts boost** — writes optimised IPs into a dedicated `BEGIN/END` block in your system hosts file, leaving every existing line untouched. Automatic backup before each write, one-click restore.
- **Latency probe** — measure and grade the round trip to any domain.

### 🛡️ Steam tools

- **Steam Guard codes** — compute the current code locally from your own `shared_secret`, with a countdown meter and neighbouring windows for clock drift. **Nothing is sent over the network.**
- **SteamID converter** — SteamID64 ⇄ `STEAM_X:Y:Z` ⇄ `[U:1:x]` ⇄ friend code ⇄ profile link, all computed offline.
- **Account switching** — register multiple accounts and set the default login (syncs the `MostRecent` flag in `loginusers.vdf`, plus the Windows auto-login entry). **Your password is never touched or stored.**
- **Store lookup** — cover image, description, developers, publishers, price and Metacritic by AppID, plus "free to play now" and "on sale" lists.
- **Web API integration** — with your own Steam Web API key you can inspect profile, owned games and achievement progress. The key stays in your local config file.

### 🎮 Library & ⬇️ Downloads

- **Installed games** — parsed from `appmanifest_*.acf` across every Steam library folder; shows size and last-updated time, opens the install folder in one click.
- **Store detail** — cover, screenshots, description, price, right inside the app.
- **Wishlist**: register games and attach an official release URL or a file you are authorised to use.
- **Multi-threaded downloader** — automatic HTTP Range segmentation (1–16 threads), resume support, pause/cancel, live speed and ETA, optional rate limit.
- **Extract right after download** — `.zip` is extracted by a built-in pure-JS extractor (nothing to install); for `.7z / .rar` the app calls the 7-Zip you already have. No archive tool is bundled or distributed.

### 📦 Portable launch configs

Manage launcher files **you already own**: register a source path, deploy it into a game folder, and any overwritten file is renamed to a `.shiro-backupN` copy first.

> ⚠️ **This application does not contain, download or distribute any patch file or game data.** The feature only copies a launch configuration you already have into a folder you choose, and replaces nothing without keeping a backup. Make sure your files come from a copy you legitimately own, and follow your local laws and the game's licence agreement.

### 🛠️ Takeover Bay

Takeover Bay collects four related tools on one page. They all share the same deploy → back up → one-click restore engine.

#### Library registration

Registers an AppID into your local Steam library files so it shows up in the library list:

- **appmanifest generation** — writes the full `AppState` structure (appid / name / StateFlags / InstalledDepots / SharedDepots / installdir / buildid / SizeOnDisk / AutoUpdateBehavior …) into the `steamapps/` folder of the library you pick.
- **Size registration** — writes the on-disk byte count into the `apps` node of the matching library entry in `libraryfolders.vdf`.
- **Ownership flag** — writes `"Installed" "1"` under `InstallConfigStore → Software → Valve → Steam → apps` in `config/config.vdf`. This step can be turned off.
- **Depot structure fetch** — enter an AppID and it pulls the name, install folder, BuildID, depot list and total size; if the appinfo mirror is unreachable it falls back to the store API for the name alone.
- **Manifest cache management** — import and export the `.manifest` files inside `steamapps/depotcache`.
- **Targeted VDF editing** — a small KeyValues parser rewrites only the lines that need changing and leaves the rest of Steam's formatting untouched, so nothing gets reformatted.
- **Restore points** — every write first copies `appmanifest`, `libraryfolders.vdf` and `config.vdf` into `vault-backups/<appid>-<timestamp>/`; one click puts the whole set back.
- **Process guard** — detects a running `steam.exe` and refuses to write while it is up (Steam would overwrite the changes), with an optional force-quit button.

#### Sources

- **Direct-link list** — keep your own address list with four kinds: direct, mirror, magnet and JSON index. Queue a selection straight into the multi-threaded downloader and inherit resume, rate limiting and auto-extract.
- **Batch index import** — accepts a JSON array, `{items:[]}`, `{games:[]}`, or one-per-line CSV / TXT; duplicates are skipped and the result reports how many were added.
- **Export** — dump the whole list to JSON and carry it to another machine.
- **SteamCMD integration** — downloads and unpacks steamcmd from Valve's official CDN with the built-in extractor, then runs `download_depot <appid> <depotid> [manifestid]`.
- **Live progress** — parses percentage, bytes and speed out of the steamcmd output; the bar and the log update together and a job can be cancelled at any time.
- **Apply** — merges the pulled depot content into the game folder; existing files are skipped by default and overwritten ones keep a `.shiro-backup`.
- **Offline prep** — writes `steam_appid.txt`, generates an offline launch script (`.bat` on Windows, `.sh` elsewhere) and lists the offline-mode steps.

#### Patches

- **Four profile types** — co-op patch / Steam-free patch / DRM & online-check bypass / plain file deploy.
- **Folder inspection** — finds `steam_api64.dll`, `steam_api.dll`, `steamclient*.dll`, the main executables, plus markers such as `steam_settings`, `onlinefix.ini`, `SmartSteamEmu.ini` and `cream_api.ini`, and reports whether the folder is already patched.
- **File deployment** — copies your own files (single file or whole folder) into the game folder; anything overwritten is renamed to `.shiro-backupN` first.
- **Config generation** — writes a complete set of

  ```
  steam_appid.txt
  steam_settings/steam_appid.txt
  steam_settings/account_name.txt        emulated account name
  steam_settings/language.txt            language
  steam_settings/configs.user.ini        user side (account / steamid / language / saves)
  steam_settings/configs.app.ini         app side (appid / DLC / depot unlocks)
  steam_settings/custom_broadcasts.txt   custom broadcast name (how co-op rooms find each other)
  steam_settings/disable_lan_only.txt    allow non-LAN connectivity
  steam_settings/DLC.txt                 generated from the DLC IDs you enter
  steam_settings/depots.txt              generated from the depot IDs you enter
  ```

- **Preview** — shows exactly which files will be generated and what each one does before you deploy.
- **Restore points** — records what was created, what was overwritten (with backup paths) and which firewall rules were added; restore deletes the new files, puts the backups back and removes the rules.

#### Shield

- **hosts managed block** — written between `# ==== SHIRO BYPASS BEGIN ====` and `# ==== SHIRO BYPASS END ====`, touching nothing outside it; the whole file is backed up to `bypass-backups/` before each write, and clearing the block returns the file to its original state.
- **Preset domains** — Denuvo, SecuROM, SolidShield, TAGES, StarForce, SafeDisc and friends, toggled with one click; you can add any domain yourself.
- **Outbound firewall** — creates per-executable outbound block rules through `netsh advfirewall`, named `ShiroMecha_Block_<path hash>`, with listing and one-click removal. More thorough than hosts because it blocks by process.

> ⚠️ **Scope of Takeover Bay**: none of these modules ship, fetch or redistribute patch files, game data or download addresses. Where a file is needed, you supply it; where an address is needed, you maintain the list (in `electron/data/catalog.js` or through the Link Bay UI). The app only registers, copies, generates configs, writes library files, backs up and restores. Downloads happen in Link Bay; deployment happens here.
> The hosts and firewall features need administrator rights; without them the rest still works.
> Library registration modifies your Steam library files — **quit Steam completely before writing**. Every write leaves a restore point.

### 🔗 Link Bay

Link Bay answers "where do the files come from", in four parts:

**Source catalog** — a built-in directory of offline/repack/direct/fix sites (SteamRIP, FitGirl, DODI, GLoad, SteamUnlocked, OVA, FreeTP, ByRutGame, RuTracker, CS.RIN.RU, Online-Fix, Xatab, GOG Games, DLPS Game and about twenty in total), each tagged with type, whether the page carries direct links, region, rough speed and a risk level. Add your own sites freely.

**Link extraction** — paste a release page URL and it *reads* that page only, pulling out archive and file-host links (`.rar / .zip / .7z / .part1.rar / .iso / .torrent / magnet:` plus dozens of known host domains), de-duplicated and grouped by host. Each candidate can be probed (reachable? range support? resumable?) and sent straight to the downloader.

**Patch sources** — online fixes, Steam-free patches, DRM bypasses and plain file deploys. Every entry points at a real upstream (Goldberg/gbe_fork, Steamless, CreamAPI, SmartSteamEmu, Online-Fix) and each card carries the two big buttons you asked for: **Online fix** and **Steam-free patch**. No patch file ships with the app — the button fetches the direct link you filled in below, optionally unpacks it, and leaves deployment to Takeover Bay → Patches, which keeps a restore point.

**Acceleration lines** — a set of verified public GitHub reverse proxies (gh-proxy.com, gh.llkk.cc, ghproxy.net, ghfast.top and more), one click to probe and rank by latency, plus the official Steam CDN list to feed the Accelerator's best-IP picking.

> 🔗 **Adding your own direct links**: edit the `links: []` array of the matching entry in `electron/data/catalog.js`:
> ```js
> links: [
>   { label: 'Game pre-installed', url: 'https://your.link/game.rar', note: 'password 123' }
> ]
> ```
> Or skip the code entirely: hit "Add a link" on the card in Link Bay and it is written to your local `linkbay.json`. An empty `links` array means "not configured" — nothing is guessed and nothing errors.

> ⚠️ **Risk notice**: offline builds, cracked releases and patch bundles are endorsed by nobody. Packaging quality varies wildly between sites, and dropped miners, silent installers and stealers are an old problem in this scene; rewriting Steam library files can also trip client heuristics. None of that risk comes from this app — the app is an executor, the risk comes from the files you choose to run. Scan before you install and look at what the archive actually unpacks.

> 🔒 **About "fake library" entries**: Library registration writes **real Steam library files** (`appmanifest_<appid>.acf`, the size entry in `libraryfolders.vdf`, and the `Installed` flag in `config.vdf`), so Steam really does list the entry. Be clear on what it does *not* do: it writes metadata only. The install folder is empty. To actually play you still need the game files there — copy them in yourself or pull depots through SteamCMD. Removing the entry rolls everything back, and every write leaves a restore point.

### 🧩 Script studio

Write small utilities (batch latency checks, hosts snippets) and run them in a **restricted sandbox**:

- no filesystem, no network, no process access;
- only `shi.mecha.probeHost()`, `shi.mecha.resolveDomain()` and `shi.util.*` are exposed;
- a single run is aborted after 5 seconds.

### 🧹 Cleanup

Scans the Steam depot cache, built-in browser cache, logs, crash dumps, shader cache, the user temp folder and the app's own cache.

Each entry explains what it is and what happens if you delete it; only the safest ones are pre-selected. Files in use are skipped, never force-deleted.

### ⚙️ Also

- **Bilingual UI** (Chinese / English).
- White-and-blue mecha theme with an engineering-blueprint feel.
- Tray icon, minimise-to-tray, start accelerator on launch, mini mode.
- **All configuration is local** — plain JSON files, path visible under Settings → Data.

---

## Privacy

| Item | Status |
|---|---|
| Account system | none |
| Cloud sync | none |
| Analytics / tracking | none |
| Crash reporting | none |
| Network requests | only when you trigger a feature: official Steam endpoints, public DoH resolvers, and official or authorised download URLs |
| Local files | `config.json`, `accounts.json`, `library.json`, `launchers.json`, `scripts.json`, `vault.json`, `bypass.json`, `bypass-points.json`, `depot-sources.json`, plus the hosts and library-file backup folders |

`shared_secret` and your Steam Web API key are sensitive. Never share them and never commit them to a public repository.

---

## Download

Grab a prebuilt package from [Releases](https://github.com/Jingluohi/Shiro-Mecha-Toolkit/releases):

| Platform | File | Notes |
|---|---|---|
| Windows | `ShiroMechaToolkit-Setup-x.y.z-x64.exe` | installer, choose your own folder |
| Windows | `ShiroMechaToolkit-Portable-x.y.z-x64.exe` | portable, no install |
| Linux | `ShiroMechaToolkit-x.y.z-x86_64.AppImage` | `chmod +x` and run |
| macOS | `ShiroMechaToolkit-x.y.z-arm64.dmg` | needs your own signing, or build it yourself |

> **Writing hosts and changing the default login require elevated rights.** On Windows run as administrator; on Linux use `sudo`; on macOS the system will prompt. Without elevation the app still runs — only those two features are unavailable.

### Build from source

Node.js 18+ (20 LTS recommended).

```bash
git clone https://github.com/Jingluohi/Shiro-Mecha-Toolkit.git
cd Shiro-Mecha-Toolkit
npm install

# Development (Vite HMR + Electron)
npm run dev            # terminal A: Vite dev server (5173)
SHIRO_DEV=1 npm start  # terminal B: Electron pointed at the dev server

# Package installers
npm run dist:win
npm run dist:linux
npm run dist:mac
```

Artifacts land in `release/`. macOS packaging requires macOS; cross-building the Windows installer on Linux requires wine.

---

## Project layout

```
Shiro-Mecha-Toolkit/
├─ electron/                 # main process (Node side)
│  ├─ main.js                # windows, tray, IPC registration
│  ├─ preload.js             # contextBridge allowlist
│  ├─ data/
│  │  └─ catalog.js          # source catalog — put your direct links here
│  └─ modules/
│     ├─ config.js           # local config store
│     ├─ hosts.js            # hosts editing + DoH + best-IP picking
│     ├─ accelerator.js      # loopback proxy + PAC + system proxy
│     ├─ steam.js            # Steam store / WebAPI client
│     ├─ steamid.js          # SteamID format conversion
│     ├─ guard.js            # Steam Guard TOTP
│     ├─ accounts.js         # default-login switching
│     ├─ library.js          # game library / wishlist
│     ├─ downloader.js       # multi-threaded downloader
│     ├─ cleaner.js          # cache cleanup
│     ├─ patcher.js          # portable launch config manager
│     ├─ vault.js            # library registration: VDF/ACF editing, manifest cache, restore points
│     ├─ bypass.js           # patch centre: file deploy, config generation, hosts/firewall
│     ├─ depot.js            # sources: direct-link list, steamcmd, offline prep
│     ├─ linkbay.js          # link bay: site catalog, link extraction, patch fetch, line probing
│     ├─ scriptbox.js        # sandboxed script runner
│     └─ sysinfo.js          # machine info / Steam path detection
├─ src/                      # renderer (React)
│  ├─ components/            # AppShell, UI kit, error boundary
│  ├─ pages/                 # twelve feature pages (incl. Takeover Bay, Link Bay)
│  ├─ lib/                   # bridge, i18n, helpers
│  └─ assets/                # fonts and key visuals
├─ build/                    # packaging icons
└─ .github/workflows/        # three-platform automated builds
```

### Tech stack

- **Electron 31** with native Node modules (`http` / `https` / `net` / `crypto` / `vm`) — the core features carry no heavy dependencies
- **React 19** + **Vite** + **Tailwind CSS v3** + **Framer Motion** + **Lucide**
- **electron-builder** for all three platforms
- The renderer talks to the main process through an allowlisted **contextBridge** IPC layer: `contextIsolation: true`, `nodeIntegration: false`

---

## FAQ

**The accelerator doesn't seem to help.**
Run "Latency probe" in the Accelerator to see whether a faster IP is actually available for those domains. If your network already reaches the target directly, there is nothing to improve. If the port is taken, change it under Settings → Accelerator.

**Writing hosts fails.**
It needs elevation. Run as administrator on Windows, `sudo` on Linux, or accept the macOS prompt. Some security suites also lock the hosts file — allow the app first.

**Can hosts get corrupted?**
Every write is backed up into `hosts-backups/` in your user data directory and can be restored from the Accelerator page. The app only ever touches its own `BEGIN/END` block; your existing lines are untouched.

**Does account switching store passwords?**
No. It only flips the "which account logs in by default" flag. Steam itself keeps the password.

**Where is `shared_secret` stored?**
Only in your local `config.json`, and only if you tick "remember in local config". Untick it to remove. It is never transmitted.

**Antivirus flags it.**
False positives on Electron apps are common. All source is in this repository — build it yourself and compare.

---

## Contributing

Issues and PRs are welcome. Before submitting, please make sure:

- `npm run build` passes;
- no telemetry, ads or closed-source binaries are introduced;
- every new user-facing string ships in both Chinese and English.

---

## Licence

[MIT](./LICENSE) © 岚川怀瑾 (LanChuanHuaJin)

---

## Disclaimer

This software is provided "as is", without warranty of any kind. You are responsible for how you use it.

On safety, the line sits here: the Accelerator, hosts management, Steam Guard, SteamID, account switching, game library, downloader, cleanup, portable launch and script studio contain **no malicious code, no bundles and no telemetry**, and every line is open to audit — treat them as ordinary utilities.

**Takeover Bay** (library registration, patch deployment, verification blocking) and **Link Bay** (offline direct links, online fixes, Steam-free patches) are the high-risk half: they rewrite local Steam library files, deploy third-party files, and reach addresses you specify or the catalog lists. They are still only executors — the app contains, ships and distributes no third-party patch file, game data or copyrighted material, and it does not judge whether a file is trustworthy. **The practical risk (malware, miners, account flags, copyright) comes from the files you bring in and how you use them.** Confirm your rights, scan what you download, and follow local law and platform terms. Every write leaves a backup and a one-click rollback, which helps, but does not replace your own judgement.

The feature set was informed by the public ideas of [Watt Toolkit](https://github.com/BeyondDimension/SteamTools) and [SteamToolPlus](https://github.com/Jingluohi/SteamToolPlus); the interface and implementation here are original.
