// Store placed campfires as a Map: key = "x,y", value = {lit: boolean}
const placedCampfires = new Map();

// Draw campfires on the map
function drawCampfires(offsetX, offsetY, startX, startY, tilesX, tilesY) {
    for (let [key, campfire] of placedCampfires.entries()) {
        let [fx, fy] = key.split(',').map(Number);
        // Only draw if in visible area
        if (
            fx >= startX && fx < startX + tilesX &&
            fy >= startY && fy < startY + tilesY
        ) {
            let dx = fx - startX;
            let dy = fy - startY;
            let px = dx * pixelSize + offsetX + pixelSize / 2;
            let py = dy * pixelSize + offsetY + pixelSize / 2;
            // Draw pile of wood (brown circle)
            ctx.beginPath();
            ctx.arc(px, py, pixelSize * 0.4, 0, 2 * Math.PI);
            ctx.fillStyle = "#8B5A2B";
            ctx.fill();
            // If lit, draw fire
            if (campfire.lit) {
                ctx.beginPath();
                ctx.arc(px, py, pixelSize * 0.2, 0, 2 * Math.PI);
                ctx.fillStyle = "#ff9933";
                ctx.fill();
                ctx.beginPath();
                ctx.arc(px, py, pixelSize * 0.12, 0, 2 * Math.PI);
                ctx.fillStyle = "#ff3300";
                ctx.fill();
            }
        }
    }
}

// Helper to check if a tile is adjacent to a given type
function isNearType(x, y, type) {
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            if (dx === 0 && dy === 0) continue;
            if (getTileType(x + dx, y + dy) === type) {
                return true;
            }
        }
    }
    return false;
}

// Helper to check if all adjacent forest tiles are NOT near water
function forestNotNearWater(x, y) {
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            if (dx === 0 && dy === 0) continue;
            let fx = x + dx, fy = y + dy;
            if (getTileType(fx, fy) === "forest" && isNearType(fx, fy, "water")) {
                return false;
            }
        }
    }
    return true;
}

// Place campfire on click if player has one in inventory
function handleCampfireClick(e) {
    if (typeof message !== "undefined" && message) {
        message = "";
        drawMap();
        return;
    }
    // Get mouse position
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const tilesX = Math.ceil(canvas.width / pixelSize) + 2;
    const tilesY = Math.ceil(canvas.height / pixelSize) + 2;
    const startX = player.x - Math.floor(tilesX / 2);
    const startY = player.y - Math.floor(tilesY / 2);
    const offsetX = Math.floor(canvas.width / 2 - (player.x - startX) * pixelSize - pixelSize / 2);
    const offsetY = Math.floor(canvas.height / 2 - (player.y - startY) * pixelSize - pixelSize / 2);

    const tx = Math.floor((mx - offsetX) / pixelSize);
    const ty = Math.floor((my - offsetY) / pixelSize);
    const worldX = startX + tx;
    const worldY = startY + ty;
    const tileType = getTileType(worldX, worldY);
    const campfireKey = `${worldX},${worldY}`;

    // If clicking on an existing campfire, try to light it if adjacent to player
    if (placedCampfires.has(campfireKey)) {
        // Only allow lighting if adjacent to player
        if (Math.abs(worldX - player.x) <= 1 && Math.abs(worldY - player.y) <= 1) {
            let campfire = placedCampfires.get(campfireKey);
            if (!campfire.lit) {
                // Determine success chance
                let chance = 0;
                if (isNearType(worldX, worldY, "water")) {
                    chance = 0.01;
                } else if (tileType === "grass") {
                    chance = 0.10;
                } else if (isNearType(worldX, worldY, "mountain")) {
                    chance = 0.15;
                }
                // Forest logic
                if (
                    (tileType === "forest" || isNearType(worldX, worldY, "forest")) &&
                    forestNotNearWater(worldX, worldY)
                ) {
                    chance = Math.max(chance, 0.5);
                }
                if (Math.random() < chance) {
                    campfire.lit = true;
                    message = "You carefully arrange some tinder and strike a spark. The campfire bursts into warm, comforting flames.";
                } else {
                    message = "You try to light the campfire, but it refuses to catch. Maybe the conditions aren't right?";
                }
                drawMap();
            } else {
                message = "The campfire is already burning brightly.";
                drawMap();
            }
        }
        return;
    }

    // Only allow placement on grass or forest, not on player or another campfire
    if (
        countInInventory("campfire") > 0 &&
        (tileType === "grass" || tileType === "forest") &&
        !(worldX === player.x && worldY === player.y) &&
        !placedCampfires.has(campfireKey)
    ) {
        placedCampfires.set(campfireKey, { lit: false });
        // Remove one campfire from inventory
        let idx = player.inventory.indexOf("campfire");
        if (idx !== -1) player.inventory.splice(idx, 1);
        message = "You build a campfire. For now, it's just a pile of wood. Maybe you can light it?";
        drawMap();
    }
}

// Crafting logic: press "C" to craft a campfire with 3 sticks
window.addEventListener('keydown', (e) => {
    // Only handle crafting if NO message is showing
    if (typeof message !== "undefined" && message) return;
    if (e.key === "c" || e.key === "C") {
        if (typeof countInInventory === "function" && countInInventory("stick") >= 3) {
            removeFromInventory("stick", 3);
            player.inventory.push("campfire");
            message = "You carefully arrange three sticks and craft a campfire. This will help you survive the cold nights.";
            drawMap();
        } else {
            message = "You need at least 3 sticks to craft a campfire.";
            drawMap();
        }
    }
});

// Attach the handler in your main script (index.html or main.js):
// canvas.addEventListener('mousedown', handleCampfireClick);