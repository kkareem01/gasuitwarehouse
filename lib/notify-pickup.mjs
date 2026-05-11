/**
 * Orchestrator: fire pickup-ready email + SMS in parallel for an intake row.
 * Considered "ok" if at least one channel succeeded so a missing phone or a
 * Twilio outage doesn't block the email half (or vice versa).
 */

import { sendEmail, intakeReadyForPickupEmail } from './email.mjs';
import { sendSms } from './sms.mjs';
import * as log from './log.mjs';

function pickupSmsBody({ intake, businessName, businessAddress, businessPhone }) {
  const first = intake.firstName || 'there';
  const items = (intake.tailoringNotes || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .join(', ');
  const itemsClause = items ? ` (${items})` : '';
  return `Hi ${first}, your tailoring${itemsClause} is ready for pickup at ${businessName}, ${businessAddress}. Questions? ${businessPhone}`;
}

/**
 * @param {object} intake  Intake record from store.mjs (rowToIntake shape)
 * @returns {Promise<{ok:boolean, email:{ok:boolean,error?:string,dryRun?:boolean}, sms:{ok:boolean,error?:string,dryRun?:boolean}}>}
 */
export async function sendPickupReadyNotification(intake) {
  const businessName = process.env.BUSINESS_NAME || 'GA Suit Warehouse';
  const businessAddress = process.env.BUSINESS_ADDRESS || '150 Pearl Nix Pkwy, Gainesville GA 30501';
  const businessPhone = process.env.BUSINESS_PHONE || '+14705957775';
  const fromEmail = process.env.FROM_EMAIL;

  const emailRendered = intakeReadyForPickupEmail({
    intake,
    businessName,
    businessAddress,
    businessPhone,
  });
  const smsBody = pickupSmsBody({ intake, businessName, businessAddress, businessPhone });

  const emailPromise = intake.email && fromEmail
    ? sendEmail({
        to: intake.email,
        from: fromEmail,
        subject: emailRendered.subject,
        html: emailRendered.html,
        text: emailRendered.text,
      })
    : Promise.resolve({ ok: false, error: !intake.email ? 'No email on intake.' : 'FROM_EMAIL not configured.' });

  const smsPromise = intake.phone
    ? sendSms({ to: intake.phone, body: smsBody })
    : Promise.resolve({ ok: false, error: 'No phone on intake.' });

  const [emailResult, smsResult] = await Promise.all([emailPromise, smsPromise]);

  if (!emailResult.ok) {
    log.warn('pickup-ready email failed', { intakeId: intake.id, error: emailResult.error });
  }
  if (!smsResult.ok) {
    log.warn('pickup-ready sms failed', { intakeId: intake.id, error: smsResult.error });
  }

  return {
    ok: emailResult.ok || smsResult.ok,
    email: emailResult,
    sms: smsResult,
  };
}
