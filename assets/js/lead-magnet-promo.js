/* GA Suit Warehouse — homepage bottom-of-page free-tie offer card.
   Hydrates the [data-lm-promo] offer card with the active offer name +
   remaining count and a dynamic "Get My Free [item]" CTA. Leaves the
   static fallback copy in place if the API errs — the page never tells
   visitors the offer is unavailable. */

(function () {
  function $r(name) { return document.querySelector(`[data-region="${name}"]`); }

  function hydrate(offer) {
    const headline = $r('lm-final-headline');
    if (headline) headline.textContent = offer.name;

    const lead = $r('lm-final-lead');
    if (lead) {
      lead.textContent = offer.itemDescription
        ? offer.itemDescription
        : 'Yours to keep, just for stopping by.';
    }

    const remaining = $r('lm-final-remaining');
    if (remaining && typeof offer.remaining === 'number' && offer.remaining < 50) {
      const stats = $r('lm-final-stats');
      if (stats) stats.hidden = false;
      remaining.textContent = `Only ${offer.remaining} spots left`;
    }

    const cta = $r('lm-final-cta');
    if (cta) cta.textContent = `Get My ${shortenOfferName(offer.name)}`;
  }

  // Trim long offer names down to a CTA-friendly length by stopping at the
  // first conjunction or delimiter. "Free Silk Tie + Pocket Square Set" →
  // "Free Silk Tie". "Free Silk Tie" → "Free Silk Tie".
  function shortenOfferName(name) {
    if (!name) return 'Free Tie';
    return String(name).split(/\s+[+·&]\s+/)[0].trim();
  }

  async function init() {
    const section = document.querySelector('[data-lm-promo]');
    if (!section) return;
    try {
      const res = await fetch('/api/lead-magnet/active-offer');
      if (!res.ok) return; // keep static fallback copy — never hide the section
      const j = await res.json();
      if (!j.ok || !j.offer) return;
      hydrate(j.offer);
    } catch (_) { /* keep static fallback */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
