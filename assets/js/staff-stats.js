/* Funnel stats dashboard. Reuses GASWStaff helpers from staff.js. */

(function () {
  function $r(name) { return document.querySelector(`[data-region="${name}"]`); }

  function fmtDate(ymd) {
    if (!ymd) return '—';
    const [y, m, d] = ymd.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', timeZone: 'UTC',
    });
  }

  function pct(v) { return v == null ? '—' : `${v}%`; }
  function n(v) { return Number(v || 0).toLocaleString(); }

  function renderWeeks(weeks) {
    const container = $r('weeks');
    if (!container) return;
    if (!weeks.length) {
      container.innerHTML = `<div class="week-card"><p style="color:#9CA3AF;margin:0;">No offers seeded yet. Run <code>node scripts/seed-offers.mjs</code> first.</p></div>`;
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    container.innerHTML = weeks.map((w) => {
      const isActive = w.weekStart <= today && today <= w.weekEnd;
      return `
        <div class="week-card${isActive ? ' active' : ''}">
          <div class="week-header">
            <div>
              <div class="week-name">${escape(w.offerName)}${isActive ? ' · <span style="color:#C9A961;">live</span>' : ''}</div>
              <div class="week-dates">${fmtDate(w.weekStart)} → ${fmtDate(w.weekEnd)}</div>
            </div>
            <div class="week-dates">cap ${n(w.capUsed)} / ${n(w.cap)}</div>
          </div>
          <div class="stat-grid">
            <div class="stat"><div class="label">Opt-ins</div><div class="value">${n(w.leads.total)}</div></div>
            <div class="stat"><div class="label">Qualified</div><div class="value">${n(w.leads.qualified)}</div></div>
            <div class="stat"><div class="label">Disqualified</div><div class="value">${n(w.leads.disqualified)}</div></div>
            <div class="stat"><div class="label">Booked (issued)</div><div class="value">${n(w.codes.issued + w.codes.redeemed + w.codes.noshow)}</div></div>
            <div class="stat highlight"><div class="label">Redeemed</div><div class="value">${n(w.codes.redeemed)}</div></div>
            <div class="stat"><div class="label">No-show</div><div class="value">${n(w.codes.noshow)}</div></div>
            <div class="stat"><div class="label">Expired</div><div class="value">${n(w.codes.expired)}</div></div>
          </div>
          <div class="conv-row">
            <div><div class="k">Qualified → Booked</div><div class="v">${pct(w.conversion.qualifiedToBooked)}</div></div>
            <div><div class="k">Booked → Showed Up</div><div class="v">${pct(w.conversion.bookedToRedeemed)}</div></div>
            <div><div class="k">Qualified → Redeemed</div><div class="v">${pct(w.conversion.qualifiedToRedeemed)}</div></div>
          </div>
        </div>
      `;
    }).join('');
  }

  function escape(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  }

  function showAlert(msg) {
    const el = $r('alert');
    if (el) { el.hidden = false; el.textContent = msg; }
  }
  function hideAlert() {
    const el = $r('alert');
    if (el) el.hidden = true;
  }

  async function loadStats() {
    hideAlert();
    try {
      const res = await window.GASWStaff.adminFetch('/api/admin/funnel-stats?weeks=12');
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) return showAlert(j.error || 'Could not load stats.');
      renderWeeks(j.weeks);
    } catch (_) {
      showAlert('Network error. Please try again.');
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadStats();
  });
})();
