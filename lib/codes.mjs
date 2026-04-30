/**
 * Redemption code generation + lead-token HMAC helpers.
 *
 * Code format: GIFT-XXXXXX (6 chars from a no-ambiguity alphabet).
 * Lead tokens: short HMAC-SHA256 over the lead id, base64url-encoded.
 */

import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LEN = 6;

export function generateCode() {
  const bytes = randomBytes(CODE_LEN);
  let out = '';
  for (let i = 0; i < CODE_LEN; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return `GIFT-${out}`;
}

export function isValidCodeFormat(s) {
  return typeof s === 'string' && /^GIFT-[A-Z2-9]{6}$/.test(s);
}

function getSecret() {
  const secret = process.env.LEAD_TOKEN_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('LEAD_TOKEN_SECRET must be set (>=16 chars).');
  }
  return secret;
}

function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function signLeadToken(leadId) {
  const mac = createHmac('sha256', getSecret()).update(String(leadId)).digest();
  return base64url(mac).slice(0, 24);
}

export function verifyLeadToken(leadId, token) {
  if (typeof leadId !== 'string' || typeof token !== 'string') return false;
  const expected = signLeadToken(leadId);
  if (expected.length !== token.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(token));
  } catch {
    return false;
  }
}

export function isoDaysFromNow(days, fromMs = Date.now()) {
  return new Date(fromMs + days * 24 * 60 * 60 * 1000).toISOString();
}
