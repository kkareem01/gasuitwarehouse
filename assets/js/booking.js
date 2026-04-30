/* GA Suit Warehouse — booking entry point.
   Auto-mounts on every [data-booking-root]; reads data-audience from the parent <section>.
   Single state object + idempotent regional render(). Event delegation by data-action. */

(function () {
  function makeState(audience) {
    return {
      step: 1,
      audience,
      customer: { firstName: '', lastName: '', phone: '', email: '', consent: false },
      answers: {},
      selectedDate: null,
      selectedTime: null,
      timezone: (typeof Intl !== 'undefined' && Intl.DateTimeFormat().resolvedOptions().timeZone) || 'America/New_York',
      timeFormat: '12h',
      monthCursor: monthCursorFromToday(),
      monthCache: {},
      daySlotsCache: {},
      leadId: null,
      leadToken: null,
      prefill: null,
      formStartedAt: Date.now(),
      submitting: false,
      error: null,
      config: null,
      monthDataLoading: false,
      slotsLoading: false,
    };
  }

  function readPrefillParams() {
    const params = new URLSearchParams(window.location.search);
    const lead = params.get('lead');
    const t = params.get('t');
    if (!lead || !t) return null;
    return { lead, t };
  }

  async function fetchLeadPrefill(lead, t) {
    try {
      const res = await fetch(`/api/leads/lookup?lead=${encodeURIComponent(lead)}&t=${encodeURIComponent(t)}`);
      if (!res.ok) return null;
      const j = await res.json();
      return j.ok ? j : null;
    } catch (_) {
      return null;
    }
  }

  function monthCursorFromToday() {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }

  function mount(root) {
    const section = root.closest('[data-audience]');
    const audience = section?.dataset.audience;
    if (!audience) return;

    const state = makeState(audience);

    // Bootstrap UI even before config arrives so the form is interactive immediately
    renderAll(root, state);
    fetchConfig().then((cfg) => {
      state.config = cfg;
      renderAll(root, state);
    });

    function applyPrefillFromUrl() {
      const prefillParams = readPrefillParams();
      if (!prefillParams) return;
      fetchLeadPrefill(prefillParams.lead, prefillParams.t).then((j) => {
        if (!j || !j.lead) return;
        state.audience = j.lead.audience || audience;
        state.customer = {
          firstName: j.lead.firstName || '',
          lastName: j.lead.lastName || '',
          phone: j.lead.phone || '',
          email: j.lead.email || '',
          consent: true,
        };
        state.leadId = prefillParams.lead;
        state.leadToken = prefillParams.t;
        state.prefill = { offerName: j.offer?.name || 'gift' };
        state.step = 3;
        renderAll(root, state);
        loadMonthData(root, state);
      });
    }

    // Expose the prefill hook so /lead-magnet/ can re-trigger it after it
    // updates the URL via history.replaceState (the calendar morphs in place
    // instead of forcing a navigation).
    root.__refreshFromUrl = applyPrefillFromUrl;

    if (readPrefillParams()) {
      applyPrefillFromUrl();
    } else {
      // Pre-load this month so the locked calendar already shows highlighted open dates
      loadMonthData(root, state);
    }

    // Event delegation
    root.addEventListener('click', (e) => onClick(e, root, state));
    root.addEventListener('input', (e) => onInput(e, root, state));
    root.addEventListener('submit', (e) => onSubmit(e, root, state));
    root.addEventListener('change', (e) => onChange(e, root, state));
  }

  function setState(root, state, patch) {
    Object.assign(state, patch);
    renderAll(root, state);
  }

  function renderAll(root, state) {
    // Calendar visibility:
    //   step 1 — show, locked
    //   step 2 — hidden entirely
    //   step 3 — show, unlocked, with slot list below
    const showCalendar = state.step !== 2;
    root.innerHTML = `
      <div class="booking-card" data-step="${state.step}">
        ${renderStepPill(state)}
        <div class="booking-card__body">
          <div class="booking-pane" data-region="form">${BookingForm.renderForm(state, state.audience, state.error)}</div>
          ${showCalendar ? `
          <div class="booking-pane" data-region="calendar-pane">
            ${BookingCalendar.buildCalendarHtml(state, currentMonthData(state), state.step !== 3)}
            ${state.step === 3 ? BookingCalendar.buildSlotsHtml(state, currentDaySlots(state), state.config?.storeTimezone || 'America/New_York') : ''}
          </div>` : ''}
        </div>
      </div>
    `;
  }

  function renderStepPill(state) {
    const items = [
      { label: 'Fill out the form', active: state.step <= 2, done: state.step === 3 },
      { label: 'Book your event', active: state.step === 3, done: false },
    ];
    return `<div class="booking-step-pill">
      ${items.map((i, idx) => {
        const cls = i.done ? 'is-done' : i.active ? 'is-active' : '';
        const sep = idx > 0 ? '<span style="color:var(--rule);margin:0 6px;">·</span>' : '';
        return `${sep}<span class="booking-step-pill__item ${cls}"><span class="booking-step-pill__dot"></span>${i.label}</span>`;
      }).join('')}
    </div>`;
  }

  function currentMonthData(state) {
    const key = monthKey(state.audience, state.monthCursor.year, state.monthCursor.month);
    return state.monthCache[key];
  }

  function currentDaySlots(state) {
    if (!state.selectedDate) return [];
    return state.daySlotsCache[`${state.audience}:${state.selectedDate}`] || [];
  }

  function monthKey(audience, year, month) {
    return `${audience}:${year}-${String(month).padStart(2, '0')}`;
  }

  // ---------------- events ----------------

  function onSubmit(e, root, state) {
    if (!e.target.matches('form[data-action="submit-step"]')) return;
    e.preventDefault();
    handleContinue(e.target, root, state);
  }

  function onClick(e, root, state) {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;

    if (action === 'select-day') {
      const date = target.dataset.date;
      setState(root, state, { selectedDate: date, selectedTime: null });
      loadDaySlots(root, state, date);
      return;
    }

    if (action === 'select-slot') {
      setState(root, state, { selectedTime: target.dataset.time });
      return;
    }

    if (action === 'change-month') {
      const delta = parseInt(target.dataset.delta || '0', 10);
      const cur = state.monthCursor;
      let m = cur.month + delta;
      let y = cur.year;
      if (m < 1) { m = 12; y--; }
      if (m > 12) { m = 1; y++; }
      state.monthCursor = { year: y, month: m };
      setState(root, state, {});
      loadMonthData(root, state);
      return;
    }

    if (action === 'toggle-timeformat') {
      setState(root, state, { timeFormat: target.dataset.format === '24h' ? '24h' : '12h' });
      return;
    }

    if (action === 'confirm-booking') {
      handleConfirmBooking(root, state);
      return;
    }
  }

  function onInput(e, root, state) {
    const target = e.target;
    if (target.dataset.action === 'phone-input') {
      // Strip non-digits in place; format as (XXX) XXX-XXXX as the user types
      const cursorPos = target.selectionStart;
      const before = target.value;
      const digits = before.replace(/\D/g, '').slice(0, 10);
      let formatted = digits;
      if (digits.length > 6) formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
      else if (digits.length > 3) formatted = `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
      else if (digits.length > 0) formatted = `(${digits}`;
      if (formatted !== before) {
        target.value = formatted;
        // Best-effort cursor preservation: keep at end (typical for masking)
        target.setSelectionRange(formatted.length, formatted.length);
      }
      state.customer.phone = formatted;
    }

    // Two-way sync between step 1 and step 2 based on the three core fields:
    //   step 1 + all valid    → advance to step 2
    //   step 2 + any invalid  → fold back to step 1
    if (state.step !== 1 && state.step !== 2) return;
    if (target.id !== 'bk-phone' && target.id !== 'bk-first' && target.id !== 'bk-last') return;
    const formEl = target.closest('form[data-action="submit-step"]');
    if (!formEl) return;
    const { customer } = BookingForm.readForm(formEl, state.audience);
    const step1Valid = BookingForm.validateStep1(customer).length === 0;

    if (state.step === 1 && step1Valid) {
      // Expand to step 2 UI but keep focus where the user is typing —
      // they may have satisfied validation mid-word (e.g. one-letter last name).
      const focusId = target.id;
      handleContinue(formEl, root, state);
      queueMicrotask(() => {
        const el = root.querySelector('#' + focusId);
        if (!el) return;
        el.focus();
        const len = el.value.length;
        try { el.setSelectionRange(len, len); } catch {}
      });
    } else if (state.step === 2 && !step1Valid) {
      // Preserve in-progress text (incl. extended fields) before the re-render
      state.customer = { ...state.customer, ...customer };
      const focusId = target.id;
      setState(root, state, { step: 1, error: null });
      queueMicrotask(() => root.querySelector('#' + focusId)?.focus());
    }
  }

  function onChange(e, root, state) {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    if (target.dataset.action === 'change-timezone') {
      setState(root, state, { timezone: target.value });
    }
  }

  function captureFormIntoState(formEl, state) {
    if (!formEl) return;
    const { customer, answers } = BookingForm.readForm(formEl, state.audience);
    state.customer = { ...state.customer, ...customer };
    state.answers = { ...state.answers, ...answers };
  }

  // ---------------- step transitions ----------------

  function handleContinue(formEl, root, state) {
    const { customer, answers, honeypot } = BookingForm.readForm(formEl, state.audience);
    if (honeypot) return; // silent reject
    state.customer = customer;
    state.answers = answers;

    if (state.step === 1) {
      const errs = BookingForm.validateStep1(customer);
      if (errs.length > 0) return setState(root, state, { error: errs[0] });
      setState(root, state, { step: 2, error: null });
      return;
    }

    if (state.step === 2) {
      const errs = BookingForm.validateStep2(customer, answers, state.audience);
      if (errs.length > 0) return setState(root, state, { error: errs[0] });
      setState(root, state, { step: 3, error: null });
      // Capture lead at step 2 → 3 (now that consent is given)
      postLead(state).then((leadId) => { if (leadId) state.leadId = leadId; });
      loadMonthData(root, state);
      return;
    }
  }

  async function handleConfirmBooking(root, state) {
    if (!state.selectedDate || !state.selectedTime) return;
    setState(root, state, { submitting: true, error: null });

    const body = {
      audience: state.audience,
      leadId: state.leadId,
      t: state.leadToken,
      customer: state.customer,
      answers: state.answers,
      slot: { date: state.selectedDate, time: state.selectedTime },
      timezone: state.timezone,
      formStartedAt: state.formStartedAt,
      honeypot: '',
    };

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 409 || json.code === 'SLOT_TAKEN') {
        // Refresh availability + slot list, show inline error
        delete state.daySlotsCache[`${state.audience}:${state.selectedDate}`];
        delete state.monthCache[monthKey(state.audience, state.monthCursor.year, state.monthCursor.month)];
        await loadDaySlots(root, state, state.selectedDate);
        await loadMonthData(root, state);
        return setState(root, state, {
          submitting: false,
          selectedTime: null,
          error: 'That time was just taken. Please pick another.',
        });
      }
      if (!res.ok || !json.ok) {
        return setState(root, state, {
          submitting: false,
          error: json.error || 'Could not confirm. Please try again.',
        });
      }
      if (json.data?.redemption) {
        try {
          sessionStorage.setItem('lastRedemption', JSON.stringify(json.data.redemption));
        } catch (_) {}
      }
      // Dispatch a cancelable event so a host page (e.g. /lead-magnet/) can
      // intercept and render an inline success state instead of navigating
      // to /booking-confirmed.html. If nobody calls preventDefault, fall
      // through to the standard redirect (the /booking/ page behaves as
      // before).
      const evt = new CustomEvent('booking:confirmed', {
        detail: { booking: json.data },
        cancelable: true,
      });
      const allowDefault = window.dispatchEvent(evt);
      if (allowDefault) {
        window.location.href = `/booking-confirmed.html?id=${encodeURIComponent(json.data.id)}`;
      }
    } catch (err) {
      setState(root, state, { submitting: false, error: 'Network error. Please try again.' });
    }
  }

  // ---------------- API ----------------

  async function fetchConfig() {
    try {
      const res = await fetch('/api/config');
      const j = await res.json();
      return j.ok ? j.data : null;
    } catch (_) { return null; }
  }

  async function postLead(state) {
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          audience: state.audience,
          firstName: state.customer.firstName,
          lastName: state.customer.lastName,
          phone: state.customer.phone,
          consent: state.customer.consent,
        }),
      });
      const j = await res.json().catch(() => ({}));
      return j.ok ? j.data.leadId : null;
    } catch (_) { return null; }
  }

  async function loadMonthData(root, state) {
    const { year, month } = state.monthCursor;
    const key = monthKey(state.audience, year, month);
    if (state.monthCache[key] || state.monthDataLoading) return;
    state.monthDataLoading = true;
    try {
      const url = `/api/availability/month?year=${year}&month=${month}&audience=${encodeURIComponent(state.audience)}`;
      const res = await fetch(url);
      const j = await res.json();
      if (j.ok) state.monthCache[key] = j.data;
    } finally {
      state.monthDataLoading = false;
      renderAll(root, state);
    }
  }

  async function loadDaySlots(root, state, date) {
    const key = `${state.audience}:${date}`;
    if (state.daySlotsCache[key]) {
      renderAll(root, state);
      return;
    }
    state.slotsLoading = true;
    try {
      const url = `/api/availability?date=${date}&audience=${encodeURIComponent(state.audience)}`;
      const res = await fetch(url);
      const j = await res.json();
      if (j.ok) state.daySlotsCache[key] = j.data.slots;
    } finally {
      state.slotsLoading = false;
      renderAll(root, state);
    }
  }

  // ---------------- bootstrap ----------------

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-booking-root]').forEach(mount);
  });
})();
