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
 * Flip a reserved code → issued without binding it to a booking. Used by the
 * stand-alone gift opt-in flow (customer fills the form, code is emailed
 * immediately, no appointment). Returns the updated code row or null.
 */
export async function issueCodeForLead(leadId) {
  const db = getDb();
  const issuedAt = new Date().toISOString();
  const upd = await db.execute({
    sql: `UPDATE redemption_codes
            SET status = 'issued', issued_at = ?
          WHERE lead_id = ? AND status = 'reserved'`,
    args: [issuedAt, leadId],
  });
  if (upd.rowsAffected === 0) return null;
  return findCodeByLeadId(leadId);
}

/**
 * Returns the most recent reserved-or-issued code for this email + offer
 * (same offer_id), or null if none. Used by the opt-in flow to recover and
 * resume a customer's existing claim instead of rejecting a re-submit
 * (e.g. their code email never arrived, or they reloaded the form).
 */
export async function findUnredeemedCodeForOffer(email, offerId) {
  if (!email || !offerId) return null;
  const db = getDb();
  const rs = await db.execute({
    sql: `SELECT rc.* FROM redemption_codes rc
          JOIN leads l ON l.id = rc.lead_id
          WHERE l.email = ?
            AND rc.offer_id = ?
            AND rc.status IN ('reserved', 'issued')
          ORDER BY rc.created_at DESC
          LIMIT 1`,
    args: [email, offerId],
  });
  return rs.rows.length === 0 ? null : rowToCode(rs.rows[0]);
}

/**
 * Returns true if this email has ever redeemed a code for an offer with the
 * SAME name as the supplied offer. Per-item lifetime dedupe — the customer
 * can claim each item type once across the entire program lifecycle, even
 * if the same item runs again in a future cycle.
 *
 * Admin contract: keep `offer.name` consistent across cycles of the same
 * item (case- and whitespace-insensitive match).
 */
export async function hasEverRedeemedSameItem(email, offerName) {
  if (!email || !offerName) return false;
  const db = getDb();
  const normalized = String(offerName).trim().toLowerCase();
  const rs = await db.execute({
    sql: `SELECT rc.code FROM redemption_codes rc
          JOIN leads l ON l.id = rc.lead_id
          JOIN lead_magnet_offers o ON o.id = rc.offer_id
          WHERE l.email = ?
            AND rc.status = 'redeemed'
            AND LOWER(TRIM(o.name)) = ?
          LIMIT 1`,
    args: [email, normalized],
  });
  return rs.rows.length > 0;
}
