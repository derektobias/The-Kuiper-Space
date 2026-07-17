let allPlanets = [];
let columnMap  = null;
let compareList = []; // Earth is always compareList[0], pinned and non-removable
let currentView = "browse"; // "browse" | "detail" | "compare"
let currentDetailPlanet = null;
let currentQuickList = null;
let sortField = null;      // currently sorted browse-table column, or null
let sortDirection = null;  // "desc" | "asc" — first click on a column is descending
let pinnedTooltipDot = null;
let currentPage = 1;

const MAX_COMPARE = 4; // Earth + up to 3 exoplanets
const MAX_SCALE_SIZE = 160; // px — largest circle in the size-comparison row
const PAGE_SIZE = 50;  // Number of exoplanets per page

const EARTH_REFERENCE = {
    pl_name: "Earth", hostname: "Sun", sy_pnum: 8, sy_snum: 1,
    discoverymethod: null, disc_year: null, disc_facility: null,
    pl_orbper: 365.25, pl_orbsmax: 1.0, pl_orbeccen: 0.017,
    pl_rade: 1.0, pl_radj: 0.0892, pl_bmasse: 1.0, pl_bmassj: 0.00315,
    pl_dens: 5.51, pl_eqt: 255, pl_insol: 1.0,
    st_teff: 5772, st_rad: 1.0, st_mass: 1.0, st_spectype: "G2V", st_met: 0.0,
    sy_dist: 0, sy_vmag: null, ra: null, dec: null, tran_flag: null, pl_controv_flag: 0
};

const QUICK_LISTS = {
    closest: { label: "Closest to Earth", filter: p => p.sy_dist !== null, sort: (a, b) => a.sy_dist - b.sy_dist },
    recent:  { label: "Recently discovered", filter: () => true, sort: (a, b) => (b.disc_year || 0) - (a.disc_year || 0) },
    rocky:   { label: "Potentially rocky", filter: p => p.pl_rade !== null && p.pl_rade <= 1.8, sort: (a, b) => a.pl_rade - b.pl_rade },
    sunlike: { label: "Sun-like hosts (G spectral type)", filter: p => (p.st_spectype || "").startsWith("G"), sort: (a, b) => a.pl_name.localeCompare(b.pl_name) }
};

// Fields shown in the detail view and compare table, grouped to match
// exoplanet-column-map.json's `categories`.
const DETAIL_SECTIONS = [
    { title: "Orbit and physical", fields: ["pl_eqt", "pl_insol", "pl_orbeccen", "tran_flag", "disc_facility"] },
    { title: "Host star", fields: ["st_spectype", "st_teff", "st_rad", "st_met", "sy_pnum"] },
    { title: "Position", fields: ["ra", "dec", "sy_vmag"] }
];

// Browse-table column picker. "Core" columns are on by default (matching the
// original fixed table); everything else starts off, toggleable from the
// sidebar. Order here is the display order left-to-right.
const COLUMN_GROUPS = [
    { title: "Core", fields: ["pl_rade", "pl_bmasse", "sy_dist", "disc_year"] },
    { title: "Discovery", fields: ["discoverymethod", "disc_facility"] },
    { title: "Orbit", fields: ["pl_orbper", "pl_orbsmax", "pl_orbeccen"] },
    { title: "Physical", fields: ["pl_eqt", "pl_insol", "pl_dens"] },
    { title: "Host star", fields: ["st_spectype", "st_teff", "st_rad", "st_mass", "st_met"] },
    { title: "System", fields: ["sy_pnum", "sy_snum"] },
    { title: "Position", fields: ["sy_vmag", "ra", "dec"] },
    { title: "Flags", fields: ["tran_flag", "pl_controv_flag"] }
];
let visibleColumns = new Set(["pl_rade", "pl_bmasse", "sy_dist", "disc_year"]); // matches original defaults

// ================================
// LOAD DATA
// ================================
async function loadPlanets() {
    const [planetsRes, columnMapRes] = await Promise.all([
        fetch("../data/exoplanets.json"),
        fetch("../data/exoplanet-column-map.json")
    ]);
    allPlanets = await planetsRes.json();
    columnMap  = await columnMapRes.json();

    compareList = [EARTH_REFERENCE];

    document.getElementById("result-count").textContent =
        `${allPlanets.length.toLocaleString()} confirmed planets`;

    renderColumnPicker();
    renderBrowseTable();
}

// ================================
// COLUMN PICKER
// Lets the user choose which optional columns show in the browse table.
// Groups mirror exoplanet-column-map.json's categories so this stays in
// sync automatically as fields are added there. Markup/classes match the
// Data Properties picker in planetary-properties.html (.property-group /
// .group-grid) for a consistent look across tools.
// ================================
function renderColumnPicker() {
    const container = document.getElementById("column-picker");
    container.innerHTML = COLUMN_GROUPS.map(group => `
        <div class="property-group">
            <h4>${group.title}</h4>
            <div class="group-grid">
                ${group.fields.map(f => `
                    <label>
                        <input type="checkbox" data-col="${f}" ${visibleColumns.has(f) ? "checked" : ""}>
                        ${columnMap.fields[f].label}
                    </label>
                `).join("")}
            </div>
        </div>
    `).join("");

    container.querySelectorAll("input[type=checkbox]").forEach(cb => {
        cb.addEventListener("change", () => {
            if (cb.checked) visibleColumns.add(cb.dataset.col);
            else visibleColumns.delete(cb.dataset.col);
            renderCurrentView();
        });
    });
}

let allColumnsSelected = false;

function toggleSelectAllColumns() {
    allColumnsSelected = !allColumnsSelected;
    const allFields = COLUMN_GROUPS.flatMap(g => g.fields);
    if (allColumnsSelected) {
        allFields.forEach(f => visibleColumns.add(f));
    } else {
        visibleColumns.clear();
    }
    document.getElementById("select-all-columns-btn").textContent = allColumnsSelected ? "Deselect All" : "Select All";
    renderColumnPicker();
    renderCurrentView();
}

function getVisibleColumnFields() {
    return COLUMN_GROUPS.flatMap(g => g.fields).filter(f => visibleColumns.has(f));
}

// Right-align anything with a real unit (numbers); left-align text and
// boolean fields. Driven entirely by the column-map config.
function isRightAligned(field) {
    const unit = columnMap.fields[field].unit;
    return unit !== null && unit !== "boolean";
}

function columnHeaderLabel(field) {
    const def = columnMap.fields[field];
    const unit = def.displayConversion ? def.displayConversion.toUnit : def.unit;
    const suffix = unit && unit !== "boolean" && unit !== "count" && unit !== "year" ? ` (${abbreviateUnit(unit)})` : "";
    return `${def.label}${suffix}`;
}

// ================================
// FORMATTING
// Same scientific-notation convention as formatValue() in
// planetary-properties.js, extended with the column-map's unit/precision/
// null-label config and the SI-conversion tooltip.
// ================================
function formatNumber(value, precision, scientific) {
    if (scientific) {
        const exp = value.toExponential(2);
        const [mantissa, power] = exp.split("e");
        const sup = { "0":"\u2070","1":"\u00b9","2":"\u00b2","3":"\u00b3","4":"\u2074","5":"\u2075","6":"\u2076","7":"\u2077","8":"\u2078","9":"\u2079" };
        const sign = power.startsWith("-") ? "\u2212" : "";
        const digits = power.replace("-", "").replace("+", "").split("").map(d => sup[d] || d).join("");
        return `${mantissa} \u00d7 10${sign}${digits}`;
    }
    return Number(value).toLocaleString(undefined, { minimumFractionDigits: precision, maximumFractionDigits: precision });
}

function abbreviateUnit(unit) {
    const map = {
        "Earth radii": "R\u2295", "Jupiter radii": "R\u2643",
        "Earth masses": "M\u2295", "Jupiter masses": "M\u2643",
        "Solar radii": "R\u2609", "Solar masses": "M\u2609",
        "light-years": "ly", "parsecs": "pc"
    };
    return map[unit] || unit;
}

// Returns { text, hasValue } — mirrors the null-handling convention used
// throughout: never show a blank cell or a false zero, always say "Not
// measured" (or the field's configured nullLabel) explicitly.
function formatValue(field, planet) {
    const def = columnMap.fields[field];
    const raw = planet ? planet[field] : null;

    if (raw === null || raw === undefined) {
        return { text: def.nullLabel, hasValue: false };
    }
    if (def.unit === "boolean") {
        return { text: raw ? "Yes" : "No", hasValue: true };
    }
    if (typeof raw !== "number") {
        return { text: String(raw), hasValue: true };
    }

    let displayValue = raw;
    let unitLabel = def.unit;
    if (def.displayConversion) {
        displayValue = raw * def.displayConversion.multiplier;
        unitLabel = def.displayConversion.toUnit;
    }
    const precision = def.precision !== undefined ? def.precision : 0;
    const formatted = (unitLabel === "year" || unitLabel === "count")
        ? String(Math.round(displayValue))
        : formatNumber(displayValue, precision, false);
    const suffix = unitLabel && unitLabel !== "count" && unitLabel !== "year" ? ` ${abbreviateUnit(unitLabel)}` : "";
    return { text: `${formatted}${suffix}`, hasValue: true };
}

// "value unit = SI value" tooltip text, or null if the field has no
// siConversion entry or the value is missing.
function siTooltip(field, planet) {
    const def = columnMap.fields[field];
    if (!def.siConversion) return null;
    const raw = planet ? planet[field] : null;
    if (typeof raw !== "number") return null;

    const baseText = formatNumber(raw, def.precision !== undefined ? def.precision : 2, false);
    const baseUnit = abbreviateUnit(def.unit);
    const siValue = raw * def.siConversion.multiplier;
    const siText = formatNumber(siValue, 2, def.siConversion.useScientificNotation);
    return `${baseText} ${baseUnit} = ${siText} ${def.siConversion.unit}`;
}

// "Uncertainty: +0.23 / \u22120.22 R\u2295" tooltip text, or null if the field has
// no errorFields entry or either error value is missing. Per archive
// convention the lower-error column is stored negative, so it's absolute-
// valued here for display.
function uncertaintyTooltip(field, planet) {
    const def = columnMap.fields[field];
    if (!def.errorFields) return null;
    const upperRaw = planet ? planet[def.errorFields.upper] : null;
    const lowerRaw = planet ? planet[def.errorFields.lower] : null;
    if (typeof upperRaw !== "number" || typeof lowerRaw !== "number") return null;

    const precision = def.precision !== undefined ? def.precision : 2;
    const upperText = formatNumber(Math.abs(upperRaw), precision, false);
    const lowerText = formatNumber(Math.abs(lowerRaw), precision, false);
    const unit = def.unit && def.unit !== "count" && def.unit !== "year" ? ` ${abbreviateUnit(def.unit)}` : "";
    return `Uncertainty: +${upperText} / \u2212${lowerText}${unit}`;
}

function valueWithInfo(field, planet) {
    const { text } = formatValue(field, planet);
    const tooltipLines = [uncertaintyTooltip(field, planet), siTooltip(field, planet)].filter(Boolean);
    if (tooltipLines.length === 0) return escapeHtml(text);
    return `${escapeHtml(text)}<span class="info-dot" data-tooltip="${escapeHtml(tooltipLines.join("\n"))}">i</span>`;
}

// ================================
// SI TOOLTIP — instant show on hover, click to pin open.
// A single shared tooltip element (fixed position, positioned via JS) is
// reused for every info-dot on the page, since dots get recreated on every
// re-render and per-element listeners would be lost each time. Event
// delegation on document handles hover/click for any dot, present or future.
// ================================
function showTooltipFor(dot) {
    const tooltip = document.getElementById("info-tooltip");
    tooltip.textContent = dot.dataset.tooltip;
    tooltip.classList.remove("hidden");

    // Measure first (off-screen-safe since it's already fixed-position),
    // then clamp within the viewport so it never runs off the edge.
    const dotRect = dot.getBoundingClientRect();
    const tw = tooltip.offsetWidth;
    const th = tooltip.offsetHeight;

    let left = dotRect.left + dotRect.width / 2 - tw / 2;
    let top = dotRect.top - th - 8;
    if (top < 8) top = dotRect.bottom + 8; // flip below if not enough room above

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
// SEARCH & FILTER (browse view)
// ================================
document.getElementById("planet-search").addEventListener("input", () => {
    currentPage = 1;
    renderBrowseTable();
});

document.getElementById("select-all-columns-btn").addEventListener("click", toggleSelectAllColumns);

document.querySelectorAll(".quicklist-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        const key = btn.dataset.list;
        currentQuickList = currentQuickList === key ? null : key;
        sortField = null; // defer to the quick list's own curated order
        sortDirection = null;
        currentPage = 1;
        document.querySelectorAll(".quicklist-btn").forEach(b =>
            b.classList.toggle("active-btn", b.dataset.list === currentQuickList)
        );
        renderBrowseTable();
    });
});

// ================================
// COLUMN SORTING
// First click on a header sorts descending; second click (same header)
// flips to ascending; clicking a different header restarts at descending.
// Missing values always sort to the end, regardless of direction.
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

function getFilteredPlanets() {
    let list = allPlanets;

    if (currentQuickList) {
        list = list.filter(QUICK_LISTS[currentQuickList].filter);
    }

    const query = document.getElementById("planet-search").value.toLowerCase();
    if (query) {
        list = list.filter(p =>
            p.pl_name.toLowerCase().includes(query) || p.hostname.toLowerCase().includes(query)
        );
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
// First column (planet name + compare toggle) and the header row are both
// sticky within the table's own scroll pane (see .browse-table-wrap CSS),
// so they stay visible while scrolling right through extra columns or down
// through a long result list.
// ================================
function renderBrowseTable() {
    const cols = getVisibleColumnFields();
    renderBrowseTableHead(cols);

    const list = getFilteredPlanets();
    const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    currentPage = Math.min(Math.max(1, currentPage), totalPages);
    const startIdx = (currentPage - 1) * PAGE_SIZE;
    const pageList = list.slice(startIdx, startIdx + PAGE_SIZE);

    const tbody = document.getElementById("browse-tbody");

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${cols.length + 2}" class="empty-state"><div class="empty-state-icon">\uD83E\uDE90</div><p>No planets match those filters.</p></td></tr>`;
    } else {
        tbody.innerHTML = pageList.map(p => {
            const inCompare = compareList.some(c => c.pl_name === p.pl_name);
            const dataCells = cols.map(f => {
                const { hasValue } = formatValue(f, p);
                const classes = [isRightAligned(f) ? "num" : "", hasValue ? "" : "muted"].filter(Boolean).join(" ");
                return `<td class="${classes}">${valueWithInfo(f, p)}</td>`;
            }).join("");
            return `
                <tr>
                    <td class="sticky-col">
                        <div class="planet-cell">
                            <span class="planet-link" data-planet="${escapeHtml(p.pl_name)}">${escapeHtml(p.pl_name)}</span>
                            <button type="button" class="compare-toggle-btn ${inCompare ? "active-btn" : ""}" data-planet="${escapeHtml(p.pl_name)}">
                                ${inCompare ? "\u2713 Added" : "+ Compare"}
                            </button>
                        </div>
                    </td>
                    <td class="muted">${escapeHtml(p.hostname)}</td>
                    ${dataCells}
                </tr>`;
        }).join("");
    }

    const rangeStart = list.length === 0 ? 0 : startIdx + 1;
    const rangeEnd = Math.min(startIdx + PAGE_SIZE, list.length);
    document.getElementById("result-count").textContent =
        `Showing ${rangeStart.toLocaleString()}\u2013${rangeEnd.toLocaleString()} of ${list.length.toLocaleString()} planets`;

    renderPaginationControls(totalPages);

    tbody.querySelectorAll("[data-planet].planet-link").forEach(el => {
        el.addEventListener("click", () => showDetail(el.dataset.planet));
    });
    tbody.querySelectorAll(".compare-toggle-btn").forEach(el => {
        el.addEventListener("click", () => toggleCompare(el.dataset.planet));
    });

    renderCompareTray();
}

// Windowed pager (1 ... current-2..current+2 ... last) so this stays usable
// once the real dataset (thousands of rows, hundreds of pages) is loaded —
// a full page-number list would be unusable at that scale.
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
        { field: "pl_name", label: "Planet", rightAlign: false, sticky: true },
        { field: "hostname", label: "Host star", rightAlign: false, sticky: false }
    ].concat(cols.map(f => ({ field: f, label: columnHeaderLabel(f), rightAlign: isRightAligned(f), sticky: false })));

    headRow.innerHTML = headers.map(h => {
        const classes = [h.rightAlign ? "num" : "", h.sticky ? "sticky-col" : ""].filter(Boolean).join(" ");
        const arrow = sortField === h.field ? (sortDirection === "asc" ? " \u25B2" : " \u25BC") : "";
        return `<th class="${classes}" data-sort="${h.field}">${h.label}${arrow}</th>`;
    }).join("");

    headRow.querySelectorAll("th[data-sort]").forEach(th => {
        th.addEventListener("click", () => toggleColumnSort(th.dataset.sort));
    });
}

// ================================
// DETAIL VIEW
// ================================
function showDetail(name) {
    currentDetailPlanet = name === "Earth" ? EARTH_REFERENCE : allPlanets.find(p => p.pl_name === name);
    setView("detail");
}

function renderDetailView() {
    const p = currentDetailPlanet;
    document.getElementById("detail-name").textContent = p.pl_name;
    document.getElementById("detail-sub").innerHTML =
        `Orbits ${escapeHtml(p.hostname)}` +
        (p.disc_year ? ` &middot; discovered ${p.disc_year}${p.discoverymethod ? " via " + escapeHtml(p.discoverymethod) : ""}` : "");

    const metrics = [["Radius", "pl_rade"], ["Mass", "pl_bmasse"], ["Orbital period", "pl_orbper"], ["Distance", "sy_dist"]];
    document.getElementById("metric-grid").innerHTML = metrics.map(([label, field]) => {
        const { text, hasValue } = formatValue(field, p);
        const subLines = [uncertaintyTooltip(field, p), siTooltip(field, p)].filter(Boolean);
        return `
            <div class="metric-card">
                <div class="metric-label">${label}</div>
                <div class="metric-value ${hasValue ? "" : "muted"}">${escapeHtml(text)}</div>
                ${subLines.map(line => `<div class="metric-sub">${escapeHtml(line)}</div>`).join("")}
            </div>`;
    }).join("");

    document.getElementById("detail-columns").innerHTML = DETAIL_SECTIONS.map(section => `
        <div class="property-group">
            <h4>${section.title}</h4>
            <table class="detail-table">
                ${section.fields.map(field => `
                    <tr><td>${columnMap.fields[field].label}</td><td>${valueWithInfo(field, p)}</td></tr>
                `).join("")}
            </table>
        </div>
    `).join("");

    const inCompare = compareList.some(c => c.pl_name === p.pl_name);
    const btn = document.getElementById("detail-compare-btn");
    btn.textContent = inCompare ? "\u2713 In comparison" : "+ Add to compare";
    btn.classList.toggle("active-btn", inCompare);
    btn.onclick = () => { toggleCompare(p.pl_name); renderDetailView(); };
}

// ================================
// COMPARE
// ================================
function toggleCompare(name) {
    if (name === "Earth") return; // pinned, always present

    const idx = compareList.findIndex(c => c.pl_name === name);
    if (idx >= 0) {
        compareList.splice(idx, 1);
    } else {
        const planet = allPlanets.find(p => p.pl_name === name);
        if (!planet) return;
        if (compareList.length >= MAX_COMPARE) {
            compareList.splice(1, 1); // drop the oldest non-Earth pick, silently — no alert
        }
        compareList.push(planet);
    }

    renderCurrentView();
    renderCompareTray();
}

// Re-renders whichever of browse/detail/compare is currently on screen.
// Used any time shared state changes (compare selection, visible columns)
// so the active view reflects it immediately instead of only on next
// navigation.
function renderCurrentView() {
    if (currentView === "browse") renderBrowseTable();
    if (currentView === "detail") renderDetailView();
    if (currentView === "compare") renderCompareView();
}

function renderCompareTray() {
    const tray = document.getElementById("compare-tray");
    const nonEarth = compareList.filter(c => c.pl_name !== "Earth");

    if (nonEarth.length === 0 || currentView === "compare") {
        tray.classList.add("hidden");
        return;
    }
    tray.classList.remove("hidden");

    document.getElementById("tray-chips").innerHTML = compareList.map(p => {
        const pinned = p.pl_name === "Earth";
        return `
            <span class="tray-chip ${pinned ? "pinned" : ""}">
                ${escapeHtml(p.pl_name)}
                ${pinned ? "" : `<span class="tray-remove" data-planet="${escapeHtml(p.pl_name)}">&times;</span>`}
            </span>`;
    }).join("");

    document.getElementById("tray-chips").querySelectorAll(".tray-remove").forEach(el => {
        el.addEventListener("click", () => toggleCompare(el.dataset.planet));
    });
}

function renderCompareView() {
    document.getElementById("compare-count").textContent = `${compareList.length} selected`;

    // Single <table> for both header and body — this is what guarantees the
    // header cells line up with their data columns. (Previously the header
    // was a separate CSS-grid <div> next to an independent <table>, and the
    // two could drift out of sync whenever content widths differed.)
    const theadRow = document.getElementById("compare-thead-row");
    theadRow.innerHTML = `<th class="compare-label-col"></th>` + compareList.map(p => {
        const pinned = p.pl_name === "Earth";
        const distText = pinned ? "Our solar system" : `${formatValue("sy_dist", p).text} away`;
        return `
            <th class="${pinned ? "pinned" : ""}">
                <div class="compare-head-top">
                    <span class="compare-head-name">${escapeHtml(p.pl_name)}</span>
                    ${pinned
                        ? '<span class="pinned-label">Reference</span>'
                        : `<span class="compare-remove" data-planet="${escapeHtml(p.pl_name)}">&times;</span>`}
                </div>
                <div class="compare-head-sub">${escapeHtml(distText)}</div>
            </th>`;
    }).join("");

    // Same field selection as the browse table's Columns picker, so
    // whatever's checked in the sidebar shows up here too. sy_dist is
    // skipped as a row since it's already shown in the header subtitle.
    const groups = COLUMN_GROUPS
        .map(g => ({ title: g.title, fields: g.fields.filter(f => visibleColumns.has(f) && f !== "sy_dist") }))
        .filter(g => g.fields.length > 0);

    let rowsHtml = "";
    if (groups.length === 0) {
        rowsHtml = `<tr><td colspan="${compareList.length + 1}" class="empty-state"><p>No columns selected — check some boxes under "Columns" in the sidebar.</p></td></tr>`;
    } else {
        groups.forEach(group => {
            rowsHtml += `<tr class="compare-section-row"><td colspan="${compareList.length + 1}">${group.title}</td></tr>`;
            group.fields.forEach(field => {
                const cells = compareList.map(p =>
                    `<td class="${p.pl_name === "Earth" ? "pinned" : ""}">${valueWithInfo(field, p)}</td>`
                ).join("");
                rowsHtml += `<tr><td class="compare-label-col">${columnMap.fields[field].label}</td>${cells}</tr>`;
            });
        });
    }

    document.getElementById("compare-tbody").innerHTML = rowsHtml;

    // Size-comparison strip, same pattern as displayScale() in
    // planetary-properties.js but driven directly by pl_rade (already
    // Earth-relative, so no unit conversion needed).
    renderSizeComparison();

    document.querySelectorAll(".compare-remove").forEach(el => {
        el.addEventListener("click", () => toggleCompare(el.dataset.planet));
    });
}

function renderSizeComparison() {
    const container = document.getElementById("compare-scale");
    const withRadius = compareList.filter(p => p.pl_rade !== null);
    if (withRadius.length === 0) {
        container.innerHTML = `<p class="muted" style="padding: 12px 0;">No radius data available for the selected planets.</p>`;
        return;
    }
    const maxRadius = Math.max(...withRadius.map(p => p.pl_rade));

    container.innerHTML = withRadius.map(p => {
        const size = Math.max((p.pl_rade / maxRadius) * MAX_SCALE_SIZE, 10);
        const pinned = p.pl_name === "Earth";
        return `
            <div class="scale-planet-wrap">
                <div class="scale-planet" style="width:${size}px; height:${size}px; background: radial-gradient(circle at 35% 35%, ${pinned ? "#9adcff" : "#c4b5fd"}, ${pinned ? "#1a5fa8" : "#5b21b6"});"></div>
                <div class="scale-planet-label">${escapeHtml(p.pl_name)}<br>${formatValue("pl_rade", p).text}</div>
            </div>`;
    }).join("");
}

// ================================
// VIEW SWITCHING
// ================================
function setView(view) {
    currentView = view;
    document.getElementById("browse-view").classList.toggle("hidden", view !== "browse");
    document.getElementById("detail-view").classList.toggle("hidden", view !== "detail");
    document.getElementById("compare-view").classList.toggle("hidden", view !== "compare");

    renderCurrentView();
    renderCompareTray();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

document.getElementById("detail-back").addEventListener("click", () => setView("browse"));
document.getElementById("compare-add-another").addEventListener("click", () => setView("browse"));
document.getElementById("view-compare-btn").addEventListener("click", () => setView("compare"));

// ================================
// SIDEBAR COLLAPSE / EXPAND
// Same pattern as planetary-properties.html/.js
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
loadPlanets();