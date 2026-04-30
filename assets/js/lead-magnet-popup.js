/* GA Suit Warehouse — first-visit lead magnet popup.
   Surfaces the rotating free-gift offer to visitors who haven't opted in yet.
   Auto-injected by components.js on pages where the styling session is the
   primary CTA (homepage + verticals).

   Suppression model: a single localStorage flag — `gasw-lm-opted-in` — set
   when the visitor successfully submits the lead-magnet form. Until that
   flag is set, the popup shows on every page load (after a short delay)
   unless the active-offer endpoint reports nothing live. */

(function () {
  const OPTED_IN_KEY = 'gasw-lm-opted-in';
  const SHOW_DELAY_MS = 2500;

  function shouldSuppress() {
    try {
      if (localStorage.getItem(OPTED_IN_KEY)) return true;
    } catch (_) { /* storage blocked — show anyway */ }
    return false;
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
        <h2 class="lm-popup__title" id="lm-popup-title">A free gift, on the house.</h2>
        <p class="lm-popup__sub">Claim a free <strong>${escapeHtml(itemName)}</strong> this week. No purchase necessary.</p>
        <div class="lm-popup__chip">${escapeHtml(remainText)}</div>
        <div class="lm-popup__actions">
          <a href="/lead-magnet/" class="btn btn-primary lm-popup__cta">Get My Free Gift</a>
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

    requestAnimationFrame(() => root.classList.add('is-open'));

    function close() {
      root.classList.remove('is-open');
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
