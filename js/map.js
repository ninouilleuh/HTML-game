let needsRedraw = true;

function drawMap() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Increase render distance: add more tiles to each side
    const extraTiles = 3; // Increase this for even more distance
    const tilesX = Math.ceil(canvas.width / pixelSize);
    const tilesY = Math.ceil(canvas.height / pixelSize);
    const radiusX = Math.ceil(tilesX / 2);
    const radiusY = Math.ceil(tilesY / 2);

    const startX = player.x - Math.floor(tilesX / 2);
    const startY = player.y - Math.floor(tilesY / 2);

    const offsetX = Math.floor(canvas.width / 2 - (player.x - startX) * pixelSize - pixelSize / 2);
    const offsetY = Math.floor(canvas.height / 2 - (player.y - startY) * pixelSize - pixelSize / 2);
    
    // 1. Draw terrain
    for (let dx = 0; dx < tilesX; dx++) {
        for (let dy = 0; dy < tilesY; dy++) {
            const worldX = wrapX(startX + dx);
            const worldY = wrapY(startY + dy);
            const tileType = getTileType(worldX, worldY);
            ctx.fillStyle = tileColors[tileType];
            ctx.fillRect(dx * pixelSize + offsetX, dy * pixelSize + offsetY, pixelSize, pixelSize);

            // Tropical biome tint
            const biome = getBiome(worldX, worldY);
            if (biome === "tropical") {
                ctx.save();
                ctx.globalAlpha = 0.18; // subtle overlay
                ctx.fillStyle = "#1ecb3a"; // tropical green
                ctx.fillRect(dx * pixelSize + offsetX, dy * pixelSize + offsetY, pixelSize, pixelSize);
                ctx.restore();
            }
            // Subtropical biome tint - NEW
            if (biome === "subtropical") {
                ctx.save();
                ctx.globalAlpha = 0.18;
                ctx.fillStyle = "#e2c275"; // sandy yellow for desert belt
                ctx.fillRect(dx * pixelSize + offsetX, dy * pixelSize + offsetY, pixelSize, pixelSize);
                ctx.restore();
            }
            // Temperate biome tint - NEW
            if (biome === "temperate") {
                ctx.save();
                ctx.globalAlpha = 0.18;
                ctx.fillStyle = "#6ecb77"; // soft green for temperate
                ctx.fillRect(dx * pixelSize + offsetX, dy * pixelSize + offsetY, pixelSize, pixelSize);
                ctx.restore();
            }
            // Subpolar biome tint - NEW
            if (biome === "subpolar") {
                ctx.save();
                ctx.globalAlpha = 0.18;
                ctx.fillStyle = "#7bb2c7"; // cold blue-green for taiga/steppe
                ctx.fillRect(dx * pixelSize + offsetX, dy * pixelSize + offsetY, pixelSize, pixelSize);
                ctx.restore();
            }
            // Polar biome tint - NEW
            if (biome === "polar") {
                ctx.save();
                ctx.globalAlpha = 0.18;
                ctx.fillStyle = "#e0f7fa"; // icy blue for polar
                ctx.fillRect(dx * pixelSize + offsetX, dy * pixelSize + offsetY, pixelSize, pixelSize);
                ctx.restore();
            }
        }
    }

    // 2. Draw placed campfires
    if (typeof drawCampfires === "function") {
        drawCampfires(offsetX, offsetY, startX, startY, tilesX, tilesY);
    }

    // 3. Draw enemies
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

    // --- UI LAYOUT FIX ---
    if (typeof drawTopLeftDebugOverlay === "function") {
        drawTopLeftDebugOverlay();
    }

    // Top right: hour, temp, day/season, humidity
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
    // Wind Direction - NEW
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

    if (typeof drawRainOverlay === "function") {
    drawRainOverlay();
}

    // Message box (centered, always on top)
    if (typeof drawMessage === "function") {
        drawMessage();
    }

    // Remove old UI block at top left (was overlapping)

    if (isDay()) {
        timeOfDay += timeSpeedDay;
        window._absoluteTimeOfDay += timeSpeedDay;
    } else {
        timeOfDay += timeSpeedNight;
        window._absoluteTimeOfDay += timeSpeedNight;
    }
    if (timeOfDay > 1) timeOfDay -= 1;

   
}

// Call this whenever something changes that should trigger a redraw:
function requestRedraw() {
    needsRedraw = true;
}

// Main game loop:
function gameLoop() {
    // ...update logic...

    if (needsRedraw) {
        drawMap();
        needsRedraw = false;
    }

    // ...other logic...
    requestAnimationFrame(gameLoop);
}

// Example triggers:
function onPlayerMove() {
    // ...move player...
    requestRedraw();
}

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

// Call requestRedraw() in any place where the map should update visually.

if (typeof drawTopRightInfoBox === "function") {
    drawTopRightInfoBox();
}


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

