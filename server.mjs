/**
 * GA Suit Warehouse — booking server.
 * - Static file server (replaces serve.mjs)
 * - /api routes for availability, leads, and bookings
 *
 * Run: node --env-file=.env server.mjs   (requires Node 20.6+)
 */

import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { FIELD_SCHEMAS, AUDIENCES, fieldNames, isValidAudience } from './lib/audiences.mjs';
import { validateBookingPayload, validateLeadPayload } from './lib/validate.mjs';
import {
  generateSlotsForDate,
  filterAvailableSlots,
  listMonth,
  daysInMonth,
} from './lib/slots.mjs';
import {
  findBookingById,
  listBookingsBySlot,
  listBookingsByMonth,
  createBooking,
  createLead,
  updateBookingEmailStatus,
} from './lib/store.mjs';
import { newBookingId, newLeadId } from './lib/id.mjs';
import { buildICS } from './lib/ics.mjs';
import { sendEmail, customerConfirmationEmail, ownerNotificationEmail } from './lib/email.mjs';
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

// --- config -----------------------------------------------------------------
let cachedConfig = null;
async function loadConfig() {
  if (cachedConfig) return cachedConfig;
  const raw = await readFile(join(ROOT, 'data/config.json'), 'utf8');
  cachedConfig = JSON.parse(raw);
  return cachedConfig;
}

function publicConfig(cfg) {
  return {
    storeTimezone: cfg.storeTimezone,
    businessHours: cfg.businessHours,
    blackoutDates: cfg.blackoutDates,
    defaultSlotDurationMinutes: cfg.defaultSlotDurationMinutes,
    fittingTypes: cfg.fittingTypes,
    urgencyTimerSeconds: cfg.urgencyTimerSeconds,
    leadTimeMinutes: cfg.leadTimeMinutes,
    maxAdvanceDays: cfg.maxAdvanceDays,
  };
}

// --- helpers ----------------------------------------------------------------
function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

function ok(data) {
  return { ok: true, data };
}
function err(message, code) {
  return { ok: false, error: message, code: code ?? null };
}

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
      } catch (e) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

// --- rate limit (in-memory) -------------------------------------------------
const RATE_LIMITS = new Map(); // ip -> { count, resetAt }
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(ip) {
  const now = Date.now();
  const cur = RATE_LIMITS.get(ip);
  if (!cur || cur.resetAt < now) {
    RATE_LIMITS.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (cur.count >= RATE_LIMIT_MAX) return false;
  cur.count += 1;
  return true;
}

// --- API handlers -----------------------------------------------------------

async function handleConfig(req, res) {
  const cfg = await loadConfig();
  sendJson(res, 200, ok(publicConfig(cfg)));
}

async function handleAvailability(req, res, url) {
  const date = url.searchParams.get('date');
  const audience = url.searchParams.get('audience');
  if (!date || !isValidAudience(audience)) {
    return sendJson(res, 400, err('Missing or invalid date / audience.'));
  }
  const cfg = await loadConfig();
  const all = generateSlotsForDate(date, cfg, audience);
  const booked = await listBookingsBySlot(date, audience);
  const bookedTimes = new Set(booked.map((b) => b.slot.time));
  const available = filterAvailableSlots(all, bookedTimes, date, cfg);
  const slots = all.map((time) => ({
    time,
    available: available.includes(time),
  }));
  sendJson(res, 200, ok({ date, audience, slots }));
}

async function handleAvailabilityMonth(req, res, url) {
  const year = parseInt(url.searchParams.get('year') || '', 10);
  const month = parseInt(url.searchParams.get('month') || '', 10);
  const audience = url.searchParams.get('audience');
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12 || !isValidAudience(audience)) {
    return sendJson(res, 400, err('Missing or invalid year / month / audience.'));
  }
  const cfg = await loadConfig();
  const all = await listBookingsByMonth(year, month, audience);
  const map = new Map();
  for (const b of all) {
    if (!map.has(b.slot.date)) map.set(b.slot.date, new Set());
    map.get(b.slot.date).add(b.slot.time);
  }
  const days = listMonth(year, month, cfg, audience, map);
  sendJson(res, 200, ok({ year, month, audience, days }));
}

async function handleCreateLead(req, res) {
  const body = await readBody(req);
  const v = validateLeadPayload(body);
  if (!v.ok) return sendJson(res, 400, err(v.errors.join(' ')));

  const ip = clientIp(req);
  const userAgent = (req.headers['user-agent'] || '').slice(0, 200);

  const result = await createLead(
    {
      audience: v.value.audience,
      firstName: v.value.firstName,
      lastName: v.value.lastName,
      phone: v.value.phone,
      consent: v.value.consent,
      ip,
      userAgent,
    },
    newLeadId
  );

  if (!result.ok) return sendJson(res, 500, err('Could not save lead.'));
  log.info(`lead captured ${result.lead.id} audience=${v.value.audience}`);
  sendJson(res, 200, ok({ leadId: result.lead.id }));
}

async function handleCreateBooking(req, res) {
  const ip = clientIp(req);
  if (!checkRateLimit(ip)) {
    return sendJson(res, 429, err('Too many bookings from your network. Try again later.'));
  }

  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    return sendJson(res, 400, err(e.message));
  }

  const v = validateBookingPayload(body);
  if (!v.ok) return sendJson(res, 400, err(v.errors.join(' ')));

  const cfg = await loadConfig();
  const audience = v.value.audience;
  const fitting = cfg.fittingTypes[audience];
  const durationMinutes = fitting?.slotDurationMinutes ?? cfg.defaultSlotDurationMinutes ?? 20;

  // Confirm slot is currently in the available set BEFORE writing.
  const allSlots = generateSlotsForDate(v.value.slot.date, cfg, audience);
  if (!allSlots.includes(v.value.slot.time)) {
    return sendJson(res, 409, err('That slot is no longer available.', 'SLOT_TAKEN'));
  }
  const taken = await listBookingsBySlot(v.value.slot.date, audience);
  const open = filterAvailableSlots(allSlots, new Set(taken.map((b) => b.slot.time)), v.value.slot.date, cfg);
  if (!open.includes(v.value.slot.time)) {
    return sendJson(res, 409, err('That slot is no longer available.', 'SLOT_TAKEN'));
  }

  const record = {
    audience,
    customer: v.value.customer,
    answers: v.value.answers,
    slot: {
      date: v.value.slot.date,
      time: v.value.slot.time,
      durationMinutes,
      tz: cfg.storeTimezone,
    },
    displayTimezone: v.value.timezone,
    consent: true,
    leadId: typeof body.leadId === 'string' ? body.leadId : null,
    ip,
    userAgent: (req.headers['user-agent'] || '').slice(0, 200),
    emailStatus: 'pending',
  };

  const result = await createBooking(record, newBookingId);
  if (!result.ok) {
    if (result.error === 'SLOT_TAKEN') {
      return sendJson(res, 409, err('That slot is no longer available.', 'SLOT_TAKEN'));
    }
    return sendJson(res, 500, err('Could not save booking.'));
  }

  log.info(`booking created ${result.booking.id} ${audience} ${v.value.slot.date} ${v.value.slot.time}`);

  // Fire emails. Failures don't block the booking.
  fireEmails(result.booking, cfg).catch((e) => log.error('email pipeline crash', e.message));

  return sendJson(res, 200, ok({
    id: result.booking.id,
    slot: result.booking.slot,
    customer: result.booking.customer,
  }));
}

async function fireEmails(booking, cfg) {
  const businessName = process.env.BUSINESS_NAME || 'GA Suit Warehouse';
  const businessAddress = process.env.BUSINESS_ADDRESS || '150 Pearl Nix Pkwy, Gainesville GA 30501';
  const businessPhone = process.env.BUSINESS_PHONE || '+14705957775';
  const fromEmail = process.env.FROM_EMAIL || 'bookings@example.com';
  const ownerEmail = process.env.OWNER_EMAIL;
  const siteUrl = process.env.SITE_URL || `http://localhost:${PORT}`;
  const audienceLabel = cfg.fittingTypes?.[booking.audience]?.label || booking.audience;
  const confirmUrl = `${siteUrl}/booking-confirmed.html?id=${booking.id}`;

  const ics = buildICS({
    id: booking.id,
    slot: booking.slot,
    durationMinutes: booking.slot.durationMinutes,
    tz: booking.slot.tz,
    summary: `${audienceLabel} at ${businessName}`,
    description: `Your fitting at ${businessName}. Reference: ${booking.id}.\n${confirmUrl}`,
    location: businessAddress,
  });

  const customer = customerConfirmationEmail({
    booking,
    businessName,
    businessAddress,
    businessPhone,
    confirmUrl,
  });
  const owner = ownerNotificationEmail({
    booking,
    audienceLabel,
    businessName,
  });

  const sends = [
    sendEmail({
      to: booking.customer.email,
      from: fromEmail,
      replyTo: ownerEmail,
      subject: customer.subject,
      html: customer.html,
      text: customer.text,
      attachments: [{ filename: 'fitting.ics', content: ics, contentType: 'text/calendar' }],
    }),
  ];
  if (ownerEmail) {
    sends.push(
      sendEmail({
        to: ownerEmail,
        from: fromEmail,
        replyTo: booking.customer.email,
        subject: owner.subject,
        html: owner.html,
        text: owner.text,
      })
    );
  }

  const results = await Promise.allSettled(sends);
  const failures = results.filter((r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok));
  const status = failures.length === 0 ? 'sent' : failures.length === results.length ? 'failed' : 'partial';
  const detail = failures
    .map((r) => (r.status === 'rejected' ? r.reason?.message : r.value?.error))
    .filter(Boolean)
    .join(' | ');
  await updateBookingEmailStatus(booking.id, status, detail || null).catch(() => {});
  if (status !== 'sent') log.warn(`booking ${booking.id} email status=${status} detail=${detail}`);
}

async function handleGetBooking(req, res, id) {
  if (!id || !/^BK-[A-F0-9]+$/i.test(id)) return sendJson(res, 400, err('Invalid booking id.'));
  const b = await findBookingById(id);
  if (!b) return sendJson(res, 404, err('Booking not found.'));
  sendJson(res, 200, ok({
    id: b.id,
    audience: b.audience,
    slot: b.slot,
    displayTimezone: b.displayTimezone,
    customer: { firstName: b.customer.firstName, email: b.customer.email },
    createdAt: b.createdAt,
  }));
}

async function handleGetBookingIcs(req, res, id) {
  if (!id || !/^BK-[A-F0-9]+$/i.test(id)) {
    res.writeHead(400);
    return res.end('Invalid booking id.');
  }
  const b = await findBookingById(id);
  if (!b) {
    res.writeHead(404);
    return res.end('Not found');
  }
  const cfg = await loadConfig();
  const audienceLabel = cfg.fittingTypes?.[b.audience]?.label || b.audience;
  const businessName = process.env.BUSINESS_NAME || 'GA Suit Warehouse';
  const businessAddress = process.env.BUSINESS_ADDRESS || '150 Pearl Nix Pkwy, Gainesville GA 30501';
  const ics = buildICS({
    id: b.id,
    slot: b.slot,
    durationMinutes: b.slot.durationMinutes,
    tz: b.slot.tz,
    summary: `${audienceLabel} at ${businessName}`,
    description: `Your fitting at ${businessName}. Reference: ${b.id}.`,
    location: businessAddress,
  });
  res.writeHead(200, {
    'content-type': 'text/calendar; charset=utf-8',
    'content-disposition': `attachment; filename="fitting-${b.id}.ics"`,
    'cache-control': 'no-store',
  });
  res.end(ics);
}

// --- static -----------------------------------------------------------------

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

// --- router -----------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const path = url.pathname;

    if (path.startsWith('/api/')) {
      if (req.method === 'GET' && path === '/api/config') return handleConfig(req, res);
      if (req.method === 'GET' && path === '/api/availability') return handleAvailability(req, res, url);
      if (req.method === 'GET' && path === '/api/availability/month') return handleAvailabilityMonth(req, res, url);
      if (req.method === 'POST' && path === '/api/leads') return handleCreateLead(req, res);
      if (req.method === 'POST' && path === '/api/bookings') return handleCreateBooking(req, res);

      const bookingMatch = path.match(/^\/api\/bookings\/([A-Za-z0-9-]+)\/ics$/);
      if (req.method === 'GET' && bookingMatch) return handleGetBookingIcs(req, res, bookingMatch[1]);

      const bookingIdMatch = path.match(/^\/api\/bookings\/([A-Za-z0-9-]+)$/);
      if (req.method === 'GET' && bookingIdMatch) return handleGetBooking(req, res, bookingIdMatch[1]);

      return sendJson(res, 404, err('Not found.'));
    }

    return serveStatic(req, res, decodeURIComponent(path));
  } catch (e) {
    log.error('unhandled', e?.message || e);
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end(`Server error: ${e?.message || 'unknown'}`);
  }
});

// Schema-drift guard: at boot, diff field-name lists against frontend file.
async function guardSchemaDrift() {
  try {
    const front = await readFile(join(ROOT, 'assets/js/booking-form.js'), 'utf8');
    for (const audience of AUDIENCES) {
      for (const name of fieldNames(audience)) {
        // crude but effective: every server-side field name must appear in the frontend file.
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
