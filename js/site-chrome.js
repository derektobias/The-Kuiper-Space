/**
 * js/site-chrome.js
 *
 * Injects the shared navbar and footer into any page with the matching
 * placeholder elements. This replaces copy-pasting the same <header> and
 * <footer> markup into every HTML file — there's now exactly one place to
 * edit when a nav link, dropdown item, or footer link needs to change.
 *
 * HOW TO USE THIS ON A PAGE
 * --------------------------
 * 1. Tell it how deep the page is nested, BEFORE including this script,
 *    so links resolve correctly either way:
 *
 *      <script>const SITE_CONTEXT = "root";</script>    <!-- index.html -->
 *      <script>const SITE_CONTEXT = "pages";</script>   <!-- anything in /pages/ -->
 *
 * 2. Add empty placeholder elements where the nav/footer should render:
 *
 *      <div id="nav-placeholder"></div>
 *      ...rest of the page...
 *      <div id="footer-placeholder"></div>
 *
 * 3. Include this script once, near the end of <body>:
 *
 *      <script src="js/site-chrome.js"></script>     <!-- from root pages -->
 *      <script src="../js/site-chrome.js"></script>   <!-- from /pages/ pages -->
 *
 * Either placeholder is optional — a page can include just #nav-placeholder,
 * just #footer-placeholder, or both. Missing SITE_CONTEXT defaults to
 * "pages", since that's where most pages live.
 *
 * TO ADD / RENAME / REMOVE A NAV OR FOOTER LINK
 * -----------------------------------------------
 * Edit NAV_GROUPS or FOOTER_LINKS below. Every page picks up the change on
 * next load — no per-page editing required.
 */

(function () {
  const context = typeof SITE_CONTEXT !== "undefined" ? SITE_CONTEXT : "pages";

  // Resolves a path to a root-level asset (index.html, images/, etc).
  function assetPath(path) {
    return context === "root" ? path : "../" + path;
  }

  // Resolves a path to another page inside /pages/.
  function pagePath(path) {
    return context === "root" ? "pages/" + path : path;
  }

  // ---- Edit these to change what appears in the nav ----
  const NAV_GROUPS = [
    { type: "link", label: "Home", href: assetPath("index.html") },
    { type: "link", label: "About", href: pagePath("about.html") },
    {
      type: "dropdown", label: "Tools",
      items: [
        { label: "Planetary Properties", href: pagePath("planetary-properties.html") },
        { label: "Scenario Comparisons", href: pagePath("scenario-comparisons.html") },
        { label: "3D Planet Viewer", href: pagePath("planet-viewer.html") },
        { label: "Orbit Simulator", href: pagePath("orbit-simulator.html") },
        { label: "Unit Conversions", href: pagePath("unit-conversions.html") }
      ]
    },
    {
      type: "dropdown", label: "Catalogs",
      items: [
        { label: "Exoplanet Explorer", href: pagePath("exoplanet-explorer.html") }
        // Future catalog-style pages go here.
      ]
    },
    { type: "link", label: "Resources", href: pagePath("resources.html") },
    { type: "link", label: "Shop & Support", href: pagePath("shop.html") },
    { type: "link", label: "Contact", href: pagePath("contact.html") }
  ];

  // ---- Edit these to change what appears in the footer ----
  const FOOTER_LINKS = [
    { label: "Terms", href: pagePath("terms.html") },
    { label: "Privacy", href: pagePath("privacy.html") },
    { label: "Disclaimer", href: pagePath("disclaimer.html") },
    { label: "Copyright", href: pagePath("copyright.html") },
    { label: "Affiliate Disclosure", href: pagePath("affiliate.html") }
  ];

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

    placeholder.innerHTML = `
<header class="navbar">
  <a href="${assetPath("index.html")}" class="brand-container">
    <img src="${assetPath("images/branding/kuiperspace_combined.png")}" alt="KuiperSpace" class="brand-combined">
  </a>
  <button class="nav-toggle" id="nav-toggle" aria-label="Toggle navigation" aria-expanded="false">
    <span></span><span></span><span></span>
  </button>
  <nav id="main-nav">
    <ul class="nav-links">
      ${NAV_GROUPS.map(renderNavItem).join("")}
    </ul>
  </nav>
</header>`;

    wireNavBehavior();
  }

  function renderFooter() {
    const placeholder = document.getElementById("footer-placeholder");
    if (!placeholder) return;

    const year = new Date().getFullYear();
    const links = FOOTER_LINKS.map(l => `<a href="${l.href}">${l.label}</a>`).join("\n");

    placeholder.innerHTML = `
<footer class="site-footer">
  <p>
    KuiperSpace is an independent educational project focused on astronomy and planetary science.
    Data, simulations, calculations, and visualizations may contain inaccuracies or simplified approximations.
  </p>
  <div class="footer-links">${links}</div>
  <p class="copyright">&copy; ${year} KuiperSpace &mdash; thekuiperspace.com</p>
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