function getForestDarknessBonus() {
    if (typeof getTileType !== "function") return 0;
    if (getTileType(player.x, player.y) !== "forest") return 0;
    let forestCount = 0;
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            if (dx === 0 && dy === 0) continue;
            if (getTileType(player.x + dx, player.y + dy) === "forest") {
                forestCount++;
            }
        }
    }
    // Each forest tile adds up to 0.5/8 extra darkness, max +0.5
    let bonus = 0.5 * (forestCount / 8);
    return bonus;
}

function drawDayNightOverlay() {
    // Smooth transition: darkness is 0 at noon, 1 at midnight, 0.7 at 6h/18h (dawn/dusk)
    let t = Math.abs(timeOfDay - 0.5) * 2;
    let darkness = 0.5 * (1 - Math.cos(Math.PI * t));
    darkness = darkness * 0.7 + (t > 0.5 ? (t - 0.5) * 0.6 : 0);
    darkness = Math.min(1, Math.max(0, darkness));

    // Progressive darkness: the more surrounding tiles are forest, the darker it is
    darkness = Math.min(1, darkness + getForestDarknessBonus());

    ctx.fillStyle = `rgba(0,0,0,${darkness})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// Draw day/night overlay, but reveal tiles lit by campfires
function drawDayNightOverlayWithCampfireLight(offsetX, offsetY, startX, startY, tilesX, tilesY) {
    let t = Math.abs(timeOfDay - 0.5) * 2;
    let darkness = 0.5 * (1 - Math.cos(Math.PI * t));
    darkness = darkness * 0.7 + (t > 0.5 ? (t - 0.5) * 0.6 : 0);
    darkness = Math.min(1, Math.max(0, darkness));

    // Progressive darkness: the more surrounding tiles are forest, the darker it is
    darkness = Math.min(1, darkness + getForestDarknessBonus());

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
}

// --- Patch lighting to include bonfire light radius ---
if (typeof drawDayNightOverlayWithCampfireLight === "function") {
    const _originalDrawDayNightOverlayWithCampfireLight = drawDayNightOverlayWithCampfireLight;
    drawDayNightOverlayWithCampfireLight = function(offsetX, offsetY, startX, startY, tilesX, tilesY) {
        // 1. Prepare a per-tile alpha map for darkness
        let t = Math.abs(timeOfDay - 0.5) * 2;
        let darkness = 0.5 * (1 - Math.cos(Math.PI * t));
        darkness = darkness * 0.7 + (t > 0.5 ? (t - 0.5) * 0.6 : 0);
        darkness = Math.min(1, Math.max(0, darkness));

        // Use progressive forest darkness bonus
        darkness = Math.min(1, darkness + getForestDarknessBonus());

        if (darkness < 0.01) {
            drawDayNightOverlay();
            return;
        }

        // --- Combine campfire and bonfire light ---
        const campfireRadius = 6;
        const bonfireRadius = 12;
        let tileAlpha = [];
        for (let dx = 0; dx < tilesX; dx++) {
            tileAlpha[dx] = [];
            for (let dy = 0; dy < tilesY; dy++) {
                tileAlpha[dx][dy] = darkness;
            }
        }

        // Campfire light
        for (let [key, campfire] of placedCampfires.entries()) {
            if (!campfire.lit) continue;
            let [fx, fy] = key.split(',').map(Number);
            for (let dx = -campfireRadius; dx <= campfireRadius; dx++) {
                for (let dy = -campfireRadius; dy <= campfireRadius; dy++) {
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist > campfireRadius) continue;
                    const tx = fx + dx;
                    const ty = wrapY(fy + dy);
                    if (!hasLineOfSight(fx, fy, tx, ty)) continue;
                    let sx = tx - startX;
                    let sy = isScreenYVisible(ty, startY, tilesY);
                    if (
                        sx >= 0 && sx < tilesX &&
                        sy !== -1
                    ) {
                        let localAlpha = darkness * (dist / campfireRadius);
                        tileAlpha[sx][sy] = Math.min(tileAlpha[sx][sy], localAlpha);
                    }
                }
            }
        }

        // Bonfire light (bigger radius)
        for (let [key, bonfire] of placedBonfires.entries()) {
            if (!bonfire.lit) continue;
            let [fx, fy] = key.split(',').map(Number);
            for (let dx = -bonfireRadius; dx <= bonfireRadius; dx++) {
                for (let dy = -bonfireRadius; dy <= bonfireRadius; dy++) {
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist > bonfireRadius) continue;
                    const tx = fx + dx;
                    const ty = wrapY(fy + dy);
                    if (!hasLineOfSight(fx, fy, tx, ty)) continue;
                    let sx = tx - startX;
                    let sy = isScreenYVisible(ty, startY, tilesY);
                    if (
                        sx >= 0 && sx < tilesX &&
                        sy !== -1
                    ) {
                        let localAlpha = darkness * (dist / bonfireRadius);
                        tileAlpha[sx][sy] = Math.min(tileAlpha[sx][sy], localAlpha);
                    }
                }
            }
        }

        // Draw darkness tile by tile, using the computed alpha
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
    };
}

// Helper for world-wrapped difference
function worldYDelta(a, b) {
    // Returns the difference from b to a, wrapped to WORLD_Y_SIZE
    let d = a - b;
    if (d < 0) d += WORLD_Y_SIZE;
    if (d >= WORLD_Y_SIZE) d -= WORLD_Y_SIZE;
    return d;
}

function isScreenYVisible(ty, startY, tilesY) {
    // Returns the screen y (0..tilesY-1) if visible, else -1
    let rel = (ty - startY + WORLD_Y_SIZE) % WORLD_Y_SIZE;
    if (rel >= 0 && rel < tilesY) return rel;
    return -1;
}