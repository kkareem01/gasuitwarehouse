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
    // `?? 'new'` guards the brief window between deploy and the migration's
    // ALTER TABLE landing the staff_status column.
    staffStatus: r.staff_status ?? 'new',
    // Ad attribution (nullable — organic bookings have none).
    gclid: r.gclid ?? null,
    gbraid: r.gbraid ?? null,
    wbraid: r.wbraid ?? null,
    utm: parseUtm(r.utm_json),
    landingPage: r.landing_page ?? null,
    referrer: r.referrer ?? null,
    // Staff-recorded purchase. NULL = not recorded; 0 = bought nothing.
    saleAmountCents: r.sale_amount_cents == null ? null : Number(r.sale_amount_cents),
    saleRecordedAt: r.sale_recorded_at ?? null,
    saleNotes: r.sale_notes ?? null,
    createdAt: r.created_at,
  };
}

function parseUtm(utmJson) {
  if (!utmJson) return null;
  try {
    const utm = JSON.parse(utmJson);
    return utm && typeof utm === 'object' ? utm : null;
  } catch (_) {
    return null;
  }
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
        email_status, email_detail, staff_status,
        gclid, gbraid, wbraid, utm_json, landing_page, referrer,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        // Every booking made through the site starts unacknowledged. The
        // column DEFAULT ('confirmed') exists only to backfill rows that
        // predate the staff_status migration — see lib/migrate.mjs.
        'new',
        booking.gclid ?? null,
        booking.gbraid ?? null,
        booking.wbraid ?? null,
        booking.utmJson ?? null,
        booking.landingPage ?? null,
        booking.referrer ?? null,
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
      qualifier_answer, qualified, source, offer_id,
      gclid, gbraid, wbraid, utm_json, landing_page, referrer
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      lead.gclid ?? null,
      lead.gbraid ?? null,
      lead.wbraid ?? null,
      lead.utmJson ?? null,
      lead.landingPage ?? null,
      lead.referrer ?? null,
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

function rowToIntake(r) {
  return {
    id: r.id,
    firstName: r.first_name,
    lastName: r.last_name,
    phone: r.phone,
    email: r.email,
    suitSize: r.suit_size,
    suitColor: r.suit_color,
    ticketNumber: r.ticket_number ?? '',
    tailoringNotes: r.tailoring_notes,
    additionalNotes: r.additional_notes ?? '',
    needByDate: r.need_by_date,
    tailorStatus: r.tailor_status,
    reviewEmailStatus: r.review_email_status,
    reviewEmailSentAt: r.review_email_sent_at,
    pickupNoticeStatus: r.pickup_notice_status,
    pickupNoticeSentAt: r.pickup_notice_sent_at,
    ip: r.ip,
    userAgent: r.user_agent,
    createdAt: r.created_at,
  };
}

export async function createIntake(record, idGenerator) {
  const db = getDb();
  const intake = {
    ...record,
    id: idGenerator(),
    createdAt: new Date().toISOString(),
  };

  // sheets_status / sheets_detail columns still exist on legacy rows but are
  // unused — they fall back to their schema defaults on insert.
  await db.execute({
    sql: `INSERT INTO intakes (
      id, first_name, last_name, phone, email,
      suit_size, suit_color, ticket_number, tailoring_notes, additional_notes, need_by_date,
      tailor_status, review_email_status,
      ip, user_agent, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      intake.id,
      intake.firstName,
      intake.lastName,
      intake.phone,
      intake.email,
      intake.suitSize,
      intake.suitColor,
      intake.ticketNumber ?? '',
      intake.tailoringNotes,
      intake.additionalNotes ?? '',
      intake.needByDate,
      'pending',
      'pending',
      intake.ip ?? null,
      intake.userAgent ?? null,
      intake.createdAt,
    ],
  });
  return { ok: true, intake };
}

/**
 * List intakes for the staff dashboard.
 * @param {object} opts
 * @param {string} [opts.status]  - filter by tailor_status: 'pending'|'sent'|'back'|'picked_up'|'all'
 * @param {string} [opts.search]  - case-insensitive substring across name/email/phone
 * @param {number} [opts.limit]   - max rows (default 200)
 */
export async function listIntakes({ status, search, limit = 200 } = {}) {
  const db = getDb();
  const where = [];
  const args = [];

  if (status && status !== 'all') {
    where.push('tailor_status = ?');
    args.push(status);
  }

  if (search && typeof search === 'string' && search.trim().length > 0) {
    const like = `%${search.trim().toLowerCase()}%`;
    where.push('(LOWER(first_name) LIKE ? OR LOWER(last_name) LIKE ? OR LOWER(email) LIKE ? OR phone LIKE ?)');
    args.push(like, like, like, like);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const sql = `SELECT * FROM intakes ${whereSql} ORDER BY need_by_date ASC, created_at DESC LIMIT ?`;
  args.push(Math.max(1, Math.min(1000, Number(limit) || 200)));

  const result = await db.execute({ sql, args });
  return result.rows.map(rowToIntake);
}

const VALID_TAILOR_STATUSES = ['pending', 'sent', 'back', 'picked_up'];

export async function updateIntakeTailorStatus(id, status) {
  if (!VALID_TAILOR_STATUSES.includes(status)) {
    return { ok: false, error: 'INVALID_STATUS' };
  }
  const db = getDb();
  const result = await db.execute({
    sql: 'UPDATE intakes SET tailor_status = ? WHERE id = ?',
    args: [status, id],
  });
  if (result.rowsAffected === 0) return { ok: false, error: 'NOT_FOUND' };
  return { ok: true };
}

const EDITABLE_INTAKE_COLUMNS = {
  firstName:       'first_name',
  lastName:        'last_name',
  phone:           'phone',
  email:           'email',
  ticketNumber:    'ticket_number',
  tailoringNotes:  'tailoring_notes',
  additionalNotes: 'additional_notes',
  needByDate:      'need_by_date',
};

export async function updateIntakeFields(id, fields) {
  const sets = [];
  const args = [];
  for (const [key, col] of Object.entries(EDITABLE_INTAKE_COLUMNS)) {
    if (fields[key] === undefined) continue;
    sets.push(`${col} = ?`);
    args.push(fields[key]);
  }
  if (sets.length === 0) return { ok: false, error: 'NO_FIELDS' };
  args.push(id);
  const db = getDb();
  const result = await db.execute({
    sql: `UPDATE intakes SET ${sets.join(', ')} WHERE id = ?`,
    args,
  });
  if (result.rowsAffected === 0) return { ok: false, error: 'NOT_FOUND' };
  return { ok: true };
}

export async function deleteIntake(id) {
  const db = getDb();
  const result = await db.execute({
    sql: 'DELETE FROM intakes WHERE id = ?',
    args: [id],
  });
  if (result.rowsAffected === 0) return { ok: false, error: 'NOT_FOUND' };
  return { ok: true };
}

export async function findIntakeById(id) {
  const db = getDb();
  const rs = await db.execute({
    sql: 'SELECT * FROM intakes WHERE id = ? LIMIT 1',
    args: [id],
  });
  if (rs.rows.length === 0) return null;
  return rowToIntake(rs.rows[0]);
}

export async function markIntakePickupNoticeSent(id, { status = 'sent', sentAt } = {}) {
  const db = getDb();
  const result = await db.execute({
    sql: 'UPDATE intakes SET pickup_notice_status = ?, pickup_notice_sent_at = ? WHERE id = ?',
    args: [status, sentAt ?? new Date().toISOString(), id],
  });
  if (result.rowsAffected === 0) return { ok: false, error: 'NOT_FOUND' };
  return { ok: true };
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

/**
 * Booking staff statuses a staff member may assign from the dashboard.
 *
 * Every booking starts life as 'new' (written directly by createBooking) — a
 * "New Booking" until staff close it out. 'new' drives the dashboard's red
 * badge and is intentionally NOT in this list: it is never staff-assignable,
 * staff clear it by marking the appointment's outcome below.
 *
 * showed    — the customer came in but did not buy
 * closed    — the customer came in and bought (staff record the sale amount)
 * no_show   — the customer did not attend
 */
export const VALID_BOOKING_STAFF_STATUSES = [
  'showed', 'closed', 'no_show',
];

/**
 * List booking appointments for the staff dashboard.
 * @param {object} opts
 * @param {string} [opts.status]   - filter by staff_status, or 'all'
 * @param {string} [opts.audience] - filter by audience, or 'all'
 * @param {string} [opts.search]   - case-insensitive substring across customer name/email/phone
 * @param {number} [opts.limit]    - max rows (default 200, clamped 1-1000)
 */
export async function listBookings({ status, audience, search, limit = 200 } = {}) {
  const db = getDb();
  const where = [];
  const args = [];

  if (status && status !== 'all') {
    where.push('staff_status = ?');
    args.push(status);
  }

  if (audience && audience !== 'all') {
    where.push('audience = ?');
    args.push(audience);
  }

  if (search && typeof search === 'string' && search.trim().length > 0) {
    // customer_json holds firstName/lastName/email/phone — a substring match
    // across the JSON blob covers all of them in one clause.
    where.push('LOWER(customer_json) LIKE ?');
    args.push(`%${search.trim().toLowerCase()}%`);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const sql = `SELECT * FROM bookings ${whereSql} ORDER BY slot_date ASC, slot_time ASC LIMIT ?`;
  args.push(Math.max(1, Math.min(1000, Number(limit) || 200)));

  const result = await db.execute({ sql, args });
  return result.rows.map(rowToBooking);
}

/** Count of unacknowledged bookings — drives the dashboard's red badge. */
export async function countNewBookings() {
  const db = getDb();
  const result = await db.execute(
    "SELECT COUNT(*) AS n FROM bookings WHERE staff_status = 'new'"
  );
  return Number(result.rows[0]?.n ?? 0);
}

export async function updateBookingStaffStatus(id, status) {
  if (!VALID_BOOKING_STAFF_STATUSES.includes(status)) {
    return { ok: false, error: 'INVALID_STATUS' };
  }
  const db = getDb();
  const result = await db.execute({
    sql: 'UPDATE bookings SET staff_status = ? WHERE id = ?',
    args: [status, id],
  });
  if (result.rowsAffected === 0) return { ok: false, error: 'NOT_FOUND' };
  return { ok: true };
}

/**
 * Edit a booking's customer details, audience answers, and/or slot from the
 * staff dashboard. customer/answers are partial objects merged onto the
 * existing JSON; slotDate/slotTime overwrite the slot columns.
 * @returns { ok: true } | { ok: false, error: 'NOT_FOUND'|'NO_FIELDS'|'SLOT_TAKEN' }
 */
export async function updateBookingFields(id, { customer, answers, slotDate, slotTime } = {}) {
  const db = getDb();
  const existing = await findBookingById(id);
  if (!existing) return { ok: false, error: 'NOT_FOUND' };

  const sets = [];
  const args = [];

  if (customer && Object.keys(customer).length > 0) {
    sets.push('customer_json = ?');
    args.push(JSON.stringify({ ...existing.customer, ...customer }));
  }
  if (answers && Object.keys(answers).length > 0) {
    sets.push('answers_json = ?');
    args.push(JSON.stringify({ ...existing.answers, ...answers }));
  }
  if (slotDate !== undefined) { sets.push('slot_date = ?'); args.push(slotDate); }
  if (slotTime !== undefined) { sets.push('slot_time = ?'); args.push(slotTime); }

  if (sets.length === 0) return { ok: false, error: 'NO_FIELDS' };
  args.push(id);

  try {
    const result = await db.execute({
      sql: `UPDATE bookings SET ${sets.join(', ')} WHERE id = ?`,
      args,
    });
    if (result.rowsAffected === 0) return { ok: false, error: 'NOT_FOUND' };
    return { ok: true };
  } catch (err) {
    // UNIQUE(slot_date, slot_time) — staff moved the appointment onto a slot
    // another booking already holds.
    const msg = String(err?.message || err);
    if (msg.includes('UNIQUE') || msg.includes('SQLITE_CONSTRAINT')) {
      return { ok: false, error: 'SLOT_TAKEN' };
    }
    throw err;
  }
}

export async function deleteBooking(id) {
  const db = getDb();
  const result = await db.execute({
    sql: 'DELETE FROM bookings WHERE id = ?',
    args: [id],
  });
  if (result.rowsAffected === 0) return { ok: false, error: 'NOT_FOUND' };
  return { ok: true };
}
