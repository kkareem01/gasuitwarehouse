/**
 * SMS bodies for appointment reminders — the text-channel counterpart of the
 * nurture emails in email.mjs. Sent by the same cron jobs (lib/cron.mjs).
 *
 * Kept under 320 chars (two GSM segments) and every message names the
 * business and carries opt-out language, per A2P 10DLC campaign requirements.
 */

import { formatLongDate, formatTime12h } from './email.mjs';

const OPT_OUT = 'Reply STOP to opt out.';

function firstName(booking) {
  return booking?.customer?.firstName || 'there';
}

/** Day-before reminder (counterpart of nurtureT1Email). */
export function nurtureT1Sms({ booking, offer, code, businessName, businessAddress, businessPhone }) {
  const time = formatTime12h(booking.slot.time);
  return (
    `Hi ${firstName(booking)}, it's ${businessName}. Reminder: your visit is tomorrow at ${time} — ` +
    `${businessAddress}. Bring your ${offer.name} code ${code}. ` +
    `Reschedule? Call ${businessPhone}. ${OPT_OUT}`
  );
}

/** Day-of reminder (counterpart of nurtureDayOfEmail). */
export function nurtureDayOfSms({ booking, offer, code, businessName, businessAddress, businessPhone }) {
  const time = formatTime12h(booking.slot.time);
  return (
    `Today's the day, ${firstName(booking)}! ${businessName} at ${time} — ${businessAddress}. ` +
    `Show code ${code} at the front desk for your ${offer.name}. ` +
    `Questions? ${businessPhone}. ${OPT_OUT}`
  );
}

/**
 * 3-days-out reminder (counterpart of nurtureT3Email). Not wired into the
 * cron by default — three texts per booking is heavy for a single visit —
 * but ready to enable by adding it to NURTURE_BUILDERS in cron.mjs.
 */
export function nurtureT3Sms({ booking, offer, code, businessName, businessPhone }) {
  const dateLong = formatLongDate(booking.slot.date);
  const time = formatTime12h(booking.slot.time);
  return (
    `Hi ${firstName(booking)}, it's ${businessName}. Your ${offer.name} is reserved for ` +
    `${dateLong} at ${time}. Bring code ${code}. ` +
    `Reschedule? Call ${businessPhone}. ${OPT_OUT}`
  );
}
