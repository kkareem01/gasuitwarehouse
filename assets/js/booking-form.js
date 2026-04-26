/* GA Suit Warehouse — booking form (steps 1+2).
   Renders into [data-region="form"]. Per-audience FIELD_SCHEMAS must stay in
   sync with lib/audiences.mjs — server warns at boot if names drift. */

(function () {
  const FIELD_SCHEMAS = {
    weddings: [
      { name: 'eventDate', label: 'Wedding date', type: 'date', required: true },
      { name: 'partySize', label: '# in your wedding party', type: 'select', required: true,
        options: ['Just me', '2-4', '5-7', '8-10', '11+'] },
      { name: 'priorities', label: 'Anything we should know?', type: 'textarea', required: false,
        maxLength: 500, placeholder: 'Color palette, venue, deadlines…' },
    ],
    prom: [
      { name: 'promDate', label: 'Prom date', type: 'date', required: true },
      { name: 'school', label: 'School', type: 'text', required: true, maxLength: 80 },
      { name: 'lookGoal', label: 'What look are you going for?', type: 'select', required: true,
        options: ['Classic black tux', 'Bold color', 'Velvet', 'Three-piece', 'Not sure yet'] },
      { name: 'dateColor', label: "Your date's dress color (optional)", type: 'text',
        required: false, maxLength: 60, placeholder: 'Helps us coordinate' },
    ],
    professionals: [
      { name: 'occasion', label: "What's the suit for?", type: 'select', required: true,
        options: ['New job or promotion', 'Court', 'Conference or speaking', 'Wardrobe refresh', 'Daily wear'] },
      { name: 'numSuits', label: 'How many suits?', type: 'select', required: true,
        options: ['1', '2-3', '4-6', '7+ (corporate)'] },
      { name: 'timeline', label: 'When do you need it by?', type: 'select', required: true,
        options: ['Within 2 weeks', '2-4 weeks', '1-2 months', 'No rush'] },
    ],
    other: [
      { name: 'occasion', label: "What's the occasion?", type: 'text', required: true,
        maxLength: 80, placeholder: 'Gala, court date, anniversary…' },
      { name: 'eventDate', label: 'Date of event', type: 'date', required: true },
      { name: 'serviceType', label: 'What do you need?', type: 'select', required: true,
        options: ['Buy a new suit', 'Rent', 'Alterations only', 'Just exploring'] },
      { name: 'notes', label: 'Anything else?', type: 'textarea', required: false, maxLength: 500 },
    ],
  };

  function escapeAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }
  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function fieldHtml(field, value) {
    const id = `bk-f-${field.name}`;
    const v = escapeAttr(value || '');
    let inner = '';
    if (field.type === 'select') {
      const opts = ['<option value="">Select</option>']
        .concat(field.options.map((o) => `<option value="${escapeAttr(o)}"${o === value ? ' selected' : ''}>${escapeHtml(o)}</option>`))
        .join('');
      inner = `<select id="${id}" name="${field.name}" ${field.required ? 'required' : ''}>${opts}</select>`;
    } else if (field.type === 'textarea') {
      const ml = field.maxLength ? ` maxlength="${field.maxLength}"` : '';
      const ph = field.placeholder ? ` placeholder="${escapeAttr(field.placeholder)}"` : '';
      inner = `<textarea id="${id}" name="${field.name}" rows="3"${ml}${ph}${field.required ? ' required' : ''}>${escapeHtml(value || '')}</textarea>`;
    } else {
      const t = field.type === 'date' ? 'date' : 'text';
      const ml = field.maxLength ? ` maxlength="${field.maxLength}"` : '';
      const ph = field.placeholder ? ` placeholder="${escapeAttr(field.placeholder)}"` : '';
      const min = field.type === 'date' ? ` min="${new Date().toISOString().slice(0, 10)}"` : '';
      inner = `<input id="${id}" type="${t}" name="${field.name}" value="${v}"${ml}${ph}${min}${field.required ? ' required' : ''} />`;
    }
    return `<div class="field" data-field="${field.name}">
      <label for="${id}">${escapeHtml(field.label)}${field.required ? ' *' : ''}</label>
      ${inner}
    </div>`;
  }

  const TITLES = {
    weddings: { h2: 'Wedding Fitting Appointment', sub: 'Excited to dress you for your wedding day.', cta1: 'Continue', cta2: 'Continue' },
    prom: { h2: 'Prom Fitting Appointment', sub: 'Excited to make your prom unforgettable.', cta1: 'Continue', cta2: 'Continue' },
    professionals: { h2: 'Professional Fitting Appointment', sub: 'Excited to refine your professional wardrobe.', cta1: 'Continue', cta2: 'Continue' },
    other: { h2: 'Custom Styling Appointment', sub: 'Excited to dress you for whatever the occasion calls for.', cta1: 'Continue', cta2: 'Continue' },
  };

  function renderForm(state, audience, errorMessage) {
    const customer = state.customer;
    const answers = state.answers;
    const schema = FIELD_SCHEMAS[audience] || [];
    const titles = TITLES[audience] || TITLES.other;

    const ext = schema.map((f) => fieldHtml(f, answers[f.name])).join('');
    const ctaLabel = state.step === 1 ? titles.cta1 : titles.cta2;
    const subline = state.step === 1
      ? 'Book a fitting below to lock in your time.'
      : 'A few more details and you can pick a time.';

    return `
      <h2>${escapeHtml(titles.h2)}</h2>
      <p class="booking-pane__sub">${escapeHtml(titles.sub)}</p>
      <p class="booking-pane__sub">${escapeHtml(subline)}</p>

      ${errorMessage ? `<div class="booking-error" role="alert">${escapeHtml(errorMessage)}</div>` : ''}

      <form class="booking-form" data-action="submit-step" novalidate>
        <div class="field">
          <label for="bk-phone">Phone</label>
          <div class="booking-form__phone-row">
            <span class="booking-form__country" aria-label="United States">+1</span>
            <input id="bk-phone" type="tel" name="phone" autocomplete="tel" inputmode="numeric" required
              data-action="phone-input"
              maxlength="14"
              placeholder="(404) 555-0123" value="${escapeAttr(customer.phone || '')}" />
          </div>
        </div>

        <div class="booking-form__row">
          <div class="field">
            <label for="bk-first">First name</label>
            <input id="bk-first" type="text" name="firstName" autocomplete="given-name" required
              placeholder="First name *"
              value="${escapeAttr(customer.firstName || '')}" />
          </div>
          <div class="field">
            <label for="bk-last">Last name</label>
            <input id="bk-last" type="text" name="lastName" autocomplete="family-name" required
              placeholder="Last name *"
              value="${escapeAttr(customer.lastName || '')}" />
          </div>
        </div>

        <div class="booking-form__extended" aria-hidden="${state.step === 1 ? 'true' : 'false'}">
          <div class="field">
            <label for="bk-email">Email Address</label>
            <input id="bk-email" type="email" name="email" autocomplete="email" required
              placeholder="Email *" value="${escapeAttr(customer.email || '')}" />
          </div>
          ${ext}
        </div>

        <label class="booking-form__consent">
          <input type="checkbox" name="consent" required ${customer.consent ? 'checked' : ''} />
          <span>By entering your information, you consent to your data being saved in accordance with our
          <a href="#" tabindex="-1">Terms</a> &amp; <a href="#" tabindex="-1">Privacy Policy</a>
          and to receive text messages.</span>
        </label>

        <input type="text" name="website" class="booking-form__honeypot" tabindex="-1" autocomplete="off" aria-hidden="true" />

        <button type="submit" class="btn btn-primary">${ctaLabel} ›</button>
      </form>
    `;
  }

  function readForm(formEl, audience) {
    const data = new FormData(formEl);
    const customer = {
      phone: data.get('phone') || '',
      firstName: data.get('firstName') || '',
      lastName: data.get('lastName') || '',
      email: data.get('email') || '',
      consent: data.get('consent') === 'on',
    };
    const honeypot = data.get('website') || '';
    const answers = {};
    for (const f of FIELD_SCHEMAS[audience] || []) {
      answers[f.name] = data.get(f.name) || '';
    }
    return { customer, answers, honeypot };
  }

  function validateStep1(customer) {
    const errors = [];
    const digits = (customer.phone || '').replace(/\D/g, '');
    if (digits.length < 10) errors.push('Enter a valid 10-digit phone number.');
    if (!customer.firstName.trim()) errors.push('First name is required.');
    if (!customer.lastName.trim()) errors.push('Last name is required.');
    return errors;
  }

  function validateStep2(customer, answers, audience) {
    const errors = validateStep1(customer);
    if (!customer.email.trim()) errors.push('Email is required.');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) errors.push('Enter a valid email.');
    for (const f of FIELD_SCHEMAS[audience] || []) {
      if (f.required && !String(answers[f.name] || '').trim()) errors.push(`${f.label} is required.`);
    }
    if (!customer.consent) errors.push('Please agree to the terms.');
    return errors;
  }

  window.BookingForm = {
    FIELD_SCHEMAS,
    renderForm,
    readForm,
    validateStep1,
    validateStep2,
  };
})();
