/* Shared staff dashboard bootstrap — vanilla JS, no deps.
   Loaded first on every /staff/* page (redeem, intakes, stats).

   Auth: a password overlay. The page content is hidden until GET
   /api/admin/session says this device holds a valid session cookie; POST
   /api/admin/login with the staff password sets that cookie for 30 days.
   The server enforces the real gate — every /api/admin/* endpoint 401s
   without the cookie — so hiding the shell here is only cosmetic.

   The legacy Bearer STAFF_TOKEN path still works and is kept as break-glass:
   if a token is in localStorage it rides along on every admin request. */

(function () {
  const TOKEN_KEY = 'gasw-staff-token';

  function $(sel)      { return document.querySelector(sel); }
  function $r(name)    { return document.querySelector(`[data-region="${name}"]`); }
  function $rAll(name) { return Array.from(document.querySelectorAll(`[data-region="${name}"]`)); }

  function getToken() { return localStorage.getItem(TOKEN_KEY) || ''; }
  function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
  function clearToken() { localStorage.removeItem(TOKEN_KEY); }

  /* ------------------------------------------------------------------ */
  /* Password overlay                                                    */
  /* ------------------------------------------------------------------ */

  /* Resolves to whether this device is signed in. adminFetch awaits it so the
     dashboard modules don't fire a burst of doomed requests behind the gate. */
  let sessionReady = null;

  const LOCK_CLASS = 'gasw-staff-locked';
  const LOGIN_ID = 'gasw-staff-login';
  const LOGIN_CSS = `
    html.${LOCK_CLASS} body > *:not(#${LOGIN_ID}) { display: none !important; }
    #${LOGIN_ID} {
      position: fixed; inset: 0; z-index: 9999;
      display: flex; align-items: center; justify-content: center;
      padding: 24px; background: #0E1729;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    #${LOGIN_ID}[hidden] { display: none; }
    #${LOGIN_ID} form {
      width: 100%; max-width: 340px;
      background: #16223D; border: 1px solid #2A3654; border-radius: 8px;
      padding: 28px 24px; color: #fff;
    }
    #${LOGIN_ID} h1 { margin: 0 0 6px; font-size: 19px; font-weight: 700; }
    #${LOGIN_ID} p.hint { margin: 0 0 18px; font-size: 13px; color: #9CA3AF; }
    #${LOGIN_ID} input {
      width: 100%; padding: 11px 12px; font-size: 16px;
      border-radius: 4px; border: 1px solid #2A3654;
      background: #0E1729; color: #fff; margin-bottom: 12px;
    }
    #${LOGIN_ID} input:focus { outline: none; border-color: #C9A961; }
    #${LOGIN_ID} button {
      width: 100%; padding: 11px 14px; font-size: 14px; font-weight: 700;
      border-radius: 4px; border: 1px solid #C9A961;
      background: #C9A961; color: #0E1729; cursor: pointer;
    }
    #${LOGIN_ID} button[disabled] { opacity: 0.6; cursor: default; }
    #${LOGIN_ID} .err {
      margin: 12px 0 0; font-size: 13px; color: #FBB4AE;
    }
    #${LOGIN_ID} .err[hidden] { display: none; }
    .gasw-staff-signout {
      position: fixed; right: 14px; bottom: 12px; z-index: 40;
      font-size: 12px; color: #6B7280; background: none; border: 0;
      cursor: pointer; padding: 6px 8px;
    }
    .gasw-staff-signout:hover { color: #C9A961; }
  `;

  const LOGIN_ERRORS = {
    expired: 'Session expired. Enter the staff password again.',
    BAD_PASSWORD: 'Wrong password. Try again.',
    TOO_MANY_ATTEMPTS: 'Too many tries. Wait a few minutes and try again.',
    PASSWORD_NOT_CONFIGURED: 'No staff password is set on the server yet (STAFF_PASSWORD).',
    SESSION_SECRET_NOT_CONFIGURED: 'Server is missing STAFF_TOKEN / STAFF_SESSION_SECRET to sign the login.',
    NETWORK: 'Network error. Check the connection and try again.',
  };

  function injectLoginStyles() {
    if (document.getElementById(`${LOGIN_ID}-style`)) return;
    const style = document.createElement('style');
    style.id = `${LOGIN_ID}-style`;
    style.textContent = LOGIN_CSS;
    document.head.appendChild(style);
  }

  function lockPage() {
    injectLoginStyles();
    document.documentElement.classList.add(LOCK_CLASS);
  }

  function unlockPage() {
    document.documentElement.classList.remove(LOCK_CLASS);
    const overlay = document.getElementById(LOGIN_ID);
    if (overlay) overlay.hidden = true;
  }

  function buildLoginOverlay() {
    const existing = document.getElementById(LOGIN_ID);
    if (existing) return existing;
    const el = document.createElement('div');
    el.id = LOGIN_ID;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', `${LOGIN_ID}-title`);
    el.innerHTML = `
      <form novalidate>
        <h1 id="${LOGIN_ID}-title">Staff sign in</h1>
        <p class="hint">Enter the staff password to open this dashboard.</p>
        <input type="password" name="password" autocomplete="current-password"
               autocapitalize="off" autocorrect="off" spellcheck="false"
               placeholder="Staff password" aria-label="Staff password" />
        <button type="submit">Sign in</button>
        <p class="err" hidden></p>
      </form>`;
    document.body.appendChild(el);
    el.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      submitLogin(el);
    });
    return el;
  }

  function setLoginError(overlay, message) {
    const err = overlay.querySelector('.err');
    if (!err) return;
    err.textContent = message || '';
    err.hidden = !message;
  }

  function showLogin({ configured = true, reason = '' } = {}) {
    lockPage();
    const overlay = buildLoginOverlay();
    overlay.hidden = false;
    if (!configured) setLoginError(overlay, LOGIN_ERRORS.PASSWORD_NOT_CONFIGURED);
    else if (reason) setLoginError(overlay, LOGIN_ERRORS[reason] || '');
    const input = overlay.querySelector('input[name="password"]');
    if (input) input.focus();
  }

  async function submitLogin(overlay) {
    const input = overlay.querySelector('input[name="password"]');
    const btn = overlay.querySelector('button[type="submit"]');
    const password = input ? input.value : '';
    if (!password) return setLoginError(overlay, 'Enter the password.');

    setLoginError(overlay, '');
    if (btn) { btn.disabled = true; btn.textContent = 'Signing in…'; }
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ password }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) {
        // Reload so every dashboard module re-runs its initial load with the cookie.
        window.location.reload();
        return;
      }
      if (input) input.value = '';
      setLoginError(overlay, LOGIN_ERRORS[j.error] || 'Could not sign in. Try again.');
    } catch (_) {
      setLoginError(overlay, LOGIN_ERRORS.NETWORK);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Sign in'; }
    }
  }

  async function logout() {
    clearToken();
    try {
      await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' });
    } catch (_) { /* clearing the cookie client-side isn't possible; reload shows the gate */ }
    window.location.reload();
  }

  function addSignOutButton() {
    if (document.querySelector('.gasw-staff-signout')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gasw-staff-signout';
    btn.dataset.action = 'staff-logout';
    btn.textContent = 'Sign out';
    document.body.appendChild(btn);
  }

  /* Runs before DOMContentLoaded (this script is `defer`), so the dashboard
     shell stays hidden until the session check answers. */
  async function guardPage() {
    lockPage();
    let state = { authed: false, configured: true };
    try {
      const res = await fetch('/api/admin/session', { credentials: 'same-origin' });
      const j = await res.json().catch(() => ({}));
      if (j && j.ok) state = { authed: Boolean(j.authed), configured: j.configured !== false };
    } catch (_) {
      // Network failure — treat as signed out rather than exposing the shell.
    }
    if (state.authed) {
      unlockPage();
      addSignOutButton();
    } else {
      showLogin({ configured: state.configured });
    }
    return state.authed;
  }

  function showGate(show) {
    const gate = $r('auth-gate');
    const form = $r('lookup-form');
    if (gate) gate.hidden = !show;
    if (form) form.hidden = show;
  }

  function showAlert(kind, msg) {
    const el = $r('alert');
    if (!el) return;
    el.className = 'alert ' + kind;
    el.textContent = msg;
    el.hidden = false;
  }
  function hideAlert() {
    const el = $r('alert');
    if (el) el.hidden = true;
  }

  /* Session cookie does the work; the Bearer header only rides along when a
     legacy token was saved on this device. */
  function authedFetch(path, opts = {}) {
    const token = getToken();
    const headers = { ...(opts.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(path, { ...opts, headers, credentials: 'same-origin' });
  }

  /* Called by dashboard modules when an admin request comes back 401: the
     session expired or was never established. Re-opens the password overlay.
     Always returns false — the caller should not retry; signing in reloads. */
  function handle401() {
    showLogin({ configured: true, reason: 'expired' });
    return false;
  }

  function unauthorizedResponse() {
    return new Response(JSON.stringify({ ok: false, error: 'UNAUTHORIZED' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  /* authedFetch that waits for the session check, skips the round trip while
     the page is locked, and surfaces the login overlay on 401. All staff
     dashboard modules should use this instead of plain fetch.
     Pass { silent: true } for background pollers that must never pop the
     overlay on their own — the next interactive action will. */
  async function adminFetch(path, opts = {}) {
    const { silent = false, ...fetchOpts } = opts;
    const authed = sessionReady ? await sessionReady : true;
    if (!authed) {
      if (!silent) showLogin({ configured: true });
      return unauthorizedResponse();
    }
    const res = await authedFetch(path, fetchOpts);
    if (res.status === 401 && !silent) handle401();
    return res;
  }

  function fmtDate(ymd) {
    if (!ymd) return '—';
    const [y, m, d] = ymd.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
    });
  }
  function fmtTime12(t) {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${String(m).padStart(2, '0')} ${period}`;
  }
  function fmtIso(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  function renderResult(c) {
    const result = $r('result');
    if (!result) return;
    result.hidden = false;
    $r('result-title').textContent = c.customer.firstName ? `${c.customer.firstName}'s reservation` : 'Reservation';
    $r('result-code').textContent = c.code;
    const status = $r('result-status');
    status.textContent = c.status;
    status.className = 'pill ' + c.status;
    $r('result-customer').textContent = c.customer.firstName || '—';
    $r('result-gift').textContent = c.offer?.name || '—';
    if (c.booking) {
      $r('row-appt').hidden = false;
      $r('result-appt').textContent = `${fmtDate(c.booking.date)} ${fmtTime12(c.booking.time)}`;
    } else {
      $r('row-appt').hidden = true;
    }
    if (c.redeemedAt) {
      $r('row-redeemed-at').hidden = false;
      $r('result-redeemed-at').textContent = fmtIso(c.redeemedAt);
    } else {
      $r('row-redeemed-at').hidden = true;
    }
    if (c.redeemedByStaff) {
      $r('row-redeemed-by').hidden = false;
      $r('result-redeemed-by').textContent = c.redeemedByStaff;
    } else {
      $r('row-redeemed-by').hidden = true;
    }
    const redeemBtn = $r('redeem-btn');
    if (redeemBtn) redeemBtn.hidden = c.status !== 'issued';
  }

  function clearResult() {
    const result = $r('result');
    if (result) result.hidden = true;
  }

  async function lookup() {
    hideAlert();
    clearResult();
    const input = $('#code-input');
    const code = (input?.value || '').toUpperCase().trim();
    if (!/^GIFT-[A-Z2-9]{6}$/.test(code)) {
      return showAlert('error', 'Code must look like GIFT-XXXXXX (6 chars).');
    }
    const btn = $r('lookup-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Looking up…'; }
    try {
      const res = await authedFetch(`/api/admin/lookup-code?code=${encodeURIComponent(code)}`);
      const j = await res.json().catch(() => ({}));
      if (res.status === 401) {
        showLogin({ configured: true, reason: 'expired' });
        return showAlert('error', 'Session expired. Sign in again.');
      }
      if (res.status === 404) return showAlert('error', 'No code matches that. Double-check the email or QR.');
      if (!res.ok || !j.ok) return showAlert('error', j.error || 'Something went wrong.');
      renderResult(j.code);
      if (j.code.status === 'redeemed') showAlert('warn', 'This code has already been redeemed.');
      else if (j.code.status === 'expired' || j.code.status === 'noshow') {
        showAlert('error', `This code is ${j.code.status}. It can no longer be redeemed.`);
      } else if (j.code.status === 'reserved') {
        showAlert('warn', 'This is a reserved code — the customer has not yet booked an appointment.');
      }
    } catch (_) {
      showAlert('error', 'Network error. Please try again.');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Look Up'; }
    }
  }

  async function redeem() {
    hideAlert();
    const codeEl = $r('result-code');
    const code = codeEl?.textContent || '';
    if (!/^GIFT-[A-Z2-9]{6}$/.test(code)) return;
    const btn = $r('redeem-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Marking…'; }
    try {
      const res = await authedFetch('/api/admin/redeem', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.status === 401) {
        showLogin({ configured: true, reason: 'expired' });
        return showAlert('error', 'Session expired. Sign in again.');
      }
      if (res.status === 409 && j.error === 'ALREADY_REDEEMED') {
        renderResult(j.code);
        return showAlert('warn', 'Already redeemed.');
      }
      if (!res.ok || !j.ok) return showAlert('error', j.error || 'Could not redeem.');
      renderResult(j.code);
      showAlert('success', `Redeemed. ${j.code.offer.name} handed to ${j.code.customer.firstName || 'customer'}.`);
    } catch (_) {
      showAlert('error', 'Network error. Please try again.');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Mark Redeemed'; }
    }
  }

  function reset() {
    hideAlert();
    clearResult();
    const input = $('#code-input');
    if (input) { input.value = ''; input.focus(); }
  }

  function init() {
    // The gift-code page's legacy token box stays hidden; the password overlay
    // in guardPage() is the gate now. The box is still reachable for support
    // ("save-token" below) if someone needs the Bearer break-glass.
    showGate(false);

    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-action]');
      if (!t) return;
      const action = t.dataset.action;
      if (action === 'staff-logout') logout();
      if (action === 'save-token') {
        const v = ($('#staff-token')?.value || '').trim();
        if (v.length < 16) return showAlert('error', 'Token must be at least 16 chars.');
        setToken(v);
        $('#staff-token').value = '';
        showGate(false);
        hideAlert();
        const codeInput = $('#code-input');
        if (codeInput) codeInput.focus();
      }
      if (action === 'lookup') lookup();
      if (action === 'redeem') redeem();
      if (action === 'reset') reset();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const input = $('#code-input');
        if (input && document.activeElement === input) {
          e.preventDefault();
          lookup();
        }
      }
    });

    // Auto-uppercase code as user types
    const codeInput = $('#code-input');
    if (codeInput) {
      codeInput.addEventListener('input', () => {
        const cur = codeInput.selectionStart;
        codeInput.value = codeInput.value.toUpperCase();
        codeInput.setSelectionRange(cur, cur);
      });
    }
  }

  // Expose minimal helpers for the other staff dashboard modules
  window.GASWStaff = {
    authedFetch, adminFetch, handle401,
    getToken, setToken, clearToken,
    showLogin, logout,
  };

  // Hide the shell immediately (this script is `defer`, so the DOM is parsed
  // but nothing has been painted as authenticated yet), then verify the session.
  sessionReady = guardPage();

  document.addEventListener('DOMContentLoaded', init);
})();
