/* GA Suit Warehouse — shared nav + footer injector, mobile menu, scroll reveals, FAQ accordion */

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
        <li>Mon&ndash;Fri · 10a&ndash;7p</li>
        <li>Saturday · 10a&ndash;7p</li>
        <li>Sunday · 12p&ndash;6p</li>
        <li><em style="color:#8590A4;">By appointment recommended</em></li>
      </ul>
    </div>
  </div>
  <div class="footer-watermark" aria-hidden="true">GA SuitWarehouse</div>
  <div class="footer-bottom">
    <span>&copy; ${new Date().getFullYear()} GA Suit Warehouse, LLC. All rights reserved.</span>
    <span><a href="#">Privacy</a> &nbsp;·&nbsp; <a href="#">Terms</a></span>
  </div>
</footer>
`;

function injectComponents() {
  const navMount = document.getElementById('site-nav');
  const footerMount = document.getElementById('site-footer');
  if (navMount) navMount.innerHTML = NAV_HTML;
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

document.addEventListener('DOMContentLoaded', () => {
  injectComponents();
  setupScrollReveal();
  setupFaq();
});
