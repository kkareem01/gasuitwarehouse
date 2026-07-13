/**
 * GA Suit Warehouse — local development server.
 *
 * Single source of truth for API behavior is lib/handlers.mjs (also used by
 * the /api/* serverless functions on Vercel). This file just:
 *   - parses request bodies (Vercel does this for you in production)
 *   - serves static files (Vercel does this for you in production)
 *   - wires URL paths to the right handler
 *
 * Run: npm start  (or: node --env-file=.env server.mjs)
 * Requires Node 20.6+
 */

import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { AUDIENCES, fieldNames } from './lib/audiences.mjs';
import {
  handleConfig,
  handleAvailability,
  handleAvailabilityMonth,
  handleCreateLead,
  handleCreateBooking,
  handleCreateIntake,
  handleGetBooking,
  handleGetBookingIcs,
  handleLeadMagnetOptIn,
  handleGetActiveOffer,
  handleLeadLookup,
  handleCronNurtureT3,
  handleCronNurtureT1,
  handleCronNurtureDayOf,
  handleCronExpireCodes,
  handleCronRotateOffer,
  handleAdminLookupCode,
  handleAdminRedeem,
  handleAdminFunnelStats,
  handleAdminListIntakes,
  handleAdminUpdateIntake,
  handleAdminEditIntake,
  handleAdminDeleteIntake,
  handleAdminNotifyIntakeReady,
  handleAdminListSpecialOrders,
  handleAdminCreateSpecialOrder,
  handleAdminEditSpecialOrder,
  handleAdminUpdateSpecialOrderStatus,
  handleAdminDeleteSpecialOrder,
  handleAdminNotifySpecialOrderArrived,
  handleAdminListBookings,
  handleAdminBookingsCount,
  handleAdminUpdateBookingStatus,
  handleAdminEditBooking,
  handleAdminDeleteBooking,
} from './lib/handlers.mjs';
import {
  handleAdminRecordBookingSale,
  handleAdminListWalkins,
  handleAdminCreateWalkin,
  handleAdminEditWalkin,
  handleAdminDeleteWalkin,
  handleAdminListAdSpend,
  handleAdminSetAdSpend,
  handleAdminRevenueStats,
  handleAdsConversionsFeed,
} from './lib/handlers-sales.mjs';
import * as log from './lib/log.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.txt':  'text/plain; charset=utf-8',
  '.pdf':  'application/pdf',
};

async function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > limit) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (raw.length === 0) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

async function serveStatic(req, res, urlPath) {
  let relPath = normalize(urlPath).replace(/^[/\\]+/, '');
  if (relPath === '' || relPath.endsWith('/')) relPath = join(relPath, 'index.html');

  let filePath = join(ROOT, relPath);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  let s = await stat(filePath).catch(() => null);
  // Mirror vercel.json `cleanUrls: true` locally: if /foo doesn't resolve, try /foo.html
  if ((!s || !s.isFile()) && !extname(filePath)) {
    const htmlPath = filePath + '.html';
    const s2 = await stat(htmlPath).catch(() => null);
    if (s2 && s2.isFile()) { filePath = htmlPath; s = s2; }
  }
  if (!s || !s.isFile()) {
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(`<h1>404</h1><p>${relPath}</p>`);
  }

  const buf = await readFile(filePath);
  res.writeHead(200, {
    'content-type': MIME[extname(filePath).toLowerCase()] || 'application/octet-stream',
    'cache-control': 'no-store',
  });
  res.end(buf);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const path = url.pathname;

    if (path.startsWith('/api/')) {
      // Mirror Vercel: parse JSON body and attach as req.body before invoking handler.
      if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
        try {
          req.body = await readBody(req);
        } catch (e) {
          res.writeHead(400, { 'content-type': 'application/json' });
          return res.end(JSON.stringify({ ok: false, error: e.message }));
        }
      }

      if (req.method === 'GET' && path === '/api/config') return handleConfig(req, res);
      if (req.method === 'GET' && path === '/api/availability') return handleAvailability(req, res);
      if (req.method === 'GET' && path === '/api/availability/month') return handleAvailabilityMonth(req, res);
      if (req.method === 'POST' && path === '/api/leads') return handleCreateLead(req, res);
      if (req.method === 'POST' && path === '/api/bookings') return handleCreateBooking(req, res);
      if (req.method === 'POST' && path === '/api/intake') return handleCreateIntake(req, res);
      if (req.method === 'GET' && path === '/api/leads/lookup') return handleLeadLookup(req, res);
      if (req.method === 'POST' && path === '/api/lead-magnet/opt-in') return handleLeadMagnetOptIn(req, res);
      if (req.method === 'GET' && path === '/api/lead-magnet/active-offer') return handleGetActiveOffer(req, res);

      // Crons accept GET (Vercel default) AND POST (manual local trigger).
      const cronMethods = req.method === 'GET' || req.method === 'POST';
      if (cronMethods && path === '/api/cron/nurture-t3')    return handleCronNurtureT3(req, res);
      if (cronMethods && path === '/api/cron/nurture-t1')    return handleCronNurtureT1(req, res);
      if (cronMethods && path === '/api/cron/nurture-dayof') return handleCronNurtureDayOf(req, res);
      if (cronMethods && path === '/api/cron/expire-codes')  return handleCronExpireCodes(req, res);
      if (cronMethods && path === '/api/cron/rotate-offer')  return handleCronRotateOffer(req, res);

      if (req.method === 'GET'  && path === '/api/admin/lookup-code')  return handleAdminLookupCode(req, res);
      if (req.method === 'POST' && path === '/api/admin/redeem')       return handleAdminRedeem(req, res);
      if (req.method === 'GET'  && path === '/api/admin/funnel-stats') return handleAdminFunnelStats(req, res);
      if (req.method === 'GET'  && path === '/api/admin/intakes')      return handleAdminListIntakes(req, res);
      if (req.method === 'POST' && path === '/api/admin/intake-status') return handleAdminUpdateIntake(req, res);
      if (req.method === 'POST' && path === '/api/admin/intake-edit') return handleAdminEditIntake(req, res);
      if (req.method === 'POST' && path === '/api/admin/intake-delete') return handleAdminDeleteIntake(req, res);
      if (req.method === 'POST' && path === '/api/admin/intake-notify-ready') return handleAdminNotifyIntakeReady(req, res);
      if (req.method === 'GET'  && path === '/api/admin/special-orders')             return handleAdminListSpecialOrders(req, res);
      if (req.method === 'POST' && path === '/api/admin/special-order-create')       return handleAdminCreateSpecialOrder(req, res);
      if (req.method === 'POST' && path === '/api/admin/special-order-edit')         return handleAdminEditSpecialOrder(req, res);
      if (req.method === 'POST' && path === '/api/admin/special-order-status')       return handleAdminUpdateSpecialOrderStatus(req, res);
      if (req.method === 'POST' && path === '/api/admin/special-order-delete')       return handleAdminDeleteSpecialOrder(req, res);
      if (req.method === 'POST' && path === '/api/admin/special-order-notify-arrived') return handleAdminNotifySpecialOrderArrived(req, res);
      if (req.method === 'GET'  && path === '/api/admin/bookings')        return handleAdminListBookings(req, res);
      if (req.method === 'GET'  && path === '/api/admin/bookings-count')  return handleAdminBookingsCount(req, res);
      if (req.method === 'POST' && path === '/api/admin/booking-status')  return handleAdminUpdateBookingStatus(req, res);
      if (req.method === 'POST' && path === '/api/admin/booking-edit')    return handleAdminEditBooking(req, res);
      if (req.method === 'POST' && path === '/api/admin/booking-delete')  return handleAdminDeleteBooking(req, res);
      if (req.method === 'POST' && path === '/api/admin/booking-sale')    return handleAdminRecordBookingSale(req, res);
      if (req.method === 'GET'  && path === '/api/admin/walkins')         return handleAdminListWalkins(req, res);
      if (req.method === 'POST' && path === '/api/admin/walkin-create')   return handleAdminCreateWalkin(req, res);
      if (req.method === 'POST' && path === '/api/admin/walkin-edit')     return handleAdminEditWalkin(req, res);
      if (req.method === 'POST' && path === '/api/admin/walkin-delete')   return handleAdminDeleteWalkin(req, res);
      if (req.method === 'GET'  && path === '/api/admin/ad-spend')        return handleAdminListAdSpend(req, res);
      if (req.method === 'POST' && path === '/api/admin/ad-spend-set')    return handleAdminSetAdSpend(req, res);
      if (req.method === 'GET'  && path === '/api/admin/revenue-stats')   return handleAdminRevenueStats(req, res);
      if (req.method === 'GET'  && path === '/api/admin/ads-conversions') return handleAdsConversionsFeed(req, res);

      const icsMatch = path.match(/^\/api\/bookings\/([A-Za-z0-9-]+)\/ics$/);
      if (req.method === 'GET' && icsMatch) return handleGetBookingIcs(req, res, icsMatch[1]);

      const idMatch = path.match(/^\/api\/bookings\/([A-Za-z0-9-]+)$/);
      if (req.method === 'GET' && idMatch) return handleGetBooking(req, res, idMatch[1]);

      res.writeHead(404, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, error: 'Not found.' }));
    }

    // Mirror the vercel.json rewrite for Google Ads' scheduled uploader.
    if (req.method === 'GET' && path === '/feeds/ads-conversions.csv') {
      return handleAdsConversionsFeed(req, res);
    }

    return serveStatic(req, res, decodeURIComponent(path));
  } catch (e) {
    log.error('unhandled', e?.message || e);
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end(`Server error: ${e?.message || 'unknown'}`);
  }
});

async function guardSchemaDrift() {
  try {
    const front = await readFile(join(ROOT, 'assets/js/booking-form.js'), 'utf8');
    for (const audience of AUDIENCES) {
      for (const name of fieldNames(audience)) {
        if (!front.includes(`name: '${name}'`) && !front.includes(`name: "${name}"`)) {
          log.warn(`schema drift: field "${name}" (audience ${audience}) not present in assets/js/booking-form.js`);
        }
      }
    }
  } catch (e) {
    log.warn('schema drift check skipped:', e.message);
  }
}

server.listen(PORT, async () => {
  await guardSchemaDrift();
  const dryRun = process.env.DRY_RUN_EMAIL === 'true';
  log.info(`GA Suit Warehouse → http://localhost:${PORT}${dryRun ? ' (DRY_RUN_EMAIL=true)' : ''}`);
});
