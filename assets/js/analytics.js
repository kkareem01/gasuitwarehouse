/* GA Suit Warehouse — GA4 + Google Ads tag, ad-click attribution capture, and
 * conversion events. Injected on every public page by components.js.
 *
 * Attribution capture always runs (even before the Google IDs below are
 * filled in), so gclid/UTM data flows into leads and bookings from day one.
 * gtag itself only boots once real IDs are pasted in — see the runbook at
 * docs/ads-tracking-runbook.md for the Google-side setup steps.
 */

(function () {
  // --- config: paste real IDs during Google setup (runbook step 5) ---------
  const GA4_ID = 'G-XXXXXXXXXX';                        // GA4 Measurement ID
  const ADS_ID = 'AW-XXXXXXXXXX';                       // Google Ads account tag
  const BOOKING_CONV_LABEL = 'AW-XXXXXXXXXX/XxXxXxXx';  // "Booked appointment" conversion send_to

  const ATTR_KEY = 'gasw-attr';
  const ATTR_TTL_DAYS = 90;             // matches Google's click-conversion window
  const CONV_GUARD_PREFIX = 'gasw-conv-';
  const CLICK_ID_PARAMS = ['gclid', 'gbraid', 'wbraid'];
  const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

  const configured = (id) => id && !id.includes('XXXX');

  // --- gtag bootstrap -------------------------------------------------------

  function gtag() {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(arguments);
  }

  function bootGtag() {
    if (!configured(GA4_ID) && !configured(ADS_ID)) return false;
    const src = `https://www.googletagmanager.com/gtag/js?id=${configured(GA4_ID) ? GA4_ID : ADS_ID}`;
    if (!document.querySelector(`script[src^="https://www.googletagmanager.com/gtag/js"]`)) {
      const s = document.createElement('script');
      s.async = true;
      s.src = src;
      document.head.appendChild(s);
    }
    gtag('js', new Date());
    if (configured(GA4_ID)) gtag('config', GA4_ID);
    if (configured(ADS_ID)) gtag('config', ADS_ID);
    return true;
  }

  const gtagActive = bootGtag();

  // --- attribution capture (runs regardless of gtag config) ----------------

  function readStoredAttribution() {
    try {
      const raw = localStorage.getItem(ATTR_KEY);
      if (!raw) return null;
      const attr = JSON.parse(raw);
      if (!attr || typeof attr !== 'object' || !attr.capturedAt) return null;
      const ageMs = Date.now() - Date.parse(attr.capturedAt);
      if (!Number.isFinite(ageMs) || ageMs > ATTR_TTL_DAYS * 86400000) return null;
      return attr;
    } catch (_) {
      return null;
    }
  }

  function captureAttribution() {
    let params;
    try {
      params = new URLSearchParams(window.location.search);
    } catch (_) {
      return;
    }
    const clickIds = {};
    for (const key of CLICK_ID_PARAMS) {
      const v = (params.get(key) || '').trim();
      if (v) clickIds[key] = v.slice(0, 200);
    }
    const utm = {};
    for (const key of UTM_PARAMS) {
      const v = (params.get(key) || '').trim();
      if (v) utm[key.replace('utm_', '')] = v.slice(0, 200);
    }
    // Only a fresh ad click / tagged visit overwrites the stored record —
    // last-click attribution, matching how Google Ads credits conversions.
    if (Object.keys(clickIds).length === 0 && Object.keys(utm).length === 0) return;
    const attr = {
      gclid: clickIds.gclid || null,
      gbraid: clickIds.gbraid || null,
      wbraid: clickIds.wbraid || null,
      utm: Object.keys(utm).length ? utm : null,
      landingPage: (window.location.pathname + window.location.search).slice(0, 500),
      referrer: (document.referrer || '').slice(0, 500),
      capturedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(ATTR_KEY, JSON.stringify(attr));
    } catch (_) {
      /* storage full / blocked — attribution is best-effort */
    }
  }

  captureAttribution();

  /* Returns the stored attribution record (or null) for lead/booking POSTs. */
  function getAttribution() {
    return readStoredAttribution();
  }

  /* Fire a GA4 event; no-op until GA4_ID is configured. */
  function track(eventName, params) {
    if (!gtagActive) return;
    gtag('event', eventName, params || {});
  }

  // --- conversion events ----------------------------------------------------

  function hasConversionGuard(bookingId) {
    try {
      return localStorage.getItem(CONV_GUARD_PREFIX + bookingId) === '1';
    } catch (_) {
      return false;
    }
  }

  function setConversionGuard(bookingId) {
    try {
      localStorage.setItem(CONV_GUARD_PREFIX + bookingId, '1');
    } catch (_) { /* best-effort */ }
  }

  /* Fires the "Booked appointment" Google Ads conversion + a GA4 event.
     transport beacon so the hit survives the immediate redirect to
     /booking-confirmed.html; transaction_id lets Google dedup the fallback. */
  function fireBookingConversion(bookingId, audience) {
    if (!bookingId || hasConversionGuard(bookingId)) return;
    setConversionGuard(bookingId);
    if (!gtagActive) return;
    if (configured(BOOKING_CONV_LABEL)) {
      gtag('event', 'conversion', {
        send_to: BOOKING_CONV_LABEL,
        transaction_id: bookingId,
        transport_type: 'beacon',
      });
    }
    if (configured(GA4_ID)) {
      gtag('event', 'book_appointment', {
        transaction_id: bookingId,
        audience: audience || '(unknown)',
        transport_type: 'beacon',
      });
    }
  }

  window.addEventListener('booking:confirmed', (e) => {
    const booking = e.detail && e.detail.booking;
    if (booking && booking.id) fireBookingConversion(booking.id, booking.audience);
  });

  window.addEventListener('lead:submitted', (e) => {
    track('generate_lead', {
      lead_id: (e.detail && e.detail.leadId) || undefined,
      transport_type: 'beacon',
    });
  });

  // Confirmation-page fallback: if the beacon on the booking page was lost
  // (script blocked, race), fire from /booking-confirmed.html?id=… once.
  // Google Ads also dedups server-side on transaction_id.
  if (window.location.pathname.startsWith('/booking-confirmed')) {
    let id = null;
    try {
      id = new URLSearchParams(window.location.search).get('id');
    } catch (_) { /* ignore */ }
    if (id) fireBookingConversion(id, null);
  }

  // Delegated phone-click tracking — covers all tel: links, including the
  // nav/footer ones injected by components.js after this script runs.
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href^="tel:"]');
    if (!a) return;
    track('phone_call', {
      link_text: (a.textContent || '').trim().slice(0, 80),
      page_path: window.location.pathname,
      transport_type: 'beacon',
    });
  });

  window.GASWAnalytics = { getAttribution, track };
})();
