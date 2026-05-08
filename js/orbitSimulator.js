// ================================
// DISPLAY COLORS (only thing not in JSON)
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
// SIMULATION CLASS
// Each canvas gets its own independent simulation
// ================================
class OrbitSim {

    constructor(canvasId, planetNames, data, speedMultiplier = 0.0075) {
        this.canvas = document.getElementById(canvasId);
        this.ctx    = this.canvas.getContext("2d");

        this.canvas.width  = 500;
        this.canvas.height = 500;

        this.cx = this.canvas.width  / 2;
        this.cy = this.canvas.height / 2;

        // Filter to only the planets this sim cares about
        const filtered = data.filter(p =>
            p.class === "Planet" && planetNames.includes(p.name)
        );

        // Scale orbits to fit the largest AU in this set
        const maxAU      = Math.max(...filtered.map(p => p.semi_major_axis_au));
        const margin     = 48;
        const orbitScale = (this.canvas.width / 2 - margin) / maxAU;

        const EARTH_DISPLAY_R = 1;
        const EARTH_REAL_R    = 6371;
        const sizeScale       = EARTH_DISPLAY_R / EARTH_REAL_R;

        this.sunR = 14;

        this.planets = filtered.map(p => ({
            name:     p.name,
            color:    PLANET_COLORS[p.name] ?? "#ffffff",
            orbitR:   Math.max(p.semi_major_axis_au * orbitScale, this.sunR + 12),
            displayR: Math.max(p.mean_radius_km * sizeScale, 2.5),
            angle:    Math.random() * Math.PI * 2,
            speed: (1 / (p.orbital_period_days / 365.25)) * speedMultiplier
        }));
    }

    drawSun() {
        const { ctx, cx, cy, sunR } = this;

        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, sunR * 2.5);
        glow.addColorStop(0,   "rgba(255, 220, 80, 0.4)");
        glow.addColorStop(0.5, "rgba(255, 160, 20, 0.15)");
        glow.addColorStop(1,   "rgba(255, 100,  0, 0)");
        ctx.beginPath();
        ctx.arc(cx, cy, sunR * 2.5, 0, Math.PI * 2);
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
        ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    drawPlanet(planet) {
        const { ctx, cx, cy } = this;
        const x = cx + Math.cos(planet.angle) * planet.orbitR;
        const y = cy + Math.sin(planet.angle) * planet.orbitR;

        // Glow
        const glow = ctx.createRadialGradient(x, y, 0, x, y, planet.displayR * 3);
        glow.addColorStop(0,   planet.color + "55");
        glow.addColorStop(1,   planet.color + "00");
        ctx.beginPath();
        ctx.arc(x, y, planet.displayR * 3, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        // Body
        const grad = ctx.createRadialGradient(
            x - planet.displayR * 0.3, y - planet.displayR * 0.3, 0,
            x, y, planet.displayR
        );
        grad.addColorStop(0, lighten(planet.color));
        grad.addColorStop(1, planet.color);
        ctx.beginPath();
        ctx.arc(x, y, planet.displayR, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Label
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.font = "16px Arial";
        ctx.fillText(planet.name, x + planet.displayR + 4, y + 4);
    }

    tick() {
        const { ctx, canvas } = this;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        this.planets.forEach(p => this.drawOrbitRing(p.orbitR));
        this.drawSun();
        this.planets.forEach(p => {
            p.angle += p.speed;
            this.drawPlanet(p);
        });
    }
}

// ================================
// LOAD DATA & INIT ALL THREE SIMS
// ================================
fetch("../data/planets.json")
    .then(res => res.json())
    .then(data => {

        const inner = new OrbitSim("canvas-inner", INNER_PLANETS, data);
        const full  = new OrbitSim("canvas-full",  [...INNER_PLANETS, ...OUTER_PLANETS], data);
        const outer = new OrbitSim("canvas-outer", OUTER_PLANETS, data, 0.5);

        function loop() {
            inner.tick();
            full.tick();
            outer.tick();
            requestAnimationFrame(loop);
        }

        loop();
    });