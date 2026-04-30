/* GA Suit Warehouse — homepage bottom-of-page free-gift promo section.
   Hydrates the `data-lm-promo` section with this week's active offer name +
   remaining count + countdown. Falls back gracefully (section stays visible
   with generic copy) if the API fails. Hides the section entirely if no
   offer is active. */

(function () {
  function $r(name) { return document.querySelector(`[data-region="${name}"]`); }

  function escape(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  }

  function endOfDayMs(weekEnd) {
    const [y, m, d] = weekEnd.split('-').map(Number);
    return Date.UTC(y, m - 1, d, 23, 59, 59);
  }

  function fmtCountdown(ms) {
    if (ms <= 0) return 'ending soon';
    const totalMin = Math.floor(ms / 60000);
    const days = Math.floor(totalMin / 1440);
    const hours = Math.floor((totalMin % 1440) / 60);
    const minutes = totalMin % 60;
    if (days > 0) return `${days}d ${hours}h left`;
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
  }

  function hydrate(offer) {
    const itemName = offer.name.replace(/^Free\s+/i, '');
    const headline = $r('lm-final-headline');
    if (headline) headline.textContent = `Claim a free ${itemName} this week.`;

    const lead = $r('lm-final-lead');
    if (lead) lead.textContent = `${offer.itemDescription || `Yours to keep, just for stopping by.`} First 50 customers, no purchase necessary.`;

    const stats = $r('lm-final-stats');
    if (stats) stats.hidden = false;

    const remaining = $r('lm-final-remaining');
    if (remaining) {
      const r = offer.remaining;
      remaining.textContent = typeof r === 'number' ? `${r} spots left` : `${r} spots left`;
    }

    const countdown = $r('lm-final-countdown');
    if (countdown) {
      const target = endOfDayMs(offer.weekEnd);
      const tick = () => { countdown.textContent = fmtCountdown(target - Date.now()); };
      tick();
      setInterval(tick, 60000);
    }
  }

  function hideSection() {
    const section = $r('lm-final-section');
    if (section) section.style.display = 'none';
  }

  async function init() {
    const section = document.querySelector('[data-lm-promo]');
    if (!section) return;
    try {
      const res = await fetch('/api/lead-magnet/active-offer');
      if (res.status === 404) return hideSection();
      if (!res.ok) return; // keep static fallback copy
      const j = await res.json();
      if (!j.ok || !j.offer) return hideSection();
      hydrate(j.offer);
    } catch (_) { /* keep static fallback */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
