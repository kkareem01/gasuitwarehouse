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
  handleGetBooking,
  handleGetBookingIcs,
} from './lib/handlers.mjs';
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

  const filePath = join(ROOT, relPath);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  const s = await stat(filePath).catch(() => null);
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

      const icsMatch = path.match(/^\/api\/bookings\/([A-Za-z0-9-]+)\/ics$/);
      if (req.method === 'GET' && icsMatch) return handleGetBookingIcs(req, res, icsMatch[1]);

      const idMatch = path.match(/^\/api\/bookings\/([A-Za-z0-9-]+)$/);
      if (req.method === 'GET' && idMatch) return handleGetBooking(req, res, idMatch[1]);

      res.writeHead(404, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, error: 'Not found.' }));
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
