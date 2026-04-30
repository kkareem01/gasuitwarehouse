/**
 * Cron handlers — invoked by Vercel Cron Jobs (production) or curl + Bearer
 * token (local dev). Every handler is idempotent: re-running on the same data
 * is a no-op via PRIMARY KEY (booking_id, kind) on the nurture_sent table or
 * status-guarded UPDATEs on offers/codes.
 *
 * All handlers verify Authorization: Bearer ${CRON_SECRET}. The shared check
 * lives in handlers.mjs (verifyCronAuth) — these functions assume auth has
 * already passed.
 */

import { getDb } from './db.mjs';
import {
  sendEmail,
  nurtureT3Email,
  nurtureT1Email,
  nurtureDayOfEmail,
} from './email.mjs';
import * as log from './log.mjs';

function ymd(d) {
  return d.toISOString().slice(0, 10);
}

function todayOffsetYmd(days, now = new Date()) {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() + days);
  return ymd(d);
}

function envBusiness() {
  return {
    businessName:    process.env.BUSINESS_NAME    || 'GA Suit Warehouse',
    businessAddress: process.env.BUSINESS_ADDRESS || '150 Pearl Nix Pkwy, Gainesville GA 30501',
    businessPhone:   process.env.BUSINESS_PHONE   || '+14705957775',
    fromEmail:       process.env.FROM_EMAIL       || 'bookings@example.com',
    siteUrl:         process.env.SITE_URL         || 'http://localhost:3000',
  };
}

/* ------------------------------------------------------------------ */
/* Nurture                                                             */
/* ------------------------------------------------------------------ */

const NURTURE_BUILDERS = {
  t3:    { template: nurtureT3Email,    targetOffsetDays: 3 },
  t1:    { template: nurtureT1Email,    targetOffsetDays: 1 },
  dayof: { template: nurtureDayOfEmail, targetOffsetDays: 0 },
};

async function findCandidatesForKind(kind, slotDate) {
  const db = getDb();
  const rs = await db.execute({
    sql: `SELECT b.id            AS booking_id,
                 b.audience       AS audience,
                 b.customer_json  AS customer_json,
                 b.slot_date      AS slot_date,
                 b.slot_time      AS slot_time,
                 b.slot_duration  AS slot_duration,
                 b.slot_tz        AS slot_tz,
                 b.display_tz     AS display_tz,
                 rc.code          AS code,
                 rc.expires_at    AS expires_at,
                 o.id             AS offer_id,
                 o.name           AS offer_name,
                 o.item_description AS offer_desc
            FROM bookings b
            JOIN redemption_codes rc ON rc.booking_id = b.id
            JOIN lead_magnet_offers o ON o.id = rc.offer_id
            LEFT JOIN nurture_sent ns ON ns.booking_id = b.id AND ns.kind = ?
           WHERE b.slot_date = ?
             AND rc.status = 'issued'
             AND ns.booking_id IS NULL`,
    args: [kind, slotDate],
  });
  return rs.rows;
}

async function recordNurtureSent(bookingId, kind) {
  const db = getDb();
  await db.execute({
    sql: 'INSERT INTO nurture_sent (booking_id, kind, sent_at) VALUES (?, ?, ?)',
    args: [bookingId, kind, new Date().toISOString()],
  });
}

async function runNurture(kind) {
  const builder = NURTURE_BUILDERS[kind];
  if (!builder) throw new Error(`Unknown nurture kind: ${kind}`);
  const slotDate = todayOffsetYmd(builder.targetOffsetDays);
  const env = envBusiness();
  const candidates = await findCandidatesForKind(kind, slotDate);

  let sent = 0;
  let failed = 0;
  for (const r of candidates) {
    const customer = JSON.parse(r.customer_json);
    const booking = {
      id: r.booking_id,
      audience: r.audience,
      customer,
      slot: {
        date: r.slot_date,
        time: r.slot_time,
        durationMinutes: Number(r.slot_duration),
        tz: r.slot_tz,
      },
      displayTimezone: r.display_tz,
    };
    const offer = {
      id: r.offer_id,
      name: r.offer_name,
      itemDescription: r.offer_desc,
    };
    const tpl = builder.template({
      booking,
      offer,
      code: r.code,
      expiresAt: r.expires_at,
      ...env,
      confirmUrl: `${env.siteUrl}/booking-confirmed.html?id=${booking.id}`,
    });
    try {
      const result = await sendEmail({
        to: customer.email,
        from: env.fromEmail,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
      });
      if (!result.ok) throw new Error(result.error || 'send failed');
      await recordNurtureSent(booking.id, kind);
      sent += 1;
    } catch (e) {
      failed += 1;
      log.warn(`nurture ${kind} ${booking.id} failed: ${e.message}`);
    }
  }

  log.info(`nurture ${kind} for ${slotDate}: candidates=${candidates.length} sent=${sent} failed=${failed}`);
  return { kind, slotDate, candidates: candidates.length, sent, failed };
}

export const runNurtureT3    = () => runNurture('t3');
export const runNurtureT1    = () => runNurture('t1');
export const runNurtureDayOf = () => runNurture('dayof');

/* ------------------------------------------------------------------ */
/* Expire codes                                                        */
/* ------------------------------------------------------------------ */

export async function runExpireCodes() {
  const db = getDb();
  const nowIso = new Date().toISOString();
  const todayYmd = ymd(new Date());

  // Reserved codes whose 7-day window passed without a booking → expired
  const reserved = await db.execute({
    sql: `UPDATE redemption_codes
             SET status = 'expired'
           WHERE status = 'reserved'
             AND expires_at < ?`,
    args: [nowIso],
  });

  // Issued codes where the booking date has passed and was never redeemed →
  // 'noshow' (separate from 'expired' so analytics can tell them apart).
  const noshow = await db.execute({
    sql: `UPDATE redemption_codes
             SET status = 'noshow'
           WHERE status = 'issued'
             AND booking_id IN (
               SELECT id FROM bookings WHERE slot_date < ?
             )`,
    args: [todayYmd],
  });

  const result = {
    expiredReserved: reserved.rowsAffected || 0,
    markedNoShow: noshow.rowsAffected || 0,
  };
  log.info(`expire-codes: expired=${result.expiredReserved} noshow=${result.markedNoShow}`);
  return result;
}

/* ------------------------------------------------------------------ */
/* Rotate offer (Mondays)                                              */
/* ------------------------------------------------------------------ */

export async function runRotateOffer() {
  const db = getDb();
  const todayYmd = ymd(new Date());

  // Find current active offer; deactivate if its week has ended.
  const active = await db.execute({
    sql: 'SELECT id, week_end FROM lead_magnet_offers WHERE active = 1 LIMIT 1',
    args: [],
  });

  let deactivated = null;
  if (active.rows.length > 0 && active.rows[0].week_end < todayYmd) {
    await db.execute({
      sql: 'UPDATE lead_magnet_offers SET active = 0 WHERE id = ?',
      args: [active.rows[0].id],
    });
    deactivated = active.rows[0].id;
  } else if (active.rows.length > 0) {
    log.info(`rotate-offer: active offer ${active.rows[0].id} still in window, no-op`);
    return { deactivated: null, activated: null, reason: 'still-in-window' };
  }

  // Pick the next queued offer whose week_start is on/before today and that
  // hasn't already ended.
  const next = await db.execute({
    sql: `SELECT id FROM lead_magnet_offers
           WHERE active = 0
             AND week_start <= ?
             AND week_end >= ?
           ORDER BY week_start DESC
           LIMIT 1`,
    args: [todayYmd, todayYmd],
  });

  let activated = null;
  if (next.rows.length > 0) {
    await db.execute({
      sql: 'UPDATE lead_magnet_offers SET active = 1 WHERE id = ?',
      args: [next.rows[0].id],
    });
    activated = next.rows[0].id;
  }

  log.info(`rotate-offer: deactivated=${deactivated || 'none'} activated=${activated || 'none'}`);
  return { deactivated, activated };
}
