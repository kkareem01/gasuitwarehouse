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
  validateAttribution,
} from '../lib/validate.mjs';
import { formatConversionTime, buildAdsCsv } from '../lib/ads-feed.mjs';
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
import { reminderT3Email, reminderT1Email, reminderDayOfEmail } from '../lib/reminder-email.mjs';
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
      answers: { eventDate: '2026-09-12', partySize: 'Wizard' },
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

    const mkBooking = async (i, time, { withCode = true } = {}) => {
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
      if (withCode) {
        await db.execute({
          sql: `INSERT INTO redemption_codes
                (code, lead_id, booking_id, offer_id, status, issued_at, expires_at, redeemed_at, redeemed_by_staff, created_at)
                VALUES (?, 'LD-NURTURE', ?, ?, 'issued', ?, '2099-12-31T00:00:00.000Z', NULL, NULL, ?)`,
          args: [`GIFT-NUR${i}00`, created.booking.id, offerId, new Date().toISOString(), new Date().toISOString()],
        });
      }
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

    // Direct booking (no gift code) → generic reminder on both channels.
    const b3 = await mkBooking(3, '10:05', { withCode: false });
    const run4 = await runNurtureT1();
    assert.equal(run4.candidates, 1, 'codeless booking must be a candidate');
    assert.equal(run4.sent, 1, `generic email sent=${run4.sent} failed=${run4.failed}`);
    assert.equal(run4.smsSent, 1, `generic sms sent=${run4.smsSent} failed=${run4.smsFailed}`);

    const genericRows = await db.execute({
      sql: 'SELECT kind FROM nurture_sent WHERE booking_id = ? ORDER BY kind',
      args: [b3],
    });
    assert.deepEqual(genericRows.rows.map((r) => r.kind), ['t1', 't1-sms']);

    const genericSms = await readFile('tmp/last-sms.txt', 'utf8');
    assert.match(genericSms, /Nur3/);
    assert.match(genericSms, /Reply STOP to opt out\./);
    assert.ok(!genericSms.includes('GIFT-'), 'codeless sms must not mention a gift code');
    assert.ok(!genericSms.includes('undefined'), 'codeless sms must not leak undefined');

    const genericEmail = await readFile('tmp/last-email.html', 'utf8');
    assert.match(genericEmail, /Nur3/);
    assert.ok(!genericEmail.includes('GIFT-'), 'codeless email must not mention a gift code');
    assert.ok(!genericEmail.includes('undefined'), 'codeless email must not leak undefined');
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

// A single non-GSM-7 char (em dash, curly quote, ellipsis) forces UCS-2, which
// cuts the segment size from 153 to 67 and adds a segment's cost to every alert.
// Asserting on length alone cannot catch that — assert on the encoding itself.
const GSM7 =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡' +
  'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà^{}\\[~]|€';

function smsSegments(body) {
  const nonGsm = [...body].filter((c) => !GSM7.includes(c));
  const perSegment = nonGsm.length > 0 ? 67 : 153;
  return { segments: Math.ceil(body.length / perSegment), nonGsm };
}

test('ownerBookingSmsBody is GSM-7 clean (no UCS-2 downgrade)', () => {
  const body = ownerBookingSmsBody({
    booking: ownerBooking,
    audienceLabel: 'Wedding party fitting',
    businessName: 'GA Suit Warehouse',
  });
  const { nonGsm } = smsSegments(body);
  assert.deepEqual(nonGsm, [], `non-GSM-7 chars force UCS-2: ${JSON.stringify(nonGsm)}`);
});

test('ownerBookingSmsBody stays within two SMS segments, even with noisy answers', () => {
  const noisy = {
    ...ownerBooking,
    answers: { Notes: 'x'.repeat(500), More: 'y'.repeat(500) },
  };
  const body = ownerBookingSmsBody({ booking: noisy, audienceLabel: 'Wedding party fitting' });
  const { segments, nonGsm } = smsSegments(body);
  assert.deepEqual(nonGsm, [], 'must stay GSM-7 even when answers are truncated');
  assert.ok(segments <= 2, `body was ${body.length} chars = ${segments} segments`);
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
  test(`${name} (gift) names the business, time, code, and opt-out`, () => {
    const body = builder(reminderArgs);
    assert.match(body, /GA Suit Warehouse/);
    assert.match(body, /2:30 PM/);
    assert.match(body, /GIFT-ABC123/);
    assert.match(body, /Reply STOP to opt out\./);
  });
  test(`${name} (no code) drops the gift clause cleanly`, () => {
    const body = builder({ ...reminderArgs, offer: null, code: null });
    assert.match(body, /GA Suit Warehouse/);
    assert.match(body, /2:30 PM/);
    assert.match(body, /Reply STOP to opt out\./);
    assert.ok(!body.includes('GIFT-'), 'must not mention a gift code');
    assert.ok(!body.includes('undefined'), 'must not leak undefined');
  });
  for (const [variant, args] of [['gift', reminderArgs], ['no code', { ...reminderArgs, offer: null, code: null }]]) {
    test(`${name} (${variant}) is GSM-7 clean and within two segments`, () => {
      const body = builder(args);
      const { segments, nonGsm } = smsSegments(body);
      assert.deepEqual(nonGsm, [], `non-GSM-7 chars force UCS-2: ${JSON.stringify(nonGsm)}`);
      assert.ok(segments <= 2, `body was ${body.length} chars = ${segments} segments`);
    });
  }
}

test('reminder SMS bodies survive a missing first name', () => {
  const anon = { ...reminderBooking, customer: { ...reminderBooking.customer, firstName: '' } };
  const body = nurtureT1Sms({ ...reminderArgs, booking: anon });
  assert.match(body, /Hi there,/);
});

// =========================================================================
console.log('\nreminder-email.mjs generic templates');
// =========================================================================

for (const [name, builder] of [
  ['reminderT3Email', reminderT3Email],
  ['reminderT1Email', reminderT1Email],
  ['reminderDayOfEmail', reminderDayOfEmail],
]) {
  test(`${name} renders subject, name, time, and address without a gift code`, () => {
    const { subject, html, text } = builder({
      booking: reminderBooking,
      ...reminderEnv,
      confirmUrl: 'https://example.com/booking-confirmed.html?id=BK-SMS-TEST',
    });
    assert.match(subject, /2:30 PM|visit/);
    assert.match(html, /Jonathan/);
    assert.match(html, /2:30 PM/);
    assert.match(html, /150 Pearl Nix Pkwy/);
    assert.match(text, /2:30 PM/);
    for (const part of [subject, html, text]) {
      assert.ok(!part.includes('undefined'), `${name} must not leak undefined`);
      assert.ok(!part.includes('GIFT-'), `${name} must not mention a gift code`);
    }
  });
}

// =========================================================================
console.log('\nvalidateAttribution (ads tracking)');
// =========================================================================

test('validateAttribution accepts a full valid record', () => {
  const r = validateAttribution({
    gclid: 'Cj0KCQjw_TEST-123.abc',
    utm: { source: 'google', medium: 'cpc', campaign: 'suits' },
    landingPage: '/suits?gclid=x',
    referrer: 'https://www.google.com/',
  });
  assert.equal(r.gclid, 'Cj0KCQjw_TEST-123.abc');
  assert.equal(JSON.parse(r.utmJson).source, 'google');
  assert.equal(r.landingPage, '/suits?gclid=x');
});

test('validateAttribution drops malformed click ids, keeps the rest', () => {
  const r = validateAttribution({ gclid: 'has spaces!', utm: { source: 'google' } });
  assert.equal(r.gclid, null);
  assert.equal(JSON.parse(r.utmJson).source, 'google');
});

test('validateAttribution trims oversized fields and strips control chars', () => {
  const r = validateAttribution({ referrer: 'x'.repeat(1000), utm: { source: 'goo gle' } });
  assert.equal(r.referrer.length, 500);
  assert.equal(JSON.parse(r.utmJson).source, 'google');
});

test('validateAttribution returns null for garbage / empty input', () => {
  assert.equal(validateAttribution('nope'), null);
  assert.equal(validateAttribution(null), null);
  assert.equal(validateAttribution([1, 2]), null);
  assert.equal(validateAttribution({ gclid: '!!!', utm: { bogus: 'x' } }), null);
});

// =========================================================================
console.log('\nads-feed.mjs');
// =========================================================================

test('formatConversionTime is DST-safe (EDT vs EST wall clock)', () => {
  // 18:00 UTC in May = 14:00 EDT; 18:00 UTC in Feb = 13:00 EST.
  assert.equal(formatConversionTime('2026-05-08T18:00:00.000Z'), '2026-05-08 14:00:00');
  assert.equal(formatConversionTime('2026-02-08T18:00:00.000Z'), '2026-02-08 13:00:00');
  assert.equal(formatConversionTime('not-a-date'), null);
});

test('buildAdsCsv emits Parameters row, header, and formatted values with CRLF', () => {
  const csv = buildAdsCsv([
    { gclid: 'TESTCLICK1', amountCents: 41200, recordedAt: '2026-05-08T18:00:00.000Z' },
    { gclid: 'TESTCLICK2', amountCents: 0, recordedAt: '2026-05-08T18:00:00.000Z' },   // dropped
    { gclid: null, amountCents: 5000, recordedAt: '2026-05-08T18:00:00.000Z' },        // dropped
  ]);
  const lines = csv.split('\r\n');
  assert.equal(lines[0], 'Parameters:TimeZone=America/New_York,,,,');
  assert.equal(lines[1], 'Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency');
  assert.equal(lines[2], 'TESTCLICK1,store_sale,2026-05-08 14:00:00,412.00,USD');
  assert.equal(lines.length, 4, 'zero-amount and gclid-less rows must be excluded');
});

test('buildAdsCsv with no rows still returns both header rows', () => {
  const lines = buildAdsCsv([]).split('\r\n');
  assert.equal(lines.length, 3);
  assert.ok(lines[0].startsWith('Parameters:TimeZone='));
});

// =========================================================================
console.log('\nsales-store.mjs (booking sales, walk-ins, ad spend, revenue stats)');
// =========================================================================

await testAsync('sales pipeline: record sale (write-once time), conversion rows, spend, revenue stats', async () => {
  // Deleting the DB file here would kill the shared libsql client
  // (CLIENT_CLOSED) — truncate via SQL instead so counts start from zero.
  await migrate();
  const db = getDb();
  for (const table of ['bookings', 'ad_spend']) {
    await db.execute(`DELETE FROM ${table}`);
  }

  const { createBooking, updateBookingStaffStatus, findBookingById } = await import('../lib/store.mjs');
  const {
    recordBookingSale, upsertAdSpend, listAdSpend, listConversionRows, getRevenueStats,
  } = await import('../lib/sales-store.mjs');
  const { newBookingId } = await import('../lib/id.mjs');

  const mkBooking = (slotTime, extra = {}) => createBooking({
    audience: 'general',
    customer: { firstName: 'T', lastName: 'S', phone: '(470) 595-7775', email: 't@s.co', consent: true },
    answers: {},
    slot: { date: '2026-06-10', time: slotTime, durationMinutes: 30, tz: 'America/New_York' },
    consent: true,
    ...extra,
  }, newBookingId);

  // Attributed booking, closed with a $412 sale.
  const b1 = (await mkBooking('10:00', { gclid: 'TESTCLICK_A' })).booking;
  await updateBookingStaffStatus(b1.id, 'closed');
  const r1 = await recordBookingSale(b1.id, { amountCents: 41200, notes: 'navy suit' });
  assert.equal(r1.ok, true);

  // sale_recorded_at is write-once: editing the amount must not move it.
  const firstStamp = (await findBookingById(b1.id)).saleRecordedAt;
  await new Promise((r) => setTimeout(r, 5));
  await recordBookingSale(b1.id, { amountCents: 45000 });
  const after = await findBookingById(b1.id);
  assert.equal(after.saleAmountCents, 45000);
  assert.equal(after.saleRecordedAt, firstStamp, 'sale_recorded_at must never shift on edit');

  // Organic $150 sale + showed-but-didn't-buy + $0 no-buy.
  const b2 = (await mkBooking('11:00')).booking;
  await recordBookingSale(b2.id, { amountCents: 15000 });
  const b3 = (await mkBooking('12:00')).booking;
  await updateBookingStaffStatus(b3.id, 'showed');
  const b4 = (await mkBooking('13:00')).booking;
  await recordBookingSale(b4.id, { amountCents: 0 });
  // The retired 'completed' value is no longer assignable.
  assert.equal((await updateBookingStaffStatus(b4.id, 'completed')).error, 'INVALID_STATUS');

  // Amount validation.
  assert.equal((await recordBookingSale(b2.id, { amountCents: -5 })).error, 'INVALID_AMOUNT');
  assert.equal((await recordBookingSale(b2.id, { amountCents: 1.5 })).error, 'INVALID_AMOUNT');
  assert.equal((await recordBookingSale('BK-DEADBEEF', { amountCents: 100 })).error, 'NOT_FOUND');

  // Conversion feed rows: only gclid + amount>0.
  const conv = await listConversionRows();
  assert.equal(conv.length, 1);
  assert.equal(conv[0].gclid, 'TESTCLICK_A');
  assert.equal(conv[0].amountCents, 45000);

  // Ad spend upsert is idempotent per month.
  const thisMonth = new Date().toISOString().slice(0, 7);
  await upsertAdSpend(thisMonth, 100000);
  await upsertAdSpend(thisMonth, 120000);
  assert.equal((await upsertAdSpend('2026-13', 1)).error, 'INVALID_MONTH');
  const spend = await listAdSpend();
  assert.equal(spend.length, 1);
  assert.equal(spend[0].amountCents, 120000);

  // Revenue stats — booked-appointment sales only.
  const stats = await getRevenueStats(24);
  const cur = stats.find((m) => m.month === thisMonth);
  const june = stats.find((m) => m.month === '2026-06');
  // Bookings created + sale timestamps land in the current month.
  assert.equal(cur.bookingsCreated, 4);
  assert.equal(cur.gclidBookings, 1);
  assert.equal(cur.customers, 2, 'b1 ($450) and b2 ($150); the $0 no-buy is not a customer');
  assert.equal(cur.revenueCents, 60000);
  assert.equal(cur.aovCents, 30000);
  assert.equal(cur.cacCents, 60000, 'CAC = spend / customers = 120000 / 2');
  // showed-up counts (showed + closed) are grouped by slot_date month (June).
  assert.equal(june.showed, 2);
});

// =========================================================================
console.log('\n— results —');
console.log(results.join('\n'));
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
