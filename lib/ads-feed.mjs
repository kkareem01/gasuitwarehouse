/**
 * Google Ads offline-conversion CSV feed (pure functions — the handler in
 * lib/handlers-sales.mjs serves the output at /feeds/ads-conversions.csv,
 * which Google Ads fetches daily via a scheduled upload).
 *
 * Format reference: Google Ads click-conversion import template. The
 * Parameters row pins the timezone so Conversion Time values are read as
 * store-local wall clock. Google dedups rows on
 * (Google Click ID, Conversion Name, Conversion Time), which is why
 * bookings.sale_recorded_at is write-once.
 */

export const CONVERSION_NAME = 'store_sale';
export const CONVERSION_CURRENCY = 'USD';
export const FEED_TIMEZONE = 'America/New_York';

/**
 * Format an ISO timestamp as 'yyyy-MM-dd HH:mm:ss' wall-clock time in the
 * store timezone (DST-safe — Intl computes the offset at that instant).
 */
export function formatConversionTime(iso, tz = FEED_TIMEZONE) {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return null;
  // en-CA date parts are already yyyy-MM-dd ordered.
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = {};
  for (const p of fmt.formatToParts(dt)) parts[p.type] = p.value;
  // Intl can emit hour '24' for midnight in some environments; normalize.
  const hour = parts.hour === '24' ? '00' : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day} ${hour}:${parts.minute}:${parts.second}`;
}

function escapeCsv(v) {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Build the CSV Google Ads' scheduled upload expects.
 * @param {Array<{gclid: string, amountCents: number, recordedAt: string}>} rows
 * @returns {string} CRLF-terminated CSV, header rows always present
 */
export function buildAdsCsv(rows) {
  const lines = [
    `Parameters:TimeZone=${FEED_TIMEZONE},,,,`,
    'Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency',
  ];
  for (const row of rows || []) {
    const time = formatConversionTime(row.recordedAt);
    const amount = Number(row.amountCents);
    if (!row.gclid || !time || !Number.isFinite(amount) || amount <= 0) continue;
    lines.push([
      escapeCsv(row.gclid),
      CONVERSION_NAME,
      time,
      (amount / 100).toFixed(2),
      CONVERSION_CURRENCY,
    ].join(','));
  }
  return lines.join('\r\n') + '\r\n';
}
