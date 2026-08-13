let allFeatures = [];
let columnMap = null;
let currentView = "browse"; // "browse" | "detail"
let currentDetailFeature = null;
let currentTargetFilter = null; // null = "All Bodies", otherwise a target displayName
let currentFeatureTypeFilter = ""; // "" = all feature types
let currentQuickList = null;
let sortField = null;
let sortDirection = null;
let pinnedTooltipDot = null;
let currentPage = 1;

const PAGE_SIZE = 50;

// ================================
// TARGET BODY LIST
// ⚠️ KEEP IN SYNC with scripts/fetch-gazetteer-data.js's TARGETS array.
// This is a separate, duplicated list because there's no shared-module
// system between the Node fetch script and this browser-side file in this
// site's vanilla-JS stack. If a body is ever added/removed from the fetch
// script, mirror the change here too, or the picker and the data will
// silently disagree (a body could appear in data but not the picker, or
// vice versa).
// ================================
const TARGETS = [
  { displayName: "Mercury", bodyType: "planet" },
  { displayName: "Venus", bodyType: "planet" },
  { displayName: "The Moon", bodyType: "moon" },
  { displayName: "Mars", bodyType: "planet" },
  { displayName: "Phobos", bodyType: "moon" },
  { displayName: "Deimos", bodyType: "moon" },
  { displayName: "Ceres", bodyType: "dwarf_planet" },
  { displayName: "Vesta", bodyType: "asteroid" },
  { displayName: "Io", bodyType: "moon" },
  { displayName: "Europa", bodyType: "moon" },
  { displayName: "Ganymede", bodyType: "moon" },
  { displayName: "Callisto", bodyType: "moon" },
  { displayName: "Mimas", bodyType: "moon" },
  { displayName: "Enceladus", bodyType: "moon" },
  { displayName: "Tethys", bodyType: "moon" },
  { displayName: "Dione", bodyType: "moon" },
  { displayName: "Rhea", bodyType: "moon" },
  { displayName: "Titan", bodyType: "moon" },
  { displayName: "Iapetus", bodyType: "moon" },
  { displayName: "Miranda", bodyType: "moon" },
  { displayName: "Ariel", bodyType: "moon" },
  { displayName: "Umbriel", bodyType: "moon" },
  { displayName: "Titania", bodyType: "moon" },
  { displayName: "Oberon", bodyType: "moon" },
  { displayName: "Triton", bodyType: "moon" },
  { displayName: "Pluto", bodyType: "dwarf_planet" },
  { displayName: "Charon", bodyType: "moon" }
];

// Visual grouping for the sidebar picker — dwarf planets and Vesta (an
// asteroid/protoplanet) are shown together since splitting them into two
// tiny separate groups isn't worth the sidebar space.
const TARGET_GROUPS = [
  { label: "Planets", bodyTypes: ["planet"] },
  { label: "Dwarf Planets & Asteroids", bodyTypes: ["dwarf_planet", "asteroid"] },
  { label: "Moons", bodyTypes: ["moon"] }
];

const QUICK_LISTS = {
  largest: {
    label: "Largest features",
    filter: f => f.diameter_km !== null,
    sort: (a, b) => b.diameter_km - a.diameter_km
  },
  recent: {
    label: "Recently approved",
    // approval_date is a consistent zero-padded "YYYY/MM/DD HH:MM:SS"
    // string (confirmed via a real fetch run), so plain string comparison
    // sorts chronologically without needing to parse it as a Date. Missing
    // dates (empty string) naturally sort to the end of a descending list.
    filter: () => true,
    sort: (a, b) => (b.approval_date || "").localeCompare(a.approval_date || "")
  }
};

// Optional browse-table columns. All on by default — with only 4 total
// columns (2 fixed + 2 optional), the table's natural content width left
// a large empty gap on wide screens; showing everything by default closes
// that gap honestly (more real content) rather than fighting it with CSS.
// The Select All / Deselect All button still lets anyone go leaner.
const COLUMN_FIELDS = ["feature_type", "diameter_km", "center_lat", "center_lon", "origin", "approval_date", "quad"];
let visibleColumns = new Set(COLUMN_FIELDS);

// ================================
// LOAD DATA
// ================================
async function loadFeatures() {
  try {
    const [featuresRes, columnMapRes] = await Promise.all([
      fetch("../data/gazetteer.json"),
      fetch("../data/gazetteer-column-map.json")
    ]);
    if (!featuresRes.ok) throw new Error(`data/gazetteer.json returned HTTP ${featuresRes.status}`);
    if (!columnMapRes.ok) throw new Error(`data/gazetteer-column-map.json returned HTTP ${columnMapRes.status}`);

    allFeatures = await featuresRes.json();
    columnMap = await columnMapRes.json();

    // Stable unique id per feature for detail-view lookups — feature NAMES
    // are not guaranteed unique across different target bodies (unlike
    // exoplanets' pl_name), so array index is used as the identity instead.
    allFeatures.forEach((f, i) => { f._uid = i; });

    renderTargetPicker();
    renderColumnPicker();
    refreshFeatureTypeOptions();
    renderBrowseTable();
  } catch (err) {
    console.error("Failed to load Gazetteer data:", err);
    document.getElementById("browse-tbody").innerHTML =
      `<tr><td class="empty-state"><div class="empty-state-icon">\u26A0\uFE0F</div><p>Couldn't load feature data. Check the browser console for details.</p></td></tr>`;
  }
}

// ================================
// TARGET PICKER
// ================================
function renderTargetPicker() {
  const container = document.getElementById("target-picker");
  let html = `<button type="button" class="quicklist-btn all-bodies-btn ${currentTargetFilter === null ? "active-btn" : ""}" data-target="">All Bodies</button>`;

  TARGET_GROUPS.forEach(group => {
    const members = TARGETS.filter(t => group.bodyTypes.includes(t.bodyType));
    if (members.length === 0) return;
    html += `<div class="target-group-label">${group.label}</div>`;
    members.forEach(t => {
      const active = currentTargetFilter === t.displayName;
      html += `<button type="button" class="quicklist-btn ${active ? "active-btn" : ""}" data-target="${escapeHtml(t.displayName)}">${escapeHtml(t.displayName)}</button>`;
    });
  });

  container.innerHTML = html;
  container.querySelectorAll("[data-target]").forEach(btn => {
    btn.addEventListener("click", () => setTargetFilter(btn.dataset.target || null));
  });
}

function setTargetFilter(target) {
  currentTargetFilter = target;
  currentPage = 1;
  renderTargetPicker();
  refreshFeatureTypeOptions();
  renderCurrentView();
}

// Feature-type options depend on what's actually present within the
// current target scope, so switching bodies refreshes this list rather
// than showing types that don't exist on the selected body.
function refreshFeatureTypeOptions() {
  const select = document.getElementById("feature-type-filter");
  const scope = currentTargetFilter ? allFeatures.filter(f => f.target === currentTargetFilter) : allFeatures;
  const types = [...new Set(scope.map(f => f.feature_type).filter(Boolean))].sort();

  const previousValue = currentFeatureTypeFilter;
  select.innerHTML = `<option value="">All feature types</option>` +
    types.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("");

  // Preserve the current selection only if it's still valid for this scope.
  currentFeatureTypeFilter = types.includes(previousValue) ? previousValue : "";
  select.value = currentFeatureTypeFilter;
}

document.getElementById("feature-type-filter").addEventListener("change", (e) => {
  currentFeatureTypeFilter = e.target.value;
  currentPage = 1;
  renderCurrentView();
});

// ================================
// COLUMN PICKER
// ================================
function renderColumnPicker() {
  const container = document.getElementById("column-picker");
  container.innerHTML = `
    <div class="property-group">
      <h4>Optional Columns</h4>
      <div class="group-grid">
        ${COLUMN_FIELDS.map(f => `
          <label>
            <input type="checkbox" data-col="${f}" ${visibleColumns.has(f) ? "checked" : ""}>
            ${columnMap.fields[f].label}
          </label>
        `).join("")}
      </div>
    </div>
  `;

  container.querySelectorAll("input[type=checkbox]").forEach(cb => {
    cb.addEventListener("change", () => {
      if (cb.checked) visibleColumns.add(cb.dataset.col);
      else visibleColumns.delete(cb.dataset.col);
      renderCurrentView();
    });
  });
}

function getVisibleColumnFields() {
  return COLUMN_FIELDS.filter(f => visibleColumns.has(f));
}

let allColumnsSelected = true;

function toggleSelectAllColumns() {
  allColumnsSelected = !allColumnsSelected;
  if (allColumnsSelected) {
    COLUMN_FIELDS.forEach(f => visibleColumns.add(f));
  } else {
    visibleColumns.clear();
  }
  document.getElementById("select-all-columns-btn").textContent = allColumnsSelected ? "Deselect All" : "Select All";
  renderColumnPicker();
  renderCurrentView();
}

document.getElementById("select-all-columns-btn").addEventListener("click", toggleSelectAllColumns);

function isRightAligned(field) {
  const unit = columnMap.fields[field].unit;
  return unit !== null && unit !== "boolean" && unit !== "date";
}

function columnHeaderLabel(field) {
  const def = columnMap.fields[field];
  const suffix = def.unit && def.unit !== "boolean" && def.unit !== "date" ? ` (${def.unit})` : "";
  return `${def.label}${suffix}`;
}

// ================================
// FORMATTING
// ================================
function formatNumber(value, precision) {
  return Number(value).toLocaleString(undefined, { minimumFractionDigits: precision, maximumFractionDigits: precision });
}

// approval_date's time component is always a dummy "00:00:00" (confirmed
// via a real fetch run) — only the date portion is meaningful, so this
// strips everything after the first space rather than displaying a
// misleadingly precise-looking timestamp.
function formatDate(raw) {
  return raw.split(" ")[0];
}

// Returns { text, hasValue } — never shows a blank cell, always says
// exactly what's missing via the field's configured nullLabel.
function formatValue(field, feature) {
  const def = columnMap.fields[field];
  const raw = feature ? feature[field] : null;

  if (raw === null || raw === undefined) {
    return { text: def.nullLabel, hasValue: false };
  }
  if (typeof raw !== "number") {
    const text = def.unit === "date" ? formatDate(raw) : String(raw);
    return { text, hasValue: true };
  }

  const precision = def.precision !== undefined ? def.precision : 0;
  const suffix = def.unit && def.unit !== "count" ? ` ${def.unit}` : "";
  return { text: `${formatNumber(raw, precision)}${suffix}`, hasValue: true };
}

// A single info-dot span for a given tooltip string, or "" if none. Used
// on column headers and detail-view field labels — NOT per-cell, since a
// field's explanation is the same for every row (e.g. what "quad" means
// doesn't change per feature), so repeating the dot on every value was
// pure visual noise. See infoDotHtml() call sites below.
function infoDotHtml(tooltip) {
  if (!tooltip) return "";
  return `<span class="info-dot" data-tooltip="${escapeHtml(tooltip)}">i</span>`;
}

// ================================
// TOOLTIP — instant show on hover, click to pin open (shared #info-tooltip element)
// ================================
function showTooltipFor(dot) {
  const tooltip = document.getElementById("info-tooltip");
  tooltip.textContent = dot.dataset.tooltip;
  tooltip.classList.remove("hidden");

  const dotRect = dot.getBoundingClientRect();
  const tw = tooltip.offsetWidth;
  const th = tooltip.offsetHeight;

  let left = dotRect.left + dotRect.width / 2 - tw / 2;
  let top = dotRect.top - th - 8;
  if (top < 8) top = dotRect.bottom + 8;

  left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function hideTooltip() {
  document.getElementById("info-tooltip").classList.add("hidden");
}

document.addEventListener("mouseover", (e) => {
  const dot = e.target.closest(".info-dot");
  if (dot) showTooltipFor(dot);
});

document.addEventListener("mouseout", (e) => {
  const dot = e.target.closest(".info-dot");
  if (dot && !dot.contains(e.relatedTarget)) {
    if (pinnedTooltipDot) showTooltipFor(pinnedTooltipDot);
    else hideTooltip();
  }
});

document.addEventListener("click", (e) => {
  const dot = e.target.closest(".info-dot");
  if (dot) {
    if (pinnedTooltipDot === dot) {
      pinnedTooltipDot.classList.remove("pinned");
      pinnedTooltipDot = null;
      hideTooltip();
    } else {
      if (pinnedTooltipDot) pinnedTooltipDot.classList.remove("pinned");
      pinnedTooltipDot = dot;
      dot.classList.add("pinned");
      showTooltipFor(dot);
    }
    e.stopPropagation();
  } else if (pinnedTooltipDot) {
    pinnedTooltipDot.classList.remove("pinned");
    pinnedTooltipDot = null;
    hideTooltip();
  }
});

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

// ================================
// SEARCH & FILTER
// ================================
document.getElementById("feature-search").addEventListener("input", () => {
  currentPage = 1;
  renderBrowseTable();
});

document.querySelectorAll(".quicklist-btn[data-list]").forEach(btn => {
  btn.addEventListener("click", () => {
    const key = btn.dataset.list;
    currentQuickList = currentQuickList === key ? null : key;
    sortField = null;
    sortDirection = null;
    currentPage = 1;
    document.querySelectorAll(".quicklist-btn[data-list]").forEach(b =>
      b.classList.toggle("active-btn", b.dataset.list === currentQuickList)
    );
    renderBrowseTable();
  });
});

// ================================
// COLUMN SORTING — first click descending, second click ascending, nulls always last
// ================================
function toggleColumnSort(field) {
  if (sortField === field) {
    sortDirection = sortDirection === "desc" ? "asc" : "desc";
  } else {
    sortField = field;
    sortDirection = "desc";
  }
  currentPage = 1;
  renderBrowseTable();
}

function compareForSort(a, b) {
  const av = a[sortField];
  const bv = b[sortField];
  const aNull = av === null || av === undefined;
  const bNull = bv === null || bv === undefined;
  if (aNull && bNull) return 0;
  if (aNull) return 1;
  if (bNull) return -1;
  const cmp = (typeof av === "string" || typeof bv === "string")
    ? String(av).localeCompare(String(bv))
    : av - bv;
  return sortDirection === "asc" ? cmp : -cmp;
}

function getFilteredFeatures() {
  let list = currentTargetFilter ? allFeatures.filter(f => f.target === currentTargetFilter) : allFeatures;

  if (currentFeatureTypeFilter) {
    list = list.filter(f => f.feature_type === currentFeatureTypeFilter);
  }

  if (currentQuickList) {
    list = list.filter(QUICK_LISTS[currentQuickList].filter);
  }

  const query = document.getElementById("feature-search").value.toLowerCase();
  if (query) {
    list = list.filter(f => (f.clean_name || "").toLowerCase().includes(query));
  }

  if (sortField) {
    list = list.slice().sort(compareForSort);
  } else if (currentQuickList) {
    list = list.slice().sort(QUICK_LISTS[currentQuickList].sort);
  }

  return list;
}

// ================================
// BROWSE TABLE
// ================================
function renderBrowseTable() {
  const cols = getVisibleColumnFields();
  renderBrowseTableHead(cols);

  const list = getFilteredFeatures();
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  currentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const pageList = list.slice(startIdx, startIdx + PAGE_SIZE);

  const tbody = document.getElementById("browse-tbody");

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${cols.length + 2}" class="empty-state"><div class="empty-state-icon">\uD83E\uDE90</div><p>No features match those filters.</p></td></tr>`;
  } else {
    tbody.innerHTML = pageList.map(f => {
      const dataCells = cols.map(field => {
        const { text, hasValue } = formatValue(field, f);
        const classes = [isRightAligned(field) ? "num" : "", hasValue ? "" : "muted"].filter(Boolean).join(" ");
        return `<td class="${classes}">${escapeHtml(text)}</td>`;
      }).join("");
      return `
        <tr>
          <td class="sticky-col">
            <span class="feature-link" data-uid="${f._uid}">${escapeHtml(f.clean_name || "Unnamed")}</span>
          </td>
          <td class="muted">${escapeHtml(f.target)}</td>
          ${dataCells}
        </tr>`;
    }).join("");
  }

  const rangeStart = list.length === 0 ? 0 : startIdx + 1;
  const rangeEnd = Math.min(startIdx + PAGE_SIZE, list.length);
  document.getElementById("result-count").textContent =
    `Showing ${rangeStart.toLocaleString()}\u2013${rangeEnd.toLocaleString()} of ${list.length.toLocaleString()} features`;

  const scopeLabel = currentTargetFilter || "all bodies";
  document.getElementById("current-scope-summary").innerHTML =
    `<span class="count">${list.length.toLocaleString()}</span> features on ${escapeHtml(scopeLabel)}${currentFeatureTypeFilter ? ` &middot; type: ${escapeHtml(currentFeatureTypeFilter)}` : ""}`;

  renderPaginationControls(totalPages);

  tbody.querySelectorAll("[data-uid]").forEach(el => {
    el.addEventListener("click", () => showDetail(Number(el.dataset.uid)));
  });

  // Glossary reflects the current feature-type filter, independent of
  // the table's own filtering/pagination.
  renderGlossary();
}

// ================================
// FEATURE TYPE GLOSSARY
// Default state (no specific feature-type selected): shows every feature
// type actually present in the current target-body scope (or every type
// across the whole dataset, if "All Bodies" is selected), alphabetically
// — same scope and sort order as the feature-type dropdown itself.
// Filtered state (a specific type selected): narrows to just that one entry.
//
// Keyed by the EXACT feature_type string as it appears in the data (e.g.
// "Mons, montes", singular+plural together) — must match exactly or the
// lookup silently misses.
//
// Definitions are paraphrased from USGS's own official descriptor-terms
// glossary (https://planetarynames.wr.usgs.gov/DescriptorTerms), confirmed
// against that page directly rather than guessed — all 54 terms present
// in this site's actual dataset are covered.
//
// image: filename under images/glossary/, or null if not sourced yet.
// ================================
const FEATURE_TYPE_GLOSSARY = {
  "Albedo Feature": {
    definition: "A region identified by how much light it reflects, rather than by its shape or elevation. Historically used for features observed from Earth-based telescopes before spacecraft imagery existed.",
    example: "Historically used on Mars, before high-resolution imagery replaced most of these with more specific feature types.",
    image: null
  },
  "Arcus, arc\u016bs": {
    definition: "An arc-shaped feature.",
    example: "Found on Venus.",
    image: null
  },
  "Astronaut-named features": {
    definition: "Lunar features located at or near Apollo landing sites, informally named for astronauts.",
    example: "Small craters near the Apollo landing sites on the Moon.",
    image: null
  },
  "Catena, catenae": {
    definition: "A chain of craters, often formed by a body that broke apart before impact.",
    example: "Enki Catena (Ganymede)",
    image: "enki-catena.jpg"
  },
  "Cavus, cavi": {
    definition: "Irregular, steep-sided hollows, usually found in clusters.",
    example: "Found on Mars, in areas linked to ice or gas escaping from beneath the surface.",
    image: null
  },
  "Chaos, chaoses": {
    definition: "A distinctive area of jumbled, broken terrain.",
    example: "Aram Chaos (Mars), a large region of chaotic terrain associated with ancient water release.",
    image: null
  },
  "Chasma, chasmata": {
    definition: "A deep, elongated, steep-walled canyon or depression.",
    example: "Ophir Chasma (Mars) \u2014 one of the individually-named canyon segments that together make up Valles Marineris",
    image: null
  },
  "Collis, colles": {
    definition: "Small hills or knobs.",
    example: "Found on Mars and Titan.",
    image: null
  },
  "Corona, coronae": {
    definition: "An oval-shaped volcanic or tectonic feature, found almost exclusively on Venus.",
    example: "Aine Corona (Venus)",
    image: "aine-corona.jpg"
  },
  "Crater, craters": {
    definition: "A roughly circular depression formed by the impact of a meteoroid, asteroid, or comet.",
    example: "Tycho (Moon)",
    image: "tycho-crater.jpg"
  },
  "Dorsum, dorsa": {
    definition: "A ridge, often a \"wrinkle ridge\" formed by compression of a volcanic plain as it cooled.",
    example: "Serenitatis Dorsa (Moon)",
    image: null
  },
  "Eruptive center": {
    definition: "An active volcanic center \u2014 a term used specifically on Io.",
    example: "Used for several of Io's most active volcanic centers.",
    image: null
  },
  "Facula, faculae": {
    definition: "A bright spot on a surface.",
    example: "Cerealia Facula and Vinalia Faculae (Ceres) \u2014 salt deposits inside Occator Crater, left behind when brine reached the surface and evaporated",
    image: "occator-crater-faculae.jpg"
  },
  "Farrum, farra": {
    definition: "A pancake-shaped structure, or a row of them \u2014 a term used specifically on Venus.",
    example: "Found on Venus, where they're thought to be a distinct type of volcanic dome.",
    image: null
  },
  "Flexus, flex\u016bs": {
    definition: "A very low, curving ridge with a scalloped edge.",
    example: "Found on Europa, where its icy surface flexes into these subtle ridges.",
    image: null
  },
  "Fluctus, fluct\u016bs": {
    definition: "A flow of material across the surface, such as lava.",
    example: "Found on Io, where active lava flows are common.",
    image: null
  },
  "Flumen, flumina": {
    definition: "A channel on Titan that may carry liquid, similar to a river.",
    example: "Used on Titan, where channels like these may carry liquid hydrocarbons.",
    image: null
  },
  "Fossa, fossae": {
    definition: "A long, narrow, shallow depression or trench, typically tectonic in origin.",
    example: "Cerberus Fossae (Mars)",
    image: "cerberus-fossae.jpg"
  },
  "Fretum, freta": {
    definition: "A strait \u2014 a narrow passage of liquid connecting two larger bodies of liquid.",
    example: "Used on Titan, connecting two of its hydrocarbon seas.",
    image: null
  },
  "Insula, insulae": {
    definition: "An island, or group of islands, surrounded by a liquid area such as a sea or lake.",
    example: "Used on Titan, for landmasses within its hydrocarbon seas.",
    image: null
  },
  "Labes, lab\u0113s": {
    definition: "A landslide.",
    example: "Found on Mars, often along the steep walls of Valles Marineris.",
    image: null
  },
  "Labyrinthus, labyrinthi": {
    definition: "A complex, maze-like network of intersecting valleys or ridges.",
    example: "Noctis Labyrinthus (Mars), a vast tangle of interconnected canyons.",
    image: "noctis-labyrinthus.jpg"
  },
  "Lacuna, lacunae": {
    definition: "An irregularly-shaped depression on Titan, resembling a dried-up lake bed.",
    example: "Used on Titan, for what appear to be former lake basins.",
    image: null
  },
  "Lacus, lac\u016bs": {
    definition: "\"Lake\" \u2014 a small plain on the Moon or Mars, or an actual lake of liquid hydrocarbons on Titan.",
    example: "Ontario Lacus (Titan), a real lake of liquid methane and ethane.",
    image: "ontario-lacus.jpg"
  },
  "Large ringed feature": {
    definition: "A large, hard-to-classify ringed structure.",
    example: "Used for a small number of unusual, very large circular features.",
    image: null
  },
  "Linea, lineae": {
    definition: "A long, dark or bright marking, which may be straight or curved.",
    example: "Found on Europa, where its icy shell is crossed by thousands of these fracture lines.",
    image: null
  },
  "Lingula, lingulae": {
    definition: "A tongue-shaped extension of a plateau, with rounded, lobe-like edges.",
    example: "Found on Mars.",
    image: null
  },
  "Macula, maculae": {
    definition: "A dark spot, which may be irregular in shape.",
    example: "Found on Pluto and other icy bodies, marking notably dark surface regions.",
    image: null
  },
  "Mare, maria": {
    definition: "A large, dark plain. Latin for \"sea\" \u2014 early astronomers mistook these dark patches for actual bodies of water. On the Moon, maria are true basaltic plains; on Mars the term marks dark albedo areas of no confirmed geological origin, and on Titan it describes dark expanses thought to be liquid hydrocarbons rather than rock at all.",
    example: "Mare Tranquillitatis (Moon) \u2014 the Apollo 11 landing site",
    image: null
  },
  "Mensa, mensae": {
    definition: "A flat-topped landform with steep, cliff-like sides, similar to a mesa on Earth.",
    example: "Found on Mars.",
    image: null
  },
  "Mons, montes": {
    definition: "A mountain. On volcanically active bodies, this is often a large volcano rather than a tectonically-uplifted peak.",
    example: "Olympus Mons (Mars) \u2014 the largest known volcano in the solar system",
    image: "olympus-mons.jpg",
    imageCaption: "Color Mosaic"
  },
  "Oceanus, oceani": {
    definition: "A very large dark area on the Moon, more extensive than a typical mare.",
    example: "Oceanus Procellarum (Moon), the largest dark \"sea\" on the Moon.",
    image: null
  },
  "Palus, paludes": {
    definition: "\"Swamp\" \u2014 a small plain, used on the Moon.",
    example: "Palus Putredinis (Moon)",
    image: null
  },
  "Patera, paterae": {
    definition: "A shallow volcanic crater with an irregular or complex, scalloped rim.",
    example: "Loki Patera (Io) \u2014 the most powerful known active volcanic feature in the solar system.",
    image: "loki-patera.jpg",
    imageCaption: "Artist's concept illustration \u2014 not an actual photograph."
  },
  "Planitia, planitiae": {
    definition: "A low plain, often the floor of a large ancient impact basin.",
    example: "Hellas Planitia (Mars) \u2014 one of the largest known impact basins",
    image: "hellas-planitia.jpg",
    imageCaption: "Topographic Map"
  },
  "Planum, plana": {
    definition: "A plateau or high plain.",
    example: "Lakshmi Planum (Venus), a broad volcanic highland.",
    image: null
  },
  "Plume, plumes": {
    definition: "A cryovolcanic feature on Triton, associated with active geyser-like eruptions. (The word \"plume\" is also used informally for Io's volcanic eruption clouds, but that's separate from this specific Gazetteer feature-type category, which USGS defines as Triton-only \u2014 Io's volcanic features are instead classified under other types, like Patera and Fluctus.)",
    example: "Used on Triton, where plumes of nitrogen gas and dust have been observed erupting from the surface.",
    image: null
  },
  "Promontorium, promontoria": {
    definition: "\"Cape\" \u2014 a headland, used on the Moon.",
    example: "Promontorium Heraclides (Moon)",
    image: null
  },
  "Regio, regiones": {
    definition: "A broad region distinguished from its surroundings by color or brightness (albedo), rather than by elevation.",
    example: "Cassini Regio (Iapetus) \u2014 the moon's darkened leading hemisphere",
    image: "cassini-regio.jpg"
  },
  "Rima, rimae": {
    definition: "A narrow, sinuous channel or fissure, sometimes formed by a collapsed lava tube.",
    example: "Rima Hadley (Moon) \u2014 the Apollo 15 landing site, commonly known by its informal English name, Hadley Rille",
    image: null
  },
  "Rupes, rup\u0113s": {
    definition: "A scarp, or steep slope.",
    example: "Discovery Rupes (Mercury), one of its largest cliff-like scarps.",
    image: null
  },
  "Satellite Feature": {
    definition: "A minor feature that shares its name with a larger, nearby named feature (for example, a small crater named after an adjacent larger one).",
    example: "Used widely across many bodies, most classically for the Moon's \"lettered craters.\"",
    image: null
  },
  "Scopulus, scopuli": {
    definition: "A lobed or irregular scarp.",
    example: "Found on Miranda.",
    image: null
  },
  "Serpens, serpentes": {
    definition: "A winding, snake-like feature with alternating raised and lowered sections along its length.",
    example: "A rare term, used only for a small number of features.",
    image: null
  },
  "Sinus, sin\u016bs": {
    definition: "\"Bay\" \u2014 a small plain on the Moon or Mars, or a bay within one of Titan's hydrocarbon seas.",
    example: "Sinus Iridum (Moon), the \"Bay of Rainbows.\"",
    image: null
  },
  "Statio": {
    definition: "A spacecraft landing site.",
    example: "Statio Tranquillitatis (Moon), the Apollo 11 landing site.",
    image: null
  },
  "Sulcus, sulci": {
    definition: "A set of parallel grooves or ridges, often formed by tectonic stretching of icy crust.",
    example: "Enceladus's \"tiger stripe\" sulci",
    image: null
  },
  "Terra, terrae": {
    definition: "An extensive landmass.",
    example: "Aphrodite Terra (Venus), one of its largest highland regions.",
    image: null
  },
  "Tessera, tesserae": {
    definition: "Tile-like, polygonal terrain, shaped by intense tectonic deformation.",
    example: "Found on Venus, where tesserae represent some of its oldest and most deformed terrain.",
    image: null
  },
  "Tholus, tholi": {
    definition: "A small, dome-shaped hill or mountain, often volcanic.",
    example: "Ceraunius Tholus (Mars)",
    image: "ceraunius-tholus.jpg"
  },
  "Unda, undae": {
    definition: "Dunes.",
    example: "Found on Titan, where vast fields of hydrocarbon sand dunes stretch across its equatorial regions.",
    image: null
  },
  "Vallis, valles": {
    definition: "A valley, often a sinuous channel thought to have been carved by an ancient flow of liquid (water, lava, or otherwise).",
    example: "Baltis Vallis (Venus) \u2014 the longest known channel in the solar system",
    image: null
  },
  "Vastitas, vastitates": {
    definition: "An extensive plain.",
    example: "Vastitas Borealis (Mars), a vast plain covering much of its northern hemisphere.",
    image: null
  },
  "Virga, virgae": {
    definition: "A streak or stripe of color.",
    example: "A rare term, used only for a small number of features.",
    image: null
  }
};

// Same scope logic as refreshFeatureTypeOptions() (target body, or every
// body if "All Bodies" is selected) — reused here so the glossary always
// matches exactly what the feature-type dropdown itself would offer.
function getFeatureTypesInScope() {
  const scope = currentTargetFilter ? allFeatures.filter(f => f.target === currentTargetFilter) : allFeatures;
  return [...new Set(scope.map(f => f.feature_type).filter(Boolean))].sort();
}

// Single source of truth for "what entry does this term map to," used
// both when building the grid and when a card is clicked — so the
// fallback for an undocumented type is never defined in two places that
// could drift out of sync with each other.
function getGlossaryEntry(term) {
  return FEATURE_TYPE_GLOSSARY[term] || { definition: "Not documented yet \u2014 check the USGS Gazetteer for details.", example: "", image: null };
}

function glossaryCardHtml(term, entry) {
  const imageHtml = entry.image
    ? `<img class="glossary-card-image" src="../images/glossary/${escapeHtml(entry.image)}" alt="${escapeHtml(term)} example">`
    : `<div class="glossary-card-image-placeholder">Image coming soon</div>`;
  const captionHtml = entry.image && entry.imageCaption
    ? `<p class="glossary-image-caption">${escapeHtml(entry.imageCaption)}</p>`
    : "";
  const exampleHtml = entry.example ? `<p class="glossary-example">Example: ${escapeHtml(entry.example)}</p>` : "";
  return `
    <div class="glossary-card" data-term="${escapeHtml(term)}">
      ${imageHtml}
      ${captionHtml}
      <p class="glossary-term">${escapeHtml(term)}</p>
      <p class="glossary-definition">${escapeHtml(entry.definition)}</p>
      ${exampleHtml}
    </div>`;
}

function renderGlossary() {
  const container = document.getElementById("glossary-content");

  if (currentFeatureTypeFilter) {
    // Filtered state: one specific type selected in the sidebar dropdown.
    const entry = FEATURE_TYPE_GLOSSARY[currentFeatureTypeFilter];
    if (!entry) {
      container.innerHTML = `<div class="glossary-empty-state">"${escapeHtml(currentFeatureTypeFilter)}" isn't documented yet \u2014 we're adding these gradually. Feel free to look up the term on the <a href="https://planetarynames.wr.usgs.gov/" target="_blank" rel="noopener" style="color:#4da3ff;">USGS Gazetteer</a> in the meantime.</div>`;
      return;
    }
    container.innerHTML = `<div class="glossary-grid glossary-single">${glossaryCardHtml(currentFeatureTypeFilter, entry)}</div>`;
    wireGlossaryCardClicks(container);
    return;
  }

  // Default state: every feature type actually present in the current
  // target-body scope (or every type across the whole dataset, if "All
  // Bodies" is selected), alphabetically.
  const typesInScope = getFeatureTypesInScope();
  if (typesInScope.length === 0) {
    container.innerHTML = `<div class="glossary-empty-state">No feature types found for this selection.</div>`;
    return;
  }
  const cards = typesInScope.map(term => glossaryCardHtml(term, getGlossaryEntry(term))).join("");
  container.innerHTML = `<div class="glossary-grid">${cards}</div>`;
  wireGlossaryCardClicks(container);
}

function wireGlossaryCardClicks(container) {
  container.querySelectorAll(".glossary-card").forEach(cardEl => {
    cardEl.addEventListener("click", () => {
      const term = cardEl.dataset.term;
      openGlossaryLightbox(term, getGlossaryEntry(term));
    });
  });
}

// ================================
// GLOSSARY LIGHTBOX
// Reuses one persistent set of DOM elements (populated fresh on each
// open) rather than rebuilding markup per click — simpler than the
// small-card version since there's only ever one lightbox open at a time.
// ================================
function openGlossaryLightbox(term, entry) {
  const img = document.getElementById("glossary-lightbox-image");
  const placeholder = document.getElementById("glossary-lightbox-image-placeholder");
  if (entry.image) {
    img.src = `../images/glossary/${entry.image}`;
    img.alt = `${term} example`;
    img.classList.remove("hidden");
    placeholder.classList.add("hidden");
  } else {
    img.classList.add("hidden");
    placeholder.classList.remove("hidden");
  }

  const captionEl = document.getElementById("glossary-lightbox-image-caption");
  if (entry.image && entry.imageCaption) {
    captionEl.textContent = entry.imageCaption;
    captionEl.classList.remove("hidden");
  } else {
    captionEl.classList.add("hidden");
  }

  document.getElementById("glossary-lightbox-term").textContent = term;
  document.getElementById("glossary-lightbox-definition").textContent = entry.definition;
  document.getElementById("glossary-lightbox-example").textContent = entry.example ? `Example: ${entry.example}` : "";

  document.getElementById("glossary-lightbox").classList.remove("hidden");
}

function closeGlossaryLightbox() {
  document.getElementById("glossary-lightbox").classList.add("hidden");
}

document.getElementById("glossary-lightbox-close").addEventListener("click", closeGlossaryLightbox);
document.getElementById("glossary-lightbox-backdrop").addEventListener("click", closeGlossaryLightbox);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeGlossaryLightbox();
});

function renderPaginationControls(totalPages) {
  const container = document.getElementById("browse-pagination");

  if (totalPages <= 1) {
    container.innerHTML = "";
    return;
  }

  const delta = 2;
  const pages = [];
  for (let i = Math.max(1, currentPage - delta); i <= Math.min(totalPages, currentPage + delta); i++) {
    pages.push(i);
  }
  if (pages[0] > 1) {
    pages.unshift(1);
    if (pages[1] > 2) pages.splice(1, 0, "...");
  }
  if (pages[pages.length - 1] < totalPages) {
    if (pages[pages.length - 1] < totalPages - 1) pages.push("...");
    pages.push(totalPages);
  }

  const pageButtons = pages.map(p =>
    p === "..."
      ? `<span class="page-ellipsis">&hellip;</span>`
      : `<button type="button" class="page-btn ${p === currentPage ? "active-page" : ""}" data-page="${p}">${p}</button>`
  ).join("");

  container.innerHTML = `
    <button type="button" class="page-btn" data-page="prev" ${currentPage === 1 ? "disabled" : ""}>&laquo; Prev</button>
    ${pageButtons}
    <button type="button" class="page-btn" data-page="next" ${currentPage === totalPages ? "disabled" : ""}>Next &raquo;</button>`;

  container.querySelectorAll(".page-btn:not(:disabled)").forEach(btn => {
    btn.addEventListener("click", () => {
      const val = btn.dataset.page;
      if (val === "prev") currentPage -= 1;
      else if (val === "next") currentPage += 1;
      else currentPage = parseInt(val, 10);
      renderBrowseTable();
      document.getElementById("browse-view").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function renderBrowseTableHead(cols) {
  const headRow = document.getElementById("browse-thead-row");
  const headers = [
    { field: "clean_name", label: "Feature Name", rightAlign: false, sticky: true },
    { field: "target", label: "Target Body", rightAlign: false, sticky: false }
  ].concat(cols.map(f => ({ field: f, label: columnHeaderLabel(f), rightAlign: isRightAligned(f), sticky: false })));

  headRow.innerHTML = headers.map(h => {
    const classes = [h.rightAlign ? "num" : "", h.sticky ? "sticky-col" : ""].filter(Boolean).join(" ");
    const arrow = sortField === h.field ? (sortDirection === "asc" ? " \u25B2" : " \u25BC") : "";
    const tooltip = columnMap.fields[h.field] && columnMap.fields[h.field].tooltip;
    return `<th class="${classes}" data-sort="${h.field}">${h.label}${arrow}${infoDotHtml(tooltip)}</th>`;
  }).join("");

  headRow.querySelectorAll("th[data-sort]").forEach(th => {
    th.addEventListener("click", (e) => {
      // The info-dot lives inside the sortable header cell — without this
      // guard, clicking it would also trigger a column sort, since the
      // click bubbles up from the dot to this th before it ever reaches
      // the document-level tooltip handler.
      if (e.target.closest(".info-dot")) return;
      toggleColumnSort(th.dataset.sort);
    });
  });
}

// ================================
// DETAIL VIEW
// ================================
function showDetail(uid) {
  currentDetailFeature = allFeatures.find(f => f._uid === uid);
  setView("detail");
}

function renderDetailView() {
  const f = currentDetailFeature;
  document.getElementById("detail-name").textContent = f.clean_name || "Unnamed feature";
  document.getElementById("detail-sub").textContent =
    `${f.feature_type || "Feature"} on ${f.target}`;

  const metrics = [
    ["Diameter", "diameter_km"],
    ["Feature Type", "feature_type"],
    ["Target Body", "target"],
    ["Approval Date", "approval_date"]
  ];
  document.getElementById("metric-grid").innerHTML = metrics.map(([label, field]) => {
    const { text, hasValue } = formatValue(field, f);
    return `
      <div class="metric-card">
        <div class="metric-label">${label}</div>
        <div class="metric-value ${hasValue ? "" : "muted"}">${escapeHtml(text)}</div>
      </div>`;
  }).join("");

  const originNote = document.getElementById("origin-note");
  if (f.origin) {
    originNote.classList.remove("hidden");
    originNote.innerHTML = `<div class="origin-note-label">Name Origin</div>${escapeHtml(f.origin)}`;
  } else {
    originNote.classList.add("hidden");
  }

  const detailGroups = [
    { title: "Location", fields: ["center_lat", "center_lon", "min_lat", "max_lat", "min_lon", "max_lon"] },
    { title: "Naming Context", fields: ["continent_code", "ethnicity_code"] },
    { title: "Reference", fields: ["feature_type_code", "quad", "quad_code"] }
  ];
  document.getElementById("detail-columns").innerHTML = detailGroups.map(section => `
    <div class="property-group">
      <h4>${section.title}</h4>
      <table class="detail-table">
        ${section.fields.map(field => `
          <tr><td>${columnMap.fields[field].label}${infoDotHtml(columnMap.fields[field].tooltip)}</td><td>${escapeHtml(formatValue(field, f).text)}</td></tr>
        `).join("")}
      </table>
    </div>
  `).join("");

  const archiveNote = document.getElementById("detail-archive-note");
  archiveNote.innerHTML = f.detail_url
    ? `View the official record on the <a href="${escapeHtml(f.detail_url)}" target="_blank" rel="noopener">USGS Gazetteer of Planetary Nomenclature</a>.`
    : `Full record on the <a href="https://planetarynames.wr.usgs.gov/" target="_blank" rel="noopener">USGS Gazetteer of Planetary Nomenclature</a>.`;
}

// ================================
// VIEW SWITCHING
// ================================
function renderCurrentView() {
  if (currentView === "browse") renderBrowseTable();
  if (currentView === "detail") renderDetailView();
}

function setView(view) {
  currentView = view;
  document.getElementById("browse-view").classList.toggle("hidden", view !== "browse");
  document.getElementById("detail-view").classList.toggle("hidden", view !== "detail");

  renderCurrentView();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.getElementById("detail-back").addEventListener("click", () => setView("browse"));

// ================================
// SIDEBAR COLLAPSE / EXPAND
// ================================
document.getElementById("toggle-sidebar").addEventListener("click", () => {
  document.body.classList.add("sidebar-collapsed");
});

function expandSidebar() {
  document.body.classList.remove("sidebar-collapsed");
}

// ================================
// INIT
// ================================
loadFeatures();