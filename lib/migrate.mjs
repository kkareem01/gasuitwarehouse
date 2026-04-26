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
];

export async function migrate() {
  const db = getDb();
  for (const sql of STATEMENTS) {
    await db.execute(sql);
  }
}
