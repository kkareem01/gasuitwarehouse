/* GA Suit Warehouse — homepage bottom-of-page free-gift offer card.
   Hydrates the [data-lm-promo] offer card with this week's active offer
   name, remaining count, countdown, and a dynamic "Get My Free [item]" CTA.
   Falls back to static copy if the API errs; hides the section if no
   offer is active (404). */

(function () {
  function $r(name) { return document.querySelector(`[data-region="${name}"]`); }

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
    const headline = $r('lm-final-headline');
    if (headline) headline.textContent = offer.name;

    const lead = $r('lm-final-lead');
    if (lead) {
      lead.textContent = offer.itemDescription
        ? offer.itemDescription
        : 'Yours to keep, just for stopping by.';
    }

    const stats = $r('lm-final-stats');
    if (stats) stats.hidden = false;

    const remaining = $r('lm-final-remaining');
    if (remaining && typeof offer.remaining === 'number') {
      remaining.textContent = `${offer.remaining} spots left`;
    }

    const countdown = $r('lm-final-countdown');
    if (countdown) {
      const target = endOfDayMs(offer.weekEnd);
      const tick = () => { countdown.textContent = fmtCountdown(target - Date.now()); };
      tick();
      setInterval(tick, 60000);
    }

    const cta = $r('lm-final-cta');
    if (cta) cta.textContent = `Get My ${shortenOfferName(offer.name)}`;
  }

  // Trim long offer names down to a CTA-friendly length by stopping at the
  // first conjunction or delimiter. "Free Silk Tie + Pocket Square Set" →
  // "Free Silk Tie". "Free Premium Tie" → "Free Premium Tie".
  function shortenOfferName(name) {
    if (!name) return 'Free Gift';
    return String(name).split(/\s+[+·&]\s+/)[0].trim();
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
