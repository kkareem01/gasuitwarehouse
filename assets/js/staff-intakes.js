/* Customer intakes dashboard. Reuses GASWStaff helpers from staff.js. */

(function () {
  function $(sel)      { return document.querySelector(sel); }
  function $r(name)    { return document.querySelector(`[data-region="${name}"]`); }
  function $rAll(name) { return Array.from(document.querySelectorAll(`[data-region="${name}"]`)); }
  function esc(s)      { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  const STATUS_LABELS = {
    pending: 'Pending',
    sent: 'Sent to tailor',
    back: 'Back from tailor',
    picked_up: 'Picked up',
  };

  let currentStatus = 'pending';
  let currentSearch = '';
  let searchDebounce = null;
  let pollTimer = null;

  // --- formatting --------------------------------------------------------

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function daysUntil(ymd) {
    if (!ymd) return null;
    const [y, m, d] = ymd.split('-').map(Number);
    const target = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    return Math.round((target - today) / 86400000);
  }

  function fmtDate(ymd) {
    if (!ymd) return '—';
    const [y, m, d] = ymd.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    });
  }

  function fmtIso(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  function relativeDay(days) {
    if (days == null) return '';
    if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`;
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days <= 7) return `In ${days} days`;
    return `In ${days} days`;
  }

  function relativeTime(iso) {
    if (!iso) return '';
    const delta = (Date.now() - new Date(iso).getTime()) / 1000;
    if (delta < 60) return 'just now';
    if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
    if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`;
    const days = Math.floor(delta / 86400);
    return `${days}d ago`;
  }

  // --- alerts ------------------------------------------------------------

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

  // --- table rendering --------------------------------------------------

  function renderNotifyCell(intake) {
    const status = intake.tailorStatus || 'pending';
    const noticeStatus = intake.pickupNoticeStatus || 'pending';

    if (status !== 'back' && noticeStatus !== 'sent') {
      return '<span class="notify-na">—</span>';
    }
    if (noticeStatus === 'sent') {
      return `<span class="notice-sent" title="Sent ${esc(fmtIso(intake.pickupNoticeSentAt))}">✓ Sent ${esc(relativeTime(intake.pickupNoticeSentAt))}</span>`;
    }
    // status === 'back' && noticeStatus === 'pending'
    return `<button class="btn-notify" data-action="notify-ready" data-id="${esc(intake.id)}" data-name="${esc(intake.firstName)} ${esc(intake.lastName)}">Send ready for pickup</button>`;
  }

  function renderRow(intake) {
    const days = daysUntil(intake.needByDate);
    const rowCls = days != null && days < 0 ? 'is-overdue' : (days != null && days <= 3 ? 'is-urgent' : '');
    const relCls = days != null && days < 0 ? 'overdue' : (days != null && days <= 3 ? 'urgent' : '');
    const phoneDigits = (intake.phone || '').replace(/\D/g, '');
    const status = intake.tailorStatus || 'pending';

    const ticket = (intake.ticketNumber || '').trim();
    const ticketCell = ticket
      ? `<span class="ticket-num">${esc(ticket)}</span>`
      : `<span class="ticket-num empty">—</span>`;
    const extraNotes = (intake.additionalNotes || '').trim();

    return `
      <tr class="${rowCls}">
        <td>
          <div class="customer">
            <div class="name">${esc(intake.firstName)} ${esc(intake.lastName)}</div>
            <div class="id">${esc(intake.id)}</div>
          </div>
        </td>
        <td>${ticketCell}</td>
        <td>
          <div class="contact">
            <a href="tel:+1${esc(phoneDigits)}">${esc(intake.phone)}</a>
            <a href="mailto:${esc(intake.email)}">${esc(intake.email)}</a>
          </div>
        </td>
        <td>
          <div class="notes">${esc(intake.tailoringNotes)}</div>
          ${extraNotes ? `<div class="notes-extra">${esc(extraNotes)}</div>` : ''}
        </td>
        <td>
          <div class="date-cell">
            <div class="primary">${fmtDate(intake.needByDate)}</div>
            <div class="relative ${relCls}">${esc(relativeDay(days))}</div>
          </div>
        </td>
        <td>
          <select class="status-select s-${status}" data-action="status-change" data-id="${esc(intake.id)}">
            ${Object.entries(STATUS_LABELS).map(([v, l]) => `<option value="${v}"${v === status ? ' selected' : ''}>${esc(l)}</option>`).join('')}
          </select>
        </td>
        <td>${renderNotifyCell(intake)}</td>
        <td><span style="color:#9CA3AF;font-size:13px;">${fmtIso(intake.createdAt)}</span></td>
      </tr>
    `;
  }

  function renderTable(intakes) {
    const body = $r('rows');
    const empty = $r('empty');
    const count = $r('count');
    if (count) count.textContent = `${intakes.length} ${intakes.length === 1 ? 'intake' : 'intakes'}`;
    if (!intakes.length) {
      if (body) body.innerHTML = '';
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    if (body) body.innerHTML = intakes.map(renderRow).join('');
  }

  // --- API calls --------------------------------------------------------

  async function loadIntakes() {
    hideAlert();
    const params = new URLSearchParams();
    if (currentStatus && currentStatus !== 'all') params.set('status', currentStatus);
    if (currentSearch) params.set('q', currentSearch);
    try {
      const res = await fetch(`/api/admin/intakes?${params.toString()}`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) return showAlert('error', j.error || 'Could not load intakes.');
      renderTable(j.intakes || []);
    } catch (_) {
      showAlert('error', 'Network error. Will retry on next refresh.');
    }
  }

  async function notifyReady(id, name, btnEl) {
    hideAlert();
    const who = (name || '').trim() || 'this customer';
    if (!confirm(`Send pickup-ready email + SMS to ${who}?`)) return;
    btnEl.disabled = true;
    const originalText = btnEl.textContent;
    btnEl.textContent = 'Sending…';
    try {
      const res = await fetch('/api/admin/intake-notify-ready', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        const detail = j.email?.error || j.sms?.error || j.error || 'Send failed.';
        showAlert('error', detail);
        btnEl.disabled = false;
        btnEl.textContent = originalText;
        return;
      }
      const emailOk = j.email?.ok;
      const smsOk = j.sms?.ok;
      let msg;
      if (emailOk && smsOk) msg = 'Email + SMS sent.';
      else if (emailOk) msg = `Email sent (SMS failed: ${j.sms?.error || 'unknown'}).`;
      else if (smsOk) msg = `SMS sent (email failed: ${j.email?.error || 'unknown'}).`;
      else msg = 'Sent.';
      showAlert('success', msg);
      setTimeout(hideAlert, 4000);
      loadIntakes();
    } catch (_) {
      showAlert('error', 'Network error. Try again.');
      btnEl.disabled = false;
      btnEl.textContent = originalText;
    }
  }

  async function changeStatus(id, status, selectEl) {
    hideAlert();
    selectEl.disabled = true;
    try {
      const res = await fetch('/api/admin/intake-status', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, tailorStatus: status }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        return showAlert('error', j.error || 'Could not update status.');
      }
      selectEl.className = `status-select s-${status} status-select`;
      selectEl.classList.add(`s-${status}`);
      showAlert('success', `Status updated to "${STATUS_LABELS[status]}"`);
      setTimeout(hideAlert, 2500);
      // If the new status filters this row out, reload.
      if (currentStatus !== 'all' && currentStatus !== status) {
        loadIntakes();
      }
    } catch (_) {
      showAlert('error', 'Network error. Try again.');
    } finally {
      selectEl.disabled = false;
    }
  }

  function downloadCsv() {
    const params = new URLSearchParams();
    if (currentStatus && currentStatus !== 'all') params.set('status', currentStatus);
    if (currentSearch) params.set('q', currentSearch);
    params.set('format', 'csv');
    // Plain GET to a same-origin URL with content-disposition — let the browser handle the download.
    window.location.href = `/api/admin/intakes?${params.toString()}`;
  }

  // --- wire up ----------------------------------------------------------

  function init() {
    loadIntakes();

    // Status pill click
    document.addEventListener('click', (e) => {
      const pill = e.target.closest('.pill-btn[data-status]');
      if (pill) {
        currentStatus = pill.dataset.status;
        $rAll('status-pills').forEach((g) => {
          g.querySelectorAll('.pill-btn').forEach((b) => b.classList.toggle('is-active', b === pill));
        });
        loadIntakes();
        return;
      }
      const actionEl = e.target.closest('[data-action]');
      const action = actionEl?.dataset.action;
      if (action === 'refresh') loadIntakes();
      if (action === 'download-csv') downloadCsv();
      if (action === 'notify-ready') {
        notifyReady(actionEl.dataset.id, actionEl.dataset.name, actionEl);
      }
    });

    // Status dropdown change
    document.addEventListener('change', (e) => {
      const sel = e.target.closest('select[data-action="status-change"]');
      if (!sel) return;
      changeStatus(sel.dataset.id, sel.value, sel);
    });

    // Debounced search
    const searchEl = $r('search');
    if (searchEl) {
      searchEl.addEventListener('input', () => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => {
          currentSearch = searchEl.value.trim();
          loadIntakes();
        }, 250);
      });
    }

    // Auto-refresh every 60s
    pollTimer = setInterval(loadIntakes, 60000);

    // Pause refresh when tab is hidden, resume + refresh when visible
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) loadIntakes();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
