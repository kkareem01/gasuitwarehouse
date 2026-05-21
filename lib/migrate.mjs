/**
 * Idempotent schema migration. Safe to run multiple times.
 * UNIQUE(slot_date, slot_time) preserves the existing global "one booking per
 * physical time slot" constraint that lib/store.mjs (the file version) enforced
 * via mutex + in-memory check.
 */

import { getDb } from './db.mjs';

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS bookings (
    id              TEXT PRIMARY KEY,
    audience        TEXT NOT NULL,
    customer_json   TEXT NOT NULL,
    answers_json    TEXT NOT NULL,
    slot_date       TEXT NOT NULL,
    slot_time       TEXT NOT NULL,
    slot_duration   INTEGER NOT NULL,
    slot_tz         TEXT NOT NULL,
    display_tz      TEXT,
    consent         INTEGER NOT NULL,
    lead_id         TEXT,
    ip              TEXT,
    user_agent      TEXT,
    email_status    TEXT,
    email_detail    TEXT,
    created_at      TEXT NOT NULL,
    UNIQUE(slot_date, slot_time)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_bookings_date_audience
     ON bookings(slot_date, audience)`,
  `CREATE INDEX IF NOT EXISTS idx_bookings_month
     ON bookings(slot_date)`,
  `CREATE TABLE IF NOT EXISTS leads (
    id           TEXT PRIMARY KEY,
    audience     TEXT NOT NULL,
    first_name   TEXT NOT NULL,
    last_name    TEXT,
    phone        TEXT NOT NULL,
    consent      INTEGER NOT NULL,
    ip           TEXT,
    user_agent   TEXT,
    created_at   TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS lead_magnet_offers (
    id                  TEXT PRIMARY KEY,
    name                TEXT NOT NULL,
    item_description    TEXT NOT NULL,
    retail_value_cents  INTEGER NOT NULL,
    week_start          TEXT NOT NULL,
    week_end            TEXT NOT NULL,
    redemption_cap      INTEGER NOT NULL,
    redemptions_used    INTEGER NOT NULL DEFAULT 0,
    active              INTEGER NOT NULL DEFAULT 0,
    image_url           TEXT,
    created_at          TEXT NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_offers_active_one
     ON lead_magnet_offers(active) WHERE active = 1`,
  `CREATE TABLE IF NOT EXISTS redemption_codes (
    code               TEXT PRIMARY KEY,
    lead_id            TEXT NOT NULL,
    booking_id         TEXT,
    offer_id           TEXT NOT NULL,
    status             TEXT NOT NULL,
    issued_at          TEXT,
    expires_at         TEXT NOT NULL,
    redeemed_at        TEXT,
    redeemed_by_staff  TEXT,
    created_at         TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_codes_booking ON redemption_codes(booking_id)`,
  `CREATE INDEX IF NOT EXISTS idx_codes_lead ON redemption_codes(lead_id)`,
  `CREATE INDEX IF NOT EXISTS idx_codes_status_expires ON redemption_codes(status, expires_at)`,
  `CREATE TABLE IF NOT EXISTS nurture_sent (
    booking_id TEXT NOT NULL,
    kind       TEXT NOT NULL,
    sent_at    TEXT NOT NULL,
    PRIMARY KEY (booking_id, kind)
  )`,
  `CREATE TABLE IF NOT EXISTS intakes (
    id                     TEXT PRIMARY KEY,
    first_name             TEXT NOT NULL,
    last_name              TEXT NOT NULL,
    phone                  TEXT NOT NULL,
    email                  TEXT NOT NULL,
    suit_size              TEXT NOT NULL,
    suit_color             TEXT NOT NULL,
    ticket_number          TEXT NOT NULL DEFAULT '',
    tailoring_notes        TEXT NOT NULL,
    additional_notes       TEXT NOT NULL DEFAULT '',
    need_by_date           TEXT NOT NULL,
    tailor_status          TEXT NOT NULL DEFAULT 'pending',
    review_email_status    TEXT NOT NULL DEFAULT 'pending',
    review_email_sent_at   TEXT,
    pickup_notice_status   TEXT NOT NULL DEFAULT 'pending',
    pickup_notice_sent_at  TEXT,
    sheets_status          TEXT NOT NULL DEFAULT 'pending',
    sheets_detail          TEXT,
    ip                     TEXT,
    user_agent             TEXT,
    created_at             TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_intakes_need_by ON intakes(need_by_date)`,
  `CREATE INDEX IF NOT EXISTS idx_intakes_review_status ON intakes(review_email_status)`,
  `CREATE TABLE IF NOT EXISTS special_orders (
    id                       TEXT PRIMARY KEY,
    first_name               TEXT NOT NULL DEFAULT '',
    last_name                TEXT NOT NULL DEFAULT '',
    phone                    TEXT NOT NULL DEFAULT '',
    email                    TEXT NOT NULL DEFAULT '',
    item_type                TEXT NOT NULL,
    color                    TEXT NOT NULL DEFAULT '',
    size                     TEXT NOT NULL DEFAULT '',
    description              TEXT NOT NULL DEFAULT '',
    additional_notes         TEXT NOT NULL DEFAULT '',
    need_by_date             TEXT NOT NULL DEFAULT '',
    order_status             TEXT NOT NULL DEFAULT 'pending',
    arrival_notice_status    TEXT NOT NULL DEFAULT 'pending',
    arrival_notice_sent_at   TEXT,
    ordered_at               TEXT,
    arrived_at               TEXT,
    picked_up_at             TEXT,
    created_at               TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_special_orders_status ON special_orders(order_status)`,
  `CREATE INDEX IF NOT EXISTS idx_special_orders_need_by ON special_orders(need_by_date)`,
  `CREATE INDEX IF NOT EXISTS idx_special_orders_created ON special_orders(created_at)`,
];

// Indexes that reference columns added via ALTER TABLE (see INTAKES_NEW_COLUMNS).
// These must run AFTER addMissingColumns or they'll fail on legacy DBs that
// predate the new columns.
const DEFERRED_INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_intakes_pickup_status ON intakes(pickup_notice_status)`,
  `CREATE INDEX IF NOT EXISTS idx_bookings_staff_status ON bookings(staff_status)`,
];

// Columns added to the `intakes` table after the v1 schema. CREATE TABLE IF
// NOT EXISTS won't add them to a pre-existing table, so addMissingColumns
// must ALTER them in.
const INTAKES_NEW_COLUMNS = [
  ['pickup_notice_status',  "TEXT NOT NULL DEFAULT 'pending'"],
  ['pickup_notice_sent_at', 'TEXT'],
  ['ticket_number',         "TEXT NOT NULL DEFAULT ''"],
  ['additional_notes',      "TEXT NOT NULL DEFAULT ''"],
];

// Columns added to the `leads` table after the v1 schema. CREATE TABLE IF
// NOT EXISTS won't add them to a pre-existing table, so addMissingColumns
// must ALTER them in. last_name and email were on early CREATE statements
// but legacy production tables predate them, so we list them here too.
const LEADS_NEW_COLUMNS = [
  ['last_name',        'TEXT'],
  ['email',            'TEXT'],
  ['zip',              'TEXT'],
  ['occasion',         'TEXT'],
  ['needed_by_date',   'TEXT'],
  ['qualifier_answer', 'TEXT'],
  ['qualified',        'INTEGER'],
  ['source',           'TEXT'],
  ['offer_id',         'TEXT'],
];

// Columns added to the `bookings` table after the v1 schema. `staff_status`
// drives the staff dashboard's Appointments view and its "new appointment"
// badge. The DEFAULT is 'confirmed' so the ALTER itself backfills every
// pre-existing booking as already-handled — they must not flood the badge.
// createBooking writes 'new' explicitly for every booking made after this
// migration, so the default never applies to a genuinely new appointment.
const BOOKINGS_NEW_COLUMNS = [
  ['staff_status', "TEXT NOT NULL DEFAULT 'confirmed'"],
];

async function existingColumns(db, table) {
  const rs = await db.execute(`PRAGMA table_info(${table})`);
  return new Set(rs.rows.map((r) => r.name));
}

async function addMissingColumns(db) {
  const leadsCols = await existingColumns(db, 'leads');
  for (const [name, type] of LEADS_NEW_COLUMNS) {
    if (leadsCols.has(name)) continue;
    try {
      await db.execute(`ALTER TABLE leads ADD COLUMN ${name} ${type}`);
    } catch (e) {
      // SQLite throws "duplicate column name" if the column exists. Two
      // concurrent serverless cold starts can race here — swallow that
      // specific error, re-raise anything else.
      const msg = String(e?.message || '').toLowerCase();
      if (!msg.includes('duplicate column')) throw e;
    }
  }
  const intakesCols = await existingColumns(db, 'intakes');
  for (const [name, type] of INTAKES_NEW_COLUMNS) {
    if (intakesCols.has(name)) continue;
    try {
      await db.execute(`ALTER TABLE intakes ADD COLUMN ${name} ${type}`);
    } catch (e) {
      const msg = String(e?.message || '').toLowerCase();
      if (!msg.includes('duplicate column')) throw e;
    }
  }
  const bookingsCols = await existingColumns(db, 'bookings');
  for (const [name, type] of BOOKINGS_NEW_COLUMNS) {
    if (bookingsCols.has(name)) continue;
    try {
      await db.execute(`ALTER TABLE bookings ADD COLUMN ${name} ${type}`);
    } catch (e) {
      const msg = String(e?.message || '').toLowerCase();
      if (!msg.includes('duplicate column')) throw e;
    }
  }
}

export async function migrate() {
  const db = getDb();
  for (const sql of STATEMENTS) {
    await db.execute(sql);
  }
  await addMissingColumns(db);
  for (const sql of DEFERRED_INDEXES) {
    await db.execute(sql);
  }
}
