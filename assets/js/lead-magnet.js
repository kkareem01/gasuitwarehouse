/* GA Suit Warehouse — lead magnet landing page.
   Fetches the active offer, hydrates hero copy + scarcity + countdown, and
   wires the opt-in form to /api/lead-magnet/opt-in. On a successful submit
   the form is replaced by an inline success card (the code goes out by email
   in the same request). Sets `gasw-lm-opted-in=1` in localStorage so the
   homepage popup stops appearing for this visitor. */

(function () {
  const STARTED_AT = Date.now();
  const OPTED_IN_KEY = 'gasw-lm-opted-in';
  let countdownTimer = null;

  function $(sel) { return document.querySelector(sel); }
  function $region(name) { return document.querySelector(`[data-region="${name}"]`); }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function formatDollars(cents) {
    const dollars = Math.round(cents / 100);
    return `$${dollars}`;
  }

  function fmtCountdown(ms) {
    if (ms <= 0) return 'ended';
    const totalMin = Math.floor(ms / 60000);
    const days = Math.floor(totalMin / 1440);
    const hours = Math.floor((totalMin % 1440) / 60);
    const minutes = totalMin % 60;
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  function endOfDayMs(weekEnd) {
    const [y, m, d] = weekEnd.split('-').map(Number);
    return Date.UTC(y, m - 1, d, 23, 59, 59);
  }

  function startCountdown(weekEnd) {
    const target = endOfDayMs(weekEnd);
    const el = $region('lm-countdown');
    function tick() {
      if (el) el.textContent = fmtCountdown(target - Date.now());
    }
    tick();
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(tick, 60000);
  }

  function renderOffer(offer) {
    const itemName = offer.name.replace(/^Free\s+/i, '');
    const head = $region('lm-headline');
    if (head) head.textContent = `Get a free ${itemName}, on the house`;

    const sub = $region('lm-sub');
    if (sub) sub.textContent = `${offer.itemDescription}`;

    const remaining = $region('lm-remaining');
    if (remaining) remaining.textContent = String(offer.remaining);

    const value = $region('lm-value');
    if (value) value.textContent = `Retail value ${formatDollars(offer.retailValueCents)} · yours free`;

    const ld = document.getElementById('lm-jsonld');
    if (ld) {
      ld.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Offer',
        name: offer.name,
        description: offer.itemDescription,
        priceCurrency: 'USD',
        price: '0',
        availability: 'https://schema.org/InStock',
        itemOffered: { '@type': 'Product', name: offer.name },
      });
    }
  }

  // If the API fails, keep the static HTML copy (which already promotes a free
  // tie) and just hide the live counters. The CTA still works — submitting the
  // form lets the server bootstrap the default offer on the back-end.
  function renderNoOffer() {
    const stats = document.querySelector('.lm-stats');
    if (stats) stats.style.display = 'none';
  }

  async function loadOffer() {
    try {
      const res = await fetch('/api/lead-magnet/active-offer');
      if (!res.ok) {
        renderNoOffer();
        return null;
      }
      const j = await res.json();
      if (!j.ok || !j.offer) {
        renderNoOffer();
        return null;
      }
      renderOffer(j.offer);
      return j.offer;
    } catch (_) {
      renderNoOffer();
      return null;
    }
  }

  function formatPhone(value) {
    const digits = (value || '').replace(/\D/g, '').slice(0, 10);
    if (digits.length > 6) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    if (digits.length > 3) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    if (digits.length > 0) return `(${digits}`;
    return '';
  }

  function showError(msg) {
    const el = $region('lm-error');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
  }

  function clearError() {
    const el = $region('lm-error');
    if (!el) return;
    el.hidden = true;
    el.textContent = '';
  }

  function errorMessage(code, payload) {
    if (code === 'RATE_LIMIT') return 'Too many submissions. Try again in a few minutes.';
    if (code === 'ALREADY_CLAIMED_ITEM') {
      const item = payload?.itemName ? ` "${payload.itemName}"` : ' this item';
      return `You've already claimed${item}. Stay tuned — we rotate to a new gift each week.`;
    }
    if (code === 'DUPLICATE_RECENT') return 'You already claimed this week. Check your email for your code.';
    if (code === 'HONEYPOT' || code === 'TOO_FAST') return 'Submission rejected. Please try again.';
    return 'Something went wrong. Please try again.';
  }

  function setupRevealCta() {
    const cta = document.querySelector('[data-action="lm-reveal"]');
    const section = $region('lm-form-section');
    if (!cta || !section) return;
    cta.addEventListener('click', () => {
      section.hidden = false;
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => $('#lm-first')?.focus(), 350);
    });
  }

  function setupPhoneMask() {
    const input = document.querySelector('[data-action="lm-phone-input"]');
    if (!input) return;
    input.addEventListener('input', () => {
      input.value = formatPhone(input.value);
    });
  }

  function showSuccessState(offerName) {
    try { localStorage.setItem(OPTED_IN_KEY, '1'); } catch (_) {}
    const formSection = $region('lm-form-section');
    if (formSection) formSection.hidden = true;
    const itemSlot = $region('lm-success-item');
    if (itemSlot && offerName) itemSlot.textContent = offerName;
    const success = $region('lm-success-section');
    if (success) {
      success.hidden = false;
      success.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function setupForm() {
    const form = $region('lm-form');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearError();
      const submit = $region('lm-submit');
      if (submit) { submit.disabled = true; submit.textContent = 'Sending…'; }

      const data = new FormData(form);
      const payload = {
        firstName: String(data.get('firstName') || '').trim(),
        email: String(data.get('email') || '').trim(),
        phone: String(data.get('phone') || '').trim(),
        consent: data.get('consent') === 'on',
        hp: String(data.get('hp') || ''),
        startedAt: STARTED_AT,
      };

      function finish(msg) {
        showError(msg);
        if (submit) { submit.disabled = false; submit.textContent = 'Get My Free Tie ›'; }
      }

      if (!payload.firstName) return finish('Please enter your first name.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) return finish('Please enter a valid email.');
      if (payload.phone.replace(/\D/g, '').length < 10) return finish('Please enter a valid phone.');
      if (!payload.consent) return finish('Please check the consent box.');

      try {
        const res = await fetch('/api/lead-magnet/opt-in', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok || !j.ok) {
          return finish(errorMessage(j.error, j));
        }
        if (j.exhausted) {
          return finish('Sorry, the offer is unavailable right now. Please call (470) 595-7775.');
        }
        showSuccessState(j.offer?.name);
      } catch (_) {
        finish('Network error. Please try again.');
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadOffer();
    setupRevealCta();
    setupPhoneMask();
    setupForm();
  });
})();
