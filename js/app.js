let selectedPlanets = [];
let allPlanets = [];

const MAX_DISPLAY_SIZE = 400; // px — largest planet in size comparison

// ================================
// LOAD DATA
// ================================
async function loadPlanets() {
    const response = await fetch("../data/planets.json");
    const planets  = await response.json();
    allPlanets = planets;
    renderPlanetGrid(planets);
}

// ================================
// RENDER PLANET GRID
// Applies .selected and .disabled states visually
// so the user never sees an alert — unselectable cards just look dimmed
// ================================
function renderPlanetGrid(planets) {
    const grid = document.getElementById("planet-grid");
    grid.innerHTML = "";

    const twoSelected = selectedPlanets.length >= 2;

    planets.forEach(planet => {
        const card = document.createElement("div");
        card.classList.add("planet-card");

        const isSelected = !!selectedPlanets.find(p => p.name === planet.name);

        if (isSelected) {
            card.classList.add("selected");
        } else if (twoSelected) {
            // Already have 2 — dim unselected cards instead of showing alert
            card.classList.add("disabled");
        }

        card.innerHTML = `
            <img src="${planet.image}" alt="${planet.name}">
            <p>${planet.name}</p>
        `;

        card.addEventListener("click", () => {
            if (card.classList.contains("disabled")) return; // silently ignore
            selectPlanet(card, planet);
        });

        grid.appendChild(card);
    });
}

// ================================
// SEARCH & FILTER
// ================================
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("class-filter").addEventListener("change", applyFilters);
});

document.getElementById("planet-search").addEventListener("input", applyFilters);

function applyFilters() {
    const query         = document.getElementById("planet-search").value.toLowerCase();
    const selectedClass = document.getElementById("class-filter").value;

    let filtered = allPlanets;
    if (selectedClass !== "all") {
        filtered = filtered.filter(p => p.class.toLowerCase() === selectedClass);
    }
    filtered = filtered.filter(p => p.name.toLowerCase().includes(query));
    renderPlanetGrid(filtered);
}

// ================================
// SELECT / DESELECT PLANET
// ================================
function selectPlanet(card, planet) {
    const alreadySelected = selectedPlanets.find(p => p.name === planet.name);

    if (alreadySelected) {
        selectedPlanets = selectedPlanets.filter(p => p.name !== planet.name);
    } else {
        if (selectedPlanets.length >= 2) return; // safety guard, no alert
        selectedPlanets.push(planet);
    }

    // Re-render grid to update disabled/selected states across all cards
    applyFilters();
    displayComparison();
    displayScale();
}

// ================================
// PROPERTY LABELS
// ================================
const propertyLabels = {
    class:                     "Class",
    parent:                    "Parent",
    moons:                     "Moons",
    mass_kg:                   "Mass (kg)",
    mean_radius_km:            "Mean Radius (km)",
    volume_km3:                "Volume (km³)",
    density_kg_m3:             "Density (kg/m³)",
    gravity_m_s2:              "Gravity (m/s²)",
    escape_velocity_km_s:      "Escape Velocity (km/s)",
    oblateness:                "Oblateness",
    perihelion:                "Perihelion",
    aphelion:                  "Aphelion",
    semi_major_axis:           "Semi-Major Axis",
    orbital_period_days:       "Orbital Period (days)",
    rotation_period_hours:     "Rotation Period (hrs)",
    rotation_speed_kmh:        "Rotation Speed (km/h)",
    eccentricity:              "Eccentricity",
    axial_tilt_deg:            "Axial Tilt (°)",
    orbital_inclination_deg:   "Orbital Inclination (°)",
    avg_temp_c:                "Avg Surface Temp (°C)",
    temp_range_c:              "Surface Temp Range (°C)",
    magnetism_gauss:           "Magnetism (Gauss)",
    atmospheric_density_kg_m3: "Atmospheric Density (kg/m³)",
    atmospheric_pressure_bar:  "Atmospheric Pressure (bar)",
    atmospheric_composition:   "Atmospheric Composition",
    scale_height_km:           "Scale Height (km)",
    surface_composition:       "Surface Composition",
    albedo:                    "Albedo"
};

function getDynamicLabel(planet, prop) {
    const isMoon = planet.class === "Moon";
    if (prop === "perihelion")      return isMoon ? "Perigee (km)"                     : "Perihelion (AU)";
    if (prop === "aphelion")        return isMoon ? "Apogee (km)"                      : "Aphelion (AU)";
    if (prop === "semi_major_axis") return isMoon ? "Semi-Major Axis to Parent (km)"   : "Semi-Major Axis (AU)";
    return propertyLabels[prop] || prop;
}

function getValueWithUnits(planet, prop) {
    const isMoon = planet.class === "Moon";
    if (prop === "perihelion")      return isMoon ? planet.perihelion_km      : planet.perihelion_au;
    if (prop === "aphelion")        return isMoon ? planet.aphelion_km        : planet.aphelion_au;
    if (prop === "semi_major_axis") return isMoon ? planet.semi_major_axis_km : planet.semi_major_axis_au;

    const value = planet[prop];
    if (Array.isArray(value)) return value[0] + " to " + value[1];
    return value ?? "Unknown";
}

function getSelectedProperties() {
    return Array.from(document.querySelectorAll("#property-controls input:checked"))
                .map(cb => cb.value);
}

// ================================
// DISPLAY COMPARISON CARDS
// ================================
function displayComparison() {
    const container = document.getElementById("comparison-container");
    container.innerHTML = "";

    if (selectedPlanets.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🪐</div>
                <p>Select up to 2 planetary bodies from the sidebar to compare their properties.</p>
            </div>
        `;
        return;
    }

    const selectedProps = getSelectedProperties();

    selectedPlanets.forEach((planet, index) => {
        const card = document.createElement("div");
        card.classList.add("comparison-card");

        let propertyHTML = "";

        selectedProps.forEach(prop => {
            let className = "";

            if (selectedPlanets.length === 2) {
                const thisVal  = planet[prop];
                const otherVal = selectedPlanets[1 - index][prop];
                if (typeof thisVal === "number" && typeof otherVal === "number") {
                    className = thisVal > otherVal ? "better" : thisVal < otherVal ? "worse" : "";
                }
            }

            const label = getDynamicLabel(planet, prop);
            const val   = getValueWithUnits(planet, prop);

            propertyHTML += `
                <p class="${className}">
                    <strong>${label}:</strong> ${val}
                </p>
            `;
        });

        card.innerHTML = `
            <div class="planet-img-wrap">
                <img src="${planet.image}" alt="${planet.name}">
            </div>
            <h2>${planet.name}</h2>
            ${propertyHTML}
        `;

        container.appendChild(card);
    });
}

// ================================
// SIZE COMPARISON
// Largest body = MAX_DISPLAY_SIZE px, others scale proportionally
// ================================
function displayScale() {
    const container = document.getElementById("scale-container");
    container.innerHTML = "";

    if (selectedPlanets.length === 0) return;

    const maxRadius = Math.max(...selectedPlanets.map(p => p.mean_radius_km));

    const colors = [
        ["#1a5fa8", "#6db8ff"],  // blue for first
        ["#5b21b6", "#c4b5fd"]   // purple for second
    ];

    selectedPlanets.forEach((planet, index) => {
      const ratio = planet.mean_radius_km / maxRadius;
      const size  = Math.max(ratio * MAX_DISPLAY_SIZE, 8);
      const c     = colors[index];

      const wrap = document.createElement("div");
      wrap.classList.add("scale-planet-wrap");

      const planetDiv = document.createElement("div");
      planetDiv.classList.add("scale-planet");
      planetDiv.style.width      = size + "px";
      planetDiv.style.height     = size + "px";
      planetDiv.style.background = `radial-gradient(circle at 35% 35%, ${c[1]}, ${c[0]})`;
      planetDiv.style.boxShadow  = `0 0 ${Math.max(size * 0.2, 10)}px ${c[1]}55`;

      const label = document.createElement("div");
      label.classList.add("scale-planet-label");
      label.innerHTML = `${planet.name}<br>${planet.mean_radius_km.toLocaleString()} km`;

      wrap.appendChild(planetDiv);
      wrap.appendChild(label);
      container.appendChild(wrap);
  });
}

// ================================
// LIVE PROPERTY UPDATES
// ================================
document.addEventListener("change", (e) => {
    if (e.target.closest("#property-controls")) {
        displayComparison();
    }
});

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
// KEYBOARD NAV
// ================================
document.addEventListener("keydown", (e) => {
    const grid = document.getElementById("planet-grid");
    if (!grid) return;
    if (e.key === "ArrowDown") grid.scrollBy({ top:  80, behavior: "smooth" });
    if (e.key === "ArrowUp")   grid.scrollBy({ top: -80, behavior: "smooth" });
});

// ================================
// INIT
// ================================
loadPlanets();