/**
 * Admin handlers for revenue tracking: booking sale amounts, walk-in sales,
 * monthly ad spend, revenue/CAC stats, and the Google Ads offline-conversion
 * CSV feed. Split out of lib/handlers.mjs (which is already oversized).
 *
 * Every handler is staff-token guarded except handleAdsConversionsFeed,
 * which uses HTTP Basic auth because Google Ads' scheduled-upload fetcher
 * sends username/password, not a Bearer token.
 */

import { ensureBootstrapped } from './db.mjs';
import { verifyStaffAuth, staffUnauthorized } from './handlers.mjs';
import {
  recordBookingSale,
  createWalkinSale,
  listWalkinSales,
  updateWalkinSale,
  deleteWalkinSale,
  upsertAdSpend,
  listAdSpend,
  listConversionRows,
  getRevenueStats,
} from './sales-store.mjs';
import { buildAdsCsv } from './ads-feed.mjs';
import { newWalkinId } from './id.mjs';
import * as log from './log.mjs';

const BK_ID_RE = /^BK-[A-F0-9]+$/i;
const WS_ID_RE = /^WS-[A-F0-9]+$/i;

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
  if (!verifyStaffAuth(req)) return staffUnauthorized(res);
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

// --- walk-in sales ------------------------------------------------------------

export async function handleAdminListWalkins(req, res) {
  if (!verifyStaffAuth(req)) return staffUnauthorized(res);
  await ensureBootstrapped();
  const url = getUrl(req);
  const month = url.searchParams.get('month') || undefined;
  const limit = parseInt(url.searchParams.get('limit') || '200', 10) || 200;
  try {
    const sales = await listWalkinSales({ month, limit });
    return sendJson(res, 200, { ok: true, sales });
  } catch (e) {
    log.error('admin list walkins crash', e?.message || e);
    return sendJson(res, 500, { ok: false, error: e?.message || 'CRASH' });
  }
}

export async function handleAdminCreateWalkin(req, res) {
  if (!verifyStaffAuth(req)) return staffUnauthorized(res);
  await ensureBootstrapped();
  const body = req.body || {};
  try {
    const result = await createWalkinSale(
      { amountCents: body.amountCents, note: body.note, saleDate: body.saleDate },
      newWalkinId
    );
    if (!result.ok) return sendJson(res, 400, { ok: false, error: result.error });
    log.info(`walk-in sale ${result.sale.id} logged: ${result.sale.amountCents} cents`);
    return sendJson(res, 200, { ok: true, data: result.sale });
  } catch (e) {
    log.error('admin create walkin crash', e?.message || e);
    return sendJson(res, 500, { ok: false, error: e?.message || 'CRASH' });
  }
}

export async function handleAdminEditWalkin(req, res) {
  if (!verifyStaffAuth(req)) return staffUnauthorized(res);
  await ensureBootstrapped();
  const body = req.body || {};
  const id = typeof body.id === 'string' ? body.id : '';
  if (!id || !WS_ID_RE.test(id)) {
    return sendJson(res, 400, { ok: false, error: 'INVALID_ID' });
  }
  const fields = {};
  if ('amountCents' in body) fields.amountCents = body.amountCents;
  if ('note' in body) fields.note = body.note;
  if ('saleDate' in body) fields.saleDate = body.saleDate;
  try {
    const result = await updateWalkinSale(id, fields);
    if (!result.ok) {
      const code = result.error === 'NOT_FOUND' ? 404 : 400;
      return sendJson(res, code, { ok: false, error: result.error });
    }
    log.info(`walk-in sale ${id} edited fields: ${Object.keys(fields).join(',')}`);
    return sendJson(res, 200, { ok: true });
  } catch (e) {
    log.error('admin edit walkin crash', e?.message || e);
    return sendJson(res, 500, { ok: false, error: e?.message || 'CRASH' });
  }
}

export async function handleAdminDeleteWalkin(req, res) {
  if (!verifyStaffAuth(req)) return staffUnauthorized(res);
  await ensureBootstrapped();
  const body = req.body || {};
  const id = typeof body.id === 'string' ? body.id : '';
  if (!id || !WS_ID_RE.test(id)) {
    return sendJson(res, 400, { ok: false, error: 'INVALID_ID' });
  }
  try {
    const result = await deleteWalkinSale(id);
    if (!result.ok) return sendJson(res, 404, { ok: false, error: result.error });
    log.info(`walk-in sale ${id} deleted`);
    return sendJson(res, 200, { ok: true });
  } catch (e) {
    log.error('admin delete walkin crash', e?.message || e);
    return sendJson(res, 500, { ok: false, error: e?.message || 'CRASH' });
  }
}

// --- ad spend -------------------------------------------------------------------

export async function handleAdminListAdSpend(req, res) {
  if (!verifyStaffAuth(req)) return staffUnauthorized(res);
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
  if (!verifyStaffAuth(req)) return staffUnauthorized(res);
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
  if (!verifyStaffAuth(req)) return staffUnauthorized(res);
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
