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
//
// mapImage: filename under images/basemaps/, or null if we haven't
// downloaded a basemap for that body yet. Starting with just four
// (Mercury, Venus, Moon, Mars) to prove the map mechanism works before
// spending time sourcing the rest — see renderMap() for what happens when
// this is null (an honest "no map yet" state, not a broken image).
// ================================
const TARGETS = [
  { displayName: "Mercury", bodyType: "planet", mapImage: null },
  { displayName: "Venus", bodyType: "planet", mapImage: null },
  { displayName: "The Moon", bodyType: "moon", mapImage: null },
  { displayName: "Mars", bodyType: "planet", mapImage: null },
  { displayName: "Phobos", bodyType: "moon", mapImage: null },
  { displayName: "Deimos", bodyType: "moon", mapImage: null },
  { displayName: "Ceres", bodyType: "dwarf_planet", mapImage: null },
  { displayName: "Vesta", bodyType: "asteroid", mapImage: null },
  { displayName: "Io", bodyType: "moon", mapImage: null },
  { displayName: "Europa", bodyType: "moon", mapImage: null },
  { displayName: "Ganymede", bodyType: "moon", mapImage: null },
  { displayName: "Callisto", bodyType: "moon", mapImage: null },
  { displayName: "Mimas", bodyType: "moon", mapImage: null },
  { displayName: "Enceladus", bodyType: "moon", mapImage: null },
  { displayName: "Tethys", bodyType: "moon", mapImage: null },
  { displayName: "Dione", bodyType: "moon", mapImage: null },
  { displayName: "Rhea", bodyType: "moon", mapImage: null },
  { displayName: "Titan", bodyType: "moon", mapImage: null },
  { displayName: "Iapetus", bodyType: "moon", mapImage: null },
  { displayName: "Miranda", bodyType: "moon", mapImage: null },
  { displayName: "Ariel", bodyType: "moon", mapImage: null },
  { displayName: "Umbriel", bodyType: "moon", mapImage: null },
  { displayName: "Titania", bodyType: "moon", mapImage: null },
  { displayName: "Oberon", bodyType: "moon", mapImage: null },
  { displayName: "Triton", bodyType: "moon", mapImage: null },
  { displayName: "Pluto", bodyType: "dwarf_planet", mapImage: null },
  { displayName: "Charon", bodyType: "moon", mapImage: null }
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

  // Map reflects the exact same filtered set as the table (minus
  // pagination — the map isn't paginated, it shows everything that
  // matches the current filters, up to MAP_DOT_LIMIT below).
  renderMap(list);
}

// ================================
// MAP VIEW
// Overlays clickable dots (and, for small filtered sets, text labels)
// on top of a body's basemap image, using the exact same filtered list
// the browse table is showing. HTML/CSS-positioned elements rather than
// canvas — simpler for click/hover, and there's no large-scale drawing
// happening that would need canvas's performance.
// ================================
const MAP_DOT_LIMIT = 500; // safety valve — beyond this, ask the user to filter further rather than silently overwhelming the DOM
const LABEL_VISIBILITY_THRESHOLD = 40; // only show text labels when the filtered set is this small or fewer

// Converts a feature's real coordinates into a left/top percentage pair
// matching the basemap image's own pixel grid. USGS's equirectangular
// mosaics and this site's Gazetteer data both use the same convention
// (east longitude 0\u2013360\u00b0, planetocentric latitude), confirmed directly
// against USGS's own product documentation \u2014 so no coordinate-system
// conversion is needed here, just a direct linear mapping.
function projectFeatureToPercent(feature) {
  if (feature.center_lon === null || feature.center_lat === null) return null;
  const leftPct = (feature.center_lon / 360) * 100;
  const topPct = ((90 - feature.center_lat) / 180) * 100;
  return { leftPct, topPct };
}

function renderMap(filteredList) {
  const emptyState = document.getElementById("map-empty-state");
  const container = document.getElementById("map-container");
  const caption = document.getElementById("map-caption");

  if (!currentTargetFilter) {
    emptyState.textContent = "Select a specific target body above to see its feature map.";
    emptyState.classList.remove("hidden");
    container.classList.add("hidden");
    caption.textContent = "";
    return;
  }

  const targetMeta = TARGETS.find(t => t.displayName === currentTargetFilter);
  if (!targetMeta || !targetMeta.mapImage) {
    emptyState.textContent = `No basemap image available yet for ${currentTargetFilter}.`;
    emptyState.classList.remove("hidden");
    container.classList.add("hidden");
    caption.textContent = "";
    return;
  }

  emptyState.classList.add("hidden");
  container.classList.remove("hidden");

  const image = document.getElementById("map-image");
  const desiredSrc = `../images/basemaps/${targetMeta.mapImage}`;
  if (image.getAttribute("src") !== desiredSrc) {
    image.setAttribute("src", desiredSrc);
    image.setAttribute("alt", `${currentTargetFilter} basemap`);
  }

  const withCoords = filteredList.filter(f => f.center_lon !== null && f.center_lat !== null);
  const shown = withCoords.slice(0, MAP_DOT_LIMIT);
  const showLabels = shown.length <= LABEL_VISIBILITY_THRESHOLD;

  const dotsLayer = document.getElementById("map-dots-layer");
  dotsLayer.innerHTML = shown.map(f => {
    const pos = projectFeatureToPercent(f);
    if (!pos) return "";
    const label = showLabels
      ? `<span class="map-dot-label" style="left:${pos.leftPct}%; top:${pos.topPct}%;">${escapeHtml(f.clean_name || "Unnamed")}</span>`
      : "";
    return `<span class="map-dot" style="left:${pos.leftPct}%; top:${pos.topPct}%;" data-uid="${f._uid}" title="${escapeHtml(f.clean_name || "Unnamed")}"></span>${label}`;
  }).join("");

  dotsLayer.querySelectorAll(".map-dot").forEach(dot => {
    dot.addEventListener("click", () => showDetail(Number(dot.dataset.uid)));
  });

  const missingCoords = filteredList.length - withCoords.length;
  const cappedNote = withCoords.length > MAP_DOT_LIMIT
    ? ` Showing the first ${MAP_DOT_LIMIT.toLocaleString()} of ${withCoords.length.toLocaleString()} \u2014 narrow your filters to see the rest.`
    : "";
  const missingNote = missingCoords > 0 ? ` (${missingCoords.toLocaleString()} feature${missingCoords === 1 ? "" : "s"} missing coordinates, not shown.)` : "";
  caption.textContent = `${shown.length.toLocaleString()} feature${shown.length === 1 ? "" : "s"} plotted.${cappedNote}${missingNote}${showLabels ? "" : " Hover a dot to see its name, or narrow your filters to show labels directly."}`;
}

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