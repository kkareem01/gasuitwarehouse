/**
 * Seed 4 weeks of lead-magnet offers, starting from the current Monday.
 * The first week is set active=1; the rest are queued (active=0).
 *
 * Idempotent: re-running won't duplicate (offers keyed by id).
 *
 *   node --env-file=.env scripts/seed-offers.mjs
 */

import { migrate } from '../lib/migrate.mjs';
import { getDb } from '../lib/db.mjs';

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function startOfWeek(date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

function addDays(d, n) {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

const ITEMS = [
  { id: 'tie-pocket-square',   name: 'Free Silk Tie + Pocket Square Set',  desc: 'Silk tie paired with a matching pocket square. Yours to keep — no purchase necessary.', retailValueCents: 4500, cap: 50 },
  { id: 'leather-belt',        name: 'Free Italian Leather Belt',          desc: 'Full-grain Italian leather belt, brass buckle. Yours to keep — no purchase necessary.',          retailValueCents: 6500, cap: 50 },
  { id: 'penny-loafers',       name: 'Free Suede Penny Loafers',           desc: 'Hand-stitched suede penny loafers. Yours to keep — no purchase necessary.',                    retailValueCents: 12000, cap: 30 },
  { id: 'pocket-square-trio',  name: 'Free Pure Silk Pocket Square Trio',  desc: 'Three pure silk pocket squares in seasonal colors. Yours to keep — no purchase necessary.',    retailValueCents: 5500, cap: 50 },
];

async function seed() {
  await migrate();
  const db = getDb();

  const monday = startOfWeek(new Date());
  const now = new Date().toISOString();

  for (let i = 0; i < ITEMS.length; i++) {
    const item = ITEMS[i];
    const weekStart = addDays(monday, i * 7);
    const weekEnd = addDays(weekStart, 6);
    const id = `${item.id}-${isoDate(weekStart)}`;

    const existing = await db.execute({
      sql: 'SELECT id FROM lead_magnet_offers WHERE id = ? LIMIT 1',
      args: [id],
    });
    if (existing.rows.length > 0) {
      console.log(`exists, skipping: ${id}`);
      continue;
    }

    await db.execute({
      sql: `INSERT INTO lead_magnet_offers
            (id, name, item_description, retail_value_cents, week_start, week_end,
             redemption_cap, redemptions_used, active, image_url, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, NULL, ?)`,
      args: [
        id,
        item.name,
        item.desc,
        item.retailValueCents,
        isoDate(weekStart),
        isoDate(weekEnd),
        item.cap,
        i === 0 ? 1 : 0,
        now,
      ],
    });
    console.log(`inserted ${id} (active=${i === 0 ? 1 : 0})`);
  }

  console.log('OK: seed complete');
  process.exit(0);
}

seed().catch((err) => {
  console.error('seed failed:', err.message);
  process.exit(1);
});
