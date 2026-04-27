/* GA Suit Warehouse — confirmation page hydrator.
   Reads ?id= from URL, fetches booking from /api/bookings/:id, fills the page. */

(function () {
  const PREP_BY_AUDIENCE = {
    weddings: [
      'Wear or bring a fitted dress shirt so we can measure accurately.',
      'Bring inspiration photos, the wedding palette, and any fabric swatches.',
      'Bring shoes you plan to wear — heel height affects hem length.',
      'Allow 45–60 minutes for the full session.',
      'Out-of-town groomsmen? We have a remote-measurement guide ready.',
      'Need to reschedule? Just call (470) 595-7775.',
    ],
    general: [
      'Wear or bring a fitted dress shirt so we can measure accurately.',
      'Bring shoes you plan to wear with the suit.',
      'Bring photos of looks you like, if you have them.',
      'Allow 45–60 minutes for the full session.',
      'Need to reschedule? Just call (470) 595-7775.',
    ],
  };

  function $(sel) { return document.querySelector(sel); }
  function $all(sel) { return Array.from(document.querySelectorAll(sel)); }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function format12h(time) {
    const [h, m] = time.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${String(m).padStart(2, '0')} ${period}`;
  }

  function tzOffsetMinutes(tz, instant) {
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' });
    const parts = fmt.formatToParts(instant);
    const off = parts.find((p) => p.type === 'timeZoneName')?.value || 'GMT+00:00';
    const m = off.match(/GMT([+-])(\d{1,2}):?(\d{2})?/);
    if (!m) return 0;
    const sign = m[1] === '+' ? 1 : -1;
    return sign * (parseInt(m[2], 10) * 60 + parseInt(m[3] || '0', 10));
  }

  function convertWallClock(date, time, fromTz, toTz) {
    if (fromTz === toTz) return { date, time };
    const [y, m, d] = date.split('-').map(Number);
    const [hh, mm] = time.split(':').map(Number);
    const asIfUtc = new Date(Date.UTC(y, m - 1, d, hh, mm, 0));
    const offFrom = tzOffsetMinutes(fromTz, asIfUtc);
    const realUtc = new Date(asIfUtc.getTime() - offFrom * 60 * 1000);
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: toTz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
    const parts = Object.fromEntries(fmt.formatToParts(realUtc).map((p) => [p.type, p.value]));
    const h = parts.hour === '24' ? '00' : parts.hour;
    return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${h}:${parts.minute}` };
  }

  function formatDateLong(dateStr, tz) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      timeZone: 'UTC',
    });
  }

  function setBanner(text) {
    const el = document.querySelector('[data-region="banner"]');
    if (el) el.innerHTML = text;
  }

  function showError(msg) {
    setBanner(`<strong>${escapeHtml(msg)}</strong>`);
    const headline = document.querySelector('[data-region="hero-headline"]');
    if (headline) headline.textContent = msg;
  }

  async function init() {
    const id = new URLSearchParams(location.search).get('id');
    if (!id) return showError("We couldn't find that booking.");

    let res;
    try {
      res = await fetch(`/api/bookings/${encodeURIComponent(id)}`);
    } catch (_) {
      return showError("We couldn't reach the server. Please call (470) 595-7775.");
    }
    if (!res.ok) return showError("That booking wasn't found.");
    const json = await res.json();
    if (!json.ok) return showError(json.error || "That booking wasn't found.");

    const b = json.data;
    hydrate(b);
  }

  function hydrate(b) {
    // Convert store-local slot to user's local timezone
    const userTz = (Intl.DateTimeFormat().resolvedOptions().timeZone) || b.slot.tz;
    const local = convertWallClock(b.slot.date, b.slot.time, b.slot.tz, userTz);

    const dateLong = formatDateLong(local.date, userTz);
    const time12 = format12h(local.time);

    // Banner
    setBanner(`<strong>✓ Email sent.</strong> &nbsp;Confirmation sent to ${escapeHtml(b.customer.email)}.`);

    // Headline + reference
    const headline = document.querySelector('[data-region="hero-headline"]');
    if (headline) {
      headline.textContent = `See you ${dateLong} at ${time12}, ${b.customer.firstName}.`;
    }
    const ref = document.querySelector('[data-region="reference"]');
    if (ref) ref.textContent = `Reference: ${b.id}`;

    // Summary
    const summary = document.querySelector('[data-region="summary"]');
    if (summary) {
      summary.innerHTML = `
        <dt>Date</dt><dd>${escapeHtml(dateLong)}</dd>
        <dt>Time</dt><dd>${escapeHtml(time12)} <span style="color:var(--muted);font-size:13px;">(${escapeHtml(userTz)})</span></dd>
        <dt>Duration</dt><dd>${b.slot.durationMinutes} minutes</dd>
        <dt>Where</dt><dd>150 Pearl Nix Pkwy, Gainesville GA 30501</dd>
        <dt>Reference</dt><dd>${escapeHtml(b.id)}</dd>
      `;
    }

    // ICS link
    const ics = document.querySelector('[data-region="ics-link"]');
    if (ics) ics.href = `/api/bookings/${encodeURIComponent(b.id)}/ics`;

    // Per-audience prep checklist
    const prep = document.querySelector('[data-region="prep"]');
    const items = PREP_BY_AUDIENCE[b.audience] || PREP_BY_AUDIENCE.general;
    if (prep) {
      prep.innerHTML = items.map((line) => {
        // Render anchor for the call line if it includes a phone number
        if (/\(470\) 595-7775/.test(line)) {
          return `<li>${line.replace('(470) 595-7775', '<a href="tel:+14705957775">(470) 595-7775</a>')}</li>`;
        }
        return `<li>${escapeHtml(line)}</li>`;
      }).join('');
    }

    // Page title
    document.title = `Confirmed · ${dateLong} at ${time12} · GA Suit Warehouse`;
  }

  document.addEventListener('DOMContentLoaded', init);
})();
