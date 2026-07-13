/**
 * Owner alert: text the store owner whenever a new booking comes in.
 *
 * Separate from the owner *email* in handlers.fireEmails so a Twilio outage or
 * a pending A2P campaign can never degrade the customer's confirmation email —
 * this never throws and never touches booking email_status.
 */

import { sendSms } from './sms.mjs';
import { formatLongDate, formatTime12h } from './email.mjs';
import * as log from './log.mjs';

// Every character here must live in the GSM-7 alphabet. A single character
// outside it (an em dash, a curly quote, an ellipsis) silently re-encodes the
// whole message as UCS-2, which drops the segment size from 153 chars to 67 —
// i.e. costs an extra segment per booking for a bit of typography. Use "-",
// "..." and straight quotes only.
const MAX_ANSWER_CHARS = 60;

/**
 * Render the owner's new-booking alert. Pure — exported for tests.
 *
 * @param {object} opts
 * @param {object} opts.booking        Booking record (store.mjs rowToBooking shape)
 * @param {string} opts.audienceLabel  Human label, e.g. "Wedding party fitting"
 * @param {string} [opts.businessName]
 * @returns {string}
 */
export function ownerBookingSmsBody({ booking, audienceLabel, businessName }) {
  const { customer, slot } = booking;
  const name = [customer?.firstName, customer?.lastName].filter(Boolean).join(' ') || 'Unknown';
  const when = `${formatLongDate(slot.date)} at ${formatTime12h(slot.time)}`;
  const label = audienceLabel || booking.audience || 'Fitting';
  const brand = businessName || 'GA Suit Warehouse';

  const joined = Object.entries(booking.answers || {})
    .map(([k, v]) => `${k}: ${String(v ?? '').trim()}`)
    .filter((line) => !line.endsWith(': '))
    .join(' | ');
  const notes = joined.length > MAX_ANSWER_CHARS
    ? `${joined.slice(0, MAX_ANSWER_CHARS).trimEnd()}...`
    : joined;
  const notesClause = notes ? `\n${notes}` : '';

  return (
    `${brand}: NEW BOOKING\n` +
    `${label}\n` +
    `${name} - ${customer?.phone || 'no phone'}\n` +
    `${when}\n` +
    `Ref ${booking.id}${notesClause}`
  );
}

/**
 * Fire the owner alert. Resolves (never rejects) so callers can await it inline
 * without guarding — a failed alert is logged, not raised.
 *
 * @param {object} booking
 * @param {string} audienceLabel
 * @returns {Promise<{ok:boolean, skipped?:boolean, error?:string, dryRun?:boolean}>}
 */
export async function notifyOwnerOfBooking(booking, audienceLabel) {
  const ownerPhone = process.env.OWNER_PHONE;
  if (!ownerPhone) {
    log.warn('owner booking SMS skipped: OWNER_PHONE not set', { bookingId: booking?.id });
    return { ok: false, skipped: true, error: 'OWNER_PHONE not set.' };
  }

  try {
    const body = ownerBookingSmsBody({
      booking,
      audienceLabel,
      businessName: process.env.BUSINESS_NAME,
    });
    const result = await sendSms({ to: ownerPhone, body });
    if (!result.ok) {
      log.warn('owner booking SMS failed', { bookingId: booking?.id, error: result.error });
      return result;
    }
    log.info(`owner booking SMS sent for ${booking.id} (sid=${result.sid})`);
    return result;
  } catch (e) {
    const error = e?.message || String(e);
    log.warn('owner booking SMS crashed', { bookingId: booking?.id, error });
    return { ok: false, error };
  }
}
