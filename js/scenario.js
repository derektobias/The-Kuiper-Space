let useMetric = false;
let planets = [];
let currentScenario = "weight";
let selectedPlanet = null;

// =========================
// LOAD DATA
// =========================
fetch("../data/planets.json")
.then(res => res.json())
.then(data => {
    planets = data;

    renderPlanetSelector();   // LEFT PANEL
    updateDataTable();        // BOTTOM
});

// SEARCH
document.getElementById("planet-search").addEventListener("input", () => {

    const query = document.getElementById("planet-search").value.toLowerCase();
    const selectedClass = document.getElementById("class-filter").value;

    let filtered = planets;

    if (selectedClass !== "all") {
        filtered = filtered.filter(p =>
            p.class.toLowerCase() === selectedClass
        );
    }

    filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query)
    );

    renderPlanetSelector(filtered);
});

// FILTER
document.getElementById("class-filter").addEventListener("change", () => {

    const selectedClass = document.getElementById("class-filter").value;
    const query = document.getElementById("planet-search").value.toLowerCase();

    let filtered = planets;

    if (selectedClass !== "all") {
        filtered = filtered.filter(p =>
            p.class.toLowerCase() === selectedClass
        );
    }

    filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query)
    );

    renderPlanetSelector(filtered);
});

// =========================
// SCENARIO CONTROL
// =========================
function setScenario(type) {
    currentScenario = type;
    updateButtons();
    updateUnits();
    updateAnimation();
    updateDataTable(); // NEW: bottom section updates
}

// =========================
// BUTTON UI STATE
// =========================
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
    const jumpEl = document.getElementById("userJump");
    const throwEl = document.getElementById("userThrow");
    const speedEl = document.getElementById("userSpeed");

    if (!useMetric) {
        // Switching imperial → metric: convert the displayed values
        weightEl.value = (parseFloat(weightEl.value) * 0.453592).toFixed(1);
        jumpEl.value = (parseFloat(jumpEl.value) * 0.3048).toFixed(2);
        throwEl.value = (parseFloat(throwEl.value) * 0.3048).toFixed(2);
        speedEl.value = (parseFloat(speedEl.value) * 1.60934).toFixed(2);
    } else {
        // Switching metric → imperial: convert the displayed values
        weightEl.value = (parseFloat(weightEl.value) / 0.453592).toFixed(1);
        jumpEl.value = (parseFloat(jumpEl.value) / 0.3048).toFixed(2);
        throwEl.value = (parseFloat(throwEl.value) / 0.3048).toFixed(2);
        speedEl.value = (parseFloat(speedEl.value) / 1.60934).toFixed(2);
    }

    useMetric = !useMetric;
    updateUnits();
    updateAnimation();
    updateDataTable();
}

function updateUnits() {
    document.getElementById("unit-weight").innerText = useMetric ? "kg" : "lbs";
    document.getElementById("unit-height").innerText = useMetric ? "m" : "ft";
    document.getElementById("unit-distance").innerText = useMetric ? "m" : "ft";
    document.getElementById("unit-speed").innerText = useMetric ? "m/s" : "mph";
}

// =========================
// LEFT PANEL: RENDER PLANETS
// =========================
function renderPlanetSelector(list = planets) {

    const container = document.getElementById("planet-selector");
    if (!container) return;

    container.innerHTML = "";

    list.forEach(p => {

        const card = document.createElement("div");
        card.className = "planet-card";

        card.innerHTML = `
            <img src="${p.image}">
            <p>${p.name}</p>
        `;

        card.onclick = () => {

            selectedPlanet = p;

            document.querySelectorAll("#planet-selector .planet-card")
                .forEach(c => c.classList.remove("selected"));

            card.classList.add("selected");

            document.getElementById("visual-title").innerText =
                `Visualization: ${p.name}`;

            updateAnimation();
        };

        container.appendChild(card);
    });
}

// =========================
// LEFT PANEL: PLANET SELECT
// =========================
function selectPlanet(planet) {
    selectedPlanet = planet;
    document.getElementById("visual-title").innerText =
        `Visualization: ${planet.name}`;
    
    updateAnimation();
}

// =========================
// ANIMATION (RIGHT PANEL ONLY)
// =========================
function updateAnimation() {

    const container = document.getElementById("visual-animation");

    if (!container) return;

    // 🧠 No planet selected state
    if (!selectedPlanet) {
        container.innerHTML = `
            <div style="padding:40px; color:#aaa;">
                Choose a planetary body from the left to begin.
            </div>
        `;
        return;
    }

    const g = selectedPlanet.gravity_m_s2;
    const earthG = 9.81;

    const weight = parseFloat(document.getElementById("userWeight").value);
    const jump = parseFloat(document.getElementById("userJump").value);
    const throwRange = parseFloat(document.getElementById("userThrow").value);
    const speed = parseFloat(document.getElementById("userSpeed").value);

    container.innerHTML = "";

    // ======================
    // 🌟 WEIGHT (Blob)
    // ======================
    if (currentScenario === "weight") {

        let inputWeight = parseFloat(document.getElementById("userWeight").value);
        let weightKg = useMetric ? inputWeight : inputWeight * 0.453592;

        let ratio = g / earthG;

        let planetWeightKg = weightKg * ratio;
        let displayPlanet = useMetric ? planetWeightKg : planetWeightKg / 0.453592;
        let unit = useMetric ? "kg" : "lbs";

        let gravityLabel = `Gravity Effect: ${ratio.toFixed(2)}× Earth`;
        let weightLabel = `Weight (${unit}): ${displayPlanet.toFixed(1)}`;

        let scaleY = Math.max(0.5, Math.min(2.5, 1/ratio));

        container.innerHTML = `
            <div style="display:flex; align-items:center; gap:30px; height:260px; padding:20px;">

                <div id="weight-blob" style="
                    width:90px;
                    height:90px;
                    background:hsl(200,80%,60%);
                    border-radius:50%;
                    box-shadow:0 0 25px rgba(77,163,255,0.6);
                    transform:scaleY(1);
                "></div>

                <div style="display:flex; flex-direction:column; gap:10px;">
                    <div>${gravityLabel}</div>
                    <div>${weightLabel}</div>
                </div>

            </div>
        `;

        const blob = document.getElementById("weight-blob");

        let start = null;

        function animateBlob(ts) {
            if (!start) start = ts;

            let p = Math.min((ts - start) / 1000, 1);
            let eased = 1 - Math.pow(1 - p, 3);

            let currentScale = 1 + (scaleY - 1) * eased;
            blob.style.transform = `scaleY(${currentScale})`;

            if (p < 1) requestAnimationFrame(animateBlob);
        }

        requestAnimationFrame(animateBlob);
    }

    // ======================
    // 🌟 JUMP
    // ======================
    else if (currentScenario === "jump") {

        let baseJumpM = useMetric ? jump : jump * 0.3048;
        let newJumpM = baseJumpM * (earthG / g);

        let displayEarth = useMetric ? baseJumpM : baseJumpM / 0.3048;
        let displayPlanet = useMetric ? newJumpM : newJumpM / 0.3048;

        let unit = useMetric ? "m" : "ft";

        let maxVal = Math.max(displayEarth, displayPlanet);
        let scale = 250 / maxVal;

        let earthWidth = displayEarth * scale;
        let planetWidth = displayPlanet * scale;

        let earthLabel = `Earth Jump Height (${unit}): ${displayEarth.toFixed(2)}`;
        let planetLabel = `${selectedPlanet.name} Jump Height (${unit}): ${displayPlanet.toFixed(2)}`;

        let first = displayEarth > displayPlanet
            ? { width: earthWidth, color: "#4da3ff", label: earthLabel }
            : { width: planetWidth, color: "red", label: planetLabel };

        let second = displayEarth > displayPlanet
            ? { width: planetWidth, color: "red", label: planetLabel }
            : { width: earthWidth, color: "#4da3ff", label: earthLabel };

        container.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:20px; height:260px; justify-content:center;">

                <div style="display:flex; align-items:center; gap:10px;">
                    <div class="bar1" style="height:12px; background:${first.color}; width:0;"></div>
                    <div>${first.label}</div>
                </div>

                <div style="display:flex; align-items:center; gap:10px;">
                    <div class="bar2" style="height:12px; background:${second.color}; width:0;"></div>
                    <div>${second.label}</div>
                </div>

            </div>
        `;

        const bar1 = container.querySelector(".bar1");
        const bar2 = container.querySelector(".bar2");

        let start = null;

        function animate(ts) {
            if (!start) start = ts;

            let p = Math.min((ts - start) / 1000, 1);
            let eased = 1 - Math.pow(1 - p, 3);

            bar1.style.width = first.width * eased + "px";
            bar2.style.width = second.width * eased + "px";

            if (p < 1) requestAnimationFrame(animate);
        }

        requestAnimationFrame(animate);
    }

    // ======================
    // 🌟 THROW (Canvas)
    // ======================
    else if (currentScenario === "throw") {

        function label(color, text) {
            return `
            <div style="display:flex; align-items:center; gap:6px;">
                <div style="width:10px; height:10px; border-radius:50%; background:${color};"></div>
                <div>${text}</div>
            </div>`;
        }

        let baseThrowM = useMetric ? throwRange : throwRange * 0.3048;
        let newThrowM = baseThrowM * (earthG / g);

        let displayEarth = useMetric ? baseThrowM : baseThrowM / 0.3048;
        let displayPlanet = useMetric ? newThrowM : newThrowM / 0.3048;

        let unit = useMetric ? "m" : "ft";

        let earthLabel = `Earth Throw Distance (${unit}): ${displayEarth.toFixed(2)}`;
        let planetLabel = `${selectedPlanet.name} Throw Distance (${unit}): ${displayPlanet.toFixed(2)}`;

        let maxDistance = Math.max(displayEarth, displayPlanet);

        container.innerHTML = `
            <canvas id="throw-canvas" width="520" height="260"></canvas>

            <div style="margin-top:10px; display:flex; flex-direction:column; gap:6px;">
                ${displayEarth > displayPlanet
                    ? label("#4da3ff", earthLabel) + label("red", planetLabel)
                    : label("red", planetLabel) + label("#4da3ff", earthLabel)
                }
            </div>
        `;

        const canvas = document.getElementById("throw-canvas");
        const ctx = canvas.getContext("2d");

        const startX = 40;
        const groundY = 220;
        const padding = 40;

        let scaleX = (canvas.width - padding * 2) / maxDistance;

        let v = Math.sqrt(maxDistance * 9.81);
        let maxHeight = (v * v) / (4 * 9.81);
        let scaleY = (canvas.height - padding * 2) / maxHeight;

        let scale = Math.min(scaleX, scaleY);

        function getArc(distance) {
            let velocity = Math.sqrt(distance * 9.81);
            let vx = velocity * Math.cos(Math.PI / 4);
            let vy = velocity * Math.sin(Math.PI / 4);

            let tMax = (2 * vy) / 9.81;

            let pts = [];

            for (let t = 0; t <= tMax; t += tMax / 80) {
                let x = vx * t;
                let y = vy * t - 0.5 * 9.81 * t * t;

                pts.push({
                    x: startX + x * scale,
                    y: groundY - y * scale
                });
            }

            pts.push({
                x: startX + distance * scale,
                y: groundY
            });

            return pts;
        }

        const earthArc = getArc(displayEarth);
        const planetArc = getArc(displayPlanet);

        let progress = 0;

        function drawArc(points, color) {
            ctx.beginPath();

            let count = Math.floor(points.length * progress);

            for (let i = 0; i < count; i++) {
                if (i === 0) ctx.moveTo(points[i].x, points[i].y);
                else ctx.lineTo(points[i].x, points[i].y);
            }

            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.stroke();
        }

        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            ctx.beginPath();
            ctx.moveTo(startX, groundY);
            ctx.lineTo(startX + maxDistance * scale, groundY);
            ctx.strokeStyle = "#666";
            ctx.stroke();

            drawArc(earthArc, "#4da3ff");
            drawArc(planetArc, "red");

            progress += 0.015;
            if (progress <= 1) requestAnimationFrame(animate);
        }

        animate();
    }

    // ======================
    // 🌟 SPEED
    // ======================
    else if (currentScenario === "run") {

        let baseSpeedMs = useMetric ? speed / 3.6 : speed * 0.44704;
        let newSpeedMs = baseSpeedMs * (earthG / g);

        let displayEarth = useMetric ? baseSpeedMs * 3.6 : baseSpeedMs / 0.44704;
        let displayPlanet = useMetric ? newSpeedMs * 3.6 : newSpeedMs / 0.44704;

        let unit = useMetric ? "km/h" : "mph";

        let maxSpeed = Math.max(displayEarth, displayPlanet);
        let scale = 300 / maxSpeed;

        container.innerHTML = `
            <div style="margin-top:40px; display:flex; flex-direction:column; gap:20px;">

                <div>
                    <div class="earth-bar" style="height:12px;background:#4da3ff;width:0;"></div>
                    <div>Earth Speed (${unit}): ${displayEarth.toFixed(2)}</div>
                </div>

                <div>
                    <div class="planet-bar" style="height:12px;background:red;width:0;"></div>
                    <div>${selectedPlanet.name} Speed (${unit}): ${displayPlanet.toFixed(2)}</div>
                </div>

            </div>
        `;

        const earthBar = container.querySelector(".earth-bar");
        const planetBar = container.querySelector(".planet-bar");

        let start = null;

        function animate(ts) {
            if (!start) start = ts;

            let p = Math.min((ts - start) / 1000, 1);
            let eased = 1 - Math.pow(1 - p, 3);

            earthBar.style.width = displayEarth * scale * eased + "px";
            planetBar.style.width = displayPlanet * scale * eased + "px";

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

    const weight = parseFloat(document.getElementById("userWeight").value);
    const jump = parseFloat(document.getElementById("userJump").value);
    const throwRange = parseFloat(document.getElementById("userThrow").value);
    const speed = parseFloat(document.getElementById("userSpeed").value);

    planets.forEach(p => {

        const g = p.gravity_m_s2;
        if (!g) return;

        const earthG = 9.81;

        let weightResult = (weight * (g / earthG)).toFixed(1);
        let jumpResult = (jump * (earthG / g)).toFixed(2);
        let throwResult = (throwRange * (earthG / g)).toFixed(2);
        let speedResult = (speed * (earthG / g)).toFixed(2);

        const card = document.createElement("div");
        card.className = "scenario-card";

        card.innerHTML = `
            <img src="${p.image}">
            <h2>${p.name}</h2>

            <p><strong>Weight:</strong> ${weightResult} ${useMetric ? "kg" : "lbs"}</p>
            <p><strong>Jump:</strong> ${jumpResult} ${useMetric ? "m" : "ft"}</p>
            <p><strong>Throw:</strong> ${throwResult} ${useMetric ? "m" : "ft"}</p>
            <p><strong>Speed:</strong> ${speedResult} ${useMetric ? "km/h" : "mph"}</p>
        `;

        container.appendChild(card);
    });
}

// =========================
// INPUT LISTENER (LIVE UPDATE)
// =========================
document.addEventListener("input", () => {
    updateAnimation();
    updateDataTable();
});

// =========================
// INITIAL LOAD
// =========================
updateUnits();

