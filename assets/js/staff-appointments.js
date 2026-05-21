/* Appointments tab on the staff intakes dashboard.
 * Lists every booking appointment (styling sessions, weddings, prom, tuxedo
 * fittings) made online, and drives the red "new appointment" badge on the
 * Appointments tab.
 *
 * Lives alongside staff-intakes.js / staff-special-orders.js — each script
 * owns its own [data-view-panel] section. The badge poller runs on every page
 * load regardless of the active tab, so staff see new bookings arrive.
 */

(function () {
  function $r(name) { return document.querySelector(`[data-region="${name}"]`); }
  function esc(s)   { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  const STATUS_LABELS = {
    new: 'New Booking',
    confirmed: 'Confirmed',
    completed: 'Completed',
    no_show: 'No-show',
    cancelled: 'Cancelled',
  };

  // Statuses a staff member can assign from the row dropdown. A booking is a
  // "New Booking" (status 'new') until staff close it out as Completed or
  // No-show — that 'new' state drives the red badge and is never directly
  // staff-assignable. Legacy 'confirmed'/'cancelled' bookings likewise show a
  // read-only placeholder until moved forward.
  const SELECTABLE_STATUSES = ['completed', 'no_show'];

  const AUDIENCE_LABELS = {
    weddings: 'Wedding fitting',
    general: 'Styling session',
    prom: 'Prom appointment',
    tuxedos: 'Tuxedo appointment',
  };

  // Audience-specific keys stored in answers_json, with staff-facing labels.
  // Optional fields may be missing or empty — renderDetailsCell guards each.
  const ANSWER_FIELDS = {
    weddings: [['eventDate', 'Wedding date'], ['partySize', 'Party size'], ['priorities', 'Notes']],
    general:  [['occasion', 'Occasion'], ['eventDate', 'Needed by'], ['notes', 'Notes']],
    prom:     [['eventDate', 'Prom date'], ['partySize', 'Group size'], ['notes', 'Notes']],
    tuxedos:  [['occasion', 'Occasion'], ['eventDate', 'Event date'], ['notes', 'Notes']],
  };

  const ACTIVE_TAB_KEY = 'gasw.staff.activeTab';
  const POLL_MS = 60000;
  const BASE_TITLE = document.title;

  let currentStatus = 'new';   // matches the pill marked is-active in the HTML
  let currentSearch = '';
  let searchDebounce = null;
  let currentBookings = [];
  let panelInitialized = false;
  let panelActive = false;
  let refreshTimer = null;
  let badgeTimer = null;
  let lastBadgeCount = 0;

  // --- formatting --------------------------------------------------------

  function fmtDate(ymd) {
    if (!ymd) return '—';
    const [y, m, d] = ymd.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
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

  function daysUntil(ymd) {
    if (!ymd) return null;
    const [y, m, d] = ymd.split('-').map(Number);
    const target = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    return Math.round((target - today) / 86400000);
  }

  function relativeDay(days) {
    if (days == null) return '';
    if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`;
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return `In ${days} days`;
  }

  // --- alerts (shared with the other dashboard scripts via #alert region) -

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

  // --- the red "new appointment" badge ----------------------------------

  function setBadge(n) {
    const count = Math.max(0, Number(n) || 0);
    lastBadgeCount = count;
    const badge = $r('appt-badge');
    if (badge) {
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.hidden = count === 0;
    }
    // Surface the count in the browser tab too, so staff notice it even when
    // the dashboard is in a background tab.
    document.title = count > 0 ? `(${count}) ${BASE_TITLE}` : BASE_TITLE;
  }

  async function pollBadge() {
    try {
      const res = await fetch('/api/admin/bookings-count');
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok && typeof j.newCount === 'number') setBadge(j.newCount);
    } catch (_) {
      // Network blip — keep the last known badge, never touch the alert banner.
    }
  }

  function startBadgePoller() {
    pollBadge();
    if (badgeTimer) clearInterval(badgeTimer);
    badgeTimer = setInterval(() => {
      if (!document.hidden) pollBadge();
    }, POLL_MS);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) pollBadge();
    });
  }

  // --- table rendering --------------------------------------------------

  function renderCustomerCell(b) {
    const c = b.customer || {};
    const name = `${(c.firstName || '').trim()} ${(c.lastName || '').trim()}`.trim() || '—';
    return `
      <div class="customer">
        <a href="#" class="name name-link" data-action="appt-edit" data-id="${esc(b.id)}">${esc(name)}</a>
        <div class="id">${esc(b.id)}</div>
      </div>
    `;
  }

  function renderContactCell(b) {
    const c = b.customer || {};
    const phoneDigits = (c.phone || '').replace(/\D/g, '');
    const lines = [];
    if (c.phone) lines.push(`<a href="tel:+1${esc(phoneDigits)}">${esc(c.phone)}</a>`);
    if (c.email) lines.push(`<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`);
    if (lines.length === 0) return '<span class="appt-details"><span class="none">—</span></span>';
    return `<div class="contact">${lines.join('')}</div>`;
  }

  function renderTypeCell(b) {
    const label = AUDIENCE_LABELS[b.audience] || b.audience || 'Appointment';
    return `<span class="appt-type">${esc(label)}</span>`;
  }

  function renderDateTimeCell(b) {
    const slot = b.slot || {};
    if (!slot.date) return '<span class="appt-details"><span class="none">—</span></span>';
    const days = daysUntil(slot.date);
    const relCls = days != null && days >= 0 && days <= 1 ? 'urgent' : '';
    const time = slot.time ? ` · ${esc(fmtTime12(slot.time))}` : '';
    return `
      <div class="date-cell">
        <div class="primary">${fmtDate(slot.date)}${time}</div>
        <div class="relative ${relCls}">${esc(relativeDay(days))}</div>
      </div>
    `;
  }

  function renderDetailsCell(b) {
    const fields = ANSWER_FIELDS[b.audience] || [];
    const answers = b.answers || {};
    const rows = [];
    for (const [key, label] of fields) {
      const raw = answers[key];
      if (raw == null || String(raw).trim() === '') continue;
      const value = key === 'eventDate' ? fmtDate(String(raw)) : String(raw).trim();
      rows.push(`<div class="row"><span class="k">${esc(label)}:</span> ${esc(value)}</div>`);
    }
    if (rows.length === 0) return '<div class="appt-details"><span class="none">—</span></div>';
    return `<div class="appt-details">${rows.join('')}</div>`;
  }

  function renderStatusSelect(b) {
    const status = b.staffStatus || 'new';
    const opts = [];
    // A booking still in 'new' (or a legacy 'cancelled') gets a disabled
    // placeholder so its real state stays visible — staff can only move it
    // forward to one of the selectable statuses.
    if (!SELECTABLE_STATUSES.includes(status)) {
      opts.push(`<option value="${esc(status)}" disabled selected>${esc(STATUS_LABELS[status] || status)}</option>`);
    }
    for (const v of SELECTABLE_STATUSES) {
      opts.push(`<option value="${v}"${v === status ? ' selected' : ''}>${esc(STATUS_LABELS[v])}</option>`);
    }
    return `<select class="status-select s-${esc(status)}" data-action="appt-status-change" data-id="${esc(b.id)}">${opts.join('')}</select>`;
  }

  function renderRow(b) {
    const status = b.staffStatus || 'new';
    const rowCls = status === 'new' ? 'is-new' : '';
    return `
      <tr class="${rowCls}">
        <td>${renderCustomerCell(b)}</td>
        <td>${renderContactCell(b)}</td>
        <td>${renderTypeCell(b)}</td>
        <td>${renderDateTimeCell(b)}</td>
        <td>${renderDetailsCell(b)}</td>
        <td>${renderStatusSelect(b)}</td>
        <td><span style="color:#9CA3AF;font-size:13px;">${fmtIso(b.createdAt)}</span></td>
      </tr>
    `;
  }

  function renderTable(bookings) {
    const body = $r('appt-rows');
    const empty = $r('appt-empty');
    const count = $r('appt-count');
    if (count) count.textContent = `${bookings.length} ${bookings.length === 1 ? 'appointment' : 'appointments'}`;
    if (!bookings.length) {
      if (body) body.innerHTML = '';
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    if (body) body.innerHTML = bookings.map(renderRow).join('');
  }

  // --- API calls --------------------------------------------------------

  async function loadBookings({ quiet = false } = {}) {
    if (!quiet) hideAlert();
    const params = new URLSearchParams();
    if (currentStatus && currentStatus !== 'all') params.set('status', currentStatus);
    if (currentSearch) params.set('q', currentSearch);
    try {
      const res = await fetch(`/api/admin/bookings?${params.toString()}`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        if (!quiet) showAlert('error', j.error || 'Could not load appointments.');
        return;
      }
      currentBookings = j.bookings || [];
      renderTable(currentBookings);
      if (typeof j.newCount === 'number') setBadge(j.newCount);
    } catch (_) {
      if (!quiet) showAlert('error', 'Network error. Will retry on next refresh.');
    }
  }

  async function changeStatus(id, status, selectEl) {
    hideAlert();
    selectEl.disabled = true;
    try {
      const res = await fetch('/api/admin/booking-status', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, staffStatus: status }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        return showAlert('error', j.error || 'Could not update status.');
      }
      if (typeof j.newCount === 'number') setBadge(j.newCount);
      // Reflect the change locally so the row updates without a full refetch.
      const idx = currentBookings.findIndex((x) => x.id === id);
      if (idx >= 0) currentBookings[idx] = { ...currentBookings[idx], staffStatus: status };
      if (currentStatus !== 'all' && currentStatus !== status) {
        // The row no longer matches the active filter — reload to drop it.
        loadBookings({ quiet: true });
      } else {
        renderTable(currentBookings);
      }
      showAlert('success', `Status updated to "${STATUS_LABELS[status] || status}"`);
      setTimeout(hideAlert, 2500);
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
    window.location.href = `/api/admin/bookings?${params.toString()}`;
  }

  // --- edit / delete modal ----------------------------------------------

  function answerLabel(audience, key) {
    const known = (ANSWER_FIELDS[audience] || []).find(([k]) => k === key);
    if (known) return known[1];
    // Humanize an unknown key: serviceType -> "Service type".
    const s = key.replace(/([A-Z])/g, ' $1').replace(/[_-]+/g, ' ').trim();
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // Renders one input per key actually stored in the booking's answers, so
  // every audience-specific field is editable (and merge-preserved on save).
  function renderAnswerInputs(b) {
    const wrap = $r('appt-modal-answers');
    if (!wrap) return;
    const answers = b.answers || {};
    wrap.innerHTML = Object.keys(answers).map((key) => {
      const label = esc(answerLabel(b.audience, key));
      const val = esc(answers[key] == null ? '' : String(answers[key]));
      if (key === 'eventDate') {
        return `<label>${label}<input type="date" data-answer-key="${esc(key)}" value="${val}" /></label>`;
      }
      if (/notes|priorities|comment/i.test(key)) {
        return `<label>${label}<textarea data-answer-key="${esc(key)}" rows="3" maxlength="500">${val}</textarea></label>`;
      }
      return `<label>${label}<input type="text" data-answer-key="${esc(key)}" maxlength="500" value="${val}" /></label>`;
    }).join('');
  }

  function setModalError(msg) {
    const box = $r('appt-modal-error');
    if (!box) return;
    if (!msg) { box.hidden = true; box.textContent = ''; return; }
    box.textContent = msg;
    box.hidden = false;
  }

  function showModal() {
    const modal = $r('appt-modal');
    if (!modal) return;
    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add('is-open'));
  }

  function closeModal() {
    const modal = $r('appt-modal');
    if (!modal) return;
    modal.classList.remove('is-open');
    setModalError('');
    setTimeout(() => { modal.hidden = true; }, 220);
  }

  function openEditModal(id) {
    const b = currentBookings.find((x) => x.id === id);
    if (!b) {
      showAlert('error', 'Could not find that appointment. Refreshing.');
      loadBookings();
      return;
    }
    const form = $r('appt-modal-form');
    if (!form) return;
    const c = b.customer || {};
    form.elements.id.value = b.id;
    form.elements.firstName.value = c.firstName || '';
    form.elements.lastName.value = c.lastName || '';
    form.elements.phone.value = c.phone || '';
    form.elements.email.value = c.email || '';
    form.elements.slotDate.value = b.slot?.date || '';
    form.elements.slotTime.value = b.slot?.time || '';
    renderAnswerInputs(b);

    const title = $r('appt-modal-title');
    if (title) title.textContent = `Edit appointment · ${b.id}`;
    const typeHint = $r('appt-modal-type');
    if (typeHint) typeHint.textContent = AUDIENCE_LABELS[b.audience] || b.audience || '';

    setModalError('');
    showModal();
  }

  function collectFormPayload() {
    const form = $r('appt-modal-form');
    if (!form) return null;
    const answers = {};
    const wrap = $r('appt-modal-answers');
    if (wrap) {
      wrap.querySelectorAll('[data-answer-key]').forEach((el) => {
        answers[el.dataset.answerKey] = el.value.trim();
      });
    }
    return {
      id: form.elements.id.value,
      firstName: form.elements.firstName.value.trim(),
      lastName: form.elements.lastName.value.trim(),
      phone: form.elements.phone.value.trim(),
      email: form.elements.email.value.trim(),
      slotDate: form.elements.slotDate.value.trim(),
      slotTime: form.elements.slotTime.value.trim(),
      answers,
    };
  }

  async function saveModal() {
    const payload = collectFormPayload();
    if (!payload) return;
    const saveBtn = $r('appt-save-btn');
    setModalError('');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.dataset.originalText = saveBtn.textContent;
      saveBtn.textContent = 'Saving…';
    }
    try {
      const res = await fetch('/api/admin/booking-edit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        setModalError(j.error === 'SLOT_TAKEN'
          ? 'That date & time is already booked. Pick another slot.'
          : (j.error || 'Could not save. Try again.'));
        return;
      }
      closeModal();
      loadBookings({ quiet: true });
      showAlert('success', 'Appointment updated.');
      setTimeout(hideAlert, 2500);
    } catch (_) {
      setModalError('Network error. Try again.');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = saveBtn.dataset.originalText || 'Save changes';
      }
    }
  }

  async function deleteFromModal() {
    const form = $r('appt-modal-form');
    const id = form?.elements.id.value;
    if (!id) return;
    const b = currentBookings.find((x) => x.id === id);
    const who = b
      ? `${b.customer?.firstName || ''} ${b.customer?.lastName || ''}`.trim() || id
      : 'this appointment';
    if (!confirm(`Delete the appointment for ${who}? This frees the slot and cannot be undone.`)) return;
    setModalError('');
    try {
      const res = await fetch('/api/admin/booking-delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        setModalError(j.error || 'Could not delete. Try again.');
        return;
      }
      if (typeof j.newCount === 'number') setBadge(j.newCount);
      currentBookings = currentBookings.filter((x) => x.id !== id);
      renderTable(currentBookings);
      closeModal();
      showAlert('success', 'Appointment deleted.');
      setTimeout(hideAlert, 2500);
    } catch (_) {
      setModalError('Network error. Try again.');
    }
  }

  // --- tab activation + per-tab auto-refresh ----------------------------

  function startRefreshTimer() {
    if (refreshTimer) return;
    refreshTimer = setInterval(() => {
      if (panelActive && !document.hidden) loadBookings({ quiet: true });
    }, POLL_MS);
  }

  function activatePanel() {
    panelActive = true;
    if (!panelInitialized) {
      panelInitialized = true;
      loadBookings();
      startRefreshTimer();
    } else {
      loadBookings({ quiet: true });
    }
  }

  function restoreActiveTab() {
    let active;
    try { active = localStorage.getItem(ACTIVE_TAB_KEY); } catch (_) { active = null; }
    if (active !== 'appointments') return;
    const tab = document.querySelector('.view-tab[data-view="appointments"]');
    if (tab) tab.click();
  }

  // --- wire up ----------------------------------------------------------

  function init() {
    // Status pill clicks scoped to the appointments panel.
    document.addEventListener('click', (e) => {
      const pill = e.target.closest('.pill-btn[data-appt-status]');
      if (pill) {
        currentStatus = pill.dataset.apptStatus;
        document.querySelectorAll('[data-region="appt-status-pills"] .pill-btn').forEach((b) => {
          b.classList.toggle('is-active', b === pill);
        });
        loadBookings();
        return;
      }

      const actionEl = e.target.closest('[data-action]');
      const action = actionEl?.dataset.action;
      if (action === 'appt-refresh') {
        loadBookings();
        return;
      }
      if (action === 'appt-download-csv') {
        downloadCsv();
        return;
      }
      if (action === 'appt-edit') {
        e.preventDefault();
        openEditModal(actionEl.dataset.id);
        return;
      }
      if (action === 'appt-close-modal') {
        closeModal();
        return;
      }
      if (action === 'appt-save') {
        saveModal();
        return;
      }
      if (action === 'appt-delete') {
        deleteFromModal();
        return;
      }
    });

    // Status dropdown change scoped to appointment rows.
    document.addEventListener('change', (e) => {
      const sel = e.target.closest('select[data-action="appt-status-change"]');
      if (!sel) return;
      changeStatus(sel.dataset.id, sel.value, sel);
    });

    // Escape closes the edit modal.
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const modal = $r('appt-modal');
      if (modal && !modal.hidden) closeModal();
    });

    // Activate when the user switches to this tab; track active/inactive so
    // the auto-refresh only fires while the panel is on screen.
    document.addEventListener('gasw:view-changed', (e) => {
      const view = e.detail?.view;
      if (view === 'appointments') activatePanel();
      else panelActive = false;
    });

    // Debounced search.
    const searchEl = $r('appt-search');
    if (searchEl) {
      searchEl.addEventListener('input', () => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => {
          currentSearch = searchEl.value.trim();
          loadBookings();
        }, 250);
      });
    }

    // The badge poller runs no matter which tab is open — that is the whole
    // point of the priority indicator.
    startBadgePoller();
    restoreActiveTab();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
