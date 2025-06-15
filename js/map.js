function drawMap() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Increase render distance: add more tiles to each side
    const extraTiles = 10; // Increase this for even more distance
    const tilesX = Math.ceil(canvas.width / pixelSize) + 2 + extraTiles * 2;
    const tilesY = Math.ceil(canvas.height / pixelSize) + 2 + extraTiles * 2;

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

    // Top left: tile type and inventory
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(10, 10, 320, 60);
    ctx.fillStyle = "#fff";
    ctx.font = "16px monospace";
    const tileType = getTileType(player.x, player.y);
    ctx.fillText(`Tile: ${tileType}`, 18, 30);

    if (typeof drawInventory === "function") {
        drawInventory();
    }
    ctx.restore();

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
        const humidity = getHumidity(player.x, player.y);
        ctx.fillText(`Humidity: ${humidity}%`, x + 8, y);
        y += 20;
    }
    // Season/Day
    if (typeof currentSeason !== "undefined") {
        ctx.fillText(`Season: ${currentSeason} (${seasonDay + 1}/${DAYS_PER_SEASON})`, x + 8, y);
    }
    ctx.restore();

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