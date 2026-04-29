# SEO + GEO Audit — gasuitwarehouse.com

**Audit date:** 2026-04-28
**Site type:** Local business — single-location menswear / suit shop (Gainesville, GA)
**Primary goal:** Drive in-person fitting bookings (and phone calls)
**Pages audited (live + repo):** `/` (index), `/suits`, `/weddings`, `/booking-confirmed`, `/thank-you`
**Hosting:** Vercel (cleanUrls: true, trailingSlash: false)

---

## Executive Summary

### Overall scores

| Audit | Score | Grade |
|-------|------:|:-----:|
| Traditional SEO (technical + on-page + content) | **42 / 100** | D |
| GEO / AI Search Readiness | **28 / 100** | F |

### What's working

- Clean, fast, modern HTML on all 3 indexable pages — server-rendered, no JS-blocking content.
- Title tags and meta descriptions are unique per page, length-appropriate, and include the city.
- Strong on-page review proof (12+ Google review screenshots).
- NAP (name / address / phone) is consistent across pages and the footer.
- Booking + thank-you pages correctly carry `noindex`.

### The 5 things hurting you most

1. **No `robots.txt`, no `sitemap.xml`, no `llms.txt`** — all three return 404. Search engines and AI crawlers get zero guidance.
2. **No structured data anywhere** — no `LocalBusiness`, no `MensClothingStore`, no `FAQPage`, no `Product`, no `BreadcrumbList`. This is the #1 missed opportunity for a local suit shop.
3. **Reviews are screenshots, not text** — every Google review on every page is a PNG image, so the actual review copy isn't crawlable, isn't indexable, and is invisible to AI crawlers.
4. **No canonical tags on any page** — leaves you exposed to duplicate-content issues if your domain ever serves both `www.` and apex, or if URL parameters get appended by ads/UTMs.
5. **Phone number is not in plain text on the home page** — it's only injected by JavaScript via the footer. AI crawlers don't execute JS, so ChatGPT, Perplexity, etc. literally can't see your phone number.

### Quick wins (do this week)

| Fix | Impact | Effort |
|-----|--------|-------:|
| Add `robots.txt` + `sitemap.xml` | High | 15 min |
| Add `LocalBusiness` + `FAQPage` JSON-LD to homepage | High | 30 min |
| Add canonical tags to all 3 indexable pages | Medium | 5 min |
| Inline phone + address in HTML on every page (not JS-only) | High (GEO) | 20 min |
| Add `llms.txt` at the root | Medium (GEO) | 15 min |
| Transcribe top 3-5 Google reviews into plain text (alongside screenshots) | High (GEO) | 30 min |

---

## Site Context

**Business:** GA Suit Warehouse, LLC — family-owned suit shop at 150 Pearl Nix Pkwy, Gainesville, GA 30501. Phone: (470) 595-7775. Hours: Mon-Sat 10a-7p, Sun 12p-6p.

**Funnel architecture:**

```
/  (homepage, quiz hub)
├── /suits     → VSL + booking (general suits funnel)
└── /weddings  → wedding-specific copy + booking
        └── /thank-you, /booking-confirmed (noindex'd correctly)
```

**Primary keyword targets (inferred):**
- "suit store Gainesville GA"
- "men's suits Gainesville"
- "wedding suits Gainesville"
- "tuxedo Gainesville"
- "suit alterations Gainesville"
- "suit tailor Gainesville"

---

## 1. Technical SEO Findings

### 1.1 Crawlability — CRITICAL

| Asset | Status | Note |
|-------|:------:|------|
| `/robots.txt` | ❌ 404 | Not present |
| `/sitemap.xml` | ❌ 404 | Not present |
| `/llms.txt` | ❌ 404 | Not present |

**Issue:** No `robots.txt` and no `sitemap.xml`. Google will eventually crawl the site without these (you have only 3 indexable pages, so it's not catastrophic), but you lose the ability to:
- Submit a sitemap in Google Search Console + Bing Webmaster Tools
- Tell crawlers which pages to ignore (e.g., `/booking-confirmed`, `/thank-you`, `/api/*`)
- Provide a discovery hint for both search and AI crawlers

**Fix — create `/robots.txt`:**

```
User-agent: *
Allow: /
Disallow: /api/
Disallow: /booking-confirmed
Disallow: /thank-you

# AI search crawlers — explicitly allow
User-agent: GPTBot
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

# Block training crawlers (optional — keep if you don't want your content
# in training datasets, remove if you want maximum exposure)
User-agent: CCBot
Disallow: /

User-agent: anthropic-ai
Disallow: /

Sitemap: https://gasuitwarehouse.com/sitemap.xml
```

**Fix — create `/sitemap.xml`:**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://gasuitwarehouse.com/</loc>
    <lastmod>2026-04-28</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://gasuitwarehouse.com/suits</loc>
    <lastmod>2026-04-28</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://gasuitwarehouse.com/weddings</loc>
    <lastmod>2026-04-28</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
</urlset>
```

Add these as static files in the repo root — Vercel will serve them at `/robots.txt` and `/sitemap.xml` automatically.

### 1.2 Indexation — OK (with one fix)

| Page | Indexable? | Verdict |
|------|:----------:|---------|
| `/` (index.html) | ✅ Yes | Correct |
| `/suits` | ✅ Yes | Correct |
| `/weddings` | ✅ Yes | Correct |
| `/booking-confirmed` | 🚫 noindex,nofollow | Correct |
| `/thank-you` | 🚫 noindex | Correct |

**Issue:** No canonical tags on any page. The `vercel.json` has `cleanUrls: true` and `trailingSlash: false`, which is good — but Vercel's redirect from `/suits.html` → `/suits` only handles the `.html` case. URLs with parameters (e.g., `?utm_source=...` from your Vercel Analytics or any future ad campaigns) will look like new URLs without canonical hints.

**Fix — add to every indexable page `<head>`:**

```html
<!-- index.html -->
<link rel="canonical" href="https://gasuitwarehouse.com/" />

<!-- suits.html -->
<link rel="canonical" href="https://gasuitwarehouse.com/suits" />

<!-- weddings.html -->
<link rel="canonical" href="https://gasuitwarehouse.com/weddings" />
```

### 1.3 HTTPS / Security — OK

- HTTPS active across the site.
- Vercel manages the SSL certificate.
- No mixed content observed (all asset URLs are relative or HTTPS).

### 1.4 URL Structure — GOOD

- Clean, readable URLs (`/suits`, `/weddings`).
- No parameters, no query strings, no session IDs.
- `cleanUrls: true` strips `.html` correctly.
- Trailing slashes consistent (no trailing slash via `trailingSlash: false`).

### 1.5 Mobile — GOOD

- Single responsive codebase (no `m.` subdomain).
- `<meta name="viewport" content="width=device-width, initial-scale=1.0">` on every page.
- Mobile-specific hero image preloaded via `media="(max-width: 980px)"`.
- Hero models even have a separate `mobilemodels.webp` variant — strong mobile-first signal.

### 1.6 Core Web Vitals — LIKELY GOOD (verify in Search Console)

What I can see from the code:
- `fetchpriority="high"` on the LCP hero image. ✅
- Hero images preloaded with `<link rel="preload">`. ✅
- WebP variants for every photo (with JPG fallback via `<picture>`). ✅
- `loading="lazy"` on below-the-fold review screenshots. ✅
- `decoding="async"` set. ✅
- Non-critical scripts (`booking.js`, `components.js`, `mux-player`) are `defer`'d. ✅
- 1×1 transparent GIF placeholder on hero `<img>` to prevent layout shift while WebP loads. ✅

**Recommendation:** Verify actual numbers in Google Search Console → Core Web Vitals report and run `https://gasuitwarehouse.com` through PageSpeed Insights once `robots.txt` is in place. With this much front-end care, LCP / CLS / INP should all be in the green; if not, the most likely culprits are:
- Spectral + PT Serif font loading (you're loading 9 weights — consider trimming to 3-4)
- The Mux video on `/suits` page loading mid-fold

### 1.7 Image Optimization — VERY GOOD

- WebP with JPG fallback everywhere.
- Explicit `width` / `height` attributes prevent CLS.
- All non-decorative images have alt text.
- Decorative hero images correctly use `alt=""` + `aria-hidden="true"`.

**One small issue:** Review images all use the same alt-text pattern: "5-star Google review screenshot from [name]". This is technically fine but doesn't help search at all because the actual review copy (which is the SEO gold) is invisible to crawlers. See content section below.

---

## 2. On-Page SEO — Page by Page

### 2.1 Homepage (`/`)

| Element | Current | Verdict |
|---------|---------|:-------:|
| Title | "GA SuitWarehouse · Free Personalized Styling Sessions in Gainesville, GA" (87 chars) | ⚠️ Too long — truncates around char 60 in SERP |
| Meta description | "Get a free personalized styling session at GA SuitWarehouse..." (167 chars) | ⚠️ Slightly over 160 — borderline |
| H1 | "Do you want a suit?" | ⚠️ Cute, but zero keyword value |
| H2 count | 9 | ✅ Good structure |
| Canonical | Missing | ❌ |
| Schema | None | ❌ Critical miss for a local business |
| Word count | ~520 (visible body) | ⚠️ Thin for a homepage targeting "suit store Gainesville" |
| OG tags | Yes, but `og:image` is the favicon (low quality) | ⚠️ |

**Title fix (50-60 chars, keyword-led):**
```
Suit Store in Gainesville, GA · GA SuitWarehouse
```
or
```
Men's Suits, Tuxedos & Tailoring · Gainesville, GA
```

**Meta description fix (~150-155 chars, with CTA + USPs):**
```
Family-owned suit shop in Gainesville, GA. Tailored fits, master tailors on-site, alterations in 5 days. Free 45-min styling session — book now.
```

**H1 fix:** "Do you want a suit?" is on-brand but doesn't help you rank. Either:
- Replace with "Men's Suits & Tuxedos in Gainesville, GA" and use "Do you want a suit?" as the H2 / subhead, **OR**
- Keep the H1 voice but add a sub-H1 line that includes the keyword. The H1 is the single strongest on-page signal — burning it on a 4-word non-keyword headline is a meaningful loss for a small site.

**Open Graph image:** `og:image="/assets/img/favicon.png"` is hurting social shares badly. Use one of your model photos instead — `Modelleft.jpg` or `mobilemodels.jpg` would both work. Recommended: a 1200×630px crop with the GA Suit Warehouse wordmark + city baked in.

### 2.2 Suits page (`/suits`)

| Element | Current | Verdict |
|---------|---------|:-------:|
| Title | "Tailored Suits That Actually Fit · GA SuitWarehouse · Gainesville, GA" (71 chars) | ⚠️ Slightly long but OK |
| Meta description | 195 chars | ❌ Too long, will truncate |
| H1 | "A suit that fits the way it's supposed to." | ⚠️ No keyword |
| H2 count | 4 | OK |
| Canonical | Missing | ❌ |
| Schema | None | ❌ |
| Visible content | VSL + 3 features + reviews + FAQ | ✅ Decent depth |

**Title fix:**
```
Men's Tailored Suits in Gainesville, GA · GA SuitWarehouse
```

**Meta description fix (~155 chars):**
```
Tailored men's suits in Gainesville, GA. Master tailors on-site, premium fabrics, private fittings. Book your free 45-min styling session today.
```

**H1 — same issue as homepage.** Consider:
```html
<h1>Tailored Men's Suits in Gainesville, GA</h1>
<p class="lead">A suit that fits the way it's supposed to. Watch how we get the shoulders, sleeves, and break right.</p>
```

### 2.3 Weddings page (`/weddings`)

| Element | Current | Verdict |
|---------|---------|:-------:|
| Title | "Wedding Suits & Tuxedos · GA Suit Warehouse · Gainesville, GA" (62 chars) | ✅ Excellent |
| Meta description | 175 chars | ⚠️ Slightly long |
| H1 | "Your wedding day deserves a perfect fit." | ⚠️ Emotional, no keyword |
| H2 count | 3 | OK |
| Canonical | Missing | ❌ |
| Schema | None | ❌ |

**This page is the closest to right.** The title is the best on the site. Tighten the meta to ~155 chars and add the H1 keyword:

```html
<h1>Wedding Suits & Tuxedos in Gainesville, GA</h1>
<p class="lead">Your wedding day deserves a perfect fit. We'll dress your entire wedding party — coordinated, tailored, and ready on time.</p>
```

### 2.4 Heading hierarchy — sitewide

The pattern across all 3 pages is: H1 → H2s → H3s. No skipped levels. ✅
But you're using `<h2 class="visually-hidden">` on the suits + weddings pages (line 88 of suits.html, line 67 of weddings.html). The fabric-banner section has a hidden H2: "What you'll get at your in-person styling session." This is fine for screen readers — it's a clean accessibility pattern.

### 2.5 Internal linking — WEAK

This is the second-biggest on-page issue after schema. Looking at the nav + page links:

- The nav (injected via JS) only links to `#anchors` on the homepage (`/#about`, `/#why-us`, etc.). It has zero links to `/suits` or `/weddings`.
- `/suits` and `/weddings` are reached only via:
  - The `<noscript>` fallback on the homepage quiz
  - The quiz logic itself (JS-driven)
- The footer doesn't link to `/suits` or `/weddings` either.

**This means:**
1. AI crawlers (no JS) can only discover `/suits` and `/weddings` via the `<noscript>` block. Google can follow them, but link equity flow is weak.
2. There are zero internal links *from* `/suits` *to* `/weddings` or vice versa.

**Fix — add to the footer's "Explore" column:**

```html
<li><a href="/suits">Men's Suits</a></li>
<li><a href="/weddings">Wedding Suits & Tuxedos</a></li>
```

Also add cross-page internal links in body content:

- On `/suits`: a sentence like "Planning a wedding? See our [wedding suits and tuxedos page](/weddings)."
- On `/weddings`: a sentence like "Need a suit for work, prom, or a non-wedding occasion? Visit our [men's suits page](/suits)."

### 2.6 Keyword cannibalization — LOW RISK

The 3 indexable pages target distinct intents:
- `/` → general / brand / "suit store gainesville"
- `/suits` → "tailored suits" / non-wedding bookings
- `/weddings` → "wedding suits" / "tuxedo gainesville"

No overlap concerns currently. Just keep H1s and titles distinct (current state is fine).

---

## 3. Content Quality (E-E-A-T)

### 3.1 Experience — STRONG signal, weakly executed

You make claims that *prove* experience: "fitted north of 1,000+ people", "family-owned shop", "master tailors on-site". These are real Experience signals (the first E in E-E-A-T). But they're stated once each and not backed up.

**Improve:**
- Add an "About / Our Story" section (or a separate `/about` page) with: how long the shop has been in business, who runs it, what their tailoring background is, photos of the actual humans (not just models).
- Add the "Best of Hall County" badge that's already in your repo (`bestofhall county logo.jpg`) somewhere visible — it's a real local-authority signal you're not using.

### 3.2 Expertise — UNDERWEIGHT

Currently no:
- Author / business owner bio
- Tailor credentials
- "Years of experience" callouts

**Improve:** Add a 2-3 sentence "Meet the team" block on the homepage, or a dedicated About section, naming the head tailor / owner with a photo and a credential or two ("X years tailoring", "trained at Y").

### 3.3 Authoritativeness — UNDERWEIGHT

- No press mentions
- No "as seen in" / wedding-blog mentions
- No links to or from local Gainesville business directories (visible from the audited HTML)
- No backlinks from review sites referenced

**Improve (low effort):** Once you have the LocalBusiness schema in place (see section 4), build out:
- Yelp / Yellow Pages / Hall County Chamber listings with consistent NAP
- A few wedding-blog mentions or guest posts
- Visible links to your Google Business Profile (the 4.9 / 5 rating you're already showing)

### 3.4 Trustworthiness — MOSTLY OK, two gaps

Trust signals that are present:
- HTTPS ✅
- Real address + phone ✅
- 12 visible 5-star reviews ✅
- Clear pricing ("From $199", "Hem $18") ✅
- "No hidden fees" copy ✅

Trust signals missing:
- **Privacy / Terms pages are dead links** — the footer points to `<a href="#">Privacy</a>` and `<a href="#">Terms</a>`. Both are placeholders. This will hurt trust + may surface as a Search Console issue. Either build out real Privacy + Terms pages (template-based is fine for a local business) or remove the links entirely.
- Owner/business identity — "GA Suit Warehouse, LLC" is in the footer but there's no human face attached anywhere on the site.

### 3.5 Reviews — THE BIG CONTENT MISS

You have 12 review screenshots on the homepage. Each is a PNG. None of the actual review *text* exists in the HTML.

**Why this matters:**
- Google does extract some text from images, but not reliably and with no semantic weight.
- AI crawlers (GPTBot, PerplexityBot, ClaudeBot) don't OCR images. They literally see an `<img alt="5-star Google review screenshot from Mackenzie Morrow">`. That alt text is the entire signal.
- If a customer asks ChatGPT "is GA Suit Warehouse good?", the model has nothing to cite.
- For local SEO, review *content* (keywords like "wedding", "groomsmen", "tuxedo", "alteration") in indexable text on your own site is gold for long-tail rankings.

**Fix — keep the screenshots (they're great social proof), but transcribe each review's text into the HTML alongside or below the screenshot:**

```html
<div class="review-shot">
  <img src="/assets/reviews/review-mackenzie-morrow.png"
       alt="5-star Google review from Mackenzie Morrow on Google" loading="lazy" />
  <blockquote class="review-text">
    <p>"[Actual review text here, transcribed verbatim from the screenshot.]"</p>
    <cite>— Mackenzie Morrow, Google Review</cite>
  </blockquote>
</div>
```

Then hide the `<blockquote>` visually with CSS (or show it — both work) but leave it in the DOM. This single change does more for both SEO and GEO than almost anything else on the list.

---

## 4. Schema Markup — THE #1 PRIORITY FIX

There is **zero structured data** anywhere on the site. For a local business with reviews, hours, an address, prices, and FAQs, this is the highest-ROI change you can make.

### 4.1 Recommended schema by page

**Homepage (`/`) — `LocalBusiness` (`MensClothingStore` type) + `FAQPage`:**

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "MensClothingStore",
  "@id": "https://gasuitwarehouse.com/#business",
  "name": "GA Suit Warehouse",
  "alternateName": "GA SuitWarehouse",
  "description": "Family-owned men's suit shop in Gainesville, GA offering tailored suits, tuxedos, wedding suits, and on-site alterations.",
  "url": "https://gasuitwarehouse.com",
  "telephone": "+14705957775",
  "image": "https://gasuitwarehouse.com/assets/img/Modelleft.jpg",
  "logo": "https://gasuitwarehouse.com/assets/img/favicon.png",
  "priceRange": "$$",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "150 Pearl Nix Pkwy",
    "addressLocality": "Gainesville",
    "addressRegion": "GA",
    "postalCode": "30501",
    "addressCountry": "US"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 34.2820,
    "longitude": -83.8466
  },
  "openingHoursSpecification": [
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
      "opens": "10:00",
      "closes": "19:00"
    },
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": "Sunday",
      "opens": "12:00",
      "closes": "18:00"
    }
  ],
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.9",
    "reviewCount": "[REPLACE WITH YOUR ACTUAL GOOGLE REVIEW COUNT]",
    "bestRating": "5"
  },
  "areaServed": [
    {"@type": "City", "name": "Gainesville, GA"},
    {"@type": "AdministrativeArea", "name": "Hall County, GA"}
  ],
  "sameAs": [
    "[Your Google Business Profile URL]",
    "[Instagram URL if applicable]",
    "[Facebook URL if applicable]"
  ]
}
</script>
```

Verify the lat/lon — I used approximate coords for Pearl Nix Pkwy, Gainesville. Pull exact from your Google Business Profile.

**Then a second `<script>` block on the homepage for FAQ schema:**

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What's your typical price range?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Suits start as low as $199 for the complete set — jacket and pants. Premium options with higher-end fabrics go up to $399."
      }
    },
    {
      "@type": "Question",
      "name": "How long do alterations take?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Standard alterations: 3–5 business days. Need it sooner? Same-day rush available."
      }
    },
    {
      "@type": "Question",
      "name": "Walk-ins or appointments?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Both. Walk-ins are welcome, but for groups, weddings, or tight timelines, book a private appointment for full attention."
      }
    },
    {
      "@type": "Question",
      "name": "Can you handle wedding parties of 6+?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. Book the groom first, and we coordinate the rest."
      }
    },
    {
      "@type": "Question",
      "name": "Do you do rentals?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "No — we don't rent. Renting usually costs more in the long run, and for the same price you actually own the suit."
      }
    }
  ]
}
</script>
```

**`/suits` and `/weddings` pages** — add their own `FAQPage` schema using the FAQs already on each page (they're different from the homepage FAQs and from each other), plus a reference back to the LocalBusiness via `@id`:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [ /* this page's FAQs */ ]
}
</script>
```

**BreadcrumbList** is overkill for a 3-page site, skip it.

### 4.2 Validation

After implementing, validate at:
- https://search.google.com/test/rich-results
- https://validator.schema.org

Specifically check that the `LocalBusiness` block is recognized as eligible for the "About this result" panel and that the `FAQPage` doesn't trigger warnings. Note: as of Aug 2023 Google deprecated rich-result FAQ snippets for non-government / non-health sites, but the schema is still parsed and used by AI Overviews and ChatGPT — keep it.

---

## 5. GEO / AI Search Audit

### 5.1 GEO Readiness Score: 28 / 100

| Sub-score | Score | Notes |
|-----------|------:|-------|
| Citability (passages) | 5 / 25 | Most claims are vague ("over 1,000 people") and not cited |
| Structural readability | 11 / 20 | Headings + lists are good; FAQ format good |
| Multi-modal content | 7 / 15 | Lots of images, one video, but reviews are images-only |
| Authority + brand signals | 2 / 20 | No author, no Wikipedia presence, no Reddit / YouTube footprint |
| Technical accessibility | 3 / 20 | No `llms.txt`, phone number JS-only, no schema |

### 5.2 Platform-specific outlook

| AI Platform | Likely citation odds | Why |
|-------------|:---------------------:|-----|
| Google AI Overviews | **Low** (rises to medium with schema fixes) | 92% of citations come from top-10 organic results — you need to rank first |
| ChatGPT (search) | **Very low** | Pulls heavily from Wikipedia (47.9%) + Reddit (11.3%); you have no presence on either |
| Perplexity | **Very low** | Pulls 46.7% from Reddit; same issue |
| Bing Copilot | **Low** | Indexable but lacks the schema + entity signals it prefers |

### 5.3 AI crawler access

Currently: nothing is blocked, but nothing is explicitly allowed either, because there's no `robots.txt`. AI crawlers default to crawling unless told otherwise — so technically they *can* access your site, but you have no control over which ones do.

**Fix:** Use the `robots.txt` template in section 1.1.

### 5.4 `llms.txt` (recommended)

Create `/llms.txt`:

```
# GA Suit Warehouse

> Family-owned men's suit shop in Gainesville, Georgia. Specializing in
> tailored suits, tuxedos, wedding suits, and on-site alterations.
> Established business with 1,000+ customers fitted. 4.9/5 stars on Google.

## Location & Contact
- Address: 150 Pearl Nix Pkwy, Gainesville, GA 30501
- Phone: (470) 595-7775
- Hours: Mon-Sat 10a-7p, Sun 12p-6p

## Main pages
- [Homepage](https://gasuitwarehouse.com/): Overview, hours, pricing, directions, FAQs
- [Men's Suits](https://gasuitwarehouse.com/suits): Tailored suits, free 45-min styling session
- [Wedding Suits & Tuxedos](https://gasuitwarehouse.com/weddings): Weddings, groomsmen, tuxedos

## Pricing (starting prices)
- Suits: from $199
- Tuxedos: from $199
- Kids' 5-piece sets: $129.99
- Alterations: from $18 (hem); $24 (waist); +$10 same-day rush

## Services
- Suit + tuxedo sales (no rentals)
- On-site alterations and tailoring
- Coordinated wedding party fittings
- Free 45-minute styling sessions by appointment
- Walk-ins welcome

## Service area
Gainesville, GA · Hall County · North Georgia (Buford, Cumming, Flowery Branch,
Oakwood, Dahlonega — anyone within ~30 miles of Pearl Nix Pkwy)
```

This file is dramatically more useful for AI crawlers than your current zero-signal state.

### 5.5 Server-side rendering — GOOD

All 3 pages render their content server-side as static HTML. The booking form is JS-injected (`<div data-booking-root>`), but the *page content* — title, headings, FAQ text, pricing, hours, address — is all in the source HTML. That's exactly what AI crawlers need. ✅

**One important exception:** The phone number, full address (in the footer), and announcement bar are all injected by `components.js`. AI crawlers don't run JS, so they see an empty `<div id="site-nav">` and an empty `<div id="site-footer">`.

This is a serious GEO problem. ChatGPT can see your homepage exists, can see "we're in Gainesville", can see your hours (in the body) — but cannot see your phone number. Same on `/suits` and `/weddings`, where the address only appears in the JS-injected footer.

**Fix — server-render the nav + footer (or at minimum the NAP info):**

The cleanest option: write the nav HTML and footer HTML directly into each `.html` file (instead of injecting via JS). Use a tiny build step (or just hand-copy — there are only 5 pages) to keep them in sync. This was a reasonable shortcut for v1 but it's costing you at least:
- Phone number visibility for AI crawlers
- Address visibility on subpages
- A small but real amount of LCP performance (the JS has to execute before the nav appears)

Alternatively, hardcode just the address + phone into each page's `<body>` even if the rest stays JS-injected:

```html
<!-- Add near the top of each page's body, can be visually hidden if you want -->
<div class="nap-block" itemscope itemtype="https://schema.org/PostalAddress">
  <span itemprop="name">GA Suit Warehouse</span> ·
  <span itemprop="streetAddress">150 Pearl Nix Pkwy</span>,
  <span itemprop="addressLocality">Gainesville</span>,
  <span itemprop="addressRegion">GA</span>
  <span itemprop="postalCode">30501</span> ·
  <a href="tel:+14705957775">(470) 595-7775</a>
</div>
```

### 5.6 Citability — the passage problem

AI search prefers self-contained 134-167 word passages with specific facts. Your site has the *facts* but not in the right *format*.

**Bad (vague):** "We've fitted over 1,000 people." (One sentence, no context, hard to cite.)

**Good (citable passage):**

> ## What is GA Suit Warehouse?
> GA Suit Warehouse is a family-owned men's suit shop located at 150 Pearl Nix Pkwy in Gainesville, Georgia. Since opening, the shop has fitted over 1,000 customers for weddings, work, prom, and formal occasions. Suits start at $199 (jacket and pants), with premium full-canvas builds running up to $399. Standard alterations are completed in 3-5 business days, with same-day rush available for an additional $10. The shop offers free 45-minute personalized styling sessions by appointment and welcomes walk-ins seven days a week. Hours are Monday through Saturday 10:00 AM-7:00 PM and Sunday 12:00 PM-6:00 PM. The shop maintains a 4.9-star average across [N] Google reviews.

That's a 130-word passage with seven citable facts. Add 2-3 of these throughout the site (one on the homepage as the "About" section, one on `/suits` as a "What we do", one on `/weddings`).

### 5.7 Brand mention strategy

This is a long game but it's the single biggest GEO lever for a local business:

| Channel | Action | Why |
|---------|--------|-----|
| Google Business Profile | Verify + maximize (photos, posts, Q&A, products) | Foundation for local pack + AI Overviews |
| Wikipedia | Skip — too small for an article | n/a |
| Reddit | Be present in r/Gainesville, r/Atlanta wedding subreddits, r/malefashionadvice (when relevant). Do not spam. | ChatGPT pulls 11%, Perplexity pulls 47% from Reddit |
| YouTube | Repurpose your VSL into 3-5 short videos (the styling session, alterations, behind-the-scenes). Caption everything. | YouTube mentions correlate strongest (~0.737) with AI citations |
| LinkedIn | Owner profile linked from the site, "About" page on company LinkedIn | Moderate signal, easy win |
| Local press | Pitch the Hall County Herald / Gainesville Times: "Local family suit shop hits 1,000th customer" angle | Builds entity authority |

---

## 6. Prioritized Action Plan

### Tier 1 — Critical, this week (1-3 hours total)

1. **Create `/robots.txt`** with AI crawler permissions + sitemap reference. (15 min)
2. **Create `/sitemap.xml`** with the 3 indexable URLs. (10 min)
3. **Add `LocalBusiness` (`MensClothingStore`) JSON-LD** to homepage. (30 min — pull exact lat/lon, get accurate review count from your Google Business Profile)
4. **Add `FAQPage` JSON-LD** to all 3 pages using each page's existing FAQs. (20 min)
5. **Add canonical tags** to all 3 indexable pages. (5 min)
6. **Server-render the address + phone** on every page (don't rely on JS injection alone). (20 min)
7. **Create `/llms.txt`** at the root. (15 min)
8. **Replace `og:image="favicon.png"`** with a proper 1200×630 share image on all 3 pages. (15 min)

### Tier 2 — High impact, this month (4-8 hours total)

9. **Transcribe Google review text** for the 12 reviews currently shown as images. Add as `<blockquote>` alongside or below each screenshot. (1-2 hr)
10. **Tighten H1s** to include city/keywords: "Men's Suits & Tuxedos in Gainesville, GA" / "Tailored Men's Suits in Gainesville, GA" / "Wedding Suits & Tuxedos in Gainesville, GA". (15 min)
11. **Trim title tags + meta descriptions** to 50-60 / 150-155 chars. (15 min)
12. **Add 2-3 citable 130-word passages** (homepage About, suits page, weddings page). (1 hr)
13. **Add cross-page internal links** in body content (homepage → `/suits` and `/weddings`; suits ↔ weddings). (30 min)
14. **Build out `/about`** or expand the homepage About section with owner/tailor names, photos, real story, "Best of Hall County" badge. (1-2 hr)
15. **Fix or remove dead Privacy/Terms footer links.** (30 min)
16. **Fix font loading** — drop Spectral from 9 weights to 3-4; same for PT Serif. (15 min)

### Tier 3 — Long-term entity building

17. **Maximize Google Business Profile** — complete every field, weekly photo posts, respond to every review, add products + services.
18. **Build Reddit / YouTube footprint** — 3-5 short videos on YouTube (clips of styling session, alterations, etc.); occasional helpful presence in r/Gainesville and bridal subreddits.
19. **Submit to local directories** — Yelp, Hall County Chamber, The Knot / WeddingWire (for the wedding side), Yellow Pages — with **identical NAP** to your schema.
20. **Pitch local press** — "1,000+ customers fitted" milestone, "Best of Hall County" angle, family-business profile.
21. **Once you have data,** add an `aggregateRating` to schema with a real `reviewCount`. Re-validate quarterly.

---

## 7. Validation checklist (run after Tier 1)

- [ ] `https://gasuitwarehouse.com/robots.txt` returns 200 with content
- [ ] `https://gasuitwarehouse.com/sitemap.xml` returns 200 + valid XML
- [ ] `https://gasuitwarehouse.com/llms.txt` returns 200
- [ ] Google Rich Results Test passes for `/` (LocalBusiness + FAQPage)
- [ ] Google Rich Results Test passes for `/suits` (FAQPage)
- [ ] Google Rich Results Test passes for `/weddings` (FAQPage)
- [ ] Schema.org Validator: zero errors on all 3 pages
- [ ] All 3 indexable pages have `<link rel="canonical">` self-referencing
- [ ] PageSpeed Insights — LCP < 2.5s, CLS < 0.1, INP < 200ms (mobile + desktop)
- [ ] Google Search Console: site verified, sitemap submitted, no coverage errors
- [ ] Bing Webmaster Tools: site verified, sitemap submitted
- [ ] `view-source:https://gasuitwarehouse.com/` shows phone number + address as plain text (not just JS-injected)

---

## 8. Notes on Methodology

This audit was performed against:
- Live site fetched via WebFetch (HTML only — no JS execution; this matches what AI crawlers see)
- Local repo source (`index.html`, `suits.html`, `weddings.html`, `booking-confirmed.html`, `thank-you.html`, `assets/js/components.js`, `vercel.json`)
- 404 confirmation on `/robots.txt`, `/sitemap.xml`, `/llms.txt`

**Not audited (out of scope or no data available):**
- Actual Google Search Console data (impressions, queries, click-through, coverage errors)
- Google Analytics traffic baseline
- Backlink profile (Ahrefs / Semrush / GSC links)
- Competitor SERP analysis for "suit store Gainesville" / "wedding suits Gainesville"
- Real Core Web Vitals field data (only inferred from the code; verify via PSI)
- The booking form / API endpoints (couldn't render in WebFetch)

If you have Search Console access, share the `Performance` and `Coverage` reports and I'll do a follow-up pass with real query data and any indexation errors.

---

*End of audit.*
