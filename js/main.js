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

    // Movement
    switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
            movePlayer(0, -1);
            break;
        case 'ArrowDown':
        case 's':
        case 'S':
            movePlayer(0, 1);
            break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
            movePlayer(-1, 0);
            break;
        case 'ArrowRight':
        case 'd':
        case 'D':
            movePlayer(1, 0);
            break;
    }
});

// Track last day for season system
let lastDay = Math.floor(timeOfDay * 24);

// Game loop: day/night and redraw
function dayNightLoop() {
    updateEnemies();
    updateForestFires();
    updateDryGrass();
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