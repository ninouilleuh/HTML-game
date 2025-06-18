// ORGANIZATION RULES:

// YES:

//Map rendering logic:
//Functions that draw the map, tiles, overlays, and UI elements related to the map.
//Redraw/requestRedraw logic:
//Functions and flags that determine when the map needs to be redrawn.
//Viewport calculations:
//Code that determines which tiles are visible and how to center the player.
//Overlay drawing:
//Functions for drawing overlays on the map (e.g., rain, clouds, debug info).
//Map-related event handlers:
//Functions that respond to map changes (e.g., onPlayerMove, onSeasonChange).
//Map-specific state:
//E.g., needsRedraw flag.

// NO:

//Game logic unrelated to map rendering:
//E.g., enemy AI, player movement, inventory management, campfire logic, etc.
//General-purpose utility functions:
//E.g., wrapX, getBiome, getTileType (unless only used for rendering).
//Constants/configuration:
//E.g., tile colors, season names, etc. (should be in constants.js).
//Simulation or world generation logic:
//E.g., precipitation simulation, river generation, erosion, etc.
//Direct game state management:
//E.g., advancing seasons, updating player state, etc. (unless it directly affects rendering).
//Input handling:
//Keyboard, mouse, or touch event listeners (should be in main.js or UI modules).

////                    DOES NOT GO HERE!                    ////

//Enemy update logic, campfire/fire logic, player movement logic
//Utility functions not specific to rendering (should be in utils.js)
//Game constants/configuration (should be in constants.js)
//Simulation logic (e.g., updatePrecipitation should be called elsewhere, not as part of rendering)
//Input event listeners


let needsRedraw = true; //Flag to indicate if the map needs redrawing
// Main function to draw the map and all overlays UI
function drawMap() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); //Clear the canvas

    // Calculate how many tiles to draw based on canvas size and pixel size
    const extraTiles = 3; // Extra tiles for render distance
    const tilesX = Math.ceil(canvas.width / pixelSize);
    const tilesY = Math.ceil(canvas.height / pixelSize);
    const radiusX = Math.ceil(tilesX / 2);
    const radiusY = Math.ceil(tilesY / 2);

    // Calculate the top-left tile to start drawing from, centered on player
    const startX = player.x - Math.floor(tilesX / 2);
    const startY = player.y - Math.floor(tilesY / 2);

    // Calculate pixel offsets to center the player on screen
    const offsetX = Math.floor(canvas.width / 2 - (player.x - startX) * pixelSize - pixelSize / 2);
    const offsetY = Math.floor(canvas.height / 2 - (player.y - startY) * pixelSize - pixelSize / 2);
    
    // 1. Draw terrain tiles
    for (let dx = 0; dx < tilesX; dx++) {
        for (let dy = 0; dy < tilesY; dy++) {
            const worldX = wrapX(startX + dx); // World X coordinate
            const worldY = wrapY(startY + dy); // World Y coordinate
            const tileType = getTileType(worldX, worldY); // Get tile type (e.g., grass, water)
            ctx.fillStyle = tileColors[tileType]; // Set color for this tile type
            ctx.fillRect(dx * pixelSize + offsetX, dy * pixelSize + offsetY, pixelSize, pixelSize); // Draw tile

            // Draw biome tints as overlays for visual distinction
            const biome = getBiome(worldX, worldY);
            if (biome === "tropical") {
                ctx.save();
                ctx.globalAlpha = 0.18; // subtle overlay
                ctx.fillStyle = "#1ecb3a"; // tropical green
                ctx.fillRect(dx * pixelSize + offsetX, dy * pixelSize + offsetY, pixelSize, pixelSize);
                ctx.restore();
            }
            if (biome === "subtropical") {
                ctx.save();
                ctx.globalAlpha = 0.18;
                ctx.fillStyle = "#e2c275"; // sandy yellow for desert belt
                ctx.fillRect(dx * pixelSize + offsetX, dy * pixelSize + offsetY, pixelSize, pixelSize);
                ctx.restore();
            }
            if (biome === "temperate") {
                ctx.save();
                ctx.globalAlpha = 0.18;
                ctx.fillStyle = "#6ecb77"; // soft green for temperate
                ctx.fillRect(dx * pixelSize + offsetX, dy * pixelSize + offsetY, pixelSize, pixelSize);
                ctx.restore();
            }
            if (biome === "subpolar") {
                ctx.save();
                ctx.globalAlpha = 0.18;
                ctx.fillStyle = "#7bb2c7"; // cold blue-green for taiga/steppe
                ctx.fillRect(dx * pixelSize + offsetX, dy * pixelSize + offsetY, pixelSize, pixelSize);
                ctx.restore();
            }
            if (biome === "polar") {
                ctx.save();
                ctx.globalAlpha = 0.18;
                ctx.fillStyle = "#e0f7fa"; // icy blue for polar
                ctx.fillRect(dx * pixelSize + offsetX, dy * pixelSize + offsetY, pixelSize, pixelSize);
                ctx.restore();
            }
        }
    }

        // 2. Draw placed campfires (if function exists)
    if (typeof drawCampfires === "function") {
        drawCampfires(offsetX, offsetY, startX, startY, tilesX, tilesY);
    }

    // 3. Draw enemies (if function exists)
    if (typeof drawEnemies === "function") {
        drawEnemies(offsetX, offsetY, startX, startY, tilesX, tilesY);
    }

    // 4. Draw player at center of screen
    ctx.beginPath();
    ctx.arc(
        Math.floor(canvas.width / 2),
        Math.floor(canvas.height / 2),
        pixelSize / 2,
        0,
        2 * Math.PI
    );
    ctx.fillStyle = player.color;
    ctx.fill();

    // 5. Draw darkness overlay and campfire light
    if (typeof drawDayNightOverlayWithCampfireLight === "function") {
        drawDayNightOverlayWithCampfireLight(offsetX, offsetY, startX, startY, tilesX, tilesY);
    } else if (typeof drawDayNightOverlay === "function") {
        drawDayNightOverlay();
    }

    // Draw debug overlay (if function exists)
    if (typeof drawTopLeftDebugOverlay === "function") {
        drawTopLeftDebugOverlay();
    }

    // Draw top right info box (time, temp, humidity, wind, season)
    ctx.save();
    const boxWidth = 220;
    const boxHeight = 90; // Increased height for humidity line
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(canvas.width - boxWidth - 10, 10, boxWidth, boxHeight);
    ctx.fillStyle = "#fff";
    ctx.font = "16px monospace";
    let y = 30;
    let x = canvas.width - boxWidth;
    // Hour
    if (typeof timeOfDay !== "undefined") {
        let hour = Math.floor((timeOfDay * 24)) % 24;
        let minute = Math.floor((timeOfDay * 24 * 60)) % 60;
        let timeStr = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
        ctx.fillText(`Time: ${timeStr}`, x + 8, y);
        y += 20;
    }
    // Temp
    if (typeof getTemperature === "function") {
        const temp = getTemperature(player.x, player.y);
        ctx.fillText(`Temp: ${temp}°C`, x + 8, y);
        y += 20;
    }
    // Humidity
    if (typeof getHumidity === "function") {
        const humidity = getCachedHumidity(player.x, player.y);
        ctx.fillText(`Humidity: ${humidity}%`, x + 8, y);
        y += 20;
    }
    // Wind Direction
    if (typeof getPrevailingWindDirection === "function") {
        const windDir = getPrevailingWindDirection(player.y);
        let windStr = "";
        switch (windDir) {
            case "west_to_east": windStr = " West → East"; break;
            case "east_to_west": windStr = " East ← West"; break;
            default: windStr = windDir;
        }
        ctx.fillText(`Wind: ${windStr}`, x + 8, y);
        y += 20;
    }
    // Season/Day
    if (typeof currentSeason !== "undefined") {
        ctx.fillText(`Season: ${currentSeason} (${seasonDay + 1}/${DAYS_PER_SEASON})`, x + 8, y);
    }
    ctx.restore();

    // Update precipitation state for all visible tiles
    for (let dx = -radiusX; dx <= radiusX; dx++) {
        for (let dy = -radiusY; dy <= radiusY; dy++) {
            const worldX = wrapX(player.x + dx);
            const worldY = wrapY(player.y + dy);
            const key = `${worldX},${worldY}`;
            if (!tileCache[key]) tileCache[key] = { x: worldX, y: worldY, frame: currentCacheFrame };
            // Set temperature and humidity for this frame
            tileCache[key].temperature = getCachedTemperature(worldX, worldY);
            tileCache[key].humidity = getCachedHumidity(worldX, worldY);
            updatePrecipitation(tileCache[key]);
        }
    }
     // Draw rain and cloud overlays
    if (typeof drawRainOverlay === "function") {
    drawRainOverlay();
}

   // Draw message box (if function exists)
    if (typeof drawMessage === "function") {
        drawMessage();
    }

 // Update time of day
    if (isDay()) {
        timeOfDay += timeSpeedDay;
        window._absoluteTimeOfDay += timeSpeedDay;
    } else {
        timeOfDay += timeSpeedNight;
        window._absoluteTimeOfDay += timeSpeedNight;
    }
    if (timeOfDay > 1) timeOfDay -= 1;

   
}

// Call this whenever something changes that should trigger a redraw
function requestRedraw() {
    needsRedraw = true;
}

// Main game loop: redraws map if needed, then schedules next frame // REMOVE THIS ?
function gameLoop() {
    // ...update logic...
    
    if (needsRedraw) {
        drawMap();
        needsRedraw = false;
    }

    // ...other logic...
    requestAnimationFrame(gameLoop);
}

// Example: call when player moves to trigger redraw // REMOVE THIS ?
function onPlayerMove() {
    // ...move player...
    requestRedraw();
}
// Example: call when season changes to trigger redraw
function onSeasonChange() {
    // Advance to the next season
    const seasons = ["spring", "summer", "autumn", "winter"];
    let currentIndex = seasons.indexOf(currentSeason);
    if (currentIndex === -1) currentIndex = 0;
    currentSeason = seasons[(currentIndex + 1) % seasons.length];
    seasonDay = 0; // Reset day counter for new season
    // Optionally, update any season-dependent variables here
    requestRedraw();
}


// Optionally draw a top right info box (if function exists)
if (typeof drawTopRightInfoBox === "function") {
    drawTopRightInfoBox();
}

// Draw rain and cloud overlays on top of terrain
function drawRainOverlay() {
    const tilesX = Math.ceil(canvas.width / pixelSize);
    const tilesY = Math.ceil(canvas.height / pixelSize);
    const radiusX = Math.ceil(tilesX / 2);
    const radiusY = Math.ceil(tilesY / 2);

    for (let dx = -radiusX; dx <= radiusX; dx++) {
        for (let dy = -radiusY; dy <= radiusY; dy++) {
            const worldX = wrapX(player.x + dx);
            const worldY = wrapY(player.y + dy);
            const key = `${worldX},${worldY}`;
            const tile = tileCache[key];
            if (tile && tile.rain_age > 0) {
                const screenX = Math.floor(canvas.width / 2) + dx * pixelSize;
                const screenY = Math.floor(canvas.height / 2) + dy * pixelSize;
                ctx.save();
                ctx.strokeStyle = "rgba(80,180,255,0.18)";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(screenX + pixelSize * 0.3, screenY + pixelSize * 0.2);
                ctx.lineTo(screenX + pixelSize * 0.7, screenY + pixelSize * 0.8);
                ctx.stroke();
                ctx.restore();
            }
            // Optionally, draw snow if you add snow_age
        }
    }

    // Draw clouds as faint gray circles
    for (let dx = -radiusX; dx <= radiusX; dx++) {
        for (let dy = -radiusY; dy <= radiusY; dy++) {
            const worldX = wrapX(player.x + dx);
            const worldY = wrapY(player.y + dy);
            const key = `${worldX},${worldY}`;
            const tile = tileCache[key];
            if (tile && tile.cloud) {
                const screenX = Math.floor(canvas.width / 2) + dx * pixelSize;
                const screenY = Math.floor(canvas.height / 2) + dy * pixelSize;
                ctx.save();
                ctx.globalAlpha = 0.18;
                ctx.fillStyle = "#bbb";
                ctx.beginPath();
                ctx.arc(screenX + pixelSize * 0.5, screenY + pixelSize * 0.5, pixelSize * 0.35, 0, 2 * Math.PI);
                ctx.fill();
                ctx.globalAlpha = 1;
                ctx.restore();
            }
        }
    }
}

