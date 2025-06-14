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
canvas.addEventListener('mousedown', handleCampfireClick);

// Handle keyboard input for movement and crafting
window.addEventListener('keydown', (e) => {
    // Dismiss message with Space or Enter
    if (typeof message !== "undefined" && message && (e.key === " " || e.key === "Enter" || e.key === "Spacebar")) {
        message = "";
        drawMap();
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


// Game loop: day/night and redraw
function dayNightLoop() {
    if (isDay()) {
        timeOfDay += timeSpeedDay;
    } else {
        timeOfDay += timeSpeedNight;
    }
    if (timeOfDay > 1) timeOfDay -= 1;
    updateEnemies();
    drawMap();
    requestAnimationFrame(dayNightLoop);
}

// Initial draw and start loop
drawMap();
dayNightLoop();