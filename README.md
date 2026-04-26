# GA Suit Warehouse — Conversion Funnel + Booking System

Static funnel (main page → 4 audience landing pages → multi-step booking → confirmation page) with a small Node.js backend that handles slot availability, booking storage, and transactional email via Resend.

## Quick start

### 1. Install nothing (no `npm install` required — uses Node built-ins only)

You need **Node.js 20.6 or newer** (for the built-in `--env-file` flag).

```bash
node --version   # must be v20.6+
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and at minimum set:
- `RESEND_API_KEY` — get one free at <https://resend.com>
- `OWNER_EMAIL` — where booking notifications are sent (your inbox)
- `FROM_EMAIL` — the address bookings are sent from (must be on a domain you've verified in Resend)

For local development, leave `DRY_RUN_EMAIL=true` — bookings will work end-to-end but emails are written to `tmp/last-email.html` instead of being sent.

### 3. Run

```bash
node --env-file=.env server.mjs
# → http://localhost:3000
```

That's it. Visit `http://localhost:3000/weddings.html`, scroll to the booking section, and walk the flow. Bookings are stored in `data/bookings.json` (created on first booking).

### 4. Run unit tests (optional)

```bash
node tests/run.mjs
```

---

## Email setup (production)

Resend won't deliver from an unverified domain. Before going live:

1. In the [Resend dashboard](https://resend.com/domains), add your sending domain (e.g. `gasuitwarehouse.com`).
2. Add the DNS records Resend gives you to your DNS provider:
   - **SPF** — TXT record: `v=spf1 include:_spf.resend.com ~all`
   - **DKIM** — three CNAME records that Resend supplies (e.g. `resend._domainkey`, plus two more)
   - **DMARC** — TXT record at `_dmarc`: `v=DMARC1; p=none; rua=mailto:dmarc@gasuitwarehouse.com`
3. Wait for Resend to mark the domain "Verified" (usually within 1 hour).
4. Set `FROM_EMAIL=bookings@gasuitwarehouse.com` (or whatever address on the verified domain).
5. Set `DRY_RUN_EMAIL=false` (or remove the line).
6. Book yourself with a real address — confirmation should land in your inbox within 30 seconds.

Tip: star the very first owner-notification email so future ones don't go to spam.

---

## Managing the booking system

### Change business hours, add blackout dates, change slot duration

Edit `data/config.json` and restart the server. Schema:

```jsonc
{
  "storeTimezone": "America/New_York",
  "businessHours": {
    "mon": { "open": "10:00", "close": "19:00" },
    "tue": { "open": "10:00", "close": "19:00" },
    // ... per day. Use null for closed days.
  },
  "blackoutDates": ["2026-12-25", "2026-12-26"],   // YYYY-MM-DD
  "defaultSlotDurationMinutes": 20,
  "fittingTypes": {
    "weddings":      { "label": "Wedding fitting",      "slotDurationMinutes": 30, "buffer": 5 },
    "prom":          { "label": "Prom fitting",         "slotDurationMinutes": 20, "buffer": 5 },
    "professionals": { "label": "Professional fitting", "slotDurationMinutes": 30, "buffer": 5 },
    "other":         { "label": "Styling session",      "slotDurationMinutes": 20, "buffer": 5 }
  },
  "urgencyTimerSeconds": 156,                       // step-3 countdown
  "leadTimeMinutes": 120,                           // can't book < 2hr out
  "maxAdvanceDays": 90                              // can't book > 3mo out
}
```

### View bookings

```bash
cat data/bookings.json | python3 -m json.tool
```

### Manually free a slot

Open `data/bookings.json` in any editor, delete the booking object, save. Restart not required — the server reads the file on each request.

### Per-audience qualifying questions

The questions asked in step 2 of the form (e.g. "What's your role?", "Wedding date") live in two places that **must stay in sync**:
- `assets/js/booking-form.js` — `FIELD_SCHEMAS` (rendered to the user)
- `lib/audiences.mjs` — `FIELD_SCHEMAS` (server-side validation)

The server logs a warning at boot if it detects drift between the two.

---

## File map

```
server.mjs                      Node HTTP server: static + /api routes
.env.example                    Copy to .env and fill in
.gitignore                      Excludes secrets, runtime data, tmp/

data/
├── config.json                 Hours, blackouts, slot durations (source-controlled)
├── bookings.json               Created on first booking (gitignored)
└── leads.json                  Step-1 partial captures (gitignored)

lib/
├── store.mjs                   Booking repository: mutex + atomic writes
├── slots.mjs                   Pure slot generation (DST-safe)
├── audiences.mjs               Per-audience field schema (mirrors frontend)
├── validate.mjs                Phone/email/payload validators
├── ics.mjs                     Hand-rolled .ics calendar invite builder
├── email.mjs                   Resend HTTP wrapper + email templates
├── id.mjs                      BK-XXXXXXXX / LD-XXXXXXXX generators
└── log.mjs                     Console logging w/ PII redaction

tests/
└── run.mjs                     Plain-Node unit tests (no framework)

assets/
├── css/styles.css              Single shared stylesheet (booking section appended)
├── js/
│   ├── components.js           Nav + footer injector, FAQ accordion, scroll reveals
│   ├── form.js                 (deprecated — leftover from pre-booking; safe to ignore)
│   ├── booking-form.js         Steps 1+2 renderer, FIELD_SCHEMAS
│   ├── booking-calendar.js     Calendar grid, slot list, tz, urgency banner
│   ├── booking.js              Entry point, state machine, API calls
│   └── booking-confirmed.js    Hydrates the confirmation page
├── img/                        favicon + future hero photos
└── reviews/                    Google review screenshots

index.html                      Main landing
weddings.html                   Audience: weddings  (data-audience="weddings")
prom.html                       Audience: prom
professionals.html              Audience: professionals
other.html                      Audience: other
booking-confirmed.html          Post-booking confirmation (Reads ?id= from URL)
thank-you.html                  Legacy generic thank-you (still present, unused by booking flow)
```

---

## API surface

All endpoints under `/api`. JSON in/out. Envelope: `{ ok, data?, error?, code? }`.

| Method | Path | Use |
|---|---|---|
| GET    | `/api/config` | Public-safe schedule config (hours, durations, urgency timer) |
| GET    | `/api/availability/month?year=&month=&audience=` | Per-day open/closed flags for the calendar |
| GET    | `/api/availability?date=&audience=` | Slot list for a single date |
| POST   | `/api/leads` | Step-1 partial capture (name + phone + consent) |
| POST   | `/api/bookings` | Create a booking (race-safe, fires emails) |
| GET    | `/api/bookings/:id` | Fetch booking detail (used by confirmation page) |
| GET    | `/api/bookings/:id/ics` | Download `.ics` calendar invite |

Spam mitigation on `POST /api/bookings`: honeypot field, 4-second submit floor, and 5-bookings-per-IP-per-hour rate limit (in-memory).

---

## NAP (do not change without updating Google Business Profile)

- **Name:** GA Suit Warehouse
- **Address:** 150 Pearl Nix Pkwy, Gainesville GA 30501
- **Phone:** (470) 595-7775

---

## Operational notes

- **Single Node process only.** The mutex serializing booking writes is in-process; do not run multiple instances against the same `data/bookings.json` without first migrating to SQLite (the Repository interface in `lib/store.mjs` is shaped for a one-file swap).
- **Backups.** `data/bookings.json` is your booking ledger. Periodically: `cp data/bookings.json data/bookings.json.$(date +%F).bak`.
- **PII.** Logs redact phone (`(***) ***-1234`) and email (`j***@example.com`). `data/bookings.json` and `data/leads.json` contain raw PII and are gitignored.
- **Timezone.** All slots are stored as wall-clock + IANA timezone (default `America/New_York`). DST is handled automatically by Node's `Intl`.
