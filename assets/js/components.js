/* GA Suit Warehouse — shared nav + footer injector, mobile menu, scroll reveals, FAQ accordion */

const ANNOUNCE_BAR_HTML = `
<a href="/#choose" class="announce-bar" aria-label="New 2026 Executive Styling Session — find out if you are a fit">
  <span class="announce-bar__inner">
    <span class="announce-bar__text">
      <strong>New 2026 Executive Styling Session:</strong>
      <span class="announce-bar__cta">Find out if you are a fit</span>
    </span>
    <span class="announce-bar__arrow" aria-hidden="true">&rarr;</span>
  </span>
</a>
`;

const NAV_HTML = `
<nav class="site-nav" aria-label="Primary">
  <div class="nav-inner">
    <a href="/" class="nav-logo" aria-label="GA Suit Warehouse home">
      <img src="/assets/img/favicon.png" alt="" />
      <span class="wordmark"><span class="ga">GA</span> SuitWarehouse</span>
    </a>
    <ul class="nav-links" id="nav-links">
      <li><a href="/#about" data-section="about">About Us</a></li>
      <li><a href="/#why-us" data-section="why-us">Why Us</a></li>
      <li><a href="/#directions" data-section="directions">Directions</a></li>
      <li><a href="/#hours" data-section="hours">Hours</a></li>
      <li><a href="/#pricing" data-section="pricing">Pricing</a></li>
      <li><a href="/#faqs" data-section="faqs">FAQ</a></li>
    </ul>
    <a href="/#choose" class="nav-cta">Get Me Suited</a>
    <button class="nav-toggle" aria-label="Toggle menu" id="nav-toggle">
      <span></span>
    </button>
  </div>
</nav>
`;

const FOOTER_HTML = `
<footer class="site-footer" id="visit">
  <div class="footer-sitemap">
    <div class="footer-col">
      <h5>Weddings</h5>
      <ul>
        <li><a href="/weddings">All Wedding Suits</a></li>
        <li><a href="/weddings/groom-suits">Groom Suits</a></li>
        <li><a href="/weddings/groomsmen-suits">Groomsmen Suits</a></li>
        <li><a href="/weddings/father-of-the-bride">Father of the Bride</a></li>
        <li><a href="/weddings/destination-wedding">Destination Weddings</a></li>
        <li><a href="/weddings/courthouse-elopement">Courthouse &amp; Elopement</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h5>Suits</h5>
      <ul>
        <li><a href="/suits">All Men's Suits</a></li>
        <li><a href="/suits/custom-bespoke">Custom &amp; Bespoke</a></li>
        <li><a href="/suits/business-interview">Business &amp; Interview</a></li>
        <li><a href="/suits/three-piece">Three-Piece Suits</a></li>
        <li><a href="/suits/slim-fit">Slim Fit</a></li>
        <li><a href="/suits/modern-fit">Modern Fit</a></li>
        <li><a href="/suits/classic-fit">Classic Fit</a></li>
        <li><a href="/suits/big-and-tall">Big &amp; Tall</a></li>
        <li><a href="/suits/funeral">Funeral Suits</a></li>
        <li><a href="/suits/church">Church Suits</a></li>
        <li><a href="/suits/homecoming">Homecoming</a></li>
        <li><a href="/suits/quinceanera">Quincea&ntilde;era</a></li>
        <li><a href="/suits/graduation">Graduation</a></li>
        <li><a href="/suits/boys-and-kids">Boys &amp; Kids</a></li>
        <li><a href="/suits/sport-coats-and-blazers">Sport Coats &amp; Blazers</a></li>
        <li><a href="/suits/dress-pants">Dress Pants</a></li>
        <li><a href="/suits/outerwear">Outerwear</a></li>
        <li><a href="/suits/casual-wear">Casual Wear</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h5>Tuxedos</h5>
      <ul>
        <li><a href="/tuxedos">All Tuxedos</a></li>
        <li><a href="/tuxedos/wedding">Wedding Tuxedos</a></li>
        <li><a href="/tuxedos/black-tie">Black-Tie Tuxedos</a></li>
        <li><a href="/tuxedos/white-tie">White-Tie Formalwear</a></li>
        <li><a href="/tuxedos/white">White Tuxedos</a></li>
        <li><a href="/tuxedos/slim-fit">Slim Fit Tuxedos</a></li>
        <li><a href="/tuxedos/gala">Gala &amp; Charity Events</a></li>
        <li><a href="/tuxedos/modern-vs-classic">Modern vs Classic</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h5>Prom</h5>
      <ul>
        <li><a href="/prom">All Prom Attire</a></li>
        <li><a href="/prom/suits">Prom Suits</a></li>
        <li><a href="/prom/tuxedos">Prom Tuxedos</a></li>
        <li><a href="/prom/group-coordination">Group Coordination</a></li>
        <li><a href="/prom/color-coordination">Color &amp; Theme Match</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h5>Alterations</h5>
      <ul>
        <li><a href="/alterations">All Alterations</a></li>
        <li><a href="/suits/alterations">Suit Alterations</a></li>
        <li><a href="/alterations/shirts">Shirt Tailoring</a></li>
        <li><a href="/alterations/formal-wear">Formal Wear Tailoring</a></li>
        <li><a href="/alterations/mens-clothing">Men's Clothing</a></li>
        <li><a href="/alterations/kids-clothing">Kids' Clothing</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h5>Shoes</h5>
      <ul>
        <li><a href="/shoes">All Men's Shoes</a></li>
        <li><a href="/shoes/mens-dress">Dress Shoes</a></li>
        <li><a href="/shoes/loafers">Loafers</a></li>
        <li><a href="/shoes/wedding">Wedding Shoes</a></li>
        <li><a href="/shoes/prom">Prom Shoes</a></li>
        <li><a href="/shoes/formal">Formal Shoes</a></li>
        <li><a href="/shoes/kids">Kids Shoes</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h5>Accessories</h5>
      <ul>
        <li><a href="/accessories">All Accessories</a></li>
        <li><a href="/accessories/dress-shirts">Dress Shirts</a></li>
        <li><a href="/accessories/neckties">Neckties</a></li>
        <li><a href="/accessories/bowties">Bowties</a></li>
        <li><a href="/accessories/belts">Belts</a></li>
        <li><a href="/accessories/suspenders">Suspenders</a></li>
        <li><a href="/accessories/cufflinks">Cufflinks</a></li>
      </ul>
    </div>
  </div>
  <div class="footer-grid">
    <div class="footer-brand">
      <h4><span class="ga">GA</span> SuitWarehouse</h4>
      <p>Gainesville's tailored menswear destination. Master tailors on-site, 500+ suits in stock, by-appointment fittings seven days a week.</p>
    </div>
    <div class="footer-col">
      <h5>Explore</h5>
      <ul>
        <li><a href="/#about">About Us</a></li>
        <li><a href="/#why-us">Why Us</a></li>
        <li><a href="/#pricing">Pricing</a></li>
        <li><a href="/#faqs">FAQ</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h5>Visit</h5>
      <address>
        150 Pearl Nix Pkwy<br/>
        Gainesville, GA 30501<br/>
        <a href="tel:+14705957775">(470) 595-7775</a><br/>
        <a href="https://maps.google.com/?q=150+Pearl+Nix+Pkwy+Gainesville+GA+30501" target="_blank" rel="noopener">Get Directions →</a>
      </address>
    </div>
    <div class="footer-col">
      <h5>Hours</h5>
      <ul>
        <li>Mon&ndash;Fri &middot; 10a&ndash;7p</li>
        <li>Saturday &middot; 10a&ndash;7p</li>
        <li>Sunday &middot; 12p&ndash;6p</li>
        <li><em style="color:#8590A4;">By appointment recommended</em></li>
      </ul>
    </div>
  </div>
  <div class="footer-watermark" aria-hidden="true">GA SuitWarehouse</div>
  <div class="footer-bottom">
    <span>&copy; ${new Date().getFullYear()} GA Suit Warehouse, LLC. All rights reserved.</span>
    <span><a href="/privacy">Privacy</a> &nbsp;&middot;&nbsp; <a href="/terms">Terms</a></span>
  </div>
</footer>
`;

function injectComponents() {
  const navMount = document.getElementById('site-nav');
  const footerMount = document.getElementById('site-footer');
  if (navMount) {
    const path = window.location.pathname;
    const isHome = path === '/' || path === '' || path.endsWith('/index.html');
    navMount.innerHTML = (isHome ? ANNOUNCE_BAR_HTML : '') + NAV_HTML;
  }
  if (footerMount) footerMount.innerHTML = FOOTER_HTML;

  // mobile menu toggle + auto-close on link tap
  const toggle = document.getElementById('nav-toggle');
  const links = document.getElementById('nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => links.classList.toggle('open'));
    links.querySelectorAll('a').forEach((a) => {
      a.addEventListener('click', () => links.classList.remove('open'));
    });
  }
}

function setupScrollReveal() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -60px 0px' }
  );
  document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
}

function setupFaq() {
  document.querySelectorAll('.faq-item').forEach((item) => {
    const btn = item.querySelector('.faq-question');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      item.classList.toggle('open', !isOpen);
      btn.setAttribute('aria-expanded', String(!isOpen));
    });
  });
}

function injectLeadMagnetPopup() {
  const path = window.location.pathname;
  const isHome = path === '/' || path === '/index.html';
  if (!isHome) return;
  if (document.querySelector('script[data-lm-popup]')) return;
  const s = document.createElement('script');
  s.src = '/assets/js/lead-magnet-popup.js';
  s.defer = true;
  s.dataset.lmPopup = 'true';
  document.head.appendChild(s);
}

document.addEventListener('DOMContentLoaded', () => {
  injectComponents();
  setupScrollReveal();
  setupFaq();
  injectLeadMagnetPopup();
});
