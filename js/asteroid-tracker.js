// ================================
// STATE
// ================================
let allRows          = [];
let columnMap         = null;
let visibleColumns    = [];       // ordered list of field keys shown in browse table (beyond the sticky name column)
let currentPage       = 1;
const PAGE_SIZE       = 50;       // matches exoplanet-explorer.js's convention
let sortField         = null;
let sortDirection     = null;     // "desc" | "asc" — first click on a column sorts descending
let searchQuery       = "";
let activeQuickList   = null;
let compareSet        = [];       // array of rowKey strings
let currentView       = "browse"; // "browse" | "detail" | "compare"
let currentDetailKey  = null;

const MAX_COMPARE = 4;

const DEFAULT_COLUMNS = [
    "is_potentially_hazardous",
    "close_approach_date",
    "miss_distance_km",
    "estimated_diameter_km_max",
    "relative_velocity_km_s"
];

// Fields shown in the browse table's column picker, grouped by the same
// categories as the column map — excludes "name" (always the sticky first
// column) and "nasa_jpl_url" (detail-view only, not a browsable column).
// relative_velocity_km_h and miss_distance_au are deliberately NOT listed
// here — they're alt-unit companions to fields that already appear
// (relative_velocity_km_s, miss_distance_km), matching how exoplanet-
// explorer.js's altUnitField entries are metadata only, not separately
// toggleable columns.
const PICKER_FIELDS = {
    identification: ["is_potentially_hazardous"],
    physical: ["absolute_magnitude_h", "estimated_diameter_km_min", "estimated_diameter_km_max"],
    approach: [
        "close_approach_date", "close_approach_date_full",
        "relative_velocity_km_s", "miss_distance_km", "miss_distance_lunar",
        "orbiting_body"
    ]
};

// ================================
// HELPERS
// ================================
function rowKey(row) {
    return `${row.id}_${row.close_approach_date}`;
}

function findRow(key) {
    return allRows.find((r) => rowKey(r) === key);
}

function fieldInfo(field) {
    return (columnMap.fields && columnMap.fields[field]) || {};
}

function formatValue(row, field) {
    const raw = row[field];
    const info = fieldInfo(field);
    if (raw === null || raw === undefined || raw === "") {
        return info.nullLabel ?? "\u2014";
    }
    if (typeof raw === "boolean") {
        return raw ? "Yes" : "No";
    }
    if (typeof raw === "number") {
        const precision = info.precision ?? 2;
        const formatted = raw.toLocaleString(undefined, {
            minimumFractionDigits: precision,
            maximumFractionDigits: precision
        });
        return info.unit && info.unit !== "boolean" ? `${formatted} ${info.unit}` : formatted;
    }
    return String(raw);
}

function tooltipText(field, row) {
    const info = fieldInfo(field);
    const lines = [];
    if (info.tooltip) lines.push(info.tooltip);
    if (info.siConversion) {
        const raw = Number(row?.[field]);
        if (Number.isFinite(raw)) {
            const converted = raw * info.siConversion.multiplier;
            const convStr = info.siConversion.useScientificNotation
                ? converted.toExponential(2)
                : converted.toLocaleString(undefined, { maximumFractionDigits: 2 });
            lines.push(`${convStr} ${info.siConversion.unit}`);
        }
    }
    return lines.join("\n");
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

// ================================
// LOAD DATA
// ================================
Promise.all([
    fetch("../data/asteroids.json").then((r) => r.json()),
    fetch("../data/asteroid-column-map.json").then((r) => r.json())
]).then(([rows, map]) => {
    allRows = rows;
    columnMap = map;
    visibleColumns = [...DEFAULT_COLUMNS];
    buildColumnPicker();
    renderBrowseView();
}).catch((err) => {
    console.error("Failed to load asteroid data:", err);
    document.getElementById("browse-tbody").innerHTML =
        `<tr><td colspan="6">Couldn't load asteroid data. Please try again later.</td></tr>`;
});

// ================================
// COLUMN PICKER
// ================================
function buildColumnPicker() {
    const container = document.getElementById("column-picker");
    container.innerHTML = "";

    Object.keys(PICKER_FIELDS).forEach((category) => {
        const group = document.createElement("div");
        group.className = "property-group";

        const heading = document.createElement("h4");
        heading.textContent = columnMap.categories?.[category] || category;
        group.appendChild(heading);

        const grid = document.createElement("div");
        grid.className = "group-grid";

        PICKER_FIELDS[category].forEach((field) => {
            const label = document.createElement("label");
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = visibleColumns.includes(field);
            checkbox.addEventListener("change", () => {
                if (checkbox.checked) {
                    if (!visibleColumns.includes(field)) visibleColumns.push(field);
                } else {
                    visibleColumns = visibleColumns.filter((f) => f !== field);
                }
                renderCurrentView();
            });
            const span = document.createElement("span");
            span.textContent = fieldInfo(field).label || field;
            label.appendChild(checkbox);
            label.appendChild(span);
            grid.appendChild(label);
        });

        group.appendChild(grid);
        container.appendChild(group);
    });
}

let allColumnsSelected = false;

document.getElementById("select-all-columns-btn").addEventListener("click", () => {
    allColumnsSelected = !allColumnsSelected;
    const allFields = Object.values(PICKER_FIELDS).flat();
    visibleColumns = allColumnsSelected ? [...allFields] : [];
    document.getElementById("select-all-columns-btn").textContent = allColumnsSelected ? "Deselect All" : "Select All";
    buildColumnPicker();
    renderCurrentView();
});

// Re-renders whichever of browse/detail/compare is currently on screen —
// used any time shared state changes (compare selection, visible columns).
function renderCurrentView() {
    if (currentView === "browse") renderBrowseView();
    if (currentView === "detail") renderDetailView();
    if (currentView === "compare") renderCompareView();
}

// ================================
// SEARCH
// ================================
document.getElementById("asteroid-search").addEventListener("input", function () {
    searchQuery = this.value.trim().toLowerCase();
    activeQuickList = null;
    document.querySelectorAll(".quicklist-btn").forEach((b) => b.classList.remove("active-btn"));
    currentPage = 1;
    renderBrowseView();
});

// ================================
// QUICK LISTS
// ================================
document.querySelectorAll(".quicklist-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
        const list = btn.dataset.list;
        const isActive = btn.classList.contains("active-btn");
        document.querySelectorAll(".quicklist-btn").forEach((b) => b.classList.remove("active-btn"));

        if (isActive) {
            activeQuickList = null;
        } else {
            activeQuickList = list;
            btn.classList.add("active-btn");
        }
        sortField = null;
        sortDirection = null;
        currentPage = 1;
        showBrowseView();
        renderBrowseView();
    });
});

function applyQuickList(rows) {
    switch (activeQuickList) {
        case "closest":
            return [...rows].sort((a, b) => a.miss_distance_km - b.miss_distance_km);
        case "hazardous":
            return rows.filter((r) => r.is_potentially_hazardous);
        case "largest":
            return [...rows].sort((a, b) => b.estimated_diameter_km_max - a.estimated_diameter_km_max);
        case "fastest":
            return [...rows].sort((a, b) => b.relative_velocity_km_s - a.relative_velocity_km_s);
        default:
            return rows;
    }
}

// ================================
// SORTING
// First click on a header sorts descending; second click flips to
// ascending; a different header restarts at descending. Missing values
// always sort to the end, regardless of direction — matches
// exoplanet-explorer.js's compareForSort convention.
// ================================
function toggleSort(field) {
    if (sortField === field) {
        sortDirection = sortDirection === "desc" ? "asc" : "desc";
    } else {
        sortField = field;
        sortDirection = "desc";
    }
    activeQuickList = null;
    document.querySelectorAll(".quicklist-btn").forEach((b) => b.classList.remove("active-btn"));
    currentPage = 1;
    renderBrowseView();
}

function compareForSort(a, b) {
    const av = a[sortField], bv = b[sortField];
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

// ================================
// BROWSE VIEW
// ================================
function getFilteredSortedRows() {
    let rows = allRows;

    if (searchQuery) {
        rows = rows.filter((r) => r.name.toLowerCase().includes(searchQuery));
    }

    if (activeQuickList) {
        rows = applyQuickList(rows);
    } else if (sortField) {
        rows = rows.slice().sort(compareForSort);
    }

    return rows;
}

function renderBrowseView() {
    if (!columnMap) return;
    const list = getFilteredSortedRows();

    renderTableHead();

    const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    currentPage = Math.min(Math.max(1, currentPage), totalPages);
    const startIdx = (currentPage - 1) * PAGE_SIZE;
    const pageList = list.slice(startIdx, startIdx + PAGE_SIZE);

    renderTableBody(pageList, list.length);
    renderPaginationControls(totalPages);

    const rangeStart = list.length === 0 ? 0 : startIdx + 1;
    const rangeEnd = Math.min(startIdx + PAGE_SIZE, list.length);
    document.getElementById("result-count").textContent =
        `Showing ${rangeStart.toLocaleString()}\u2013${rangeEnd.toLocaleString()} of ${list.length.toLocaleString()} close approaches`;

    renderCompareTray();
}

function renderTableHead() {
    const headRow = document.getElementById("browse-thead-row");
    headRow.innerHTML = "";

    const nameTh = document.createElement("th");
    nameTh.className = "sticky-col";
    nameTh.textContent = "Designation";
    headRow.appendChild(nameTh);

    visibleColumns.forEach((field) => {
        const th = document.createElement("th");
        const info = fieldInfo(field);
        const isNum = typeof allRows[0]?.[field] === "number";
        if (isNum) th.classList.add("num");
        th.textContent = info.label || field;
        if (sortField === field) th.textContent += sortDirection === "asc" ? " \u25B2" : " \u25BC";
        th.addEventListener("click", () => toggleSort(field));
        headRow.appendChild(th);
    });
}

function renderTableBody(pageRows, totalCount) {
    const tbody = document.getElementById("browse-tbody");
    tbody.innerHTML = "";

    if (totalCount === 0) {
        const emptyRow = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = visibleColumns.length + 1;
        cell.innerHTML = `<div class="empty-state"><div class="empty-state-icon">\u{1F30C}</div><p>No close approaches match your filters</p></div>`;
        emptyRow.appendChild(cell);
        tbody.appendChild(emptyRow);
        return;
    }

    pageRows.forEach((row) => {
        const tr = document.createElement("tr");
        const key = rowKey(row);
        const inCompare = compareSet.includes(key);

        // Sticky name column holds BOTH the name link and the compare
        // toggle — matches exoplanet-explorer.html's .planet-cell pattern.
        // A separate trailing column for the button gets pushed off-screen
        // to the right once several data columns are visible, making it
        // easy to miss without horizontal scrolling.
        const nameTd = document.createElement("td");
        nameTd.className = "sticky-col";
        const cellWrap = document.createElement("div");
        cellWrap.className = "asteroid-cell";

        const link = document.createElement("span");
        link.className = "asteroid-link";
        link.textContent = row.name;
        link.addEventListener("click", () => openDetail(key));
        cellWrap.appendChild(link);

        if (row.is_potentially_hazardous) {
            const badge = document.createElement("span");
            badge.className = "hazard-badge";
            badge.textContent = "Hazardous";
            cellWrap.appendChild(badge);
        }

        const compareBtn = document.createElement("button");
        compareBtn.type = "button";
        compareBtn.className = "compare-toggle-btn" + (inCompare ? " active-btn" : "");
        compareBtn.textContent = inCompare ? "\u2713 Added" : "+ Compare";
        compareBtn.addEventListener("click", () => toggleCompare(key));
        cellWrap.appendChild(compareBtn);

        nameTd.appendChild(cellWrap);
        tr.appendChild(nameTd);

        visibleColumns.forEach((field) => {
            const td = document.createElement("td");
            if (typeof row[field] === "number") td.classList.add("num");
            td.textContent = formatValue(row, field);
            if (fieldInfo(field).siConversion) {
                const dot = document.createElement("span");
                dot.className = "info-dot";
                dot.textContent = "i";
                attachTooltip(dot, row, field);
                td.appendChild(dot);
            }
            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });
}

// ================================
// PAGINATION — windowed (1 ... current-2..current+2 ... last), same
// convention as exoplanet-explorer.js's renderPaginationControls.
// ================================
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

    const pageButtons = pages.map((p) =>
        p === "..."
            ? `<span class="page-ellipsis">&hellip;</span>`
            : `<button type="button" class="page-btn ${p === currentPage ? "active-page" : ""}" data-page="${p}">${p}</button>`
    ).join("");

    container.innerHTML = `
        <button type="button" class="page-btn" data-page="prev" ${currentPage === 1 ? "disabled" : ""}>&laquo; Prev</button>
        ${pageButtons}
        <button type="button" class="page-btn" data-page="next" ${currentPage === totalPages ? "disabled" : ""}>Next &raquo;</button>`;

    container.querySelectorAll(".page-btn:not(:disabled)").forEach((btn) => {
        btn.addEventListener("click", () => {
            const val = btn.dataset.page;
            if (val === "prev") currentPage -= 1;
            else if (val === "next") currentPage += 1;
            else currentPage = parseInt(val, 10);
            renderBrowseView();
            document.getElementById("browse-view").scrollIntoView({ behavior: "smooth", block: "start" });
        });
    });
}

// ================================
// TOOLTIP
// ================================
const tooltipEl = document.getElementById("info-tooltip");

function attachTooltip(dotEl, row, field) {
    dotEl.addEventListener("mouseenter", () => {
        const text = tooltipText(field, row);
        if (!text) return;
        tooltipEl.textContent = text;
        tooltipEl.classList.remove("hidden");
        const rect = dotEl.getBoundingClientRect();
        tooltipEl.style.left = `${rect.left}px`;
        tooltipEl.style.top = `${rect.bottom + 6}px`;
    });
    dotEl.addEventListener("mouseleave", () => {
        tooltipEl.classList.add("hidden");
    });
}

// ================================
// VIEW SWITCHING
// ================================
function showBrowseView() {
    currentView = "browse";
    document.getElementById("browse-view").classList.remove("hidden");
    document.getElementById("detail-view").classList.add("hidden");
    document.getElementById("compare-view").classList.add("hidden");
}

function showDetailView() {
    currentView = "detail";
    document.getElementById("browse-view").classList.add("hidden");
    document.getElementById("detail-view").classList.remove("hidden");
    document.getElementById("compare-view").classList.add("hidden");
}

function showCompareView() {
    currentView = "compare";
    document.getElementById("browse-view").classList.add("hidden");
    document.getElementById("detail-view").classList.add("hidden");
    document.getElementById("compare-view").classList.remove("hidden");
}

document.getElementById("detail-back").addEventListener("click", () => {
    showBrowseView();
    renderBrowseView();
});

// ================================
// DETAIL VIEW
// ================================
function openDetail(key) {
    currentDetailKey = key;
    showDetailView();
    renderDetailView();
}

function renderDetailView() {
    const row = findRow(currentDetailKey);
    if (!row) return;

    document.getElementById("detail-name").textContent = row.name;
    document.getElementById("detail-sub").textContent =
        `Close approach on ${row.close_approach_date}${row.is_potentially_hazardous ? " \u2014 Potentially Hazardous" : ""}`;
    document.getElementById("detail-jpl-link").href = row.nasa_jpl_url || "#";

    const metricGrid = document.getElementById("metric-grid");
    metricGrid.innerHTML = "";
    [
        ["estimated_diameter_km_max", "Diameter (max)"],
        ["miss_distance_km", "Miss Distance"],
        ["relative_velocity_km_s", "Velocity"],
        ["absolute_magnitude_h", "Absolute Magnitude"]
    ].forEach(([field, label]) => {
        const card = document.createElement("div");
        card.className = "metric-card";
        card.innerHTML = `
            <div class="metric-label">${escapeHtml(label)}</div>
            <div class="metric-value">${escapeHtml(formatValue(row, field))}</div>
        `;
        metricGrid.appendChild(card);
    });

    const columns = document.getElementById("detail-columns");
    columns.innerHTML = "";
    Object.keys(PICKER_FIELDS).forEach((category) => {
        const wrap = document.createElement("div");
        const title = document.createElement("div");
        title.className = "property-group";
        const heading = document.createElement("h4");
        heading.textContent = columnMap.categories?.[category] || category;
        title.appendChild(heading);

        const table = document.createElement("table");
        table.className = "detail-table";
        PICKER_FIELDS[category].forEach((field) => {
            const tr = document.createElement("tr");
            tr.innerHTML = `<td>${escapeHtml(fieldInfo(field).label || field)}</td><td>${escapeHtml(formatValue(row, field))}</td>`;
            table.appendChild(tr);
        });
        title.appendChild(table);
        columns.appendChild(title);
    });

    const btn = document.getElementById("detail-compare-btn");
    const inCompare = compareSet.includes(currentDetailKey);
    btn.textContent = inCompare ? "\u2713 In comparison" : "+ Add to compare";
    btn.classList.toggle("active-btn", inCompare);
    btn.onclick = () => toggleCompare(currentDetailKey);
}

// ================================
// COMPARE
// ================================
function toggleCompare(key) {
    const idx = compareSet.indexOf(key);
    if (idx >= 0) {
        compareSet.splice(idx, 1);
    } else {
        if (compareSet.length >= MAX_COMPARE) {
            compareSet.shift(); // silently drop the oldest pick — matches exoplanet-explorer.js's convention
        }
        compareSet.push(key);
    }
    renderCurrentView();
    renderCompareTray();
}

function renderCompareTray() {
    const tray = document.getElementById("compare-tray");
    const summary = document.getElementById("sidebar-compare-summary");

    if (compareSet.length === 0 || currentView === "compare") {
        tray.classList.add("hidden");
        if (compareSet.length === 0) summary.textContent = "Add asteroids from the table to compare them.";
        else summary.innerHTML = `<span class="count">${compareSet.length}</span> asteroid${compareSet.length === 1 ? "" : "s"} selected`;
        return;
    }

    tray.classList.remove("hidden");
    summary.innerHTML = `<span class="count">${compareSet.length}</span> asteroid${compareSet.length === 1 ? "" : "s"} selected`;

    const chips = document.getElementById("tray-chips");
    chips.innerHTML = "";
    compareSet.forEach((key) => {
        const row = findRow(key);
        if (!row) return;
        const chip = document.createElement("div");
        chip.className = "tray-chip";
        chip.innerHTML = `${escapeHtml(row.name)} <span class="tray-remove">&times;</span>`;
        chip.querySelector(".tray-remove").addEventListener("click", (e) => {
            e.stopPropagation();
            toggleCompare(key);
        });
        chips.appendChild(chip);
    });
}

document.getElementById("view-compare-btn").addEventListener("click", () => {
    showCompareView();
    renderCompareView();
});

document.getElementById("compare-add-another").addEventListener("click", () => {
    showBrowseView();
    renderBrowseView();
});

function renderCompareView() {
    document.getElementById("compare-count").textContent = `${compareSet.length} of ${MAX_COMPARE} selected`;

    const theadRow = document.getElementById("compare-thead-row");
    theadRow.innerHTML = `<th class="compare-label-col"></th>`;
    compareSet.forEach((key) => {
        const row = findRow(key);
        if (!row) return;
        const th = document.createElement("th");
        th.innerHTML = `
            <div class="compare-head-top">
                <div>
                    <span class="compare-head-name">${escapeHtml(row.name)}</span>
                    <div class="compare-head-sub">${escapeHtml(row.close_approach_date)}</div>
                </div>
                <span class="compare-remove" data-key="${key}">&times;</span>
            </div>
        `;
        theadRow.appendChild(th);
    });
    theadRow.querySelectorAll(".compare-remove").forEach((el) => {
        el.addEventListener("click", () => toggleCompare(el.dataset.key));
    });

    const tbody = document.getElementById("compare-tbody");
    tbody.innerHTML = "";

    if (compareSet.length === 0) {
        tbody.innerHTML = `<tr><td class="compare-label-col">No asteroids selected</td></tr>`;
        return;
    }

    // Respects the sidebar column picker, same as the browse table — and
    // skips close_approach_date since it's already shown in each column's
    // header subtitle (mirrors exoplanet-explorer.js excluding sy_dist from
    // compare rows for the same reason).
    const groups = Object.keys(PICKER_FIELDS)
        .map((category) => ({
            category,
            fields: PICKER_FIELDS[category].filter((f) => visibleColumns.includes(f) && f !== "close_approach_date")
        }))
        .filter((g) => g.fields.length > 0);

    if (groups.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${compareSet.length + 1}" class="empty-state"><p>No columns selected \u2014 check some boxes under "Columns" in the sidebar.</p></td></tr>`;
        return;
    }

    groups.forEach((group) => {
        const sectionRow = document.createElement("tr");
        sectionRow.className = "compare-section-row";
        const sectionTd = document.createElement("td");
        sectionTd.colSpan = compareSet.length + 1;
        sectionTd.textContent = columnMap.categories?.[group.category] || group.category;
        sectionRow.appendChild(sectionTd);
        tbody.appendChild(sectionRow);

        group.fields.forEach((field) => {
            const tr = document.createElement("tr");
            const labelTd = document.createElement("td");
            labelTd.className = "compare-label-col";
            labelTd.textContent = fieldInfo(field).label || field;
            tr.appendChild(labelTd);

            compareSet.forEach((key) => {
                const row = findRow(key);
                const td = document.createElement("td");
                td.textContent = row ? formatValue(row, field) : "\u2014";
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
    });
}

// ================================
// SIDEBAR COLLAPSE
// ================================
document.getElementById("toggle-sidebar").addEventListener("click", () => {
    document.querySelector("main.tool-layout").classList.add("sidebar-collapsed");
});
function expandSidebar() {
    document.querySelector("main.tool-layout").classList.remove("sidebar-collapsed");
}