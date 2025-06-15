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
    joystick.style.left = '16px';
    joystick.style.bottom = '16px';
    joystick.style.width = '260px';      // Much larger size
    joystick.style.height = '260px';     // Much larger size
    joystick.style.background = 'rgba(0,0,0,0.18)';
    joystick.style.borderRadius = '50%';
    joystick.style.zIndex = 1000;
    joystick.style.touchAction = 'none';
    joystick.style.userSelect = 'none';

    // Inner stick
    const stick = document.createElement('div');
    stick.style.position = 'absolute';
    stick.style.left = '100px';           // Centered for new size
    stick.style.top = '100px';
    stick.style.width = '60px';           // Larger stick
    stick.style.height = '60px';
    stick.style.background = '#FFD700';
    stick.style.opacity = '0.88';
    stick.style.borderRadius = '50%';
    stick.style.transition = 'left 0.05s, top 0.05s';
    joystick.appendChild(stick);

    let centerX = 130, centerY = 130;
    let active = false;
    let moveTimer = null;
    let currentDx = 0, currentDy = 0;

    function getDirection(dx, dy) {
        let threshold = 38;
        let dirX = 0, dirY = 0;
        if (dx < -threshold) dirX = -1;
        if (dx > threshold) dirX = 1;
        if (dy < -threshold) dirY = -1;
        if (dy > threshold) dirY = 1;
        return { dx: dirX, dy: dirY };
    }

    function movePlayerFromJoystick() {
        const dir = getDirection(currentDx, currentDy);
        if (dir.dx !== 0 || dir.dy !== 0) {
            movePlayer(dir.dx, dir.dy);
        }
    }

    function startMoveLoop() {
        stopMoveLoop();
        movePlayerFromJoystick(); // Move immediately
        moveTimer = setInterval(movePlayerFromJoystick, 100); // 180ms for slower movement
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
        currentDx = x - centerX;
        currentDy = y - centerY;
        stick.style.left = (centerX + currentDx * 0.5 - 30) + 'px';
        stick.style.top = (centerY + currentDy * 0.5 - 30) + 'px';
        startMoveLoop();
    }, { passive: false });

    joystick.addEventListener('touchmove', function(e) {
        if (!active) return;
        const touch = e.touches[0];
        const rect = joystick.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        let dx = x - centerX;
        let dy = y - centerY;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 100) {
            dx = dx * 100 / dist;
            dy = dy * 100 / dist;
        }
        currentDx = dx;
        currentDy = dy;
        stick.style.left = (centerX + dx - 30) + 'px';
        stick.style.top = (centerY + dy - 30) + 'px';
        // Do NOT restart the interval here!
    }, { passive: false });

    joystick.addEventListener('touchend', function(e) {
        active = false;
        stick.style.left = '100px';
        stick.style.top = '100px';
        stopMoveLoop();
    }, { passive: false });

    joystick.addEventListener('touchcancel', function(e) {
        active = false;
        stick.style.left = '100px';
        stick.style.top = '100px';
        stopMoveLoop();
    }, { passive: false });

    document.body.appendChild(joystick);
}

// Only show joystick on real mobile devices (not just small screens)
if (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    window.addEventListener('DOMContentLoaded', createMobileJoystick);
}

function createInventoryButton() {
    if (document.getElementById('inventory-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'inventory-btn';
    btn.textContent = 'Inventory';
    btn.style.position = 'fixed';
    btn.style.right = '24px';
    btn.style.bottom = '24px';
    btn.style.width = '120px';
    btn.style.height = '56px';
    btn.style.fontSize = '22px';
    btn.style.background = '#222';
    btn.style.color = '#FFD700';
    btn.style.border = '2px solid #FFD700';
    btn.style.borderRadius = '14px';
    btn.style.zIndex = 9999;
    btn.style.opacity = '0.95';

    btn.onclick = function() {
        showInventoryBox();
    };

    document.body.appendChild(btn);
}

// Inventory box UI
function showInventoryBox() {
    // Remove existing box if any
    let oldBox = document.getElementById('inventory-box');
    if (oldBox) oldBox.remove();

    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'inventory-box';
    overlay.style.position = 'fixed';
    overlay.style.left = '0';
    overlay.style.top = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.background = 'rgba(0,0,0,0.45)';
    overlay.style.zIndex = '10000';
    overlay.onclick = function(e) {
        if (e.target === overlay) overlay.remove();
    };

    // Inventory panel
    const panel = document.createElement('div');
    panel.style.position = 'absolute';
    panel.style.left = '50%';
    panel.style.top = '50%';
    panel.style.transform = 'translate(-50%, -50%)';
    panel.style.background = '#222';
    panel.style.border = '3px solid #FFD700';
    panel.style.borderRadius = '18px';
    panel.style.padding = '24px 32px';
    panel.style.minWidth = '320px';
    panel.style.minHeight = '180px';
    panel.style.boxShadow = '0 8px 32px #000a';
    panel.style.display = 'flex';
    panel.style.flexDirection = 'column';
    panel.style.alignItems = 'center';

    // Title
    const title = document.createElement('div');
    title.textContent = 'Inventory';
    title.style.color = '#FFD700';
    title.style.fontSize = '28px';
    title.style.marginBottom = '18px';
    panel.appendChild(title);

    // Inventory slots
    const slots = document.createElement('div');
    slots.style.display = 'flex';
    slots.style.flexWrap = 'wrap';
    slots.style.gap = '16px';
    slots.style.justifyContent = 'center';
    slots.style.marginBottom = '12px';

    // Group items and count
    const items = (player && player.inventory) ? player.inventory.slice() : [];
    const itemCounts = {};
    for (const item of items) {
        itemCounts[item] = (itemCounts[item] || 0) + 1;
    }
    const uniqueItems = Object.keys(itemCounts);
    const slotSize = 56;
    const maxSlots = Math.max(8, uniqueItems.length);

    // Simple emoji or text for each item type
    const itemIcons = {
        "campfire": "🔥",
        "bonfire": "🔥",
        "stone": "🪨",
        "food": "🍖",
        "water": "💧",
        // Add more as needed
    };

    for (let i = 0; i < maxSlots; i++) {
        const slot = document.createElement('div');
        slot.style.width = slotSize + 'px';
        slot.style.height = slotSize + 'px';
        slot.style.background = '#333';
        slot.style.border = '2px solid #FFD700';
        slot.style.borderRadius = '10px';
        slot.style.display = 'flex';
        slot.style.alignItems = 'center';
        slot.style.justifyContent = 'center';
        slot.style.fontSize = '28px';
        slot.style.color = '#FFD700';
        slot.style.boxSizing = 'border-box';
        slot.style.position = 'relative';

        if (uniqueItems[i]) {
            if (uniqueItems[i] === "stick") {
                // Draw a pixel stick using canvas that fits the slot exactly
                const canvas = document.createElement('canvas');
                canvas.width = slotSize;
                canvas.height = slotSize;
                canvas.style.width = slotSize + "px";
                canvas.style.height = slotSize + "px";
                canvas.style.display = "block";
                canvas.style.background = "transparent";
                canvas.style.margin = "0";
                canvas.style.padding = "0";
                canvas.style.boxSizing = "border-box";
                // Draw a brown diagonal stick, thick and spanning the slot
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, slotSize, slotSize);
                ctx.strokeStyle = "#8B5A2B";
                ctx.lineWidth = Math.max(6, slotSize / 8);
                ctx.lineCap = "round";
                ctx.beginPath();
                ctx.moveTo(slotSize * 0.20, slotSize * 0.80);
                ctx.lineTo(slotSize * 0.80, slotSize * 0.20);
                ctx.stroke();
                slot.innerHTML = ""; // Remove any text
                slot.appendChild(canvas);
            } else if (uniqueItems[i] === "big stick") {
                // Draw a big stick using canvas that fits the slot exactly
                const canvas = document.createElement('canvas');
                canvas.width = slotSize;
                canvas.height = slotSize;
                canvas.style.width = slotSize + "px";
                canvas.style.height = slotSize + "px";
                canvas.style.display = "block";
                canvas.style.background = "transparent";
                canvas.style.margin = "0";
                canvas.style.padding = "0";
                canvas.style.boxSizing = "border-box";
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, slotSize, slotSize);
                // Draw a thicker, darker brown diagonal for "big stick"
                ctx.strokeStyle = "#5C3317";
                ctx.lineWidth = Math.max(12, slotSize / 4);
                ctx.lineCap = "round";
                ctx.beginPath();
                ctx.moveTo(slotSize * 0.15, slotSize * 0.85);
                ctx.lineTo(slotSize * 0.85, slotSize * 0.15);
                ctx.stroke();
                slot.innerHTML = "";
                slot.appendChild(canvas);
            } else if (uniqueItems[i] === "campfire") {
                // Draw an unlit campfire (three crossed logs, no flame)
                const canvas = document.createElement('canvas');
                canvas.width = slotSize;
                canvas.height = slotSize;
                canvas.style.width = slotSize + "px";
                canvas.style.height = slotSize + "px";
                canvas.style.display = "block";
                canvas.style.background = "transparent";
                canvas.style.margin = "0";
                canvas.style.padding = "0";
                canvas.style.boxSizing = "border-box";
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, slotSize, slotSize);

                ctx.strokeStyle = "#8B5A2B";
                ctx.lineWidth = Math.max(6, slotSize / 8);
                ctx.lineCap = "round";

                // First log
                ctx.beginPath();
                ctx.moveTo(slotSize * 0.25, slotSize * 0.75);
                ctx.lineTo(slotSize * 0.75, slotSize * 0.65);
                ctx.stroke();

                // Second log
                ctx.beginPath();
                ctx.moveTo(slotSize * 0.35, slotSize * 0.85);
                ctx.lineTo(slotSize * 0.65, slotSize * 0.60);
                ctx.stroke();

                // Third log (crossing the other two)
                ctx.beginPath();
                ctx.moveTo(slotSize * 0.50, slotSize * 0.88);
                ctx.lineTo(slotSize * 0.50, slotSize * 0.58);
                ctx.stroke();

                slot.innerHTML = "";
                slot.appendChild(canvas);
            } else {
                // Show icon if available, else fallback to name
                const icon = itemIcons[uniqueItems[i]] || uniqueItems[i][0].toUpperCase();
                slot.textContent = icon;
            }

            // Show count if more than one
            if (itemCounts[uniqueItems[i]] > 1) {
                const countDiv = document.createElement('div');
                countDiv.textContent = itemCounts[uniqueItems[i]];
                countDiv.style.position = 'absolute';
                countDiv.style.bottom = '2px';
                countDiv.style.right = '6px';
                countDiv.style.fontSize = '16px';
                countDiv.style.color = '#FFD700';
                countDiv.style.background = '#222a';
                countDiv.style.borderRadius = '6px';
                countDiv.style.padding = '0 4px';
                slot.appendChild(countDiv);
            }
        } else {
            slot.style.opacity = '0.4';
        }
        slots.appendChild(slot);
    }

    panel.appendChild(slots);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.marginTop = '8px';
    closeBtn.style.padding = '8px 24px';
    closeBtn.style.fontSize = '18px';
    closeBtn.style.background = '#FFD700';
    closeBtn.style.color = '#222';
    closeBtn.style.border = 'none';
    closeBtn.style.borderRadius = '8px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.onclick = function() {
        overlay.remove();
    };
    panel.appendChild(closeBtn);

    overlay.appendChild(panel);
    document.body.appendChild(overlay);
}

window.addEventListener('DOMContentLoaded', createInventoryButton);

console.log("pixelSize:", pixelSize, "isMobile:", isMobile, "UA:", navigator.userAgent);