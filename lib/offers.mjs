/**
 * Lead magnet offer + redemption code persistence.
 * Atomic reservation pattern: a single conditional UPDATE bumps redemptions_used
 * only when the cap hasn't been hit, so concurrent opt-ins can't oversell.
 */

import { getDb } from './db.mjs';

function rowToOffer(r) {
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    itemDescription: r.item_description,
    retailValueCents: Number(r.retail_value_cents),
    weekStart: r.week_start,
    weekEnd: r.week_end,
    redemptionCap: Number(r.redemption_cap),
    redemptionsUsed: Number(r.redemptions_used),
    active: r.active === 1,
    imageUrl: r.image_url,
    createdAt: r.created_at,
  };
}

export async function getActiveOffer() {
  const db = getDb();
  const rs = await db.execute({
    sql: 'SELECT * FROM lead_magnet_offers WHERE active = 1 LIMIT 1',
    args: [],
  });
  return rs.rows.length === 0 ? null : rowToOffer(rs.rows[0]);
}

export async function findOfferById(id) {
  const db = getDb();
  const rs = await db.execute({
    sql: 'SELECT * FROM lead_magnet_offers WHERE id = ? LIMIT 1',
    args: [id],
  });
  return rs.rows.length === 0 ? null : rowToOffer(rs.rows[0]);
}

/**
 * Race-safe reservation. Returns true if a slot was reserved, false if cap hit
 * or offer not active.
 */
export async function reserveOfferSlot(offerId) {
  const db = getDb();
  const rs = await db.execute({
    sql: `UPDATE lead_magnet_offers
            SET redemptions_used = redemptions_used + 1
          WHERE id = ? AND active = 1 AND redemptions_used < redemption_cap`,
    args: [offerId],
  });
  return rs.rowsAffected === 1;
}

export async function releaseOfferSlot(offerId) {
  const db = getDb();
  await db.execute({
    sql: `UPDATE lead_magnet_offers
            SET redemptions_used = MAX(redemptions_used - 1, 0)
          WHERE id = ?`,
    args: [offerId],
  });
}

function rowToCode(r) {
  if (!r) return null;
  return {
    code: r.code,
    leadId: r.lead_id,
    bookingId: r.booking_id,
    offerId: r.offer_id,
    status: r.status,
    issuedAt: r.issued_at,
    expiresAt: r.expires_at,
    redeemedAt: r.redeemed_at,
    redeemedByStaff: r.redeemed_by_staff,
    createdAt: r.created_at,
  };
}

export async function insertRedemptionCode({ code, leadId, offerId, expiresAt }) {
  const db = getDb();
  const createdAt = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO redemption_codes
          (code, lead_id, booking_id, offer_id, status, issued_at, expires_at, redeemed_at, redeemed_by_staff, created_at)
          VALUES (?, ?, NULL, ?, 'reserved', NULL, ?, NULL, NULL, ?)`,
    args: [code, leadId, offerId, expiresAt, createdAt],
  });
  return { code, leadId, offerId, status: 'reserved', expiresAt, createdAt };
}

export async function findCodeByLeadId(leadId) {
  const db = getDb();
  const rs = await db.execute({
    sql: `SELECT * FROM redemption_codes
          WHERE lead_id = ?
          ORDER BY created_at DESC
          LIMIT 1`,
    args: [leadId],
  });
  return rs.rows.length === 0 ? null : rowToCode(rs.rows[0]);
}

export async function findCode(code) {
  const db = getDb();
  const rs = await db.execute({
    sql: 'SELECT * FROM redemption_codes WHERE code = ? LIMIT 1',
    args: [code],
  });
  return rs.rows.length === 0 ? null : rowToCode(rs.rows[0]);
}

/**
 * Try to flip a reserved code → issued and bind it to the booking. Returns the
 * updated code row (with the offer attached) or null if no eligible row.
 */
export async function issueCodeForBooking(leadId, bookingId) {
  const db = getDb();
  const issuedAt = new Date().toISOString();
  const upd = await db.execute({
    sql: `UPDATE redemption_codes
            SET status = 'issued', booking_id = ?, issued_at = ?
          WHERE lead_id = ? AND status = 'reserved'`,
    args: [bookingId, issuedAt, leadId],
  });
  if (upd.rowsAffected === 0) return null;
  return findCodeByLeadId(leadId);
}

/**
 * Returns true if there's an unredeemed code for this email within the recent
 * window. Used as a soft duplicate guard on opt-in.
 */
export async function hasRecentUnredeemedCodeForEmail(email, windowDays = 90) {
  const db = getDb();
  const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
  const rs = await db.execute({
    sql: `SELECT rc.code FROM redemption_codes rc
          JOIN leads l ON l.id = rc.lead_id
          WHERE l.email = ?
            AND rc.status IN ('reserved', 'issued')
            AND rc.created_at >= ?
          LIMIT 1`,
    args: [email, cutoff],
  });
  return rs.rows.length > 0;
}
