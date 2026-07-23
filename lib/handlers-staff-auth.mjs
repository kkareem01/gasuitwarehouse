/**
 * HTTP handlers for the staff password gate:
 *   POST /api/admin/login    { password }  → sets the session cookie
 *   POST /api/admin/logout                 → clears it
 *   GET  /api/admin/session                → { authed, configured } for the UI
 *
 * Crypto and cookie mechanics live in lib/staff-auth.mjs; this file is only the
 * request/response shell. Kept out of lib/handlers.mjs, which is already large.
 */

import {
  isPasswordConfigured,
  verifyStaffPassword,
  createSessionValue,
  sessionCookieHeader,
  clearedCookieHeader,
  isStaffAuthed,
  checkLoginRate,
  recordLoginFailure,
  clearLoginFailures,
  clientIp,
  SESSION_DAYS,
} from './staff-auth.mjs';
import * as log from './log.mjs';

function sendJson(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

/** Blunts timing/rapid-fire guessing without making a correct login feel slow. */
function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function handleStaffLogin(req, res) {
  const ip = clientIp(req);
  const rate = checkLoginRate(ip);
  if (!rate.allowed) {
    res.setHeader('retry-after', String(rate.retryAfterSec));
    return sendJson(res, 429, {
      ok: false,
      error: 'TOO_MANY_ATTEMPTS',
      retryAfterSec: rate.retryAfterSec,
    });
  }

  if (!isPasswordConfigured()) {
    log.error('staff login attempted but STAFF_PASSWORD is unset or too short');
    return sendJson(res, 503, { ok: false, error: 'PASSWORD_NOT_CONFIGURED' });
  }

  const body = req.body || {};
  const password = typeof body.password === 'string' ? body.password : '';

  if (!verifyStaffPassword(password)) {
    recordLoginFailure(ip);
    await pause(400);
    log.warn(`staff login failed from ${ip}`);
    return sendJson(res, 401, { ok: false, error: 'BAD_PASSWORD' });
  }

  const value = createSessionValue();
  if (!value) {
    // No signing key ≥16 chars available — refuse rather than issue a forgeable cookie.
    log.error('staff login blocked: no STAFF_SESSION_SECRET / STAFF_TOKEN to sign with');
    return sendJson(res, 503, { ok: false, error: 'SESSION_SECRET_NOT_CONFIGURED' });
  }

  clearLoginFailures(ip);
  res.setHeader('set-cookie', sessionCookieHeader(value, req));
  log.info(`staff login ok from ${ip}`);
  return sendJson(res, 200, { ok: true, authed: true, days: SESSION_DAYS });
}

export async function handleStaffLogout(req, res) {
  res.setHeader('set-cookie', clearedCookieHeader(req));
  return sendJson(res, 200, { ok: true, authed: false });
}

export async function handleStaffSession(req, res) {
  return sendJson(res, 200, {
    ok: true,
    authed: isStaffAuthed(req),
    configured: isPasswordConfigured(),
  });
}
