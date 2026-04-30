/**
 * Admin operations (staff redeem tool + funnel-stats dashboard).
 * Auth happens upstream in handlers.mjs via STAFF_TOKEN bearer compare.
 */

import { getDb } from './db.mjs';

/* ------------------------------------------------------------------ */
/* Code lookup + redeem                                                */
/* ------------------------------------------------------------------ */

export async function lookupCode(code) {
  const db = getDb();
  const rs = await db.execute({
    sql: `SELECT rc.code, rc.status, rc.expires_at, rc.issued_at,
                 rc.redeemed_at, rc.redeemed_by_staff,
                 rc.lead_id, rc.booking_id,
                 o.id   AS offer_id,
                 o.name AS offer_name,
                 o.item_description AS offer_desc,
                 l.first_name, l.email, l.phone,
                 b.slot_date, b.slot_time, b.slot_tz, b.audience
            FROM redemption_codes rc
            JOIN lead_magnet_offers o ON o.id = rc.offer_id
            JOIN leads l              ON l.id = rc.lead_id
       LEFT JOIN bookings b           ON b.id = rc.booking_id
           WHERE rc.code = ?
           LIMIT 1`,
    args: [code],
  });
  if (rs.rows.length === 0) return null;
  const r = rs.rows[0];
  return {
    code: r.code,
    status: r.status,
    issuedAt: r.issued_at,
    expiresAt: r.expires_at,
    redeemedAt: r.redeemed_at,
    redeemedByStaff: r.redeemed_by_staff,
    customer: {
      firstName: r.first_name,
      email: r.email,
      phone: r.phone,
    },
    offer: {
      id: r.offer_id,
      name: r.offer_name,
      description: r.offer_desc,
    },
    booking: r.booking_id
      ? {
          id: r.booking_id,
          date: r.slot_date,
          time: r.slot_time,
          tz: r.slot_tz,
          audience: r.audience,
        }
      : null,
  };
}

/**
 * Mark a code redeemed. Idempotent guarded — returns ALREADY_REDEEMED if the
 * code was already in 'redeemed' state, NOT_ISSUED if it can't be redeemed
 * (still reserved, expired, noshow), NOT_FOUND if missing.
 */
export async function redeemCode(code, staffId) {
  const db = getDb();
  const existing = await lookupCode(code);
  if (!existing) return { ok: false, error: 'NOT_FOUND' };
  if (existing.status === 'redeemed') {
    return { ok: false, error: 'ALREADY_REDEEMED', code: existing };
  }
  if (existing.status !== 'issued') {
    return { ok: false, error: 'NOT_ISSUED', current: existing.status };
  }
  const redeemedAt = new Date().toISOString();
  const upd = await db.execute({
    sql: `UPDATE redemption_codes
             SET status = 'redeemed',
                 redeemed_at = ?,
                 redeemed_by_staff = ?
           WHERE code = ? AND status = 'issued'`,
    args: [redeemedAt, staffId || null, code],
  });
  if (upd.rowsAffected !== 1) {
    return { ok: false, error: 'RACE_LOST' };
  }
  const updated = await lookupCode(code);
  return { ok: true, code: updated };
}

/* ------------------------------------------------------------------ */
/* Funnel stats                                                        */
/* ------------------------------------------------------------------ */

/**
 * Aggregates per offer week — every metric lines up with a single offer row,
 * so we group by offers.id and JOIN counts from leads / bookings / codes.
 *
 * Returns the most recent N weeks (default 8), newest first.
 */
export async function getFunnelStats(weeks = 8) {
  const db = getDb();

  const offers = await db.execute({
    sql: `SELECT id, name, week_start, week_end, redemption_cap, redemptions_used
            FROM lead_magnet_offers
           ORDER BY week_start DESC
           LIMIT ?`,
    args: [weeks],
  });

  const out = [];
  for (const o of offers.rows) {
    const offerId = o.id;
    const codeAgg = await db.execute({
      sql: `SELECT
              SUM(CASE WHEN status = 'reserved' THEN 1 ELSE 0 END) AS reserved,
              SUM(CASE WHEN status = 'issued'   THEN 1 ELSE 0 END) AS issued,
              SUM(CASE WHEN status = 'redeemed' THEN 1 ELSE 0 END) AS redeemed,
              SUM(CASE WHEN status = 'expired'  THEN 1 ELSE 0 END) AS expired,
              SUM(CASE WHEN status = 'noshow'   THEN 1 ELSE 0 END) AS noshow
            FROM redemption_codes
           WHERE offer_id = ?`,
      args: [offerId],
    });

    const leadAgg = await db.execute({
      sql: `SELECT
              SUM(CASE WHEN qualified = 1 THEN 1 ELSE 0 END) AS qualified,
              SUM(CASE WHEN qualified = 0 THEN 1 ELSE 0 END) AS disqualified,
              COUNT(*) AS total
            FROM leads
           WHERE offer_id = ? OR (offer_id IS NULL AND created_at BETWEEN ? AND ?)`,
      args: [offerId, o.week_start, o.week_end + 'T23:59:59Z'],
    });

    const c = codeAgg.rows[0] || {};
    const l = leadAgg.rows[0] || {};
    out.push({
      offerId,
      offerName: o.name,
      weekStart: o.week_start,
      weekEnd: o.week_end,
      cap: Number(o.redemption_cap),
      capUsed: Number(o.redemptions_used),
      leads: {
        total:        Number(l.total || 0),
        qualified:    Number(l.qualified || 0),
        disqualified: Number(l.disqualified || 0),
      },
      codes: {
        reserved: Number(c.reserved || 0),
        issued:   Number(c.issued || 0),
        redeemed: Number(c.redeemed || 0),
        expired:  Number(c.expired || 0),
        noshow:   Number(c.noshow || 0),
      },
      conversion: (() => {
        const qualified = Number(l.qualified || 0);
        const issued    = Number(c.issued || 0);
        const redeemed  = Number(c.redeemed || 0);
        const noshow    = Number(c.noshow || 0);
        const booked    = issued + redeemed + noshow;     // anyone who got past the booking step
        const settled   = redeemed + noshow;              // booked AND outcome is known
        return {
          qualifiedToBooked:   qualified > 0 ? Math.round((booked / qualified) * 100) : null,
          bookedToRedeemed:    settled  > 0 ? Math.round((redeemed / settled) * 100)  : null,
          qualifiedToRedeemed: qualified > 0 ? Math.round((redeemed / qualified) * 100) : null,
        };
      })(),
    });
  }
  return out;
}
