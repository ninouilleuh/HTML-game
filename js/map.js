function drawMap() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const tilesX = Math.ceil(canvas.width / pixelSize) + 2;
    const tilesY = Math.ceil(canvas.height / pixelSize) + 2;

    const startX = player.x - Math.floor(tilesX / 2);
    const startY = player.y - Math.floor(tilesY / 2);

    const offsetX = Math.floor(canvas.width / 2 - (player.x - startX) * pixelSize - pixelSize / 2);
    const offsetY = Math.floor(canvas.height / 2 - (player.y - startY) * pixelSize - pixelSize / 2);

    // 1. Draw terrain
    for (let dx = 0; dx < tilesX; dx++) {
        for (let dy = 0; dy < tilesY; dy++) {
            const worldX = startX + dx;
            const worldY = startY + dy;
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

    // 6. Draw UI elements (always on top)
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(10, 10, 140, 30);
    ctx.fillStyle = "#fff";
    ctx.font = "16px monospace";
    const tileType = getTileType(player.x, player.y);
    ctx.fillText(`Tile: ${tileType}`, 18, 30);

    if (typeof drawInventory === "function") {
        drawInventory();
    }
    if (typeof drawMessage === "function") {
        drawMessage();
    }
}