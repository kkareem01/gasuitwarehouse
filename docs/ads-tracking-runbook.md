# Google Ads Tracking & CAC — Owner Setup Runbook

The site now captures ad attribution (gclid/UTM) on every lead and booking,
fires a **"Booked appointment"** conversion when someone books, and serves a
daily **store-sale conversion feed** to Google Ads so Smart Bidding can
optimize toward real revenue. The staff dashboard records purchase amounts
and computes CAC/AOV on `/staff/stats.html`.

Everything site-side is deployed. The steps below are the **one-time
Google-side setup** you must do yourself (≈30 minutes).

---

## 1. Create a GA4 property (~5 min)

1. Go to [analytics.google.com](https://analytics.google.com) → Admin → **Create property**.
2. Name: `GA Suit Warehouse`, timezone `United States — Eastern`, currency USD.
3. Add a **Web** data stream for `https://www.gasuitwarehouse.com`.
4. Copy the **Measurement ID** — looks like `G-XXXXXXXXXX`.

## 2. Create the two conversion actions in Google Ads (~10 min)

In [ads.google.com](https://ads.google.com) → **Goals → Conversions** (or Tools → Data manager, depending on UI version):

**A. "Booked appointment"** (fires from the website when someone books)
1. New conversion action → **Website** → enter the site URL.
2. Choose **Add a conversion action manually**:
   - Goal category: **Book appointment**
   - Name: `Booked appointment`
   - Value: "Don't use a value" (real revenue arrives via the sale upload) — or a fixed proxy like $50 if you prefer every booking to carry weight.
   - Count: **One** per click.
3. After saving, open the action → **Tag setup → Use Google tag** → copy:
   - the **Conversion ID** (`AW-XXXXXXXXXX`), and
   - the **Conversion label** (the short code after the `/`).

**B. "Store sale"** (uploaded from your sales records)
1. New conversion action → **Import → Conversions from clicks** (upload/scheduled source).
2. Name it exactly **`store_sale`** — the feed uses this name; if it doesn't match, uploads fail.
3. Value: **Use the value from the import**, currency USD.
4. Count: **One**. Click-through conversion window: **90 days**.

## 3. Confirm auto-tagging is ON (~1 min)

Google Ads → Admin/Settings → Account settings → **Auto-tagging** → "Tag the URL that people click through from my ad" must be **enabled**. This is what appends the `gclid` the whole pipeline keys off.

## 4. Link GA4 ↔ Google Ads (~2 min)

GA4 Admin → **Product links → Google Ads links** → link your Ads account.
Optionally mark the `book_appointment` event as a key event in GA4.

## 5. Paste the three IDs into the site (~2 min)

Edit [`assets/js/analytics.js`](../assets/js/analytics.js) — the three constants at the top:

```js
const GA4_ID = 'G-XXXXXXXXXX';                        // from step 1
const ADS_ID = 'AW-XXXXXXXXXX';                       // from step 2A
const BOOKING_CONV_LABEL = 'AW-XXXXXXXXXX/XxXxXxXx';  // ID/label from step 2A
```

Deploy. Until these are set, the site still captures gclid/UTM data (nothing
is lost) — it just doesn't fire the Google tags yet.

## 6. Set the Vercel environment variables (~2 min)

Vercel dashboard → project → Settings → Environment Variables:

| Variable | Value |
|---|---|
| `STAFF_TOKEN` | random string, 16+ chars — **required or the staff dashboard gets locked out (401)** |
| `ADS_FEED_USER` | random string, 16+ chars |
| `ADS_FEED_PASS` | random string, 16+ chars |

Generate values with: `openssl rand -hex 24`. Redeploy after adding.

> After `STAFF_TOKEN` is set, each staff device will be prompted once for the
> token on the dashboard; paste it and it's remembered on that device.

## 7. Schedule the daily conversion upload in Google Ads (~5 min)

Google Ads → Tools → **Data manager** → the `store_sale` import source → **Schedules**:

- Source: **HTTPS**
- URL: `https://www.gasuitwarehouse.com/feeds/ads-conversions.csv`
- Username: value of `ADS_FEED_USER` · Password: value of `ADS_FEED_PASS`
- Frequency: **Daily** (any time; sales upload within ~24h of being recorded)

Run **"Upload preview"** — it should connect and show either rows or "no
conversions found" (normal until the first recorded sale from an ad click).

## 8. End-to-end test (~5 min)

1. On your phone (or private window) visit:
   `https://www.gasuitwarehouse.com/?gclid=TEST_RUNBOOK_1&utm_source=google&utm_medium=cpc`
2. Book a test appointment.
3. In `/staff/intakes.html` → Appointments: mark it **Closed** → the sale
   box pops up → enter e.g. `$412`.
4. Fetch the feed yourself:
   `curl -u "$ADS_FEED_USER:$ADS_FEED_PASS" https://www.gasuitwarehouse.com/feeds/ads-conversions.csv`
   — you should see the `TEST_RUNBOOK_1` row with `412.00`.
5. Delete the test appointment from the dashboard afterward.
6. Within a couple of days check Google Ads → conversion diagnostics; the
   "Booked appointment" tag also shows in GA4 Realtime when a booking fires.

---

## How to use it day-to-day

- **When an appointment happens**: record the outcome — **No-show** (didn't
  come), **Showed** (came in but didn't buy), or **Closed** (came in and
  bought). On Closed, the sale box opens — type the exact amount. You can
  click any row's Sale chip later to add or fix an amount.
- **Once a month**: `/staff/stats.html` → Revenue & CAC → type that month's
  Google Ads spend → Save. CAC = spend ÷ customers, AOV = revenue ÷ customers,
  and **LTV:CAC** = AOV ÷ CAC (above 3:1 healthy, below 1:1 losing money).
  The ratio is only as accurate as the sale amounts — enter one for every
  Closed appointment.

## Things to know (limits)

- **Record sale amounts the same day.** Google fetches nightly and treats a
  row as one conversion keyed by click + time. Editing an amount *after*
  Google has already imported it will NOT update Google — fix those manually
  in Google Ads (conversion adjustments) if the difference matters.
- **Only gclid clicks feed back.** Some iOS traffic arrives with
  `gbraid`/`wbraid` instead of `gclid` — we store those (future-proofing) but
  the CSV upload format can't carry them, so those sales won't get ad credit.
- **Cross-device gap:** someone who clicks the ad on their phone but books on
  a laptop loses attribution — inherent to this (API-free) setup.
- **Walk-in purchases are not tracked** (by design — no ad click means no
  accurate attribution). Revenue, CAC, and AOV cover booked appointments only.
- The **phone number clicks** on the site are tracked as a GA4 `phone_call`
  event. For call conversions from ads themselves, enable call reporting on
  your Google Ads call assets (Google forwarding numbers) — that's ad-side,
  no site change needed.
