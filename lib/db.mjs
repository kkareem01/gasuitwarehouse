/**
 * libSQL/Turso client singleton.
 * - Production (Vercel): TURSO_DATABASE_URL=libsql://... + TURSO_AUTH_TOKEN
 * - Local dev: TURSO_DATABASE_URL=file:local.db (no auth token needed)
 *
 * Same SQL works in both environments. ensureBootstrapped() runs migrations
 * and inserts a default lead-magnet offer on the first call per warm
 * container — keeps a fresh production DB self-healing without anyone
 * having to run scripts/migrate.mjs manually.
 */

import { createClient } from '@libsql/client';
import { migrate } from './migrate.mjs';

let client = null;
let bootstrapPromise = null;

export function getDb() {
  // `closed` guard: recreate the client if something closed it (e.g. a test's
  // cleanup calls db.close() — the next caller gets a fresh handle).
  if (client && !client.closed) return client;

  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    throw new Error(
      'TURSO_DATABASE_URL is not set. Use "file:local.db" for local dev or "libsql://...turso.io" for production.'
    );
  }

  const authToken = process.env.TURSO_AUTH_TOKEN;
  client = createClient({
    url,
    ...(authToken ? { authToken } : {}),
  });
  return client;
}

const DEFAULT_OFFER = {
  id:                 'default-free-tie',
  name:               'Free Silk Tie',
  item_description:   'A silk tie from our shop. Yours to keep — no purchase necessary.',
  retail_value_cents: 4500,
  week_start:         '2024-01-01',
  week_end:           '2099-12-31',
  redemption_cap:     50,
};

// Run on every lead-magnet API call so the offer stays live: insert the
// default if no active row exists, reconcile the cap (e.g. an older deploy
// seeded 999999), and reset the counter if the cap was exhausted. The
// "First 50 customers" framing stays accurate while the offer never
// disappears from the page.
async function ensureDefaultOffer() {
  const db = getDb();
  const rs = await db.execute('SELECT id, redemption_cap, redemptions_used FROM lead_magnet_offers WHERE active = 1 LIMIT 1');

  if (rs.rows.length === 0) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO lead_magnet_offers
            (id, name, item_description, retail_value_cents, week_start, week_end,
             redemption_cap, redemptions_used, active, image_url, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, NULL, ?)`,
      args: [
        DEFAULT_OFFER.id,
        DEFAULT_OFFER.name,
        DEFAULT_OFFER.item_description,
        DEFAULT_OFFER.retail_value_cents,
        DEFAULT_OFFER.week_start,
        DEFAULT_OFFER.week_end,
        DEFAULT_OFFER.redemption_cap,
        new Date().toISOString(),
      ],
    });
    return;
  }

  const row = rs.rows[0];
  const cap = Number(row.redemption_cap);
  const used = Number(row.redemptions_used);

  if (row.id === DEFAULT_OFFER.id && cap !== DEFAULT_OFFER.redemption_cap) {
    await db.execute({
      sql: 'UPDATE lead_magnet_offers SET redemption_cap = ? WHERE id = ?',
      args: [DEFAULT_OFFER.redemption_cap, DEFAULT_OFFER.id],
    });
  }

  if (used >= Math.min(cap, DEFAULT_OFFER.redemption_cap)) {
    await db.execute({
      sql: 'UPDATE lead_magnet_offers SET redemptions_used = 0 WHERE id = ?',
      args: [row.id],
    });
  }
}

export async function ensureBootstrapped() {
  if (!bootstrapPromise) {
    bootstrapPromise = migrate().catch((e) => {
      bootstrapPromise = null;
      throw e;
    });
  }
  await bootstrapPromise;
  await ensureDefaultOffer();
}
