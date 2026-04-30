/* GA Suit Warehouse — first-visit lead magnet popup.
   Surfaces the rotating free-gift offer to visitors who haven't engaged with
   the lead-magnet funnel yet. Auto-injected by components.js on pages where
   the styling session is the primary CTA (homepage + verticals).

   Dismissal model:
   - localStorage 'gasw-lm-popup-dismissed-at' suppresses re-show for 48 hours
   - sessionStorage 'gasw-lm-popup-session-shown' prevents re-show within the
     same browser tab session (so it doesn't pop on every navigation) */

(function () {
  const LS_DISMISS_KEY  = 'gasw-lm-popup-dismissed-at';
  const SS_SHOWN_KEY    = 'gasw-lm-popup-session-shown';
  const DISMISS_WINDOW_MS = 48 * 60 * 60 * 1000;
  const SHOW_DELAY_MS = 5000;

  function shouldSuppress() {
    try {
      if (sessionStorage.getItem(SS_SHOWN_KEY)) return true;
      const dismissed = parseInt(localStorage.getItem(LS_DISMISS_KEY) || '0', 10);
      if (dismissed && Date.now() - dismissed < DISMISS_WINDOW_MS) return true;
    } catch (_) { /* storage blocked — show anyway */ }
    return false;
  }

  function markDismissed() {
    try {
      localStorage.setItem(LS_DISMISS_KEY, String(Date.now()));
      sessionStorage.setItem(SS_SHOWN_KEY, '1');
    } catch (_) {}
  }

  function markShown() {
    try { sessionStorage.setItem(SS_SHOWN_KEY, '1'); } catch (_) {}
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function buildPopupHtml(offer) {
    const itemName = offer.name.replace(/^Free\s+/i, '');
    const remaining = offer.remaining;
    const remainText = typeof remaining === 'number' ? `${remaining} spots left` : `${remaining} spots left`;
    return `
      <div class="lm-popup__overlay" data-lm-popup-close></div>
      <div class="lm-popup__card" role="dialog" aria-modal="true" aria-labelledby="lm-popup-title">
        <button class="lm-popup__close" type="button" aria-label="Close" data-lm-popup-close>&times;</button>
        <div class="lm-popup__eyebrow">This week only · first 50 customers</div>
        <h2 class="lm-popup__title" id="lm-popup-title">Not ready to book a styling session yet?</h2>
        <p class="lm-popup__sub">Claim a free <strong>${escapeHtml(itemName)}</strong> this week. No purchase necessary.</p>
        <div class="lm-popup__chip">${escapeHtml(remainText)}</div>
        <div class="lm-popup__actions">
          <a href="/lead-magnet/" class="btn btn-primary lm-popup__cta">See If I Qualify</a>
          <button type="button" class="lm-popup__dismiss" data-lm-popup-close>No thanks, I'll just browse</button>
        </div>
      </div>
    `;
  }

  function showPopup(offer) {
    if (document.getElementById('lm-popup-root')) return;
    const root = document.createElement('div');
    root.id = 'lm-popup-root';
    root.className = 'lm-popup';
    root.innerHTML = buildPopupHtml(offer);
    document.body.appendChild(root);

    // Slide-up + fade-in on next paint so the transition runs
    requestAnimationFrame(() => root.classList.add('is-open'));

    function close() {
      root.classList.remove('is-open');
      markDismissed();
      setTimeout(() => root.remove(), 240);
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) {
      if (e.key === 'Escape') close();
    }

    root.addEventListener('click', (e) => {
      if (e.target.closest('[data-lm-popup-close]')) close();
    });
    document.addEventListener('keydown', onKey);

    markShown();
  }

  async function init() {
    if (shouldSuppress()) return;
    setTimeout(async () => {
      try {
        const res = await fetch('/api/lead-magnet/active-offer');
        if (res.status === 404) return; // no active offer = no popup
        if (!res.ok) return;
        const j = await res.json();
        if (!j.ok || !j.offer) return;
        showPopup(j.offer);
      } catch (_) { /* network error — silently skip */ }
    }, SHOW_DELAY_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
