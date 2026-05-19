let useMetric = false;
let planets = [];
let currentScenario = "weight";
let selectedPlanet = null;

const earthG = 9.81;

// =========================
// LOAD DATA
// =========================
fetch("../data/planets.json")
    .then(res => res.json())
    .then(data => {
        planets = data;
        renderPlanetSelector();
        updateDataTable();
    });

// =========================
// SEARCH & FILTER
// =========================
document.getElementById("planet-search").addEventListener("input", applyFilters);
document.getElementById("class-filter").addEventListener("change", applyFilters);

function applyFilters() {
    const query = document.getElementById("planet-search").value.toLowerCase();
    const selectedClass = document.getElementById("class-filter").value;
    let filtered = planets;
    if (selectedClass !== "all") {
        filtered = filtered.filter(p => p.class.toLowerCase() === selectedClass);
    }
    filtered = filtered.filter(p => p.name.toLowerCase().includes(query));
    renderPlanetSelector(filtered);
}

// =========================
// SCENARIO CONTROL
// =========================
function setScenario(type) {
    currentScenario = type;
    updateButtons();
    updateAnimation();
    updateDataTable();
}

function updateButtons() {
    ["weight", "jump", "throw", "run"].forEach(type => {
        const btn = document.getElementById(`btn-${type}`);
        if (!btn) return;
        btn.classList.toggle("active-btn", currentScenario === type);
    });
}

// =========================
// UNIT TOGGLE
// =========================
function toggleUnits() {
    const weightEl = document.getElementById("userWeight");
    const jumpEl   = document.getElementById("userJump");
    const throwEl  = document.getElementById("userThrow");
    const speedEl  = document.getElementById("userSpeed");

    if (!useMetric) {
        weightEl.value = (parseFloat(weightEl.value) * 0.453592).toFixed(1);
        jumpEl.value   = (parseFloat(jumpEl.value)   * 0.3048).toFixed(2);
        throwEl.value  = (parseFloat(throwEl.value)  * 0.3048).toFixed(2);
        speedEl.value  = (parseFloat(speedEl.value)  * 1.60934).toFixed(2);
    } else {
        weightEl.value = (parseFloat(weightEl.value) / 0.453592).toFixed(1);
        jumpEl.value   = (parseFloat(jumpEl.value)   / 0.3048).toFixed(2);
        throwEl.value  = (parseFloat(throwEl.value)  / 0.3048).toFixed(2);
        speedEl.value  = (parseFloat(speedEl.value)  / 1.60934).toFixed(2);
    }

    useMetric = !useMetric;
    updateUnits();
    updateAnimation();
    updateDataTable();
}

function updateUnits() {
    document.getElementById("unit-weight").innerText   = useMetric ? "kg"   : "lbs";
    document.getElementById("unit-height").innerText   = useMetric ? "m"    : "ft";
    document.getElementById("unit-distance").innerText = useMetric ? "m"    : "ft";
    document.getElementById("unit-speed").innerText    = useMetric ? "km/h" : "mph";

    const btn = document.getElementById("unit-toggle-btn");
    if (btn) btn.textContent = useMetric ? "⇄ Switch to Imperial" : "⇄ Switch to Metric";
}

// =========================
// PLANET SELECTOR
// =========================
function renderPlanetSelector(list = planets) {
    const container = document.getElementById("planet-selector");
    if (!container) return;
    container.innerHTML = "";

    list.forEach(p => {
        const card = document.createElement("div");
        card.className = "planet-card";
        if (selectedPlanet && selectedPlanet.name === p.name) card.classList.add("selected");

        card.innerHTML = `<img src="${p.image}" alt="${p.name}"><p>${p.name}</p>`;

        card.onclick = () => {
            selectedPlanet = p;
            document.querySelectorAll("#planet-selector .planet-card")
                .forEach(c => c.classList.remove("selected"));
            card.classList.add("selected");
            document.getElementById("visual-title").innerText = p.name;
            updateAnimation();
        };

        container.appendChild(card);
    });
}

// =========================
// ANIMATION
// =========================
function updateAnimation() {
    const container = document.getElementById("visual-animation");
    if (!container) return;

    if (!selectedPlanet) {
        container.innerHTML = `<div class="anim-empty">Choose a body from the left panel to see your scenario visualized.</div>`;
        return;
    }

    const g     = selectedPlanet.gravity_m_s2;
    const ratio = g / earthG;

    const weight    = parseFloat(document.getElementById("userWeight").value);
    const jump      = parseFloat(document.getElementById("userJump").value);
    const throwRange = parseFloat(document.getElementById("userThrow").value);
    const speed     = parseFloat(document.getElementById("userSpeed").value);

    container.innerHTML = "";

    // =====================
    // ⚖️ WEIGHT
    // Color-coded blob: blue = low g, red = high g
    // =====================
    if (currentScenario === "weight") {

        const weightKg       = useMetric ? weight : weight * 0.453592;
        const planetWeightKg = weightKg * ratio;
        const displayPlanet  = useMetric ? planetWeightKg : planetWeightKg / 0.453592;
        const unit           = useMetric ? "kg" : "lbs";

        // Color: blue (low g) → white (1g) → orange-red (high g)
        const hue  = ratio < 1 ? 200 : Math.max(0, 30 - (ratio - 1) * 25);
        const sat  = 80;
        const lit  = ratio < 1 ? 60 + (1 - ratio) * 10 : Math.max(45, 60 - (ratio - 1) * 8);
        const blobColor = `hsl(${hue}, ${sat}%, ${lit}%)`;

        const scaleY = Math.max(0.35, Math.min(2.5, 1 / ratio));
        const glowColor = ratio > 1 ? "rgba(255,100,50,0.5)" : "rgba(77,163,255,0.5)";

        container.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; gap:28px; width:100%;">
                <div style="display:flex; align-items:center; justify-content:center; gap:50px;">

                    <div style="display:flex; flex-direction:column; align-items:center; gap:10px;">
                        <div style="font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:#4a5a78;">Earth</div>
                        <div id="earth-blob" style="
                            width:70px; height:70px;
                            background: hsl(200,70%,55%);
                            border-radius:50%;
                            box-shadow: 0 0 20px rgba(77,163,255,0.4);
                        "></div>
                        <div style="font-size:13px; color:#8fa8cc;">${(useMetric ? weightKg : weight).toFixed(1)} ${unit}</div>
                    </div>

                    <div style="display:flex; flex-direction:column; align-items:center; gap:10px;">
                        <div style="font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:#4a5a78;">${selectedPlanet.name}</div>
                        <div id="weight-blob" style="
                            width:70px; height:70px;
                            background:${blobColor};
                            border-radius:50%;
                            box-shadow: 0 0 25px ${glowColor};
                            transform: scaleY(1);
                        "></div>
                        <div style="font-size:13px; color:#8fa8cc;">${displayPlanet.toFixed(1)} ${unit}</div>
                    </div>

                </div>

                <div style="display:flex; gap:24px; justify-content:center; flex-wrap:wrap;">
                    <div class="anim-stat">Gravity: <span class="highlight">${ratio.toFixed(2)}× Earth</span></div>
                    <div class="anim-stat">You would feel <span class="highlight">${ratio > 1 ? "heavier" : ratio < 1 ? "lighter" : "the same"}</span></div>
                </div>
            </div>
        `;

        const blob = document.getElementById("weight-blob");
        let start = null;
        function animateBlob(ts) {
            if (!start) start = ts;
            const p      = Math.min((ts - start) / 900, 1);
            const eased  = 1 - Math.pow(1 - p, 3);
            const scale  = 1 + (scaleY - 1) * eased;
            blob.style.transform = `scaleY(${scale})`;
            if (p < 1) requestAnimationFrame(animateBlob);
        }
        requestAnimationFrame(animateBlob);
    }

    // =====================
    // ↑ JUMP — vertical bars rising from ground
    // =====================
    else if (currentScenario === "jump") {

        const baseJumpM    = useMetric ? jump : jump * 0.3048;
        const newJumpM     = baseJumpM * (earthG / g);
        const displayEarth  = useMetric ? baseJumpM  : baseJumpM  / 0.3048;
        const displayPlanet = useMetric ? newJumpM   : newJumpM   / 0.3048;
        const unit          = useMetric ? "m" : "ft";

        const MAX_BAR = 200; // px
        const maxVal  = Math.max(displayEarth, displayPlanet);
        const earthPx  = (displayEarth  / maxVal) * MAX_BAR;
        const planetPx = (displayPlanet / maxVal) * MAX_BAR;

        container.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; gap:16px; width:100%;">
                <div style="display:flex; align-items:flex-end; justify-content:center; gap:60px; height:${MAX_BAR + 40}px;">

                    <div style="display:flex; flex-direction:column; align-items:center; gap:8px;">
                        <div id="earth-jump-label" style="font-size:13px; color:#4da3ff; font-weight:700; opacity:0;">${displayEarth.toFixed(2)} ${unit}</div>
                        <div style="display:flex; align-items:flex-end; height:${MAX_BAR}px;">
                            <div id="earth-jump-bar" style="
                                width:48px; height:0;
                                background: linear-gradient(to top, #4da3ff, #7bc4ff);
                                border-radius:6px 6px 0 0;
                                box-shadow: 0 0 14px rgba(77,163,255,0.4);
                            "></div>
                        </div>
                        <div style="font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:#4a5a78;">Earth</div>
                    </div>

                    <div style="display:flex; flex-direction:column; align-items:center; gap:8px;">
                        <div id="planet-jump-label" style="font-size:13px; color:#a78bfa; font-weight:700; opacity:0;">${displayPlanet.toFixed(2)} ${unit}</div>
                        <div style="display:flex; align-items:flex-end; height:${MAX_BAR}px;">
                            <div id="planet-jump-bar" style="
                                width:48px; height:0;
                                background: linear-gradient(to top, #a78bfa, #c4b5fd);
                                border-radius:6px 6px 0 0;
                                box-shadow: 0 0 14px rgba(167,139,250,0.4);
                            "></div>
                        </div>
                        <div style="font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:#4a5a78;">${selectedPlanet.name}</div>
                    </div>

                </div>
                <div style="width:80%; height:2px; background:#1c2d47; border-radius:2px; margin-top:-8px;"></div>
            </div>
        `;

        const earthBar    = document.getElementById("earth-jump-bar");
        const planetBar   = document.getElementById("planet-jump-bar");
        const earthLabel  = document.getElementById("earth-jump-label");
        const planetLabel = document.getElementById("planet-jump-label");

        let start = null;
        function animate(ts) {
            if (!start) start = ts;
            const p     = Math.min((ts - start) / 1000, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            earthBar.style.height  = (earthPx  * eased) + "px";
            planetBar.style.height = (planetPx * eased) + "px";
            earthLabel.style.opacity  = eased;
            planetLabel.style.opacity = eased;
            if (p < 1) requestAnimationFrame(animate);
        }
        requestAnimationFrame(animate);
    }

    // =====================
    // 🎯 THROW — canvas arcs
    // =====================
    else if (currentScenario === "throw") {

        const baseThrowM   = useMetric ? throwRange : throwRange * 0.3048;
        const newThrowM    = baseThrowM * (earthG / g);
        const displayEarth  = useMetric ? baseThrowM  : baseThrowM  / 0.3048;
        const displayPlanet = useMetric ? newThrowM   : newThrowM   / 0.3048;
        const unit          = useMetric ? "m" : "ft";
        const maxDistance   = Math.max(displayEarth, displayPlanet);

        container.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:10px; width:100%;">
                <canvas id="throw-canvas" width="480" height="220" style="width:100%; border-radius:8px;"></canvas>
                <div style="display:flex; gap:20px; justify-content:center; flex-wrap:wrap;">
                    <div style="display:flex; align-items:center; gap:6px; font-size:13px; color:#8fa8cc;">
                        <div style="width:24px; height:3px; background:#4da3ff; border-radius:2px;"></div>
                        Earth: <strong style="color:#4da3ff;">${displayEarth.toFixed(2)} ${unit}</strong>
                    </div>
                    <div style="display:flex; align-items:center; gap:6px; font-size:13px; color:#8fa8cc;">
                        <div style="width:24px; height:3px; background:#a78bfa; border-radius:2px;"></div>
                        ${selectedPlanet.name}: <strong style="color:#a78bfa;">${displayPlanet.toFixed(2)} ${unit}</strong>
                    </div>
                </div>
            </div>
        `;

        const canvas  = document.getElementById("throw-canvas");
        const ctx     = canvas.getContext("2d");
        const W       = canvas.width;
        const H       = canvas.height;
        const startX  = 30;
        const groundY = H - 30;
        const padding = 30;

        const scaleX = (W - padding * 2) / maxDistance;
        const v0     = Math.sqrt(maxDistance * earthG);
        const maxH   = (v0 * v0) / (4 * earthG);
        const scaleYc = (H - padding * 2 - 10) / Math.max(maxH, 1);
        const scale   = Math.min(scaleX, scaleYc);

        function getArc(distance) {
            const v   = Math.sqrt(distance * earthG);
            const vx  = v * Math.cos(Math.PI / 4);
            const vy  = v * Math.sin(Math.PI / 4);
            const tMax = (2 * vy) / earthG;
            const pts  = [];
            const steps = 100;
            for (let i = 0; i <= steps; i++) {
                const t = (i / steps) * tMax;
                const x = vx * t;
                const y = vy * t - 0.5 * earthG * t * t;
                pts.push({ x: startX + x * scale, y: groundY - y * scale });
            }
            return pts;
        }

        const earthArc  = getArc(displayEarth);
        const planetArc = getArc(displayPlanet);

        let progress = 0;

        function drawArc(points, color, glow) {
            const count = Math.floor(points.length * Math.min(progress, 1));
            if (count < 2) return;
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < count; i++) ctx.lineTo(points[i].x, points[i].y);
            ctx.strokeStyle = color;
            ctx.lineWidth = 2.5;
            ctx.shadowColor = glow;
            ctx.shadowBlur = 8;
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        function animate() {
            ctx.clearRect(0, 0, W, H);

            // Ground line
            ctx.beginPath();
            ctx.moveTo(startX, groundY);
            ctx.lineTo(W - padding, groundY);
            ctx.strokeStyle = "#1c2d47";
            ctx.lineWidth = 2;
            ctx.stroke();

            // Launch marker
            ctx.beginPath();
            ctx.arc(startX, groundY, 4, 0, Math.PI * 2);
            ctx.fillStyle = "#4a5a78";
            ctx.fill();

            drawArc(earthArc,  "#4da3ff", "#4da3ff");
            drawArc(planetArc, "#a78bfa", "#a78bfa");

            // Land markers when complete
            if (progress >= 1) {
                [[displayEarth, "#4da3ff"], [displayPlanet, "#a78bfa"]].forEach(([d, c]) => {
                    const lx = startX + d * scale;
                    ctx.beginPath();
                    ctx.arc(lx, groundY, 4, 0, Math.PI * 2);
                    ctx.fillStyle = c;
                    ctx.fill();
                });
            }

            progress += 0.018;
            if (progress <= 1) requestAnimationFrame(animate);
        }

        animate();
    }

    // =====================
    // 🏃 SPEED — horizontal bars
    // =====================
    else if (currentScenario === "run") {

        const baseSpeedMs  = useMetric ? speed / 3.6 : speed * 0.44704;
        const newSpeedMs   = baseSpeedMs * (earthG / g);
        const displayEarth  = useMetric ? baseSpeedMs * 3.6 : baseSpeedMs / 0.44704;
        const displayPlanet = useMetric ? newSpeedMs  * 3.6 : newSpeedMs  / 0.44704;
        const unit          = useMetric ? "km/h" : "mph";
        const maxSpeed      = Math.max(displayEarth, displayPlanet);

        const earthPct  = (displayEarth  / maxSpeed) * 100;
        const planetPct = (displayPlanet / maxSpeed) * 100;

        container.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:24px; width:100%;">

                <div style="display:flex; flex-direction:column; gap:8px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:13px; color:#8fa8cc; font-weight:600;">🌍 Earth</span>
                        <span id="earth-speed-val" style="font-size:13px; font-weight:700; color:#4da3ff; opacity:0;">${displayEarth.toFixed(2)} ${unit}</span>
                    </div>
                    <div style="width:100%; background:#0a1020; border-radius:6px; overflow:hidden; height:14px;">
                        <div id="earth-bar" style="
                            height:14px; width:0;
                            background: linear-gradient(90deg, #4da3ff, #7bc4ff);
                            border-radius:6px;
                            box-shadow: 0 0 10px rgba(77,163,255,0.4);
                        "></div>
                    </div>
                </div>

                <div style="display:flex; flex-direction:column; gap:8px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:13px; color:#8fa8cc; font-weight:600;">🪐 ${selectedPlanet.name}</span>
                        <span id="planet-speed-val" style="font-size:13px; font-weight:700; color:#a78bfa; opacity:0;">${displayPlanet.toFixed(2)} ${unit}</span>
                    </div>
                    <div style="width:100%; background:#0a1020; border-radius:6px; overflow:hidden; height:14px;">
                        <div id="planet-bar" style="
                            height:14px; width:0;
                            background: linear-gradient(90deg, #a78bfa, #c4b5fd);
                            border-radius:6px;
                            box-shadow: 0 0 10px rgba(167,139,250,0.4);
                        "></div>
                    </div>
                </div>

                <div style="display:flex; gap:20px; justify-content:center; flex-wrap:wrap; margin-top:4px;">
                    <div class="anim-stat">Gravity: <span class="highlight">${ratio.toFixed(2)}× Earth</span></div>
                    <div class="anim-stat">${selectedPlanet.name} speed: <span class="highlight">${(ratio < 1 ? "+" : "") + ((1/ratio - 1)*100).toFixed(0)}% ${ratio < 1 ? "faster" : "slower"}</span></div>
                </div>
            </div>
        `;

        const earthBar  = document.getElementById("earth-bar");
        const planetBar = document.getElementById("planet-bar");
        const earthVal  = document.getElementById("earth-speed-val");
        const planetVal = document.getElementById("planet-speed-val");

        let start = null;
        function animate(ts) {
            if (!start) start = ts;
            const p     = Math.min((ts - start) / 1000, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            earthBar.style.width  = (earthPct  * eased) + "%";
            planetBar.style.width = (planetPct * eased) + "%";
            earthVal.style.opacity  = eased;
            planetVal.style.opacity = eased;
            if (p < 1) requestAnimationFrame(animate);
        }
        requestAnimationFrame(animate);
    }
}

// =========================
// BOTTOM DATA TABLE
// =========================
function updateDataTable() {
    const container = document.getElementById("results");
    if (!container) return;
    container.innerHTML = "";

    const weight     = parseFloat(document.getElementById("userWeight").value);
    const jump       = parseFloat(document.getElementById("userJump").value);
    const throwRange = parseFloat(document.getElementById("userThrow").value);
    const speed      = parseFloat(document.getElementById("userSpeed").value);

    planets.forEach(p => {
        const g = p.gravity_m_s2;
        if (!g) return;

        const ratio = g / earthG;

        // Convert inputs to SI for calculation
        const weightKg  = useMetric ? weight     : weight     * 0.453592;
        const jumpM     = useMetric ? jump       : jump       * 0.3048;
        const throwM    = useMetric ? throwRange : throwRange * 0.3048;
        const speedMs   = useMetric ? speed/3.6  : speed      * 0.44704;

        const wResult = weightKg * ratio;
        const jResult = jumpM    * (earthG / g);
        const tResult = throwM   * (earthG / g);
        const sResult = speedMs  * (earthG / g);

        // Convert back to display units
        const wDisplay = useMetric ? wResult       : wResult / 0.453592;
        const jDisplay = useMetric ? jResult       : jResult / 0.3048;
        const tDisplay = useMetric ? tResult       : tResult / 0.3048;
        const sDisplay = useMetric ? sResult * 3.6 : sResult / 0.44704;

        const wUnit = useMetric ? "kg"   : "lbs";
        const dUnit = useMetric ? "m"    : "ft";
        const sUnit = useMetric ? "km/h" : "mph";

        const card = document.createElement("div");
        card.className = "scenario-card";
        card.innerHTML = `
            <img src="${p.image}" alt="${p.name}">
            <h2>${p.name}</h2>
            <p><strong>Weight:</strong> ${wDisplay.toFixed(1)} ${wUnit}</p>
            <p><strong>Jump:</strong>   ${jDisplay.toFixed(2)} ${dUnit}</p>
            <p><strong>Throw:</strong>  ${tDisplay.toFixed(2)} ${dUnit}</p>
            <p><strong>Speed:</strong>  ${sDisplay.toFixed(2)} ${sUnit}</p>
        `;
        container.appendChild(card);
    });
}

// =========================
// LIVE UPDATES
// =========================
document.addEventListener("input", () => {
    updateAnimation();
    updateDataTable();
});

// =========================
// INIT
// =========================
updateUnits();