/**
 * SQL-backed Repository for bookings + leads (libSQL/Turso).
 *
 * Public API matches the previous file-backed version exactly so callers
 * (server.mjs, lib/handlers.mjs, /api/*) don't need to change.
 *
 * Concurrency: SLOT uniqueness is enforced by a UNIQUE(slot_date, slot_time)
 * constraint at the DB level. Two simultaneous booking attempts at the same
 * slot will see exactly one succeed; the loser receives SLOT_TAKEN.
 */

import { getDb } from './db.mjs';

function rowToBooking(r) {
  return {
    id: r.id,
    audience: r.audience,
    customer: JSON.parse(r.customer_json),
    answers: JSON.parse(r.answers_json),
    slot: {
      date: r.slot_date,
      time: r.slot_time,
      durationMinutes: Number(r.slot_duration),
      tz: r.slot_tz,
    },
    displayTimezone: r.display_tz,
    consent: r.consent === 1,
    leadId: r.lead_id,
    ip: r.ip,
    userAgent: r.user_agent,
    emailStatus: r.email_status,
    emailDetail: r.email_detail,
    createdAt: r.created_at,
  };
}

export async function findBookingById(id) {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT * FROM bookings WHERE id = ? LIMIT 1',
    args: [id],
  });
  if (result.rows.length === 0) return null;
  return rowToBooking(result.rows[0]);
}

export async function listBookingsBySlot(date, audience) {
  const db = getDb();
  const result = audience
    ? await db.execute({
        sql: 'SELECT * FROM bookings WHERE slot_date = ? AND audience = ?',
        args: [date, audience],
      })
    : await db.execute({
        sql: 'SELECT * FROM bookings WHERE slot_date = ?',
        args: [date],
      });
  return result.rows.map(rowToBooking);
}

export async function listBookingsByMonth(year, month, audience) {
  const db = getDb();
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  const like = `${prefix}%`;
  const result = audience
    ? await db.execute({
        sql: 'SELECT * FROM bookings WHERE slot_date LIKE ? AND audience = ?',
        args: [like, audience],
      })
    : await db.execute({
        sql: 'SELECT * FROM bookings WHERE slot_date LIKE ?',
        args: [like],
      });
  return result.rows.map(rowToBooking);
}

/**
 * @returns { ok: true, booking } or { ok: false, error: 'SLOT_TAKEN' }
 */
export async function createBooking(record, idGenerator) {
  const db = getDb();
  const booking = {
    ...record,
    id: idGenerator(),
    createdAt: new Date().toISOString(),
  };

  try {
    await db.execute({
      sql: `INSERT INTO bookings (
        id, audience, customer_json, answers_json,
        slot_date, slot_time, slot_duration, slot_tz,
        display_tz, consent, lead_id, ip, user_agent,
        email_status, email_detail, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        booking.id,
        booking.audience,
        JSON.stringify(booking.customer ?? {}),
        JSON.stringify(booking.answers ?? {}),
        booking.slot.date,
        booking.slot.time,
        booking.slot.durationMinutes,
        booking.slot.tz,
        booking.displayTimezone ?? null,
        booking.consent ? 1 : 0,
        booking.leadId ?? null,
        booking.ip ?? null,
        booking.userAgent ?? null,
        booking.emailStatus ?? 'pending',
        booking.emailDetail ?? null,
        booking.createdAt,
      ],
    });
    return { ok: true, booking };
  } catch (err) {
    const msg = String(err?.message || err);
    if (msg.includes('UNIQUE') || msg.includes('SQLITE_CONSTRAINT')) {
      return { ok: false, error: 'SLOT_TAKEN' };
    }
    throw err;
  }
}

export async function createLead(record, idGenerator) {
  const db = getDb();
  const lead = {
    ...record,
    id: idGenerator(),
    createdAt: new Date().toISOString(),
  };

  await db.execute({
    sql: `INSERT INTO leads (
      id, audience, first_name, last_name, phone,
      consent, ip, user_agent, created_at,
      email, zip, occasion, needed_by_date,
      qualifier_answer, qualified, source, offer_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      lead.id,
      lead.audience,
      lead.firstName,
      lead.lastName ?? null,
      lead.phone,
      lead.consent ? 1 : 0,
      lead.ip ?? null,
      lead.userAgent ?? null,
      lead.createdAt,
      lead.email ?? null,
      lead.zip ?? null,
      lead.occasion ?? null,
      lead.neededByDate ?? null,
      lead.qualifierAnswer ?? null,
      lead.qualified == null ? null : (lead.qualified ? 1 : 0),
      lead.source ?? null,
      lead.offerId ?? null,
    ],
  });
  return { ok: true, lead };
}

export async function findLeadById(id) {
  const db = getDb();
  const rs = await db.execute({
    sql: 'SELECT * FROM leads WHERE id = ? LIMIT 1',
    args: [id],
  });
  if (rs.rows.length === 0) return null;
  const r = rs.rows[0];
  return {
    id: r.id,
    audience: r.audience,
    firstName: r.first_name,
    lastName: r.last_name,
    phone: r.phone,
    email: r.email,
    zip: r.zip,
    occasion: r.occasion,
    neededByDate: r.needed_by_date,
    qualifierAnswer: r.qualifier_answer,
    qualified: r.qualified == null ? null : r.qualified === 1,
    source: r.source,
    offerId: r.offer_id,
    consent: r.consent === 1,
    createdAt: r.created_at,
  };
}

export async function updateBookingEmailStatus(id, status, detail) {
  const db = getDb();
  const result = await db.execute({
    sql: 'UPDATE bookings SET email_status = ?, email_detail = ? WHERE id = ?',
    args: [status, detail ?? null, id],
  });
  if (result.rowsAffected === 0) return { ok: false, error: 'NOT_FOUND' };
  return { ok: true };
}
