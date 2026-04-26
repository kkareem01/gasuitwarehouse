# GA Suit Warehouse — Conversion Funnel + Booking System

Static funnel (main page → 4 audience landing pages → multi-step booking → confirmation page) with Node.js API handlers that handle slot availability, booking storage (libSQL/Turso), and transactional email via Resend.

The same handler code runs in two places:
- **Local development** — via `server.mjs` (HTTP server + static files)
- **Production** — via Vercel serverless functions in `/api/*`

---

## Quick start (local development)

You need **Node.js 20.6 or newer** (for the built-in `--env-file` flag).

```bash
node --version   # must be v20.6+
```

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Defaults are set up for **fully local dev**:
- `TURSO_DATABASE_URL=file:local.db` — uses an on-disk SQLite file, no internet required
- `DRY_RUN_EMAIL=true` — emails are written to `tmp/last-email.html` instead of sent

You can leave the Resend / Turso production values blank for local dev.

### 3. Create database tables

```bash
npm run migrate
```

(Idempotent — safe to re-run any time.)

### 4. Run

```bash
npm start
# → http://localhost:3000
```

Visit `http://localhost:3000/weddings.html`, scroll to the booking section, and walk the flow. Bookings are stored in `local.db` (SQLite, gitignored).

### 5. Run unit tests (optional)

```bash
npm test
```

---

## Deploy to production (Vercel + Turso + Resend, all free tiers)

### One-time setup

#### A. Create your Turso database

1. Sign up at <https://turso.tech> with GitHub.
2. Click **Create Database**. Name: `gasuitwarehouse`. Region: **US East (atl)**.
3. Open the database, copy the **URL** (`libsql://...turso.io`) and **generate a token**. Save both — you'll paste them into Vercel.

#### B. Verify your sending domain in Resend

1. Sign up at <https://resend.com>.
2. **Domains → Add Domain** → enter `gasuitwarehouse.com`.
3. Add the DNS records Resend gives you to your DNS provider. Wait until Resend marks the domain **Verified** (usually < 1 hour).
4. Create an API key (**API Keys → Create**). Copy it.

#### C. Connect Vercel to GitHub

1. Sign up at <https://vercel.com> with GitHub.
2. **Add New… → Project** → import `gasuitwarehouse` repo.
3. **Framework Preset:** `Other`. **Build Command:** leave blank. **Output Directory:** leave blank.
4. **Environment Variables** — add the following:

   | Key | Value |
   |---|---|
   | `TURSO_DATABASE_URL` | `libsql://gasuitwarehouse-yourname.turso.io` |
   | `TURSO_AUTH_TOKEN` | (the token from Turso) |
   | `RESEND_API_KEY` | `re_...` (from Resend) |
   | `FROM_EMAIL` | `bookings@gasuitwarehouse.com` (must be on verified domain) |
   | `OWNER_EMAIL` | where you want booking notifications |
   | `BUSINESS_NAME` | `GA Suit Warehouse` |
   | `BUSINESS_ADDRESS` | `150 Pearl Nix Pkwy, Gainesville GA 30501` |
   | `BUSINESS_PHONE` | `+14705957775` |
   | `SITE_URL` | `https://gasuitwarehouse.com` (or your Vercel URL while testing) |

5. Click **Deploy**.

#### D. Run the database migration once

After the first successful deploy, run from your laptop:

```bash
TURSO_DATABASE_URL=libsql://...turso.io \
TURSO_AUTH_TOKEN=eyJhbGc... \
node scripts/migrate.mjs
```

(One-time. The schema is tiny and stable, so you'll rarely re-run.)

#### E. Connect your custom domain

1. In Vercel project → **Settings → Domains** → add `gasuitwarehouse.com`.
2. Vercel will display the exact DNS records you need (typically an `A` record for the apex and a `CNAME` for `www`).
3. Add those records to your DNS provider. Wait ~15 min for propagation.

### Future updates

```bash
git push
```

Vercel auto-deploys in ~30 seconds.

---

## Managing the booking system

### Change business hours, blackout dates, slot duration

Edit `data/config.json` and commit + push. Vercel re-deploys automatically. Schema:

```jsonc
{
  "storeTimezone": "America/New_York",
  "businessHours": {
    "mon": { "open": "10:00", "close": "19:00" },
    // ... per day. Use null for closed days.
  },
  "blackoutDates": ["2026-12-25", "2026-12-26"],
  "defaultSlotDurationMinutes": 20,
  "fittingTypes": {
    "weddings":      { "label": "Wedding fitting",      "slotDurationMinutes": 30, "buffer": 5 },
    "prom":          { "label": "Prom fitting",         "slotDurationMinutes": 20, "buffer": 5 },
    "professionals": { "label": "Professional fitting", "slotDurationMinutes": 30, "buffer": 5 },
    "other":         { "label": "Styling session",      "slotDurationMinutes": 20, "buffer": 5 }
  },
  "urgencyTimerSeconds": 156,
  "leadTimeMinutes": 120,
  "maxAdvanceDays": 90
}
```

### View / manage bookings

Open the Turso dashboard (or run `turso db shell gasuitwarehouse` if you install the Turso CLI) and query:

```sql
SELECT id, audience, slot_date, slot_time, customer_json FROM bookings ORDER BY created_at DESC LIMIT 50;
```

To free a slot, delete the row:

```sql
DELETE FROM bookings WHERE id = 'BK-ABCD1234';
```

### Per-audience qualifying questions

Step 2 questions live in two places that **must stay in sync**:
- `assets/js/booking-form.js` — `FIELD_SCHEMAS` (rendered to the user)
- `lib/audiences.mjs` — `FIELD_SCHEMAS` (server-side validation)

The local server logs a warning at boot if it detects drift.

---

## File map

```
api/                            Vercel serverless functions (one file per route)
├── config.mjs                  GET  /api/config
├── availability.mjs            GET  /api/availability
├── availability/month.mjs      GET  /api/availability/month
├── leads.mjs                   POST /api/leads
├── bookings.mjs                POST /api/bookings
├── bookings/[id].mjs           GET  /api/bookings/:id
└── bookings/[id]/ics.mjs       GET  /api/bookings/:id/ics

server.mjs                      Local dev server (static + /api routes)
package.json                    Dependencies + npm scripts
vercel.json                     Vercel config
.env.example                    Copy to .env and fill in

data/
└── config.json                 Hours, blackouts, slot durations (source-controlled)

lib/
├── handlers.mjs                Shared API handler functions (used by server.mjs and /api/*)
├── db.mjs                      libSQL client singleton
├── migrate.mjs                 Schema definitions
├── store.mjs                   SQL-backed bookings + leads repository
├── slots.mjs                   Pure slot generation (DST-safe)
├── audiences.mjs               Per-audience field schema (mirrors frontend)
├── validate.mjs                Phone/email/payload validators
├── ics.mjs                     Hand-rolled .ics calendar invite builder
├── email.mjs                   Resend HTTP wrapper + email templates
├── id.mjs                      BK-XXXXXXXX / LD-XXXXXXXX generators
└── log.mjs                     Console logging w/ PII redaction

scripts/
└── migrate.mjs                 Runner: `npm run migrate`

tests/
└── run.mjs                     Plain-Node unit tests (no framework)

assets/
├── css/styles.css
├── js/booking-form.js, booking-calendar.js, booking.js, booking-confirmed.js, components.js
├── img/                        favicon + photos
└── reviews/                    Google review screenshots

index.html, weddings.html, prom.html, professionals.html, other.html
booking-confirmed.html          Post-booking confirmation (reads ?id= from URL)
```

---

## API surface

All endpoints under `/api`. JSON in/out. Envelope: `{ ok, data?, error?, code? }`.

| Method | Path | Use |
|---|---|---|
| GET    | `/api/config` | Public-safe schedule config |
| GET    | `/api/availability/month?year=&month=&audience=` | Per-day open/closed flags |
| GET    | `/api/availability?date=&audience=` | Slot list for a single date |
| POST   | `/api/leads` | Step-1 partial capture |
| POST   | `/api/bookings` | Create a booking (race-safe, fires emails) |
| GET    | `/api/bookings/:id` | Fetch booking detail |
| GET    | `/api/bookings/:id/ics` | Download `.ics` calendar invite |

Spam mitigation on `POST /api/bookings`: honeypot field, 4-second submit floor, and per-instance 5-bookings-per-IP-per-hour rate limit.

---

## NAP (do not change without updating Google Business Profile)

- **Name:** GA Suit Warehouse
- **Address:** 150 Pearl Nix Pkwy, Gainesville GA 30501
- **Phone:** (470) 595-7775

---

## Operational notes

- **Concurrency.** Slot uniqueness is enforced by a `UNIQUE(slot_date, slot_time)` constraint at the DB level. Two simultaneous bookings at the same time slot will see exactly one succeed; the loser gets `SLOT_TAKEN` (HTTP 409).
- **Backups.** Turso supports point-in-time restore on the free tier. For belt-and-suspenders: `turso db shell gasuitwarehouse ".dump" > backup-$(date +%F).sql` periodically.
- **PII.** Logs redact phone (`(***) ***-1234`) and email (`j***@example.com`). The `bookings` and `leads` tables contain raw PII.
- **Timezone.** All slots are stored as wall-clock + IANA timezone (default `America/New_York`). DST handled automatically by Node's `Intl`.
- **Cold starts.** Vercel functions warm up after the first request post-idle (~5 min). First booking of the morning may take an extra second.
