/* GA Suit Warehouse — homepage quiz funnel.
   Step 1: occasion (Wedding routes to /weddings.html, all else to /suits.html).
   Step 2: timing (passed through as ?timing=...).
   Renders into [data-quiz-root]. */

(function () {
  const STEPS = [
    {
      id: 'occasion',
      question: "What's your occasion?",
      options: [
        { value: 'wedding',      label: 'Wedding',          icon: 'rings' },
        { value: 'professional', label: 'Work',             icon: 'briefcase' },
        { value: 'prom',         label: 'Prom',             icon: 'star' },
        { value: 'other',        label: 'Something else',   icon: 'sparkle' },
      ],
    },
    {
      id: 'timing',
      question: 'How soon do you need it?',
      options: [
        { value: 'asap',          label: 'ASAP',              icon: 'flame' },
        { value: '1-2-weeks',     label: 'Within 1–2 weeks',  icon: 'calendar' },
        { value: '3-4-weeks',     label: 'In 3–4 weeks',      icon: 'clock' },
        { value: '2-plus-months', label: '2+ months',         icon: 'horizon' },
      ],
    },
  ];

  const ICONS = {
    rings: '<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><circle cx="24" cy="40" r="14" stroke="currentColor" stroke-width="2.5"/><circle cx="40" cy="40" r="14" stroke="currentColor" stroke-width="2.5"/><path d="M22 18 L24 10 L26 18 Z" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" fill="currentColor"/><path d="M38 18 L40 10 L42 18 Z" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" fill="currentColor"/></svg>',
    briefcase: '<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><rect x="10" y="22" width="44" height="32" rx="2" stroke="currentColor" stroke-width="2.5"/><path d="M22 22 V16 a4 4 0 0 1 4-4 h12 a4 4 0 0 1 4 4 V22" stroke="currentColor" stroke-width="2.5"/><line x1="10" y1="36" x2="54" y2="36" stroke="currentColor" stroke-width="2.5"/><rect x="28" y="32" width="8" height="6" rx="1" fill="currentColor"/></svg>',
    star: '<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M14 28 L24 32 L20 42 L32 38 L44 42 L40 32 L50 28 L40 24 L44 14 L32 18 L20 14 L24 24 Z" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" fill="currentColor" fill-opacity="0.1"/><circle cx="32" cy="29" r="3" fill="currentColor"/></svg>',
    sparkle: '<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M32 12 L36 28 L52 32 L36 36 L32 52 L28 36 L12 32 L28 28 Z" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" fill="currentColor" fill-opacity="0.1"/></svg>',
    flame: '<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M32 8 C 28 18, 18 22, 18 36 a14 14 0 1 0 28 0 c 0 -8 -6 -12 -8 -20 -2 6 -6 8 -6 14 0 -8 -2 -14 0 -22 Z" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" fill="currentColor" fill-opacity="0.08"/></svg>',
    calendar: '<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><rect x="10" y="14" width="44" height="40" rx="2" stroke="currentColor" stroke-width="2.5"/><line x1="10" y1="26" x2="54" y2="26" stroke="currentColor" stroke-width="2.5"/><line x1="20" y1="10" x2="20" y2="20" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><line x1="44" y1="10" x2="44" y2="20" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><circle cx="22" cy="38" r="2.5" fill="currentColor"/><circle cx="32" cy="38" r="2.5" fill="currentColor"/><circle cx="42" cy="38" r="2.5" fill="currentColor"/></svg>',
    clock: '<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><circle cx="32" cy="32" r="22" stroke="currentColor" stroke-width="2.5"/><path d="M32 16 V32 L44 38" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    horizon: '<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><circle cx="32" cy="42" r="14" stroke="currentColor" stroke-width="2.5"/><line x1="6" y1="42" x2="58" y2="42" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><line x1="32" y1="14" x2="32" y2="22" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><line x1="16" y1="20" x2="22" y2="26" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><line x1="48" y1="20" x2="42" y2="26" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>',
  };

  function escapeAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  function renderProgress(currentIdx) {
    return STEPS.map((_, i) => {
      const cls = i < currentIdx ? 'dot is-done' : i === currentIdx ? 'dot is-active' : 'dot';
      return `<span class="${cls}" aria-hidden="true"></span>`;
    }).join('') + `<span aria-live="polite">Step ${currentIdx + 1} of ${STEPS.length}</span>`;
  }

  function renderStep(step, stepIdx) {
    const opts = step.options.map((o) => `
      <li>
        <button
          type="button"
          class="quiz-option"
          data-action="answer"
          data-step="${escapeAttr(step.id)}"
          data-value="${escapeAttr(o.value)}"
          aria-label="${escapeAttr(o.label)}"
        >
          <span class="quiz-option-icon">${ICONS[o.icon] || ''}</span>
          <span class="quiz-option-label">${escapeAttr(o.label)}</span>
        </button>
      </li>
    `).join('');

    const back = stepIdx > 0
      ? `<button type="button" class="quiz-back" data-action="back" aria-label="Back to previous question">
           <span aria-hidden="true">‹</span> Back
         </button>`
      : '';

    return `
      <div class="quiz-step is-active" data-step-id="${escapeAttr(step.id)}">
        <h3 class="quiz-question">${escapeAttr(step.question)}</h3>
        <ul class="quiz-options">${opts}</ul>
        ${back ? `<div class="quiz-step-footer">${back}</div>` : ''}
      </div>
    `;
  }

  function routeFor(answers) {
    const occasion = answers.occasion;
    const timing = answers.timing;
    const base = occasion === 'wedding' ? '/weddings.html' : '/suits.html';
    const params = new URLSearchParams();
    if (occasion) params.set('occasion', occasion);
    if (timing) params.set('timing', timing);
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }

  function mount(root) {
    const state = { stepIdx: 0, answers: {} };

    const progressEl = document.createElement('div');
    progressEl.className = 'quiz-progress';
    const stageEl = document.createElement('div');
    stageEl.className = 'quiz-stage';

    root.innerHTML = '';
    root.append(progressEl, stageEl);

    const paint = () => {
      progressEl.innerHTML = renderProgress(state.stepIdx);
      stageEl.innerHTML = renderStep(STEPS[state.stepIdx], state.stepIdx);
    };

    paint();

    root.addEventListener('click', (event) => {
      const target = event.target.closest('[data-action]');
      if (!target || !root.contains(target)) return;
      const action = target.dataset.action;

      if (action === 'answer') {
        const stepId = target.dataset.step;
        const value = target.dataset.value;
        const nextAnswers = { ...state.answers, [stepId]: value };
        const isLast = state.stepIdx >= STEPS.length - 1;

        target.classList.add('is-selected');

        if (isLast) {
          state.answers = nextAnswers;
          window.location.href = routeFor(state.answers);
          return;
        }

        // Brief visual confirmation, then advance
        window.setTimeout(() => {
          state.answers = nextAnswers;
          state.stepIdx += 1;
          paint();
        }, 220);
      }

      if (action === 'back') {
        if (state.stepIdx === 0) return;
        state.stepIdx -= 1;
        paint();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const root = document.querySelector('[data-quiz-root]');
    if (root) mount(root);
  });
})();
