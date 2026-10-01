'use strict';

const https = require('node:https');
const zlib = require('node:zlib');

/**
 * Steam 商店 / WebAPI 客户端。
 * 只调用 Valve 官方公开接口，不涉及任何账号密码处理。
 */

const UA = 'ShiroMechaToolkit/1.0 (+https://github.com/Jingluohi/Shiro-Mecha-Toolkit)';
const CACHE_TTL = 60 * 1000;
const cache = new Map();

function getJson(url, timeout = 12000, redirects = 3) {
  return new Promise((resolve, reject) => {
    const cached = cache.get(url);
    if (cached && Date.now() - cached.time < CACHE_TTL) return resolve(cached.data);

    const req = https.get(
      url,
      {
        timeout,
        headers: {
          'User-Agent': UA,
          'Accept-Encoding': 'gzip, deflate, br',
          Accept: 'application/json,text/plain,*/*'
        }
      },
      (res) => {
        if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location && redirects > 0) {
          res.resume();
          return resolve(getJson(res.headers.location, timeout, redirects - 1));
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode}`));
        }

        let stream = res;
        const enc = String(res.headers['content-encoding'] || '');
        if (enc.includes('br')) stream = res.pipe(zlib.createBrotliDecompress());
        else if (enc.includes('gzip')) stream = res.pipe(zlib.createGunzip());
        else if (enc.includes('deflate')) stream = res.pipe(zlib.createInflate());

        let buf = '';
        stream.setEncoding('utf8');
        stream.on('data', (c) => (buf += c));
        stream.on('end', () => {
          let data;
          try {
            data = JSON.parse(buf);
          } catch (err) {
            return reject(new Error('返回内容不是合法 JSON，可能是网络环境被干扰，请稍后重试或开启加速'));
          }
          cache.set(url, { time: Date.now(), data });
          resolve(data);
        });
        stream.on('error', reject);
      }
    );
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('请求超时，请检查网络'));
    });
    req.on('error', (err) => reject(new Error(`网络请求失败：${err.message}`)));
  });
}

const STORE = 'https://store.steampowered.com';
const API = 'https://api.steampowered.com';
const COMMUNITY = 'https://steamcommunity.com';

/* --------------------------- 商店接口 --------------------------- */

async function appDetails(appid, lang = 'schinese') {
  const id = String(appid).trim();
  if (!/^\d+$/.test(id)) throw new Error('AppID 必须是纯数字');
  const data = await getJson(`${STORE}/api/appdetails?appids=${id}&l=${lang}&cc=CN`);
  const entry = data && data[id];
  if (!entry || !entry.success) throw new Error('没有查到该游戏的商店信息（可能已下架或区域不可见）');
  return entry.data;
}

async function search(term, lang = 'schinese') {
  const data = await getJson(`${STORE}/api/storesearch/?term=${encodeURIComponent(term)}&l=${lang}&cc=CN`);
  return (data && data.items) || [];
}

async function featured(lang = 'schinese') {
  return getJson(`${STORE}/api/featuredcategories?l=${lang}&cc=CN`);
}

/** 当前免费（含限免）条目 —— 走商店搜索结果，按价格升序 */
async function freePromotions(_cc = 'CN', lang = 'schinese') {
  const url = `${STORE}/search/results/?query&start=0&count=40&maxprice=free&specials=1&infinite=1&cc=CN&l=${lang}`;
  const raw = await getJson(url);
  const results = (raw && raw.results) || {};
  const items = (results.html ? [] : results.items) || [];
  return items.map((i) => ({
    appid: i.appid || i.id,
    name: i.name,
    price: i.price,
    logo: i.tiny_image || i.logo || ''
  }));
}

async function specials(_cc = 'CN', lang = 'schinese') {
  const data = await featured(lang);
  const s = (data && data.specials) || {};
  return (s.items || []).map((i) => ({
    appid: i.id,
    name: i.name,
    discount: i.discount_percent,
    original: i.original_price,
    final: i.final_price,
    currency: i.currency,
    header: i.header_image
  }));
}

/* --------------------------- WebAPI --------------------------- */

function needKey(apiKey) {
  const key = String(apiKey || '').trim();
  if (!key) throw new Error('此功能需要你自己的 Steam Web API Key（在 https://steamcommunity.com/dev/apikey 免费申请）');
  return key;
}

function needId(steamId) {
  const id = String(steamId || '').trim();
  if (!/^\d{17}$/.test(id)) throw new Error('请先填写 17 位 SteamID64');
  return id;
}

async function playerSummary(steamId, apiKey) {
  const key = needKey(apiKey);
  const id = needId(steamId);
  const data = await getJson(`${API}/ISteamUser/GetPlayerSummaries/v2/?key=${key}&steamids=${id}`);
  const players = (data && data.response && data.response.players) || [];
  if (!players.length) throw new Error('没有查到该账号（可能不存在或资料未公开）');
  const p = players[0];
  return {
    steamId: p.steamid,
    name: p.personaname,
    avatar: p.avatarfull,
    profileUrl: p.profileurl,
    state: p.personastate,
    visibility: p.communityvisibilitystate,
    created: p.timecreated,
    country: p.loccountrycode,
    lastLogoff: p.lastlogoff
  };
}

async function ownedGames(steamId, apiKey) {
  const key = needKey(apiKey);
  const id = needId(steamId);
  const data = await getJson(
    `${API}/IPlayerService/GetOwnedGames/v1/?key=${key}&steamid=${id}&include_appinfo=1&include_played_free_games=1`
  );
  const r = (data && data.response) || {};
  return { count: r.game_count || 0, games: r.games || [] };
}

async function achievements(steamId, appid, apiKey) {
  const key = needKey(apiKey);
  const id = needId(steamId);
  const data = await getJson(
    `${API}/ISteamUserStats/GetPlayerAchievements/v1/?key=${key}&steamid=${id}&appid=${appid}&l=schinese`
  );
  const p = data && data.playerstats;
  if (!p) throw new Error('没有返回成就数据');
  if (p.error) throw new Error(p.error);
  const list = p.achievements || [];
  return {
    gameName: p.gameName,
    total: list.length,
    unlocked: list.filter((a) => a.achieved === 1).length,
    list
  };
}

/** 解析自定义链接到 SteamID64（需要 key） */
async function resolveVanity(vanity, apiKey) {
  const key = needKey(apiKey);
  const v = String(vanity || '').trim().replace(/^https?:\/\/steamcommunity\.com\/(id|profiles)\//i, '').replace(/\/.*$/, '');
  if (!v) throw new Error('请填写自定义链接名');
  const data = await getJson(`${API}/ISteamUser/ResolveVanityURL/v1/?key=${key}&vanityurl=${encodeURIComponent(v)}`);
  const r = (data && data.response) || {};
  if (r.success !== 1) throw new Error('没有找到这个自定义链接名');
  return r.steamid;
}

module.exports = {
  appDetails,
  search,
  featured,
  freePromotions,
  specials,
  playerSummary,
  ownedGames,
  achievements,
  resolveVanity,
  getJson,
  STORE,
  COMMUNITY
};
