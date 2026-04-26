/* GA Suit Warehouse — lead form handler.
   On submit: validate via HTML5, log to console, redirect to thank-you.html?source=<page>.
   Replace the console.log block with a real backend post (Formspree, Netlify Forms, HubSpot, etc.) when ready. */

document.addEventListener('DOMContentLoaded', () => {
  const forms = document.querySelectorAll('form.lead-form');

  forms.forEach((form) => {
    // Set min on the fitting date to today
    const fittingInput = form.querySelector('input[name="fitting_date"]');
    if (fittingInput) {
      const today = new Date().toISOString().split('T')[0];
      fittingInput.setAttribute('min', today);
    }
    const eventInput = form.querySelector('input[name="event_date"]');
    if (eventInput) {
      const today = new Date().toISOString().split('T')[0];
      eventInput.setAttribute('min', today);
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      const source = form.dataset.source || 'unknown';
      const formData = new FormData(form);
      const payload = Object.fromEntries(formData.entries());
      payload.source = source;
      // TODO: replace with real backend POST (fetch to Formspree/Netlify/HubSpot endpoint).
      // eslint-disable-next-line no-console
      console.log('[GA Suit Warehouse lead]', payload);

      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending…';
      }

      // Small delay so the redirect feels intentional, not instant
      setTimeout(() => {
        window.location.href = `/thank-you.html?source=${encodeURIComponent(source)}`;
      }, 350);
    });
  });
});
