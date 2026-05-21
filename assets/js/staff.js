/* Staff redeem tool — vanilla JS, no deps.
   Token-in-localStorage gate. URL is unguessable + behind a Bearer token, so
   the iPad-behind-the-counter risk profile is acceptable. Rotate STAFF_TOKEN
   any time to invalidate all stored tokens. */

(function () {
  const TOKEN_KEY = 'gasw-staff-token';

  function $(sel)      { return document.querySelector(sel); }
  function $r(name)    { return document.querySelector(`[data-region="${name}"]`); }
  function $rAll(name) { return Array.from(document.querySelectorAll(`[data-region="${name}"]`)); }

  function getToken() { return localStorage.getItem(TOKEN_KEY) || ''; }
  function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
  function clearToken() { localStorage.removeItem(TOKEN_KEY); }

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

  function authedFetch(path, opts = {}) {
    const headers = { ...(opts.headers || {}), Authorization: `Bearer ${getToken()}` };
    return fetch(path, { ...opts, headers });
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
        clearToken();
        showGate(true);
        return showAlert('error', 'Token rejected. Please re-enter.');
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
        clearToken();
        showGate(true);
        return showAlert('error', 'Token rejected. Please re-enter.');
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
    // Auth gate removed — URLs are unguessable + robots-blocked + iPad-only.
    showGate(false);

    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-action]');
      if (!t) return;
      const action = t.dataset.action;
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

  // Expose minimal helpers for stats.js
  window.GASWStaff = { authedFetch, getToken, setToken, clearToken };

  document.addEventListener('DOMContentLoaded', init);
})();
