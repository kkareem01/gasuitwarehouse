/**
 * Twilio SMS via fetch. No SDK.
 * Honors DRY_RUN_SMS=true by writing the rendered message to tmp/last-sms.txt
 * instead of calling the API — mirrors lib/email.mjs.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import * as log from './log.mjs';

/**
 * Normalize a phone string to E.164. Returns null if it can't be normalized
 * to 10–15 digits.
 */
export function toE164(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (hasPlus && digits.length >= 10 && digits.length <= 15) return `+${digits}`;
  return null;
}

/**
 * @param {object} opts
 * @param {string} opts.to    Destination phone (any format — normalized to E.164)
 * @param {string} opts.body  SMS body (kept under ~320 chars; carriers may segment longer)
 * @returns {Promise<{ok:true,sid:string,dryRun?:boolean,file?:string}|{ok:false,error:string}>}
 */
export async function sendSms({ to, body }) {
  const normalized = toE164(to);
  if (!normalized) {
    return { ok: false, error: `Invalid phone number: ${to}` };
  }
  if (typeof body !== 'string' || body.trim().length === 0) {
    return { ok: false, error: 'SMS body is empty.' };
  }

  const dryRun = process.env.DRY_RUN_SMS === 'true';
  if (dryRun) {
    await mkdir('tmp', { recursive: true });
    const stamp = `${Date.now()}-${randomBytes(2).toString('hex')}`;
    const file = `tmp/sms-${stamp}.txt`;
    const banner = `--- DRY_RUN_SMS ---\nTo: ${normalized}\nFrom: ${process.env.TWILIO_FROM_NUMBER ?? '(unset)'}\nLength: ${body.length}\n---\n`;
    await writeFile(file, banner + body, 'utf8');
    await writeFile('tmp/last-sms.txt', banner + body, 'utf8');
    log.info(`Dry-run SMS written to ${file}`);
    return { ok: true, sid: `dry-${stamp}`, dryRun: true, file };
  }

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
    return { ok: false, error: 'TWILIO_* env vars missing.' };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`;
  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const params = new URLSearchParams({ To: normalized, From: from, Body: body });

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { ok: false, error: `Twilio ${res.status}: ${detail.slice(0, 200)}` };
    }
    const data = await res.json().catch(() => ({}));
    return { ok: true, sid: data.sid };
  } catch (err) {
    return { ok: false, error: `SMS send failed: ${err.message}` };
  }
}
