/**
 * Resend transactional email via fetch. No SDK.
 * Honors DRY_RUN_EMAIL=true by writing rendered HTML to tmp/last-email.html instead
 * of calling the API — useful for local QA without spamming inboxes.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import * as log from './log.mjs';

const RESEND_URL = 'https://api.resend.com/emails';

export async function sendEmail({ to, from, subject, html, text, attachments, replyTo, headers }) {
  const dryRun = process.env.DRY_RUN_EMAIL === 'true';
  if (dryRun) {
    await mkdir('tmp', { recursive: true });
    const stamp = `${Date.now()}-${randomBytes(2).toString('hex')}`;
    const file = `tmp/email-${stamp}.html`;
    const banner = `<!-- DRY_RUN_EMAIL\nTo: ${Array.isArray(to) ? to.join(', ') : to}\nFrom: ${from}\nSubject: ${subject}\nReply-To: ${replyTo ?? ''}\nHeaders: ${headers ? JSON.stringify(headers) : ''}\nAttachments: ${(attachments || []).map((a) => a.filename).join(', ')}\n-->\n`;
    await writeFile(file, banner + html, 'utf8');
    await writeFile('tmp/last-email.html', banner + html, 'utf8');
    log.info(`Dry-run email written to ${file}`);
    return { ok: true, dryRun: true, file };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: 'RESEND_API_KEY missing.' };
  }

  const body = {
    from,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    text,
  };
  if (replyTo) body.reply_to = replyTo;
  if (headers && Object.keys(headers).length > 0) body.headers = headers;
  if (attachments && attachments.length > 0) {
    body.attachments = attachments.map((a) => ({
      filename: a.filename,
      content: Buffer.from(a.content, 'utf8').toString('base64'),
      content_type: a.contentType ?? 'application/octet-stream',
    }));
  }

  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { ok: false, error: `Resend ${res.status}: ${detail.slice(0, 200)}` };
    }
    const data = await res.json().catch(() => ({}));
    return { ok: true, id: data.id };
  } catch (err) {
    return { ok: false, error: `Email send failed: ${err.message}` };
  }
}

function formatLongDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatTime12h(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

const WRAPPER_OPEN = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;font-family:Georgia,'Times New Roman',serif;background:#FAF8F4;color:#14213D;line-height:1.6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF8F4;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border:1px solid #E5E0D5;border-radius:2px;">
        <tr><td style="padding:32px 32px 16px 32px;border-bottom:3px solid #C9A961;">
          <div style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#14213D;">
            <span style="font-style:italic;font-weight:500;">GA</span> SuitWarehouse
          </div>
        </td></tr>
        <tr><td style="padding:32px;">`;

const WRAPPER_CLOSE = `        </td></tr>
        <tr><td style="padding:24px 32px;background:#FAF8F4;border-top:1px solid #E5E0D5;font-size:13px;color:#6B7280;text-align:center;">
          150 Pearl Nix Pkwy, Gainesville GA 30501 &middot; <a href="tel:+14705957775" style="color:#A88636;text-decoration:none;">(470) 595-7775</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

export function customerConfirmationEmail({ booking, businessName, businessAddress, businessPhone, confirmUrl }) {
  const dateLong = formatLongDate(booking.slot.date);
  const time = formatTime12h(booking.slot.time);
  const subject = `${businessName} fitting confirmed — ${dateLong} at ${time}`;

  const html =
    WRAPPER_OPEN +
    `
    <h1 style="font-family:Georgia,serif;font-size:24px;font-weight:600;color:#14213D;margin:0 0 16px 0;">You're confirmed, ${escapeHtml(booking.customer.firstName)}.</h1>
    <p style="margin:0 0 20px 0;">We'll see you for your fitting on <strong>${dateLong} at ${time}</strong>.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;border:1px solid #E5E0D5;border-radius:2px;">
      <tr><td style="padding:16px 20px;background:#F4EFE6;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#14213D;">Your appointment</td></tr>
      <tr><td style="padding:16px 20px;">
        <div style="margin-bottom:8px;"><strong>Date:</strong> ${dateLong}</div>
        <div style="margin-bottom:8px;"><strong>Time:</strong> ${time} (${escapeHtml(booking.slot.tz || booking.displayTimezone || 'America/New_York')})</div>
        <div style="margin-bottom:8px;"><strong>Duration:</strong> ${booking.slot.durationMinutes} minutes</div>
        <div style="margin-bottom:8px;"><strong>Where:</strong> ${escapeHtml(businessAddress)}</div>
        <div><strong>Reference:</strong> ${booking.id}</div>
      </td></tr>
    </table>
    <h2 style="font-family:Georgia,serif;font-size:18px;color:#14213D;margin:24px 0 12px 0;">Before you come in</h2>
    <ul style="margin:0 0 24px 0;padding-left:20px;">
      <li style="margin-bottom:6px;">Bring inspiration photos if you have them.</li>
      <li style="margin-bottom:6px;">Allow 45–60 minutes for the full session.</li>
      <li>Need to reschedule? Just call <a href="tel:${businessPhone}" style="color:#A88636;">${businessPhone}</a>.</li>
    </ul>
    <p style="text-align:center;margin:24px 0 0 0;">
      <a href="${confirmUrl}" style="display:inline-block;background:#14213D;color:#C9A961;padding:14px 28px;text-decoration:none;font-family:Georgia,serif;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;font-size:13px;border-radius:2px;">View booking details</a>
    </p>
    <p style="margin:24px 0 0 0;font-size:14px;color:#6B7280;">A calendar invitation is attached to this email.</p>
    ` +
    WRAPPER_CLOSE;

  const text =
    `You're confirmed, ${booking.customer.firstName}.\n\n` +
    `Date: ${dateLong}\nTime: ${time} (${booking.slot.tz})\n` +
    `Duration: ${booking.slot.durationMinutes} minutes\nWhere: ${businessAddress}\n` +
    `Reference: ${booking.id}\n\n` +
    `View details: ${confirmUrl}\n` +
    `Reschedule: ${businessPhone}\n`;

  return { subject, html, text };
}

export function ownerNotificationEmail({ booking, audienceLabel, businessName }) {
  const dateLong = formatLongDate(booking.slot.date);
  const time = formatTime12h(booking.slot.time);
  const subject = `[BOOKING] ${audienceLabel} — ${booking.customer.firstName} ${booking.customer.lastName} — ${dateLong} ${time}`;

  const answersRows = Object.entries(booking.answers || {})
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px;background:#F4EFE6;font-weight:700;width:40%;">${escapeHtml(k)}</td><td style="padding:6px 12px;">${escapeHtml(String(v ?? ''))}</td></tr>`
    )
    .join('');

  const html =
    WRAPPER_OPEN +
    `
    <h1 style="font-family:Georgia,serif;font-size:22px;font-weight:600;color:#14213D;margin:0 0 16px 0;">New ${escapeHtml(audienceLabel)} booking</h1>
    <p style="margin:0 0 16px 0;font-size:18px;"><strong>${dateLong}</strong> at <strong>${time}</strong></p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px 0;border:1px solid #E5E0D5;font-size:14px;">
      <tr><td style="padding:8px 12px;background:#F4EFE6;font-weight:700;width:40%;">Name</td><td style="padding:8px 12px;">${escapeHtml(booking.customer.firstName)} ${escapeHtml(booking.customer.lastName)}</td></tr>
      <tr><td style="padding:8px 12px;background:#F4EFE6;font-weight:700;">Phone</td><td style="padding:8px 12px;"><a href="tel:${escapeHtml(booking.customer.phone)}" style="color:#A88636;">${escapeHtml(booking.customer.phone)}</a></td></tr>
      <tr><td style="padding:8px 12px;background:#F4EFE6;font-weight:700;">Email</td><td style="padding:8px 12px;"><a href="mailto:${escapeHtml(booking.customer.email)}" style="color:#A88636;">${escapeHtml(booking.customer.email)}</a></td></tr>
      <tr><td style="padding:8px 12px;background:#F4EFE6;font-weight:700;">Audience</td><td style="padding:8px 12px;">${escapeHtml(booking.audience)}</td></tr>
      <tr><td style="padding:8px 12px;background:#F4EFE6;font-weight:700;">Reference</td><td style="padding:8px 12px;">${booking.id}</td></tr>
      <tr><td style="padding:8px 12px;background:#F4EFE6;font-weight:700;">Their timezone</td><td style="padding:8px 12px;">${escapeHtml(booking.displayTimezone || '')}</td></tr>
    </table>
    <h2 style="font-family:Georgia,serif;font-size:16px;color:#14213D;margin:16px 0 8px 0;">Their answers</h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E0D5;font-size:14px;">
      ${answersRows || '<tr><td style="padding:8px 12px;color:#6B7280;">No additional answers.</td></tr>'}
    </table>
    ` +
    WRAPPER_CLOSE;

  const text =
    `New ${audienceLabel} booking\n\n` +
    `${dateLong} ${time}\n` +
    `${booking.customer.firstName} ${booking.customer.lastName}\n` +
    `${booking.customer.phone} · ${booking.customer.email}\n` +
    `Reference: ${booking.id}\n\n` +
    `Answers:\n${Object.entries(booking.answers || {})
      .map(([k, v]) => `  ${k}: ${v}`)
      .join('\n')}\n`;

  return { subject, html, text };
}

function escapeHtml(s) {
  if (typeof s !== 'string') return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatExpires(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function daysUntil(isoStr, now = Date.now()) {
  if (!isoStr) return null;
  const target = new Date(isoStr).getTime();
  return Math.max(0, Math.ceil((target - now) / (24 * 60 * 60 * 1000)));
}

/**
 * Stand-alone gift opt-in confirmation. No booking attached — the customer
 * walks in any time during business hours within the 7-day window.
 */
export function giftCodeReadyEmail({ firstName, offer, code, expiresAt, businessName, businessAddress, businessPhone }) {
  const expiresOn = formatExpires(expiresAt);
  const expiresIn = daysUntil(expiresAt);
  const subject = `Your ${offer.name} is ready — code inside`;

  const html =
    WRAPPER_OPEN +
    `
    <h1 style="font-family:Georgia,serif;font-size:24px;font-weight:600;color:#14213D;margin:0 0 12px 0;">${escapeHtml(firstName)}, your ${escapeHtml(offer.name)} is reserved.</h1>
    <p style="margin:0 0 20px 0;font-size:16px;">Show this code at the front desk — your <strong>${escapeHtml(offer.name)}</strong> is yours, no purchase necessary.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;border:2px solid #C9A961;border-radius:2px;background:#FAF8F4;">
      <tr><td align="center" style="padding:20px 16px 8px 16px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#A88636;">Your redemption code</td></tr>
      <tr><td align="center" style="padding:0 16px 20px 16px;font-family:'Courier New',monospace;font-size:28px;font-weight:700;letter-spacing:0.18em;color:#14213D;">${escapeHtml(code)}</td></tr>
    </table>

    <p style="margin:0 0 18px 0;font-size:15px;color:#14213D;"><strong>Valid through ${escapeHtml(expiresOn)}${expiresIn != null ? ` (${expiresIn} day${expiresIn === 1 ? '' : 's'} from today)` : ''}.</strong> One per customer.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;border:1px solid #E5E0D5;border-radius:2px;">
      <tr><td style="padding:16px 20px;background:#F4EFE6;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#14213D;">Where to find us</td></tr>
      <tr><td style="padding:16px 20px;font-size:14px;line-height:1.55;">
        <div style="margin-bottom:8px;"><strong>${escapeHtml(businessName)}</strong></div>
        <div style="margin-bottom:8px;">${escapeHtml(businessAddress)}</div>
        <div><a href="tel:${escapeHtml(businessPhone)}" style="color:#A88636;">${escapeHtml(businessPhone)}</a></div>
      </td></tr>
    </table>

    <h2 style="font-family:Georgia,serif;font-size:18px;color:#14213D;margin:24px 0 12px 0;">When you arrive</h2>
    <ul style="margin:0 0 24px 0;padding-left:20px;font-size:14px;line-height:1.6;">
      <li style="margin-bottom:6px;">Show this code at the front desk.</li>
      <li style="margin-bottom:6px;">Browse around if you'd like — no pressure, no purchase needed.</li>
      <li>Questions? Call <a href="tel:${escapeHtml(businessPhone)}" style="color:#A88636;">${escapeHtml(businessPhone)}</a>.</li>
    </ul>
    ` +
    WRAPPER_CLOSE;

  const text =
    `${firstName}, your ${offer.name} is reserved.\n\n` +
    `Show this code at the front desk: ${code}\n` +
    `Valid through: ${expiresOn}${expiresIn != null ? ` (${expiresIn} days from today)` : ''}\n\n` +
    `Where: ${businessName}, ${businessAddress}\n` +
    `Phone: ${businessPhone}\n\n` +
    `Walk in any time during business hours. No purchase necessary.\n`;

  return { subject, html, text };
}

export function redemptionCodeEmail({ booking, offer, code, expiresAt, businessName, businessAddress, businessPhone, confirmUrl }) {
  const dateLong = formatLongDate(booking.slot.date);
  const time = formatTime12h(booking.slot.time);
  // Strip leading "Free " from the offer name in the subject — Gmail flags
  // "FREE" as a top-tier spam trigger word in the subject line. Body copy
  // stays unchanged (subject is weighted much more heavily).
  const itemName = offer.name.replace(/^Free\s+/i, '');
  const subject = `Your ${itemName} is reserved — pickup ${dateLong} at ${time}`;
  const expiresOn = formatExpires(expiresAt);

  const html =
    WRAPPER_OPEN +
    `
    <h1 style="font-family:Georgia,serif;font-size:24px;font-weight:600;color:#14213D;margin:0 0 12px 0;">You qualified, ${escapeHtml(booking.customer.firstName)}.</h1>
    <p style="margin:0 0 20px 0;font-size:16px;">Your <strong>${escapeHtml(offer.name)}</strong> is reserved. Stop by <strong>${dateLong} at ${time}</strong> to pick it up — no purchase necessary.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;border:2px solid #C9A961;border-radius:2px;background:#FAF8F4;">
      <tr><td align="center" style="padding:20px 16px 8px 16px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#A88636;">Your redemption code</td></tr>
      <tr><td align="center" style="padding:0 16px 20px 16px;font-family:'Courier New',monospace;font-size:28px;font-weight:700;letter-spacing:0.18em;color:#14213D;">${escapeHtml(code)}</td></tr>
    </table>

    <p style="margin:0 0 18px 0;font-size:14px;color:#6B7280;">Bring this code with you. One per customer. Reservation expires ${escapeHtml(expiresOn)}.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;border:1px solid #E5E0D5;border-radius:2px;">
      <tr><td style="padding:16px 20px;background:#F4EFE6;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#14213D;">Your visit</td></tr>
      <tr><td style="padding:16px 20px;">
        <div style="margin-bottom:8px;"><strong>Date:</strong> ${dateLong}</div>
        <div style="margin-bottom:8px;"><strong>Time:</strong> ${time} (${escapeHtml(booking.slot.tz || booking.displayTimezone || 'America/New_York')})</div>
        <div style="margin-bottom:8px;"><strong>Where:</strong> ${escapeHtml(businessAddress)}</div>
        <div><strong>Reference:</strong> ${booking.id}</div>
      </td></tr>
    </table>

    <h2 style="font-family:Georgia,serif;font-size:18px;color:#14213D;margin:24px 0 12px 0;">When you arrive</h2>
    <ul style="margin:0 0 24px 0;padding-left:20px;">
      <li style="margin-bottom:6px;">Show this code at the front desk.</li>
      <li style="margin-bottom:6px;">Browse around if you'd like — no pressure.</li>
      <li>Need to reschedule? Call <a href="tel:${businessPhone}" style="color:#A88636;">${businessPhone}</a>.</li>
    </ul>
    <p style="text-align:center;margin:24px 0 0 0;">
      <a href="${confirmUrl}" style="display:inline-block;background:#14213D;color:#C9A961;padding:14px 28px;text-decoration:none;font-family:Georgia,serif;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;font-size:13px;border-radius:2px;">View visit details</a>
    </p>
    <p style="margin:24px 0 0 0;font-size:14px;color:#6B7280;">A calendar invitation is attached.</p>
    ` +
    WRAPPER_CLOSE;

  const text =
    `You qualified, ${booking.customer.firstName}.\n\n` +
    `Your ${offer.name} is reserved. Stop by ${dateLong} at ${time} to pick it up.\n\n` +
    `Code: ${code}\n` +
    `Expires: ${expiresOn}\n\n` +
    `Where: ${businessAddress}\n` +
    `Reference: ${booking.id}\n\n` +
    `View details: ${confirmUrl}\n` +
    `Reschedule: ${businessPhone}\n`;

  return { subject, html, text };
}

export function nurtureT3Email({ booking, offer, code, expiresAt, businessName, businessAddress, businessPhone, confirmUrl }) {
  const dateLong = formatLongDate(booking.slot.date);
  const time = formatTime12h(booking.slot.time);
  const subject = `${offer.name} — reserved for ${dateLong}`;
  const safeFirst = escapeHtml(booking.customer.firstName);
  const expiresIn = daysUntil(expiresAt);
  const expiresLine = expiresIn != null
    ? `Your reservation expires in ${expiresIn} day${expiresIn === 1 ? '' : 's'} — make sure you stop by before then or you'll lose your spot.`
    : '';
  const html =
    WRAPPER_OPEN +
    `
    <h1 style="font-family:Georgia,serif;font-size:22px;font-weight:600;color:#14213D;margin:0 0 12px 0;">${dateLong} is coming up, ${safeFirst}.</h1>
    <p style="margin:0 0 16px 0;">Just a heads-up — your <strong>${escapeHtml(offer.name)}</strong> is reserved for <strong>${dateLong} at ${time}</strong>. Only 50 of these go out each week, so we wanted to make sure you had it on your calendar.</p>
    ${expiresLine ? `<p style="margin:0 0 16px 0;color:#A88636;font-weight:600;">${escapeHtml(expiresLine)}</p>` : ''}
    <p style="margin:0 0 16px 0;">Bring your code:</p>
    <div style="font-family:'Courier New',monospace;font-size:22px;letter-spacing:0.18em;font-weight:700;color:#14213D;background:#FAF8F4;border:2px solid #C9A961;padding:14px;text-align:center;border-radius:2px;margin:0 0 20px 0;">${escapeHtml(code)}</div>
    <p style="margin:0 0 16px 0;font-size:14px;color:#6B7280;">Need to reschedule? Call <a href="tel:${businessPhone}" style="color:#A88636;">${businessPhone}</a> or reply to this email.</p>
    <p style="text-align:center;margin:24px 0 0 0;">
      <a href="${confirmUrl}" style="display:inline-block;background:#14213D;color:#C9A961;padding:12px 24px;text-decoration:none;font-family:Georgia,serif;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;font-size:13px;border-radius:2px;">View visit details</a>
    </p>
    ` +
    WRAPPER_CLOSE;
  const text =
    `${dateLong} is coming up, ${booking.customer.firstName}.\n\n` +
    `Your ${offer.name} is reserved for ${dateLong} at ${time}.\n` +
    (expiresLine ? `${expiresLine}\n` : '') +
    `\nCode: ${code}\n` +
    `Where: ${businessAddress}\n\n` +
    `Reschedule: ${businessPhone}\n${confirmUrl}\n`;
  return { subject, html, text };
}

export function nurtureT1Email({ booking, offer, code, expiresAt, businessName, businessAddress, businessPhone, confirmUrl }) {
  const dateLong = formatLongDate(booking.slot.date);
  const time = formatTime12h(booking.slot.time);
  const subject = `Last chance — your ${offer.name} pickup is tomorrow at ${time}`;
  const safeFirst = escapeHtml(booking.customer.firstName);
  const expiresIn = daysUntil(expiresAt);
  const urgencyLine = expiresIn != null && expiresIn <= 1
    ? `Your reservation expires after tomorrow — this is your last chance to claim it.`
    : `Your reservation expires in ${expiresIn} days — don't lose your spot.`;
  const html =
    WRAPPER_OPEN +
    `
    <h1 style="font-family:Georgia,serif;font-size:22px;font-weight:600;color:#14213D;margin:0 0 12px 0;">See you tomorrow, ${safeFirst}.</h1>
    <p style="margin:0 0 16px 0;">Your <strong>${escapeHtml(offer.name)}</strong> is waiting at the shop. We're set up for <strong>${time}</strong> tomorrow (${dateLong}).</p>
    <p style="margin:0 0 16px 0;color:#A88636;font-weight:600;">${escapeHtml(urgencyLine)}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;border:1px solid #E5E0D5;border-radius:2px;">
      <tr><td style="padding:12px 16px;background:#F4EFE6;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#14213D;">Bring this code</td></tr>
      <tr><td align="center" style="padding:14px;font-family:'Courier New',monospace;font-size:24px;letter-spacing:0.18em;font-weight:700;color:#14213D;">${escapeHtml(code)}</td></tr>
    </table>
    <h2 style="font-family:Georgia,serif;font-size:16px;color:#14213D;margin:16px 0 8px 0;">Quick logistics</h2>
    <ul style="margin:0 0 20px 0;padding-left:20px;">
      <li style="margin-bottom:6px;">${escapeHtml(businessAddress)} — free parking lot in front.</li>
      <li style="margin-bottom:6px;">Stop by the front desk and show your code.</li>
      <li>Running late or need to switch days? Call <a href="tel:${businessPhone}" style="color:#A88636;">${businessPhone}</a>.</li>
    </ul>
    ` +
    WRAPPER_CLOSE;
  const text =
    `See you tomorrow, ${booking.customer.firstName}.\n\n` +
    `${dateLong} at ${time}\n${businessAddress}\n` +
    `${urgencyLine}\n\n` +
    `Code: ${code}\n\n` +
    `Late or rescheduling? ${businessPhone}\n`;
  return { subject, html, text };
}

export function nurtureDayOfEmail({ booking, offer, code, expiresAt, businessName, businessAddress, businessPhone }) {
  const time = formatTime12h(booking.slot.time);
  const subject = `Today at ${time} — your code is ${code}`;
  const safeFirst = escapeHtml(booking.customer.firstName);
  const expiresIn = daysUntil(expiresAt);
  const expiryNote = expiresIn != null && expiresIn <= 1
    ? `Your code expires after today — show up before close to claim.`
    : `Your code is valid for ${expiresIn} more days, but today's your reserved time.`;
  const html =
    WRAPPER_OPEN +
    `
    <h1 style="font-family:Georgia,serif;font-size:22px;font-weight:600;color:#14213D;margin:0 0 12px 0;">Today's the day, ${safeFirst}.</h1>
    <p style="margin:0 0 16px 0;font-size:18px;">Your <strong>${escapeHtml(offer.name)}</strong> is reserved for <strong>${time}</strong>.</p>
    <div style="font-family:'Courier New',monospace;font-size:26px;letter-spacing:0.18em;font-weight:700;color:#14213D;background:#FAF8F4;border:2px solid #C9A961;padding:16px;text-align:center;border-radius:2px;margin:0 0 20px 0;">${escapeHtml(code)}</div>
    <p style="margin:0 0 12px 0;color:#A88636;font-weight:600;">${escapeHtml(expiryNote)}</p>
    <p style="margin:0 0 12px 0;">📍 <a href="https://maps.google.com/?q=${encodeURIComponent(businessAddress)}" style="color:#A88636;">${escapeHtml(businessAddress)}</a></p>
    <p style="margin:0 0 12px 0;">📞 <a href="tel:${businessPhone}" style="color:#A88636;">${businessPhone}</a></p>
    <p style="margin:24px 0 0 0;font-size:14px;color:#6B7280;">Show this code at the front desk — that's it.</p>
    ` +
    WRAPPER_CLOSE;
  const text =
    `Today at ${time}, ${booking.customer.firstName}.\n\n` +
    `Code: ${code}\n${expiryNote}\n` +
    `${businessAddress}\n${businessPhone}\n`;
  return { subject, html, text };
}

/**
 * Pickup-ready notification for in-store tailoring intakes. Templatized so it
 * works for any combination of tailored items the customer selected on the
 * intake form (Hem, Waist, Sleeves, Shirt, Jacket — stored as a comma-separated
 * string in tailoring_notes).
 */
export function intakeReadyForPickupEmail({ intake, businessName, businessAddress, businessPhone }) {
  const safeFirst = escapeHtml(intake.firstName || 'there');
  const items = parseTailoredItems(intake.tailoringNotes);
  const subject = `Tailoring complete — ready for pickup at ${businessName}`;

  const itemsHtml = items.length > 0
    ? `<ul style="margin:0;padding-left:20px;font-size:15px;line-height:1.6;">
         ${items.map((i) => `<li style="margin-bottom:4px;">${escapeHtml(i)}</li>`).join('')}
       </ul>`
    : `<p style="margin:0;color:#6B7280;">Your tailored items are ready.</p>`;

  const html =
    WRAPPER_OPEN +
    `
    <h1 style="font-family:Georgia,serif;font-size:24px;font-weight:600;color:#14213D;margin:0 0 16px 0;">Tailoring complete — ready for pickup</h1>
    <p style="margin:0 0 20px 0;font-size:16px;">Hi ${safeFirst}, your tailoring is finished. Stop by whenever you're in the area to pick it up.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;border:1px solid #E5E0D5;border-radius:2px;">
      <tr><td style="padding:16px 20px;background:#F4EFE6;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#14213D;">What's ready</td></tr>
      <tr><td style="padding:16px 20px;">${itemsHtml}</td></tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;border:1px solid #E5E0D5;border-radius:2px;">
      <tr><td style="padding:16px 20px;background:#F4EFE6;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#14213D;">Where to pick it up</td></tr>
      <tr><td style="padding:16px 20px;font-size:14px;line-height:1.55;">
        <div style="margin-bottom:8px;"><strong>${escapeHtml(businessName)}</strong></div>
        <div style="margin-bottom:8px;">${escapeHtml(businessAddress)}</div>
        <div><a href="tel:${escapeHtml(businessPhone)}" style="color:#A88636;">${escapeHtml(businessPhone)}</a></div>
      </td></tr>
    </table>

    <p style="margin:0 0 8px 0;font-size:14px;color:#6B7280;">Questions or need to schedule a quick try-on? Call <a href="tel:${escapeHtml(businessPhone)}" style="color:#A88636;">${escapeHtml(businessPhone)}</a>.</p>
    ` +
    WRAPPER_CLOSE;

  const text =
    `Tailoring complete — ready for pickup.\n\n` +
    `Hi ${intake.firstName || 'there'}, your tailoring is finished. Stop by whenever you're in the area to pick it up.\n\n` +
    (items.length > 0 ? `What's ready:\n${items.map((i) => `  - ${i}`).join('\n')}\n\n` : '') +
    `Where: ${businessName}\n${businessAddress}\n${businessPhone}\n\n` +
    `Questions? Call ${businessPhone}.\n`;

  return { subject, html, text };
}

const ITEM_TYPE_LABEL = {
  suit: 'suit',
  shirt: 'shirt',
  shoes: 'shoes',
  accessory: 'accessory',
  other: 'item',
};

function specialOrderItemSummary(order) {
  const parts = [];
  if (order.color) parts.push(order.color);
  if (order.size) parts.push(`size ${order.size}`);
  const label = ITEM_TYPE_LABEL[order.itemType] || 'item';
  const lead = parts.length > 0 ? `${parts.join(' ')} ${label}` : label;
  return order.description ? `${lead} — ${order.description}` : lead;
}

export function specialOrderArrivedEmail({ order, businessName, businessAddress, businessPhone }) {
  const safeFirst = escapeHtml(order.firstName || 'there');
  const itemSummary = specialOrderItemSummary(order);
  const subject = `Your special order has arrived at ${businessName}`;

  const detailRows = [];
  if (order.itemType) detailRows.push(['Item', ITEM_TYPE_LABEL[order.itemType] || order.itemType]);
  if (order.color) detailRows.push(['Color', order.color]);
  if (order.size) detailRows.push(['Size', order.size]);
  if (order.description) detailRows.push(['Details', order.description]);

  const detailsHtml = detailRows.length > 0
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0;font-size:14px;line-height:1.55;">
         ${detailRows.map(([k, v]) => `
           <tr>
             <td style="padding:4px 12px 4px 0;color:#6B7280;width:90px;">${escapeHtml(k)}</td>
             <td style="padding:4px 0;color:#14213D;font-weight:600;">${escapeHtml(v)}</td>
           </tr>`).join('')}
       </table>`
    : `<p style="margin:0;color:#6B7280;">Your special order is ready.</p>`;

  const html =
    WRAPPER_OPEN +
    `
    <h1 style="font-family:Georgia,serif;font-size:24px;font-weight:600;color:#14213D;margin:0 0 16px 0;">Your special order has arrived</h1>
    <p style="margin:0 0 20px 0;font-size:16px;">Hi ${safeFirst}, the ${escapeHtml(itemSummary)} you ordered is in. Stop by whenever you're in the area to pick it up.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;border:1px solid #E5E0D5;border-radius:2px;">
      <tr><td style="padding:16px 20px;background:#F4EFE6;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#14213D;">What's ready</td></tr>
      <tr><td style="padding:16px 20px;">${detailsHtml}</td></tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;border:1px solid #E5E0D5;border-radius:2px;">
      <tr><td style="padding:16px 20px;background:#F4EFE6;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#14213D;">Where to pick it up</td></tr>
      <tr><td style="padding:16px 20px;font-size:14px;line-height:1.55;">
        <div style="margin-bottom:8px;"><strong>${escapeHtml(businessName)}</strong></div>
        <div style="margin-bottom:8px;">${escapeHtml(businessAddress)}</div>
        <div><a href="tel:${escapeHtml(businessPhone)}" style="color:#A88636;">${escapeHtml(businessPhone)}</a></div>
      </td></tr>
    </table>

    <p style="margin:0 0 8px 0;font-size:14px;color:#6B7280;">Questions or want to try it on first? Call <a href="tel:${escapeHtml(businessPhone)}" style="color:#A88636;">${escapeHtml(businessPhone)}</a>.</p>
    ` +
    WRAPPER_CLOSE;

  const textRows = detailRows.length > 0
    ? detailRows.map(([k, v]) => `  ${k}: ${v}`).join('\n') + '\n\n'
    : '';

  const text =
    `Your special order has arrived.\n\n` +
    `Hi ${order.firstName || 'there'}, the ${itemSummary} you ordered is in. Stop by whenever you're in the area to pick it up.\n\n` +
    textRows +
    `Where: ${businessName}\n${businessAddress}\n${businessPhone}\n\n` +
    `Questions? Call ${businessPhone}.\n`;

  return { subject, html, text };
}

/**
 * Split tailoring_notes into a clean list. The intake form now writes
 * comma-separated chip selections (Hem, Waist, Sleeves, Shirt, Jacket), but
 * older rows may contain free-form text — we accept either gracefully.
 */
function parseTailoredItems(notes) {
  if (typeof notes !== 'string') return [];
  return notes
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function disqualifiedConsolationEmail({ firstName, businessName, businessPhone, stylingSessionUrl }) {
  const subject = `Your free styling session is ready — no purchase, no pressure`;
  const safeFirst = escapeHtml(firstName || 'friend');

  const html =
    WRAPPER_OPEN +
    `
    <h1 style="font-family:Georgia,serif;font-size:22px;font-weight:600;color:#14213D;margin:0 0 12px 0;">Thanks for stopping by, ${safeFirst}.</h1>
    <p style="margin:0 0 16px 0;">This week's free gift is reserved for shoppers actively looking for a suit. But we'd still love to have you in.</p>
    <p style="margin:0 0 16px 0;">Book a complimentary <strong>45-minute styling session</strong>. No commitment, no purchase. Get measured, see what looks good on you, and leave whenever you want.</p>
    <p style="text-align:center;margin:24px 0 0 0;">
      <a href="${stylingSessionUrl}" style="display:inline-block;background:#14213D;color:#C9A961;padding:14px 28px;text-decoration:none;font-family:Georgia,serif;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;font-size:13px;border-radius:2px;">Book my styling session</a>
    </p>
    <p style="margin:24px 0 0 0;font-size:14px;color:#6B7280;">Questions? Call <a href="tel:${businessPhone}" style="color:#A88636;">${businessPhone}</a>.</p>
    ` +
    WRAPPER_CLOSE;

  const text =
    `Thanks for stopping by, ${firstName || 'friend'}.\n\n` +
    `This week's free gift is reserved for shoppers actively looking for a suit. ` +
    `But we'd still love to have you in. Book a free 45-minute styling session — no commitment, no purchase.\n\n` +
    `${stylingSessionUrl}\n\nQuestions? ${businessPhone}\n`;

  return { subject, html, text };
}
