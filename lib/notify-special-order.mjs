/**
 * Orchestrator: fire special-order arrival email + SMS in parallel.
 *
 * Considered "ok" if at least one channel succeeded so a missing phone or a
 * Twilio outage doesn't block the email half (or vice versa). Mirrors the
 * shape of lib/notify-pickup.mjs.
 */

import { sendEmail, specialOrderArrivedEmail } from './email.mjs';
import { sendSms } from './sms.mjs';
import * as log from './log.mjs';

const ITEM_TYPE_LABEL = {
  suit: 'suit',
  shirt: 'shirt',
  shoes: 'shoes',
  accessory: 'accessory',
  other: 'item',
};

function specialOrderSmsBody({ order, businessName, businessAddress, businessPhone }) {
  const first = order.firstName || 'there';
  const itemParts = [];
  if (order.color) itemParts.push(order.color);
  if (order.size) itemParts.push(`size ${order.size}`);
  const label = ITEM_TYPE_LABEL[order.itemType] || 'item';
  const itemPhrase = itemParts.length > 0 ? `${itemParts.join(' ')} ${label}` : label;
  return `Hi ${first}, your special-order ${itemPhrase} has arrived at ${businessName}, ${businessAddress}. Questions? ${businessPhone}`;
}

/**
 * @param {object} order  Special-order record (rowToSpecialOrder shape)
 * @returns {Promise<{ok:boolean, email:{ok:boolean,error?:string,dryRun?:boolean}, sms:{ok:boolean,error?:string,dryRun?:boolean}}>}
 */
export async function sendSpecialOrderArrivedNotification(order) {
  const businessName = process.env.BUSINESS_NAME || 'GA Suit Warehouse';
  const businessAddress = process.env.BUSINESS_ADDRESS || '150 Pearl Nix Pkwy, Gainesville GA 30501';
  const businessPhone = process.env.BUSINESS_PHONE || '+14705957775';
  const fromEmail = process.env.FROM_EMAIL;

  const emailRendered = specialOrderArrivedEmail({
    order,
    businessName,
    businessAddress,
    businessPhone,
  });
  const smsBody = specialOrderSmsBody({ order, businessName, businessAddress, businessPhone });

  const emailPromise = order.email && fromEmail
    ? sendEmail({
        to: order.email,
        from: fromEmail,
        subject: emailRendered.subject,
        html: emailRendered.html,
        text: emailRendered.text,
      })
    : Promise.resolve({ ok: false, error: !order.email ? 'No email on order.' : 'FROM_EMAIL not configured.' });

  const smsPromise = order.phone
    ? sendSms({ to: order.phone, body: smsBody })
    : Promise.resolve({ ok: false, error: 'No phone on order.' });

  const [emailResult, smsResult] = await Promise.all([emailPromise, smsPromise]);

  if (!emailResult.ok) {
    log.warn('special-order arrival email failed', { orderId: order.id, error: emailResult.error });
  }
  if (!smsResult.ok) {
    log.warn('special-order arrival sms failed', { orderId: order.id, error: smsResult.error });
  }

  return {
    ok: emailResult.ok || smsResult.ok,
    email: emailResult,
    sms: smsResult,
  };
}
