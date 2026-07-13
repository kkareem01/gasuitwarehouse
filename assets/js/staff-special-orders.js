/* Special Orders tab on the staff intakes dashboard.
 * Lives alongside staff-intakes.js — both scripts share the page, but each
 * owns its own data region (the [data-view-panel] sections).
 */

(function () {
  function $r(name) { return document.querySelector(`[data-region="${name}"]`); }
  function esc(s)   { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  const STATUS_LABELS = {
    pending: 'Pending',
    ordered: 'Ordered',
    arrived: 'Arrived',
    picked_up: 'Picked up',
  };

  const ITEM_TYPE_LABELS = {
    suit: 'Suit',
    shirt: 'Shirt',
    shoes: 'Shoes',
    accessory: 'Accessory',
    other: 'Other',
  };

  const ACTIVE_TAB_KEY = 'gasw.staff.activeTab';

  let currentStatus = 'pending';
  let currentSearch = '';
  let searchDebounce = null;
  let currentOrders = [];
  let currentEditId = null;   // null means "create mode"
  let panelInitialized = false;

  // --- formatting --------------------------------------------------------

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

  function relativeTime(iso) {
    if (!iso) return '';
    const delta = (Date.now() - new Date(iso).getTime()) / 1000;
    if (delta < 60) return 'just now';
    if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
    if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`;
    const days = Math.floor(delta / 86400);
    return `${days}d ago`;
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
    if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`;
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return `In ${days} days`;
  }

  // --- alerts (shared with staff-intakes.js via the same #alert region) --

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

  function renderCustomerCell(order) {
    const name = `${(order.firstName || '').trim()} ${(order.lastName || '').trim()}`.trim();
    const display = name || '—';
    return `
      <div class="customer">
        <a href="#" class="name name-link" data-action="so-edit" data-id="${esc(order.id)}">${esc(display)}</a>
        <div class="id">${esc(order.id)}</div>
      </div>
    `;
  }

  function renderItemCell(order) {
    const typeLabel = ITEM_TYPE_LABELS[order.itemType] || order.itemType || 'Item';
    const specs = [];
    if (order.color) specs.push(esc(order.color));
    if (order.size) specs.push(`<span class="muted">size</span> ${esc(order.size)}`);
    const specsHtml = specs.length > 0
      ? `<div class="specs">${specs.join(' · ')}</div>`
      : '<div class="specs muted">—</div>';
    return `<div class="so-item"><div class="type">${esc(typeLabel)}</div>${specsHtml}</div>`;
  }

  function renderContactCell(order) {
    const phoneDigits = (order.phone || '').replace(/\D/g, '');
    const lines = [];
    if (order.phone) lines.push(`<a href="tel:+1${esc(phoneDigits)}">${esc(order.phone)}</a>`);
    if (order.email) lines.push(`<a href="mailto:${esc(order.email)}">${esc(order.email)}</a>`);
    if (lines.length === 0) return '<span class="so-empty-cell">—</span>';
    return `<div class="contact">${lines.join('')}</div>`;
  }

  function renderNotesCell(order) {
    const desc = (order.description || '').trim();
    const extra = (order.additionalNotes || '').trim();
    if (!desc && !extra) return '<span class="so-empty-cell">—</span>';
    return `
      ${desc ? `<div class="notes">${esc(desc)}</div>` : ''}
      ${extra ? `<div class="notes-extra">${esc(extra)}</div>` : ''}
    `;
  }

  function renderNeedByCell(order) {
    if (!order.needByDate) return '<span class="so-empty-cell">—</span>';
    const days = daysUntil(order.needByDate);
    const relCls = days != null && days < 0 ? 'overdue' : (days != null && days <= 3 ? 'urgent' : '');
    return `
      <div class="date-cell">
        <div class="primary">${fmtDate(order.needByDate)}</div>
        <div class="relative ${relCls}">${esc(relativeDay(days))}</div>
      </div>
    `;
  }

  function renderNotifyCell(order) {
    const status = order.orderStatus || 'pending';
    const noticeStatus = order.arrivalNoticeStatus || 'pending';
    const hasContact = Boolean(order.email || order.phone);

    if (status !== 'arrived' && noticeStatus !== 'sent') {
      return '<span class="notify-na">—</span>';
    }
    if (noticeStatus === 'sent') {
      return `<span class="notice-sent" title="Sent ${esc(fmtIso(order.arrivalNoticeSentAt))}">✓ Sent ${esc(relativeTime(order.arrivalNoticeSentAt))}</span>`;
    }
    if (!hasContact) {
      return '<span class="notify-na" title="No phone or email on file">no contact</span>';
    }
    const name = `${order.firstName || ''} ${order.lastName || ''}`.trim();
    return `<button class="btn-notify" data-action="so-notify-arrived" data-id="${esc(order.id)}" data-name="${esc(name)}">Send arrival notice</button>`;
  }

  function renderRow(order) {
    const days = daysUntil(order.needByDate);
    const rowCls = days != null && days < 0 ? 'is-overdue' : (days != null && days <= 3 ? 'is-urgent' : '');
    const status = order.orderStatus || 'pending';

    return `
      <tr class="${rowCls}">
        <td>${renderCustomerCell(order)}</td>
        <td>${renderItemCell(order)}</td>
        <td>${renderContactCell(order)}</td>
        <td>${renderNotesCell(order)}</td>
        <td>${renderNeedByCell(order)}</td>
        <td>
          <select class="status-select s-${status}" data-action="so-status-change" data-id="${esc(order.id)}">
            ${Object.entries(STATUS_LABELS).map(([v, l]) => `<option value="${v}"${v === status ? ' selected' : ''}>${esc(l)}</option>`).join('')}
          </select>
        </td>
        <td>${renderNotifyCell(order)}</td>
        <td><span style="color:#9CA3AF;font-size:13px;">${fmtIso(order.createdAt)}</span></td>
      </tr>
    `;
  }

  function renderTable(orders) {
    const body = $r('so-rows');
    const empty = $r('so-empty');
    const count = $r('so-count');
    if (count) count.textContent = `${orders.length} ${orders.length === 1 ? 'order' : 'orders'}`;
    if (!orders.length) {
      if (body) body.innerHTML = '';
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    if (body) body.innerHTML = orders.map(renderRow).join('');
  }

  // --- API calls --------------------------------------------------------

  async function loadOrders() {
    hideAlert();
    const params = new URLSearchParams();
    if (currentStatus && currentStatus !== 'all') params.set('status', currentStatus);
    if (currentSearch) params.set('q', currentSearch);
    try {
      const res = await window.GASWStaff.adminFetch(`/api/admin/special-orders?${params.toString()}`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) return showAlert('error', j.error || 'Could not load special orders.');
      currentOrders = j.orders || [];
      renderTable(currentOrders);
    } catch (_) {
      showAlert('error', 'Network error. Will retry on next refresh.');
    }
  }

  async function notifyArrived(id, name, btnEl) {
    hideAlert();
    const who = (name || '').trim() || 'this customer';
    if (!confirm(`Send arrival notice (email + SMS) to ${who}?`)) return;
    btnEl.disabled = true;
    const originalText = btnEl.textContent;
    btnEl.textContent = 'Sending…';
    try {
      const res = await window.GASWStaff.adminFetch('/api/admin/special-order-notify-arrived', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        const detail = j.email?.error || j.sms?.error || j.error || j.detail || 'Send failed.';
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
      loadOrders();
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
      const res = await window.GASWStaff.adminFetch('/api/admin/special-order-status', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, orderStatus: status }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        return showAlert('error', j.error || 'Could not update status.');
      }
      // Update local copy so the notify button toggles right away.
      if (j.data) {
        const idx = currentOrders.findIndex((o) => o.id === j.data.id);
        if (idx >= 0) currentOrders[idx] = j.data;
        if (currentStatus !== 'all' && currentStatus !== status) {
          // Row no longer matches the active filter — reload to drop it.
          loadOrders();
        } else {
          renderTable(currentOrders);
        }
      }
      showAlert('success', `Status updated to "${STATUS_LABELS[status]}"`);
      setTimeout(hideAlert, 2500);
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
      const res = await window.GASWStaff.adminFetch(`/api/admin/special-orders?${params.toString()}`);
      if (!res.ok) return showAlert('error', 'Could not download CSV.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `special-orders-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (_) {
      showAlert('error', 'Network error. Try again.');
    }
  }

  // --- modal -----------------------------------------------------------

  function setModalError(msg) {
    const box = $r('so-modal-error');
    if (!box) return;
    if (!msg) { box.hidden = true; box.textContent = ''; return; }
    box.textContent = msg;
    box.hidden = false;
  }

  function openCreateModal() {
    currentEditId = null;
    const form = $r('so-modal-form');
    if (!form) return;

    form.reset();
    form.elements.id.value = '';
    form.elements.itemType.value = 'suit';

    const title = $r('so-modal-title');
    if (title) title.textContent = 'New special order';
    const deleteBtn = $r('so-delete-btn');
    if (deleteBtn) deleteBtn.hidden = true;
    const saveBtn = $r('so-save-btn');
    if (saveBtn) saveBtn.textContent = 'Create';

    setModalError('');
    showModal();
  }

  function openEditModal(id) {
    const order = currentOrders.find((o) => o.id === id);
    if (!order) {
      showAlert('error', 'Could not find that order. Refreshing.');
      loadOrders();
      return;
    }
    currentEditId = id;
    const form = $r('so-modal-form');
    if (!form) return;

    form.elements.id.value = order.id;
    form.elements.firstName.value = order.firstName || '';
    form.elements.lastName.value = order.lastName || '';
    form.elements.phone.value = order.phone || '';
    form.elements.email.value = order.email || '';
    form.elements.itemType.value = order.itemType || 'suit';
    form.elements.color.value = order.color || '';
    form.elements.size.value = order.size || '';
    form.elements.description.value = order.description || '';
    form.elements.needByDate.value = order.needByDate || '';
    form.elements.additionalNotes.value = order.additionalNotes || '';

    const title = $r('so-modal-title');
    if (title) title.textContent = `Edit special order · ${order.id}`;
    const deleteBtn = $r('so-delete-btn');
    if (deleteBtn) deleteBtn.hidden = false;
    const saveBtn = $r('so-save-btn');
    if (saveBtn) saveBtn.textContent = 'Save changes';

    setModalError('');
    showModal();
  }

  function showModal() {
    const modal = $r('so-modal');
    if (!modal) return;
    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add('is-open'));
  }

  function closeModal() {
    const modal = $r('so-modal');
    if (!modal) return;
    modal.classList.remove('is-open');
    setModalError('');
    setTimeout(() => { modal.hidden = true; }, 220);
    currentEditId = null;
  }

  function collectFormPayload() {
    const form = $r('so-modal-form');
    if (!form) return null;
    return {
      firstName: form.elements.firstName.value.trim(),
      lastName: form.elements.lastName.value.trim(),
      phone: form.elements.phone.value.trim(),
      email: form.elements.email.value.trim(),
      itemType: form.elements.itemType.value,
      color: form.elements.color.value.trim(),
      size: form.elements.size.value.trim(),
      description: form.elements.description.value.trim(),
      needByDate: form.elements.needByDate.value.trim(),
      additionalNotes: form.elements.additionalNotes.value.trim(),
    };
  }

  async function saveModal() {
    const payload = collectFormPayload();
    if (!payload) return;
    const saveBtn = $r('so-save-btn');
    setModalError('');

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.dataset.originalText = saveBtn.textContent;
      saveBtn.textContent = 'Saving…';
    }
    try {
      const isEdit = Boolean(currentEditId);
      const url = isEdit
        ? '/api/admin/special-order-edit'
        : '/api/admin/special-order-create';
      const body = isEdit ? { ...payload, id: currentEditId } : payload;
      const res = await window.GASWStaff.adminFetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        setModalError(j.error || 'Could not save. Try again.');
        return;
      }
      closeModal();
      // Refresh from server so filtering/sorting is authoritative.
      loadOrders();
    } catch (_) {
      setModalError('Network error. Try again.');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = saveBtn.dataset.originalText || 'Save';
      }
    }
  }

  async function deleteFromModal() {
    if (!currentEditId) return;
    const order = currentOrders.find((o) => o.id === currentEditId);
    const who = order
      ? `${order.firstName || ''} ${order.lastName || ''}`.trim() || order.id
      : 'this order';
    if (!confirm(`Delete special order for ${who}? This cannot be undone.`)) return;
    setModalError('');
    try {
      const res = await window.GASWStaff.adminFetch('/api/admin/special-order-delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: currentEditId }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        setModalError(j.error || 'Could not delete. Try again.');
        return;
      }
      currentOrders = currentOrders.filter((o) => o.id !== currentEditId);
      renderTable(currentOrders);
      closeModal();
    } catch (_) {
      setModalError('Network error. Try again.');
    }
  }

  // --- tab activation ---------------------------------------------------

  function activatePanel() {
    if (!panelInitialized) {
      panelInitialized = true;
      loadOrders();
    }
  }

  function restoreActiveTab() {
    let active;
    try { active = localStorage.getItem(ACTIVE_TAB_KEY); } catch (_) { active = null; }
    if (active !== 'special-orders') return;
    const tab = document.querySelector('.view-tab[data-view="special-orders"]');
    if (tab) tab.click();
  }

  // --- wire up ----------------------------------------------------------

  function init() {
    // Status pill clicks scoped to the special-orders panel.
    document.addEventListener('click', (e) => {
      const pill = e.target.closest('.pill-btn[data-so-status]');
      if (pill) {
        currentStatus = pill.dataset.soStatus;
        document.querySelectorAll('[data-region="so-status-pills"] .pill-btn').forEach((b) => {
          b.classList.toggle('is-active', b === pill);
        });
        loadOrders();
        return;
      }

      const actionEl = e.target.closest('[data-action]');
      const action = actionEl?.dataset.action;
      if (action === 'so-new') {
        openCreateModal();
        return;
      }
      if (action === 'so-refresh') {
        loadOrders();
        return;
      }
      if (action === 'so-download-csv') {
        downloadCsv();
        return;
      }
      if (action === 'so-edit') {
        e.preventDefault();
        openEditModal(actionEl.dataset.id);
        return;
      }
      if (action === 'so-close-modal') {
        closeModal();
        return;
      }
      if (action === 'so-save') {
        saveModal();
        return;
      }
      if (action === 'so-delete') {
        deleteFromModal();
        return;
      }
      if (action === 'so-notify-arrived') {
        notifyArrived(actionEl.dataset.id, actionEl.dataset.name, actionEl);
        return;
      }
    });

    // Status dropdown change scoped to special-orders rows.
    document.addEventListener('change', (e) => {
      const sel = e.target.closest('select[data-action="so-status-change"]');
      if (!sel) return;
      changeStatus(sel.dataset.id, sel.value, sel);
    });

    // Escape closes the modal.
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const modal = $r('so-modal');
      if (modal && !modal.hidden) closeModal();
    });

    // Debounced search.
    const searchEl = $r('so-search');
    if (searchEl) {
      searchEl.addEventListener('input', () => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => {
          currentSearch = searchEl.value.trim();
          loadOrders();
        }, 250);
      });
    }

    // Activate when the user switches to this tab (events dispatched from
    // staff-intakes.js' tab-switch logic).
    document.addEventListener('gasw:view-changed', (e) => {
      if (e.detail?.view === 'special-orders') activatePanel();
    });

    restoreActiveTab();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
