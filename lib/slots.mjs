/**
 * Pure slot-generation utilities. All times are wall-clock strings ('HH:MM') in
 * the store's local timezone (config.storeTimezone). Date strings are 'YYYY-MM-DD'.
 * No Date math that depends on the host machine's timezone.
 */

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function parseHHMM(s) {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}

function formatHHMM(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Returns the day-of-week (0 Sun .. 6 Sat) for a YYYY-MM-DD string,
 * interpreted as a calendar date (no tz drift).
 */
export function dayOfWeek(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * Get the current wall-clock date (YYYY-MM-DD) and time (HH:MM) in a given IANA tz.
 */
export function nowInTz(tz, now = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  // 24h formatter sometimes returns "24" for midnight; normalize
  const hour = parts.hour === '24' ? '00' : parts.hour;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${hour}:${parts.minute}`,
  };
}

/**
 * Compare two YYYY-MM-DD date strings lexically (works because format is ordered).
 */
export function compareDates(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Generate every slot the schedule supports for a date, ignoring bookings.
 * @returns string[] of 'HH:MM'
 */
export function generateSlotsForDate(dateStr, config, audience) {
  if (config.blackoutDates?.includes(dateStr)) return [];

  const dow = DAY_KEYS[dayOfWeek(dateStr)];
  const hours = config.businessHours?.[dow];
  if (!hours || !hours.open || !hours.close) return [];

  const fitting = config.fittingTypes?.[audience];
  const duration = fitting?.slotDurationMinutes ?? config.defaultSlotDurationMinutes ?? 20;
  const buffer = fitting?.buffer ?? 0;
  const step = duration + buffer;

  const open = parseHHMM(hours.open);
  const close = parseHHMM(hours.close);

  const slots = [];
  for (let t = open; t + duration <= close; t += step) {
    slots.push(formatHHMM(t));
  }
  return slots;
}

/**
 * Filter to only slots that are not yet taken and not too soon.
 * @param allSlots string[] from generateSlotsForDate
 * @param bookedTimes Set<string> 'HH:MM' for that date
 * @param dateStr YYYY-MM-DD of the slot list
 * @param config full config (for storeTimezone, leadTimeMinutes, maxAdvanceDays)
 */
export function filterAvailableSlots(allSlots, bookedTimes, dateStr, config) {
  const tz = config.storeTimezone;
  const now = nowInTz(tz);
  const lead = config.leadTimeMinutes ?? 0;
  const maxAdvance = config.maxAdvanceDays ?? 365;

  // outside of allowed window?
  if (compareDates(dateStr, now.date) < 0) return [];
  const advanceLimit = addDays(now.date, maxAdvance);
  if (compareDates(dateStr, advanceLimit) > 0) return [];

  const isToday = dateStr === now.date;
  const earliestToday = parseHHMM(now.time) + lead;

  return allSlots.filter((time) => {
    if (bookedTimes.has(time)) return false;
    if (isToday && parseHHMM(time) < earliestToday) return false;
    return true;
  });
}

/**
 * Build a list of every date in (year, month) with a flag for whether any slot is open.
 * `bookingsByDate` is a Map<date, Set<time>>.
 */
export function listMonth(year, month, config, audience, bookingsByDate) {
  const days = daysInMonth(year, month);
  const out = [];
  for (let d = 1; d <= days; d++) {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const all = generateSlotsForDate(date, config, audience);
    const booked = bookingsByDate.get(date) ?? new Set();
    const open = filterAvailableSlots(all, booked, date, config);
    out.push({ date, hasOpenSlots: open.length > 0 });
  }
  return out;
}

export function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}
