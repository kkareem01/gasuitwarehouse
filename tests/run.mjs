/**
 * Tiny unit-test runner using Node's built-in assert. No deps.
 * Run: node tests/run.mjs
 */

import assert from 'node:assert/strict';
import { rm, readFile } from 'node:fs/promises';
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
import { ownerBookingSmsBody, notifyOwnerOfBooking } from '../lib/notify-owner-booking.mjs';
import { nurtureT1Sms, nurtureDayOfSms, nurtureT3Sms } from '../lib/reminder-sms.mjs';
import { runNurtureT1 } from '../lib/cron.mjs';

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
console.log('\noffers.mjs findUnredeemedCodeForOffer');
// =========================================================================

await testAsync('findUnredeemedCodeForOffer: recovers reserved/issued, ignores redeemed', async () => {
  // Fresh test DB (TURSO_DATABASE_URL from .env.test, defaults to file:test.db).
  await rm('test.db', { force: true });
  await rm('test.db-journal', { force: true });
  await migrate();

  const { createLead } = await import('../lib/store.mjs');
  const { insertRedemptionCode, findUnredeemedCodeForOffer } = await import('../lib/offers.mjs');
  const db = getDb();

  const offerId = 'OF-RESUME-TEST';
  await db.execute({
    sql: `INSERT INTO lead_magnet_offers
          (id, name, item_description, retail_value_cents, week_start, week_end,
           redemption_cap, redemptions_used, active, image_url, created_at)
          VALUES (?, 'Free Silk Tie', 'A tie', 4500, '2099-01-01', '2099-12-31', 50, 0, 1, NULL, ?)`,
    args: [offerId, new Date().toISOString()],
  });

  const email = 'resume@test.co';
  const lead = await createLead(
    { audience: 'general', firstName: 'Re', lastName: 'Sume', phone: '(470) 555-0001', email, consent: true },
    newLeadId
  );
  await insertRedemptionCode({
    code: 'GIFT-AAAAAA',
    leadId: lead.lead.id,
    offerId,
    expiresAt: '2099-12-31T00:00:00.000Z',
  });

  // reserved → recoverable
  const reserved = await findUnredeemedCodeForOffer(email, offerId);
  assert.ok(reserved, 'reserved code should be found');
  assert.equal(reserved.status, 'reserved');
  assert.equal(reserved.code, 'GIFT-AAAAAA');
  assert.equal(reserved.leadId, lead.lead.id);

  // issued → still recoverable
  await db.execute({ sql: `UPDATE redemption_codes SET status = 'issued' WHERE code = ?`, args: ['GIFT-AAAAAA'] });
  const issued = await findUnredeemedCodeForOffer(email, offerId);
  assert.ok(issued && issued.status === 'issued', 'issued code should be found');

  // redeemed → not "unredeemed", must not be returned
  await db.execute({ sql: `UPDATE redemption_codes SET status = 'redeemed' WHERE code = ?`, args: ['GIFT-AAAAAA'] });
  assert.equal(await findUnredeemedCodeForOffer(email, offerId), null, 'redeemed code must not be returned');

  // unknown email / unknown offer → null
  assert.equal(await findUnredeemedCodeForOffer('nobody@test.co', offerId), null);
  assert.equal(await findUnredeemedCodeForOffer(email, 'OF-NOPE'), null);
});

// =========================================================================
console.log('\ncron.mjs runNurture email + SMS reminders');
// =========================================================================

// Runs before the concurrent-createBooking test below, which closes the
// shared db client as its final cleanup (getDb() has no reset).
await testAsync('runNurtureT1: sends email + SMS once each, idempotent per channel', async () => {
  await migrate();
  const { createBooking } = await import('../lib/store.mjs');
  const db = getDb();

  const savedDrySms = process.env.DRY_RUN_SMS;
  process.env.DRY_RUN_SMS = 'true';
  try {
    // t1 targets bookings whose slot_date is tomorrow (UTC).
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const offerId = 'OF-NURTURE-SMS';
    await db.execute({
      sql: `INSERT INTO lead_magnet_offers
            (id, name, item_description, retail_value_cents, week_start, week_end,
             redemption_cap, redemptions_used, active, image_url, created_at)
            VALUES (?, 'Free Silk Tie', 'A tie', 4500, '2000-01-01', '2099-12-31', 50, 0, 0, NULL, ?)`,
      args: [offerId, new Date().toISOString()],
    });

    const mkBooking = async (i, time) => {
      const created = await createBooking(
        {
          audience: 'general',
          customer: { firstName: `Nur${i}`, lastName: 'Ture', phone: '(470) 555-9876', email: `nurture${i}@test.co`, consent: true },
          answers: {},
          slot: { date: tomorrow, time, durationMinutes: 30, tz: 'America/New_York' },
          consent: true,
        },
        newBookingId
      );
      assert.ok(created.ok, `test booking ${i} insert failed`);
      await db.execute({
        sql: `INSERT INTO redemption_codes
              (code, lead_id, booking_id, offer_id, status, issued_at, expires_at, redeemed_at, redeemed_by_staff, created_at)
              VALUES (?, 'LD-NURTURE', ?, ?, 'issued', ?, '2099-12-31T00:00:00.000Z', NULL, NULL, ?)`,
        args: [`GIFT-NUR${i}00`, created.booking.id, offerId, new Date().toISOString(), new Date().toISOString()],
      });
      return created.booking.id;
    };

    const b1 = await mkBooking(1, '09:00');

    // First run: both channels fire for the one candidate.
    const run1 = await runNurtureT1();
    assert.equal(run1.candidates, 1, `expected 1 candidate, got ${run1.candidates}`);
    assert.equal(run1.sent, 1, `email sent=${run1.sent} failed=${run1.failed}`);
    assert.equal(run1.smsSent, 1, `sms sent=${run1.smsSent} failed=${run1.smsFailed}`);

    const sentRows = await db.execute({
      sql: 'SELECT kind FROM nurture_sent WHERE booking_id = ? ORDER BY kind',
      args: [b1],
    });
    assert.deepEqual(sentRows.rows.map((r) => r.kind), ['t1', 't1-sms']);

    const rendered = await readFile('tmp/last-sms.txt', 'utf8');
    assert.match(rendered, /To: \+14705559876/);
    assert.match(rendered, /GIFT-NUR100/);
    assert.match(rendered, /Reply STOP to opt out\./);

    // Second run: fully sent → no candidates, nothing re-sent.
    const run2 = await runNurtureT1();
    assert.equal(run2.candidates, 0, 'already-sent booking must not be a candidate');

    // Channel independence: email already recorded → only the SMS goes out.
    const b2 = await mkBooking(2, '09:30');
    await db.execute({
      sql: `INSERT INTO nurture_sent (booking_id, kind, sent_at) VALUES (?, 't1', ?)`,
      args: [b2, new Date().toISOString()],
    });
    const run3 = await runNurtureT1();
    assert.equal(run3.candidates, 1);
    assert.equal(run3.sent, 0, 'email must not re-send');
    assert.equal(run3.smsSent, 1, 'sms must still send');
  } finally {
    if (savedDrySms === undefined) delete process.env.DRY_RUN_SMS;
    else process.env.DRY_RUN_SMS = savedDrySms;
  }
});

// =========================================================================
console.log('\nstore.mjs concurrent createBooking');
// =========================================================================

await testAsync('createBooking: 50 concurrent writes at same slot, exactly one wins', async () => {
  // Uses TURSO_DATABASE_URL from .env.test (defaults to file:test.db). The DB
  // was already wiped + migrated by the findUnredeemedCodeForOffer test above;
  // re-wiping here would move the file out from under the open connection
  // (SQLITE_READONLY_DBMOVED). migrate() is idempotent, so just re-run it.
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
console.log('\nnotify-owner-booking.mjs');
// =========================================================================

const ownerBooking = {
  id: 'BK-TEST-123',
  audience: 'weddings',
  slot: { date: '2026-08-15', time: '14:30', tz: 'America/New_York', durationMinutes: 30 },
  customer: { firstName: 'Marcus', lastName: 'Webb', phone: '+14045551234', email: 'm@example.com' },
  answers: { 'Party size': '5', 'Event date': '2026-09-20' },
};

test('ownerBookingSmsBody leads with name, phone, and human-readable slot', () => {
  const body = ownerBookingSmsBody({
    booking: ownerBooking,
    audienceLabel: 'Wedding party fitting',
    businessName: 'GA Suit Warehouse',
  });
  assert.match(body, /NEW BOOKING/);
  assert.match(body, /Wedding party fitting/);
  assert.match(body, /Marcus Webb/);
  assert.match(body, /\+14045551234/);
  assert.match(body, /Saturday, August 15, 2026/);
  assert.match(body, /2:30 PM/);
  assert.match(body, /BK-TEST-123/);
});

test('ownerBookingSmsBody survives a booking with no answers and no phone', () => {
  const bare = { ...ownerBooking, answers: {}, customer: { firstName: 'Ann', lastName: 'Lee' } };
  const body = ownerBookingSmsBody({ booking: bare, audienceLabel: 'General fitting' });
  assert.match(body, /Ann Lee/);
  assert.match(body, /no phone/);
  assert.ok(!body.includes('undefined'), 'body must not leak undefined');
});

test('ownerBookingSmsBody stays within two SMS segments', () => {
  const noisy = {
    ...ownerBooking,
    answers: { Notes: 'x'.repeat(500), More: 'y'.repeat(500) },
  };
  const body = ownerBookingSmsBody({ booking: noisy, audienceLabel: 'Wedding party fitting' });
  assert.ok(body.length <= 320, `body was ${body.length} chars`);
});

await testAsync('notifyOwnerOfBooking skips cleanly when OWNER_PHONE is unset', async () => {
  const saved = process.env.OWNER_PHONE;
  delete process.env.OWNER_PHONE;
  const res = await notifyOwnerOfBooking(ownerBooking, 'Wedding party fitting');
  if (saved !== undefined) process.env.OWNER_PHONE = saved;
  assert.equal(res.ok, false);
  assert.equal(res.skipped, true);
});

await testAsync('notifyOwnerOfBooking sends to OWNER_PHONE in dry-run mode', async () => {
  const savedPhone = process.env.OWNER_PHONE;
  const savedDry = process.env.DRY_RUN_SMS;
  process.env.OWNER_PHONE = '7704468888';
  process.env.DRY_RUN_SMS = 'true';
  const res = await notifyOwnerOfBooking(ownerBooking, 'Wedding party fitting');
  process.env.OWNER_PHONE = savedPhone;
  process.env.DRY_RUN_SMS = savedDry;
  assert.equal(res.ok, true, res.error);
  assert.equal(res.dryRun, true);
  const rendered = await readFile('tmp/last-sms.txt', 'utf8');
  assert.match(rendered, /To: \+17704468888/);
  assert.match(rendered, /Marcus Webb/);
});

// =========================================================================
console.log('\nreminder-sms.mjs templates');
// =========================================================================

const reminderEnv = {
  businessName: 'GA Suit Warehouse',
  businessAddress: '150 Pearl Nix Pkwy, Gainesville GA 30501',
  businessPhone: '+14705957775',
};
const reminderBooking = {
  id: 'BK-SMS-TEST',
  audience: 'general',
  customer: { firstName: 'Jonathan', lastName: 'Testerson', phone: '(470) 555-1234', email: 'j@x.co' },
  slot: { date: '2099-05-15', time: '14:30', durationMinutes: 30, tz: 'America/New_York' },
};
const reminderOffer = { id: 'OF-X', name: 'Free Silk Tie', itemDescription: 'A tie' };
const reminderArgs = { booking: reminderBooking, offer: reminderOffer, code: 'GIFT-ABC123', ...reminderEnv };

for (const [name, builder] of [
  ['nurtureT1Sms', nurtureT1Sms],
  ['nurtureDayOfSms', nurtureDayOfSms],
  ['nurtureT3Sms', nurtureT3Sms],
]) {
  test(`${name} names the business, time, code, and opt-out`, () => {
    const body = builder(reminderArgs);
    assert.match(body, /GA Suit Warehouse/);
    assert.match(body, /2:30 PM/);
    assert.match(body, /GIFT-ABC123/);
    assert.match(body, /Reply STOP to opt out\./);
  });
  test(`${name} stays within two SMS segments`, () => {
    const body = builder(reminderArgs);
    assert.ok(body.length <= 320, `body was ${body.length} chars`);
  });
}

test('reminder SMS bodies survive a missing first name', () => {
  const anon = { ...reminderBooking, customer: { ...reminderBooking.customer, firstName: '' } };
  const body = nurtureT1Sms({ ...reminderArgs, booking: anon });
  assert.match(body, /Hi there,/);
});

// =========================================================================
console.log('\n— results —');
console.log(results.join('\n'));
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
