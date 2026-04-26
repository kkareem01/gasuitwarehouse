/* GA Suit Warehouse — shared nav + footer injector, mobile menu, scroll reveals, FAQ accordion */

const NAV_HTML = `
<nav class="site-nav" aria-label="Primary">
  <div class="nav-inner">
    <a href="/" class="nav-logo" aria-label="GA Suit Warehouse home">
      <img src="/assets/img/favicon.png" alt="" />
      <span class="wordmark"><span class="ga">GA</span> SuitWarehouse</span>
    </a>
    <ul class="nav-links" id="nav-links">
      <li><a href="/weddings.html" data-route="/weddings.html">Weddings</a></li>
      <li><a href="/professionals.html" data-route="/professionals.html">Professionals</a></li>
      <li><a href="/prom.html" data-route="/prom.html">Prom</a></li>
      <li><a href="/other.html" data-route="/other.html">Other</a></li>
    </ul>
    <a href="/#choose" class="nav-cta">Get Suited</a>
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
      <h5>Occasions</h5>
      <ul>
        <li><a href="/weddings.html">Weddings</a></li>
        <li><a href="/professionals.html">Professionals</a></li>
        <li><a href="/prom.html">Prom</a></li>
        <li><a href="/other.html">Other Occasions</a></li>
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
        <li>Saturday · 10a&ndash;6p</li>
        <li>Sunday · 12p&ndash;5p</li>
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

  // active link
  const path = window.location.pathname;
  const normalizedPath = path === '/' || path === '/index.html' ? '/' : path;
  document.querySelectorAll('.nav-links a[data-route]').forEach((a) => {
    if (a.getAttribute('data-route') === normalizedPath) {
      a.classList.add('active');
    }
  });

  // mobile menu toggle
  const toggle = document.getElementById('nav-toggle');
  const links = document.getElementById('nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => links.classList.toggle('open'));
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
