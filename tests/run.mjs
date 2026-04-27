/**
 * Tiny unit-test runner using Node's built-in assert. No deps.
 * Run: node tests/run.mjs
 */

import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';

import { migrate } from '../lib/migrate.mjs';
import { getDb } from '../lib/db.mjs';

import {
  validatePhone,
  validateEmail,
  validateName,
  validateBookingPayload,
  validateLeadPayload,
} from '../lib/validate.mjs';
import {
  generateSlotsForDate,
  filterAvailableSlots,
  listMonth,
  dayOfWeek,
  addDays,
  daysInMonth,
} from '../lib/slots.mjs';
import { buildICS } from '../lib/ics.mjs';
import { newBookingId, newLeadId } from '../lib/id.mjs';
import { fieldNames } from '../lib/audiences.mjs';

const results = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    results.push(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    results.push(`  ✗ ${name}\n    ${e.message}`);
    failed++;
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    results.push(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    results.push(`  ✗ ${name}\n    ${e.message}`);
    failed++;
  }
}

const baseConfig = {
  storeTimezone: 'America/New_York',
  businessHours: {
    sun: { open: '12:00', close: '17:00' },
    mon: { open: '10:00', close: '19:00' },
    tue: { open: '10:00', close: '19:00' },
    wed: { open: '10:00', close: '19:00' },
    thu: { open: '10:00', close: '19:00' },
    fri: { open: '10:00', close: '19:00' },
    sat: { open: '10:00', close: '18:00' },
  },
  blackoutDates: ['2026-12-25'],
  defaultSlotDurationMinutes: 20,
  fittingTypes: {
    weddings: { label: 'Wedding fitting', slotDurationMinutes: 30, buffer: 5 },
    general:  { label: 'Styling session', slotDurationMinutes: 30, buffer: 5 },
  },
  urgencyTimerSeconds: 156,
  leadTimeMinutes: 0,
  maxAdvanceDays: 365,
};

// =========================================================================
console.log('\nvalidate.mjs');
// =========================================================================

test('validatePhone accepts (470) 595-7775 format', () => {
  const r = validatePhone('(470) 595-7775');
  assert.equal(r.ok, true);
  assert.equal(r.value, '(470) 595-7775');
});

test('validatePhone normalizes 4705957775', () => {
  const r = validatePhone('4705957775');
  assert.equal(r.ok, true);
  assert.equal(r.value, '(470) 595-7775');
});

test('validatePhone strips leading +1', () => {
  const r = validatePhone('+1 (470) 595-7775');
  assert.equal(r.ok, true);
  assert.equal(r.value, '(470) 595-7775');
});

test('validatePhone rejects 9-digit numbers', () => {
  assert.equal(validatePhone('470595777').ok, false);
});

test('validateEmail lowercases', () => {
  const r = validateEmail('John@Example.com');
  assert.equal(r.value, 'john@example.com');
});

test('validateEmail rejects bare strings', () => {
  assert.equal(validateEmail('not-an-email').ok, false);
});

test('validateName trims and rejects whitespace-only', () => {
  assert.equal(validateName('  ').ok, false);
  assert.equal(validateName(' Sam ').value, 'Sam');
});

test('validateBookingPayload rejects honeypot fill', () => {
  const r = validateBookingPayload(
    {
      audience: 'weddings',
      customer: { firstName: 'A', lastName: 'B', phone: '4705957775', email: 'a@b.co', consent: true },
      slot: { date: '2026-05-08', time: '14:00' },
      timezone: 'America/New_York',
      answers: { role: 'Groom', eventDate: '2026-09-12', partySize: 'Just me' },
      honeypot: 'http://spam.example',
      formStartedAt: 0,
    },
    Date.now()
  );
  assert.equal(r.ok, false);
});

test('validateBookingPayload rejects sub-4s submission', () => {
  const now = Date.now();
  const r = validateBookingPayload(
    {
      audience: 'weddings',
      customer: { firstName: 'A', lastName: 'B', phone: '4705957775', email: 'a@b.co', consent: true },
      slot: { date: '2026-05-08', time: '14:00' },
      answers: { role: 'Groom', eventDate: '2026-09-12', partySize: 'Just me' },
      formStartedAt: now - 1000,
    },
    now
  );
  assert.equal(r.ok, false);
});

test('validateBookingPayload accepts a complete weddings payload', () => {
  const now = Date.now();
  const r = validateBookingPayload(
    {
      audience: 'weddings',
      customer: { firstName: ' Sam ', lastName: 'Lee', phone: '+14705957775', email: 'Sam@X.com', consent: true },
      slot: { date: '2026-05-08', time: '14:00' },
      timezone: 'America/New_York',
      answers: { role: 'Groom', eventDate: '2026-09-12', partySize: '5-7' },
      formStartedAt: now - 10000,
    },
    now
  );
  assert.equal(r.ok, true, r.errors?.join(' '));
  assert.equal(r.value.customer.firstName, 'Sam');
  assert.equal(r.value.customer.email, 'sam@x.com');
  assert.equal(r.value.customer.phone, '(470) 595-7775');
});

test('validateBookingPayload rejects unknown select option', () => {
  const r = validateBookingPayload(
    {
      audience: 'weddings',
      customer: { firstName: 'A', lastName: 'B', phone: '4705957775', email: 'a@b.co', consent: true },
      slot: { date: '2026-05-08', time: '14:00' },
      answers: { role: 'Wizard', eventDate: '2026-09-12', partySize: 'Just me' },
      formStartedAt: 0,
    },
    Date.now()
  );
  assert.equal(r.ok, false);
});

test('validateLeadPayload requires consent=true', () => {
  const r = validateLeadPayload({
    audience: 'general',
    firstName: 'A',
    lastName: 'B',
    phone: '4705957775',
    consent: false,
  });
  assert.equal(r.ok, false);
});

// =========================================================================
console.log('\nslots.mjs');
// =========================================================================

test('dayOfWeek matches calendar', () => {
  // 2026-04-25 was a Saturday
  assert.equal(dayOfWeek('2026-04-25'), 6);
});

test('addDays handles month rollover', () => {
  assert.equal(addDays('2026-01-30', 5), '2026-02-04');
});

test('daysInMonth Feb 2024 leap year', () => {
  assert.equal(daysInMonth(2024, 2), 29);
});

test('generateSlotsForDate returns [] on blackout', () => {
  const slots = generateSlotsForDate('2026-12-25', baseConfig, 'weddings');
  assert.deepEqual(slots, []);
});

test('generateSlotsForDate weddings on Saturday produces 30+5min slots', () => {
  // 2026-04-25 is Saturday, 10:00–18:00, 30+5 = 35min step
  const slots = generateSlotsForDate('2026-04-25', baseConfig, 'weddings');
  assert.equal(slots[0], '10:00');
  assert.equal(slots[1], '10:35');
  // last slot must end <= 18:00
  const [h, m] = slots[slots.length - 1].split(':').map(Number);
  assert.ok(h * 60 + m + 30 <= 18 * 60);
});

test('filterAvailableSlots removes booked times', () => {
  const all = ['10:00', '10:35', '11:10'];
  const tomorrow = addDays(
    new Date().toISOString().slice(0, 10),
    1
  );
  const open = filterAvailableSlots(all, new Set(['10:35']), tomorrow, baseConfig);
  assert.deepEqual(open, ['10:00', '11:10']);
});

test('listMonth includes one entry per day', () => {
  const days = listMonth(2026, 5, baseConfig, 'weddings', new Map());
  assert.equal(days.length, 31);
  assert.equal(days[0].date, '2026-05-01');
});

// =========================================================================
console.log('\nics.mjs');
// =========================================================================

test('buildICS contains required fields', () => {
  const ics = buildICS({
    id: 'BK-TEST',
    slot: { date: '2026-05-08', time: '14:00' },
    durationMinutes: 30,
    tz: 'America/New_York',
    summary: 'Test event',
    description: 'Description, with comma; and semi',
    location: '150 Pearl Nix Pkwy',
  });
  assert.ok(ics.includes('BEGIN:VCALENDAR'));
  assert.ok(ics.includes('BEGIN:VEVENT'));
  assert.ok(ics.includes('UID:BK-TEST@gasuitwarehouse.com'));
  assert.ok(ics.includes('SUMMARY:Test event'));
  // commas must be escaped
  assert.ok(ics.includes('Description\\, with comma\\; and semi'));
  // line endings are CRLF
  assert.ok(ics.includes('\r\n'));
});

test('buildICS DST: May (EDT) and February (EST) produce different UTC starts', () => {
  const dst = buildICS({
    id: 'BK-DST', slot: { date: '2026-05-08', time: '14:00' },
    durationMinutes: 30, tz: 'America/New_York',
    summary: 's', description: 'd', location: 'l',
  });
  const std = buildICS({
    id: 'BK-STD', slot: { date: '2026-02-08', time: '14:00' },
    durationMinutes: 30, tz: 'America/New_York',
    summary: 's', description: 'd', location: 'l',
  });
  // EDT 14:00 = 18:00 UTC; EST 14:00 = 19:00 UTC
  assert.ok(dst.includes('DTSTART:20260508T180000Z'), 'EDT start should be 18:00Z');
  assert.ok(std.includes('DTSTART:20260208T190000Z'), 'EST start should be 19:00Z');
});

// =========================================================================
console.log('\nid.mjs');
// =========================================================================

test('newBookingId / newLeadId have correct shape', () => {
  const b = newBookingId();
  const l = newLeadId();
  assert.ok(/^BK-[A-F0-9]{8}$/.test(b), `unexpected ${b}`);
  assert.ok(/^LD-[A-F0-9]{8}$/.test(l), `unexpected ${l}`);
});

test('newBookingId is unique across 1000 calls', () => {
  const set = new Set();
  for (let i = 0; i < 1000; i++) set.add(newBookingId());
  assert.equal(set.size, 1000);
});

// =========================================================================
console.log('\nstore.mjs concurrent createBooking');
// =========================================================================

await testAsync('createBooking: 50 concurrent writes at same slot, exactly one wins', async () => {
  // Uses TURSO_DATABASE_URL from .env.test (defaults to file:test.db).
  // Wipe the test DB file before running so previous test rows don't pollute.
  await rm('test.db', { force: true });
  await rm('test.db-journal', { force: true });
  await migrate();

  const { createBooking } = await import('../lib/store.mjs');
  const db = getDb();

  const make = (i) => ({
    audience: 'weddings',
    customer: { firstName: `F${i}`, lastName: 'Last', phone: '(470) 555-0000', email: `a${i}@b.co`, consent: true },
    answers: {},
    slot: { date: '2099-12-31', time: '10:00', durationMinutes: 30, tz: 'America/New_York' },
    consent: true,
  });

  // 50 concurrent attempts at same slot — exactly one should succeed (UNIQUE constraint)
  const same = await Promise.all(
    Array.from({ length: 50 }, (_, i) => createBooking(make(i), newBookingId))
  );
  const sameWins = same.filter((r) => r.ok).length;
  const sameFails = same.filter((r) => !r.ok && r.error === 'SLOT_TAKEN').length;
  assert.equal(sameWins, 1, `expected 1 success, got ${sameWins}`);
  assert.equal(sameFails, 49, `expected 49 SLOT_TAKEN, got ${sameFails}`);

  // 50 concurrent attempts at distinct slots — all should succeed with unique ids
  const distinct = await Promise.all(
    Array.from({ length: 50 }, (_, i) =>
      createBooking(
        {
          ...make(i),
          slot: { date: '2099-12-30', time: `${String(10 + Math.floor(i / 10)).padStart(2, '0')}:${String((i % 10) * 5).padStart(2, '0')}`, durationMinutes: 30, tz: 'America/New_York' },
        },
        newBookingId
      )
    )
  );
  const okCount = distinct.filter((r) => r.ok).length;
  assert.equal(okCount, 50, `expected 50 successful inserts, got ${okCount}`);
  const ids = new Set(distinct.filter((r) => r.ok).map((r) => r.booking.id));
  assert.equal(ids.size, 50, 'ids must be unique');

  // Cleanup test DB
  await db.close?.();
  await rm('test.db', { force: true });
  await rm('test.db-journal', { force: true });
});

// =========================================================================
console.log('\naudiences.mjs');
// =========================================================================

test('all audiences expose at least 3 fields', () => {
  for (const a of ['weddings', 'general']) {
    const names = fieldNames(a);
    assert.ok(names.length >= 3, `${a} has ${names.length}`);
  }
});

// =========================================================================
console.log('\n— results —');
console.log(results.join('\n'));
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
