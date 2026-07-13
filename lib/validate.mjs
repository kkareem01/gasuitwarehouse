import { FIELD_SCHEMAS, isValidAudience } from './audiences.mjs';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ok(value) {
  return { ok: true, value };
}
function bad(...errors) {
  return { ok: false, errors };
}

export function validatePhone(input) {
  if (typeof input !== 'string') return bad('Phone is required.');
  const digits = input.replace(/\D/g, '');
  let ten = digits;
  if (digits.length === 11 && digits.startsWith('1')) ten = digits.slice(1);
  if (ten.length !== 10) return bad('Enter a valid US phone number.');
  const formatted = `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
  return ok(formatted);
}

export function validateEmail(input) {
  if (typeof input !== 'string') return bad('Email is required.');
  const trimmed = input.trim();
  if (trimmed.length === 0) return bad('Email is required.');
  if (trimmed.length > 254) return bad('Email is too long.');
  if (!EMAIL_RE.test(trimmed)) return bad('Enter a valid email.');
  return ok(trimmed.toLowerCase());
}

export function validateName(input, label = 'Name') {
  if (typeof input !== 'string') return bad(`${label} is required.`);
  const trimmed = input.trim();
  if (trimmed.length === 0) return bad(`${label} is required.`);
  if (trimmed.length > 60) return bad(`${label} is too long.`);
  return ok(trimmed);
}

export function validateDateString(input, label = 'Date') {
  if (typeof input !== 'string' || !DATE_RE.test(input)) {
    return bad(`${label} must be in YYYY-MM-DD format.`);
  }
  const [y, m, d] = input.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return bad(`${label} is not a real date.`);
  }
  return ok(input);
}

export function validateTimeString(input) {
  if (typeof input !== 'string' || !TIME_RE.test(input)) {
    return bad('Time must be in HH:MM format.');
  }
  const [h, m] = input.split(':').map(Number);
  if (h < 0 || h > 23 || m < 0 || m > 59) return bad('Time is out of range.');
  return ok(input);
}

const CLICK_ID_RE = /^[A-Za-z0-9_.\-]{1,200}$/;
const UTM_KEYS = ['source', 'medium', 'campaign', 'term', 'content'];

/**
 * Normalize the optional `attribution` object sent with lead/booking POSTs
 * (captured client-side by assets/js/analytics.js). Attribution is
 * best-effort marketing metadata: this never returns errors — anything
 * malformed is silently dropped so it can never block a booking. Returns
 * { gclid, gbraid, wbraid, utmJson, landingPage, referrer } or null when
 * nothing usable was sent.
 */
export function validateAttribution(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const clickId = (v) => (typeof v === 'string' && CLICK_ID_RE.test(v.trim()) ? v.trim() : null);
  const cleanText = (v, max) => {
    if (typeof v !== 'string') return null;
    // Strip ASCII control characters (keeps CSV exports and logs clean).
    const s = v.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, max);
    return s.length > 0 ? s : null;
  };

  const gclid = clickId(raw.gclid);
  const gbraid = clickId(raw.gbraid);
  const wbraid = clickId(raw.wbraid);

  let utmJson = null;
  if (raw.utm && typeof raw.utm === 'object' && !Array.isArray(raw.utm)) {
    const utm = {};
    for (const key of UTM_KEYS) {
      const v = cleanText(raw.utm[key], 200);
      if (v) utm[key] = v;
    }
    if (Object.keys(utm).length > 0) utmJson = JSON.stringify(utm);
  }

  const landingPage = cleanText(raw.landingPage, 500);
  const referrer = cleanText(raw.referrer, 500);

  if (!gclid && !gbraid && !wbraid && !utmJson && !landingPage && !referrer) return null;
  return { gclid, gbraid, wbraid, utmJson, landingPage, referrer };
}

function validateField(field, raw) {
  const isEmpty = raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '');
  if (isEmpty) {
    if (field.required) return bad(`${field.label} is required.`);
    return ok('');
  }

  if (field.type === 'date') {
    return validateDateString(raw, field.label);
  }

  if (field.type === 'select') {
    if (!field.options.includes(raw)) {
      return bad(`${field.label}: invalid choice.`);
    }
    return ok(raw);
  }

  // text or textarea
  if (typeof raw !== 'string') return bad(`${field.label}: invalid value.`);
  const trimmed = raw.trim();
  if (field.maxLength && trimmed.length > field.maxLength) {
    return bad(`${field.label} is too long (max ${field.maxLength}).`);
  }
  return ok(trimmed);
}

/**
 * Validate a full POST /api/bookings body.
 * Returns { ok, value?, errors? }. value is normalized.
 */
export function validateBookingPayload(body, nowMs = Date.now()) {
  if (!body || typeof body !== 'object') return bad('Invalid request body.');

  const errors = [];
  const out = {};

  if (!isValidAudience(body.audience)) errors.push('Unknown audience.');
  out.audience = body.audience;

  const fn = validateName(body?.customer?.firstName, 'First name');
  if (!fn.ok) errors.push(...fn.errors);
  const ln = validateName(body?.customer?.lastName, 'Last name');
  if (!ln.ok) errors.push(...ln.errors);
  const ph = validatePhone(body?.customer?.phone);
  if (!ph.ok) errors.push(...ph.errors);
  const em = validateEmail(body?.customer?.email);
  if (!em.ok) errors.push(...em.errors);
  if (body?.customer?.consent !== true) errors.push('You must agree to be contacted.');

  out.customer = {
    firstName: fn.value,
    lastName: ln.value,
    phone: ph.value,
    email: em.value,
    consent: true,
  };

  if (!body.slot || typeof body.slot !== 'object') {
    errors.push('Slot is required.');
  } else {
    const sd = validateDateString(body.slot.date, 'Slot date');
    const st = validateTimeString(body.slot.time);
    if (!sd.ok) errors.push(...sd.errors);
    if (!st.ok) errors.push(...st.errors);
    out.slot = { date: sd.value, time: st.value };
  }

  out.timezone = typeof body.timezone === 'string' && body.timezone.length > 0 && body.timezone.length < 64
    ? body.timezone
    : 'America/New_York';

  out.answers = {};
  if (errors.length === 0 || isValidAudience(body.audience)) {
    const schema = FIELD_SCHEMAS[body.audience] || [];
    for (const field of schema) {
      const r = validateField(field, body?.answers?.[field.name]);
      if (!r.ok) errors.push(...r.errors);
      else out.answers[field.name] = r.value;
    }
  }

  if (typeof body.honeypot === 'string' && body.honeypot.length > 0) {
    errors.push('Submission rejected.');
  }
  if (typeof body.formStartedAt === 'number' && nowMs - body.formStartedAt < 4000) {
    errors.push('Submission rejected: please take a moment to review.');
  }

  if (errors.length > 0) return { ok: false, errors };
  return ok(out);
}

const QUALIFIER_VALUES = ['event', 'wardrobe', 'maybe', 'no'];

export function validateLeadMagnetPayload(body, nowMs = Date.now()) {
  if (!body || typeof body !== 'object') return bad('Invalid request body.');
  const errors = [];

  const fn = validateName(body.firstName, 'First name');
  if (!fn.ok) errors.push(...fn.errors);

  const ln = validateName(body.lastName, 'Last name');
  if (!ln.ok) errors.push(...ln.errors);

  const em = validateEmail(body.email);
  if (!em.ok) errors.push(...em.errors);

  const ph = validatePhone(body.phone);
  if (!ph.ok) errors.push(...ph.errors);

  // Qualifier is optional — the gift opt-in form no longer asks it. If a
  // legacy client still sends it, accept only the known values.
  const qaRaw = typeof body.qualifierAnswer === 'string' ? body.qualifierAnswer : '';
  const qa = QUALIFIER_VALUES.includes(qaRaw) ? qaRaw : null;

  if (body.consent !== true) errors.push('You must agree to be contacted.');

  if (typeof body.hp === 'string' && body.hp.length > 0) {
    return { ok: false, errors: ['Submission rejected.'], code: 'HONEYPOT' };
  }
  if (typeof body.startedAt === 'number' && nowMs - body.startedAt < 3000) {
    return { ok: false, errors: ['Please take a moment to review.'], code: 'TOO_FAST' };
  }

  if (errors.length > 0) return { ok: false, errors };

  return ok({
    firstName: fn.value,
    lastName: ln.value,
    email: em.value,
    phone: ph.value,
    qualifierAnswer: qa,
    consent: true,
  });
}

function todayInStoreTz(tz = 'America/New_York') {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(new Date());
}

export function validateIntakePayload(body, nowMs = Date.now()) {
  if (!body || typeof body !== 'object') return bad('Invalid request body.');
  const errors = [];

  if (typeof body.hp === 'string' && body.hp.length > 0) {
    return { ok: false, errors: ['Submission rejected.'], code: 'HONEYPOT' };
  }
  if (typeof body.startedAt === 'number' && nowMs - body.startedAt < 3000) {
    return { ok: false, errors: ['Please take a moment to review.'], code: 'TOO_FAST' };
  }

  const fn = validateName(body.firstName, 'First name');
  if (!fn.ok) errors.push(...fn.errors);

  const ln = validateName(body.lastName, 'Last name');
  if (!ln.ok) errors.push(...ln.errors);

  const ph = validatePhone(body.phone);
  if (!ph.ok) errors.push(...ph.errors);

  const em = validateEmail(body.email);
  if (!em.ok) errors.push(...em.errors);

  // Suit size + color are no longer collected by the form. Accept whatever
  // the client sends (empty if absent) so the NOT NULL columns stay populated.
  const sizeRaw = typeof body.suitSize === 'string' ? body.suitSize.trim().slice(0, 16) : '';
  const colorRaw = typeof body.suitColor === 'string' ? body.suitColor.trim().slice(0, 32) : '';

  const tailRaw = typeof body.tailoringNotes === 'string' ? body.tailoringNotes.trim() : '';
  if (tailRaw.length === 0) errors.push('Pick at least one thing that needs to be tailored.');
  else if (tailRaw.length > 500) errors.push('Tailoring notes are too long (max 500 characters).');

  const ticketRaw = typeof body.ticketNumber === 'string' ? body.ticketNumber.trim().slice(0, 32) : '';

  const notesRaw = typeof body.additionalNotes === 'string' ? body.additionalNotes.trim() : '';
  if (notesRaw.length > 500) errors.push('Additional notes are too long (max 500 characters).');

  const dateRes = validateDateString(body.needByDate, 'Need-by date');
  if (!dateRes.ok) errors.push(...dateRes.errors);
  else {
    const today = todayInStoreTz();
    if (dateRes.value < today) errors.push('Need-by date must be today or later.');
  }

  if (errors.length > 0) return { ok: false, errors };

  return ok({
    firstName: fn.value,
    lastName: ln.value,
    phone: ph.value,
    email: em.value,
    suitSize: sizeRaw,
    suitColor: colorRaw,
    ticketNumber: ticketRaw,
    tailoringNotes: tailRaw,
    additionalNotes: notesRaw,
    needByDate: dateRes.value,
  });
}

export function validateLeadPayload(body) {
  if (!body || typeof body !== 'object') return bad('Invalid request body.');
  const errors = [];

  if (!isValidAudience(body.audience)) errors.push('Unknown audience.');

  const fn = validateName(body.firstName, 'First name');
  const ln = validateName(body.lastName, 'Last name');
  const ph = validatePhone(body.phone);
  if (!fn.ok) errors.push(...fn.errors);
  if (!ln.ok) errors.push(...ln.errors);
  if (!ph.ok) errors.push(...ph.errors);
  if (body.consent !== true) errors.push('Consent is required.');

  if (errors.length > 0) return { ok: false, errors };
  return ok({
    audience: body.audience,
    firstName: fn.value,
    lastName: ln.value,
    phone: ph.value,
    consent: true,
  });
}
