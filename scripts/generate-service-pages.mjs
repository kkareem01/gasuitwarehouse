#!/usr/bin/env node
/**
 * generate-service-pages.mjs
 *
 * Generates one HTML landing page per distinct service in the GA Suit Warehouse
 * Google Business Profile, after deduplication. Each page follows the pattern
 * established by /suits/business-interview.html: full SEO/geo meta, JSON-LD
 * (MensClothingStore + BreadcrumbList + Service + FAQPage), hidden NAP, hero,
 * content sections, pricing table, booking section, FAQ, related services.
 *
 * Title format on every page: "{Service} in Gainesville, GA · GA Suit Warehouse"
 *
 * Run: `node scripts/generate-service-pages.mjs`
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SITE = 'https://www.gasuitwarehouse.com';

const IMG_POOL = [
  { base: 'Modelleft', alt: 'GA Suit Warehouse Gainesville GA' },
  { base: 'modelright', alt: 'Tailored menswear at GA Suit Warehouse Gainesville GA' },
  { base: 'right-fit', alt: 'Master tailor at GA Suit Warehouse Gainesville GA' },
  { base: 'fabric-swatches-banner', alt: 'Fabric selection at GA Suit Warehouse Gainesville GA' },
  { base: 'personal-style-sessions', alt: 'Personal styling at GA Suit Warehouse Gainesville GA' },
  { base: 'walk-out-ready', alt: 'Walk-out-ready fittings at GA Suit Warehouse Gainesville GA' },
  { base: 'image1forwedding', alt: 'GA Suit Warehouse formalwear Gainesville GA' },
  { base: 'image2forwedding', alt: 'GA Suit Warehouse menswear Gainesville GA' },
  { base: 'image3forwedding', alt: 'GA Suit Warehouse tailoring Gainesville GA' },
  { base: 'mobilemodels', alt: 'GA Suit Warehouse fittings Gainesville GA' },
];
const pickImg = (i) => IMG_POOL[i % IMG_POOL.length];

// ---------- Service catalog ----------
// Each entry produces exactly one page. Hub spokes share a hub_path/hub_name.
// Aliases listed for documentation only — they all roll into this single page.
const services = [
  // ===== SUITS hub spokes =====
  {
    slug: 'slim-fit', dir: 'suits', hub_path: '/suits', hub_name: 'Suits',
    name: 'Slim Fit Suits',
    description: 'Slim fit suits in Gainesville, GA. Tapered chest and trim leg cut for a modern silhouette, master tailors on-site, alterations in 3-5 days.',
    intro: 'Slim fit reads modern, sharp, and intentional. The shoulder is closer to your frame, the chest is leaner through the torso, and the trousers taper from knee to hem with a clean break. It is the cut for men who run lean, who want their tailoring to look current rather than corporate-conservative, and who do not want excess fabric pooling at the waist or pant hem.',
    body: 'A slim fit is not a skinny fit. The cardinal mistake we correct on walk-ins is a jacket that pulls at the button when buttoned, or shoulder seams that ride up onto the deltoid because the customer sized down to chase a trend. Real slim fit fits the shoulder bone clean, allows a flat hand under the lapel, and lets the trouser sit on the hip without straining the seat. We stock slim fit in navy, charcoal, mid-grey, and black across 36S to 50R, with extra inventory in 38R and 40R because that is the most common slim build. Tailors at Pearl Nix Pkwy can dial sleeve, waist suppression, and trouser taper in 3 to 5 business days. Slim fit pairs naturally with a 2.5-inch tie, a slim-collar dress shirt, and a leaner silhouette shoe.',
    serviceType: 'Slim fit men\'s suits',
    faqs: [
      ['Is slim fit the same as skinny fit?', 'No. Skinny fit is a tapered, often unforgiving silhouette that pulls across the chest and seat. Slim fit is a modern cut that follows the body without straining. If your jacket pulls at the button or your trousers crease at the seat when seated, you are in skinny fit, not slim. We re-fit dozens of customers a month who mistakenly bought skinny when they wanted slim.'],
      ['Can a slim fit suit be tailored to fit a heavier build?', 'Sometimes, but the better answer for heavier builds is a modern fit, not a slim. Slim fit is patterned with a leaner chest and trimmer waist. If you are carrying weight in the midsection, the slim cut will pull and create horizontal stress lines no tailor can remove. We will be honest with you at the fitting and steer you toward modern fit if the slim is fighting your frame.'],
      ['How tapered are the trousers on a slim fit suit?', 'Our slim fit trousers taper from a 19 to 19.5 inch knee down to a 15 to 15.5 inch hem on a size 32 waist. That is narrow enough to read modern but wide enough to drop cleanly over a dress shoe. We can taper further on request — down to 14.5 inch hem — but past that the silhouette tips into skinny territory and starts limiting shoe choice.'],
      ['What occasions is slim fit appropriate for?', 'Weddings, business in tech and creative industries, prom, date nights, photo shoots, and any time you want a modern silhouette. For finance, law, courtroom, and senior board interviews, modern or classic fit is the safer choice — slim can read too fashion-forward in those rooms. For everything else, slim is the default modern silhouette.'],
      ['Do you stock slim fit in big and tall sizes?', 'Slim fit by definition is patterned for leaner builds, so we do not carry true slim fit in big and tall. What we do offer is a tapered modern fit in larger sizes that captures the same modern silhouette without straining. Ask for it by name at the door — our tailors call it the "tapered modern" and it covers 46R through 56R in navy and charcoal.'],
    ],
    relatedKeys: ['suits/modern-fit', 'suits/classic-fit', 'suits/three-piece'],
    pricing: [
      ['Slim fit two-piece suit', '$249', '3-5 business days'],
      ['Slim fit three-piece suit', '$329', '3-5 business days'],
      ['Premium slim fit (Super 110s/120s)', '$449', '3-5 business days'],
      ['Slim fit alterations (waist suppression, taper)', '$45+', '3-5 business days'],
    ],
  },
  {
    slug: 'modern-fit', dir: 'suits', hub_path: '/suits', hub_name: 'Suits',
    name: 'Modern Fit Suits',
    description: 'Modern fit suits in Gainesville, GA. The flattering middle ground between slim and classic — clean shoulder, slight chest taper, in-house tailoring.',
    intro: 'Modern fit is the suit cut most men actually want once they try all three. It is leaner than classic and roomier than slim, with a clean shoulder, a slight chest taper, and a trouser that drops straight without clinging or ballooning. Most of the suits we sell at GA Suit Warehouse are modern fit because most builds — average to athletic with some midsection — wear it best.',
    body: 'A classic fit suit hangs straight off the shoulder with extra room through the chest and waist. A slim fit hugs the body close. Modern fit lives in between: it follows the natural taper of the torso without forcing it. The jacket has a slight waist suppression so it does not look boxy, the chest sits clean, and the sleeve has enough room for movement without bunching. Trousers in our modern fit run a 19.5 to 20 inch knee and a 16 inch hem on a 32 waist, which works with any standard dress shoe and never pools at the ankle. We stock modern fit in every staple color — navy, charcoal, mid-grey, light grey, black, brown — and it is the cut we default to for first-time suit buyers, weddings, work, and most professional settings. If you are not sure which fit to buy, modern is the safe answer 70 percent of the time.',
    serviceType: 'Modern fit men\'s suits',
    faqs: [
      ['What is the difference between modern fit and slim fit?', 'Modern fit has a touch more room in the chest, a slightly straighter cut through the waist, and a less aggressive trouser taper than slim. Slim follows the body close. Modern follows the body but gives you a half inch of breathing room everywhere. If you are unsure which to buy, modern is the more universally flattering cut.'],
      ['Is modern fit good for a heavier or athletic build?', 'Yes — modern fit is usually the right answer for athletic builds (broad shoulders, larger thighs) and for builds carrying weight in the midsection. The slight waist suppression keeps it from looking boxy, and the extra chest room prevents pulling across the front. Our tailors can dial in further suppression at the waist if you want a leaner read without going to slim.'],
      ['How does modern fit compare to classic fit?', 'Classic fit is the traditional cut your father wore — straight through the body, fuller chest, full-leg trouser. It is forgiving but reads dated. Modern fit took everything good about classic and trimmed the excess. Most men who think they want classic actually look better in modern — the photographs do not lie.'],
      ['Can modern fit be tailored slimmer if I want?', 'Yes. Tailors can take in the waist, suppress the side seams, and taper the trouser leg toward a slim silhouette without changing the shoulder or chest pattern. This is the easiest way to get a slim look without the constraints of buying a true slim fit. Standard turn 3-5 days, line-item pricing.'],
      ['What occasions is modern fit best for?', 'Almost all of them — work, weddings, funerals, court, business meetings, dates, prom for older guys, and travel. Modern fit is the daily-driver cut. If you own one suit, it should be a navy modern fit two-piece. If you own two, the second is charcoal modern fit. After that, you build out fits and patterns for specific occasions.'],
    ],
    relatedKeys: ['suits/slim-fit', 'suits/classic-fit', 'suits/business-interview'],
    pricing: [
      ['Modern fit two-piece suit', '$249', '3-5 business days'],
      ['Modern fit three-piece suit', '$329', '3-5 business days'],
      ['Premium modern fit (Super 110s/120s)', '$449', '3-5 business days'],
      ['Modern fit alterations', '$35+', '3-5 business days'],
    ],
  },
  {
    slug: 'classic-fit', dir: 'suits', hub_path: '/suits', hub_name: 'Suits',
    name: 'Classic Fit Suits',
    description: 'Classic fit suits in Gainesville, GA. Traditional full-cut silhouette for boardroom, court, and conservative dress codes. Tailored on-site.',
    intro: 'Classic fit is the traditional men\'s suit cut — straight through the chest, fuller across the back and shoulders, and a full-leg trouser with a generous break at the shoe. It is the suit you wear for serious occasions where the room is conservative and the message is competence, not fashion. Lawyers, executives, clergy, courtroom witnesses, and older customers heading to formal events still ask for classic fit by name.',
    body: 'Classic fit is not outdated — it is appropriate. There are rooms in this country where a slim or modern silhouette reads young, where a partner-track lawyer wants the suit to disappear so the argument lands, where a senior pastor stands in front of a congregation and the cut should not draw the eye. Classic fit handles all of those rooms. Our classic fit jackets are patterned with a fuller chest, a straighter side seam (no waist suppression), and a longer length. Trousers run a 21 inch knee and a 17.5 to 18 inch hem on a 32 waist with a full one-inch break. We stock classic fit in navy, charcoal, mid-grey, black, and brown across 36R through 60L, including big and tall. The pattern grades up cleanly into larger sizes, which is one reason it remains the default for many older and heavier customers.',
    serviceType: 'Classic fit men\'s suits',
    faqs: [
      ['Is classic fit the same as regular fit or traditional fit?', 'Yes. Different brands use different names — classic fit, regular fit, traditional fit, full fit, American cut — but they all describe the same idea: a straight, fuller silhouette without modern waist suppression or trim taper. Some older European brands also call this "British cut" though the British have their own newer cuts now too.'],
      ['Who should buy classic fit instead of modern fit?', 'Men over 55 who have always worn classic and are comfortable in it. Men in conservative professions (law, government, finance senior leadership, clergy) where the dress code is unspoken but absolute. Men carrying significant weight in the midsection where a modern cut still pulls. And anyone who tried modern fit and felt the cut was "too tight" or "too fashion-forward" — classic is the answer.'],
      ['Can a classic fit suit be tailored to look more modern?', 'Yes, with limits. We can suppress the waist a half inch, shorten the jacket length slightly, and taper the trouser leg from a 17.5 hem down to a 16. Beyond that, the pattern itself is too straight to convert into modern fit. If you want a meaningfully more modern look, buy modern fit instead — it will be cheaper than over-tailoring a classic.'],
      ['Does classic fit come in big and tall?', 'Yes — classic fit is the default cut in big and tall sizing because the pattern grades up cleanly and works on heavier and taller builds without forcing. We stock big and tall classic fit through 60L, with shorter waists on request and extra-long trousers for taller customers up to 6 foot 6.'],
      ['What break should I get on classic fit trousers?', 'Full break — meaning the trouser hem rests on the shoe and creates one clean horizontal fold above it. Half break and no break read as more modern and clash with the classic silhouette. Full break is what the classic cut was designed for and what every classic-fit customer should default to.'],
    ],
    relatedKeys: ['suits/modern-fit', 'suits/slim-fit', 'suits/big-and-tall'],
    pricing: [
      ['Classic fit two-piece suit', '$249', '3-5 business days'],
      ['Classic fit three-piece suit', '$329', '3-5 business days'],
      ['Premium classic fit (Super 110s/120s)', '$449', '3-5 business days'],
      ['Big and tall classic fit', '$299+', '3-5 business days'],
    ],
  },
  {
    slug: 'big-and-tall', dir: 'suits', hub_path: '/suits', hub_name: 'Suits',
    name: 'Big & Tall Suits',
    description: 'Big & tall suits in Gainesville, GA. Sizes 46R-60L plus extra-tall trousers. Real inventory, in-house tailoring, no special order delays.',
    intro: 'Most stores treat big and tall like a footnote — a small rack at the back, two colors, three sizes, everything else is special order with a six-week wait. We do not. GA Suit Warehouse stocks big and tall suits in navy, charcoal, mid-grey, light grey, black, and brown across 46R, 46L, 48R, 48L, 50R, 50L, 52R, 52L, 54R, 56R, and up to 60L on the floor. If you can walk in, we can fit you that day.',
    body: 'The hardest part of buying a big or tall suit is finding one that does not look like it was built around the size, with everything else as an afterthought. Pattern grading matters: a poorly graded 54R jacket has a head that looks too small for the body, a sleeve that runs short, and a chest that pulls because the manufacturer just scaled up a 40R without re-balancing the proportions. We carry big and tall lines that grade cleanly — meaning the shoulder, chest, sleeve, and skirt of the jacket all stay in proportion to each other through the size run. Tall sizes (46L, 48L, 50L, 52L) get an extra inch in jacket length and an extra inch in sleeve. Big sizes (46R through 60R) get the proper fuller chest and seat without throwing off the shoulder line. Tailors on-site can extend trousers to a 36 or 38 inseam on request and let out the seat or waist up to two inches without issue.',
    serviceType: 'Big and tall men\'s suits',
    faqs: [
      ['What sizes do you carry in big and tall?', 'On the rack: 46R, 46L, 48R, 48L, 50R, 50L, 52R, 52L, 54R, 56R, 58R, 60R, 60L. Trousers extend to a 36 inseam stocked, 38 on request. Shirts run up to 22-inch neck and 38-inch sleeve. We can special order beyond 60L but standard inventory should fit 95 percent of big and tall customers walk-in.'],
      ['Do you tailor big and tall on-site?', 'Yes. All alterations are done in-house by master tailors. Standard turn is 3 to 5 business days. Letting out a seat, extending an inseam, taking in shoulders, and converting a regular into a long are all done on the premises — we do not ship out for any of it.'],
      ['How long do big and tall suits take to get if my size is not on the floor?', 'For sizes we stock (everything listed above), same-day or next-day after alterations. For special orders beyond stocked sizes, expect 2 to 3 weeks. For weddings, funerals, or rush jobs we will tell you the realistic timeline before you commit and refund deposits if we cannot meet it.'],
      ['What suit cuts are available in big and tall?', 'Classic fit is the default cut and what we recommend for most big and tall builds — the pattern grades cleanly and the silhouette flatters. Modern fit is available with mild waist suppression if you want a less boxy look. We do not stock true slim fit in big and tall because the pattern strains on larger frames; we offer a "tapered modern" that gives a leaner read without forcing it.'],
      ['Do you carry big and tall tuxedos?', 'Yes — black notch lapel and shawl collar tuxedos in 46R through 56R, and white dinner jackets through 52R. White tie tail coats can be special-ordered in big sizes with 4 to 6 weeks lead. Big and tall groomsmen packages are common — we run them every wedding season.'],
    ],
    relatedKeys: ['suits/classic-fit', 'suits/modern-fit', 'suits/business-interview'],
    pricing: [
      ['Big & tall classic fit two-piece', '$299', '3-5 business days'],
      ['Big & tall three-piece suit', '$379', '3-5 business days'],
      ['Big & tall tuxedo (notch or shawl)', '$399', '3-5 business days'],
      ['Big & tall alterations (seat, inseam, sleeve)', '$45+', '3-5 business days'],
    ],
  },
  {
    slug: 'homecoming', dir: 'suits', hub_path: '/suits', hub_name: 'Suits',
    name: 'Homecoming Suits',
    description: 'Homecoming suits in Gainesville, GA. Color-coordinated with your date, group rates, fast 3-5 day alterations, sized for high schoolers.',
    intro: 'Homecoming is not prom and the suit should not look like prom either. The dress codes are slightly more relaxed, the photo expectations are slightly less formal, and most schools in Hall County (Gainesville High, North Hall, Chestatee, Flowery Branch) lean toward color suits or bolder pattern blazers paired with darker trousers rather than full black-tie tuxedos.',
    body: 'The two looks that win homecoming photos year after year: option one — a color suit (burgundy, hunter green, navy, dusty pink, or sage) with a white shirt and a pocket square that ties to the date\'s dress. Option two — a patterned blazer (glen check, herringbone, plaid) with charcoal or black dress trousers, a knit tie, and brown loafers. Both signal "I dressed up but I am not trying to win prom king." We coordinate the suit color with the date\'s dress at the fitting — bring a swatch or a clear photo and we will pull options that match cleanly. Group rates kick in at 4+ guys booking together. Standard alteration turn is 3 to 5 business days; if homecoming is a week out and you walk in panicked, we run same-day rush on hems and waist for $10.',
    serviceType: 'Homecoming suits',
    faqs: [
      ['What color suit should I wear for homecoming?', 'It depends on your date\'s dress. Burgundy and hunter green are the safest crowd-pleasers. Dusty pink, sage, and powder blue are popular pastel options that work especially well in fall. Navy is the classic neutral. We will match the suit to a dress swatch at the fitting — text us a photo of the dress before you come in and we will pull options.'],
      ['Is a tuxedo too formal for homecoming?', 'For most Hall County high schools, yes. Homecoming dress codes are typically less strict than prom — a sharp suit reads better than a full tuxedo. If your school does a black-tie homecoming or you are going to a particularly formal one, a black notch-lapel tuxedo is appropriate, but the default is a suit.'],
      ['How early should I book my homecoming suit?', '3 weeks before the dance is the sweet spot. That gives time for fitting, alterations, and a final try-on. If your homecoming is in 6 days, walk in and we will do same-day rush on alterations for $10 above standard. We fit homecoming groups every fall and have the inventory and tailors to make tight timelines work.'],
      ['Do you offer group rates for homecoming?', 'Yes — 4 or more guys booking together get a 10 percent group discount on suits and free coordination. Bring everyone to the same fitting if possible, or have one person send the group\'s sizes and color preference and we will assemble it. Group orders ship together and are easier to coordinate at pickup.'],
      ['What shoes go with a color homecoming suit?', 'For burgundy, hunter green, and navy, dark brown leather loafers or oxfords work cleanly. For pastels (dusty pink, sage, powder blue), white sneakers can read fashion-forward but lighter brown loafers are safer. Black dress shoes with a color suit can read mismatched — avoid unless the suit is very dark.'],
    ],
    relatedKeys: ['prom/suits', 'suits/graduation', 'suits/quinceanera'],
    pricing: [
      ['Homecoming suit (color, slim or modern fit)', '$229', '3-5 business days'],
      ['Patterned blazer + dress trousers combo', '$199', '3-5 business days'],
      ['Group rate (4+ guys)', '10% off', '3-5 business days'],
      ['Same-day rush alterations', '+$10', 'Walk in by 11am'],
    ],
  },
  {
    slug: 'quinceanera', dir: 'suits', hub_path: '/suits', hub_name: 'Suits',
    name: 'Quinceanera Suits',
    description: 'Quinceañera suits in Gainesville, GA. Coordinated chambelán suits, color-matched to the quinceañera\'s theme, group fittings, alterations on-site.',
    intro: 'A quinceañera court (chambelanes) needs to look uniformly sharp — same color, same fit, same accessories — without looking costumed. Most Gainesville and Hall County families coming through GA Suit Warehouse for a quinceañera have between 5 and 14 chambelanes plus the chambelán de honor. We have run dozens of these over the years and the system that works is one fitting day for the full court, identical suits in the quinceañera\'s chosen color, and master tailors finishing everyone in the same 3 to 5 day window.',
    body: 'The most common quinceañera color schemes we see: white suits with the theme color in the tie, vest, and pocket square; full color suits (burgundy, navy, royal blue, hunter green, blush, lavender, gold) for the entire court; and black suits with theme-color accessories. Each works — the choice depends on the quinceañera\'s theme and budget. We stock white tuxedo jackets and white dinner jackets in 36R through 52R for traditional white-suit courts, and we color-match accessories to roughly 24 standard colors plus custom dye-to-match on request (lead time 2 to 3 weeks for custom dye). The chambelán de honor often wears a slightly different look — a darker accent, a different lapel pin, a bow tie instead of long tie — to distinguish him as the lead. We coordinate all of this at one fitting if everyone can come together, otherwise individual fittings tied to the same color and fit profile.',
    serviceType: 'Quinceañera suits and chambelán packages',
    faqs: [
      ['How much do quinceañera suits cost per chambelán?', 'Standard suit packages run $229 to $329 per chambelán depending on fabric and color. White tuxedo jackets are $279. Full custom dye-to-match runs $449+ with 2 to 3 weeks lead. Group rates kick in at 6 or more chambelanes for 10 percent off, and quinceañera courts of 12+ get free coordination services.'],
      ['How long do we need before the quinceañera to book?', '6 to 8 weeks is ideal — that gives time for everyone to fit, alterations, and a final try-on with all chambelanes wearing the suits to confirm the group look. For custom dye-to-match colors, push to 10 to 12 weeks. For tighter timelines (under 4 weeks), stick to in-stock colors and we will rush alterations.'],
      ['Can the chambelán de honor wear something different?', 'Yes — and we recommend it. The chambelán de honor (the lead escort) typically wears a slight differentiator: a different vest color (often white when the court wears the theme color), a bow tie instead of a long tie, a unique lapel pin or pocket square, or a darker accent shade. The visual hierarchy reads cleanly in photos.'],
      ['Do you handle bilingual fittings?', 'Yes. We have Spanish-speaking staff at the Pearl Nix Pkwy showroom available by appointment. Mention you need bilingual support when you book and we will schedule with the right team. All fitting paperwork, group coordination sheets, and pickup instructions can be provided in Spanish on request.'],
      ['Do younger boys (pajes) get fitted differently?', 'Yes — pajes (young boys in the court, often 5 to 12 years old) wear scaled-down versions of the chambelán look. We carry boys\' suits 4 through 18 in matching colors and can coordinate identical accessories. Boys\' suits are often $129 to $179 and tailor on-site like adult suits, with extra hem allowance for growth.'],
    ],
    relatedKeys: ['suits/boys-and-kids', 'suits/homecoming', 'suits/graduation'],
    pricing: [
      ['Standard chambelán suit (in-stock color)', '$229', '3-5 business days'],
      ['White tuxedo / dinner jacket', '$279', '3-5 business days'],
      ['Custom dye-to-match', '$449+', '2-3 weeks'],
      ['Group rate (6+ chambelanes)', '10% off', '3-5 business days'],
      ['Pajes / boys\' suits to match', '$129+', '3-5 business days'],
    ],
  },
  {
    slug: 'graduation', dir: 'suits', hub_path: '/suits', hub_name: 'Suits',
    name: 'Graduation Suits',
    description: 'Graduation suits in Gainesville, GA. Sharp, photo-ready, and built to last past the ceremony — for high school, college, and grad school.',
    intro: 'A graduation suit needs to do two jobs. It has to look right under the gown for ceremony photos, and it has to be the suit you actually wear after — at the graduation dinner, at family weddings, at first interviews. We do not sell costume suits that look great once and live in a closet after. Most graduation customers walk out of GA Suit Warehouse with a suit they will rotate for the next 3 to 5 years.',
    body: 'For high school graduation: the gown is going on and off in photos, so the shirt collar, tie, and lapels are visible. We recommend modern fit in navy or charcoal, white dress shirt, conservative tie. Color suits are fine for outdoor or evening graduations but the dark neutrals always photograph cleaner under a gown. For college graduation: the same advice, but stepped up in fabric — Super 110s minimum, because this suit is going to your first job interviews. For graduate school (medical school, law school, MBA): charcoal modern or classic fit, premium fabric, treat it as your first professional suit and budget accordingly. We coordinate family photos at the fitting too — most graduation customers come in with a parent or sibling who also needs a suit, and we run combined fittings to streamline.',
    serviceType: 'Graduation suits',
    faqs: [
      ['What color suit should I wear for graduation?', 'Navy or charcoal. Both photograph cleanly under a graduation gown and both work as everyday professional suits after the ceremony. Black is acceptable but reads slightly more formal. Color suits (burgundy, green, blue) photograph well outdoors but limit the suit\'s use afterward.'],
      ['Should I buy or rent for graduation?', 'Buy. Graduation suits get worn 6 to 10 more times in the year after — interviews, family events, weddings, dinners. Rentals do not fit as well, do not photograph as well, and cost half what a buy would on a per-wear basis once you do the math. We have starter graduation suits at $199 that look as sharp as a $400 rental.'],
      ['How early should I order my graduation suit?', '4 to 6 weeks before the ceremony. That covers fitting, alterations, and a final try-on under the actual gown if the school provides one early. If you are inside 2 weeks, walk in and we will rush alterations same-day for $10 above standard.'],
      ['Can my parents fit at the same time?', 'Yes — graduation is a family event and most of our graduation fittings include a parent who also needs a suit for the ceremony or graduation dinner. We schedule combined family fittings and offer a 10 percent multi-suit family discount when 2+ family members buy in the same visit.'],
      ['Will my graduation suit work for a job interview after?', 'If you buy navy or charcoal modern or classic fit — yes, perfectly. That is the entire point. We steer graduation customers toward suits that double as interview suits, because the second use case is statistically guaranteed to come up within 3 months.'],
    ],
    relatedKeys: ['suits/business-interview', 'suits/homecoming', 'suits/modern-fit'],
    pricing: [
      ['Starter graduation suit (modern or classic fit)', '$199', '3-5 business days'],
      ['Premium graduation suit (Super 110s)', '$349', '3-5 business days'],
      ['Family multi-suit discount (2+ in same visit)', '10% off', '3-5 business days'],
      ['Same-day rush alterations', '+$10', 'Walk in by 11am'],
    ],
  },
  {
    slug: 'church', dir: 'suits', hub_path: '/suits', hub_name: 'Suits',
    name: 'Church Suits',
    description: 'Church suits in Gainesville, GA. Sunday-ready three-piece, classic two-piece, and traditional cuts. Stocked colors include white, navy, and grey.',
    intro: 'Church wear in north Georgia spans every tradition — Baptist, Methodist, AME, Catholic, Pentecostal, non-denominational — and dress codes range from coat-and-tie casual to formal three-piece. What unites them is that the suit signals respect for the space, and the cut matters more than the trend. Church suits we sell most often: three-piece in classic or modern fit, traditional two-piece in conservative colors, and lighter-weight summer suits for July and August Sundays in non-air-conditioned sanctuaries.',
    body: 'For most weekly Sunday wear: a modern fit two-piece in navy or charcoal handles 95 percent of services and special occasions (baptisms, communions, dedications). For deacon, minister, or church leadership: a three-piece in classic fit signals authority and reads cleanly under a robe or stole when applicable. For Easter and high holidays: many congregations expect a lighter color — cream, light grey, or stone — and we stock those seasonally starting in February. For funerals and memorials in church settings: navy or charcoal, never bright colors. We carry church suits across 36S through 60L including big and tall, and we tailor to a relaxed sit-and-stand fit (slightly more room in the seat, slightly looser through the chest) appropriate for services where you stand, sit, and rise repeatedly.',
    serviceType: 'Church suits',
    faqs: [
      ['Do you carry traditional Black church suit styles?', 'Yes — three-piece suits with vest detailing, double-breasted classic fit, longer-line jackets, and traditional palette options including burgundy, gold accent, royal blue, and cream. We stock these year-round and our tailors are familiar with the cut traditions and proportions that matter for Black church wear in the AME, Baptist, and COGIC traditions specifically.'],
      ['What weight fabric is best for summer church services?', 'Tropical wool or wool blend in 7 to 8 ounce weight. Many older sanctuaries in Hall County run hot in July and August and a heavyweight winter wool will be punishing. We stock summer-weight suits in cream, light grey, navy, and stone starting March each year. Linen blends are also available for the most casual summer dress codes.'],
      ['Are three-piece suits standard for church?', 'For deacons, ministers, and church leadership, often yes. For lay members it varies by congregation — some churches lean three-piece for Sunday formals and high holidays, others prefer two-piece for weekly wear. Match what your pastor and the older men in your congregation wear, and you will be calibrated correctly. We will ask which church you attend at the fitting and adjust recommendations accordingly.'],
      ['Do you do alterations for senior church members?', 'Yes. Many of our church customers are over 65 and we tailor for comfort and ease of movement — slightly relaxed waist, longer rise on the trousers, looser sleeve. Dress shirts get adjusted collars to accommodate aging neck circumference. We have served the Hall County church community for years and the senior fit is one of our specialties.'],
      ['What colors are appropriate for an Easter church service?', 'Lighter than weekly Sunday wear. Cream, light grey, stone, light blue, and pastel-accent ties are all on-tradition for Easter in most Christian traditions. Avoid black on Easter — it reads as funeral. We expand our light-color church suit inventory each February in time for Easter season and Spring high holidays.'],
    ],
    relatedKeys: ['suits/funeral', 'suits/three-piece', 'suits/classic-fit'],
    pricing: [
      ['Standard church two-piece (navy, charcoal, grey)', '$229', '3-5 business days'],
      ['Three-piece church suit', '$329', '3-5 business days'],
      ['Summer-weight church suit (tropical wool)', '$279', '3-5 business days'],
      ['Big & tall church suit', '$299+', '3-5 business days'],
    ],
  },
  {
    slug: 'boys-and-kids', dir: 'suits', hub_path: '/suits', hub_name: 'Suits',
    name: 'Boys & Kids Suits',
    description: 'Boys & kids suits in Gainesville, GA. Sizes 2T to 18, hem allowance for growth, on-site tailoring, color matching for weddings and ceremonies.',
    intro: 'A kids\' suit needs to fit cleanly today and have enough hem allowance to last past the next growth spurt — because a boy who fits a size 8 in March may need a 10 by July, and the suit you buy for cousin\'s wedding in April should still work for grandpa\'s birthday in October. We pattern our boys\' suits with extra hem allowance built into the trousers and sleeves so a tailor can let them out as the boy grows.',
    body: 'We carry boys\' and kids\' suits across the full size run: 2T, 3T, 4T, 5, 6, 7, 8, 10, 12, 14, 16, 18, plus husky variations. Most ceremonial occasions — weddings, ring bearer duties, baptisms, communions, funerals, school formals, quinceañera courts — need a coordinated look that matches an adult suit somewhere in the family or the wedding party. We color-match boys\' suits to adult inventory across 24 standard colors so a 6-year-old ring bearer\'s navy suit reads as the same navy as the groom\'s. Tailors hem trousers, take in waists, and shorten sleeves on-site in 3 to 5 days. For boys with significant growth between purchase and event, we leave 2 inches of hem allowance and offer a free re-hem within 90 days if the timeline stretches.',
    serviceType: 'Boys and kids suits',
    faqs: [
      ['What sizes do you carry for kids and boys?', 'Toddlers: 2T, 3T, 4T. Boys: 5, 6, 7, 8, 10, 12, 14, 16, 18, plus husky cuts at 8H, 10H, 12H, 14H, 16H, 18H. Trousers run with adjustable elastic waists in toddler sizes and traditional belt-loop waists from size 8 up. Most colors and patterns are available across the size range.'],
      ['Can a kids\' suit be color-matched to an adult suit for a wedding?', 'Yes — that is a common request. Bring a swatch or a photo of the adult suit and we will pull the matching boys\' size in the same color family. For full-court matching (5+ kids in identical colors), order at least 6 weeks ahead so we can confirm dye lots match across the full inventory.'],
      ['How much do boys\' suits cost?', 'Toddler suits (2T-4T): $89-$129. Boys 5-7: $119-$159. Boys 8-18: $129-$199. Husky cuts: $149-$219. Full tuxedo packages with vest, bow tie, and shoes for ring bearers run $179-$249 depending on size and accessory level.'],
      ['What if my son grows between fitting and event?', 'We build 2 inches of hem allowance into trouser hems and 1 inch into sleeves on most boys\' suits, and our tailors can let those out for free if the suit is bought within 90 days of the event. If a child outgrows a size entirely (boys 8-12 do this fast), we offer a 30 percent trade-in credit on the next size up within 90 days.'],
      ['Do you do communion and baptism suits?', 'Yes — white communion suits in sizes 5 through 12 are stocked seasonally (March through May for First Communion season). Baptism suits and christening outfits in white and cream are stocked year-round in toddler sizes. Both can be tailored on-site in 3 to 5 days and we coordinate the look with family members\' attire on request.'],
    ],
    relatedKeys: ['suits/quinceanera', 'weddings/groomsmen-suits', 'suits/homecoming'],
    pricing: [
      ['Toddler suit (2T-4T)', '$89-$129', '3-5 business days'],
      ['Boys suit (5-18)', '$129-$199', '3-5 business days'],
      ['Husky cut boys suit', '$149-$219', '3-5 business days'],
      ['Ring bearer tuxedo package', '$179+', '3-5 business days'],
    ],
  },
  {
    slug: 'sport-coats-and-blazers', dir: 'suits', hub_path: '/suits', hub_name: 'Suits',
    name: 'Sport Coats & Blazers',
    description: 'Sport coats & blazers in Gainesville, GA. Patterned, textured, and solid blazers worn standalone — not part of a suit. Tailored on-site.',
    intro: 'A sport coat or blazer is a tailored jacket worn without matching trousers — different rules, different fabrics, different occasions than a suit jacket. The line gets blurred online but the distinction matters: you cannot wear a navy suit jacket as a blazer (the fabric is too refined and the cut reads weird without the matching trousers), and you cannot wear a tweed sport coat to a black-tie event no matter how nicely it is tailored.',
    body: 'Blazers and sport coats live in the smart-casual to business-casual range. A solid navy blazer with grey trousers is the classic American look — works at the office (in casual industries), at dinner, at less formal weddings, and as a travel jacket. A patterned sport coat (glen check, herringbone, plaid, hopsack) goes with charcoal trousers, tan chinos, or even dark denim depending on the occasion. Texture is what separates a great sport coat from a great suit jacket — tweed, hopsack, linen, flannel, corduroy. Suit jackets are smooth wool because they need to look polished. Sport coats can have weight and grip because they read intentional and personal. We stock 2-button modern fit blazers in navy, mid-grey, and charcoal across 36S through 56L, plus a rotating pattern wall (currently glen check, charcoal herringbone, brown plaid, navy hopsack) that turns over seasonally. Master tailors fit and finish in 3 to 5 days.',
    serviceType: 'Men\'s sport coats and blazers',
    faqs: [
      ['What is the difference between a blazer and a sport coat?', 'Technically: a blazer is solid (most often navy) with metal buttons, derived from naval and rowing club origins. A sport coat is patterned or textured (tweed, herringbone, glen check, plaid) with horn or fabric-covered buttons. Practically: the terms are used interchangeably in American menswear and you do not need to overthink it.'],
      ['Can I wear my suit jacket as a blazer?', 'Generally no. Suit jackets are made of smooth, refined wool that reads strange paired with non-matching trousers. The cut is also typically less casual than a true blazer. There are exceptions — some unstructured suit jackets in textured fabrics work standalone — but the safe rule is: buy a real blazer for blazer use and keep your suit jackets with their matching trousers.'],
      ['What trousers go with a navy blazer?', 'Mid-grey or charcoal flat-front dress trousers are the safest. Tan or stone chinos read more casual and are appropriate for smart-casual offices. Darker denim works for true casual occasions. Avoid black trousers with a navy blazer — the contrast reads off. White trousers work in summer with a navy blazer and read distinctly nautical.'],
      ['How should a sport coat fit differently than a suit jacket?', 'A sport coat can sit slightly looser than a suit jacket because it is meant to be worn over varied trouser weights and shirts. The shoulder still fits clean, but the chest can have a quarter inch more room and the waist suppression can be subtler. We tailor sport coats with a slightly more relaxed cut by default and adjust based on customer preference.'],
      ['Do you carry textured fabrics like tweed and hopsack?', 'Yes — tweed in autumn and winter (October through February), hopsack year-round, herringbone in mid-weight wool year-round, and glen check in lighter weight for spring and summer. Linen and linen-blend sport coats arrive in March for spring and summer wear. Pattern selection rotates with the season; ask what is in stock when you visit.'],
    ],
    relatedKeys: ['suits/dress-pants', 'suits/modern-fit', 'suits/casual-wear'],
    pricing: [
      ['Solid navy blazer (modern fit)', '$199', '3-5 business days'],
      ['Patterned sport coat (glen check, herringbone)', '$249', '3-5 business days'],
      ['Tweed sport coat (seasonal)', '$299', '3-5 business days'],
      ['Linen sport coat (spring/summer)', '$229', '3-5 business days'],
    ],
  },
  {
    slug: 'dress-pants', dir: 'suits', hub_path: '/suits', hub_name: 'Suits',
    name: 'Dress Pants',
    description: 'Dress pants in Gainesville, GA. Flat-front and pleated, in wool, wool blend, and chino. Hemmed on-site, paired with blazers or worn standalone.',
    intro: 'Dress pants are the most-bought, least-considered piece of menswear. Most guys own two pairs that came with suits, two pairs of khakis from a department store, and that is the whole rotation. We sell a lot of standalone dress pants because once a customer realizes a real pair of wool flat-front trousers tailored properly will outlast and outperform any chino, they buy three pairs.',
    body: 'Standalone dress pants come in three categories. Wool dress trousers (charcoal, navy, mid-grey, black) are the workhorse — pair with any blazer, any dress shirt, dress every business-casual office in north Georgia. Wool blend or polyester blend dress pants are the budget option — half the price, 80 percent of the look, faster wrinkle release if you travel. Chinos are casual dress pants in cotton or cotton blend (tan, stone, navy, charcoal) for smart-casual offices and weekend dressed-up. We stock all three in flat-front modern fit (the default) and pleated classic fit (for traditional cuts and bigger builds). Hems are done on-site in same-day to 3 days depending on volume. Cuffs add $5; pleats are an alteration we do not perform after the fact, so order pleated or flat-front as you want it.',
    serviceType: 'Men\'s dress pants',
    faqs: [
      ['What is the difference between flat-front and pleated dress pants?', 'Flat-front pants have a clean, smooth front from waist to hem — the modern, leaner look. Pleated pants have one or two folds at the waist that release fabric across the front of the thigh, providing extra room. Flat-front works on lean and average builds and reads modern. Pleats work on heavier or athletic builds (large thighs, larger waist) and read more traditional.'],
      ['What dress pant break should I get?', 'For business and modern looks: half break (one slight fold above the shoe). For traditional and classic fits: full break (the hem rests on the shoe, one clean fold). For very modern, fashion-forward looks: no break (the hem stops just above the shoe). We default to half break for most customers and adjust based on cut and personal preference.'],
      ['How much do hem alterations cost?', 'Standard hem with no cuff: $15. Hem with cuff added: $20. Same-day rush hem: +$10 above standard. Most dress pants we sell come unhemmed and the hem is included in the purchase price; only a re-hem on a previously hemmed pair carries the alteration charge.'],
      ['Can dress pants be worn casually with a polo or sweater?', 'Wool dress pants — generally no, they look out of place with truly casual tops. Chinos — yes, that is exactly their use case. Wool blend dress pants — depends on the blend; the heavier and more refined the wool blend, the less casual it reads. If you want one pair of pants that bridges work and weekend, buy chinos in charcoal or stone.'],
      ['Do you stock dress pants in extended sizes?', 'Yes. Waist 28 through 56, inseam 28 through 36 stocked, longer inseams up to 38 by special order. Big and tall dress pants in classic fit run through 56. Husky cut available in select colors. Tailors on-site can let waists out 2 inches and seats out 1 inch on most patterns.'],
    ],
    relatedKeys: ['suits/sport-coats-and-blazers', 'suits/alterations', 'suits/casual-wear'],
    pricing: [
      ['Wool dress pants (flat-front, modern fit)', '$99', 'Same-day to 3 days'],
      ['Wool blend dress pants', '$69', 'Same-day to 3 days'],
      ['Chinos (cotton, casual)', '$59', 'Same-day to 3 days'],
      ['Hem (no cuff)', '$15', 'Same-day to 3 days'],
      ['Hem with cuff', '$20', 'Same-day to 3 days'],
    ],
  },
  // ===== TUXEDOS hub spokes =====
  {
    slug: 'wedding', dir: 'tuxedos', hub_path: '/tuxedos', hub_name: 'Tuxedos',
    name: 'Wedding Tuxedos',
    description: 'Wedding tuxedos in Gainesville, GA. Black tie, ivory dinner jacket, navy formal, and full groom + groomsmen tuxedo packages. Tailored on-site.',
    intro: 'A wedding tuxedo is not a rental call — it is the photo you live with for 50 years. We take the same fitting time on a wedding tuxedo as we do on a custom suit, because the suit hangs in a closet a few times a year but the wedding photo hangs on a wall forever. Wedding tuxedos at GA Suit Warehouse are sold to keep, tailored to the groom\'s frame, and coordinated across the entire groomsmen party.',
    body: 'The three wedding tuxedo silhouettes that win in 2026: option one — classic black notch lapel or shawl collar tuxedo with a white pleated shirt, black bow tie, and patent leather oxfords (timeless, never reads dated). Option two — midnight navy tuxedo with a black satin lapel (reads richer than black on camera and unique without being trendy). Option three — ivory dinner jacket with black trousers (summer wedding, outdoor venue, golden hour photos). For groomsmen: keep them in black tuxedos one shade simpler than the groom — same lapel style, same bow tie color, simpler shirt. The visual hierarchy in photos is: groom slightly different, groomsmen uniform behind him. We coordinate the full party at one fitting whenever possible. Standard turn 3 to 5 weeks for full groomsmen orders, 3 to 5 days for groom-only.',
    serviceType: 'Wedding tuxedos',
    faqs: [
      ['Should I buy or rent my wedding tuxedo?', 'Buy, in nearly every case. The fit is significantly better, you have it for life, the per-wear math works out cheaper than 2 to 3 future rentals, and the photos are dramatically better in a tailored tuxedo than a rented one. Rentals make sense for groomsmen who genuinely will not wear a tuxedo again — but for the groom, buy.'],
      ['What is the difference between a notch lapel and a shawl collar tuxedo?', 'Shawl collar is a single curved lapel that wraps around the chest — the most formal, classic, and reads richest in photos. Notch lapel is the standard suit-style lapel with a small notch cut into it — slightly less formal but more versatile. Peak lapel is the third option — pointed lapels that read bold and modern. For weddings we recommend shawl for traditional black-tie and notch for slightly less formal evening weddings.'],
      ['Can groomsmen wear a different tuxedo than the groom?', 'Slightly different is good — radically different is bad. The visual rule: groom in shawl collar, groomsmen in notch lapel (same color). Or groom with a unique bow tie color, groomsmen in black bow ties. Or groom with a vest, groomsmen in cummerbunds. Pick one differentiator. Two or more differences make the photo look chaotic.'],
      ['How early should the wedding party order tuxedos?', '4 to 5 months out is ideal. Tuxedo inventory in specific colors and sizes can run thin in May and June (peak wedding season), so ordering early secures the lot. For tighter timelines (under 8 weeks) we will work with what is in stock and rush if needed, but options narrow.'],
      ['Do you do destination wedding tuxedo shipping?', 'Yes. Wedding tuxedos can be shipped to destination wedding venues domestically or internationally. We package each groomsman\'s set individually with tailoring complete and labeled with name. Shipping cost varies by destination; for Caribbean and Mexico destinations it usually runs $80 to $150 per set door-to-door.'],
    ],
    relatedKeys: ['tuxedos/black-tie', 'weddings/groom-suits', 'weddings/groomsmen-suits'],
    pricing: [
      ['Classic black notch tuxedo (groom)', '$449', '3-5 business days'],
      ['Shawl collar wedding tuxedo (groom)', '$499', '3-5 business days'],
      ['Midnight navy wedding tuxedo', '$499', '3-5 business days'],
      ['Ivory dinner jacket', '$399', '3-5 business days'],
      ['Groomsmen tuxedo (per groomsman)', '$349', '3-5 weeks (full party)'],
    ],
  },
  {
    slug: 'slim-fit', dir: 'tuxedos', hub_path: '/tuxedos', hub_name: 'Tuxedos',
    name: 'Slim Fit Tuxedos',
    description: 'Slim fit tuxedos in Gainesville, GA. Modern silhouette for prom, weddings, and galas. Tapered chest, slimmer trouser, master tailored.',
    intro: 'Slim fit tuxedos are what you wear when the formality is dialed up but the silhouette is dialed modern. The cut is the same as our slim fit suits — closer through the chest, suppressed at the waist, tapered trousers — but built around tuxedo construction (satin lapels, satin stripe down the trouser, no belt loops). Most of our prom tuxedo orders are slim fit, and an increasing share of younger grooms are choosing slim over classic for weddings.',
    body: 'A slim fit tuxedo reads sharp and contemporary in photos — it does not read like a rental and it does not read like a vintage shawl-collar piece your grandfather wore. The lapels are usually 2.5 to 2.75 inches wide (rather than 3.25 to 3.5 inches on classic tuxedos), the bow tie pairs slimmer (2.25 to 2.5 inches), and the trouser ends in a 15 to 15.5 inch hem with a clean half-break over a slimmer-toe patent leather shoe. We stock slim fit tuxedos in classic black notch lapel, classic black shawl collar, midnight navy, white dinner jacket, and burgundy. Sizes 36S through 50R fit the standard slim build; for athletic builds (broad shoulders, larger thighs) we steer toward modern fit instead because slim will pull. Tailoring on-site, 3 to 5 business days for grooms, 3 to 5 weeks for full slim-fit groomsmen orders.',
    serviceType: 'Slim fit tuxedos',
    faqs: [
      ['Is slim fit too modern for a wedding tuxedo?', 'Not anymore. Slim fit tuxedos are now standard for younger grooms (typically 22 to 35 years old) and for weddings with a contemporary aesthetic. For very traditional weddings or older grooms, classic fit reads more appropriate. The wedding theme and the groom\'s personal style dictate the choice.'],
      ['Can a slim fit tuxedo be tailored if I am not lean?', 'Slim fit is patterned for leaner builds. If you are athletic with broad shoulders, the slim cut will pull at the chest and seat. We will be honest at the fitting and steer you toward modern fit if slim is fighting your frame. Modern fit tuxedos still read contemporary without forcing a body type into a pattern that does not fit.'],
      ['What tuxedo color is best in slim fit?', 'Classic black is the safest and most universally appropriate. Midnight navy reads richer in photos and is unique without being trendy. White dinner jackets work for summer outdoor weddings. Burgundy is bold and works for weddings under 60 guests where personal style is part of the show. We stock all four in slim fit.'],
      ['Do slim fit tuxedos come in big and tall?', 'No. Slim fit by pattern definition does not grade into big and tall sizes. We offer a "tapered modern" tuxedo in big and tall sizes that captures a leaner read without forcing the slim pattern onto a larger frame. Tapered modern is available in black notch and black shawl through 56R.'],
      ['What shoes pair with a slim fit tuxedo?', 'Slim-toe patent leather oxfords (formal) or sleek velvet loafers (less formal, contemporary). Avoid chunky cap-toe oxfords with slim fit tuxedos — the proportions clash. We stock both in our shoe section. Black is the only correct color for shoe choice with a black tuxedo; midnight navy tuxedos pair with black or very dark brown.'],
    ],
    relatedKeys: ['tuxedos/wedding', 'tuxedos/black-tie', 'prom/tuxedos'],
    pricing: [
      ['Slim fit black tuxedo (notch or shawl)', '$449', '3-5 business days'],
      ['Slim fit midnight navy tuxedo', '$499', '3-5 business days'],
      ['Slim fit white dinner jacket', '$399', '3-5 business days'],
      ['Slim fit burgundy tuxedo', '$499', '3-5 business days'],
    ],
  },
  {
    slug: 'white', dir: 'tuxedos', hub_path: '/tuxedos', hub_name: 'Tuxedos',
    name: 'White Tuxedos',
    description: 'White tuxedos in Gainesville, GA. Ivory and white dinner jackets, full white tuxedo sets, summer formal wear. Tailored on-site.',
    intro: 'White tuxedos and white dinner jackets are summer formalwear — they belong at outdoor evening weddings, beach galas, summer charity balls, and resort black-tie events. They do not belong indoors in winter, do not belong at funerals, and do not belong at conservative church weddings before 5 PM. The right occasion makes a white tuxedo extraordinary. The wrong occasion makes it look costumed.',
    body: 'There are two white-tuxedo silhouettes most customers want. Option one is the white dinner jacket — a white tuxedo jacket worn with black formal trousers, black bow tie, and white pleated shirt. This is the classic "James Bond Goldfinger" look and it reads retro-formal in the best way. Most appropriate for summer black-tie weddings, charity galas, and yacht-club style events. Option two is the full white tuxedo — both white jacket and white trousers. This is the bolder, harder-to-pull-off look — most appropriate for tropical or beach weddings, summer prom, and certain quinceañera courts. We stock white dinner jackets in 36S through 52R year-round and full white tuxedos in 38R through 50R seasonally (March through September). Tailoring on-site, 3 to 5 business days. Whites tend to show shoulder slope, sleeve length, and chest pull more visibly than black does, so the fit needs to be sharper than usual — we adjust accordingly at the fitting.',
    serviceType: 'White tuxedos and white dinner jackets',
    faqs: [
      ['When is a white tuxedo appropriate?', 'Outdoor evening weddings in late spring, summer, and early fall. Beach and tropical weddings any time of year. Summer charity galas after 5 PM. White-tie summer events (rare in Hall County). Avoid white tuxedos for: indoor winter weddings, formal indoor galas in October through April, daytime weddings, and any event where the dress code is "black tie" without further specification.'],
      ['What is the difference between a white tuxedo and an ivory dinner jacket?', 'White is true bright white — reads sharp and clean but can look stark in indoor lighting. Ivory is a slight cream-warm shade that reads softer and works better in mixed lighting. For older grooms or vintage-themed weddings we recommend ivory. For contemporary or beach weddings we recommend white. Both are equally formal.'],
      ['Can I wear a white tuxedo to a black-tie event?', 'A white dinner jacket with black trousers — yes, that has been formal-evening-appropriate since the 1930s. A full white tuxedo (white jacket and white trousers) — only at outdoor or tropical events. Indoor formal galas should default to black tuxedos with the rare exception of summer events explicitly inviting white-tie alternatives.'],
      ['Do white tuxedos stain easily?', 'Yes — that is the trade-off. We recommend bringing a stain pen for the event and dry-cleaning within 48 hours after wearing. Most white-tuxedo customers wear theirs once a year and dry-clean immediately after. We stock formal stain pens at the front desk for $8 if you want to grab one before an event.'],
      ['Do you carry white tuxedos in big and tall?', 'White dinner jackets through 52R year-round. Full white tuxedos special-order through 56R with 4 to 6 weeks lead time. Most big-and-tall customers default to white dinner jacket with black trousers because the contrast slims the silhouette in photos versus full-white head-to-toe.'],
    ],
    relatedKeys: ['tuxedos/wedding', 'tuxedos/black-tie', 'tuxedos/gala'],
    pricing: [
      ['White dinner jacket (with black formal trousers)', '$399', '3-5 business days'],
      ['Ivory dinner jacket', '$429', '3-5 business days'],
      ['Full white tuxedo (jacket + trousers)', '$499', '3-5 business days'],
      ['White tuxedo big & tall (special order)', '$579', '4-6 weeks'],
    ],
  },
  // ===== ALTERATIONS hub + spokes =====
  {
    slug: '', dir: '', hub_path: '/alterations', hub_name: 'Alterations',
    name: 'Alterations & Tailoring',
    file: 'alterations.html',
    isHub: true,
    description: 'Alterations & tailoring in Gainesville, GA. Master tailors on-site for suits, shirts, formalwear, men\'s clothing, and kids\' clothing. 3-5 day standard turn.',
    intro: 'Most "tailors" in north Georgia are dry cleaners with a sewing machine in the back. We are the opposite — full alterations and tailoring department staffed by master tailors who do nothing but fit and finish menswear, women\'s formalwear, and kids\' clothing. If a garment can be altered to fit better, we can do it. If it cannot, we will tell you upfront before charging.',
    body: 'Our alterations department covers five categories: suit alterations (jackets and trousers), shirt tailoring (collars, sleeves, taper), formal wear tailoring (tuxedos, gowns, ceremonial dress), men\'s clothing alterations (chinos, casual shirts, outerwear), and kids\' clothing alterations (school uniforms, suits, dresses). Standard turn is 3 to 5 business days for most alterations, with same-day rush available on hems and waist work for $10 above standard. Walk-ins welcome; appointments preferred for full re-fits or wedding party work. Pricing is line-item — we quote each alteration before you commit and never bundle in surprise charges. Master tailors on staff have 15+ years of experience each and can handle complex jobs (lapel re-shaping, jacket re-balancing, gown bodice rebuilds) that most local shops will turn down.',
    serviceType: 'Alterations and tailoring services',
    faqs: [
      ['How much do alterations cost?', 'Hem trousers (no cuff): $15. Hem with cuff: $20. Take in waist (one inch): $20. Take in jacket sides: $35. Sleeve length (jacket): $35. Sleeve length (shirt): $25. Collar adjust: $15. Wedding gown hem: $80-$150. Full price list at the counter; we quote any non-standard work before starting.'],
      ['How long do alterations take?', 'Standard turn 3 to 5 business days. Same-day rush on hems and waist for $10 above standard, walk in by 11 AM. Wedding party work and complex re-fits run 1 to 2 weeks; we set the timeline at the fitting.'],
      ['Can you alter clothing not bought from your store?', 'Yes — we alter any menswear, formalwear, or kids\' clothing brought in, regardless of where it was purchased. Same pricing as in-house garments. Bring it on a hanger or in a garment bag and walk in or schedule.'],
      ['Do you do wedding gown alterations?', 'Yes — hem, bodice, bustle, and full re-fits. Wedding gown alterations run $80 to $300 depending on complexity. We require 6 to 8 weeks before the wedding for gown work; we cannot rush gown alterations the same way we rush suit alterations.'],
      ['Are walk-ins welcome for alterations?', 'Yes — walk in any day during business hours (Mon-Sat 10am-7pm, Sun 12pm-6pm). For complex work or wedding party fittings, we recommend booking ahead so a tailor is available without wait. Quick alterations (hems, waist) we handle walk-in any time.'],
    ],
    relatedKeys: ['suits/alterations', 'alterations/shirts', 'alterations/formal-wear'],
    pricing: [
      ['Trouser hem (no cuff)', '$15', '3-5 business days'],
      ['Trouser waist (in/out one inch)', '$20', '3-5 business days'],
      ['Jacket side seams', '$35', '3-5 business days'],
      ['Jacket sleeve length', '$35', '3-5 business days'],
      ['Shirt sleeve length', '$25', '3-5 business days'],
      ['Same-day rush (hems, waist)', '+$10', 'Walk in by 11am'],
    ],
  },
  {
    slug: 'shirts', dir: 'alterations', hub_path: '/alterations', hub_name: 'Alterations',
    name: 'Shirt Tailoring',
    description: 'Shirt tailoring in Gainesville, GA. Sleeve length, collar adjust, body taper, and side seams on dress shirts and casual shirts. On-site tailors.',
    intro: 'Off-the-rack dress shirts are sized for a body that does not exist — designed to fit a 50th-percentile man across height, build, and arm length all at once. Most men\'s shirts fit two of those three parameters and are wrong on the third. Shirt tailoring fixes the third one. The most common adjustments we do: sleeve length (the cuff should sit at the wrist bone with arm relaxed), body taper (the shirt should sit close at the waist when tucked, not balloon), and collar adjust (the collar should close cleanly around the neck without excess fabric or visible tension).',
    body: 'A properly tailored dress shirt is the difference between a $40 shirt and a $200 shirt — the construction and fabric matter, but the fit matters more. We tailor shirts in three main areas. Sleeve length is the most common — we shorten or lengthen sleeves to land at the wrist bone, $25 standard. Body taper through the side seams reduces blousing at the waist when tucked into trousers, $25 standard. Collar adjust either tightens or loosens the collar circumference for a cleaner closure, $15 standard. We also do shoulder narrowing on shirts where the seam sits past the deltoid (rare and complex, $45+), and full body re-cuts where a customer has lost or gained significant weight ($60+, sometimes not worth doing — we will tell you). Standard turn 3 to 5 days; rush on simple sleeve and waist jobs for $10 extra.',
    serviceType: 'Dress shirt and casual shirt tailoring',
    faqs: [
      ['How much does shirt tailoring cost?', 'Sleeve length: $25. Body taper through side seams: $25. Collar adjust: $15. Shoulder narrowing (rare): $45+. Cuff replacement: $30. Full body re-cut: $60+. Most customers spend $25 to $50 per shirt to bring it from off-the-rack to genuinely fitted.'],
      ['Is it worth tailoring a $40 shirt?', 'Yes — a tailored $40 shirt looks better than an untailored $150 shirt. Spending $25 on a body taper and $25 on sleeves brings a basic dress shirt to a level most off-the-rack premium shirts cannot match without their own tailoring. For everyday work shirts, this is the highest-ROI menswear spend you can make.'],
      ['Can you tailor casual shirts and polos?', 'Yes — same alterations, same pricing. Casual button-downs and polos benefit from body taper and sleeve adjust the same way dress shirts do. Polos sometimes need a shoulder seam tightening if the customer is between sizes, which runs $30.'],
      ['How long do shirt alterations take?', 'Standard turn 3 to 5 business days. Same-day rush on sleeve and waist jobs for $10 above standard, walk in by 11 AM. Complex jobs (shoulder narrowing, full re-cut) take 7 to 10 days because they require more careful work.'],
      ['Should I bring multiple shirts at once?', 'Yes — and we encourage it. We discount multi-shirt alteration packages: 5+ shirts at once gets 10 percent off the alteration total. Most customers come in once or twice a year with 4 to 6 shirts and have all of them tailored together. Cleaner workflow for us, better pricing for you.'],
    ],
    relatedKeys: ['accessories/dress-shirts', 'alterations/mens-clothing', 'suits/alterations'],
    pricing: [
      ['Sleeve length', '$25', '3-5 business days'],
      ['Body taper (side seams)', '$25', '3-5 business days'],
      ['Collar adjust', '$15', '3-5 business days'],
      ['Cuff replacement', '$30', '3-5 business days'],
      ['Multi-shirt package (5+)', '10% off', '3-5 business days'],
    ],
  },
  {
    slug: 'formal-wear', dir: 'alterations', hub_path: '/alterations', hub_name: 'Alterations',
    name: 'Formal Wear Tailoring',
    description: 'Formal wear tailoring in Gainesville, GA. Tuxedos, gowns, dinner jackets, and ceremonial dress fitted by master tailors. 6-8 weeks for wedding gowns.',
    intro: 'Formalwear is built differently than business clothing and needs to be tailored differently. Tuxedos have satin lapels that cannot be re-shaped without specialty work. Wedding gowns have boned bodices, multi-layer skirts, and bustles that take careful attention. Bridesmaid dresses, prom gowns, and ceremonial dress all have construction quirks that distinguish them from everyday clothing.',
    body: 'Our formalwear tailoring department handles three categories. Tuxedo alterations: hem, waist, sleeve, side seams, and lapel re-shaping. Standard turn 3 to 5 days for everything except lapel work (1 to 2 weeks). Wedding gown alterations: hem, bodice taper, bustle creation, train length, strap adjust. Standard turn 6 to 8 weeks; we cannot rush gown work because the construction is too involved. Other formalwear: bridesmaid dresses, prom gowns, mother-of-the-bride dresses, debutante gowns, ceremonial dress (academic regalia, military dress uniforms, religious vestments). Each has its own approach and pricing — we quote at the consultation. Master tailors on staff have decades of formalwear experience including beaded gown work, boned bodice rebuilds, and complex multi-layer skirt hemming.',
    serviceType: 'Formal wear tailoring including tuxedos and gowns',
    faqs: [
      ['How much do tuxedo alterations cost?', 'Standard turn pricing: trouser hem $15, jacket sleeve $35, jacket side seams $40, lapel re-shape $80+. Tuxedo alterations are slightly more expensive than suit alterations because of satin lapel and trim handling. Most grooms spend $80 to $150 total on tuxedo alterations.'],
      ['How long do wedding gown alterations take?', '6 to 8 weeks minimum. Wedding gowns have boned bodices, multi-layer skirts, and bustles that need to be sewn precisely. We will not rush gown work because the risk of mistakes is too high and the gown is too important. Plan for 8 weeks if at all possible.'],
      ['How much do wedding gown alterations cost?', 'Hem: $80-$150 depending on layers and beading. Bodice taper: $80-$200. Bustle creation: $120-$200. Strap adjust: $40-$80. Train length adjust: $60-$120. Full multi-area gown alteration runs $300 to $600 commonly. We quote at the consultation before any work starts.'],
      ['Do you alter bridesmaid and prom dresses?', 'Yes. Standard turn 3 to 5 weeks for bridesmaid work (faster than wedding gowns because the construction is usually simpler) and 2 to 4 weeks for prom dresses depending on complexity. Pricing similar to gown alterations but typically lower because the dresses themselves are less complex.'],
      ['Can you handle ceremonial dress (academic regalia, military, religious)?', 'Yes. Academic robes (master\'s and doctoral regalia) hem and shoulder fit are routine. Military dress uniforms (Army Greens, Navy Service Dress, Marine Corps Dress Blues) we tailor regularly. Religious vestments (clergy stoles, robes, chasubles) we handle with deference to denominational specifications. Mention what type of ceremonial dress at the appointment so the right tailor handles it.'],
    ],
    relatedKeys: ['tuxedos/wedding', 'alterations/mens-clothing', 'tuxedos/black-tie'],
    pricing: [
      ['Tuxedo alterations (full set)', '$80-$150', '3-5 business days'],
      ['Wedding gown alterations (full)', '$300-$600', '6-8 weeks'],
      ['Bridesmaid dress alterations', '$80-$200', '3-5 weeks'],
      ['Prom dress alterations', '$60-$150', '2-4 weeks'],
      ['Ceremonial dress (academic, military)', '$60-$200', '2-4 weeks'],
    ],
  },
  {
    slug: 'mens-clothing', dir: 'alterations', hub_path: '/alterations', hub_name: 'Alterations',
    name: 'Men\'s Clothing Alterations',
    description: 'Men\'s clothing alterations in Gainesville, GA. Casual shirts, chinos, jeans, outerwear, polos. Same tailors that do suits — applied to everyday wear.',
    intro: 'Suit and dress shirt alterations are well-understood. What most stores do not handle well is the casual everyday menswear in your closet — chinos that need a hem, polos that fit weird in the shoulders, jeans that need the waist taken in, jackets and outerwear that need sleeve adjustments. Same tailors that do our suits handle the casual side too, with the same standards.',
    body: 'Casual menswear alterations cover five common areas. Chinos and casual trousers: hem $15, waist take in $20, taper $30. Casual shirts and polos: sleeve length, body taper, shoulder narrowing — same pricing as dress shirt tailoring. Jeans: hem (chain stitch on request) $20, waist take in $25, taper $35. Outerwear (jackets, coats, vests): sleeve length $40, body alteration $60+, lining repair $30+. Sweaters and knitwear: shoulder repair, sleeve hem, body taper — pricing varies by knit type. Standard turn 3 to 5 business days, same-day rush on simple jobs for $10 extra. Bring everything together — most customers do a closet sweep once or twice a year and tailor 5 to 10 pieces in one drop-off.',
    serviceType: 'Men\'s casual clothing alterations',
    faqs: [
      ['Can you do chain-stitch hems on jeans?', 'Yes — chain-stitch hem (the original denim hem that keeps the bottom of the jeans authentic) is available on request for $25 vs $20 for standard hem. Most customers do not need chain-stitch but premium denim brands (raw denim, selvedge) look noticeably better with the original chain-stitch retained.'],
      ['Do you alter outerwear and winter coats?', 'Yes — winter coats, blazers worn casually, leather jackets, denim jackets, and field jackets. Sleeve length $40, body alteration $60+, lining repair $30+. Leather and waxed canvas alterations run higher because of specialty thread and machine requirements; we quote at the consultation.'],
      ['Can polos be altered?', 'Yes. Body taper through the side seams: $25. Shoulder narrowing (if shoulder seam sits past the deltoid): $30. Sleeve hem (less common): $20. Polos benefit from body taper especially because most off-the-rack polos balloon at the waist on lean and average builds.'],
      ['How long do casual alterations take?', 'Standard turn 3 to 5 business days. Same-day rush on simple jobs (hems, waist) for $10 extra. Complex outerwear and lining repairs take 7 to 10 days. Bring multiple pieces together for a faster overall workflow and the same per-piece turn.'],
      ['Do you do alterations on items not bought from your store?', 'Yes — we alter any men\'s clothing brought in regardless of where it was purchased. Same pricing as in-house garments. Most casual alteration customers bring items bought elsewhere because mass retailers do not offer real tailoring.'],
    ],
    relatedKeys: ['alterations/shirts', 'suits/alterations', 'suits/casual-wear'],
    pricing: [
      ['Chinos hem', '$15', '3-5 business days'],
      ['Jeans hem (standard)', '$20', '3-5 business days'],
      ['Jeans hem (chain stitch)', '$25', '3-5 business days'],
      ['Polo body taper', '$25', '3-5 business days'],
      ['Outerwear sleeve length', '$40', '3-5 business days'],
    ],
  },
  {
    slug: 'kids-clothing', dir: 'alterations', hub_path: '/alterations', hub_name: 'Alterations',
    name: 'Kids\' Clothing Alterations',
    description: 'Kids\' clothing alterations in Gainesville, GA. School uniforms, suits, dresses, formalwear. Built with growth allowance, same-day on small jobs.',
    intro: 'Kids grow fast — and the clothing has to keep up. We alter kids\' clothing with growth in mind: hem allowance left in trousers, sleeves shortened temporarily so they can be let out later, waists taken in with detachable seams when possible. Most kids\' alterations are for school uniforms, suits worn at family events, communion and baptism wear, and pageant and formalwear.',
    body: 'Five common kids\' alteration jobs we run weekly. School uniform pants: hem $12, waist take in $18 (most schools require uniform pants to fit cleanly, which is harder than it sounds when the kid is between standard sizes). Boys\' suits for weddings and events: full alteration package $40 to $80 depending on size and complexity, growth allowance preserved. Communion and baptism dresses: hem $30 to $60, sleeve and bodice adjust included. Pageant and dance dresses: $60 to $150 depending on layers and beading. Outerwear and formal coats: sleeve adjust $25, hem $20. We turn most kids\' jobs in 3 to 5 days and same-day rush on simple hems for $5 extra (lower than adult rush because the work itself is faster). For full school-year uniform fitting (4 to 6 uniform pieces), we offer a package rate.',
    serviceType: 'Kids\' and children\'s clothing alterations',
    faqs: [
      ['How much do kids\' uniform alterations cost?', 'Pants hem: $12. Waist take in: $18. Polo sleeve length: $15. Jacket sleeve length: $20. Skirt hem: $15. Most parents spend $30 to $60 per child per school year on uniform alterations across all the pieces. Multi-piece package discounts available for full uniform sets.'],
      ['Can you leave growth allowance in kids\' pants?', 'Yes — we hem with extra allowance left in the original hem so the trouser can be let out later as the child grows. Standard practice on most kids\' work. We mark the allowance amount on the receipt so you know how much room there is for future let-outs (usually 1 to 2 inches).'],
      ['How fast are kids\' alterations?', 'Standard turn 3 to 5 business days. Same-day rush on simple hems for $5 extra (cheaper than adult rush because the work itself is faster). For school uniform packages we batch the work and turn the full set in 5 to 7 days.'],
      ['Do you alter dance and pageant dresses?', 'Yes — communion, first holy communion, quinceañera, dance recital, pageant. Hem, bodice, sleeve, sash adjust. Pricing $60 to $150 depending on layers, beading, and complexity. We need 2 to 4 weeks for pageant and recital dresses; communion dresses turn in 1 to 2 weeks for the standard March-May season.'],
      ['Can communion and baptism gowns be altered?', 'Yes — communion gowns and baptism robes are bread-and-butter for our spring season. We hem, adjust sleeves, take in bodices, and add or remove sashes. Most communion gowns we turn in 1 to 2 weeks during the March-May season; baptism gowns we can rush in 3 to 5 days because the work is simpler.'],
    ],
    relatedKeys: ['suits/boys-and-kids', 'alterations/formal-wear', 'alterations/mens-clothing'],
    pricing: [
      ['Uniform pants hem', '$12', '3-5 business days'],
      ['Uniform waist take in', '$18', '3-5 business days'],
      ['Boys suit alterations (full)', '$40-$80', '3-5 business days'],
      ['Communion / baptism gown', '$30-$60', '1-2 weeks'],
      ['Pageant / dance dress', '$60-$150', '2-4 weeks'],
    ],
  },
  // ===== SHOES hub + spokes =====
  {
    slug: '', dir: '', hub_path: '/shoes', hub_name: 'Shoes',
    name: 'Men\'s Shoes',
    file: 'shoes.html',
    isHub: true,
    description: 'Men\'s shoes in Gainesville, GA. Dress shoes, loafers, wedding shoes, prom shoes, formal shoes, and kids shoes. Real leather, in-stock sizing.',
    intro: 'A suit fails without the shoes. We see it constantly — guys spend $400 on a suit and pair it with the cheap dress shoes they bought in college, and the whole look reads off. Real leather dress shoes do three things a $40 pair cannot: they fit the foot properly, they take a polish and hold a shine, and they age the right way (better with use, not worse).',
    body: 'Our shoe section covers six categories: men\'s dress shoes (oxfords, derbys, captoes), loafers (penny, tassel, bit, horsebit), wedding shoes (patent leather, formal oxford, evening loafer), prom shoes (slim-toe leather, velvet loafers), formal shoes (patent leather oxford, opera pump for white-tie), and kids shoes (boys\' dress shoes, ring bearer formal). We stock real leather across all categories and avoid the synthetic uppers that crack within a year. Sizes 7 through 14 stocked, with 13 and 14 stocked deeper than most stores because Hall County customer base runs taller and bigger-footed than national average. Half sizes available in popular models. Color range: black, dark brown, light brown, oxblood, and patent leather (formal only). Care service: shoe shine $8, leather conditioning $15, resoling referral to local cobbler.',
    serviceType: 'Men\'s dress shoes',
    faqs: [
      ['What are the most common dress shoe styles?', 'Cap-toe oxford (the classic business shoe — black or brown), plain-toe derby (slightly less formal, more comfortable), penny loafer (smart-casual, business casual), tassel loafer (slightly dressier loafer for business and weddings), monk strap (modern alternative to oxfords). Each has a use case; the cap-toe oxford in black is the most universally appropriate single shoe a man can own.'],
      ['What dress shoes match a navy suit?', 'Dark brown is the modern preferred pairing — slightly warmer in photos and reads contemporary. Black is the traditional pairing — always correct, slightly more formal. Burgundy oxblood is the bold pairing — works for weddings, prom, and personal style moments but reads off in conservative business settings.'],
      ['Do you sell shoe shine and care services?', 'Yes — shoe shine $8 (5-minute professional polish), leather conditioning $15 (deep care for older shoes), edge dressing $10. We do not resole on premises but refer to a cobbler in nearby Buford for that work. Care services available walk-in any business hour.'],
      ['What sizes do you stock?', '7 through 14 in most styles, with depth at 9 through 13 because that is the most common range in our customer base. Half sizes available in popular models (cap-toe oxford, penny loafer, derby) in size 9.5 through 12.5. Wide widths (E and EE) available in select models. Special order for unusual sizes runs 2 to 3 weeks.'],
      ['Are the shoes real leather?', 'Yes — every shoe in our store is real leather upper. We do not sell synthetic-upper "leather-look" shoes because they crack within a year and read poorly in photos. Real leather costs more upfront and lasts 10x longer with basic care, which is why we only stock real.'],
    ],
    relatedKeys: ['shoes/loafers', 'shoes/wedding', 'shoes/formal'],
    pricing: [
      ['Cap-toe oxford (black or brown)', '$149', 'In stock'],
      ['Penny loafer', '$129', 'In stock'],
      ['Derby (plain-toe or wing-tip)', '$139', 'In stock'],
      ['Patent leather formal oxford', '$179', 'In stock'],
      ['Shoe shine', '$8', 'Walk-in 5 min'],
    ],
  },
  {
    slug: 'mens-dress', dir: 'shoes', hub_path: '/shoes', hub_name: 'Shoes',
    name: 'Men\'s Dress Shoes',
    description: 'Men\'s dress shoes in Gainesville, GA. Cap-toe oxfords, derbys, monk straps in black, brown, and oxblood. Real leather, in-stock sizing.',
    intro: 'A man\'s dress shoe collection should start with a black cap-toe oxford. After that, in order: dark brown derby or oxford, penny loafer in brown, then expand based on lifestyle. Most of our customers buy their first real dress shoe in their late twenties or thirties when they realize the cheap ones from college were costing them more in replacements than a real pair would have cost upfront.',
    body: 'The five dress shoe styles every man should know. Cap-toe oxford: the formal business shoe, defined by a horizontal toe seam. Black for business and conservative settings, dark brown for weddings and modern wear. Plain-toe derby: slightly less formal than oxford, more comfortable, broader fit; works in business casual and most weddings. Whole-cut oxford: a single-piece leather construction, very formal, reads premium; for black-tie alternatives or high-end business. Monk strap: side-buckle dress shoe, modern alternative to oxford, reads contemporary; works in fashion-forward business settings. Wing-tip oxford or brogue: decorative perforated cap, slightly less formal, reads traditional and country-formal; works for weddings, less ideal for conservative business. We stock all five in black, dark brown, and oxblood (selective models) sizes 7 through 14.',
    serviceType: 'Men\'s leather dress shoes',
    faqs: [
      ['What is the difference between an oxford and a derby?', 'Construction: oxford has a closed lacing system (the lace flaps are sewn down to the vamp underneath) and derby has open lacing (the flaps sit on top of the vamp and open out). Effect: oxford reads more formal, sleeker; derby reads slightly less formal, more relaxed, fits broader feet better. Both are appropriate dress shoes; oxford for formal, derby for everyday.'],
      ['What color dress shoes do I need first?', 'Black cap-toe oxford. It is the most universally appropriate single dress shoe — works at funerals, formal weddings, conservative business, court appearances, anywhere. After that, dark brown is the second buy because it pairs with navy and grey suits more contemporarily than black. Then expand to oxblood, lighter brown, or wing-tips depending on style.'],
      ['How should dress shoes fit?', 'Heel locked with no slip when walking. Toe with a half-inch of room past the longest toe (usually the second toe, not the big toe). Width snug but not pinching across the ball of the foot. Most guys size up too much in dress shoes because they are used to athletic shoe fits — dress shoes should feel firmer and snugger than running shoes.'],
      ['How long should real leather dress shoes last?', 'Resoled twice over their lifetime, real leather dress shoes commonly last 8 to 15 years with rotation (wear two pairs in alternation, never the same pair two days in a row, use shoe trees overnight). Single-pair daily wear without rotation cuts the lifespan to 3 to 5 years. We sell shoe trees ($25/pair) at the counter and recommend them on every shoe purchase.'],
      ['Do you carry wide widths?', 'Yes — E and EE wide widths in cap-toe oxford, penny loafer, and derby across sizes 9 through 13. Special order for triple-E (EEE) runs 2 to 3 weeks. We stock wide because our customer base in Hall County runs broader-footed than coastal averages and standard widths fit only 70 percent of customers cleanly.'],
    ],
    relatedKeys: ['shoes/formal', 'shoes/loafers', 'shoes/wedding'],
    pricing: [
      ['Cap-toe oxford (black or brown)', '$149', 'In stock'],
      ['Plain-toe derby', '$139', 'In stock'],
      ['Whole-cut oxford', '$199', 'In stock'],
      ['Monk strap', '$169', 'In stock'],
      ['Wide width (E/EE)', 'Same price', 'In stock'],
    ],
  },
  {
    slug: 'loafers', dir: 'shoes', hub_path: '/shoes', hub_name: 'Shoes',
    name: 'Loafers',
    description: 'Men\'s loafers in Gainesville, GA. Penny, tassel, bit, and horsebit loafers in leather and suede. Smart-casual to dressy. In-stock sizing.',
    intro: 'Loafers are the slip-on dress shoe — no laces, no buckles, just slip in and go. Less formal than oxfords but more polished than casual shoes, loafers occupy the smart-casual and business-casual ranges. The four main styles: penny loafers (the classic, with a horizontal strap and slot), tassel loafers (decorative tassels at the front), bit loafers (metal horsebit or buckle decoration), and horsebit (Gucci-style with the trademark snaffle bit).',
    body: 'When to wear which loafer. Penny loafers: smart-casual and business casual, most universal. Brown penny with chinos and a blazer is a Saturday wedding outfit; black penny with grey trousers is business casual; loafer in any color with denim is casual sharp. Tassel loafers: dressier than penny, traditionally a lawyer-and-executive shoe, works in business and dressier social settings. Bit loafers: slightly bolder, reads fashion-forward, works in creative industries and weddings. Horsebit (Gucci-style): luxury fashion territory, reads expensive and intentional, appropriate when the rest of the outfit holds up to it. We stock penny and tassel year-round in leather and selectively in suede; bit and horsebit seasonally and in popular sizes only. All sizes 8 through 13.',
    serviceType: 'Men\'s loafers',
    faqs: [
      ['Are loafers appropriate for business?', 'Yes — penny and tassel loafers are appropriate for business casual and smart-casual offices, which covers most non-traditional industries (tech, marketing, sales, creative, modern legal). For traditional formal business (white-shoe law firms, banking, finance senior leadership), oxfords are still preferred. The dress code is loosening but not gone.'],
      ['Should I wear socks with loafers?', 'For business and dressy occasions: yes, in a color matching your trouser. For casual and summer wear: no-show socks are acceptable and increasingly common. Going completely sockless creates moisture damage to the leather over time; if you go sockless, dedicate that pair to summer wear and rotate aggressively to let them dry between wears.'],
      ['Can loafers be worn with a suit?', 'Yes — and increasingly common in modern business settings. The pairing reads contemporary: tassel loafer with a navy suit, penny loafer with a grey suit. For traditional business or formal occasions, stick with oxfords. The loafer-with-suit combination works best with modern fit suits and softer construction; it can read off with classic fit.'],
      ['What is the difference between leather and suede loafers?', 'Material: leather is smooth full-grain hide that takes polish and shines. Suede is the underside of the hide, soft and matte texture, does not polish but reads luxurious. Use cases: leather is more universal and weatherproof; suede is dressier in some contexts but ruined by rain. We stock both and recommend leather for first-buyers, suede for second-pair expansion.'],
      ['What size loafer should I get?', 'Loafers should fit slightly tighter than oxfords because there is no lacing to adjust. Heel locked, toe with a half-inch of room, snug across the instep. Size down a half from your oxford size if you are between sizes — loafers stretch slightly with wear and start tighter than they end up. We fit on-foot at the store and exchange within 7 days if the size feels off after a few wears.'],
    ],
    relatedKeys: ['shoes/mens-dress', 'shoes/wedding', 'shoes/formal'],
    pricing: [
      ['Leather penny loafer', '$129', 'In stock'],
      ['Leather tassel loafer', '$149', 'In stock'],
      ['Suede penny loafer', '$159', 'In stock'],
      ['Bit loafer', '$179', 'In stock'],
    ],
  },
  {
    slug: 'wedding', dir: 'shoes', hub_path: '/shoes', hub_name: 'Shoes',
    name: 'Wedding Shoes',
    description: 'Wedding shoes for men in Gainesville, GA. Patent leather, formal oxford, and evening loafer for grooms and groomsmen. Stocked all colors.',
    intro: 'Wedding shoes get more photo time than the suit does — the bride is in her dress, the groom is in his tuxedo, and the camera is constantly catching feet. The wrong shoe shows up in every photo as a distraction. The right shoe disappears or quietly elevates the look. We pull wedding shoes specifically for grooms and groomsmen, coordinated with the suit or tuxedo, in 3 to 5 days lead time.',
    body: 'Three wedding shoe categories. Formal black-tie weddings: patent leather oxfords or opera pumps. Patent leather is the only correct shoe with a black tuxedo at a formal indoor wedding; matte leather reads underdressed in photos. Most grooms buy patent leather oxfords ($179) and groomsmen rent or buy matte black oxfords. Semi-formal weddings: matte leather cap-toe or whole-cut oxford in black or dark brown. Most modern weddings sit here — the formality is dressed up but not strictly black-tie. Outdoor and casual weddings: brown leather oxford, derby, or loafer. For barn weddings, beach weddings, and afternoon outdoor ceremonies, brown reads warmer and more appropriate than black. We coordinate the groom\'s shoe to the tuxedo and the groomsmen\'s shoes to match in style and color, with master tailors checking the full look at the final fitting.',
    serviceType: 'Wedding shoes for grooms and groomsmen',
    faqs: [
      ['What shoes go with a black tuxedo at a formal wedding?', 'Patent leather oxford. Patent leather has the high-shine finish that reads correctly in formal photos with a tuxedo. Matte black leather oxfords are acceptable but read slightly underdressed. Avoid dark brown or any color other than black with a black tuxedo at a formal wedding.'],
      ['Can groomsmen wear different shoes than the groom?', 'Slightly different is fine, radically different reads chaotic. Groom in patent leather, groomsmen in matte black leather oxfords — works. Groom in brown leather, groomsmen in matching brown — works. Groom in patent leather, groomsmen in brown loafers — does not work, the formality clashes in photos.'],
      ['What shoes for an outdoor or beach wedding?', 'Brown leather oxford or derby for outdoor lawn and barn weddings. Loafers (brown leather or suede) for casual outdoor weddings. For beach weddings, leather loafers in tan or stone, or suede loafers if the ceremony is on grass adjacent to the beach. Avoid sandals, flip-flops, and white shoes unless the dress code explicitly invites them.'],
      ['Do you stock wedding shoes in all sizes?', 'Sizes 8 through 14 stocked in patent leather oxford, matte black oxford, dark brown oxford, and brown loafer. Sizes 7 and 15 by special order with 2 to 3 weeks lead. Wide widths available in popular models. For full groomsmen orders we coordinate sizing across all attendants and confirm fit at one fitting whenever possible.'],
      ['How much do wedding shoes cost?', 'Patent leather oxford: $179. Matte black leather oxford: $149. Dark brown oxford: $149. Brown leather loafer: $129-$159. Most grooms spend $150 to $200 on wedding shoes; groomsmen typically spend $100 to $150 if buying. Rentals available for groomsmen at $39 per pair.'],
    ],
    relatedKeys: ['shoes/formal', 'shoes/mens-dress', 'tuxedos/wedding'],
    pricing: [
      ['Patent leather oxford (groom, formal)', '$179', '3-5 business days'],
      ['Matte black leather oxford', '$149', '3-5 business days'],
      ['Dark brown leather oxford', '$149', '3-5 business days'],
      ['Brown leather loafer (outdoor wedding)', '$129+', '3-5 business days'],
      ['Groomsmen shoe rental', '$39/pair', '3-5 weeks'],
    ],
  },
  {
    slug: 'prom', dir: 'shoes', hub_path: '/shoes', hub_name: 'Shoes',
    name: 'Prom Shoes',
    description: 'Prom shoes for men in Gainesville, GA. Slim-toe leather oxfords, velvet loafers, patent leather. Bold colors for slim-fit prom suits.',
    intro: 'Prom is the one event where shoes can be loud — velvet loafers in burgundy, white patent leather oxfords, slim-toe black leather with metallic detail. Where weddings call for restraint, prom rewards intentional flair. The risk is going too far the other direction and showing up in something costumed. We pull prom shoes specifically: slimmer last, sharper toe, with color and texture options that match the slim-fit tuxedos and patterned suits prom kids actually wear.',
    body: 'Three prom shoe categories. Classic prom oxford: slim-toe black leather oxford with a sharper last than business oxfords — same construction, more contemporary silhouette. Pairs cleanly with slim-fit tuxedos and patterned prom suits. Velvet loafers: prom\'s signature shoe in 2026. Burgundy velvet, navy velvet, hunter green velvet, black velvet — slip-on, statement-making, and they read sharp in low-light prom photography. Statement leather: white patent leather oxford for a vintage prom look, oxblood plain-toe for bold contrast against navy or charcoal, metallic-detail loafers for fashion-forward prom kids. Sizes 8 through 13 stocked, special order on rare colors. Most prom shoes ship in 3 to 5 days alongside the suit or tuxedo so the whole look comes together at one pickup.',
    serviceType: 'Prom shoes',
    faqs: [
      ['What shoes go with a slim-fit prom tuxedo?', 'Slim-toe black leather oxford or velvet loafer. The proportions matter — a chunky cap-toe oxford clashes with a slim-fit tuxedo silhouette. Slim-toe oxfords keep the modern line. Velvet loafers in black or a tuxedo-coordinating color (burgundy with burgundy tux, navy with midnight navy tux) read very modern.'],
      ['Are velvet loafers appropriate for prom?', 'Yes — velvet loafers are now a defining prom shoe style for 2026. Burgundy velvet, navy velvet, hunter green velvet, and black velvet are all popular. They pair with both slim-fit suits and tuxedos and read distinctly more interesting than standard black oxfords without crossing into costume territory.'],
      ['Can I wear sneakers to prom?', 'For most Hall County high school proms, no. White leather sneakers (think classic court sneakers, premium leather construction) are starting to appear at fashion-forward proms but most schools and most parents would consider them off-dress-code. Stick with leather dress shoes or velvet loafers for prom photos.'],
      ['What color shoes for a colored prom suit (burgundy, green, navy)?', 'Brown leather loafer or oxford in a slightly darker brown than the suit. Black is acceptable but reads less coordinated. Avoid white with a colored suit — the contrast looks costumed in photos. We coordinate the shoe to the suit at the fitting; bring your suit pickup appointment with your shoe-buy appointment so we can match in person.'],
      ['How early should I order prom shoes?', '4 to 6 weeks before prom for popular sizes and colors. For velvet loafers in specific colors, push to 6 to 8 weeks because dye lots and colors run thin in peak prom season (March to May). Sizes 9 through 12 stay stocked deepest; sizes 8 and 13 can run thin in popular models by early April.'],
    ],
    relatedKeys: ['prom/suits', 'prom/tuxedos', 'shoes/formal'],
    pricing: [
      ['Slim-toe black leather oxford', '$149', 'In stock'],
      ['Velvet loafer (burgundy, navy, green, black)', '$169', '3-5 business days'],
      ['White patent leather oxford', '$179', '3-5 business days'],
      ['Statement leather (oxblood, metallic detail)', '$169', 'In stock'],
    ],
  },
  {
    slug: 'formal', dir: 'shoes', hub_path: '/shoes', hub_name: 'Shoes',
    name: 'Formal Shoes',
    description: 'Formal shoes in Gainesville, GA. Patent leather oxfords for black-tie, opera pumps for white-tie, evening loafers. Real leather, master finished.',
    intro: 'Formal shoes are the narrowest category in menswear — they exist for black-tie, white-tie, and the rare gala that demands strict formal dress. There is no business use for an opera pump and there is no casual use for patent leather. When you need formal shoes, nothing else works; when you do not, formal shoes look out of place. Most men own one pair and rotate it across formal events for years.',
    body: 'Three formal shoe categories. Patent leather oxford: the standard black-tie shoe. High-shine finish, cap-toe or plain-toe construction, paired with a black tuxedo. Reads correct in low-light formal photography in a way matte leather does not. Opera pump: the white-tie shoe — slip-on patent leather with a flat grosgrain bow at the front. Reserved for white-tie events (extremely rare in north Georgia outside of presidential balls and academic ceremonies). Evening loafer: less formal than oxford, more formal than business loafer — patent leather slip-on, often with a velvet detail, for galas and dressy private events. We stock patent leather oxfords year-round in sizes 8 through 13. Opera pumps and evening loafers in select sizes; special order with 2 to 3 weeks lead for rare requests. Care guidance: patent leather scratches easily, store in dust bags, wipe with damp cloth (no polish), buff dry.',
    serviceType: 'Formal black-tie and white-tie shoes',
    faqs: [
      ['What shoes do I wear to a black-tie event?', 'Patent leather oxford in black. Cap-toe or plain-toe construction — both correct. The high-shine finish is what makes them formal-appropriate; matte leather oxfords read underdressed at proper black-tie events and show up that way in photos. If the dress code says "black tie" and you only own matte oxfords, buy patent leather before the event.'],
      ['What is an opera pump and when do I wear it?', 'Opera pump is a slip-on patent leather formal shoe with a flat grosgrain bow on the front. It is the formally correct shoe for white-tie events — the most formal Western dress code. Outside of presidential balls, certain academic events, and embassy functions, white-tie almost never comes up. Most men never need opera pumps. If you do need them, special order with 2 to 3 weeks lead.'],
      ['How do I care for patent leather?', 'Wipe with a slightly damp cloth after wearing. Buff dry with a soft dry cloth. Store in a dust bag or with shoe trees in a dark closet — patent leather yellows in direct sunlight. Do not polish — wax polish damages the patent finish. Avoid scratches; patent leather shows them more than matte. With basic care, patent leather lasts decades because it is rarely worn.'],
      ['Can patent leather be worn with non-tuxedo outfits?', 'No. Patent leather is exclusively formalwear. Wearing patent leather oxfords with a regular suit reads costume-formal — like you grabbed the wrong shoe. Patent leather pairs only with tuxedos and white-tie ensemble. Save them for formal events and rotate matte leather for everything else.'],
      ['What size do I buy for formal shoes if I rarely wear them?', 'Same size as your dress oxfords — formal shoes are constructed on the same lasts. Most men buy formal shoes once and wear them for years; the size you fit at 30 is the size you wear at 50 unless the foot itself changes. We fit and rotate sizes at the counter; if the formal shoes feel different than your business oxfords, we exchange.'],
    ],
    relatedKeys: ['shoes/wedding', 'tuxedos/black-tie', 'tuxedos/white-tie'],
    pricing: [
      ['Patent leather cap-toe oxford', '$179', 'In stock'],
      ['Patent leather plain-toe oxford', '$179', 'In stock'],
      ['Opera pump (white-tie)', '$229', '2-3 weeks special order'],
      ['Evening loafer (gala, private events)', '$169', 'In stock'],
    ],
  },
  {
    slug: 'kids', dir: 'shoes', hub_path: '/shoes', hub_name: 'Shoes',
    name: 'Kids Shoes',
    description: 'Kids shoes in Gainesville, GA. Boys\' dress shoes, ring bearer formal, communion shoes. Real leather, scaled formal styles, sized for growing feet.',
    intro: 'Kids dress shoes are usually an afterthought — the parent buys a suit and grabs the cheapest dress shoes off the shelf at the last minute. Then the photos come back and the suit looks great and the shoes look like sneakers in disguise. We stock real leather kids dress shoes in scaled-down formal styles so the photos hold up.',
    body: 'Four kids shoe categories. Boys dress shoes: scaled cap-toe oxford, plain-toe derby, and penny loafer in real leather. Sizes range from toddler 6 to youth 7 (which is roughly equivalent to women\'s 8). Black and dark brown stocked. Ring bearer formal: smaller-scale patent leather oxford for ring bearers in formal weddings. Communion shoes: white leather oxford or strap shoe for First Communion (March-May seasonal stock). Quinceañera and pageant: dressier kids shoes for chambelán and pageant participation. We size kids shoes for growth: half size up from current foot size, with insoles available for tighter initial fit. Real leather kids shoes outlast 3 to 4 pairs of synthetic shoes and can be passed down or resold. Standard inventory in 3 to 5 days, special orders 2 to 3 weeks.',
    serviceType: 'Kids and boys dress shoes',
    faqs: [
      ['What size do I buy for a child?', 'Half size up from current foot size, with a removable insole for tighter initial fit. Most kids dress shoes are worn 6 to 12 times before being outgrown, so the half-size-up trick gets the most use. We measure on-foot at the store and recommend the right size at the fitting.'],
      ['Do kids dress shoes need to be real leather?', 'For the photos and the durability, yes. Real leather holds shape, takes a polish, and looks correct next to an adult\'s real-leather formal shoes in photos. Synthetic kids dress shoes are visibly different in photos and crack within a few wears. The price difference is $20 to $40 — worth it for an event suit and shoes that will be worn 5 to 10 times.'],
      ['What shoes for a ring bearer?', 'Small-scale patent leather oxford or matte black leather oxford. Patent leather for formal black-tie weddings, matte for semi-formal weddings. We stock ring bearer sizes 6 (toddler) through 13 (youth) and special-order smaller sizes when needed for very young ring bearers.'],
      ['Are white communion shoes available?', 'Yes — white leather oxford and white leather strap shoe (Mary Jane style for girls, oxford style for boys) for First Communion. Stocked seasonally March through May. Sizes youth 11 through 6 (most communicants are 7-8 years old). Pair white shoes with white socks and the white communion suit or dress.'],
      ['Can kids shoes be polished and maintained?', 'Yes — same care as adult leather shoes. Shoe polish in the matching color, soft cloth buffing, shoe trees overnight. We sell mini shoe trees for kids sizes ($8/pair) and stock kid-specific shoe care kits. With basic care, kids leather dress shoes can be passed down to siblings or sold to other parents — they retain shape and value.'],
    ],
    relatedKeys: ['suits/boys-and-kids', 'shoes/wedding', 'shoes/formal'],
    pricing: [
      ['Boys cap-toe oxford', '$59', 'In stock'],
      ['Boys penny loafer', '$59', 'In stock'],
      ['Ring bearer patent leather oxford', '$79', '3-5 business days'],
      ['Communion shoe (white leather)', '$59', '3-5 business days'],
    ],
  },
  // ===== ACCESSORIES hub + spokes =====
  {
    slug: '', dir: '', hub_path: '/accessories', hub_name: 'Accessories',
    name: 'Men\'s Accessories',
    file: 'accessories.html',
    isHub: true,
    description: 'Men\'s accessories in Gainesville, GA. Dress shirts, bowties, neckties, belts, suspenders, cufflinks. Stocked deep, coordinated to your suit.',
    intro: 'Accessories are where most outfits live or die. A great suit with a wrong tie reads off. A modest suit with a sharp pocket square reads polished. We stock accessories deep — dress shirts in 28 colors and patterns, neckties and bowties across 200+ designs, belts and shoe leather coordinated, cufflinks and suspenders for full formal kits. Bring your suit and we coordinate the full set in one visit.',
    body: 'Six core accessory categories at GA Suit Warehouse. Dress shirts: white, blue, and patterned dress shirts across 28 colors, modern and classic fits, sizes 14 through 19 neck. Bowties: pre-tied, self-tie, and clip-on in silk, satin, and cotton across solid, patterned, and seasonal designs. Neckties: silk, wool, knit, and cotton ties in standard 3-inch and slim 2.5-inch widths, 200+ patterns. Belts: dress belts in black and dark brown leather, casual belts in suede and woven leather, big and tall up to 56-inch waist. Suspenders: button and clip suspenders in standard and big-and-tall sizing, formal silk for tuxedo wear. Cufflinks: silver, gold, novelty, and engraved cufflinks for French-cuff dress shirts. We coordinate the full kit at the fitting and offer accessories packages for weddings, prom, and quinceañera courts.',
    serviceType: 'Men\'s accessories',
    faqs: [
      ['What accessories do I need for a complete suit outfit?', 'Dress shirt, tie, belt that matches the shoes, and dress socks. Optional but elevating: pocket square, watch, cufflinks if the shirt has French cuffs, tie bar. For tuxedos: bow tie, formal cummerbund or vest, formal cufflinks, dress shirt with formal collar. We coordinate the full kit at the fitting.'],
      ['Can I bring my suit and have you match accessories?', 'Yes — bring your suit (or a clear photo) and we will pull tie, pocket square, belt, and shoe options in 15 to 20 minutes. This is the fastest way to coordinate; the alternative is buying accessories blind and hoping they match, which typically results in returns.'],
      ['Do you stock big and tall accessories?', 'Yes. Big and tall belts up to 56-inch waist. Dress shirts up to 22-inch neck and 38-inch sleeve. Suspenders in extra-long for taller customers. Most accessories are size-flexible (ties, pocket squares, cufflinks) but the wear-on-body ones (shirts, belts, suspenders) we stock in extended sizes.'],
      ['What accessories do you carry for women?', 'We focus on menswear accessories. We do stock formal jewelry (cufflink-style brooches, formal earrings) and pocket squares that work as accents on women\'s formalwear, but our primary inventory is men\'s. For women\'s accessories specifically (handbags, women\'s jewelry, scarves), we refer to Atlanta-area shops we know stock well.'],
      ['Do you offer accessories rental?', 'Limited rental — bow ties, cummerbunds, and pocket squares for full tuxedo rentals only. Most accessories we sell to keep because the per-wear math favors buying. Cufflinks, suspenders, ties, and belts are sold; rental is reserved for one-time-use formalwear pieces.'],
    ],
    relatedKeys: ['accessories/dress-shirts', 'accessories/bowties', 'accessories/neckties'],
    pricing: [
      ['Dress shirt (basic to premium)', '$49-$129', 'In stock'],
      ['Necktie (silk, standard or slim)', '$39-$79', 'In stock'],
      ['Bow tie (pre-tied or self-tie)', '$29-$69', 'In stock'],
      ['Dress belt (leather)', '$49-$89', 'In stock'],
      ['Suspenders (button or clip)', '$39-$69', 'In stock'],
      ['Cufflinks (silver, gold, novelty)', '$29-$129', 'In stock'],
    ],
  },
  {
    slug: 'dress-shirts', dir: 'accessories', hub_path: '/accessories', hub_name: 'Accessories',
    name: 'Dress Shirts',
    description: 'Dress shirts in Gainesville, GA. White, blue, patterned, and formal dress shirts. Modern and classic fits, sizes 14-19 neck. Tailored on-site.',
    intro: 'A dress shirt is the most-worn piece of a man\'s formal wardrobe — worn under suits, blazers, on its own with chinos, tucked, untucked, ironed and pressed daily. The fit and fabric matter more than the rest of the outfit because the shirt sees the most direct contact and the most use. We stock dress shirts deep across colors, patterns, fits, and sizes — modern fit and classic fit in white, blue, and 26 other colors and patterns, sizes 14 through 19 neck and 32 through 37 sleeve.',
    body: 'A first-time dress shirt buyer should start with white. Solid white dress shirt is the most universally appropriate single shirt — works under any suit, with any tie, in any business setting, at funerals, at weddings, at interviews. Second buy: light blue. Blue reads slightly less formal but warmer in photos and pairs cleanly with navy and grey suits. Third buy: French blue or pale pink — adds variety without going off-pattern. Patterned shirts (gingham, stripe, plaid) come fourth and are appropriate in business-casual settings, smart-casual, and weekends. Formal shirts (pleated front, French cuff, wing collar) are tuxedo-specific and worn rarely. We tailor every shirt: sleeve length $25, body taper $25, collar adjust $15, all standard turn 3 to 5 days. Multi-shirt alteration packages discount 10 percent at 5+ shirts.',
    serviceType: 'Men\'s dress shirts',
    faqs: [
      ['What size dress shirt should I buy?', 'Measure your neck (around where the collar will sit, not too tight) and your sleeve length (from spine center down through shoulder to wrist bone with arm slightly bent). Most off-the-rack shirts are sized neck/sleeve, like 16/34 or 17/35. We measure on-body at the store and recommend the size with the right neck and the closest sleeve length, then tailor the sleeve to match exactly.'],
      ['What is the difference between modern fit and classic fit dress shirts?', 'Modern fit has a slight body taper through the side seams and a slimmer sleeve. Classic fit is straight through the body with a fuller sleeve. Modern fit reads contemporary on lean and average builds; classic fit suits heavier and athletic builds with broader chests. We default to modern fit and tailor side seams as needed.'],
      ['Do you stock French cuff dress shirts?', 'Yes — French cuff (double cuff) dress shirts in white and light blue stocked year-round, sizes 14.5 through 18 neck. Pair with cufflinks (silver, gold, or novelty). French cuffs are slightly more formal than barrel cuffs and are appropriate for business, weddings, and formal events. They cost $20 to $30 more than equivalent barrel-cuff shirts.'],
      ['How many dress shirts should I own?', 'Working professional minimum: 5 white, 3 blue, 2 patterned. That gives a 2-week rotation of mostly-white with variety. Most professionals own 10 to 15 dress shirts and rotate aggressively to extend each shirt\'s life. We recommend buying 3 to 5 shirts at a time for the multi-shirt alteration discount and rotating from there.'],
      ['What shirt color do I wear under a navy suit?', 'White is the universal answer. Light blue reads warmer and modern. French blue is a fashion-forward third option. Avoid black or dark colors — they read costume with a navy suit. Patterned shirts (light gingham, fine stripe) work in business casual but read off in formal settings. White is always correct under navy.'],
    ],
    relatedKeys: ['alterations/shirts', 'accessories/neckties', 'accessories/cufflinks'],
    pricing: [
      ['Basic dress shirt (white or light blue)', '$49', 'In stock'],
      ['Premium dress shirt (Egyptian cotton, modern fit)', '$89', 'In stock'],
      ['Patterned dress shirt', '$59', 'In stock'],
      ['French cuff dress shirt', '$79+', 'In stock'],
      ['Multi-shirt package (5+ with alterations)', '10% off alterations', '3-5 business days'],
    ],
  },
  {
    slug: 'bowties', dir: 'accessories', hub_path: '/accessories', hub_name: 'Accessories',
    name: 'Bowties',
    description: 'Bowties in Gainesville, GA. Pre-tied, self-tie, clip-on. Silk, satin, cotton. Black-tie formal, prom, weddings, quirky daily wear.',
    intro: 'Bowties exist in three contexts: formal (black silk for tuxedos), wedding (color and patterned for grooms and groomsmen), and personal style (the guy who wears bowties daily as a signature). Each context has different rules and different right-answers. We stock bowties for all three: formal black silk in pre-tied and self-tie, wedding bowties across 24 colors and 50 patterns, and signature-style bowties in cotton, knit, wool, and novelty fabrics.',
    body: 'Pre-tied vs self-tie. Pre-tied bowties are pre-knotted with adjustable neck strap — easier, faster, never come undone, look slightly less natural in photos. Self-tie bowties require tying like a shoe — more authentic, slightly more rumpled and human in photos, can come untied at the worst time. For weddings and formal events: self-tie reads more sophisticated. For prom and pre-tied looks: pre-tied is fine and easier. Clip-on bowties are appropriate only for kids; adult clip-ons read off. Black silk bowtie is the only correct tie with a black tuxedo at a formal event. Color bowties (burgundy, navy, hunter green, blush) work for weddings, prom, and personal style. Patterned bowties (paisley, dot, plaid) work for casual smart-dressing and signature style. Sizes mostly one-size-fits-all; XL bowties available for larger neck circumference.',
    serviceType: 'Men\'s bowties',
    faqs: [
      ['Pre-tied or self-tie bowtie?', 'For weddings and formal events: self-tie reads more sophisticated and authentic in photos. For prom and one-off events: pre-tied is acceptable and easier. For daily personal style: self-tie because the slight asymmetry every day reads natural. Avoid clip-on bowties on adults — they read off.'],
      ['How do I tie a self-tie bowtie?', 'Treat it like a shoelace: cross, loop, pull through. Most adjustments happen after the initial tie — the bowtie looks rumpled and intentional, not perfectly symmetric. We will demonstrate at the store and most customers tie their own within 2 to 3 attempts. YouTube tutorials are also available; the technique is simple but not intuitive.'],
      ['What color bowtie for a wedding?', 'For black-tie weddings: black silk, no exceptions. For semi-formal weddings: the bowtie can match the wedding color palette (burgundy, navy, hunter green, blush, dusty pink). For outdoor and casual weddings: patterned or knit bowties are appropriate. We coordinate to the suit and wedding palette at the fitting.'],
      ['Do bowties come in different sizes?', 'Yes — most bowties are one-size-fits-all with adjustable neck strap covering 14 to 18 inch necks. Larger sizes (extra-long bowties for 18 to 20 inch necks) available in select styles. Pre-tied bowties are slightly less adjustable than self-tie; self-tie ties are inherently fully adjustable since you tie them to fit.'],
      ['Can a bowtie be worn casually?', 'Yes — knit bowties, cotton bowties, and patterned bowties read smart-casual and work with sport coats, blazers, and even chinos plus a button-down. The all-black silk bowtie is exclusively formalwear, but most other bowties have casual use cases. The key is fabric: silk reads dressier, cotton and knit read more casual.'],
    ],
    relatedKeys: ['accessories/neckties', 'tuxedos/black-tie', 'accessories/dress-shirts'],
    pricing: [
      ['Black silk bowtie (formal, pre-tied or self-tie)', '$49', 'In stock'],
      ['Color bowtie (wedding palette)', '$39', 'In stock'],
      ['Patterned bowtie (paisley, dot, plaid)', '$45', 'In stock'],
      ['Knit or cotton bowtie (casual)', '$35', 'In stock'],
    ],
  },
  {
    slug: 'neckties', dir: 'accessories', hub_path: '/accessories', hub_name: 'Accessories',
    name: 'Neckties',
    description: 'Neckties in Gainesville, GA. Silk, wool, knit, cotton ties. Standard 3-inch and slim 2.5-inch widths. 200+ patterns, coordinated to your suit.',
    intro: 'A necktie is the cheapest signal in menswear — a $40 tie can elevate a $200 suit, and a $200 tie cannot save a wrongly-fitted suit. We stock neckties across silk, wool, knit, and cotton in over 200 patterns and colors, with the goal of coordinating any tie to any suit at the fitting. Standard 3-inch widths for classic and modern suits; slim 2.5-inch widths for slim-fit and contemporary looks.',
    body: 'Tie widths and proportions. Standard 3-inch tie pairs with classic fit and most modern fit suits — this is the workhorse necktie. Slim 2.5-inch tie pairs with slim fit suits and modern fashion-forward looks. Extra-slim 2-inch ties exist (knit ties most commonly) but read very fashion-forward and date in photos. Tie length: most off-the-rack ties are 58 inches, which works for men 5\'8" to 6\'2". Extra-long ties (62 inches) for taller customers. Tie fabrics: silk is the workhorse, takes pattern well, holds knot, dressy. Wool ties read more casual, work with tweed sport coats and texture. Knit ties read very casual, most appropriate with blazers and sport coats. Cotton ties for summer and lightweight looks. We coordinate ties at the fitting; bring your suit and we pull options in 5 to 10 minutes.',
    serviceType: 'Men\'s neckties',
    faqs: [
      ['What tie width should I buy?', '3 inches for classic and modern fit suits — the standard. 2.5 inches for slim fit suits — proportional. 2 inches only if you specifically want a fashion-forward look (knit ties commonly). The width should roughly match the lapel width on your jacket — wider lapels need wider ties, slimmer lapels need slimmer ties.'],
      ['What knot should I tie?', 'Half-Windsor for most occasions — symmetrical, balanced, works with most collar spreads. Four-in-hand for slimmer ties and casual looks — slightly asymmetric. Full Windsor for very wide collar spreads (cutaway collar) — large symmetric knot. Most men should default to half-Windsor and adjust. We demonstrate knots at the store; YouTube tutorials work too.'],
      ['How long should my tie be?', 'The tie tip should land at or just above the belt line when standing. Above the belt: tie too short. Below the belt: tie too long. Most off-the-rack ties (58 inches) work for men 5\'8" to 6\'2". For taller men, buy extra-long ties (62 inches). For shorter men, the knot can be tied larger to take up length, or buy shorter ties.'],
      ['What tie color for a navy suit?', 'Burgundy reads classic and conservative. Navy with white dot reads modern. Subtle stripe reads professional. Bold red reads power-tie (use sparingly). Hunter green or olive reads modern fashion. Avoid black ties with navy suits — funeral signal. Avoid bright colors at conservative business meetings — read as costume.'],
      ['Can I get a tie hand-tied at the store?', 'Yes — we will tie your tie for you at purchase if you want, and demonstrate the knot if you want to learn. Most customers learn half-Windsor in 2 to 3 attempts. Pre-tied ties (the kind with adjustable neck strap) are available for $35 to $45 — easier than learning to tie, but read slightly less authentic in photos.'],
    ],
    relatedKeys: ['accessories/bowties', 'accessories/dress-shirts', 'suits/business-interview'],
    pricing: [
      ['Silk necktie (standard 3-inch)', '$49', 'In stock'],
      ['Silk necktie (slim 2.5-inch)', '$49', 'In stock'],
      ['Wool tie (textured, casual)', '$45', 'In stock'],
      ['Knit tie (very casual)', '$39', 'In stock'],
      ['Premium silk tie (high-end fabric)', '$89', 'In stock'],
    ],
  },
  {
    slug: 'belts', dir: 'accessories', hub_path: '/accessories', hub_name: 'Accessories',
    name: 'Belts',
    description: 'Men\'s dress belts in Gainesville, GA. Black and brown leather dress belts, casual woven and suede belts, big & tall sizes to 56 waist.',
    intro: 'The first rule of belts is they match the shoes — black belt with black shoes, brown belt with brown shoes. The second rule is leather, real leather, not bonded synthetic. The third rule is that the belt is sized to the customer\'s actual waist, not the size on the trouser tag. Most men wear belts that are too long because they bought them at the wrong waist size and have to buckle inward, leaving 4 to 6 inches of belt past the buckle.',
    body: 'Dress belts vs casual belts. Dress belts are smooth full-grain leather, 1.25 to 1.5 inches wide, simple metal buckle (silver or gold), polished finish. Black for black shoes, dark brown for dark brown shoes. Casual belts are thicker leather (often 1.5 inches+), can be woven, braided, suede, or distressed leather, with larger or decorative buckles. Casual belts pair with chinos and jeans, dress belts with dress trousers and suits. Belt sizing: belt size = waist size measured at where the belt sits, not the trouser size. Most belts are sized 30 through 44, big and tall belts run 46 through 56. We size on-body at the store and recommend the right buckle hole. Belt loops should sit between holes 2 and 4 of a 5-hole belt — not the first hole (belt too long) and not the last hole (belt too short).',
    serviceType: 'Men\'s leather belts',
    faqs: [
      ['What belt size should I buy?', 'Your actual waist size, measured at where the belt will sit (often the natural waist, sometimes hip-line for low-rise trousers). Belt size is roughly 1 to 2 inches larger than the trouser tag size for the same fit. We measure at the store and recommend the right size; if you are between sizes, go up because belts cannot be lengthened (only shortened by punching a new hole).'],
      ['Do belts and shoes need to match exactly?', 'Same color family, yes — black belt with black shoes, brown belt with brown shoes. Exact shade: not perfect match needed, but close. Dark brown belt with light brown shoes works. Black belt with dark brown shoes does not. The visual rule is "match the leathers" and most customers have one black belt, one dark brown belt, one casual belt covering 95 percent of needs.'],
      ['Do you stock big and tall belts?', 'Yes — big and tall dress belts in black and dark brown to size 56-inch waist stocked. Special order to size 64 with 2 to 3 weeks lead. Casual belts in big and tall less deeply stocked but available. Most big and tall customers buy 1 dress belt and 1 casual belt to start.'],
      ['Can a belt be shortened?', 'Yes — punching extra holes for a tighter fit costs $5 (or free with most belt purchases). Shortening the belt itself by cutting and re-buckling costs $15 if the belt has a removable buckle. Some belts (sewn-on buckles) cannot be shortened. We size at purchase to avoid the issue most often.'],
      ['What buckle style is appropriate for business?', 'Simple metal buckle in silver, gold, or matte tone. Avoid logo buckles (read fashion-brand-flashy in business), avoid oversized buckles (read western or fashion-forward). The classic conservative buckle is a small rectangular silver-tone closure. Modern professional buckles can be slightly larger or matte black-tone but stay simple.'],
    ],
    relatedKeys: ['accessories/suspenders', 'shoes/mens-dress', 'suits/business-interview'],
    pricing: [
      ['Black leather dress belt', '$49', 'In stock'],
      ['Dark brown leather dress belt', '$49', 'In stock'],
      ['Casual belt (woven, braided, suede)', '$59', 'In stock'],
      ['Big & tall belt (46-56 waist)', '$59', 'In stock'],
      ['Belt hole punching', '$5', 'Walk-in'],
    ],
  },
  {
    slug: 'suspenders', dir: 'accessories', hub_path: '/accessories', hub_name: 'Accessories',
    name: 'Suspenders',
    description: 'Men\'s suspenders in Gainesville, GA. Button and clip suspenders, formal silk for tuxedos, big & tall sizes. Coordinated to your trouser.',
    intro: 'Suspenders (or "braces" in proper menswear vocabulary) hold trousers up via shoulder straps rather than belt around the waist. They have three real use cases: formal tuxedo wear (where a belt is incorrect), traditional three-piece suit looks (where the suspenders are visible under an open vest), and big-and-tall customers (where suspenders distribute weight better than a belt around a larger waist). Suspenders should not be worn with a belt simultaneously — that reads costume.',
    body: 'Button vs clip suspenders. Button suspenders attach to internal trouser buttons (sewn inside the waistband) — the formal, traditional method. Clip suspenders attach to the outside of the trouser waistband with metal clips — the casual, modern method. For tuxedos and three-piece suits: button suspenders only. For casual wear and most everyday use: clip suspenders are fine. Tuxedo trousers come with internal suspender buttons; many dress trousers have the buttons too (or they can be added for $15 alterations). Width: 1.25-inch suspenders are dressy, 1.5-inch suspenders are everyday, 2-inch suspenders are casual or work-wear. Color: black silk for tuxedos, white silk for white-tie, matched-color suspenders for three-piece looks, casual patterns for everyday. Big and tall suspenders extend to 60-inch reach for taller customers.',
    serviceType: 'Men\'s suspenders and braces',
    faqs: [
      ['Do I wear suspenders with a belt?', 'No — never simultaneously. Suspenders or belt, not both. Wearing both reads costume and over-dressed. The rule is one or the other; suspenders for formal and three-piece looks, belt for everyday casual and modern business.'],
      ['Are button or clip suspenders better?', 'Button for formal (tuxedos, three-piece suits) and traditional looks. Clip for casual and everyday wear. Button suspenders attach to internal trouser buttons and read more refined; clip suspenders attach externally and read more casual. Most tuxedo trousers have internal buttons; if not, we can add them for $15.'],
      ['Can I wear suspenders with a tuxedo and not see them?', 'Yes — suspenders are designed to be worn under tuxedo waistcoat or cummerbund. They hold the trousers up cleanly without the bulk of a belt around the waist (a belt would create a visible ridge under the formal vest or jacket). Black silk suspenders are standard for tuxedo wear.'],
      ['Do you stock big and tall suspenders?', 'Yes — big and tall suspenders extend to 60-inch reach (longer suspenders for taller customers and big and tall waist sizes). Stocked in black, dark brown, white silk (formal), and basic patterns. Special-order custom-length suspenders available with 2 to 3 weeks lead.'],
      ['How wide should suspenders be?', '1.25-inch for very dressy and formal (tuxedos, three-piece suits with vest). 1.5-inch for everyday and most business casual. 2-inch for very casual or work-wear style. The wider the suspender, the more casual it reads.'],
    ],
    relatedKeys: ['accessories/belts', 'tuxedos/black-tie', 'suits/three-piece'],
    pricing: [
      ['Button suspenders (silk, formal)', '$49', 'In stock'],
      ['Clip suspenders (everyday)', '$39', 'In stock'],
      ['Black silk tuxedo suspenders', '$59', 'In stock'],
      ['Big & tall suspenders (60-inch reach)', '$59', 'In stock'],
      ['Internal suspender button install', '$15', '3-5 business days'],
    ],
  },
  {
    slug: 'cufflinks', dir: 'accessories', hub_path: '/accessories', hub_name: 'Accessories',
    name: 'Cufflinks',
    description: 'Cufflinks in Gainesville, GA. Silver, gold, novelty, engraved cufflinks for French-cuff dress shirts. Wedding gifts, formal kits, signature pieces.',
    intro: 'Cufflinks are paired-jewelry pieces that fasten French-cuff (double-cuff) dress shirts at the wrist. They serve a structural purpose (closing the cuff) and a decorative one (a small visible signal at the edge of the sleeve). Most men own one or two pairs and rotate; serious cufflink collectors own dozens and treat them like watches — small, visible, status pieces.',
    body: 'Three categories of cufflinks. Classic cufflinks: silver-tone, gold-tone, or matte-tone metal in simple geometric shapes (square, oval, round). The everyday cufflink, appropriate for business and most formal occasions. Novelty cufflinks: themed cufflinks with personality — sports team logos, monogrammed initials, hobby symbols, professional symbols (legal scales, medical caduceus, military insignia). Read more personal and casual; appropriate for weddings, less formal events, or as gifts. Formal cufflinks: high-shine silver or gold, often with onyx, mother-of-pearl, or precious stone accents. For tuxedo wear and formal occasions only — read costume in business settings. We stock all three across price ranges from $29 (basic silver-tone) to $129 (premium silver with stone accent), with engraving available for monograms ($25 add-on, 2 weeks turn).',
    serviceType: 'Cufflinks',
    faqs: [
      ['Do I need cufflinks for a wedding?', 'Only if your dress shirt has French cuffs (double cuffs that fold back and close with cufflinks). Standard barrel-cuff dress shirts do not use cufflinks. Most groom shirts for formal weddings are French cuff and need cufflinks — silver-tone with onyx or mother-of-pearl is the classic wedding choice.'],
      ['What cufflinks for a tuxedo?', 'Formal cufflinks: high-shine silver or gold, often with onyx (black stone) or mother-of-pearl (white stone) accents. The black stone reads more masculine and formal; the white stone reads more elegant. Both are correct. Avoid novelty cufflinks with tuxedos — they clash with the formal pattern.'],
      ['Are cufflinks engravable?', 'Yes — silver and gold cufflinks can be engraved with monograms, dates, initials, or short phrases. Engraving runs $25 per cufflink ($50 for the pair) and adds 2 weeks to delivery. Common engravings: groom\'s initials, wedding date, anniversary date. We send out for engraving; the engraver is local in Buford and accurate.'],
      ['What is the difference between fixed-back and chain cufflinks?', 'Fixed-back (or "torpedo back" / "swivel back") have the back piece attached rigidly to the cufflink — easier to put on, more secure. Chain-link have a small chain connecting the front and back — slightly more elegant in profile, slightly trickier to put on. Most modern cufflinks are fixed-back; chain-link is more traditional.'],
      ['Can cufflinks be worn casually?', 'Generally no — cufflinks require French-cuff shirts which are inherently dressy. The exception is novelty cufflinks with smart-casual button-downs that have French cuffs (rare, fashion-forward). Most men wear cufflinks only with suits and tuxedos and consider them dressy by default.'],
    ],
    relatedKeys: ['accessories/dress-shirts', 'tuxedos/black-tie', 'tuxedos/wedding'],
    pricing: [
      ['Basic silver-tone cufflinks', '$29', 'In stock'],
      ['Silver with onyx or mother-of-pearl', '$79', 'In stock'],
      ['Gold-tone formal cufflinks', '$89', 'In stock'],
      ['Novelty cufflinks (monogram, theme)', '$49', 'In stock'],
      ['Engraving service', '+$25', '2 weeks'],
    ],
  },
  // ===== OUTERWEAR / CASUAL =====
  {
    slug: 'outerwear', dir: 'suits', hub_path: '/suits', hub_name: 'Suits',
    name: 'Outerwear',
    description: 'Men\'s outerwear in Gainesville, GA. Topcoats, overcoats, raincoats, and field jackets. Tailored to your suit. Big & tall sizing in stock.',
    intro: 'Outerwear is the layer over the suit in cold weather and rain. North Georgia winters are milder than the upper Midwest but still cold enough that a topcoat or overcoat is essential from November through March. The right outerwear elevates a suit; the wrong outerwear (a puffer over a suit, a casual jacket over a tuxedo) ruins the silhouette in photos.',
    body: 'Three outerwear categories. Topcoats and overcoats: wool or wool blend, knee-length to mid-thigh, single or double-breasted, in charcoal, camel, or navy. The classic over-suit layer for fall and winter. Topcoats are slightly shorter and lighter (waist to knee); overcoats are longer (knee to mid-calf) and heavier. Raincoats: traditional trench coat in tan or khaki, or modern slim raincoat in black or charcoal. Pairs over suits in rain. Field jackets and casual outerwear: M-65 field jacket, Barbour-style waxed cotton jacket, leather jacket. Pair with chinos and casual wear, not suits. We stock topcoats and raincoats in 36S through 56L (including big and tall) and field jackets in 36 through 50R. Tailoring on outerwear takes longer than suits because the construction is heavier — sleeve adjust 5 to 7 days, body alteration 10 to 14 days.',
    serviceType: 'Men\'s outerwear and overcoats',
    faqs: [
      ['What outerwear should I wear over a suit?', 'Topcoat or overcoat in wool or wool blend. Topcoat for milder cold (fall, early winter), overcoat for serious cold. Charcoal is the safest and most universal color. Camel reads classic and warm. Navy works with grey suits well. Avoid casual jackets (puffer, ski jacket, hooded parka) over a suit — the silhouette clashes.'],
      ['What is the difference between a topcoat and overcoat?', 'Length and weight. Topcoat: waist to knee, lighter wool, fall and milder winter. Overcoat: knee to mid-calf, heavier wool, deep winter. Topcoats are more versatile and the better single-purchase choice for most north Georgia winters. Overcoats are appropriate for travel to colder climates or extended outdoor wear.'],
      ['Can outerwear be tailored?', 'Yes, but it takes longer than suit tailoring because the construction is heavier. Sleeve adjust runs 5 to 7 days. Body taper or shortening runs 10 to 14 days. Lining repairs 7 to 10 days. We do all outerwear alterations in-house with master tailors familiar with the construction.'],
      ['Do you carry big and tall outerwear?', 'Yes — topcoats and overcoats in 46R through 56L stocked. Special order beyond 56L runs 4 to 6 weeks. Big and tall outerwear is one of the harder categories to stock because of fabric volume; we keep navy and charcoal deepest in larger sizes.'],
      ['What outerwear works with a tuxedo?', 'A long-line wool overcoat in black is the classic over-tuxedo layer. Avoid raincoats (read off with formal tuxedos), avoid casual jackets, avoid puffers. Some grooms skip outerwear and run from car to venue rather than ruin the photo line; this is a valid choice if the distance is short and the weather is not extreme.'],
    ],
    relatedKeys: ['suits/casual-wear', 'suits/business-interview', 'suits/big-and-tall'],
    pricing: [
      ['Wool topcoat (charcoal, camel, navy)', '$249', '3-5 business days'],
      ['Wool overcoat (longer, heavier)', '$329', '3-5 business days'],
      ['Trench coat / raincoat', '$199', '3-5 business days'],
      ['Field jacket / casual outerwear', '$179', '3-5 business days'],
      ['Outerwear alterations', '$40+', '5-14 days'],
    ],
  },
  {
    slug: 'casual-wear', dir: 'suits', hub_path: '/suits', hub_name: 'Suits',
    name: 'Casual Wear',
    description: 'Men\'s casual wear in Gainesville, GA. Polos, casual button-downs, chinos, sweaters. Smart-casual and weekend dressed-up basics, tailored on-site.',
    intro: 'Casual wear at a tailored menswear store is not the same as casual wear at a department store. We carry casual pieces that take alterations — polos that can be tapered, casual button-downs that can be sleeved properly, chinos that can be hemmed and tapered to fit. The difference is real: a tailored polo and chino combination reads like an outfit; an off-the-rack version reads like you grabbed clothes.',
    body: 'Four casual categories. Polos: cotton pique, lightweight wool, and merino polos in solid colors and basic patterns. Modern fit and classic fit. Tailored on-site for body taper and shoulder. Casual button-downs: oxford cloth, chambray, flannel, and lightweight linen casual shirts. Slightly fuller cut than dress shirts; can be tucked or untucked. Chinos: cotton or cotton-blend casual trousers in flat-front modern fit and pleated classic fit. Hemmed and tapered on-site. Sweaters and knitwear: merino crewneck, V-neck, half-zip, and cardigan sweaters. Cotton-blend cardigans for warmer weather. We stock casual wear sized 36R through 50R (and big and tall in selected pieces). Casual alterations are the same pricing and turn as dress alterations.',
    serviceType: 'Men\'s casual wear',
    faqs: [
      ['Why buy casual clothes from a tailored menswear store?', 'Because they fit better and take alterations. A $59 chino from us tailored to your body looks better than a $79 chino off the rack at a chain store. The difference is body taper, hem, and shoulder fit — small adjustments that make casual wear look intentional rather than thrown on.'],
      ['What polos do you stock?', 'Cotton pique polos in solid colors (white, navy, black, light blue, mid-grey, hunter green, burgundy) and basic patterns (subtle stripe, microcheck). Merino wool polos in finer construction for cooler weather. Sizes 36 through 50 standard, big and tall in select solids. All polos can be body-tapered to fit better.'],
      ['How are chinos different from casual khakis?', 'Construction and fit. Our chinos are slightly heavier-weight cotton, sit cleaner through the leg, and take alterations like a dress trouser. Department-store casual khakis are lighter cotton, looser cut, and meant for one-and-done wear. The chinos we stock are designed to be tailored and rotated like dress trousers.'],
      ['Do you offer alterations on casual wear?', 'Yes — same pricing as dress alterations. Polo body taper $25, chino hem $15, casual button-down sleeve $25. Casual wear benefits more from alterations than most men realize because off-the-rack casual is the loosest in the menswear ecosystem.'],
      ['What is the difference between modern fit and classic fit casual wear?', 'Modern fit is slightly tapered through the body and trimmer overall — the contemporary cut. Classic fit is straight and fuller — the traditional cut. Most men under 50 wear modern fit casual wear; most men over 60 wear classic fit by preference and habit. Both are appropriate; the choice is style and body type.'],
    ],
    relatedKeys: ['suits/dress-pants', 'suits/sport-coats-and-blazers', 'alterations/mens-clothing'],
    pricing: [
      ['Polo (cotton pique)', '$59', 'In stock'],
      ['Casual button-down (oxford, chambray)', '$79', 'In stock'],
      ['Chinos (cotton, modern or classic)', '$59-$89', 'Same-day to 3 days'],
      ['Merino sweater (crewneck, V-neck)', '$129', 'In stock'],
    ],
  },
];

// ---------- Render helpers ----------
const escAttr = (s) => String(s).replace(/"/g, '&quot;');
const escHtml = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function urlFor(svc) {
  if (svc.isHub) return `${SITE}${svc.hub_path}`;
  return `${SITE}${svc.hub_path}/${svc.slug}`;
}
function pathFor(svc) {
  if (svc.isHub) return svc.hub_path;
  return `${svc.hub_path}/${svc.slug}`;
}

const byKey = new Map();
for (const s of services) {
  const key = s.isHub ? s.hub_path.slice(1) : `${s.dir}/${s.slug}`;
  byKey.set(key, s);
}
// also map existing pages by their key for related-services rendering
const externalKnown = {
  'prom/suits': { name: 'Prom Suits', url: '/prom/suits', img: 'image2forwedding', blurb: 'Color-coordinated prom suits. Group rates and 3-5 day alterations.' },
  'prom/tuxedos': { name: 'Prom Tuxedos', url: '/prom/tuxedos', img: 'image1forwedding', blurb: 'Slim and modern fit prom tuxedos. Bold colors, master tailored.' },
  'suits/business-interview': { name: 'Business & Interview Suits', url: '/suits/business-interview', img: 'Modelleft', blurb: 'Navy and charcoal that lands callbacks. Master tailored on-site.' },
  'suits/funeral': { name: 'Funeral Suits', url: '/suits/funeral', img: 'modelright', blurb: 'Same-week turnaround. Navy and charcoal in every size.' },
  'suits/alterations': { name: 'Suit Alterations', url: '/suits/alterations', img: 'right-fit', blurb: 'Line-item pricing. Same-day rush. Master tailors on-site.' },
  'suits/three-piece': { name: 'Three-Piece Suits', url: '/suits/three-piece', img: 'fabric-swatches-banner', blurb: 'Vest-included three-piece suits for weddings, prom, business.' },
  'suits/custom-bespoke': { name: 'Custom & Bespoke Suits', url: '/suits/custom-bespoke', img: 'fabric-swatches-banner', blurb: 'Off-the-rack vs MTM vs bespoke — honest pricing and timelines.' },
  'tuxedos/black-tie': { name: 'Black Tie Tuxedos', url: '/tuxedos/black-tie', img: 'modelright', blurb: 'Black tie tuxedos for formal galas, weddings, and events.' },
  'tuxedos/white-tie': { name: 'White Tie Formalwear', url: '/tuxedos/white-tie', img: 'image1forwedding', blurb: 'White tie tail coats for the most formal events.' },
  'tuxedos/gala': { name: 'Gala Attire', url: '/tuxedos/gala', img: 'walk-out-ready', blurb: 'Gala and charity event tuxedos. Bold and statement-making.' },
  'weddings/groom-suits': { name: 'Groom Suits', url: '/weddings/groom-suits', img: 'image1forwedding', blurb: 'Tailored groom suits and tuxedos for the wedding photo of a lifetime.' },
  'weddings/groomsmen-suits': { name: 'Groomsmen Suits', url: '/weddings/groomsmen-suits', img: 'image2forwedding', blurb: 'Coordinated groomsmen packages. Group fittings, group rates.' },
};

function renderRelated(keys, currentSvc) {
  const cards = [];
  for (const k of keys) {
    let item;
    if (byKey.has(k)) {
      const s = byKey.get(k);
      item = {
        name: s.name,
        url: pathFor(s),
        img: pickImg(cards.length + 1).base,
        blurb: s.description.length > 110 ? s.description.slice(0, 107) + '...' : s.description,
        eyebrow: s.hub_name,
      };
    } else if (externalKnown[k]) {
      item = { ...externalKnown[k], eyebrow: k.split('/')[0].charAt(0).toUpperCase() + k.split('/')[0].slice(1) };
    } else {
      continue;
    }
    cards.push(`        <a class="spoke-card" href="${item.url}">
          <div class="spoke-card__media">
            <picture>
              <source srcset="/assets/img/${item.img}.webp" type="image/webp" />
              <img src="/assets/img/${item.img}.jpg" alt="${escAttr(item.name)} in Gainesville GA" loading="lazy" />
            </picture>
          </div>
          <div class="spoke-card__body">
            <span class="spoke-card__eyebrow">${escHtml(item.eyebrow || '')}</span>
            <h3 class="spoke-card__title">${escHtml(item.name)}</h3>
            <p class="spoke-card__copy">${escHtml(item.blurb)}</p>
            <span class="spoke-card__cta">Explore</span>
          </div>
        </a>`);
  }
  return cards.join('\n');
}

function renderFaqJson(faqs) {
  return faqs.map(([q, a]) => `      {
        "@type": "Question",
        "name": ${JSON.stringify(q)},
        "acceptedAnswer": { "@type": "Answer", "text": ${JSON.stringify(a)} }
      }`).join(',\n');
}

function renderFaqHtml(faqs) {
  return faqs.map(([q, a]) => `        <div class="faq-item">
          <button class="faq-question" type="button" aria-expanded="false">${escHtml(q)}</button>
          <div class="faq-answer"><div class="faq-answer-inner">${escHtml(a)}</div></div>
        </div>`).join('\n');
}

function renderPricingRows(pricing) {
  return pricing.map(([service, from, timeline]) =>
    `            <tr><td>${escHtml(service)}</td><td>${escHtml(from)}</td><td>${escHtml(timeline)}</td></tr>`
  ).join('\n');
}

function renderBreadcrumbsHtml(svc) {
  if (svc.isHub) {
    return `      <li><a href="/">Home</a></li>
      <li aria-current="page">${escHtml(svc.hub_name)}</li>`;
  }
  return `      <li><a href="/">Home</a></li>
      <li><a href="${svc.hub_path}">${escHtml(svc.hub_name)}</a></li>
      <li aria-current="page">${escHtml(svc.name)}</li>`;
}

function renderBreadcrumbsJson(svc) {
  const items = [
    { name: 'Home', item: SITE + '/' },
  ];
  if (!svc.isHub) {
    items.push({ name: svc.hub_name, item: SITE + svc.hub_path });
  }
  items.push({ name: svc.name, item: urlFor(svc) });
  return items.map((it, i) => `      { "@type": "ListItem", "position": ${i + 1}, "name": ${JSON.stringify(it.name)}, "item": ${JSON.stringify(it.item)} }`).join(',\n');
}

function renderPage(svc, idx) {
  const pageUrl = urlFor(svc);
  const pagePath = pathFor(svc);
  const titleService = svc.name;
  const title = `${titleService} in Gainesville, GA &middot; GA Suit Warehouse`;
  const titleText = `${titleService} in Gainesville, GA · GA Suit Warehouse`;
  const desc = svc.description;
  const heroImg = pickImg(idx);
  const featImg1 = pickImg(idx + 1);
  const featImg2 = pickImg(idx + 2);
  const featImg3 = pickImg(idx + 3);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <meta name="description" content="${escAttr(desc)}" />
  <link rel="canonical" href="${pageUrl}" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <meta property="og:title" content="${escAttr(titleText)}" />
  <meta property="og:description" content="${escAttr(desc)}" />
  <meta property="og:image" content="${SITE}/assets/img/${heroImg.base}.jpg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="900" />
  <meta property="og:url" content="${pageUrl}" />
  <meta property="og:site_name" content="GA Suit Warehouse" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escAttr(titleText)}" />
  <meta name="twitter:description" content="${escAttr(desc)}" />
  <meta name="twitter:image" content="${SITE}/assets/img/${heroImg.base}.jpg" />
  <meta name="geo.region" content="US-GA" />
  <meta name="geo.placename" content="Gainesville, Georgia" />
  <meta name="geo.position" content="34.2960;-83.8420" />
  <meta name="ICBM" content="34.2960, -83.8420" />
  <link rel="icon" type="image/png" href="/assets/img/favicon.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600&family=PT+Serif:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/assets/css/styles.css" />

  <!-- ===================== STRUCTURED DATA ===================== -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "MensClothingStore",
    "@id": "https://www.gasuitwarehouse.com/#business",
    "name": "GA Suit Warehouse",
    "url": "https://www.gasuitwarehouse.com/",
    "telephone": "+1-470-595-7775",
    "image": "https://www.gasuitwarehouse.com/assets/img/Modelleft.jpg",
    "priceRange": "$$",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "150 Pearl Nix Pkwy",
      "addressLocality": "Gainesville",
      "addressRegion": "GA",
      "postalCode": "30501",
      "addressCountry": "US"
    }
  }
  </script>

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
${renderBreadcrumbsJson(svc)}
    ]
  }
  </script>

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": ${JSON.stringify(svc.name)},
    "description": ${JSON.stringify(svc.description)},
    "provider": { "@id": "https://www.gasuitwarehouse.com/#business" },
    "areaServed": [
      { "@type": "City", "name": "Gainesville, GA" },
      { "@type": "AdministrativeArea", "name": "Hall County, GA" }
    ],
    "serviceType": ${JSON.stringify(svc.serviceType)}
  }
  </script>

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
${renderFaqJson(svc.faqs)}
    ]
  }
  </script>
</head>
<body>
  <address style="position:absolute;left:-10000px;top:auto;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);font-style:normal;" aria-hidden="true">
    GA Suit Warehouse,
    150 Pearl Nix Pkwy, Gainesville, GA 30501.
    Phone: <a href="tel:+14705957775">(470) 595-7775</a>.
    Hours: Monday&ndash;Saturday 10:00 AM &ndash; 7:00 PM, Sunday 12:00 PM &ndash; 6:00 PM.
  </address>

  <div id="site-nav"></div>

  <nav class="breadcrumbs" aria-label="Breadcrumb">
    <ol>
${renderBreadcrumbsHtml(svc)}
    </ol>
  </nav>

  <section class="hero-vsl">
    <span class="eyebrow">${escHtml(svc.hub_name)} &middot; Gainesville, GA</span>
    <h1>${escHtml(svc.name)} in Gainesville, GA.</h1>
    <p class="lead">${escHtml(svc.description)}</p>
    <a href="#book" class="btn btn-primary hero-cta">Book My Fitting</a>
  </section>

  <section class="section section-paper">
    <div class="container">
      <div class="section-header reveal">
        <span class="eyebrow">What we do</span>
        <h2>${escHtml(svc.name)} at GA Suit Warehouse.</h2>
      </div>
      <div class="scenario-block reveal">
        <p>${escHtml(svc.intro)}</p>
        <p>${escHtml(svc.body)}</p>
      </div>
    </div>
  </section>

  <section class="section section-cream">
    <div class="container">
      <div class="features-list reveal">
        <div class="feature-block">
          <h3>#1: Fit First, Always</h3>
          <div class="feature-img"><picture><source srcset="/assets/img/${featImg1.base}.webp" type="image/webp" /><img src="/assets/img/${featImg1.base}.jpg" width="1200" height="900" alt="${escAttr(svc.name)} fitting at GA Suit Warehouse Gainesville GA" loading="lazy" decoding="async" /></picture></div>
          <p>Master tailors on-site at 150 Pearl Nix Pkwy. Every garment fitted in person, shoulder-first, with line-item pricing on alterations so you know what you are paying before we start.</p>
        </div>
        <div class="feature-block">
          <h3>#2: Real Inventory</h3>
          <div class="feature-img"><picture><source srcset="/assets/img/${featImg2.base}.webp" type="image/webp" /><img src="/assets/img/${featImg2.base}.jpg" width="1200" height="900" alt="${escAttr(svc.name)} inventory at GA Suit Warehouse Gainesville GA" loading="lazy" decoding="async" /></picture></div>
          <p>Stocked on the floor, not special-ordered with a six-week wait. Walk in, fit, walk out with a timeline you can plan around. We keep depth on common sizes and colors so most customers leave the same week.</p>
        </div>
        <div class="feature-block">
          <h3>#3: Coordinated Look</h3>
          <div class="feature-img"><picture><source srcset="/assets/img/${featImg3.base}.webp" type="image/webp" /><img src="/assets/img/${featImg3.base}.jpg" width="1200" height="900" alt="Coordinated ${escAttr(svc.name)} look at GA Suit Warehouse Gainesville GA" loading="lazy" decoding="async" /></picture></div>
          <p>Suit, shirt, tie, belt, shoes — pulled together at the fitting in under 20 minutes. No guessing the night before whether your accessories work. We assemble the full look so the day-of is calm.</p>
        </div>
      </div>
      <div class="features-cta">
        <a href="#book" class="btn btn-primary">Book My Fitting</a>
      </div>
    </div>
  </section>

  <section class="section section-paper">
    <div class="container">
      <div class="section-header reveal">
        <span class="eyebrow">What it costs &middot; how long it takes</span>
        <h2>${escHtml(svc.name)} pricing &amp; timeline.</h2>
      </div>
      <div class="spoke-table-wrap reveal">
        <table class="spoke-table">
          <caption>Starting prices and standard turn-around. Prices vary with fabric and construction; we always quote before you commit.</caption>
          <thead>
            <tr><th scope="col">Service</th><th scope="col">From</th><th scope="col">Timeline</th></tr>
          </thead>
          <tbody>
${renderPricingRows(svc.pricing)}
          </tbody>
        </table>
      </div>
    </div>
  </section>

  <section id="book" class="booking-section reveal" data-audience="suits">
    <div class="container">
      <div data-booking-root>
        <input type="hidden" name="source_page" value="${pagePath}" />
        <noscript>
          <p style="text-align:center;font-family:var(--font-body);">Booking requires JavaScript. Call <a href="tel:+14705957775">(470) 595-7775</a> to book by phone.</p>
        </noscript>
      </div>
    </div>
  </section>

  <section class="section section-paper">
    <div class="container">
      <div class="section-header reveal">
        <span class="eyebrow">FAQ</span>
        <h2>Questions we hear about ${escHtml(svc.name)}.</h2>
      </div>
      <div class="faq-list reveal">
${renderFaqHtml(svc.faqs)}
      </div>
    </div>
  </section>

  <section class="section section-cream">
    <div class="container">
      <div class="section-header reveal">
        <span class="eyebrow">Also fit at our shop</span>
        <h2>Related services.</h2>
      </div>
      <div class="related-services reveal">
${renderRelated(svc.relatedKeys, svc)}
      </div>
    </div>
  </section>

  <div id="site-footer"></div>

  <script defer src="/assets/js/booking-form.js"></script>
  <script defer src="/assets/js/booking-calendar.js"></script>
  <script defer src="/assets/js/booking.js"></script>
  <script defer src="/assets/js/components.js"></script>

  <script>
    window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
  </script>
  <script defer src="/_vercel/insights/script.js"></script>
</body>
</html>
`;
}

// ---------- Output ----------
let written = 0;
for (let i = 0; i < services.length; i++) {
  const svc = services[i];
  let outPath;
  if (svc.isHub) {
    outPath = join(ROOT, svc.file);
  } else {
    outPath = join(ROOT, svc.dir, `${svc.slug}.html`);
  }
  const dir = dirname(outPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(outPath, renderPage(svc, i));
  written++;
  console.log(`wrote ${outPath.replace(ROOT, '')}`);
}
console.log(`\nGenerated ${written} pages.`);

// ---------- Sitemap entries ----------
const newUrls = services.map((svc) => ({
  loc: urlFor(svc),
  priority: svc.isHub ? '0.9' : '0.8',
}));
console.log('\n--- Sitemap entries ---');
for (const u of newUrls) {
  console.log(`<url>
    <loc>${u.loc}</loc>
    <lastmod>2026-04-29</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${u.priority}</priority>
  </url>`);
}
