/**
 * Staff dashboard password login — pure helpers, no HTTP.
 *
 * Model: staff type a short shared password once per device (STAFF_PASSWORD).
 * On success the server sets a signed, HttpOnly session cookie that is good for
 * SESSION_DAYS. Every /api/admin/* handler accepts EITHER that cookie OR the
 * legacy `Bearer STAFF_TOKEN` header (break-glass for scripts and for getting
 * back in if the password env var is ever missing).
 *
 * The cookie carries no session store — it is `<expiry>.<HMAC(expiry)>`, so it
 * verifies statelessly on any serverless instance. Signing key preference:
 *   STAFF_SESSION_SECRET → STAFF_TOKEN → STAFF_PASSWORD
 * The first two are long random values; falling all the way back to the
 * password means a stolen cookie could be brute-forced offline to recover a
 * weak password, so keep STAFF_TOKEN set in production.
 *
 * Rotating STAFF_SESSION_SECRET (or STAFF_TOKEN, if that is the key in use)
 * signs every device out immediately. Changing STAFF_PASSWORD alone does not —
 * it only stops NEW logins with the old password.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

export const COOKIE_NAME = 'gasw_staff';
export const SESSION_DAYS = 30;
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;

/** Short enough to be memorable, long enough that the rate limiter matters. */
export const MIN_PASSWORD_LENGTH = 6;
const MIN_SIGNING_KEY_LENGTH = 16;

/* ------------------------------------------------------------------ */
/* Constant-time compare                                               */
/* ------------------------------------------------------------------ */

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  // Length is not secret here (both sides are fixed-length hex, or a password
  // whose length leaks anyway through the rate-limited login path).
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/* ------------------------------------------------------------------ */
/* Password                                                            */
/* ------------------------------------------------------------------ */

/** False when STAFF_PASSWORD is unset or too short — logins are then refused. */
export function isPasswordConfigured() {
  const pw = process.env.STAFF_PASSWORD;
  return typeof pw === 'string' && pw.length >= MIN_PASSWORD_LENGTH;
}

export function verifyStaffPassword(input) {
  if (!isPasswordConfigured()) return false;
  return safeEqual(String(input ?? ''), process.env.STAFF_PASSWORD);
}

/* ------------------------------------------------------------------ */
/* Session value: "<expiryMs>.<hmac>"                                  */
/* ------------------------------------------------------------------ */

function signingKey() {
  const key = process.env.STAFF_SESSION_SECRET
    || process.env.STAFF_TOKEN
    || process.env.STAFF_PASSWORD
    || '';
  return key.length >= MIN_SIGNING_KEY_LENGTH ? key : '';
}

function sign(payload) {
  const key = signingKey();
  if (!key) return '';
  return createHmac('sha256', key).update(payload).digest('hex');
}

/** Returns '' when no usable signing key is configured (caller must 500). */
export function createSessionValue(nowMs = Date.now()) {
  const exp = String(nowMs + SESSION_MS);
  const sig = sign(exp);
  return sig ? `${exp}.${sig}` : '';
}

export function verifySessionValue(value, nowMs = Date.now()) {
  if (typeof value !== 'string') return false;
  const dot = value.indexOf('.');
  if (dot <= 0) return false;
  const exp = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  if (!/^\d{10,16}$/.test(exp)) return false;
  const expected = sign(exp);
  if (!expected || !safeEqual(sig, expected)) return false;
  return Number(exp) > nowMs;
}

/* ------------------------------------------------------------------ */
/* Cookies                                                             */
/* ------------------------------------------------------------------ */

export function readCookie(req, name = COOKIE_NAME) {
  const raw = req?.headers?.cookie;
  if (typeof raw !== 'string') return '';
  for (const part of raw.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(eq + 1).trim());
    } catch {
      return '';
    }
  }
  return '';
}

/** HTTPS everywhere except plain-http local dev, where `Secure` would break login. */
function isSecureRequest(req) {
  const proto = req?.headers?.['x-forwarded-proto'];
  if (typeof proto === 'string' && proto.split(',')[0].trim() === 'https') return true;
  return Boolean(process.env.VERCEL);
}

function buildCookie(value, maxAgeSeconds, req) {
  const parts = [
    `${COOKIE_NAME}=${value}`,
    'Path=/',
    `Max-Age=${maxAgeSeconds}`,
    'HttpOnly',
    'SameSite=Strict',
  ];
  if (isSecureRequest(req)) parts.push('Secure');
  return parts.join('; ');
}

export function sessionCookieHeader(value, req) {
  return buildCookie(value, Math.floor(SESSION_MS / 1000), req);
}

export function clearedCookieHeader(req) {
  return buildCookie('', 0, req);
}

/** True when the request carries a valid, unexpired staff session cookie. */
export function hasStaffSession(req) {
  return verifySessionValue(readCookie(req));
}

/**
 * Legacy `Bearer STAFF_TOKEN` header. Kept so scripts, the CSV downloads, and
 * a locked-out owner still have a way in if STAFF_PASSWORD goes missing.
 */
export function hasStaffBearerToken(req) {
  const expected = process.env.STAFF_TOKEN;
  if (typeof expected !== 'string' || expected.length < MIN_SIGNING_KEY_LENGTH) return false;
  const auth = req?.headers?.['authorization'];
  if (typeof auth !== 'string') return false;
  return safeEqual(auth, `Bearer ${expected}`);
}

/** The single auth predicate every /api/admin/* handler uses. */
export function isStaffAuthed(req) {
  return hasStaffSession(req) || hasStaffBearerToken(req);
}

/* ------------------------------------------------------------------ */
/* Login rate limit (per instance, best effort)                        */
/* ------------------------------------------------------------------ */

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map();   // ip -> { count, firstMs }

function prune(nowMs) {
  for (const [ip, rec] of attempts) {
    if (nowMs - rec.firstMs > WINDOW_MS) attempts.delete(ip);
  }
}

export function clientIp(req) {
  const fwd = req?.headers?.['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
  return req?.socket?.remoteAddress || 'unknown';
}

/**
 * Serverless instances do not share this map, so it slows a brute force rather
 * than stopping one. Good enough paired with a login-only attack surface.
 */
export function checkLoginRate(ip, nowMs = Date.now()) {
  prune(nowMs);
  const rec = attempts.get(ip);
  if (!rec) return { allowed: true, retryAfterSec: 0 };
  if (rec.count < MAX_ATTEMPTS) return { allowed: true, retryAfterSec: 0 };
  return {
    allowed: false,
    retryAfterSec: Math.max(1, Math.ceil((rec.firstMs + WINDOW_MS - nowMs) / 1000)),
  };
}

export function recordLoginFailure(ip, nowMs = Date.now()) {
  prune(nowMs);
  const rec = attempts.get(ip);
  if (!rec) {
    attempts.set(ip, { count: 1, firstMs: nowMs });
    return;
  }
  attempts.set(ip, { count: rec.count + 1, firstMs: rec.firstMs });
}

export function clearLoginFailures(ip) {
  attempts.delete(ip);
}

/** Test-only: drop all recorded attempts. */
export function resetLoginRateLimit() {
  attempts.clear();
}
