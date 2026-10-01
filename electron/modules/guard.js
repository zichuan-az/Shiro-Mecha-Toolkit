'use strict';

const crypto = require('node:crypto');

/**
 * Steam Guard 手机令牌（TOTP 变体）
 *
 * 说明：
 *   Steam 的两步验证码是标准 TOTP 的变体，用 HMAC-SHA1 做动态截断，
 *   再把结果映射到 Steam 自己的 26 字符表上，最后取 5 位。
 *   本模块只负责「用你本机保存的 shared_secret 算出当前验证码」，
 *   计算全部在本机内存里完成，不联网、不上传。
 *
 *   ⚠️ shared_secret 属于你的账号敏感信息（等同于手机验证器），
 *      请勿分享给任何人，也不要放进公开仓库。
 */

const CHARS = '23456789BCDFGHJKMNPQRTVWXY';
const PERIOD = 30;

function decodeSecret(sharedSecret) {
  const cleaned = String(sharedSecret || '').trim().replace(/\s+/g, '');
  if (!cleaned) throw new Error('请填写 shared_secret');
  let buf;
  try {
    buf = Buffer.from(cleaned, 'base64');
  } catch (_) {
    throw new Error('shared_secret 不是合法的 base64 字符串');
  }
  if (buf.length < 10) throw new Error('shared_secret 长度不对，请检查是否复制完整');
  return buf;
}

function hotp(secret, timeStep) {
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(timeStep / 0x100000000), 0);
  buf.writeUInt32BE(timeStep % 0x100000000, 4);

  const hmac = crypto.createHmac('sha1', secret).update(buf).digest();
  const offset = hmac[19] & 0x0f;
  let code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  let out = '';
  for (let i = 0; i < 5; i++) {
    out += CHARS[code % CHARS.length];
    code = Math.floor(code / CHARS.length);
  }
  return out;
}

function timeStep(offset = 0) {
  return Math.floor(Date.now() / 1000 / PERIOD) + Number(offset || 0);
}

/**
 * @param {string} sharedSecret base64 的 shared_secret
 * @param {number} offset 时间偏移（步数），默认 0
 */
function code(sharedSecret, offset = 0) {
  const secret = decodeSecret(sharedSecret);
  const step = timeStep(offset);
  const value = hotp(secret, step);
  const now = Date.now() / 1000;
  const elapsed = now % PERIOD;
  return {
    code: value,
    offset: Number(offset || 0),
    secondsRemaining: Math.max(0, Math.ceil(PERIOD - elapsed)),
    period: PERIOD,
    progress: 1 - elapsed / PERIOD,
    // 前后各给一个，方便时钟有偏差时对照
    neighbours: [
      { offset: -1, code: hotp(secret, step - 1) },
      { offset: 0, code: hotp(secret, step) },
      { offset: 1, code: hotp(secret, step + 1) }
    ],
    generatedAt: Date.now()
  };
}

function validateSecret(sharedSecret) {
  try {
    const secret = decodeSecret(sharedSecret);
    return {
      valid: true,
      length: secret.length,
      preview: `${String(sharedSecret).slice(0, 4)}****${String(sharedSecret).slice(-4)}`
    };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

module.exports = { code, validateSecret, CHARS, PERIOD };
