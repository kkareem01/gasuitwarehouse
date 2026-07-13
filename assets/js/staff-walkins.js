/* Walk-in Sales tab on the staff dashboard.
 * Logs purchases from customers who walked in without booking, so ad-driven
 * foot traffic shows up in the revenue & CAC numbers on /staff/stats.html.
 *
 * The "+ Log walk-in sale" button also lives on the Appointments panel
 * (data-action="walkin-new" in both places — one delegated handler covers
 * both). Modeled on staff-special-orders.js.
 */

(function () {
  function $r(name) { return document.querySelector(`[data-region="${name}"]`); }
  function esc(s)   { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  let currentMonth = 'all';
  let currentSales = [];
  let currentEditId = null;
  let panelInitialized = false;
  let panelActive = false;

  // --- formatting --------------------------------------------------------

  function fmtMoney(cents) {
    const dollars = cents / 100;
    return `$${Number.isInteger(dollars) ? dollars.toLocaleString('en-US') : dollars.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
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

  function monthLabel(ym) {
    const [y, m] = ym.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }

  // --- alerts (shared #alert region) --------------------------------------

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

  // --- month filter pills (This month / Last month / All) -----------------

  function renderMonthPills() {
    const wrap = $r('walkin-month-pills');
    if (!wrap || wrap.childElementCount > 0) return;
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    wrap.innerHTML = `
      <button class="pill-btn is-active" data-walkin-month="${thisMonth}">${esc(monthLabel(thisMonth))}</button>
      <button class="pill-btn" data-walkin-month="${lastMonth}">${esc(monthLabel(lastMonth))}</button>
      <button class="pill-btn" data-walkin-month="all">All</button>
    `;
    currentMonth = thisMonth;
  }

  // --- table ----------------------------------------------------------------

  function renderTable(sales) {
    const body = $r('walkin-rows');
    const empty = $r('walkin-empty');
    const count = $r('walkin-count');
    if (count) {
      const total = sales.reduce((sum, s) => sum + s.amountCents, 0);
      count.textContent = `${sales.length} ${sales.length === 1 ? 'sale' : 'sales'} · ${fmtMoney(total)}`;
    }
    if (!sales.length) {
      if (body) body.innerHTML = '';
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    if (body) {
      body.innerHTML = sales.map((s) => `
        <tr>
          <td><a href="#" class="walkin-amount" data-action="walkin-edit" data-id="${esc(s.id)}">${esc(fmtMoney(s.amountCents))}</a></td>
          <td>${s.note ? esc(s.note) : '<span style="color:#4B5563;">—</span>'}</td>
          <td>${esc(fmtDate(s.saleDate))}</td>
          <td><span style="color:#9CA3AF;font-size:13px;">${esc(fmtIso(s.createdAt))}</span></td>
        </tr>
      `).join('');
    }
  }

  // --- API ---------------------------------------------------------------------

  async function loadSales({ quiet = false } = {}) {
    if (!quiet) hideAlert();
    const params = new URLSearchParams();
    if (currentMonth && currentMonth !== 'all') params.set('month', currentMonth);
    try {
      const res = await window.GASWStaff.adminFetch(`/api/admin/walkins?${params.toString()}`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        if (!quiet) showAlert('error', j.error || 'Could not load walk-in sales.');
        return;
      }
      currentSales = j.sales || [];
      renderTable(currentSales);
    } catch (_) {
      if (!quiet) showAlert('error', 'Network error. Try again.');
    }
  }

  // --- modal ----------------------------------------------------------------------

  function setModalError(msg) {
    const box = $r('walkin-modal-error');
    if (!box) return;
    if (!msg) { box.hidden = true; box.textContent = ''; return; }
    box.textContent = msg;
    box.hidden = false;
  }

  function openModal(id) {
    const modal = $r('walkin-modal');
    const form = $r('walkin-modal-form');
    if (!modal || !form) return;
    currentEditId = id || null;
    const sale = id ? currentSales.find((s) => s.id === id) : null;

    form.elements.id.value = id || '';
    form.elements.amount.value = sale ? (sale.amountCents / 100).toFixed(2).replace(/\.00$/, '') : '';
    form.elements.note.value = sale ? sale.note : '';
    form.elements.saleDate.value = sale ? sale.saleDate : new Date().toISOString().slice(0, 10);

    const title = $r('walkin-modal-title');
    if (title) title.textContent = id ? `Edit walk-in sale · ${id}` : 'Log walk-in sale';
    const delBtn = $r('walkin-delete-btn');
    if (delBtn) delBtn.hidden = !id;

    setModalError('');
    modal.hidden = false;
    requestAnimationFrame(() => {
      modal.classList.add('is-open');
      form.elements.amount.focus();
    });
  }

  function closeModal() {
    const modal = $r('walkin-modal');
    if (!modal) return;
    modal.classList.remove('is-open');
    setModalError('');
    setTimeout(() => { modal.hidden = true; }, 220);
  }

  async function saveModal() {
    const form = $r('walkin-modal-form');
    if (!form) return;
    const raw = form.elements.amount.value.trim();
    const dollars = Number(raw);
    if (raw === '' || !Number.isFinite(dollars) || dollars <= 0 || dollars > 50000) {
      return setModalError('Enter a dollar amount between 0.01 and 50,000.');
    }
    const payload = {
      amountCents: Math.round(dollars * 100),
      note: form.elements.note.value.trim(),
      saleDate: form.elements.saleDate.value || undefined,
    };
    const isEdit = Boolean(currentEditId);
    const url = isEdit ? '/api/admin/walkin-edit' : '/api/admin/walkin-create';
    if (isEdit) payload.id = currentEditId;

    const saveBtn = $r('walkin-save-btn');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }
    try {
      const res = await window.GASWStaff.adminFetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        return setModalError(j.error || 'Could not save. Try again.');
      }
      closeModal();
      loadSales({ quiet: true });
      showAlert('success', isEdit ? 'Walk-in sale updated.' : `Walk-in sale logged: ${fmtMoney(payload.amountCents)}`);
      setTimeout(hideAlert, 2500);
    } catch (_) {
      setModalError('Network error. Try again.');
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save'; }
    }
  }

  async function deleteFromModal() {
    if (!currentEditId) return;
    if (!confirm('Delete this walk-in sale? This cannot be undone.')) return;
    try {
      const res = await window.GASWStaff.adminFetch('/api/admin/walkin-delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: currentEditId }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        return setModalError(j.error || 'Could not delete. Try again.');
      }
      closeModal();
      loadSales({ quiet: true });
      showAlert('success', 'Walk-in sale deleted.');
      setTimeout(hideAlert, 2500);
    } catch (_) {
      setModalError('Network error. Try again.');
    }
  }

  // --- tab activation ------------------------------------------------------------------

  function activatePanel() {
    panelActive = true;
    renderMonthPills();
    if (!panelInitialized) {
      panelInitialized = true;
      loadSales();
    } else {
      loadSales({ quiet: true });
    }
  }

  // --- wire up ---------------------------------------------------------------------------

  function init() {
    document.addEventListener('click', (e) => {
      const monthPill = e.target.closest('.pill-btn[data-walkin-month]');
      if (monthPill) {
        currentMonth = monthPill.dataset.walkinMonth;
        document.querySelectorAll('[data-region="walkin-month-pills"] .pill-btn').forEach((b) => {
          b.classList.toggle('is-active', b === monthPill);
        });
        loadSales();
        return;
      }

      const quick = e.target.closest('[data-walkin-quick]');
      if (quick) {
        e.preventDefault();
        const form = $r('walkin-modal-form');
        if (form) { form.elements.amount.value = quick.dataset.walkinQuick; form.elements.amount.focus(); }
        return;
      }

      const actionEl = e.target.closest('[data-action]');
      const action = actionEl?.dataset.action;
      if (action === 'walkin-new') { openModal(null); return; }
      if (action === 'walkin-refresh') { loadSales(); return; }
      if (action === 'walkin-edit') { e.preventDefault(); openModal(actionEl.dataset.id); return; }
      if (action === 'walkin-close-modal') { closeModal(); return; }
      if (action === 'walkin-save') { saveModal(); return; }
      if (action === 'walkin-delete') { deleteFromModal(); return; }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const modal = $r('walkin-modal');
      if (modal && !modal.hidden) closeModal();
    });

    document.addEventListener('gasw:view-changed', (e) => {
      const view = e.detail?.view;
      if (view === 'walkins') activatePanel();
      else panelActive = false;
    });

    // Re-open this tab if it was active on the last visit (mirrors the
    // restoreActiveTab pattern in the other dashboard modules).
    let active;
    try { active = localStorage.getItem('gasw.staff.activeTab'); } catch (_) { active = null; }
    if (active === 'walkins') {
      const tab = document.querySelector('.view-tab[data-view="walkins"]');
      if (tab) tab.click();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
