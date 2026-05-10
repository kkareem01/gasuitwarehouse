/* GA Suit Warehouse — in-store iPad intake form.
   Vanilla ES module loaded by /intake/index.html. */

(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const form = $('#intake-form');
  if (!form) return;

  const submitBtn = $('#intake-submit');
  const errorBox = $('#intake-error');
  const stageForm = $('[data-stage="form"]');
  const stageSubmitting = $('[data-stage="submitting"]');
  const stageConfirmed = $('[data-stage="confirmed"]');
  const resetBtn = $('#intake-reset');
  const colorOther = $('#intake-color-other');
  const phoneInput = form.elements.phone;
  const dateInput = form.elements.needByDate;
  const chips = $$('.intake-chip', form);

  // --- state ---------------------------------------------------------------

  let formStartedAt = Date.now();
  let selectedColor = '';

  // Set min on the date input to today (in local time).
  function todayLocalISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  dateInput.min = todayLocalISO();

  // --- phone formatting ----------------------------------------------------

  function formatPhone(raw) {
    const digits = raw.replace(/\D/g, '').slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  phoneInput.addEventListener('input', () => {
    const cursorAtEnd = phoneInput.selectionStart === phoneInput.value.length;
    phoneInput.value = formatPhone(phoneInput.value);
    if (cursorAtEnd) phoneInput.setSelectionRange(phoneInput.value.length, phoneInput.value.length);
  });

  // --- color chip picker ---------------------------------------------------

  function selectChip(chip) {
    const color = chip.dataset.color;
    chips.forEach((c) => c.classList.toggle('is-active', c === chip));
    selectedColor = color;
    if (color === 'Other') {
      colorOther.hidden = false;
      colorOther.required = true;
      colorOther.focus();
    } else {
      colorOther.hidden = true;
      colorOther.required = false;
      colorOther.value = '';
    }
  }
  chips.forEach((c) => c.addEventListener('click', () => selectChip(c)));

  // --- validation (mirror of server-side rules) ----------------------------

  function getColorValue() {
    if (!selectedColor) return '';
    if (selectedColor === 'Other') return colorOther.value.trim();
    return selectedColor;
  }

  function readForm() {
    const fd = new FormData(form);
    return {
      firstName: String(fd.get('firstName') || '').trim(),
      lastName: String(fd.get('lastName') || '').trim(),
      phone: String(fd.get('phone') || '').trim(),
      email: String(fd.get('email') || '').trim(),
      suitSize: String(fd.get('suitSize') || '').trim(),
      suitColor: getColorValue(),
      tailoringNotes: String(fd.get('tailoringNotes') || '').trim(),
      needByDate: String(fd.get('needByDate') || '').trim(),
      hp: String(fd.get('hp') || ''),
    };
  }

  function validate(values) {
    const errors = [];
    if (!values.firstName) errors.push('Enter your first name.');
    if (!values.lastName) errors.push('Enter your last name.');
    if (values.phone.replace(/\D/g, '').length < 10) errors.push('Enter a 10-digit phone number.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.push('Enter a valid email.');
    if (!values.suitSize) errors.push('Enter the suit size.');
    if (!values.suitColor) errors.push('Pick a suit color.');
    if (!values.tailoringNotes) errors.push('Describe what needs to be tailored.');
    if (!values.needByDate) errors.push('Pick the date you need it by.');
    else if (values.needByDate < todayLocalISO()) errors.push('Need-by date must be today or later.');
    return errors;
  }

  // --- stage transitions ---------------------------------------------------

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
    chips.forEach((c) => c.classList.remove('is-active'));
    selectedColor = '';
    colorOther.hidden = true;
    colorOther.required = false;
    dateInput.min = todayLocalISO();
    formStartedAt = Date.now();
    clearError();
    showStage('form');
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    const first = form.elements.firstName;
    if (first) first.focus({ preventScroll: true });
  }

  // --- submit --------------------------------------------------------------

  function formatDateHuman(iso) {
    if (!iso) return 'your date';
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return iso;
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }

  async function submit(values) {
    const payload = {
      ...values,
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
      const sub = $('#intake-confirmed-sub [data-bind="needByDate"]');
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

  // --- init ----------------------------------------------------------------

  formStartedAt = Date.now();
})();
