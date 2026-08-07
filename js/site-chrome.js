/**
 * js/site-chrome.js
 *
 * Injects the shared navbar, a dismissible support banner, and the footer
 * into any page with the matching placeholder elements. This replaces
 * copy-pasting the same markup into every HTML file — there's now exactly
 * one place to edit when a nav link, banner message, or footer link needs
 * to change.
 *
 * HOW TO USE THIS ON A PAGE
 * --------------------------
 * 1. Tell it how deep the page is nested, BEFORE including this script,
 *    so links resolve correctly either way:
 *
 *      <script>const SITE_CONTEXT = "root";</script>    <!-- index -->
 *      <script>const SITE_CONTEXT = "pages";</script>   <!-- anything in /pages/ -->
 *
 * 2. Add empty placeholder elements where the nav/footer should render:
 *
 *      <div id="nav-placeholder"></div>
 *      ...rest of the page...
 *      <div id="footer-placeholder"></div>
 *
 * Either placeholder is optional — a page can include just #nav-placeholder,
 * just #footer-placeholder, or both. Missing SITE_CONTEXT defaults to
 * "pages", since that's where most pages live. The support banner renders
 * as part of #nav-placeholder (directly below the navbar) — no extra
 * placeholder needed for it.
 *
 * 3. Include this script once, near the end of <body>:
 *
 *      <script src="js/site-chrome.js"></script>     <!-- from root pages -->
 *      <script src="../js/site-chrome.js"></script>   <!-- from /pages/ pages -->
 *
 * TO ADD / RENAME / REMOVE A NAV OR FOOTER LINK
 * -----------------------------------------------
 * Edit NAV_GROUPS or FOOTER_LINKS below. Every page picks up the change on
 * next load — no per-page editing required.
 *
 * TO CHANGE THE BANNER MESSAGE, LINKS, OR WHICH PAGES SUPPRESS IT
 * ------------------------------------------------------------------
 * Edit BANNER_HTML_TEMPLATE and BANNER_SUPPRESSED_PATHS below.
 *
 * ⚠️ REQUIRES a matching CSS block in css/styles.css (#site-banner and its
 * children, plus #banner-dismiss) — this file only builds the markup and
 * measures/positions it; the actual look lives in the shared stylesheet,
 * same convention as every other nav-related style (.navbar, .nav-dropdown,
 * etc). See the CSS block provided alongside this file.
 */

(function () {
  const context = typeof SITE_CONTEXT !== "undefined" ? SITE_CONTEXT : "pages";

  // Resolves a path to a root-level asset (index, images/, etc).
  function assetPath(path) {
    return context === "root" ? path : "../" + path;
  }

  // Resolves a path to another page inside /pages/.
  function pagePath(path) {
    return context === "root" ? "pages/" + path : path;
  }

  // ---- Edit these to change what appears in the nav ----
  const NAV_GROUPS = [
    { type: "link", label: "Home", href: assetPath("index") },
    { type: "link", label: "About", href: pagePath("about") },
    {
      type: "dropdown", label: "Tools",
      items: [
        { label: "Planetary Properties", href: pagePath("planetary-properties") },
        { label: "Scenario Comparisons", href: pagePath("scenario-comparisons") },
        { label: "3D Planet Viewer", href: pagePath("planet-viewer") },
        { label: "Orbit Simulator", href: pagePath("orbit-simulator") },
        { label: "Unit Conversions", href: pagePath("unit-conversions") }
      ]
    },
    {
      type: "dropdown", label: "Catalogs",
      items: [
        { label: "Exoplanet Explorer", href: pagePath("exoplanet-explorer") },
        { label: "Asteroid Tracker", href: pagePath("asteroid-tracker") },
        { label: "Planetary Gazetteer", href: pagePath("planetary-gazetteer") }
        // Future catalog-style pages go here.
      ]
    },
    { type: "link", label: "Resources", href: pagePath("resources") },
    { type: "link", label: "Space Essentials", href: pagePath("space-essentials") },
    { type: "link", label: "Shop & Support", href: pagePath("shop") },
    { type: "link", label: "Contact", href: pagePath("contact") }
  ];

  // ---- Edit these to change what appears in the footer ----
  const FOOTER_LINKS = [
    { label: "Terms", href: pagePath("terms") },
    { label: "Privacy", href: pagePath("privacy") },
    { label: "Disclaimer", href: pagePath("disclaimer") },
    { label: "Copyright", href: pagePath("copyright") },
    { label: "Affiliate Disclosure", href: pagePath("affiliate") }
  ];

  // ================================
  // SUPPORT BANNER
  // ================================

  // Slugs (no leading /pages/, no trailing slash or .html) where the
  // banner should NOT show — the two pages it's actually pointing to.
  const BANNER_SUPPRESSED_SLUGS = ["shop", "space-essentials"];

  // How long a dismissal is remembered before the banner is willing to
  // show again to the same visitor.
  const BANNER_DISMISS_DAYS = 0;
  const BANNER_DISMISS_KEY = "kuiperBannerDismissedAt";

  function bannerHtml() {
    return `
<div id="site-banner">
  <p>Enjoy the free tools? Consider <a href="${pagePath("shop")}">donating</a>, or check out our <a href="${pagePath("space-essentials")}">Space Essentials</a> picks. 🙂</p>
  <button type="button" id="banner-dismiss" aria-label="Dismiss">&times;</button>
</div>`;
  }

  // Matches the current URL against BANNER_SUPPRESSED_SLUGS, tolerant of
  // a trailing slash or .html suffix (either could show up depending on
  // whether a redirect has already resolved).
  function isSuppressedPage() {
    const path = window.location.pathname.replace(/\/$/, "").replace(/\.html$/, "");
    const slug = path.split("/").pop();
    return BANNER_SUPPRESSED_SLUGS.includes(slug);
  }

  function isBannerDismissed() {
    const raw = localStorage.getItem(BANNER_DISMISS_KEY);
    if (!raw) return false;
    const dismissedAt = parseInt(raw, 10);
    if (isNaN(dismissedAt)) return false;
    const daysSince = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
    return daysSince < BANNER_DISMISS_DAYS;
  }

  // Measures the real rendered heights of whatever's currently in
  // #nav-placeholder (navbar, and the banner if present) and pushes the
  // page's content down by exactly that much — rather than hardcoding a
  // pixel value that would drift out of sync whenever the navbar's own
  // height changes (e.g. the mobile breakpoint already uses a shorter
  // navbar than desktop).
  function syncBodyPadding() {
    const placeholder = document.getElementById("nav-placeholder");
    if (!placeholder) return;
    const totalHeight = Array.from(placeholder.children).reduce(
      (sum, el) => sum + el.offsetHeight, 0
    );
    document.body.style.paddingTop = totalHeight + "px";
  }

  function wireBannerBehavior() {
    const banner = document.getElementById("site-banner");
    const dismissBtn = document.getElementById("banner-dismiss");
    if (!banner || !dismissBtn) return;

    dismissBtn.addEventListener("click", function () {
      localStorage.setItem(BANNER_DISMISS_KEY, String(Date.now()));
      banner.remove();
      syncBodyPadding();
    });
  }

  function renderNavItem(item) {
    if (item.type === "dropdown") {
      const subitems = item.items.map(
        sub => `<li><a href="${sub.href}">${sub.label}</a></li>`
      ).join("");
      return `
        <li class="nav-dropdown">
          <a href="#" class="nav-dropdown-toggle">${item.label} <span class="nav-caret"></span></a>
          <ul class="nav-dropdown-menu">${subitems}</ul>
        </li>`;
    }
    return `<li><a href="${item.href}">${item.label}</a></li>`;
  }

  function renderNav() {
    const placeholder = document.getElementById("nav-placeholder");
    if (!placeholder) return;

    const showBanner = !isSuppressedPage() && !isBannerDismissed();

    placeholder.innerHTML = `
<header class="navbar">
  <a href="${assetPath("index")}" class="brand-container">
    <img src="${assetPath("images/branding/kuiperspace_combined.png")}" alt="The Kuiper Space" class="brand-combined">
  </a>
  <button class="nav-toggle" id="nav-toggle" aria-label="Toggle navigation" aria-expanded="false">
    <span></span><span></span><span></span>
  </button>
  <nav id="main-nav">
    <ul class="nav-links">
      ${NAV_GROUPS.map(renderNavItem).join("")}
    </ul>
  </nav>
</header>${showBanner ? bannerHtml() : ""}`;

    // The banner is positioned fixed, directly below the navbar — needs
    // the navbar's real rendered height, which is only known after it's
    // actually in the DOM (hence doing this here, not in CSS).
    const navbarEl = placeholder.querySelector(".navbar");
    const bannerEl = document.getElementById("site-banner");
    if (bannerEl && navbarEl) {
      bannerEl.style.top = navbarEl.offsetHeight + "px";
    }

    syncBodyPadding();
    wireNavBehavior();
    wireBannerBehavior();

    // Navbar height (and therefore banner position + body padding) can
    // change across the mobile/desktop breakpoint — re-sync on resize
    // rather than assuming whatever was measured on load stays correct.
    window.addEventListener("resize", function () {
      const currentBanner = document.getElementById("site-banner");
      const currentNavbar = placeholder.querySelector(".navbar");
      if (currentBanner && currentNavbar) {
        currentBanner.style.top = currentNavbar.offsetHeight + "px";
      }
      syncBodyPadding();
    });
  }

  function renderFooter() {
    const placeholder = document.getElementById("footer-placeholder");
    if (!placeholder) return;

    const year = new Date().getFullYear();
    const links = FOOTER_LINKS.map(l => `<a href="${l.href}">${l.label}</a>`).join("\n");

    placeholder.innerHTML = `
<footer class="site-footer">
  <p>
    The Kuiper Space is an independent educational project focused on astronomy and planetary science.
    Data, simulations, calculations, and visualizations may contain inaccuracies or simplified approximations.
  </p>
  <div class="footer-links">${links}</div>
  <p class="copyright">&copy; ${year} The Kuiper Space &mdash; thekuiperspace.com</p>
</footer>`;
  }

  // Same hamburger + dropdown behavior every page had inline before — now
  // lives in one place, wired up right after the nav markup is injected
  // (it has to run after injection, since the elements don't exist yet
  // when this script first loads).
  function wireNavBehavior() {
    const toggle = document.getElementById("nav-toggle");
    const nav = document.getElementById("main-nav");
    if (!toggle || !nav) return;

    toggle.addEventListener("click", function () {
      const isOpen = nav.classList.toggle("open");
      toggle.classList.toggle("open", isOpen);
      toggle.setAttribute("aria-expanded", isOpen);
      document.body.style.overflow = isOpen ? "hidden" : "";
    });

    // Group headers (Tools ▾ / Catalogs ▾) expand/collapse their own
    // submenu on tap instead of navigating anywhere or closing the whole
    // mobile menu. Harmless on desktop, since hover already opens the
    // menu there regardless of this .open class.
    nav.querySelectorAll(".nav-dropdown-toggle").forEach(function (groupToggle) {
      groupToggle.addEventListener("click", function (e) {
        e.preventDefault();
        const dropdown = groupToggle.closest(".nav-dropdown");
        const isOpen = dropdown.classList.toggle("open");
        groupToggle.setAttribute("aria-expanded", isOpen);
      });
    });

    // Only real destination links close the whole mobile menu — group
    // headers are handled separately above.
    nav.querySelectorAll("a").forEach(function (link) {
      if (link.classList.contains("nav-dropdown-toggle")) return;
      link.addEventListener("click", function () {
        nav.classList.remove("open");
        toggle.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
        nav.querySelectorAll(".nav-dropdown.open").forEach(function (d) {
          d.classList.remove("open");
        });
      });
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("open")) {
        nav.classList.remove("open");
        toggle.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
      }
    });
  }

  renderNav();
  renderFooter();
})();