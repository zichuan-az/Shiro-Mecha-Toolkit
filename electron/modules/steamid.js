'use strict';

/**
 * SteamID 格式互转 + 账号定位
 * 支持：SteamID64 / STEAM_X:Y:Z / [U:1:accountId] / 好友码 / 个人主页链接
 * 纯本地计算，不联网、不上传。
 */

const BASE = 76561197960265728n; // 76561197960265728 = 0x110000100000000

function toBigInt(v) {
  try {
    return BigInt(String(v).trim());
  } catch (_) {
    return null;
  }
}

function isId64(n) {
  return n !== null && n >= 76561197960265728n && n <= 76561209999999999n;
}

function build(id64) {
  const accountId = id64 - BASE;
  const y = accountId % 2n;
  const z = (accountId - y) / 2n;
  const hex = id64.toString(16).toUpperCase().padStart(16, '0');
  return {
    id64: id64.toString(),
    accountId: accountId.toString(),
    steam2: `STEAM_1:${y.toString()}:${z.toString()}`,
    steam3: `[U:1:${accountId.toString()}]`,
    friendCode: accountId.toString(),
    hex,
    profileUrl: `https://steamcommunity.com/profiles/${id64.toString()}`
  };
}

function parse(input) {
  const raw = String(input || '').trim();
  if (!raw) throw new Error('请输入要转换的 SteamID、好友码或主页链接');

  // 主页链接
  const link = raw.match(/steamcommunity\.com\/(profiles|id)\/([^/?#\s]+)/i);
  if (link) {
    if (link[1].toLowerCase() === 'profiles') {
      const n = toBigInt(link[2]);
      if (isId64(n)) return { ...build(n), source: 'profile-link' };
      throw new Error('链接里的数字不是合法的 SteamID64');
    }
    return {
      vanity: link[2],
      source: 'vanity-link',
      needApiKey: true,
      message: '这是自定义链接地址，需要 Steam Web API Key 才能解析成 SteamID64'
    };
  }

  // STEAM_X:Y:Z
  const s2 = raw.match(/^STEAM_[0-5]:([01]):(\d+)$/i);
  if (s2) {
    const y = BigInt(s2[1]);
    const z = BigInt(s2[2]);
    const id64 = BASE + z * 2n + y;
    return { ...build(id64), source: 'steam2' };
  }

  // [U:1:accountId]
  const s3 = raw.match(/^\[?U:1:(\d+)\]?$/i);
  if (s3) {
    const id64 = BASE + BigInt(s3[1]);
    return { ...build(id64), source: 'steam3' };
  }

  // 纯数字
  const n = toBigInt(raw);
  if (n !== null) {
    if (isId64(n)) return { ...build(n), source: 'steamid64' };
    // 视作好友码 / accountId
    if (n >= 0n && n < BASE) return { ...build(BASE + n), source: 'friend-code' };
    if (n >= 0n && n < 4294967295n) return { ...build(BASE + n), source: 'account-id' };
    throw new Error('这个数字既不是 SteamID64 也不像好友码，请检查是否复制完整');
  }

  // 纯用户名 → 当作自定义链接名
  if (/^[A-Za-z0-9_-]{2,64}$/.test(raw)) {
    return {
      vanity: raw,
      source: 'vanity',
      needApiKey: true,
      message: '看起来是自定义链接名，需要 Steam Web API Key 才能解析'
    };
  }

  throw new Error('无法识别的格式，请粘贴 SteamID64、STEAM_X:Y:Z、[U:1:xxx] 或主页链接');
}

async function resolveVanity(vanity, apiKey) {
  const steam = require('./steam');
  const id = await steam.resolveVanity(vanity, apiKey);
  return { ...build(BigInt(id)), source: 'vanity-resolved', vanity };
}

module.exports = { parse, resolveVanity, build, BASE: BASE.toString() };
