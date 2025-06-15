
// Wrap x into [-5000, 5000]
function wrapX(x) {
    let wrapped = ((x - WORLD_X_MIN) % WORLD_X_SIZE + WORLD_X_SIZE) % WORLD_X_SIZE + WORLD_X_MIN;
    return wrapped;
}

// Store placed campfires as a Map: key = "x,y", value = {lit: boolean}
const placedCampfires = new Map();

// --- Add a burnt land tile type ---
if (!tileColors.burnt) tileColors.burnt = "#444"; // dark gray for burnt land

// --- Add a fresh grass tile color if not present ---
if (!tileColors.fresh) tileColors.fresh = "#6fdc6f"; // bright green for fresh grass

// --- Track burnt and fresh tiles with timers ---
const burntTiles = new Map(); // key: "x,y", value: { timeLeft: seconds, stage: "burnt"|"fresh" }

// Track tiles that must be forced to grass after fresh stage
const forcedGrassTiles = new Set();

// --- Add bonfire tile color if not present ---
if (!tileColors.bonfire) tileColors.bonfire = "#ffb347"; // orange for bonfire

// Store placed bonfires as a Map: key = "x,y", value = {lit: boolean}
const placedBonfires = new Map();

// Helper: get wrapped difference for drawing position
function getWrappedDelta(coord, start, size, min, max) {
    let worldSize = max - min + 1;
    let delta = coord - start;
    if (delta < 0) delta += worldSize;
    if (delta >= size) delta -= worldSize;
    return delta;
}

// Helper: check if a coordinate is visible in the current window (with wrapping)
function isCoordVisible(coord, start, size, min, max) {
    let worldSize = max - min + 1;
    let rel = (coord - start + worldSize) % worldSize;
    return rel >= 0 && rel < size;
}

// Draw campfires on the map
function drawCampfires(offsetX, offsetY, startX, startY, tilesX, tilesY) {
    for (let [key, campfire] of placedCampfires.entries()) {
        if (burntTiles.has(key)) continue;
        let [fx, fy] = key.split(',').map(Number);
        fx = wrapX(fx);
        fy = wrapY(fy);

        if (
            isCoordVisible(fx, startX, tilesX, WORLD_X_MIN, WORLD_X_MAX) &&
            isCoordVisible(fy, startY, tilesY, WORLD_Y_MIN, WORLD_Y_MAX)
        ) {
            let dx = getWrappedDelta(fx, startX, tilesX, WORLD_X_MIN, WORLD_X_MAX);
            let dy = getWrappedDelta(fy, startY, tilesY, WORLD_Y_MIN, WORLD_Y_MAX);
            let px = dx * pixelSize + offsetX + pixelSize / 2;
            let py = dy * pixelSize + offsetY + pixelSize / 2;
            ctx.beginPath();
            ctx.arc(px, py, pixelSize * 0.4, 0, 2 * Math.PI);
            ctx.fillStyle = campfire.isForestFire ? "#550000" : "#8B5A2B";
            ctx.fill();
            if (campfire.lit) {
                ctx.beginPath();
                ctx.arc(px, py, pixelSize * 0.2, 0, 2 * Math.PI);
                ctx.fillStyle = campfire.isForestFire ? "#ff3300" : "#ff9933";
                ctx.fill();
                ctx.beginPath();
                ctx.arc(px, py, pixelSize * 0.12, 0, 2 * Math.PI);
                ctx.fillStyle = campfire.isForestFire ? "#ff6600" : "#ff3300";
                ctx.fill();
            }
        }
    }
}

// Draw bonfires on the map (bigger and brighter than campfire)
function drawBonfires(offsetX, offsetY, startX, startY, tilesX, tilesY) {
    for (let [key, bonfire] of placedBonfires.entries()) {
        if (burntTiles.has(key)) continue;
        let [fx, fy] = key.split(',').map(Number);
        fx = wrapX(fx);
        fy = wrapY(fy);

        if (
            isCoordVisible(fx, startX, tilesX, WORLD_X_MIN, WORLD_X_MAX) &&
            isCoordVisible(fy, startY, tilesY, WORLD_Y_MIN, WORLD_Y_MAX)
        ) {
            let dx = getWrappedDelta(fx, startX, tilesX, WORLD_X_MIN, WORLD_X_MAX);
            let dy = getWrappedDelta(fy, startY, tilesY, WORLD_Y_MIN, WORLD_Y_MAX);
            let px = dx * pixelSize + offsetX + pixelSize / 2;
            let py = dy * pixelSize + offsetY + pixelSize / 2;
            ctx.beginPath();
            ctx.arc(px, py, pixelSize * 0.5, 0, 2 * Math.PI);
            ctx.fillStyle = "#6b3e26";
            ctx.fill();
            if (bonfire.lit) {
                ctx.beginPath();
                ctx.arc(px, py, pixelSize * 0.32, 0, 2 * Math.PI);
                ctx.fillStyle = "#ffb347";
                ctx.fill();
                ctx.beginPath();
                ctx.arc(px, py, pixelSize * 0.22, 0, 2 * Math.PI);
                ctx.fillStyle = "#ff6600";
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
            if (getTileType(wrapX(x + dx), wrapY(y + dy)) === type) {
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

// Helper to count adjacent forest tiles
function countAdjacentForest(x, y) {
    let count = 0;
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            if (dx === 0 && dy === 0) continue;
            if (getTileType(x + dx, y + dy) === "forest" && !burntTiles.has(`${x + dx},${y + dy}`)) {
                count++;
            }
        }
    }
    return count;
}

// Patch getTileType to return burnt, fresh, or forced grass
const _originalGetTileType = getTileType;
function getTileTypePatched(x, y) {
    const key = `${x},${y}`;
    if (burntTiles.has(key)) {
        const info = burntTiles.get(key);
        if (info.stage === "burnt" && info.timeLeft > 0) return "burnt";
        if (info.stage === "fresh" && info.timeLeft > 0) return "fresh";
    }
    if (forcedGrassTiles.has(key)) return "grass";
    return _originalGetTileType(x, y);
}
window.getTileType = getTileTypePatched;

// Place campfire on click if player has one in inventory
function handleCampfireClick(e) {
    if (typeof message !== "undefined" && message) {
        message = "";
        drawMap();
        return true;
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
    const campfireKey = `${wrapX(worldX)},${wrapY(worldY)}`;

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
                    // Try to spread forest fire if next to forest
                    if (isNearType(worldX, worldY, "forest")) {
                        trySpreadForestFire(worldX, worldY);
                    }
                } else {
                    message = "You try to light the campfire, but it refuses to catch. Maybe the conditions aren't right?";
                }
                drawMap();
            } else {
                message = "The campfire is already burning brightly.";
                drawMap();
            }
        }
        return true;
    }

    // Only allow placement if selectedItem is "campfire"
    if (selectedItem !== "campfire") return false;

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
        // After successful placement:
        selectedItem = null;
        return true;
    }

    // If nothing was handled:
    return false;
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

// If a campfire is lit next to a forest, there is a high chance the forest catches fire
function trySpreadForestFire(worldX, worldY) {
    let playerStartedFire = false;
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            if (dx === 0 && dy === 0) continue;
            let fx = worldX + dx;
            let fy = worldY + dy;
            if (getTileType(fx, fy) === "forest") {
                // 70% chance to ignite adjacent forest tile
                if (Math.random() < 0.7) {
                    placedCampfires.set(`${fx},${fy}`, { lit: true, isForestFire: true, burnTime: 180 });
                    playerStartedFire = true;
                }
            }
        }
    }
    if (playerStartedFire) {
        message = "You started a forest fire! The trees crackle and burn. The forest will remember this...";
    }
}

// If a bonfire is lit next to a forest, there is a high chance the forest catches fire
function trySpreadForestFireFromBonfire(worldX, worldY) {
    let playerStartedFire = false;
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            if (dx === 0 && dy === 0) continue;
            let fx = worldX + dx;
            let fy = worldY + dy;
            if (getTileType(fx, fy) === "forest") {
                // 90% chance to ignite adjacent forest tile (bonfire is bigger)
                if (Math.random() < 0.9) {
                    placedCampfires.set(`${fx},${fy}`, { lit: true, isForestFire: true, burnTime: 180 });
                    playerStartedFire = true;
                }
            }
        }
    }
    if (playerStartedFire) {
        message = "You started a forest fire! The flames leap from your bonfire into the woods. The forest will remember this...";
    }
}

// Update burning forest tiles (spread and burn out, then burn to land)
function updateForestFires() {
    let newFires = [];
    for (let [key, campfire] of placedCampfires.entries()) {
        if (campfire.isForestFire) {
            if (campfire.burnTimeStart === undefined) {
                campfire.burnTimeStart = campfire.burnTime;
            }
            campfire.burnTime--;

            let [fx, fy] = key.split(',').map(Number);
            let burnProgress = 1 - (campfire.burnTime / campfire.burnTimeStart);
            let spreadChance = 0.05 + 0.35 * burnProgress;

            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue;
                    let nx = fx + dx, ny = fy + dy;
                    const neighborKey = `${nx},${ny}`;
                    // If a burning forest spreads to a tile with a campfire on forest, destroy the campfire
                    if (
                        placedCampfires.has(neighborKey) &&
                        getTileType(nx, ny) === "forest" &&
                        !placedCampfires.get(neighborKey).isForestFire
                    ) {
                        placedCampfires.delete(neighborKey);
                        if (Math.abs(player.x - nx) <= 2 && Math.abs(player.y - ny) <= 2) {
                            message = "A campfire was destroyed by the spreading forest fire!";
                        }
                    }
                    // If a burning forest spreads to a tile with a bonfire on forest, destroy the bonfire
                    if (
                        placedBonfires.has(neighborKey) &&
                        getTileType(nx, ny) === "forest"
                    ) {
                        placedBonfires.delete(neighborKey);
                        if (Math.abs(player.x - nx) <= 2 && Math.abs(player.y - ny) <= 2) {
                            message = "A bonfire was destroyed by the spreading forest fire!";
                        }
                    }
                    // Spread fire to forest tiles
                    if (getTileType(nx, ny) === "forest" && !placedCampfires.has(neighborKey) && !placedBonfires.has(neighborKey) && !burntTiles.has(neighborKey)) {
                        if (Math.random() < spreadChance) {
                            newFires.push({ x: nx, y: ny });
                        }
                    }
                }
            }
            if (campfire.burnTime <= 0) {
                burntTiles.set(key, { timeLeft: 15 * 60, stage: "burnt" });
                placedCampfires.delete(key);
            }
        }
    }
    for (let fire of newFires) {
        let adj = countAdjacentForest(fire.x, fire.y);
        let burnTime = 20 * 60 + adj * 2 * 60;
        placedCampfires.set(`${fire.x},${fire.y}`, { lit: true, isForestFire: true, burnTime });
    }

    // --- Update burnt/fresh tile timers ---
    for (let [key, info] of burntTiles.entries()) {
        if (info.timeLeft > 0) {
            info.timeLeft -= 1 / 60; // assuming updateForestFires is called every frame at 60fps
            if (info.timeLeft < 0) info.timeLeft = 0;
            // Log time left in mm:ss format
            if (Math.abs(info.timeLeft % 60 - 0) < 0.02) {
                const [bx, by] = key.split(',').map(Number);
                const min = Math.floor(info.timeLeft / 60);
                const sec = Math.floor(info.timeLeft % 60);
                console.log(`${info.stage === "burnt" ? "Burnt" : "Fresh"} tile at (${bx},${by}) will turn to ${info.stage === "burnt" ? "fresh grass" : "regular grass"} in ${min}m ${sec}s`);
            }
        } else if (info.stage === "burnt") {
            // After 15 minutes burnt, become fresh grass for 15 minutes
            info.stage = "fresh";
            info.timeLeft = 15 * 60;
        } else if (info.stage === "fresh") {
            // After 15 minutes fresh, remove from burntTiles (becomes regular grass)
            forcedGrassTiles.add(key);
            burntTiles.delete(key);
        }
    }
}

// --- Patch drawCampfires to also call drawBonfires ---
const _originalDrawCampfires = drawCampfires;
drawCampfires = function(offsetX, offsetY, startX, startY, tilesX, tilesY) {
    _originalDrawCampfires(offsetX, offsetY, startX, startY, tilesX, tilesY);
    drawBonfires(offsetX, offsetY, startX, startY, tilesX, tilesY);
};

// --- Place bonfire on click if player has one in inventory ---
function handleBonfireClick(e) {
    if (typeof message !== "undefined" && message) {
        message = "";
        drawMap();
        return true;
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
    const bonfireKey = `${wrapX(worldX)},${wrapY(worldY)}`;

    // If clicking on an existing bonfire, try to light it if adjacent to player
    if (placedBonfires.has(bonfireKey)) {
        if (Math.abs(worldX - player.x) <= 1 && Math.abs(worldY - player.y) <= 1) {
            let bonfire = placedBonfires.get(bonfireKey);
            if (!bonfire.lit) {
                // Lighting a bonfire is easier than a campfire
                let chance = 0.8;
                if (Math.random() < chance) {
                    bonfire.lit = true;
                    message = "You light the bonfire. Its flames roar and light up the night!";
                    // Try to spread forest fire if next to forest
                    if (isNearType(worldX, worldY, "forest")) {
                        trySpreadForestFireFromBonfire(worldX, worldY);
                    }
                } else {
                    message = "You try to light the bonfire, but it refuses to catch.";
                }
                drawMap();
            } else {
                message = "The bonfire is already burning brightly.";
                drawMap();
            }
        }
        return true;
    }

    // Only allow placement if selectedItem is "bonfire"
    if (selectedItem !== "bonfire") return false;

    // Only allow placement on grass or forest, not on player or another bonfire/campfire
    if (
        countInInventory("bonfire") > 0 &&
        (tileType === "grass" || tileType === "forest") &&
        !(worldX === player.x && worldY === player.y) &&
        !placedBonfires.has(bonfireKey) &&
        !placedCampfires.has(bonfireKey)
    ) {
        placedBonfires.set(bonfireKey, { lit: false });
        // Remove one bonfire from inventory
        let idx = player.inventory.indexOf("bonfire");
        if (idx !== -1) player.inventory.splice(idx, 1);
        message = "You build a bonfire. It's a large pile of wood. Maybe you can light it?";
        drawMap();
        // After successful placement:
        selectedItem = null;
        return true;
    }

    // If nothing was handled:
    return false;
}

// Crafting logic: press "B" to craft a bonfire with 3 big sticks
window.addEventListener('keydown', (e) => {
    if (typeof message !== "undefined" && message) return;
    if (e.key === "b" || e.key === "B") {
        if (typeof countInInventory === "function" && countInInventory("big stick") >= 3) {
            removeFromInventory("big stick", 3);
            player.inventory.push("bonfire");
            message = "You carefully arrange three big sticks and craft a bonfire. This will light up a large area!";
            drawMap();
        } else {
            message = "You need at least 3 big sticks to craft a bonfire.";
            drawMap();
        }
    }
});

// Helper: check if a wrapped y is visible in the current view
function isYVisible(fy, startY, tilesY) {
    // Handles world vertical wrapping for visibility
    let WORLD_Y_MIN = -5000, WORLD_Y_MAX = 5000, WORLD_Y_SIZE = WORLD_Y_MAX - WORLD_Y_MIN + 1;
    let rel = ((fy - startY - WORLD_Y_MIN) % WORLD_Y_SIZE + WORLD_Y_SIZE) % WORLD_Y_SIZE;
    return rel >= 0 && rel < tilesY;
}

// Call updateForestFires in your main game loop (main.js):
// Add this line in dayNightLoop() before drawMap():
// updateForestFires();