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
  let currentIntakes = [];
  let currentEditId = null;

  const KNOWN_CHIPS = ['Hem', 'Waist', 'Sleeves', 'Shirt', 'Jacket', 'Vest', 'Slim Pants'];

  function activeChipsFromNotes(str) {
    const set = new Set(
      String(str || '').split(',').map((s) => s.trim()).filter(Boolean)
    );
    return KNOWN_CHIPS.filter((c) => set.has(c));
  }

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
            <a href="#" class="name name-link" data-action="open-edit" data-id="${esc(intake.id)}">${esc(intake.firstName)} ${esc(intake.lastName)}</a>
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
      const res = await window.GASWStaff.adminFetch(`/api/admin/intakes?${params.toString()}`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) return showAlert('error', j.error || 'Could not load intakes.');
      currentIntakes = j.intakes || [];
      renderTable(currentIntakes);
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
      const res = await window.GASWStaff.adminFetch('/api/admin/intake-notify-ready', {
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
      const res = await window.GASWStaff.adminFetch('/api/admin/intake-status', {
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

  async function downloadCsv() {
    // Fetch with the auth header and hand the bytes to a temp <a download> —
    // a plain navigation can't carry the Authorization header.
    const params = new URLSearchParams();
    if (currentStatus && currentStatus !== 'all') params.set('status', currentStatus);
    if (currentSearch) params.set('q', currentSearch);
    params.set('format', 'csv');
    try {
      const res = await window.GASWStaff.adminFetch(`/api/admin/intakes?${params.toString()}`);
      if (!res.ok) return showAlert('error', 'Could not download CSV.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `intakes-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (_) {
      showAlert('error', 'Network error. Try again.');
    }
  }

  // --- edit modal ------------------------------------------------------

  function renderChips(activeSet) {
    const wrap = $r('edit-modal-chips');
    if (!wrap) return;
    wrap.innerHTML = KNOWN_CHIPS.map((label) => {
      const active = activeSet.has(label) ? ' is-active' : '';
      return `<button type="button" class="edit-chip${active}" data-chip="${esc(label)}" aria-pressed="${active ? 'true' : 'false'}">${esc(label)}</button>`;
    }).join('');
  }

  function setEditError(msg) {
    const box = $r('edit-modal-error');
    if (!box) return;
    if (!msg) { box.hidden = true; box.textContent = ''; return; }
    box.textContent = msg;
    box.hidden = false;
  }

  function openEditModal(id) {
    const intake = currentIntakes.find((i) => i.id === id);
    if (!intake) {
      showAlert('error', 'Could not find that intake. Refreshing.');
      loadIntakes();
      return;
    }
    currentEditId = id;
    const form = $r('edit-modal-form');
    if (!form) return;

    form.elements.id.value = intake.id;
    form.elements.firstName.value = intake.firstName || '';
    form.elements.lastName.value = intake.lastName || '';
    form.elements.phone.value = intake.phone || '';
    form.elements.email.value = intake.email || '';
    form.elements.ticketNumber.value = intake.ticketNumber || '';
    form.elements.needByDate.value = intake.needByDate || '';
    form.elements.additionalNotes.value = intake.additionalNotes || '';

    renderChips(new Set(activeChipsFromNotes(intake.tailoringNotes)));

    setEditError('');

    const modal = $r('edit-modal');
    if (!modal) return;
    modal.hidden = false;
    // Defer adding is-open by one frame so the transition plays.
    requestAnimationFrame(() => modal.classList.add('is-open'));
  }

  function closeEditModal() {
    const modal = $r('edit-modal');
    if (!modal) return;
    modal.classList.remove('is-open');
    setEditError('');
    // Hide after transition finishes.
    setTimeout(() => { modal.hidden = true; }, 220);
    currentEditId = null;
  }

  function toggleChip(btn) {
    const active = btn.classList.toggle('is-active');
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  }

  function collectTailoringPayload() {
    const wrap = $r('edit-modal-chips');
    if (!wrap) return '';
    return Array.from(wrap.querySelectorAll('.edit-chip.is-active'))
      .map((b) => b.dataset.chip)
      .join(', ');
  }

  async function saveEditModal() {
    if (!currentEditId) return;
    const form = $r('edit-modal-form');
    if (!form) return;
    const saveBtn = document.querySelector('[data-action="save-edit-modal"]');
    setEditError('');

    const payload = {
      id: currentEditId,
      firstName: form.elements.firstName.value.trim(),
      lastName: form.elements.lastName.value.trim(),
      phone: form.elements.phone.value.trim(),
      email: form.elements.email.value.trim(),
      ticketNumber: form.elements.ticketNumber.value.trim(),
      tailoringNotes: collectTailoringPayload(),
      needByDate: form.elements.needByDate.value.trim(),
      additionalNotes: form.elements.additionalNotes.value.trim(),
    };

    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }
    try {
      const res = await window.GASWStaff.adminFetch('/api/admin/intake-edit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        setEditError(j.error || 'Could not save. Try again.');
        return;
      }
      const updated = j.data;
      if (updated) {
        const idx = currentIntakes.findIndex((i) => i.id === updated.id);
        if (idx >= 0) currentIntakes[idx] = updated;
        renderTable(currentIntakes);
      }
      closeEditModal();
    } catch (_) {
      setEditError('Network error. Try again.');
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save changes'; }
    }
  }

  async function deleteIntakeFromModal() {
    if (!currentEditId) return;
    const intake = currentIntakes.find((i) => i.id === currentEditId);
    const who = intake ? `${intake.firstName} ${intake.lastName}`.trim() : 'this intake';
    if (!confirm(`Delete ${who}? This cannot be undone.`)) return;
    setEditError('');
    try {
      const res = await window.GASWStaff.adminFetch('/api/admin/intake-delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: currentEditId }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        setEditError(j.error || 'Could not delete. Try again.');
        return;
      }
      currentIntakes = currentIntakes.filter((i) => i.id !== currentEditId);
      renderTable(currentIntakes);
      closeEditModal();
    } catch (_) {
      setEditError('Network error. Try again.');
    }
  }

  // --- tab switching ----------------------------------------------------

  const ACTIVE_TAB_KEY = 'gasw.staff.activeTab';

  function switchView(view) {
    document.querySelectorAll('.view-tab').forEach((t) => {
      const active = t.dataset.view === view;
      t.classList.toggle('is-active', active);
      t.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.querySelectorAll('[data-view-panel]').forEach((p) => {
      p.hidden = p.dataset.viewPanel !== view;
    });
    try { localStorage.setItem(ACTIVE_TAB_KEY, view); } catch (_) { /* private mode */ }
    document.dispatchEvent(new CustomEvent('gasw:view-changed', { detail: { view } }));
  }

  // --- wire up ----------------------------------------------------------

  function init() {
    loadIntakes();

    // View-tab click
    document.addEventListener('click', (e) => {
      const tab = e.target.closest('.view-tab[data-view]');
      if (tab) {
        switchView(tab.dataset.view);
        return;
      }
    });

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
      // Chip toggle inside the edit modal — handle before generic actions
      // so it doesn't interfere.
      const chipBtn = e.target.closest('.edit-chip[data-chip]');
      if (chipBtn) {
        toggleChip(chipBtn);
        return;
      }

      const actionEl = e.target.closest('[data-action]');
      const action = actionEl?.dataset.action;
      if (action === 'refresh') loadIntakes();
      if (action === 'download-csv') downloadCsv();
      if (action === 'notify-ready') {
        notifyReady(actionEl.dataset.id, actionEl.dataset.name, actionEl);
      }
      if (action === 'open-edit') {
        e.preventDefault();
        openEditModal(actionEl.dataset.id);
      }
      if (action === 'close-edit-modal') {
        closeEditModal();
      }
      if (action === 'save-edit-modal') {
        saveEditModal();
      }
      if (action === 'delete-intake') {
        deleteIntakeFromModal();
      }
    });

    // Escape key closes the modal.
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const modal = $r('edit-modal');
      if (modal && !modal.hidden) closeEditModal();
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
