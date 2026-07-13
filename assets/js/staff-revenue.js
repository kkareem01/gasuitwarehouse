/* Revenue & CAC section on /staff/stats.html.
 *
 * Renders one row per month from /api/admin/revenue-stats and lets the owner
 * type the month's Google Ads spend inline (saved via ad-spend-set). CAC and
 * AOV come back computed from the server so the math lives in one place
 * (lib/sales-store.mjs getRevenueStats).
 */

(function () {
  function $r(name) { return document.querySelector(`[data-region="${name}"]`); }
  function esc(s)   { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  let currentMonths = [];

  function money(cents) {
    if (cents == null) return null;
    const dollars = cents / 100;
    return `$${dollars.toLocaleString('en-US', {
      minimumFractionDigits: Number.isInteger(dollars) ? 0 : 2,
      maximumFractionDigits: 2,
    })}`;
  }

  function monthLabel(ym) {
    const [y, m] = ym.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }

  // LTV here = average revenue per acquired customer (AOV, single-visit
  // basis), so the ratio reduces to revenue ÷ spend for the month.
  function ltvToCac(m) {
    if (m.aovCents == null || m.cacCents == null || m.cacCents === 0) return null;
    return `${(m.aovCents / m.cacCents).toFixed(1)}:1`;
  }

  function showAlert(msg) {
    const el = $r('alert');
    if (el) { el.hidden = false; el.textContent = msg; }
  }

  function renderRows(months) {
    const body = $r('rev-rows');
    if (!body) return;
    if (!months.length) {
      body.innerHTML = '<tr><td colspan="10" style="color:#9CA3AF;">No data yet — bookings and recorded sales will appear here by month.</td></tr>';
      return;
    }
    const dash = '<span class="rev-muted">—</span>';
    body.innerHTML = months.map((m) => `
      <tr>
        <td>${esc(monthLabel(m.month))}</td>
        <td>
          <span class="spend-cell">
            $<input type="number" min="0" max="50000" step="0.01" inputmode="decimal"
                    data-spend-month="${esc(m.month)}"
                    value="${m.spendCents == null ? '' : (m.spendCents / 100)}" placeholder="0" />
            <button type="button" data-spend-save="${esc(m.month)}">Save</button>
          </span>
        </td>
        <td>${m.bookingsCreated}</td>
        <td>${m.gclidBookings}</td>
        <td>${m.completed}</td>
        <td>${m.customers}</td>
        <td class="rev-money">${money(m.revenueCents) ?? dash}</td>
        <td>${money(m.aovCents) ?? dash}</td>
        <td class="rev-cac">${money(m.cacCents) ?? dash}</td>
        <td class="rev-cac">${ltvToCac(m) ?? dash}</td>
      </tr>
    `).join('');
  }

  async function loadRevenue() {
    try {
      const res = await window.GASWStaff.adminFetch('/api/admin/revenue-stats?months=12');
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) return showAlert(j.error || 'Could not load revenue stats.');
      currentMonths = ensureCurrentMonth(j.months || []);
      renderRows(currentMonths);
    } catch (_) {
      showAlert('Network error loading revenue stats.');
    }
  }

  /* Always show the current month even before it has any data, so the owner
     can enter this month's spend right away. */
  function ensureCurrentMonth(months) {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (months.some((m) => m.month === thisMonth)) return months;
    return [{
      month: thisMonth, spendCents: null, bookingsCreated: 0, gclidBookings: 0,
      completed: 0, customers: 0, revenueCents: 0, aovCents: null, cacCents: null,
    }, ...months];
  }

  async function saveSpend(month, btn) {
    const input = document.querySelector(`input[data-spend-month="${month}"]`);
    if (!input) return;
    const raw = input.value.trim();
    const dollars = Number(raw);
    if (raw === '' || !Number.isFinite(dollars) || dollars < 0 || dollars > 50000) {
      return showAlert('Ad spend must be a dollar amount between 0 and 50,000.');
    }
    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = '…';
    try {
      const res = await window.GASWStaff.adminFetch('/api/admin/ad-spend-set', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ month, amountCents: Math.round(dollars * 100) }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) return showAlert(j.error || 'Could not save spend.');
      // Re-fetch so CAC recomputes server-side.
      await loadRevenue();
    } catch (_) {
      showAlert('Network error saving spend.');
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-spend-save]');
    if (btn) saveSpend(btn.dataset.spendSave, btn);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const input = e.target.closest('input[data-spend-month]');
    if (!input) return;
    e.preventDefault();
    const btn = document.querySelector(`button[data-spend-save="${input.dataset.spendMonth}"]`);
    if (btn) saveSpend(input.dataset.spendMonth, btn);
  });

  document.addEventListener('DOMContentLoaded', loadRevenue);
})();
