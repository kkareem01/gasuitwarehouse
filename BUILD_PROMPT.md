# Build Prompt — GA Suit Warehouse Website

Paste everything below this line into a fresh Claude Code session in an empty directory. Drop the 7 customer review PNGs into a `Reviews/` folder in that directory before you start so Claude can move them into place.

---

I want you to build a small, static conversion-funnel website for my local menswear store. Take your time, ask me before making any major structural decision, and use the `frontend-design` skill so the design doesn't end up looking generic.

## The business

- **Name:** GA Suit Warehouse
- **Address:** 150 Pearl Nix Pkwy, Gainesville GA 30501
- **Phone:** (470) 595-7775
- **What we do:** Tailored menswear store. Master tailors on-site. 500+ suits in stock. Private, by-appointment fittings — seven days a week.
- **Reputation:** Rated 5.0 on Google, 200+ reviews.
- **Position:** We are not a rental shop and not a department store. We're the place where the suit actually fits, the tailor is in the building, and the wedding party walks out matching — not "matching-ish."

## What the site is

A conversion funnel. The whole point is to get a local visitor to either (a) submit a lead form for a fitting or (b) book on Calendly. Nothing else matters. Don't add blogs, product catalogs, ecommerce, or anything we don't need.

## Page structure

Five pages total:

1. **Home (`index.html`)** — Hero, credibility chip (5.0 / 200+ reviews), short audience selector that sends people to one of three landing pages, and a tight FAQ. Keep it short. Home is a router, not a sales page.
2. **Weddings (`weddings.html`)** — Audience landing page for grooms / groomsmen / wedding parties.
3. **Prom (`prom.html`)** — Audience landing page for high schoolers and parents shopping for prom.
4. **Professionals (`professionals.html`)** — Audience landing page for executives, attorneys, and business pros wanting a real wardrobe.
5. **Thank-you (`thank-you.html`)** — Post-form-submit confirmation page. `noindex`.

Each of the three audience pages should follow the same skeleton (you pick the exact order and treatment, but it must include all of these):

- Announcement bar at the very top (e.g. "Now Booking — 2026 Wedding Season")
- Hero with a video-sales-letter (VSL) placeholder block + headline + CTA
- Social proof section using the 7 review screenshots from `Reviews/` (copy them into `assets/reviews/` with cleaner filenames)
- 3-column benefits section ("why this audience picks us")
- A numbered "what's included / how it works" walkthrough
- A qualification section (a "you're a fit if…" / "this isn't for you if…" two-column block — be honest, filter out bad-fit leads)
- A booking block with two side-by-side options: a lead form AND a Calendly iframe
- Final CTA strip
- Shared footer with NAP info

The copy should sound different per page. Weddings = coordination, on-time guarantee, private fittings. Prom = stand out, real tailoring, you keep it forever (rentals are dumb). Professionals = how a room reads you before you speak, wardrobe systems, executive presence. Don't make the three pages feel like the same page with words swapped.

## Tech / build constraints

- **Static site only.** Plain HTML, one shared CSS file, vanilla JS. No build step. No `node_modules`. No framework. The user should be able to open it with `python3 -m http.server` and have it work.
- One shared `assets/css/styles.css`.
- One shared `assets/js/components.js` that injects the nav and footer, handles the mobile menu, the FAQ accordion, and scroll reveals — so I'm not maintaining the same nav/footer markup in five files.
- One `assets/js/form.js` for lead-form validation, submit handling, and redirect to `thank-you.html`. Leave the actual submit endpoint as a TODO with a `console.log` placeholder — I'll wire it up to Formspree / Netlify Forms / my CRM later.
- VSL videos: leave a clearly-marked placeholder div on each audience page (`data-aspect="16:9"`, visible "YOUR VSL EMBED GOES HERE" text). I'll swap in a Vidalytics / YouTube / Wistia embed later.
- Calendly: leave an iframe with `src="about:blank"` and a fallback block showing the format I should paste. Mark it with `data-calendly-placeholder` so I can grep for it.
- Hero photos: Unsplash URLs are fine for now. Pick tasteful, on-brand ones (real menswear, not stock cheese).

## Brand assets I'm giving you

- A `Reviews/` folder with 7 PNG screenshots of real Google reviews. Use ALL of them. Move them into `assets/reviews/` with kebab-case filenames (`review-julian-herrera.png` etc). Each one should be clickable to open the full-size image. These are the single most important trust element on the site — give them real space.
- A favicon (`favicon.png` / `favicon.ico`) if I drop one in. If not, leave a placeholder.

## Design direction

Use the `frontend-design` skill before writing any code. The store sells $299–$899 suits with master tailors — the site should feel like it. That means:

- A real type pairing — a distinctive serif/display for headings (Spectral, PT Serif, Fraunces, something with character) and a clean sans for body. **Not Inter. Not Roboto. Not system-ui.**
- A custom brand palette — deep navy, paper/cream, a warm gold accent. **Don't use default Tailwind blue/indigo.** Don't use a purple gradient.
- Layered, color-tinted shadows, not flat `shadow-md`.
- Tight tracking on big headings, generous line-height on body.
- Real interactive states on every clickable element (hover, focus-visible, active).
- Mobile-first responsive.
- No `transition-all`. Animate `transform` and `opacity` only.

I don't want a Tailwind-CDN look. Write real CSS with CSS variables for the palette. Be intentional.

## Workflow I want you to follow

1. Start by reading this whole prompt and asking me any clarifying questions before you write a line of code.
2. Run the `frontend-design` skill to commit to an aesthetic direction. Tell me the direction in one paragraph before you start coding.
3. Build the home page first. Show me a screenshot. We iterate until it's right.
4. Then build one audience page (start with Weddings). Screenshot, iterate.
5. Once Weddings is locked, port it to Prom and Professionals with audience-specific copy.
6. Build the thank-you page last.
7. At the end, write a `README.md` with: how to preview locally, a swap-in checklist for VSL / Calendly / form backend / hero photos / hours, and the NAP info.

## Hard rules

- Don't add features I didn't ask for. No catalog, no shop, no blog, no newsletter signup, no chat widget.
- Don't "improve" the funnel structure — five pages, in the order above.
- Don't use placeholder review images. Use the 7 real PNGs from `Reviews/`.
- Don't hardcode the nav or footer in five files — inject them from one JS file.
- Don't ship something you haven't actually opened in a browser.

That's it. Ask me anything before you start.
