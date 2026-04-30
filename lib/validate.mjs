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

  const em = validateEmail(body.email);
  if (!em.ok) errors.push(...em.errors);

  const ph = validatePhone(body.phone);
  if (!ph.ok) errors.push(...ph.errors);

  const qa = body.qualifierAnswer;
  if (typeof qa !== 'string' || !QUALIFIER_VALUES.includes(qa)) {
    errors.push('Please pick one of the options.');
  }

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
    email: em.value,
    phone: ph.value,
    qualifierAnswer: qa,
    consent: true,
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
