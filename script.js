// --- Physics Constants ---
const G = 6.67430e-11; // Universal gravitational constant
const DEFAULT_SCALE = 1e8; // meters per pixel for visual mode

// --- Data Dictionaries ---
const celestialBodies = {
    sun: { name: "Sun", type: "star", mass: 1.989e30, radius: 6.96e8, color: "#fbbf24" },
    earth: { name: "Earth", type: "planet", mass: 5.972e24, radius: 6.371e6, color: "#3b82f6" },
    moon: { name: "Moon", type: "moon", mass: 7.34e22, radius: 1.737e6, color: "#d1d5db" },
    mars: { name: "Mars", type: "planet", mass: 6.39e23, radius: 3.389e6, color: "#ef4444" },
    jupiter: { name: "Jupiter", type: "planet", mass: 1.898e27, radius: 6.9911e7, color: "#f59e0b" },
    phobos: { name: "Phobos", type: "moon", mass: 1.0659e16, radius: 1.126e4, color: "#9ca3af" },
    titan: { name: "Titan", type: "moon", mass: 1.345e23, radius: 2.574e6, color: "#fcd34d" },
    halley: { name: "Halley's Comet", type: "comet", mass: 2.2e14, radius: 5.5e3, color: "#93c5fd" },
    ceres: { name: "Ceres", type: "asteroid", mass: 9.393e20, radius: 4.73e5, color: "#78716c" },
    iss: { name: "ISS", type: "satellite", mass: 4.2e5, radius: 54, color: "#ffffff" },
    jwst: { name: "JWST", type: "telescope", mass: 6161, radius: 10, color: "#c084fc" },
    hubble: { name: "Hubble", type: "telescope", mass: 11110, radius: 6.6, color: "#60a5fa" },
    blackhole: { name: "Black Hole (10M☉)", type: "star", mass: 1.989e31, radius: 29500, color: "#000000", border: "#a855f7" },
    neutron: { name: "Neutron Star", type: "star", mass: 2.78e30, radius: 10000, color: "#2dd4bf" },
    quasar: { name: "Quasar", type: "star", mass: 1.989e39, radius: 1e12, color: "#f43f5e", border: "#fff" }
};

const funObjects = {
    tennis: { name: "Tennis Ball", mass: 0.058, color: "#a3e635" },
    baseball: { name: "Baseball", mass: 0.145, color: "#ffffff" },
    basketball: { name: "Basketball", mass: 0.624, color: "#ea580c" },
    airplane: { name: "Airplane", mass: 40000, color: "#cbd5e1" },
    cow: { name: "Cow", mass: 600, color: "#78350f" },
    pyramid: { name: "Great Pyramid", mass: 6e9, color: "#d97706" }
};

// --- State Variables ---
let currentMode = null; 
let activeCentralBody = null;
let activeSecondaryBody = null;

let isTrueScale = false;
let globalZoom = 1;
let mpp = DEFAULT_SCALE; // meters per pixel

let simState = 'idle'; // idle, dragging, waiting_input, orbiting, falling, crashed, escaped
let skipDialogs = { gravitation: false, potential: false, acceleration: false };

// Physics engine state
let obj1 = { x: 0, y: 0, mass: 0, radius: 0 };
let obj2 = { x: 0, y: 0, vx: 0, vy: 0, mass: 0, radius: 0 };
let trail = [];
let fallTime = 0;
let lastTime = 0;
let dt_multiplier = 1;

// DOM Elements
const canvas = document.getElementById('sim-canvas');
const ctx = canvas.getContext('2d');
const bottomBar = document.getElementById('bottom-bar');
const telemetryPanel = document.getElementById('telemetry-panel');
const telemetryContent = document.getElementById('telemetry-content');
const topToolbar = document.getElementById('top-toolbar');
const dataPanel = document.getElementById('data-panel');
const dataTableBody = document.getElementById('data-table-body');
const centerAlert = document.getElementById('center-alert');

// Resize canvas
function resizeCanvas() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    if(activeCentralBody) {
        obj1.x = canvas.width / 2;
        obj1.y = currentMode === 'acceleration' ? canvas.height + 200 : canvas.height / 2;
    }
}
window.addEventListener('resize', resizeCanvas);

// --- Initialization & UI Flow ---

function setMode(mode) {
    currentMode = mode;
    resetSim();
    
    // UI toggles
    document.getElementById('btn-grav').className = mode === 'gravitation' ? 'w-full py-3 bg-blue-700 ring-2 ring-blue-400 rounded-lg font-bold shadow-lg' : 'w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition shadow-lg';
    document.getElementById('btn-pot').className = mode === 'potential' ? 'w-full py-3 bg-indigo-700 ring-2 ring-indigo-400 rounded-lg font-bold shadow-lg' : 'w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-semibold transition shadow-lg';
    document.getElementById('btn-acc').className = mode === 'acceleration' ? 'w-full py-3 bg-green-700 ring-2 ring-green-400 rounded-lg font-bold shadow-lg' : 'w-full py-3 bg-green-600 hover:bg-green-500 rounded-lg font-semibold transition shadow-lg';

    topToolbar.classList.remove('hidden');
    bottomBar.classList.remove('hidden');
    telemetryPanel.classList.remove('hidden');
    dataPanel.classList.remove('hidden');

    populateBottomBar();
    showDialog(mode);
}

function showDialog(mode) {
    if (skipDialogs[mode]) return;
    
    const dialog = document.getElementById('instruction-dialog');
    const title = document.getElementById('dialog-title');
    const text = document.getElementById('dialog-text');
    
    let instructions = "";
    if (mode === 'gravitation' || mode === 'potential') {
        title.innerText = mode === 'gravitation' ? "Gravitation Sandbox" : "Potential Energy Sandbox";
        instructions = `
            <p><strong>1.</strong> Select a central celestial body from the bottom bar.</p>
            <p><strong>2.</strong> Select a satellite/secondary object and <strong>drag it</strong> onto the space grid.</p>
            <p><strong>3.</strong> Enter the calculated initial tangential velocity ($v = \\sqrt{\\frac{GM}{r}}$) to achieve orbit.</p>
            <p class="text-yellow-400 mt-2 text-xs">Note: In True Scale mode, distances are extreme. Use the zoom slider to navigate.</p>
        `;
    } else {
        title.innerText = "Kinematics & Acceleration";
        instructions = `
            <p><strong>1.</strong> Select a celestial body to define the local gravity ($g = \\frac{GM}{r^2}$).</p>
            <p><strong>2.</strong> Select an object and specify the exact drop height in meters.</p>
            <p><strong>3.</strong> Predict the time of fall using $y = \\frac{1}{2}gt^2$ before dropping.</p>
        `;
    }

    text.innerHTML = instructions;
    MathJax.typesetPromise([text]);
    dialog.classList.remove('hidden');
}

function closeDialog() {
    const skip = document.getElementById('dont-show-checkbox').checked;
    if (skip && currentMode) {
        skipDialogs[currentMode] = true;
    }
    document.getElementById('instruction-dialog').classList.add('hidden');
    document.getElementById('dont-show-checkbox').checked = false;
}

function populateBottomBar() {
    bottomBar.innerHTML = '';
    const items = currentMode === 'acceleration' && activeCentralBody ? funObjects : celestialBodies;
    
    for (let key in items) {
        if (currentMode === 'acceleration' && !activeCentralBody && items[key].type === 'telescope') continue;

        let obj = items[key];
        let el = document.createElement('div');
        el.className = 'flex flex-col items-center justify-center cursor-pointer min-w-[80px] hover:scale-110 transition-transform';
        el.onclick = () => selectObject(key, obj);
        
        let circle = document.createElement('div');
        circle.className = 'w-12 h-12 rounded-full mb-1 flex items-center justify-center text-xs font-bold shadow-lg';
        circle.style.backgroundColor = obj.color;
        if (obj.border) circle.style.border = `2px solid ${obj.border}`;
        if (obj.color === '#000000') circle.style.color = '#fff';
        
        // Initial for telescopes/fun objects if needed
        circle.innerText = obj.name.substring(0, 1);

        let label = document.createElement('span');
        label.className = 'text-xs text-center text-gray-300 leading-tight';
        label.innerText = obj.name;

        el.appendChild(circle);
        el.appendChild(label);
        bottomBar.appendChild(el);
    }
}

function selectObject(key, obj) {
    if (!activeCentralBody) {
        activeCentralBody = obj;
        obj1 = { 
            x: canvas.width / 2, 
            y: currentMode === 'acceleration' ? canvas.height + 200 : canvas.height / 2, 
            mass: obj.mass, 
            radius: obj.radius,
            color: obj.color,
            border: obj.border
        };
        simState = 'idle';
        if (currentMode === 'acceleration') populateBottomBar(); // Switch to fun objects
    } else {
        activeSecondaryBody = obj;
        obj2.mass = obj.mass;
        obj2.radius = obj.radius || 1; // 1m for fun objects
        obj2.color = obj.color;
        
        if (currentMode === 'acceleration') {
            document.getElementById('height-dialog').classList.remove('hidden');
        } else {
            simState = 'dragging';
        }
    }
}

// --- Interaction & Input ---

canvas.addEventListener('mousemove', (e) => {
    if (simState === 'dragging' || simState === 'accel_dragging') {
        const rect = canvas.getBoundingClientRect();
        obj2.x = e.clientX - rect.left;
        obj2.y = e.clientY - rect.top;
    }
});

canvas.addEventListener('mousedown', (e) => {
    if (simState === 'dragging') {
        simState = 'waiting_input';
        
        // Calculate current real r
        let dx = obj2.x - obj1.x;
        let dy = obj2.y - obj1.y;
        let distPx = Math.sqrt(dx*dx + dy*dy);
        let realR = distPx * mpp;

        let hint = document.getElementById('velocity-math-hint');
        hint.innerHTML = `Force: $F = G \\frac{m_1 m_2}{r^2}$<br>Distance placed: $r = ${realR.toExponential(2)}$ m`;
        MathJax.typesetPromise([hint]);

        document.getElementById('velocity-dialog').classList.remove('hidden');
        document.getElementById('velocity-input').value = '';
        document.getElementById('velocity-input').focus();
    } else if (simState === 'accel_dragging') {
        simState = 'falling';
        fallTime = 0;
        trail = [];
        lastTime = performance.now();
    }
});

function toggleTrueScale() {
    isTrueScale = document.getElementById('true-scale-toggle').checked;
    updateZoom();
}

function updateZoom() {
    globalZoom = parseFloat(document.getElementById('zoom-slider').value);
    
    if (isTrueScale) {
        // True scale: 1 pixel = 1,000,000 meters / zoom
        mpp = 1e6 / globalZoom;
    } else {
        // Visual scale: distances arbitrary to fit screen
        mpp = DEFAULT_SCALE / globalZoom;
    }
}

// --- Specific Mode Triggers ---

function startOrbit() {
    let vInput = parseFloat(document.getElementById('velocity-input').value);
    if (isNaN(vInput)) return;

    document.getElementById('velocity-dialog').classList.add('hidden');
    
    // Set up tangential velocity relative to the vector from obj1 to obj2
    let dx = obj2.x - obj1.x;
    let dy = obj2.y - obj1.y;
    let distPx = Math.sqrt(dx*dx + dy*dy);
    
    // Perpendicular vector for tangential orbit
    let nx = -dy / distPx;
    let ny = dx / distPx;

    // We scale the real velocity down to pixel/sec for the engine
    let vPx = vInput / mpp;
    
    obj2.vx = nx * vPx;
    obj2.vy = ny * vPx;
    
    trail = [];
    simState = 'orbiting';
    lastTime = performance.now();

    // Adjust integration step based on radius to keep simulation visually smooth
    let realR = distPx * mpp;
    let vCirc = Math.sqrt(G * obj1.mass / realR);
    let period = 2 * Math.PI * realR / vCirc;
    dt_multiplier = period / 300; // Target ~300 frames per orbit visually
}

function startDropFromInput() {
    let hInput = parseFloat(document.getElementById('height-input').value);
    if (isNaN(hInput)) return;

    document.getElementById('height-dialog').classList.add('hidden');
    
    // Calculate pixel drop height relative to the visual arc (which is at obj1.y - visualRadius)
    let visualRadius = isTrueScale ? obj1.radius / mpp : 200 * globalZoom;
    let arcTopY = obj1.y - visualRadius;
    
    obj2.x = canvas.width / 2;
    obj2.y = arcTopY - (hInput / mpp);
    
    simState = 'falling';
    obj2.vy = 0;
    fallTime = 0;
    trail = [];
    lastTime = performance.now();
}

function enableManualDragDrop() {
    document.getElementById('height-dialog').classList.add('hidden');
    simState = 'accel_dragging';
}

function resetSim() {
    activeCentralBody = null;
    activeSecondaryBody = null;
    simState = 'idle';
    trail = [];
    fallTime = 0;
    hideAlert();
    resizeCanvas();
    populateBottomBar();
}

function showAlert(msg, colorClass) {
    centerAlert.innerText = msg;
    centerAlert.className = `absolute top-1/4 left-1/2 transform -translate-x-1/2 text-2xl font-bold text-center pointer-events-none drop-shadow-lg z-40 fade-in ${colorClass}`;
}
function hideAlert() {
    centerAlert.classList.remove('fade-in');
    centerAlert.classList.add('opacity-0');
}

// --- Telemetry & Data Logging ---
let lastUpdate = 0;
function updateDashboard() {
    let now = performance.now();
    if (now - lastUpdate < 250) return; // 4Hz update to prevent lag
    lastUpdate = now;

    if (!activeCentralBody || (!activeSecondaryBody && currentMode !== 'acceleration')) {
        telemetryContent.innerHTML = "<p>Awaiting setup...</p>";
        return;
    }

    let dx = obj2.x - obj1.x;
    let dy = obj2.y - obj1.y;
    let distPx = Math.sqrt(dx*dx + dy*dy);
    let r = distPx * mpp;

    let html = `<div><strong>$m_1$:</strong> ${obj1.mass.toExponential(2)} kg</div>`;
    
    if (activeSecondaryBody) {
        html += `<div><strong>$m_2$:</strong> ${obj2.mass.toExponential(2)} kg</div>`;
        html += `<div class="mt-2 border-t border-gray-600 pt-2"></div>`;
        
        if (currentMode === 'gravitation' || currentMode === 'potential') {
            let F = G * obj1.mass * obj2.mass / (r*r);
            let U = -G * obj1.mass * obj2.mass / r;
            let currentV = Math.sqrt(obj2.vx*obj2.vx + obj2.vy*obj2.vy) * mpp;
            
            html += `<div><strong>$r$:</strong> ${r.toExponential(3)} m</div>`;
            html += `<div><strong>$F_g$:</strong> ${F.toExponential(3)} N</div>`;
            html += `<div><strong>$U$:</strong> ${U.toExponential(3)} J</div>`;
            if(simState === 'orbiting' || simState === 'escaped') {
                html += `<div><strong>$v$:</strong> ${currentV.toExponential(3)} m/s</div>`;
            }
        } else if (currentMode === 'acceleration') {
            let surfaceR = obj1.radius;
            let currentH = r - surfaceR;
            let localG = G * obj1.mass / (r*r);
            
            html += `<div><strong>Drop Height $h$:</strong> ${(currentH > 0 ? currentH : 0).toExponential(3)} m</div>`;
            html += `<div><strong>Local $g$:</strong> ${localG.toFixed(3)} m/s$^2$</div>`;
            if (simState === 'falling' || simState === 'crashed') {
                html += `<div><strong>Time $t$:</strong> ${fallTime.toFixed(3)} s</div>`;
            }
        }
    }

    telemetryContent.innerHTML = html;
    MathJax.typesetPromise([telemetryContent]);
}

function recordData() {
    if (!activeCentralBody || !activeSecondaryBody) return;
    
    let dx = obj2.x - obj1.x;
    let dy = obj2.y - obj1.y;
    let r = Math.sqrt(dx*dx + dy*dy) * mpp;
    let F = G * obj1.mass * obj2.mass / (r*r);
    let U = -G * obj1.mass * obj2.mass / r;
    let v = Math.sqrt(obj2.vx*obj2.vx + obj2.vy*obj2.vy) * mpp;

    let tr = document.createElement('tr');
    tr.className = "border-b border-gray-700 hover:bg-gray-700";
    tr.innerHTML = `
        <td class="py-1">${r.toExponential(2)}</td>
        <td class="py-1">${F.toExponential(2)}</td>
        <td class="py-1">${U.toExponential(2)}</td>
        <td class="py-1">${v.toExponential(2)}</td>
    `;
    dataTableBody.appendChild(tr);
}
function clearData() { dataTableBody.innerHTML = ''; }


// --- Physics Engine & Render Loop ---

function physicsStep(dt) {
    if (simState === 'orbiting') {
        // Sub-stepping for stability
        let steps = 10;
        let sub_dt = dt / steps;
        
        for(let i=0; i<steps; i++) {
            let dxPx = obj2.x - obj1.x;
            let dyPx = obj2.y - obj1.y;
            let rPxSq = dxPx*dxPx + dyPx*dyPx;
            let rPx = Math.sqrt(rPxSq);
            
            let rMeters = rPx * mpp;
            
            // Check crash
            let crashRadius = isTrueScale ? (obj1.radius + obj2.radius)/mpp : 25 * globalZoom;
            if (rPx <= crashRadius) {
                simState = 'crashed';
                showAlert("IMPACT DETECTED! Orbit failed.", "text-red-500");
                return;
            }
            
            // Check escape (simplistic boundary check for visualization)
            if (rPx > canvas.width * 5) {
                simState = 'escaped';
                showAlert("OBJECT ESCAPED GRAVITATIONAL WELL", "text-blue-400");
                return;
            }

            // F = G * m1 * m2 / r^2
            // a = F / m2 = G * m1 / r^2
            let aMeters = G * obj1.mass / (rMeters * rMeters);
            let aPx = aMeters / mpp;

            let ax = -aPx * (dxPx/rPx);
            let ay = -aPx * (dyPx/rPx);

            obj2.vx += ax * sub_dt;
            obj2.vy += ay * sub_dt;
            obj2.x += obj2.vx * sub_dt;
            obj2.y += obj2.vy * sub_dt;
        }
        
        if(trail.length === 0 || Math.hypot(trail[trail.length-1].x - obj2.x, trail[trail.length-1].y - obj2.y) > 5) {
            trail.push({x: obj2.x, y: obj2.y});
            if(trail.length > 500) trail.shift();
        }
    } 
    else if (simState === 'falling') {
        let dxPx = obj2.x - obj1.x;
        let dyPx = obj2.y - obj1.y;
        let rPx = Math.sqrt(dxPx*dxPx + dyPx*dyPx);
        let rMeters = rPx * mpp;

        let aMeters = G * obj1.mass / (rMeters * rMeters);
        let aPx = aMeters / mpp;

        // 1D kinematics towards center
        obj2.vy += aPx * (dyPx/rPx) * dt; 
        obj2.x += obj2.vx * dt; // vx should be 0
        obj2.y += obj2.vy * dt;

        fallTime += dt;

        // Visual crash check against arc
        let visualRadius = isTrueScale ? obj1.radius / mpp : 200 * globalZoom;
        if (rPx <= visualRadius) {
            simState = 'crashed';
            // Snap to surface visually
            let ratio = visualRadius / rPx;
            obj2.x = obj1.x + dxPx * ratio;
            obj2.y = obj1.y + dyPx * ratio;
        }

        if(trail.length === 0 || Math.abs(trail[trail.length-1].y - obj2.y) > 5) {
            trail.push({x: obj2.x, y: obj2.y});
        }
    }
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw Grid
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 1;
    for(let x=0; x<canvas.width; x+=50) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke(); }
    for(let y=0; y<canvas.height; y+=50) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke(); }

    if (activeCentralBody) {
        let r1 = isTrueScale ? Math.max(2, obj1.radius / mpp) : (currentMode === 'acceleration' ? 200 * globalZoom : 40 * globalZoom);
        
        ctx.beginPath();
        ctx.arc(obj1.x, obj1.y, r1, 0, Math.PI * 2);
        ctx.fillStyle = obj1.color;
        ctx.fill();
        if(obj1.border) {
            ctx.strokeStyle = obj1.border;
            ctx.lineWidth = 3;
            ctx.stroke();
        }

        // Accel mode Arc detail
        if (currentMode === 'acceleration') {
            ctx.strokeStyle = '#374151';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(obj1.x, obj1.y, r1 + 5, Math.PI, 0);
            ctx.stroke();
        }
    }

    if (activeSecondaryBody) {
        let r2 = isTrueScale ? Math.max(1, obj2.radius / mpp) : 10 * globalZoom;

        // Dragging guides
        if (simState === 'dragging') {
            ctx.strokeStyle = 'rgba(255,255,255,0.2)';
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(obj1.x, obj1.y);
            ctx.lineTo(obj2.x, obj2.y);
            ctx.stroke();
            
            // Draw theoretical circular orbit shadow
            let distPx = Math.hypot(obj2.x - obj1.x, obj2.y - obj1.y);
            ctx.beginPath();
            ctx.arc(obj1.x, obj1.y, distPx, 0, Math.PI*2);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Trails
        if (trail.length > 1) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.setLineDash(currentMode==='acceleration' ? [5,5] : []);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(trail[0].x, trail[0].y);
            for(let i=1; i<trail.length; i++) ctx.lineTo(trail[i].x, trail[i].y);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Draw Object
        ctx.beginPath();
        ctx.arc(obj2.x, obj2.y, r2, 0, Math.PI * 2);
        ctx.fillStyle = obj2.color;
        ctx.fill();

        // Draw dynamic connection line if orbiting/falling
        if (simState === 'orbiting' || simState === 'falling') {
            ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)';
            ctx.beginPath();
            ctx.moveTo(obj1.x, obj1.y);
            ctx.lineTo(obj2.x, obj2.y);
            ctx.stroke();
        }
    }
}

function loop() {
    let now = performance.now();
    let dtReal = (now - lastTime) / 1000; // standard seconds
    lastTime = now;

    // Cap dt to prevent explosion on tab resume
    if (dtReal > 0.1) dtReal = 0.016; 

    // For orbital dynamics, we scale time up so orbits don't take a literal year
    // For kinematics, 1 real second = 1 sim second.
    let dtSim = currentMode === 'acceleration' ? dtReal : dtReal * dt_multiplier;

    if (simState === 'orbiting' || simState === 'falling') {
        physicsStep(dtSim);
    }

    render();
    updateDashboard();
    
    requestAnimationFrame(loop);
}

// Start rendering loop
resizeCanvas();
requestAnimationFrame(loop);