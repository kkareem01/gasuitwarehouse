/* GA Suit Warehouse — booking calendar (step 3).
   Renders the month grid, slot list, timezone selector, and urgency countdown.
   Slot times come from server in store-local time and are displayed in user-tz. */

(function () {
  const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const COMMON_TZ = [
    'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'America/Anchorage', 'Pacific/Honolulu',
    'America/Toronto', 'America/Vancouver',
    'Europe/London', 'Europe/Berlin', 'Europe/Paris',
    'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Australia/Sydney',
  ];

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function todayInfo() {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1, date: d.toISOString().slice(0, 10) };
  }

  function buildTzList(currentTz) {
    const set = new Set([currentTz, ...COMMON_TZ]);
    let supported = [];
    if (typeof Intl.supportedValuesOf === 'function') {
      try { supported = Intl.supportedValuesOf('timeZone'); } catch (_) { supported = []; }
    }
    if (supported.length === 0) return Array.from(set);
    return supported;
  }

  function formatTzLabel(tz, refDate) {
    try {
      const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        timeZoneName: 'shortOffset',
      });
      const parts = fmt.formatToParts(refDate);
      const off = parts.find((p) => p.type === 'timeZoneName')?.value || '';
      return `${tz.replace('_', ' ')} (${off})`;
    } catch (_) {
      return tz;
    }
  }

  /**
   * Convert a store-local wall-clock time to the user's selected tz for display.
   * @returns 'HH:MM' in user-tz
   */
  function convertSlotToUserTz(date, time, storeTz, userTz) {
    if (storeTz === userTz) return time;
    const [y, m, d] = date.split('-').map(Number);
    const [hh, mm] = time.split(':').map(Number);
    // Build a UTC instant assuming the wall-clock is in storeTz.
    const asIfUtc = new Date(Date.UTC(y, m - 1, d, hh, mm, 0));
    const offMinStore = tzOffsetMinutes(storeTz, asIfUtc);
    const realUtc = new Date(asIfUtc.getTime() - offMinStore * 60 * 1000);
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: userTz, hour: '2-digit', minute: '2-digit', hour12: false,
    });
    const parts = Object.fromEntries(fmt.formatToParts(realUtc).map((p) => [p.type, p.value]));
    const h = parts.hour === '24' ? '00' : parts.hour;
    return `${h}:${parts.minute}`;
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

  function format12h(time) {
    const [h, m] = time.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${String(m).padStart(2, '0')} ${period}`;
  }

  function formatDateLong(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
    });
  }

  function buildCalendarHtml(state, monthData, locked) {
    const { year, month } = state.monthCursor;
    const today = todayInfo();
    const isCurMonth = year === today.year && month === today.month;
    const canPrev = !(year < today.year || (year === today.year && month <= today.month));

    const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    const daysCount = new Date(Date.UTC(year, month, 0)).getUTCDate();

    const monthMap = new Map((monthData?.days || []).map((d) => [d.date, d]));

    const cells = [];
    for (let i = 0; i < firstDow; i++) cells.push('<div class="booking-calendar__day booking-calendar__day--blank"></div>');
    for (let d = 1; d <= daysCount; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const past = dateStr < today.date;
      const meta = monthMap.get(dateStr);
      const isOpen = meta?.hasOpenSlots;
      let cls = 'booking-calendar__day';
      let attrs = '';
      if (past) {
        cls += ' booking-calendar__day--past';
      } else if (!isOpen) {
        cls += ' booking-calendar__day--closed';
      } else {
        cls += ' booking-calendar__day--open';
        attrs = `data-action="select-day" data-date="${dateStr}"`;
      }
      if (state.selectedDate === dateStr) cls += ' booking-calendar__day--selected';
      cells.push(`<button type="button" class="${cls}" ${attrs}>${d}</button>`);
    }

    return `
      <div class="booking-calendar ${locked ? 'is-locked' : ''}">
        ${locked ? `<div class="booking-calendar__lock"><div class="booking-calendar__lock-pill">Please fill out the form before choosing your time slot.</div></div>` : ''}

        ${locked ? '' : `
        <div class="booking-calendar__tz">
          <span>Time zone:</span>
          <select data-action="change-timezone" aria-label="Time zone">
            ${buildTzList(state.timezone).map((tz) => `<option value="${tz}" ${tz === state.timezone ? 'selected' : ''}>${escapeHtml(formatTzLabel(tz, new Date()))}</option>`).join('')}
          </select>
        </div>`}

        <div class="booking-calendar__header">
          <div class="booking-calendar__month">${MONTH_NAMES[month - 1]} ${year}</div>
          <div class="booking-calendar__nav">
            <button type="button" data-action="change-month" data-delta="-1" ${!canPrev ? 'disabled' : ''} aria-label="Previous month">‹</button>
            <button type="button" data-action="change-month" data-delta="1" aria-label="Next month">›</button>
          </div>
        </div>

        <div class="booking-calendar__weekdays">
          ${WEEKDAYS.map((w) => `<div class="booking-calendar__weekday">${w}</div>`).join('')}
        </div>
        <div class="booking-calendar__grid">
          ${cells.join('')}
        </div>
      </div>
    `;
  }

  function buildSlotsHtml(state, daySlots, storeTz) {
    if (!state.selectedDate) {
      return `<div class="booking-slots"><div class="booking-slots__empty">Pick a date to see available times.</div></div>`;
    }
    const open = (daySlots || []).filter((s) => s.available);
    return `
      <div class="booking-slots">
        <div class="booking-slots__header">
          <div class="booking-slots__date">${formatDateLong(state.selectedDate)}</div>
          <div class="booking-slots__toggle" role="group" aria-label="Time format">
            <button type="button" data-action="toggle-timeformat" data-format="12h" class="${state.timeFormat === '12h' ? 'is-active' : ''}">12h</button>
            <button type="button" data-action="toggle-timeformat" data-format="24h" class="${state.timeFormat === '24h' ? 'is-active' : ''}">24h</button>
          </div>
        </div>
        ${open.length === 0
          ? '<div class="booking-slots__empty">No times available on this date. Try another day.</div>'
          : `<div class="booking-slots__list">${open.map((s) => {
              const userTime = convertSlotToUserTz(state.selectedDate, s.time, storeTz, state.timezone);
              const label = state.timeFormat === '24h' ? userTime : format12h(userTime);
              const sel = state.selectedTime === s.time ? ' is-selected' : '';
              return `<button type="button" class="booking-slots__item${sel}" data-action="select-slot" data-time="${s.time}">${label}</button>`;
            }).join('')}</div>`
        }
        ${state.selectedTime ? `
          <div class="booking-confirm-bar">
            <button type="button" class="btn btn-primary" data-action="confirm-booking" ${state.submitting ? 'disabled' : ''}>
              ${state.submitting ? 'Booking…' : 'Confirm booking'}
            </button>
          </div>` : ''}
      </div>
    `;
  }

  function buildUrgencyHtml(remainingSec, soft) {
    const m = Math.floor(remainingSec / 60);
    const s = remainingSec % 60;
    const time = `${m}:${String(s).padStart(2, '0')}`;
    if (soft) {
      return `<div class="booking-urgency is-soft">
        <span>Slots are limited — please confirm soon.</span>
        <span class="booking-urgency__count">—:—</span>
      </div>`;
    }
    return `<div class="booking-urgency">
      <span>Only a few slots are left. Book now to secure your session.</span>
      <span class="booking-urgency__count">${time}</span>
    </div>`;
  }

  window.BookingCalendar = {
    buildCalendarHtml,
    buildSlotsHtml,
    buildUrgencyHtml,
    convertSlotToUserTz,
    format12h,
    formatDateLong,
    todayInfo,
  };
})();
