/**
 * SMS bodies for appointment reminders — the text-channel counterpart of the
 * reminder emails. Sent by the nurture cron jobs (lib/cron.mjs) for every
 * booking; when the booking holds an issued gift code the body mentions it,
 * otherwise the gift clause is dropped.
 *
 * Bodies must stay GSM-7 clean (no em dashes, curly quotes, or ellipses):
 * one non-GSM-7 character re-encodes the whole message as UCS-2 and cuts the
 * segment size from 153 to 67 chars. Kept within two segments, and every
 * message names the business and carries opt-out language for carrier
 * compliance.
 */

import { formatLongDate, formatTime12h } from './email.mjs';

const OPT_OUT = 'Reply STOP to opt out.';

function firstName(booking) {
  return booking?.customer?.firstName || 'there';
}

function giftClause(offer, code) {
  return code && offer?.name ? ` Bring your ${offer.name} code ${code}.` : '';
}

/** Day-before reminder. */
export function nurtureT1Sms({ booking, offer, code, businessName, businessAddress, businessPhone }) {
  const time = formatTime12h(booking.slot.time);
  return (
    `Hi ${firstName(booking)}, it's ${businessName}. Reminder: your visit is tomorrow at ${time} at ` +
    `${businessAddress}.${giftClause(offer, code)} Reschedule? Call ${businessPhone}. ${OPT_OUT}`
  );
}

/** Day-of reminder. */
export function nurtureDayOfSms({ booking, offer, code, businessName, businessAddress, businessPhone }) {
  const time = formatTime12h(booking.slot.time);
  const gift = code && offer?.name
    ? ` Show code ${code} at the front desk for your ${offer.name}.`
    : '';
  return (
    `Today's the day, ${firstName(booking)}! ${businessName} at ${time}: ${businessAddress}.` +
    `${gift} Questions? ${businessPhone}. ${OPT_OUT}`
  );
}

/**
 * 3-days-out reminder. Not wired into the cron by default — three texts per
 * booking is heavy for a single visit — but ready to enable by adding it to
 * NURTURE_BUILDERS in cron.mjs.
 */
export function nurtureT3Sms({ booking, offer, code, businessName, businessPhone }) {
  const dateLong = formatLongDate(booking.slot.date);
  const time = formatTime12h(booking.slot.time);
  const what = code && offer?.name
    ? `Your ${offer.name} is reserved for ${dateLong} at ${time}. Bring code ${code}.`
    : `Your visit is scheduled for ${dateLong} at ${time}.`;
  return (
    `Hi ${firstName(booking)}, it's ${businessName}. ${what} ` +
    `Reschedule? Call ${businessPhone}. ${OPT_OUT}`
  );
}
