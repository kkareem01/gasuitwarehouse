/* GA Suit Warehouse — in-store iPad intake form.
   Vanilla module loaded by /intake/index.html.
   UI mirrors the booking flow: Phone + First/Last visible at step 1, the rest
   of the form smoothly expands once those three are valid. */

(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const card = $('#intake-card');
  const form = $('#intake-form');
  if (!card || !form) return;

  const submitBtn = $('#intake-submit');
  const errorBox = $('#intake-error');
  const stageForm = $('[data-stage="form"]');
  const stageSubmitting = $('[data-stage="submitting"]');
  const stageConfirmed = $('[data-stage="confirmed"]');
  const resetBtn = $('#intake-reset');
  const phoneInput = $('#bk-phone');
  const firstInput = $('#bk-first');
  const lastInput = $('#bk-last');
  const dateInput = $('#bk-needby');
  const chips = $$('.intake-chip', form);
  const extended = $('.booking-form__extended', form);

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

  // --- tailoring chip multi-select --------------------------------------

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

  // --- step-state (mirrors booking auto-expand/collapse) ----------------

  function step1Valid() {
    const digits = phoneInput.value.replace(/\D/g, '');
    if (digits.length < 10) return false;
    if (!firstInput.value.trim()) return false;
    if (!lastInput.value.trim()) return false;
    return true;
  }

  function setStep(step) {
    card.dataset.step = String(step);
    extended.setAttribute('aria-hidden', step === 1 ? 'true' : 'false');
  }

  // Auto-expand when first 3 fields satisfy validation; auto-collapse when
  // any of them goes invalid again. Mirrors booking.js:230-278.
  function onStepInput(ev) {
    const t = ev.target;
    if (t !== phoneInput && t !== firstInput && t !== lastInput) return;

    const currentStep = parseInt(card.dataset.step || '1', 10);
    const valid = step1Valid();

    if (currentStep === 1 && valid) {
      setStep(2);
      // Keep focus where the user is typing — they may have hit validity
      // mid-word (e.g. one-letter last name).
      queueMicrotask(() => {
        try {
          t.focus();
          const len = t.value.length;
          t.setSelectionRange(len, len);
        } catch {}
      });
    } else if (currentStep === 2 && !valid) {
      setStep(1);
      queueMicrotask(() => {
        try { t.focus(); } catch {}
      });
    }
  }

  form.addEventListener('input', onStepInput);

  // --- validation -------------------------------------------------------

  function readForm() {
    const fd = new FormData(form);
    return {
      firstName: String(fd.get('firstName') || '').trim(),
      lastName: String(fd.get('lastName') || '').trim(),
      phone: String(fd.get('phone') || '').trim(),
      email: String(fd.get('email') || '').trim(),
      ticketNumber: String(fd.get('ticketNumber') || '').trim(),
      tailoringItems: selectedTailoring(),
      needByDate: String(fd.get('needByDate') || '').trim(),
      additionalNotes: String(fd.get('additionalNotes') || '').trim(),
      hp: String(fd.get('hp') || ''),
    };
  }

  function validate(v) {
    const errors = [];
    if (!v.firstName) errors.push('Enter your first name.');
    if (!v.lastName) errors.push('Enter your last name.');
    if (v.phone.replace(/\D/g, '').length < 10) errors.push('Enter a 10-digit phone number.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) errors.push('Enter a valid email.');
    if (v.tailoringItems.length === 0) errors.push('Pick at least one item that needs tailoring.');
    if (!v.needByDate) errors.push('Pick the date you need it by.');
    else if (v.needByDate < todayLocalISO()) errors.push('Need-by date must be today or later.');
    return errors;
  }

  // --- stage transitions -----------------------------------------------

  function showStage(name) {
    [stageForm, stageSubmitting, stageConfirmed].forEach((s) => {
      const match = s.dataset.stage === name;
      s.hidden = !match;
      s.setAttribute('aria-hidden', match ? 'false' : 'true');
    });
  }

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.hidden = false;
    errorBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function clearError() {
    errorBox.hidden = true;
    errorBox.textContent = '';
  }

  function resetForm() {
    form.reset();
    chips.forEach((c) => {
      c.classList.remove('is-active');
      c.setAttribute('aria-pressed', 'false');
    });
    dateInput.min = todayLocalISO();
    setStep(1);
    formStartedAt = Date.now();
    clearError();
    showStage('form');
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    if (firstInput) firstInput.focus({ preventScroll: true });
  }

  // --- submit ----------------------------------------------------------

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

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    clearError();
    const values = readForm();
    const errors = validate(values);
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

  resetBtn.addEventListener('click', resetForm);

  formStartedAt = Date.now();
})();
