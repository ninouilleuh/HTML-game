window.canvas = document.getElementById("mapCanvas");
window.ctx = canvas.getContext("2d");


// Set canvas size and handle resizing
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Place player on first load
placePlayer();

// Spawn initial enemies
spawnInitialEnemies(5);

// Attach campfire click handler
canvas.addEventListener('mousedown', function(e) {
    // If a message is showing, dismiss it and do nothing else
    if (typeof message !== "undefined" && message) {
        message = "";
        drawMap();
        return;
    }
    // Try bonfire first, then campfire
    // If bonfire handled the click, don't call campfire
    if (handleBonfireClick(e)) return;
    handleCampfireClick(e);
});

// Track which movement keys are currently pressed
const movementKeys = {
    up: false,
    down: false,
    left: false,
    right: false
};

// Movement repeat interval (ms)
const MOVE_REPEAT_INTERVAL = 80; // Lower = faster movement

let moveIntervalId = null;

function handleMovementFromKeys() {
    let dx = 0, dy = 0;
    if (movementKeys.left) dx -= 1;
    if (movementKeys.right) dx += 1;
    if (movementKeys.up) dy -= 1;
    if (movementKeys.down) dy += 1;
    if (dx !== 0 || dy !== 0) {
        movePlayer(dx, dy);
    }
}

// Start continuous movement
function startMovementLoop() {
    if (moveIntervalId !== null) return;
    handleMovementFromKeys(); // Move immediately
    moveIntervalId = setInterval(handleMovementFromKeys, MOVE_REPEAT_INTERVAL);
}

// Stop continuous movement
function stopMovementLoop() {
    if (moveIntervalId !== null) {
        clearInterval(moveIntervalId);
        moveIntervalId = null;
    }
}

// Handle keyboard input for movement and crafting
window.addEventListener('keydown', (e) => {
    // Dismiss message with Space or Enter
    if (typeof message !== "undefined" && message && (e.key === " " || e.key === "Enter" || e.key === "Spacebar")) {
        message = "";
        drawMap();
        return;
    }

    // Inventory selection
    if (e.key === "1") {
        if (countInInventory("campfire") > 0) {
            selectedItem = "campfire";
            message = "Campfire selected. Click on the map to place it.";
            drawMap();
        }
        return;
    }
    if (e.key === "2") {
        if (countInInventory("bonfire") > 0) {
            selectedItem = "bonfire";
            message = "Bonfire selected. Click on the map to place it.";
            drawMap();
        }
        return;
    }

    // Movement keys
    let changed = false;
    switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
            if (!movementKeys.up) { movementKeys.up = true; changed = true; }
            break;
        case 'ArrowDown':
        case 's':
        case 'S':
            if (!movementKeys.down) { movementKeys.down = true; changed = true; }
            break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
            if (!movementKeys.left) { movementKeys.left = true; changed = true; }
            break;
        case 'ArrowRight':
        case 'd':
        case 'D':
            if (!movementKeys.right) { movementKeys.right = true; changed = true; }
            break;
    }
    if (changed) startMovementLoop();
});

window.addEventListener('keyup', (e) => {
    let changed = false;
    switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
            if (movementKeys.up) { movementKeys.up = false; changed = true; }
            break;
        case 'ArrowDown':
        case 's':
        case 'S':
            if (movementKeys.down) { movementKeys.down = false; changed = true; }
            break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
            if (movementKeys.left) { movementKeys.left = false; changed = true; }
            break;
        case 'ArrowRight':
        case 'd':
        case 'D':
            if (movementKeys.right) { movementKeys.right = false; changed = true; }
            break;
    }
    // If no movement keys are pressed, stop the movement loop
    if (!movementKeys.up && !movementKeys.down && !movementKeys.left && !movementKeys.right) {
        stopMovementLoop();
    }
});

// Track last day for season system
let lastDay = Math.floor(timeOfDay * 24);

let dryGrassFrame = 0;
function dayNightLoop() {
    // --- Move time update here ---
    if (isDay()) {
        timeOfDay += timeSpeedDay;
        window._absoluteTimeOfDay += timeSpeedDay;
    } else {
        timeOfDay += timeSpeedNight;
        window._absoluteTimeOfDay += timeSpeedNight;
    }
    if (timeOfDay > 1) timeOfDay -= 1;

    updateEnemies();
    updateForestFires();
    if (dryGrassFrame % 20 === 0) updateDryGrass();
    dryGrassFrame++;
    drawMap();

    // Advance season day at midnight
    let currentHour = Math.floor(timeOfDay * 24);
    if (lastDay > currentHour) { // timeOfDay wrapped around (new day)
        advanceSeasonDay();
    }
    lastDay = currentHour;

    requestAnimationFrame(dayNightLoop);
}

// Initial draw and start loop
drawMap();
dayNightLoop();

// --- MOBILE TOUCH CONTROLS WITH DIAGONAL SUPPORT ---
function createMobileControls() {
    if (document.getElementById('mobile-controls')) return; // Prevent duplicates

    const controls = document.createElement('div');
    controls.id = 'mobile-controls';
    controls.style.position = 'fixed';
    controls.style.left = '20px';
    controls.style.bottom = '20px';
    controls.style.zIndex = 1000;
    controls.style.userSelect = 'none';

    // Button definitions
    const directions = [
        { id: 'up', dx: 0, dy: -1, label: '↑' },
        { id: 'down', dx: 0, dy: 1, label: '↓' },
        { id: 'left', dx: -1, dy: 0, label: '←' },
        { id: 'right', dx: 1, dy: 0, label: '→' }
    ];

    // Track which buttons are pressed
    const pressed = { up: false, down: false, left: false, right: false };

    // Helper to handle movement based on pressed buttons
    function handleMovement() {
        let dx = 0, dy = 0;
        if (pressed.left) dx -= 1;
        if (pressed.right) dx += 1;
        if (pressed.up) dy -= 1;
        if (pressed.down) dy += 1;
        if (dx !== 0 || dy !== 0) {
            movePlayer(dx, dy);
        }
    }

    // Create and style buttons
    directions.forEach(dir => {
        const btn = document.createElement('button');
        btn.id = 'btn-' + dir.id;
        btn.textContent = dir.label;
        btn.style.width = '48px';
        btn.style.height = '48px';
        btn.style.margin = '4px';
        btn.style.fontSize = '24px';
        btn.style.borderRadius = '8px';
        btn.style.border = '1px solid #888';
        btn.style.background = '#222';
        btn.style.color = '#FFD700';
        btn.style.display = 'inline-block';

        // Touch events for mobile
        btn.ontouchstart = (e) => {
            e.preventDefault();
            pressed[dir.id] = true;
            handleMovement();
        };
        btn.ontouchend = btn.ontouchcancel = (e) => {
            e.preventDefault();
            pressed[dir.id] = false;
        };

        // Mouse events for desktop testing
        btn.onmousedown = (e) => {
            e.preventDefault();
            pressed[dir.id] = true;
            handleMovement();
        };
        btn.onmouseup = btn.onmouseleave = (e) => {
            e.preventDefault();
            pressed[dir.id] = false;
        };

        controls.appendChild(btn);
    });

    document.body.appendChild(controls);
}

// --- MOBILE JOYSTICK CONTROL ---
function createMobileJoystick() {
    if (document.getElementById('mobile-joystick')) return; // Prevent duplicates

    // Remove arrow keys/buttons if present
    const oldControls = document.getElementById('mobile-controls');
    if (oldControls) oldControls.remove();

    const joystick = document.createElement('div');
    joystick.id = 'mobile-joystick';
    joystick.style.position = 'fixed';
    joystick.style.left = '30px';
    joystick.style.bottom = '30px';
    joystick.style.width = '120px';
    joystick.style.height = '120px';
    joystick.style.background = 'rgba(0,0,0,0.2)';
    joystick.style.borderRadius = '50%';
    joystick.style.zIndex = 1000;
    joystick.style.touchAction = 'none';
    joystick.style.userSelect = 'none';

    // Inner stick
    const stick = document.createElement('div');
    stick.style.position = 'absolute';
    stick.style.left = '40px';
    stick.style.top = '40px';
    stick.style.width = '40px';
    stick.style.height = '40px';
    stick.style.background = '#FFD700';
    stick.style.opacity = '0.8';
    stick.style.borderRadius = '50%';
    stick.style.transition = 'left 0.05s, top 0.05s';
    joystick.appendChild(stick);

    let centerX = 60, centerY = 60;
    let active = false;
    let moveTimer = null;

    function getDirection(dx, dy) {
        let threshold = 18;
        let dirX = 0, dirY = 0;
        if (dx < -threshold) dirX = -1;
        if (dx > threshold) dirX = 1;
        if (dy < -threshold) dirY = -1;
        if (dy > threshold) dirY = 1;
        return { dx: dirX, dy: dirY };
    }

    function movePlayerFromJoystick(dx, dy) {
        const dir = getDirection(dx, dy);
        if (dir.dx !== 0 || dir.dy !== 0) {
            movePlayer(dir.dx, dir.dy);
        }
    }

    function startMoveLoop(dx, dy) {
        stopMoveLoop();
        movePlayerFromJoystick(dx, dy);
        moveTimer = setInterval(() => movePlayerFromJoystick(dx, dy), 90);
    }

    function stopMoveLoop() {
        if (moveTimer) {
            clearInterval(moveTimer);
            moveTimer = null;
        }
    }

    joystick.addEventListener('touchstart', function(e) {
        active = true;
        const touch = e.touches[0];
        const rect = joystick.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        let dx = x - centerX;
        let dy = y - centerY;
        stick.style.left = (centerX + dx * 0.5 - 20) + 'px';
        stick.style.top = (centerY + dy * 0.5 - 20) + 'px';
        startMoveLoop(dx, dy);
    });

    joystick.addEventListener('touchmove', function(e) {
        if (!active) return;
        const touch = e.touches[0];
        const rect = joystick.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        let dx = x - centerX;
        let dy = y - centerY;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 40) {
            dx = dx * 40 / dist;
            dy = dy * 40 / dist;
        }
        stick.style.left = (centerX + dx - 20) + 'px';
        stick.style.top = (centerY + dy - 20) + 'px';
        startMoveLoop(dx, dy);
    });

    joystick.addEventListener('touchend', function(e) {
        active = false;
        stick.style.left = '40px';
        stick.style.top = '40px';
        stopMoveLoop();
    });

    joystick.addEventListener('touchcancel', function(e) {
        active = false;
        stick.style.left = '40px';
        stick.style.top = '40px';
        stopMoveLoop();
    });

    document.body.appendChild(joystick);
}

// Only show joystick on real mobile devices (not just small screens)
if (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    window.addEventListener('DOMContentLoaded', createMobileJoystick);
}