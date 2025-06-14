function drawDayNightOverlay() {
    // Smooth transition: darkness is 0 at noon, 1 at midnight, 0.7 at 6h/18h (dawn/dusk)
    let t = Math.abs(timeOfDay - 0.5) * 2;
    let darkness = 0.5 * (1 - Math.cos(Math.PI * t));
    darkness = darkness * 0.7 + (t > 0.5 ? (t - 0.5) * 0.6 : 0);
    darkness = Math.min(1, Math.max(0, darkness));

    ctx.fillStyle = `rgba(0,0,0,${darkness})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw clock (always visible)
    ctx.font = "16px monospace";
    ctx.fillStyle = "#FFD700";
    let hour = Math.floor((timeOfDay * 24)) % 24;
    let minute = Math.floor((timeOfDay * 24 * 60)) % 60;
    let timeStr = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
    ctx.fillText(`Time: ${timeStr}`, canvas.width - 110, 30);
}

// Draw day/night overlay, but reveal tiles lit by campfires
function drawDayNightOverlayWithCampfireLight(offsetX, offsetY, startX, startY, tilesX, tilesY) {
    let t = Math.abs(timeOfDay - 0.5) * 2;
    let darkness = 0.5 * (1 - Math.cos(Math.PI * t));
    darkness = darkness * 0.7 + (t > 0.5 ? (t - 0.5) * 0.6 : 0);
    darkness = Math.min(1, Math.max(0, darkness));

    if (darkness < 0.01) {
        drawDayNightOverlay();
        return;
    }

    // 1. Prepare a per-tile alpha map for darkness
    const lightRadius = 6; // in tiles
    let tileAlpha = [];
    for (let dx = 0; dx < tilesX; dx++) {
        tileAlpha[dx] = [];
        for (let dy = 0; dy < tilesY; dy++) {
            tileAlpha[dx][dy] = darkness; // default: full darkness
        }
    }

    // 2. For each lit campfire, reduce darkness in a radius (with line of sight)
    for (let [key, campfire] of placedCampfires.entries()) {
        if (!campfire.lit) continue;
        let [fx, fy] = key.split(',').map(Number);
        for (let dx = -lightRadius; dx <= lightRadius; dx++) {
            for (let dy = -lightRadius; dy <= lightRadius; dy++) {
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > lightRadius) continue;
                const tx = fx + dx;
                const ty = fy + dy;
                // Only reveal if line of sight from campfire to tile
                if (!hasLineOfSight(fx, fy, tx, ty)) continue;
                // Only reveal if in visible area
                let sx = tx - startX;
                let sy = ty - startY;
                if (
                    sx >= 0 && sx < tilesX &&
                    sy >= 0 && sy < tilesY
                ) {
                    // At center: no darkness. At edge: full darkness.
                    let localAlpha = darkness * (dist / lightRadius);
                    tileAlpha[sx][sy] = Math.min(tileAlpha[sx][sy], localAlpha);
                }
            }
        }
    }

    // 3. Draw darkness tile by tile, using the computed alpha
    for (let dx = 0; dx < tilesX; dx++) {
        for (let dy = 0; dy < tilesY; dy++) {
            let alpha = tileAlpha[dx][dy];
            if (alpha > 0.01) {
                ctx.save();
                ctx.globalAlpha = alpha;
                ctx.fillStyle = "#000";
                ctx.fillRect(dx * pixelSize + offsetX, dy * pixelSize + offsetY, pixelSize, pixelSize);
                ctx.globalAlpha = 1;
                ctx.restore();
            }
        }
    }

    // 4. Draw clock (always visible)
    ctx.font = "16px monospace";
    ctx.fillStyle = "#FFD700";
    let hour = Math.floor((timeOfDay * 24)) % 24;
    let minute = Math.floor((timeOfDay * 24 * 60)) % 60;
    let timeStr = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
    ctx.fillText(`Time: ${timeStr}`, canvas.width - 110, 30);
}