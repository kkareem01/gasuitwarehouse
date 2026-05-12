/* GA Suit Warehouse — in-store iPad intake form.
   Three sub-stages in one card:
     1) customer  — first/last/phone/email + "I'm done" (gated)
     2) handoff   — "Thanks, X! Please hand the iPad back" + small Continue
     3) staff     — chips/date/ticket/notes + Submit (single POST) */

(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const card = $('#intake-card');
  if (!card) return;

  const customerForm = $('#intake-customer-form');
  const staffForm = $('#intake-staff-form');
  const doneBtn = $('#intake-customer-done');
  const continueBtn = $('#intake-handoff-continue');
  const backBtn = $('#intake-back');
  const submitBtn = $('#intake-submit');
  const resetBtn = $('#intake-reset');
  const errorBox = $('#intake-error');

  const stageForm = $('[data-stage="form"]');
  const stageSubmitting = $('[data-stage="submitting"]');
  const stageConfirmed = $('[data-stage="confirmed"]');
  const regions = $$('.intake-region');
  const regionByName = Object.fromEntries(regions.map((r) => [r.dataset.region, r]));

  const phoneInput = $('#bk-phone');
  const firstInput = $('#bk-first');
  const lastInput = $('#bk-last');
  const emailInput = $('#bk-email');
  const dateInput = $('#bk-needby');
  const chips = $$('.intake-chip', staffForm);

  let formStartedAt = Date.now();

  // --- date min = today (local) -----------------------------------------

  function todayLocalISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  dateInput.min = todayLocalISO();

  // --- phone formatting (matches booking) -------------------------------

  function formatPhone(raw) {
    const digits = raw.replace(/\D/g, '').slice(0, 10);
    if (digits.length > 6) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    if (digits.length > 3) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    if (digits.length > 0) return `(${digits}`;
    return '';
  }
  phoneInput.addEventListener('input', () => {
    const next = formatPhone(phoneInput.value);
    if (next !== phoneInput.value) {
      phoneInput.value = next;
      try { phoneInput.setSelectionRange(next.length, next.length); } catch {}
    }
  });

  // --- chip multi-select ------------------------------------------------

  chips.forEach((c) => {
    c.setAttribute('aria-pressed', 'false');
    c.addEventListener('click', () => {
      c.classList.toggle('is-active');
      c.setAttribute('aria-pressed', c.classList.contains('is-active') ? 'true' : 'false');
    });
  });

  function selectedTailoring() {
    return chips
      .filter((c) => c.classList.contains('is-active'))
      .map((c) => c.dataset.item);
  }

  // --- validation -------------------------------------------------------

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function customerValid() {
    if (phoneInput.value.replace(/\D/g, '').length < 10) return false;
    if (!firstInput.value.trim()) return false;
    if (!lastInput.value.trim()) return false;
    if (!EMAIL_RE.test(emailInput.value.trim())) return false;
    return true;
  }

  function refreshDoneButton() {
    doneBtn.disabled = !customerValid();
  }
  customerForm.addEventListener('input', refreshDoneButton);
  refreshDoneButton();

  function readForm() {
    const cf = new FormData(customerForm);
    const sf = new FormData(staffForm);
    return {
      firstName: String(cf.get('firstName') || '').trim(),
      lastName: String(cf.get('lastName') || '').trim(),
      phone: String(cf.get('phone') || '').trim(),
      email: String(cf.get('email') || '').trim(),
      hp: String(cf.get('hp') || ''),
      ticketNumber: String(sf.get('ticketNumber') || '').trim(),
      tailoringItems: selectedTailoring(),
      needByDate: String(sf.get('needByDate') || '').trim(),
      additionalNotes: String(sf.get('additionalNotes') || '').trim(),
    };
  }

  function validateAll(v) {
    const errors = [];
    if (!v.firstName) errors.push('Enter your first name.');
    if (!v.lastName) errors.push('Enter your last name.');
    if (v.phone.replace(/\D/g, '').length < 10) errors.push('Enter a 10-digit phone number.');
    if (!EMAIL_RE.test(v.email)) errors.push('Enter a valid email.');
    if (v.tailoringItems.length === 0) errors.push('Pick at least one item that needs tailoring.');
    if (!v.needByDate) errors.push('Pick the date you need it by.');
    else if (v.needByDate < todayLocalISO()) errors.push('Need-by date must be today or later.');
    return errors;
  }

  // --- error display ----------------------------------------------------

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.hidden = false;
    errorBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function clearError() {
    errorBox.hidden = true;
    errorBox.textContent = '';
  }

  // --- stage / step transitions ----------------------------------------

  function showStage(name) {
    [stageForm, stageSubmitting, stageConfirmed].forEach((s) => {
      const match = s.dataset.stage === name;
      s.hidden = !match;
      s.setAttribute('aria-hidden', match ? 'false' : 'true');
    });
  }

  function setStep(n) {
    card.dataset.step = String(n);
    const wanted = n === 1 ? 'customer' : n === 2 ? 'handoff' : 'staff';
    Object.entries(regionByName).forEach(([name, el]) => {
      el.hidden = name !== wanted;
    });
    clearError();
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    if (n === 2) requestAnimationFrame(fitHandoffTitle);
  }

  // --- handoff title auto-fit ------------------------------------------
  // The handoff headline ("Thanks, X!") needs to scale with the customer's
  // name so short names like "Suit" feel huge and long names like
  // "Christopher" still fit on one line inside the booking card. The CSS
  // rule sets a fallback range; this function picks the largest size that
  // fits on one line.
  function fitHandoffTitle() {
    const title = $('.intake-handoff__title');
    if (!title) return;
    // title is block-level — its clientWidth IS the available render width
    // (the .intake-handoff container has its own padding that scrollWidth
    // cannot use). Subtract a tiny safety pad for sub-pixel rounding.
    const available = title.clientWidth - 4;
    if (available <= 0) return;

    const MAX = 240;
    const MIN = 32;

    let size = MAX;
    title.style.fontSize = size + 'px';
    let guard = 0;
    while (title.scrollWidth > available && size > MIN && guard < 120) {
      size -= 2;
      title.style.fontSize = size + 'px';
      guard += 1;
    }
  }

  // Re-fit on resize while the handoff stage is visible.
  let resizeDebounce = null;
  window.addEventListener('resize', () => {
    const handoff = regionByName.handoff;
    if (!handoff || handoff.hidden) return;
    clearTimeout(resizeDebounce);
    resizeDebounce = setTimeout(() => requestAnimationFrame(fitHandoffTitle), 80);
  });

  // --- step transitions ------------------------------------------------

  customerForm.addEventListener('submit', (ev) => {
    ev.preventDefault();
    if (!customerValid()) {
      refreshDoneButton();
      return;
    }
    const firstNameBind = $('[data-bind="firstName"]');
    if (firstNameBind) firstNameBind.textContent = firstInput.value.trim();
    setStep(2);
  });

  continueBtn.addEventListener('click', () => {
    const summaryBind = $('[data-bind="customerSummary"]');
    if (summaryBind) {
      const summary = `${firstInput.value.trim()} ${lastInput.value.trim()} · ${emailInput.value.trim()} · ${phoneInput.value.trim()}`;
      summaryBind.textContent = summary;
    }
    setStep(3);
  });

  backBtn.addEventListener('click', () => {
    setStep(1);
    refreshDoneButton();
  });

  // --- final submit (staff stage) --------------------------------------

  function formatDateHuman(iso) {
    if (!iso) return 'your date';
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return iso;
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
    });
  }

  async function submit(values) {
    const payload = {
      firstName: values.firstName,
      lastName: values.lastName,
      phone: values.phone,
      email: values.email,
      ticketNumber: values.ticketNumber,
      tailoringNotes: values.tailoringItems.join(', '),
      needByDate: values.needByDate,
      additionalNotes: values.additionalNotes,
      hp: values.hp,
      startedAt: formStartedAt,
    };
    const res = await fetch('/api/intake', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      throw new Error(data?.error || 'Could not save. Try again.');
    }
    return data.data;
  }

  staffForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    clearError();
    const values = readForm();
    const errors = validateAll(values);
    if (errors.length > 0) {
      showError(errors[0]);
      return;
    }
    submitBtn.disabled = true;
    showStage('submitting');
    try {
      await submit(values);
      const sub = $('[data-bind="needByDate"]');
      if (sub) sub.textContent = formatDateHuman(values.needByDate);
      showStage('confirmed');
    } catch (e) {
      showStage('form');
      showError(e?.message || 'Could not save. Please try again.');
    } finally {
      submitBtn.disabled = false;
    }
  });

  // --- reset -----------------------------------------------------------

  function resetForm() {
    customerForm.reset();
    staffForm.reset();
    chips.forEach((c) => {
      c.classList.remove('is-active');
      c.setAttribute('aria-pressed', 'false');
    });
    dateInput.min = todayLocalISO();
    setStep(1);
    refreshDoneButton();
    formStartedAt = Date.now();
    showStage('form');
    if (firstInput) firstInput.focus({ preventScroll: true });
  }
  resetBtn.addEventListener('click', resetForm);

  formStartedAt = Date.now();
})();
