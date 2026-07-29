// ================================
// DISPLAY COLORS
// ================================
const PLANET_COLORS = {
    Mercury: "#b5b5b5",
    Venus:   "#e8cda0",
    Earth:   "#4da3ff",
    Mars:    "#c1440e",
    Jupiter: "#c88b3a",
    Saturn:  "#e4d191",
    Uranus:  "#7de8e8",
    Neptune: "#4b70dd"
};

const INNER_PLANETS = ["Mercury", "Venus", "Earth", "Mars"];
const OUTER_PLANETS = ["Jupiter", "Saturn", "Uranus", "Neptune"];
const ALL_PLANETS   = [...INNER_PLANETS, ...OUTER_PLANETS];

// ================================
// GLOBAL STATE
// ================================
let paused       = false;
let globalSpeed  = 1.0;
let allSims      = [];

// ================================
// HELPERS
// ================================
function lighten(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${Math.min(r + 80, 255)}, ${Math.min(g + 80, 255)}, ${Math.min(b + 80, 255)})`;
}

// ================================
// ORBIT SIM CLASS
// ================================
class OrbitSim {

    constructor(canvasId, planetNames, data, baseSpeed = 0.0075) {
        this.canvas    = document.getElementById(canvasId);
        this.ctx       = this.canvas.getContext("2d");
        this.baseSpeed = baseSpeed;

        this.canvas.width  = 440;
        this.canvas.height = 440;

        this.cx = this.canvas.width  / 2;
        this.cy = this.canvas.height / 2;

        const filtered = data.filter(p =>
            p.class === "Planet" && planetNames.includes(p.name)
        );

        const maxAU      = Math.max(...filtered.map(p => p.semi_major_axis_au));
        const margin     = 44;
        const orbitScale = (this.canvas.width / 2 - margin) / maxAU;

        const EARTH_DISPLAY_R = 2;
        const EARTH_REAL_R    = 6371;
        const sizeScale       = EARTH_DISPLAY_R / EARTH_REAL_R;

        this.sunR = 5;

        this.planets = filtered.map(p => ({
            name:       p.name,
            color:      PLANET_COLORS[p.name] ?? "#ffffff",
            orbitR:     Math.max(p.semi_major_axis_au * orbitScale, this.sunR + 12),
            displayR:   Math.max(p.mean_radius_km * sizeScale, 2.5),
            startAngle: Math.random() * Math.PI * 2,
            angle:      0,
            period:     p.orbital_period_days / 365.25   // in Earth years
        }));

        // Save initial angles for reset
        this.planets.forEach(p => p.angle = p.startAngle);
    }

    reset() {
        this.planets.forEach(p => p.angle = p.startAngle);
    }

    drawSun() {
        const { ctx, cx, cy, sunR } = this;

        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, sunR * 3);
        glow.addColorStop(0,   "rgba(255, 220, 80, 0.5)");
        glow.addColorStop(0.5, "rgba(255, 160, 20, 0.15)");
        glow.addColorStop(1,   "rgba(255, 100,  0, 0)");
        ctx.beginPath();
        ctx.arc(cx, cy, sunR * 3, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        const grad = ctx.createRadialGradient(
            cx - sunR * 0.3, cy - sunR * 0.3, 0,
            cx, cy, sunR
        );
        grad.addColorStop(0,   "#fff7a1");
        grad.addColorStop(0.5, "#ffd84d");
        grad.addColorStop(1,   "#ff8c00");
        ctx.beginPath();
        ctx.arc(cx, cy, sunR, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
    }

    drawOrbitRing(orbitR) {
        const { ctx, cx, cy } = this;
        ctx.beginPath();
        ctx.arc(cx, cy, orbitR, 0, Math.PI * 2);
        ctx.strokeStyle = "rgb(255, 255, 255)";
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    drawPlanet(planet) {
        const { ctx, cx, cy } = this;
        const x = cx + Math.cos(planet.angle) * planet.orbitR;
        const y = cy + Math.sin(planet.angle) * planet.orbitR;

        // Soft glow
        const glow = ctx.createRadialGradient(x, y, 0, x, y, planet.displayR * 3.5);
        glow.addColorStop(0,   planet.color + "44");
        glow.addColorStop(1,   planet.color + "00");
        ctx.beginPath();
        ctx.arc(x, y, planet.displayR * 3.5, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        // Planet body
        const grad = ctx.createRadialGradient(
            x - planet.displayR * 0.35, y - planet.displayR * 0.35, 0,
            x, y, planet.displayR
        );
        grad.addColorStop(0, lighten(planet.color));
        grad.addColorStop(1, planet.color);
        ctx.beginPath();
        ctx.arc(x, y, planet.displayR, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Label — small and clean
        ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
        ctx.font = "16px Arial";
        ctx.fillText(planet.name, x + planet.displayR + 4, y + 4);
    }

    tick() {
        const { ctx, canvas } = this;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        this.planets.forEach(p => this.drawOrbitRing(p.orbitR));
        this.drawSun();

        this.planets.forEach(p => {
            // Speed: 1 year = baseSpeed * speedMultiplier radians per frame.
            // Only advance while playing — but always draw, paused or not,
            // so actions like Reset are visible immediately rather than
            // waiting for the sim to be unpaused first.
            if (!paused) {
                p.angle += (this.baseSpeed / p.period) * globalSpeed;
            }
            this.drawPlanet(p);
        });
    }
}

// ================================
// UI CONTROLS
// ================================
function togglePause() {
    paused = !paused;
    const btn = document.getElementById("pauseBtn");
    btn.textContent = paused ? "▶ Resume" : "⏸ Pause";
    btn.classList.toggle("active", paused);
}

function resetPositions() {
    allSims.forEach(s => s.reset());

    globalSpeed = 1.0;
    document.getElementById("speedSlider").value = 1;
    document.getElementById("speedVal").textContent = globalSpeed.toFixed(1) + "×";
}

document.getElementById("speedSlider").addEventListener("input", function () {
    globalSpeed = parseFloat(this.value);
    document.getElementById("speedVal").textContent = globalSpeed.toFixed(1) + "×";
});

// ================================
// BUILD PLANET LEGEND
// ================================
function buildLegend() {
    const legend = document.getElementById("sim-legend");
    if (!legend) return;
    legend.innerHTML = "";
    ALL_PLANETS.forEach(name => {
        const color = PLANET_COLORS[name] ?? "#fff";
        const item  = document.createElement("div");
        item.className = "legend-item";
        item.innerHTML = `
            <div class="legend-dot" style="background:${color}; box-shadow: 0 0 6px ${color}88;"></div>
            ${name}
        `;
        legend.appendChild(item);
    });
}

// ================================
// LOAD DATA & INIT
// ================================
fetch("../data/planets.json")
    .then(res => res.json())
    .then(data => {

        const inner = new OrbitSim("canvas-inner", INNER_PLANETS, data, 0.0075);
        const full  = new OrbitSim("canvas-full",  ALL_PLANETS,   data, 0.0075);
        const outer = new OrbitSim("canvas-outer", OUTER_PLANETS, data, 0.35);

        allSims = [inner, full, outer];

        buildLegend();

        function loop() {
            inner.tick();
            full.tick();
            outer.tick();
            requestAnimationFrame(loop);
        }

        loop();
    });