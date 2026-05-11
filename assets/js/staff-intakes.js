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

  let currentStatus = 'open';
  let currentSearch = '';
  let searchDebounce = null;
  let pollTimer = null;
  let lastToken = '';

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

  // --- gate / dashboard visibility --------------------------------------

  function showDashboard(show) {
    const gate = $r('auth-gate');
    const dash = $r('dashboard');
    const acts = $r('actions');
    if (gate) gate.hidden = show;
    if (dash) dash.hidden = !show;
    if (acts) acts.hidden = !show;
  }

  // --- table rendering --------------------------------------------------

  function renderRow(intake) {
    const days = daysUntil(intake.needByDate);
    const rowCls = days != null && days < 0 ? 'is-overdue' : (days != null && days <= 3 ? 'is-urgent' : '');
    const relCls = days != null && days < 0 ? 'overdue' : (days != null && days <= 3 ? 'urgent' : '');
    const phoneDigits = (intake.phone || '').replace(/\D/g, '');
    const status = intake.tailorStatus || 'pending';

    return `
      <tr class="${rowCls}">
        <td>
          <div class="customer">
            <div class="name">${esc(intake.firstName)} ${esc(intake.lastName)}</div>
            <div class="id">${esc(intake.id)}</div>
          </div>
        </td>
        <td>
          <div class="contact">
            <a href="tel:+1${esc(phoneDigits)}">${esc(intake.phone)}</a>
            <a href="mailto:${esc(intake.email)}">${esc(intake.email)}</a>
          </div>
        </td>
        <td>
          <div class="suit">
            <div class="size">${esc(intake.suitSize)}</div>
            <div class="color">${esc(intake.suitColor)}</div>
          </div>
        </td>
        <td><div class="notes">${esc(intake.tailoringNotes)}</div></td>
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

  function authedFetch(path, opts = {}) {
    if (!window.GASWStaff?.authedFetch) return fetch(path, opts);
    return window.GASWStaff.authedFetch(path, opts);
  }

  async function loadIntakes() {
    if (!window.GASWStaff?.getToken()) return;
    hideAlert();
    const params = new URLSearchParams();
    if (currentStatus && currentStatus !== 'all') params.set('status', currentStatus);
    if (currentSearch) params.set('q', currentSearch);
    try {
      const res = await authedFetch(`/api/admin/intakes?${params.toString()}`);
      const j = await res.json().catch(() => ({}));
      if (res.status === 401) {
        window.GASWStaff.clearToken();
        showDashboard(false);
        return showAlert('error', 'Token rejected. Re-enter to continue.');
      }
      if (!res.ok || !j.ok) return showAlert('error', j.error || 'Could not load intakes.');
      renderTable(j.intakes || []);
    } catch (_) {
      showAlert('error', 'Network error. Will retry on next refresh.');
    }
  }

  async function changeStatus(id, status, selectEl) {
    hideAlert();
    selectEl.disabled = true;
    try {
      const res = await authedFetch('/api/admin/intake-status', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, tailorStatus: status }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.status === 401) {
        window.GASWStaff.clearToken();
        showDashboard(false);
        return showAlert('error', 'Token rejected.');
      }
      if (!res.ok || !j.ok) {
        return showAlert('error', j.error || 'Could not update status.');
      }
      selectEl.className = `status-select s-${status} status-select`;
      selectEl.classList.add(`s-${status}`);
      showAlert('success', `Status updated to "${STATUS_LABELS[status]}"`);
      setTimeout(hideAlert, 2500);
      // If the new status filters this row out, reload.
      if (currentStatus !== 'all' && currentStatus !== 'open' && currentStatus !== status) {
        loadIntakes();
      } else if (currentStatus === 'open' && status === 'picked_up') {
        loadIntakes();
      }
    } catch (_) {
      showAlert('error', 'Network error. Try again.');
    } finally {
      selectEl.disabled = false;
    }
  }

  function downloadCsv() {
    const token = window.GASWStaff?.getToken();
    if (!token) return;
    // CSV endpoint requires Authorization header → fetch as blob → trigger download.
    const params = new URLSearchParams();
    if (currentStatus && currentStatus !== 'all') params.set('status', currentStatus);
    if (currentSearch) params.set('q', currentSearch);
    params.set('format', 'csv');
    authedFetch(`/api/admin/intakes?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error('Could not download.');
        return res.blob();
      })
      .then((blob) => {
        const stamp = new Date().toISOString().slice(0, 10);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `intakes-${stamp}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      })
      .catch(() => showAlert('error', 'CSV download failed.'));
  }

  // --- wire up ----------------------------------------------------------

  function init() {
    const hasToken = !!window.GASWStaff?.getToken();
    showDashboard(hasToken);
    if (hasToken) loadIntakes();
    lastToken = window.GASWStaff?.getToken() || '';

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
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'refresh') loadIntakes();
      if (action === 'download-csv') downloadCsv();
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

    // Poll for token appearance (after staff.js handles save-token)
    setInterval(() => {
      const cur = window.GASWStaff?.getToken() || '';
      if (cur && cur !== lastToken) {
        lastToken = cur;
        showDashboard(true);
        loadIntakes();
      } else if (!cur && lastToken) {
        lastToken = '';
        showDashboard(false);
      }
    }, 500);

    // Auto-refresh every 60s
    pollTimer = setInterval(() => {
      if (window.GASWStaff?.getToken()) loadIntakes();
    }, 60000);

    // Pause refresh when tab is hidden, resume when visible
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && window.GASWStaff?.getToken()) loadIntakes();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
