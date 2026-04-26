function ts() {
  return new Date().toISOString();
}

function redactEmail(s) {
  if (typeof s !== 'string' || !s.includes('@')) return s;
  const [user, domain] = s.split('@');
  const safe = user.length <= 1 ? user : user[0] + '***';
  return `${safe}@${domain}`;
}

function redactPhone(s) {
  if (typeof s !== 'string') return s;
  const digits = s.replace(/\D/g, '');
  if (digits.length < 4) return s;
  return `(***) ***-${digits.slice(-4)}`;
}

export function info(...args) {
  console.log(`[${ts()}] [info]`, ...args);
}

export function warn(...args) {
  console.warn(`[${ts()}] [warn]`, ...args);
}

export function error(...args) {
  console.error(`[${ts()}] [error]`, ...args);
}

export function safeCustomer(c) {
  if (!c) return c;
  return {
    ...c,
    email: redactEmail(c.email),
    phone: redactPhone(c.phone),
  };
}
