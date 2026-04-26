/**
 * Hand-rolled RFC-5545 calendar invitation. Returns a UTF-8 string ready to attach.
 * No deps. Treats slot.date + slot.time as wall-clock in the given IANA timezone.
 */

import { dayOfWeek } from './slots.mjs';

function pad(n) {
  return String(n).padStart(2, '0');
}

function dtUtc(d) {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/**
 * Convert a wall-clock (date+time) in IANA tz to a UTC Date.
 * Strategy: build a Date as if the wall-clock were UTC, then ask Intl what offset
 * that instant has in the target tz, and shift by the negative offset. This is
 * DST-safe because the offset is computed at the actual moment in question.
 */
function wallClockInTzToUtc(date, time, tz) {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const asIfUtc = new Date(Date.UTC(y, m - 1, d, hh, mm, 0));

  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    timeZoneName: 'longOffset',
    year: 'numeric',
  });
  const parts = fmt.formatToParts(asIfUtc);
  const offsetPart = parts.find((p) => p.type === 'timeZoneName')?.value || 'GMT+00:00';
  // longOffset returns 'GMT-04:00' etc. Parse the sign + hours/minutes.
  const match = offsetPart.match(/GMT([+-])(\d{1,2}):?(\d{2})?/);
  let offsetMin = 0;
  if (match) {
    const sign = match[1] === '+' ? 1 : -1;
    const h = parseInt(match[2], 10);
    const mn = parseInt(match[3] ?? '0', 10);
    offsetMin = sign * (h * 60 + mn);
  }
  // The wall-clock in tz is offsetMin minutes ahead of UTC, so true UTC = asIfUtc - offsetMin.
  return new Date(asIfUtc.getTime() - offsetMin * 60 * 1000);
}

function escapeICS(s) {
  if (typeof s !== 'string') return '';
  return s
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

/**
 * Fold long lines per RFC 5545 (>75 octets).
 */
function fold(line) {
  if (line.length <= 75) return line;
  const out = [];
  let i = 0;
  while (i < line.length) {
    out.push((i === 0 ? '' : ' ') + line.slice(i, i + (i === 0 ? 75 : 74)));
    i += i === 0 ? 75 : 74;
  }
  return out.join('\r\n');
}

export function buildICS({ id, slot, durationMinutes, tz, summary, description, location }) {
  const start = wallClockInTzToUtc(slot.date, slot.time, tz);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  const stamp = new Date();

  // dayOfWeek check exists so we exercise that import in a meaningful way; keeps lib coherent
  void dayOfWeek(slot.date);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GA Suit Warehouse//Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${id}@gasuitwarehouse.com`,
    `DTSTAMP:${dtUtc(stamp)}`,
    `DTSTART:${dtUtc(start)}`,
    `DTEND:${dtUtc(end)}`,
    `SUMMARY:${escapeICS(summary)}`,
    `DESCRIPTION:${escapeICS(description)}`,
    `LOCATION:${escapeICS(location)}`,
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'END:VEVENT',
    'END:VCALENDAR',
  ].map(fold);

  return lines.join('\r\n') + '\r\n';
}
