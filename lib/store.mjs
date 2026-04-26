/**
 * File-backed Repository for bookings + leads.
 * Mutex serializes all writes; atomic temp-file + rename prevents torn writes.
 * Single Node process only — do not horizontally scale without migrating to SQLite.
 */

import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';

const FILES = {
  bookings: 'data/bookings.json',
  leads: 'data/leads.json',
};

let chain = Promise.resolve();
function withLock(fn) {
  const next = chain.then(fn, fn);
  chain = next.catch(() => {});
  return next;
}

async function readJsonArray(path) {
  if (!existsSync(path)) return [];
  const raw = await readFile(path, 'utf8');
  if (raw.trim().length === 0) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error(`${path} did not contain a JSON array`);
    }
    return parsed;
  } catch (err) {
    // Loud failure: don't silently overwrite a corrupt file.
    throw new Error(`Failed to parse ${path}: ${err.message}`);
  }
}

async function writeJsonArrayAtomic(path, data) {
  const tmp = `${path}.tmp`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await rename(tmp, path);
}

export async function findBookingById(id) {
  const all = await readJsonArray(FILES.bookings);
  return all.find((b) => b.id === id) ?? null;
}

export async function listBookingsBySlot(date, audience) {
  const all = await readJsonArray(FILES.bookings);
  return all.filter((b) => b.slot.date === date && (audience ? b.audience === audience : true));
}

export async function listBookingsByMonth(year, month, audience) {
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  const all = await readJsonArray(FILES.bookings);
  return all.filter(
    (b) => b.slot.date.startsWith(prefix) && (audience ? b.audience === audience : true)
  );
}

/**
 * Create a booking after re-validating the slot is still free, inside the lock.
 * @param record Full booking object except id/createdAt (this fn fills those).
 * @param idGenerator () => string
 * @returns { ok: true, booking } or { ok: false, error: 'SLOT_TAKEN' }
 */
export async function createBooking(record, idGenerator) {
  return withLock(async () => {
    const all = await readJsonArray(FILES.bookings);
    const conflict = all.find(
      (b) => b.slot.date === record.slot.date && b.slot.time === record.slot.time
    );
    if (conflict) return { ok: false, error: 'SLOT_TAKEN' };

    const booking = {
      ...record,
      id: idGenerator(),
      createdAt: new Date().toISOString(),
    };
    const next = [...all, booking];
    await writeJsonArrayAtomic(FILES.bookings, next);
    return { ok: true, booking };
  });
}

export async function createLead(record, idGenerator) {
  return withLock(async () => {
    const all = await readJsonArray(FILES.leads);
    const lead = {
      ...record,
      id: idGenerator(),
      createdAt: new Date().toISOString(),
    };
    const next = [...all, lead];
    await writeJsonArrayAtomic(FILES.leads, next);
    return { ok: true, lead };
  });
}

export async function updateBookingEmailStatus(id, status, detail) {
  return withLock(async () => {
    const all = await readJsonArray(FILES.bookings);
    const idx = all.findIndex((b) => b.id === id);
    if (idx === -1) return { ok: false, error: 'NOT_FOUND' };
    const next = all.map((b, i) =>
      i === idx ? { ...b, emailStatus: status, emailDetail: detail ?? null } : b
    );
    await writeJsonArrayAtomic(FILES.bookings, next);
    return { ok: true };
  });
}
