/**
 * Mirror new intakes into a Google Sheet via a Google Apps Script webhook.
 *
 * The Sheet is the staff-facing "Excel" view of the intakes table — the DB
 * is the source of truth. This mirror is best-effort and non-fatal: if the
 * webhook is unreachable, the customer's submission still succeeds and the
 * row's sheets_status is recorded as 'failed' for later retry.
 *
 * Setup: see docs/sheets-webhook-setup.md.
 * Required env var: SHEETS_WEBHOOK_URL (an Apps Script /exec URL).
 */

import * as log from './log.mjs';

const TIMEOUT_MS = 3000;

export function isSheetsConfigured() {
  return typeof process.env.SHEETS_WEBHOOK_URL === 'string'
    && process.env.SHEETS_WEBHOOK_URL.length > 0;
}

/**
 * Returns { ok: true } on success, { ok: false, detail } on failure.
 * Never throws.
 */
export async function mirrorIntakeToSheet(intake) {
  const url = process.env.SHEETS_WEBHOOK_URL;
  if (!url) return { ok: false, detail: 'SHEETS_WEBHOOK_URL not set' };

  const row = {
    id: intake.id,
    createdAt: intake.createdAt,
    firstName: intake.firstName,
    lastName: intake.lastName,
    phone: intake.phone,
    email: intake.email,
    suitSize: intake.suitSize,
    suitColor: intake.suitColor,
    tailoringNotes: intake.tailoringNotes,
    needByDate: intake.needByDate,
  };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(row),
      signal: ctrl.signal,
      redirect: 'follow',
    });
    if (!res.ok) {
      const detail = `HTTP ${res.status}`;
      log.warn(`sheets mirror failed for ${intake.id}: ${detail}`);
      return { ok: false, detail };
    }
    return { ok: true };
  } catch (e) {
    const detail = e?.name === 'AbortError' ? 'timeout' : String(e?.message || e);
    log.warn(`sheets mirror error for ${intake.id}: ${detail}`);
    return { ok: false, detail };
  } finally {
    clearTimeout(timer);
  }
}
