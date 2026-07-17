/**
 * Admin handlers for revenue tracking: booking sale amounts, monthly ad
 * spend, revenue/CAC stats, and the Google Ads offline-conversion CSV feed.
 * Split out of lib/handlers.mjs (which is already oversized).
 *
 * Auth model:
 * - booking-sale / ad-spend / ad-spend-set / revenue-stats: intentionally
 *   unguarded (owner request) — the staff dashboards must load and work
 *   without pasting a token. Inputs stay strictly validated.
 * - handleAdsConversionsFeed: HTTP Basic auth because Google Ads'
 *   scheduled-upload fetcher sends username/password, not a Bearer token.
 */

import { ensureBootstrapped } from './db.mjs';
import {
  recordBookingSale,
  upsertAdSpend,
  listAdSpend,
  listConversionRows,
  getRevenueStats,
} from './sales-store.mjs';
import { buildAdsCsv } from './ads-feed.mjs';
import * as log from './log.mjs';

const BK_ID_RE = /^BK-[A-F0-9]+$/i;

function sendJson(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

function getUrl(req) {
  return new URL(req.url, `http://${req.headers.host || 'localhost'}`);
}

// --- booking sale -------------------------------------------------------------

export async function handleAdminRecordBookingSale(req, res) {
  await ensureBootstrapped();
  const body = req.body || {};
  const id = typeof body.id === 'string' ? body.id : '';
  if (!id || !BK_ID_RE.test(id)) {
    return sendJson(res, 400, { ok: false, error: 'INVALID_ID' });
  }
  try {
    const result = await recordBookingSale(id, {
      amountCents: body.amountCents,
      notes: body.notes,
    });
    if (!result.ok) {
      const code = result.error === 'INVALID_AMOUNT' ? 400 : 404;
      return sendJson(res, code, { ok: false, error: result.error });
    }
    log.info(`booking ${id} sale recorded: ${body.amountCents} cents`);
    return sendJson(res, 200, { ok: true });
  } catch (e) {
    log.error('admin record booking sale crash', e?.message || e);
    return sendJson(res, 500, { ok: false, error: e?.message || 'CRASH' });
  }
}

// --- ad spend -------------------------------------------------------------------

export async function handleAdminListAdSpend(req, res) {
  await ensureBootstrapped();
  try {
    const spend = await listAdSpend();
    return sendJson(res, 200, { ok: true, spend });
  } catch (e) {
    log.error('admin list ad spend crash', e?.message || e);
    return sendJson(res, 500, { ok: false, error: e?.message || 'CRASH' });
  }
}

export async function handleAdminSetAdSpend(req, res) {
  await ensureBootstrapped();
  const body = req.body || {};
  try {
    const result = await upsertAdSpend(body.month, body.amountCents);
    if (!result.ok) return sendJson(res, 400, { ok: false, error: result.error });
    log.info(`ad spend ${body.month} set to ${body.amountCents} cents`);
    return sendJson(res, 200, { ok: true });
  } catch (e) {
    log.error('admin set ad spend crash', e?.message || e);
    return sendJson(res, 500, { ok: false, error: e?.message || 'CRASH' });
  }
}

// --- revenue / CAC stats ---------------------------------------------------------

export async function handleAdminRevenueStats(req, res) {
  await ensureBootstrapped();
  const url = getUrl(req);
  const months = parseInt(url.searchParams.get('months') || '12', 10) || 12;
  try {
    const stats = await getRevenueStats(months);
    return sendJson(res, 200, { ok: true, months: stats });
  } catch (e) {
    log.error('admin revenue stats crash', e?.message || e);
    return sendJson(res, 500, { ok: false, error: e?.message || 'CRASH' });
  }
}

// --- Google Ads conversion feed ---------------------------------------------------

/**
 * Constant-time compare of two strings (mirrors verifyBearer's XOR loop).
 */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function verifyFeedBasicAuth(req) {
  const user = process.env.ADS_FEED_USER;
  const pass = process.env.ADS_FEED_PASS;
  if (!user || !pass || user.length < 16 || pass.length < 16) return false;
  const auth = req.headers['authorization'];
  if (typeof auth !== 'string' || !auth.startsWith('Basic ')) return false;
  let decoded;
  try {
    decoded = Buffer.from(auth.slice(6), 'base64').toString('utf8');
  } catch (_) {
    return false;
  }
  const sep = decoded.indexOf(':');
  if (sep < 0) return false;
  const gotUser = decoded.slice(0, sep);
  const gotPass = decoded.slice(sep + 1);
  // Bitwise & (not &&) so both compares always run — keeps timing uniform.
  return safeEqual(gotUser, user) & safeEqual(gotPass, pass) ? true : false;
}

/**
 * Serves the click-conversions CSV that Google Ads fetches on a daily
 * schedule (Data Manager → scheduled upload from HTTPS URL + credentials).
 * Empty feeds still return the header rows — Google treats that as
 * "no conversions today", not an error.
 */
export async function handleAdsConversionsFeed(req, res) {
  if (!verifyFeedBasicAuth(req)) {
    res.writeHead(401, {
      'content-type': 'application/json; charset=utf-8',
      'www-authenticate': 'Basic realm="ads-feed"',
      'cache-control': 'no-store',
    });
    return res.end(JSON.stringify({ ok: false, error: 'UNAUTHORIZED' }));
  }
  await ensureBootstrapped();
  try {
    const rows = await listConversionRows();
    const csv = buildAdsCsv(rows);
    res.writeHead(200, {
      'content-type': 'text/csv; charset=utf-8',
      'cache-control': 'no-store',
    });
    return res.end(csv);
  } catch (e) {
    log.error('ads conversions feed crash', e?.message || e);
    return sendJson(res, 500, { ok: false, error: 'CRASH' });
  }
}
