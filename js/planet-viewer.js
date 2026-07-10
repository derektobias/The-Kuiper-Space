import * as THREE from 'three';

// ================================
// STATE
// ================================
let realisticScale        = false;
let shadowsEnabled        = true;
const DISPLAY_RADIUS      = 4;
const sizeScaleFactor     = DISPLAY_RADIUS / 11.2;
let currentRotationSpeed  = 0.002;
let timeScale             = 1;
let planet                = null;
let planetPivot           = null;
let isDragging            = false;
let previousMousePosition = { x: 0, y: 0 };

// ================================
// SCENE
// ================================
const viewerContainer = document.getElementById("viewer");
const loader          = new THREE.TextureLoader();
const scene           = new THREE.Scene();
scene.background      = new THREE.Color(0x000000);

const planetGroup = new THREE.Group();
scene.add(planetGroup);

// ================================
// STAR FIELD
// Spherical distribution — fills the entire sky evenly
// ================================
const starVertices       = [];
const brightStarVertices = [];

for (let i = 0; i < 7000; i++) {
    const r     = 800 + Math.random() * 400;
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta);
    const z = r * Math.cos(phi);
    if (Math.random() < 0.15) brightStarVertices.push(x, y, z);
    else starVertices.push(x, y, z);
}

const starTexture = loader.load("../assets/textures/star.png");

const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starVertices, 3));
const brightStarGeo = new THREE.BufferGeometry();
brightStarGeo.setAttribute("position", new THREE.Float32BufferAttribute(brightStarVertices, 3));

const starMat = new THREE.PointsMaterial({
    color: 0xffffff, size: 2.5,
    sizeAttenuation: true
});
const brightStarMat = new THREE.PointsMaterial({
    color: 0xffffff, size: 4.5,
    sizeAttenuation: true
});

const stars       = new THREE.Points(starGeo, starMat);
const brightStars = new THREE.Points(brightStarGeo, brightStarMat);
stars.renderOrder       = -1;
brightStars.renderOrder = -1;
scene.add(stars);
scene.add(brightStars);

// ================================
// MILKY WAY BACKGROUND TEXTURE
// ================================
const galaxyTexture = loader.load("../assets/textures/milkyway_band.jpg");
galaxyTexture.wrapS = THREE.RepeatWrapping;
galaxyTexture.wrapT = THREE.ClampToEdgeWrapping;

const galaxy = new THREE.Mesh(
    new THREE.SphereGeometry(1000, 64, 64),
    new THREE.MeshBasicMaterial({
        map: galaxyTexture, transparent: true, opacity: 0.7,
        side: THREE.DoubleSide, depthWrite: false,
        blending: THREE.AdditiveBlending
    })
);
galaxy.scale.set(-1, 1, 1);
galaxy.rotation.set(Math.PI / 1.39, Math.PI * 120 / 180, Math.PI * 60 / 180);   // Math.PI/1.47 for x places it right on the band
galaxy.renderOrder = -10;
scene.add(galaxy);

// ================================
// CAMERA & RENDERER
// ================================
const camera = new THREE.PerspectiveCamera(
    75,
    viewerContainer.clientWidth / 600,
    0.1,
    5000
);
camera.position.z = 8;
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(viewerContainer.clientWidth, 600);
renderer.setPixelRatio(window.devicePixelRatio);
viewerContainer.appendChild(renderer.domElement);

// ================================
// LIGHTING
// sunLight: directional from one side — creates day/night terminator
// ambient: soft fill so dark side isn't pure black
// When shadows are disabled, ambient is maxed out to simulate flat lighting
// ================================
const sunLight = new THREE.DirectionalLight(0xffffff, 2);
sunLight.position.set(20, 0, 0);
scene.add(sunLight);

const ambient = new THREE.AmbientLight(0xffffff, 0.25);
scene.add(ambient);

// ================================
// PLANET DATA
// radius:     size relative to Earth (Earth = 1)
// tilt:       axial tilt in degrees
// rotation:   radians/frame
// Note: Venus and Uranus have tilt > 90° which causes coordinate flip,
//       making positive rotation appear retrograde visually
// ================================
const planetData = {
    "sun.jpg":     { radius: 109.0, tilt: 7.25,  rotation:  0.0004 },
    "mercury.jpg": { radius: 0.38,  tilt: 0.03,  rotation:  0.0008 },
    "venus.jpg":   { radius: 0.95,  tilt: 177.4, rotation:  0.0002 },
    "earth.jpg":   { radius: 1.00,  tilt: 23.4,  rotation:  0.002  },
    "moon.jpg":    { radius: 0.27,  tilt: 6.68,  rotation:  0.0001 },
    "mars.jpg":    { radius: 0.53,  tilt: 25.2,  rotation:  0.0018 },
    "jupiter.jpg": { radius: 11.2,  tilt: 3.1,   rotation:  0.004  },
    "saturn.jpg":  { radius: 9.45,  tilt: 26.7,  rotation:  0.0038 },
    "uranus.jpg":  { radius: 4.0,   tilt: 97.8,  rotation:  0.0025 },
    "neptune.jpg": { radius: 3.9,   tilt: 28.3,  rotation:  0.0026 }
};

// ================================
// LOAD PLANET
// ================================
function loadPlanet(textureFile) {

    // Clear planet synchronously before async texture load begins
    if (planetPivot) {
        planetGroup.remove(planetPivot);
        planetPivot = null;
        planet      = null;
    }

    loader.load(
        "../assets/textures/8k/" + textureFile,

        function (texture) {

            // Guard against race condition if user switches quickly
            if (planetPivot) {
                planetGroup.remove(planetPivot);
                planetPivot = null;
                planet      = null;
            }

            const data   = planetData[textureFile];
            currentRotationSpeed = data.rotation;
            const radius = realisticScale ? data.radius * sizeScaleFactor : DISPLAY_RADIUS;

            // planetPivot: holds axial tilt only, never rotated again
            planetPivot = new THREE.Object3D();
            planetPivot.rotation.z = THREE.MathUtils.degToRad(data.tilt);
            planetGroup.add(planetPivot);

            // planet: mesh that rotates and responds to drag
            // Sun uses MeshBasicMaterial (self-luminous, no shading)
            const mat = textureFile === "sun.jpg"
                ? new THREE.MeshBasicMaterial({ map: texture })
                : new THREE.MeshPhongMaterial({ map: texture });

            planet = new THREE.Mesh(
                new THREE.SphereGeometry(radius, 64, 64),
                mat
            );
            planetPivot.add(planet);

            // Shadows toggle: sun is always flat, others respect shadowsEnabled
            updateShadowMode(textureFile);

            // Camera distance based on body
            let camZ = 8;
            if (textureFile === "saturn.jpg") camZ = 10;
            if (textureFile === "sun.jpg" && realisticScale) camZ = 30;
            camera.position.set(0, 0, camZ);
            camera.lookAt(0, 0, 0);

            // ---- EARTH: cloud layer ----
            if (textureFile === "earth.jpg") {
                loader.load("../assets/textures/8k/earth_clouds.jpg", function (cloudTex) {
                    if (!planet) return;
                    planet.add(new THREE.Mesh(
                        new THREE.SphereGeometry(radius * 1.01, 64, 64),
                        new THREE.MeshPhongMaterial({
                            map: cloudTex, transparent: true, opacity: 0.4
                        })
                    ));
                });
            }

            // ---- VENUS: atmosphere layer ----
            if (textureFile === "venus.jpg") {
                loader.load("../assets/textures/8k/venus_atmosphere.jpg", function (atmTex) {
                    if (!planet) return;
                    planet.add(new THREE.Mesh(
                        new THREE.SphereGeometry(radius * 1.02, 64, 64),
                        new THREE.MeshPhongMaterial({
                            map: atmTex, transparent: true, opacity: 0.6
                        })
                    ));
                });
            }

            // ---- SATURN: rings ----
            // Ring is a child of planet so it inherits tilt naturally.
            // UV mapping: u goes radially from inner to outer edge (matching
            // the 8192x500 strip texture), v is fixed at 0.5 to sample the
            // center row — gives a clean representative ring color without
            // distortion. For a true full-texture sample, the texture would
            // need to be square or the UVs would need a separate atlas.
            if (textureFile === "saturn.jpg") {
                loader.load("../assets/textures/8k/saturn_ring.png", function (ringTex) {
                    if (!planet) return;

                    const innerR = radius * 1.4;
                    const outerR = radius * 2.3;
                    const ringGeo = new THREE.RingGeometry(innerR, outerR, 256);

                    // Remap UVs: u = radial position (inner→outer), v = 0.5 (center of strip)
                    const pos = ringGeo.attributes.position;
                    const uv  = ringGeo.attributes.uv;
                    for (let i = 0; i < pos.count; i++) {
                        const x = pos.getX(i);
                        const y = pos.getY(i);
                        const r = Math.sqrt(x * x + y * y);
                        uv.setXY(i,
                            (r - innerR) / (outerR - innerR), // u: 0 at inner, 1 at outer
                            0.5                                // v: center of texture strip
                        );
                    }
                    uv.needsUpdate = true;

                    const ring = new THREE.Mesh(
                        ringGeo,
                        new THREE.MeshPhongMaterial({
                            map: ringTex, side: THREE.DoubleSide,
                            transparent: true, opacity: 1.0, depthWrite: false
                        })
                    );
                    ring.rotation.x = Math.PI / 2.005;
                    ring.position.z = 0.01;
                    planet.add(ring);
                });
            }
        },

        undefined,
        function (err) { console.error("Failed to load texture:", textureFile, err); }
    );
}

// ================================
// SHADOW TOGGLE HELPER
// Shadows on: directional light active, ambient dim (normal shading)
// Shadows off: directional light off, ambient full (flat lighting)
// Sun is always MeshBasicMaterial so unaffected
// ================================
function updateShadowMode(textureFile) {
    if (!shadowsEnabled || textureFile === "sun.jpg") {
        sunLight.intensity = 0;
        ambient.intensity  = 1.5;
    } else {
        sunLight.intensity = 2;
        ambient.intensity  = 0.25;
    }
}

// ================================
// ANIMATION LOOP
// ================================
function animate() {
    requestAnimationFrame(animate);
    if (planet) planet.rotation.y += currentRotationSpeed * timeScale;
    renderer.render(scene, camera);
}

animate();

// ================================
// LOAD DEFAULT
// ================================
loadPlanet("earth.jpg");

// ================================
// UI CONTROLS
// ================================
const selector       = document.getElementById("planetSelect");
const speedSelector  = document.getElementById("timeSpeed");
const scaleToggle    = document.getElementById("scaleToggle");
const shadowToggle   = document.getElementById("shadowToggle");

selector.addEventListener("change", () => loadPlanet(selector.value));

speedSelector.addEventListener("change", () => {
    timeScale = Number(speedSelector.value);
});

scaleToggle.addEventListener("change", () => {
    realisticScale = scaleToggle.checked;
    loadPlanet(selector.value);
});

shadowToggle.addEventListener("change", () => {
    shadowsEnabled = shadowToggle.checked;
    updateShadowMode(selector.value);
});

document.getElementById("zoomInBtn").onclick  = () => { camera.position.z = Math.max(1,  camera.position.z - 1); };
document.getElementById("zoomOutBtn").onclick = () => { camera.position.z = Math.min(30, camera.position.z + 1); };

renderer.domElement.addEventListener("wheel", (e) => {
    camera.position.z = Math.max(1, Math.min(30, camera.position.z + e.deltaY * 0.02));
}, { passive: true });

// ================================
// MOUSE DRAG TO SPIN
// ================================
renderer.domElement.addEventListener("mousedown", (e) => {
    isDragging            = true;
    previousMousePosition = { x: e.offsetX, y: e.offsetY };
});
renderer.domElement.addEventListener("mouseup",    () => { isDragging = false; });
renderer.domElement.addEventListener("mouseleave", () => { isDragging = false; });
renderer.domElement.addEventListener("mousemove",  (e) => {
    if (!isDragging || !planet) return;
    planet.rotation.y += (e.offsetX - previousMousePosition.x) * 0.005;
    planet.rotation.x += (e.offsetY - previousMousePosition.y) * 0.005;
    previousMousePosition = { x: e.offsetX, y: e.offsetY };
});

// ================================
// TOUCH DRAG TO SPIN (planet-only hit test)
// ================================
const raycaster = new THREE.Raycaster();

function getTouchNDC(touch) {
    const rect = renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(
        ((touch.clientX - rect.left) / rect.width)  *  2 - 1,
        ((touch.clientY - rect.top)  / rect.height) * -2 + 1
    );
}

function touchHitsPlanet(touch) {
    if (!planet) return false;
    raycaster.setFromCamera(getTouchNDC(touch), camera);
    return raycaster.intersectObject(planet, true).length > 0;
}

renderer.domElement.addEventListener("touchstart", (e) => {
    if (e.touches.length === 2) {
        isDragging        = false;
        lastPinchDistance = null;
        return;
    }
    if (touchHitsPlanet(e.touches[0])) {
        isDragging = true;
        previousMousePosition = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY
        };
        e.preventDefault(); // block page scroll only when on planet
    }
}, { passive: false }); // must be false so preventDefault() works

renderer.domElement.addEventListener("touchend", () => {
    isDragging        = false;
    lastPinchDistance = null;
}, { passive: true });

renderer.domElement.addEventListener("touchmove", (e) => {
    // Pinch to zoom
    if (e.touches.length === 2) {
        const dx   = e.touches[0].clientX - e.touches[1].clientX;
        const dy   = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (lastPinchDistance !== null) {
            const delta = lastPinchDistance - dist;
            camera.position.z = Math.max(1, Math.min(30, camera.position.z + delta * 0.05));
        }
        lastPinchDistance = dist;
        return;
    }

    // Single finger drag — only if we confirmed a planet hit on touchstart
    if (!isDragging || !planet) return;
    planet.rotation.y += (e.touches[0].clientX - previousMousePosition.x) * 0.005;
    planet.rotation.x += (e.touches[0].clientY - previousMousePosition.y) * 0.005;
    previousMousePosition = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
    };
    e.preventDefault(); // block scroll while spinning
}, { passive: false }); // must be false so preventDefault() works

let lastPinchDistance = null;

// ================================
// RESIZE
// ================================
window.addEventListener("resize", () => {
    const w = viewerContainer.clientWidth;
    camera.aspect = w / 600;
    camera.updateProjectionMatrix();
    renderer.setSize(w, 600);
});