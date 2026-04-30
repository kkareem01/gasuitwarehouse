/**
 * API handlers used by BOTH the Vercel serverless functions in /api/*
 * AND the local dev server in server.mjs.
 *
 * Each handler accepts (req, res). On Vercel, req.body is auto-parsed for JSON
 * by the Node runtime. For the local server, server.mjs parses the body and
 * attaches it to req.body before invoking these handlers, so the calling
 * convention is identical.
 */

import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isValidAudience } from './audiences.mjs';
import { validateBookingPayload, validateLeadPayload, validateLeadMagnetPayload } from './validate.mjs';
import {
  generateSlotsForDate,
  filterAvailableSlots,
  listMonth,
} from './slots.mjs';
import {
  findBookingById,
  listBookingsBySlot,
  listBookingsByMonth,
  createBooking,
  createLead,
  findLeadById,
  updateBookingEmailStatus,
} from './store.mjs';
import {
  getActiveOffer,
  findOfferById,
  reserveOfferSlot,
  releaseOfferSlot,
  insertRedemptionCode,
  issueCodeForBooking,
  issueCodeForLead,
  hasUnredeemedCodeForOffer,
  hasEverRedeemedSameItem,
} from './offers.mjs';
import { generateCode, signLeadToken, verifyLeadToken, isoDaysFromNow } from './codes.mjs';
import {
  runNurtureT3,
  runNurtureT1,
  runNurtureDayOf,
  runExpireCodes,
  runRotateOffer,
} from './cron.mjs';
import { lookupCode, redeemCode, getFunnelStats } from './admin.mjs';
import { newBookingId, newLeadId } from './id.mjs';
import { buildICS } from './ics.mjs';
import {
  sendEmail,
  customerConfirmationEmail,
  ownerNotificationEmail,
  redemptionCodeEmail,
  giftCodeReadyEmail,
} from './email.mjs';
import * as log from './log.mjs';

// --- config (cached per cold-start) -----------------------------------------
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
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
  return req.socket?.remoteAddress || 'unknown';
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

function getUrl(req) {
  return new URL(req.url, `http://${req.headers.host || 'localhost'}`);
}

// --- rate limit (per-instance, in-memory) -----------------------------------
// On Vercel each warm instance has its own map; cold starts reset it. For a
// small business that's an acceptable trade-off vs. paying for a KV store.
const RATE_LIMITS = new Map();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

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

// --- handlers ---------------------------------------------------------------

export async function handleConfig(req, res) {
  const cfg = await loadConfig();
  sendJson(res, 200, ok(publicConfig(cfg)));
}

export async function handleAvailability(req, res) {
  const url = getUrl(req);
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
  const slots = all.map((time) => ({ time, available: available.includes(time) }));
  sendJson(res, 200, ok({ date, audience, slots }));
}

export async function handleAvailabilityMonth(req, res) {
  const url = getUrl(req);
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

export async function handleCreateLead(req, res) {
  const body = req.body || {};
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

export async function handleCreateBooking(req, res) {
  const ip = clientIp(req);
  if (!checkRateLimit(ip)) {
    return sendJson(res, 429, err('Too many bookings from your network. Try again later.'));
  }

  const body = req.body || {};
  const v = validateBookingPayload(body);
  if (!v.ok) return sendJson(res, 400, err(v.errors.join(' ')));

  const cfg = await loadConfig();
  const audience = v.value.audience;
  const fitting = cfg.fittingTypes[audience];
  const durationMinutes = fitting?.slotDurationMinutes ?? cfg.defaultSlotDurationMinutes ?? 20;

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

  // If the booker came in via a lead-magnet opt-in (and supplied a valid HMAC),
  // try to flip their reserved code to issued + bind it to the booking.
  let issuedCode = null;
  let issuedOffer = null;
  const leadId = result.booking.leadId;
  const leadToken = typeof body.t === 'string' ? body.t : null;
  if (leadId && leadToken && verifyLeadToken(leadId, leadToken)) {
    try {
      const codeRow = await issueCodeForBooking(leadId, result.booking.id);
      if (codeRow) {
        issuedCode = codeRow;
        issuedOffer = await findOfferById(codeRow.offerId);
      }
    } catch (e) {
      log.warn(`could not issue code for booking ${result.booking.id}: ${e?.message || e}`);
    }
  }

  // Awaited in serverless so the function doesn't terminate before email finishes.
  await fireEmails(result.booking, cfg, issuedCode, issuedOffer)
    .catch((e) => log.error('email pipeline crash', e?.message || e));

  return sendJson(res, 200, ok({
    id: result.booking.id,
    slot: result.booking.slot,
    customer: result.booking.customer,
    redemption: issuedCode && issuedOffer ? {
      code: issuedCode.code,
      expiresAt: issuedCode.expiresAt,
      offer: { name: issuedOffer.name, itemDescription: issuedOffer.itemDescription },
    } : null,
  }));
}

async function fireEmails(booking, cfg, issuedCode = null, issuedOffer = null) {
  const businessName = process.env.BUSINESS_NAME || 'GA Suit Warehouse';
  const businessAddress = process.env.BUSINESS_ADDRESS || '150 Pearl Nix Pkwy, Gainesville GA 30501';
  const businessPhone = process.env.BUSINESS_PHONE || '+14705957775';
  const fromEmail = process.env.FROM_EMAIL || 'bookings@example.com';
  const ownerEmail = process.env.OWNER_EMAIL;
  const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
  const audienceLabel = cfg.fittingTypes?.[booking.audience]?.label || booking.audience;
  const confirmUrl = `${siteUrl}/booking-confirmed.html?id=${booking.id}`;

  const ics = buildICS({
    id: booking.id,
    slot: booking.slot,
    durationMinutes: booking.slot.durationMinutes,
    tz: booking.slot.tz,
    summary: issuedOffer ? `Pickup: ${issuedOffer.name} at ${businessName}` : `${audienceLabel} at ${businessName}`,
    description: issuedOffer
      ? `Pick up your free ${issuedOffer.name} at ${businessName}. Reference: ${booking.id}.\n${confirmUrl}`
      : `Your fitting at ${businessName}. Reference: ${booking.id}.\n${confirmUrl}`,
    location: businessAddress,
  });

  const customer = issuedCode && issuedOffer
    ? redemptionCodeEmail({
        booking,
        offer: issuedOffer,
        code: issuedCode.code,
        expiresAt: issuedCode.expiresAt,
        businessName,
        businessAddress,
        businessPhone,
        confirmUrl,
      })
    : customerConfirmationEmail({
        booking, businessName, businessAddress, businessPhone, confirmUrl,
      });
  const ownerSubjectPrefix = issuedOffer ? `[GIFT: ${issuedOffer.name}] ` : '';
  const owner = ownerNotificationEmail({ booking, audienceLabel, businessName });
  if (ownerSubjectPrefix) owner.subject = ownerSubjectPrefix + owner.subject;

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

export async function handleGetBooking(req, res, id) {
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

// ============================================================================
// Lead magnet
// ============================================================================

const QUALIFIER_TO_AUDIENCE = {
  event: 'general',
  wardrobe: 'general',
  maybe: 'general',
};

export async function handleGetActiveOffer(req, res) {
  try {
    const offer = await getActiveOffer();
    if (!offer) {
      res.writeHead(404, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, max-age=60',
      });
      return res.end(JSON.stringify({ ok: false, error: 'NO_ACTIVE_OFFER' }));
    }
    const remainingRaw = offer.redemptionCap - offer.redemptionsUsed;
    const remaining = remainingRaw <= 0 ? 0 : remainingRaw > 10 ? remainingRaw : 'fewer than 10';
    res.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=60',
    });
    return res.end(JSON.stringify({
      ok: true,
      offer: {
        id: offer.id,
        name: offer.name,
        itemDescription: offer.itemDescription,
        imageUrl: offer.imageUrl,
        retailValueCents: offer.retailValueCents,
        weekEnd: offer.weekEnd,
        remaining,
      },
    }));
  } catch (e) {
    log.error('handleGetActiveOffer crash', e?.message || e);
    return sendJson(res, 500, err('Could not load offer.'));
  }
}

export async function handleLeadMagnetOptIn(req, res) {
  const ip = clientIp(req);
  if (!checkRateLimit(ip)) {
    return sendJson(res, 429, { ok: false, error: 'RATE_LIMIT' });
  }

  const body = req.body || {};
  const v = validateLeadMagnetPayload(body);
  if (!v.ok) {
    return sendJson(res, 400, { ok: false, error: v.code || 'VALIDATION', details: v.errors });
  }
  const { firstName, email, phone, qualifierAnswer } = v.value;
  const userAgent = (req.headers['user-agent'] || '').slice(0, 200);

  const offer = await getActiveOffer();
  if (!offer) {
    return sendJson(res, 200, { ok: true, exhausted: true });
  }

  // Per-item lifetime dedupe: email has already redeemed THIS item in any
  // cycle (matched by offer name).
  const claimed = await hasEverRedeemedSameItem(email, offer.name).catch(() => false);
  if (claimed) {
    return sendJson(res, 409, {
      ok: false,
      error: 'ALREADY_CLAIMED_ITEM',
      itemName: offer.name,
    });
  }
  // Soft duplicate guard: same email already has an unredeemed code for the
  // CURRENT offer (e.g. reload + resubmit during the same week).
  const dup = await hasUnredeemedCodeForOffer(email, offer.id).catch(() => false);
  if (dup) {
    return sendJson(res, 409, { ok: false, error: 'DUPLICATE_RECENT' });
  }

  const reserved = await reserveOfferSlot(offer.id);
  if (!reserved) {
    return sendJson(res, 200, { ok: true, exhausted: true });
  }

  let leadResult;
  try {
    leadResult = await createLead(
      {
        audience: QUALIFIER_TO_AUDIENCE[qualifierAnswer] || 'general',
        firstName,
        lastName: null,
        phone,
        email,
        consent: true,
        qualifierAnswer,
        qualified: true,
        source: 'lead-magnet',
        offerId: offer.id,
        ip,
        userAgent,
      },
      newLeadId
    );
  } catch (e) {
    await releaseOfferSlot(offer.id).catch(() => {});
    log.error('lead insert failed, released slot', e?.message || e);
    return sendJson(res, 500, { ok: false, error: 'SAVE_FAILED' });
  }
  if (!leadResult.ok) {
    await releaseOfferSlot(offer.id).catch(() => {});
    return sendJson(res, 500, { ok: false, error: 'SAVE_FAILED' });
  }

  const code = generateCode();
  const expiresAt = isoDaysFromNow(7);
  try {
    await insertRedemptionCode({
      code,
      leadId: leadResult.lead.id,
      offerId: offer.id,
      expiresAt,
    });
    // Flip reserved → issued without binding to a booking. The customer walks
    // in any time during business hours within the 7-day window.
    await issueCodeForLead(leadResult.lead.id);
  } catch (e) {
    await releaseOfferSlot(offer.id).catch(() => {});
    log.error('code insert failed, released slot', e?.message || e);
    return sendJson(res, 500, { ok: false, error: 'SAVE_FAILED' });
  }

  log.info(`gift opt-in ${leadResult.lead.id} offer=${offer.id} code=${code}`);
  fireGiftCodeEmail({ firstName, email, offer, code, expiresAt }).catch((e) =>
    log.error('gift email crash', e?.message || e)
  );

  return sendJson(res, 200, {
    ok: true,
    leadId: leadResult.lead.id,
    code,
    expiresAt,
    offer: { name: offer.name, itemDescription: offer.itemDescription },
  });
}

async function fireGiftCodeEmail({ firstName, email, offer, code, expiresAt }) {
  const businessName    = process.env.BUSINESS_NAME    || 'GA Suit Warehouse';
  const businessAddress = process.env.BUSINESS_ADDRESS || '150 Pearl Nix Pkwy, Gainesville GA 30501';
  const businessPhone   = process.env.BUSINESS_PHONE   || '+14705957775';
  const fromEmail       = process.env.FROM_EMAIL       || 'bookings@example.com';
  const tpl = giftCodeReadyEmail({
    firstName,
    offer,
    code,
    expiresAt,
    businessName,
    businessAddress,
    businessPhone,
  });
  return sendEmail({
    to: email,
    from: fromEmail,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
  });
}

// ============================================================================
// Cron
// ============================================================================

function verifyBearer(req, secretEnvName) {
  const expected = process.env[secretEnvName];
  if (!expected || expected.length < 16) return false;
  const auth = req.headers['authorization'];
  if (typeof auth !== 'string') return false;
  const expectedHeader = `Bearer ${expected}`;
  if (auth.length !== expectedHeader.length) return false;
  let diff = 0;
  for (let i = 0; i < auth.length; i++) {
    diff |= auth.charCodeAt(i) ^ expectedHeader.charCodeAt(i);
  }
  return diff === 0;
}

function verifyCronAuth(req)  { return verifyBearer(req, 'CRON_SECRET'); }
function verifyStaffAuth(req) { return verifyBearer(req, 'STAFF_TOKEN'); }

function makeCronHandler(name, runner) {
  return async function (req, res) {
    if (!verifyCronAuth(req)) {
      return sendJson(res, 401, { ok: false, error: 'UNAUTHORIZED' });
    }
    try {
      const result = await runner();
      return sendJson(res, 200, { ok: true, job: name, result });
    } catch (e) {
      log.error(`cron ${name} crash`, e?.message || e);
      return sendJson(res, 500, { ok: false, error: e?.message || 'CRASH' });
    }
  };
}

export const handleCronNurtureT3    = makeCronHandler('nurture-t3',    runNurtureT3);
export const handleCronNurtureT1    = makeCronHandler('nurture-t1',    runNurtureT1);
export const handleCronNurtureDayOf = makeCronHandler('nurture-dayof', runNurtureDayOf);
export const handleCronExpireCodes  = makeCronHandler('expire-codes',  runExpireCodes);
export const handleCronRotateOffer  = makeCronHandler('rotate-offer',  runRotateOffer);

// ============================================================================
// Admin (staff redeem tool + funnel stats)
// ============================================================================

const CODE_RE = /^GIFT-[A-Z2-9]{6}$/;

export async function handleAdminLookupCode(req, res) {
  if (!verifyStaffAuth(req)) {
    return sendJson(res, 401, { ok: false, error: 'UNAUTHORIZED' });
  }
  const url = getUrl(req);
  const code = (url.searchParams.get('code') || '').toUpperCase().trim();
  if (!CODE_RE.test(code)) {
    return sendJson(res, 400, { ok: false, error: 'INVALID_CODE' });
  }
  const found = await lookupCode(code);
  if (!found) return sendJson(res, 404, { ok: false, error: 'NOT_FOUND' });
  return sendJson(res, 200, { ok: true, code: found });
}

export async function handleAdminRedeem(req, res) {
  if (!verifyStaffAuth(req)) {
    return sendJson(res, 401, { ok: false, error: 'UNAUTHORIZED' });
  }
  const body = req.body || {};
  const code = typeof body.code === 'string' ? body.code.toUpperCase().trim() : '';
  const staffId = typeof body.staffId === 'string' ? body.staffId.slice(0, 60) : null;
  if (!CODE_RE.test(code)) {
    return sendJson(res, 400, { ok: false, error: 'INVALID_CODE' });
  }
  const result = await redeemCode(code, staffId);
  if (!result.ok) {
    const status = result.error === 'NOT_FOUND' ? 404
                 : result.error === 'ALREADY_REDEEMED' ? 409
                 : result.error === 'NOT_ISSUED' ? 409
                 : 500;
    return sendJson(res, status, result);
  }
  log.info(`code redeemed ${code} by ${staffId || 'unknown'}`);
  return sendJson(res, 200, result);
}

export async function handleAdminFunnelStats(req, res) {
  if (!verifyStaffAuth(req)) {
    return sendJson(res, 401, { ok: false, error: 'UNAUTHORIZED' });
  }
  const url = getUrl(req);
  const weeks = Math.max(1, Math.min(52, parseInt(url.searchParams.get('weeks') || '8', 10) || 8));
  try {
    const stats = await getFunnelStats(weeks);
    return sendJson(res, 200, { ok: true, weeks: stats });
  } catch (e) {
    log.error('funnel-stats crash', e?.message || e);
    return sendJson(res, 500, { ok: false, error: e?.message || 'CRASH' });
  }
}

export async function handleLeadLookup(req, res) {
  const url = getUrl(req);
  const leadId = url.searchParams.get('lead');
  const token = url.searchParams.get('t');
  if (!leadId || !token) {
    return sendJson(res, 400, { ok: false, error: 'MISSING_PARAMS' });
  }
  if (!verifyLeadToken(leadId, token)) {
    return sendJson(res, 401, { ok: false, error: 'INVALID_TOKEN' });
  }
  const lead = await findLeadById(leadId);
  if (!lead) return sendJson(res, 404, { ok: false, error: 'NOT_FOUND' });

  let offer = null;
  if (lead.offerId) {
    const o = await findOfferById(lead.offerId).catch(() => null);
    if (o) offer = { id: o.id, name: o.name, itemDescription: o.itemDescription };
  }
  return sendJson(res, 200, {
    ok: true,
    lead: {
      firstName: lead.firstName,
      email: lead.email,
      phone: lead.phone,
      audience: lead.audience || 'general',
    },
    offer,
  });
}

export async function handleGetBookingIcs(req, res, id) {
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
