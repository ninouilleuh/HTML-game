// Store placed campfires as a Map: key = "x,y", value = {lit: boolean}
const placedCampfires = new Map();

// --- Add a burnt land tile type ---
if (!tileColors.burnt) tileColors.burnt = "#444"; // dark gray for burnt land

// --- Track burnt tiles globally ---
const burntTiles = new Set();

// Draw campfires on the map
function drawCampfires(offsetX, offsetY, startX, startY, tilesX, tilesY) {
    for (let [key, campfire] of placedCampfires.entries()) {
        if (burntTiles.has(key)) continue; // Don't draw fire on burnt land
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
            // Draw pile of wood (brown circle) or burning forest (dark red)
            ctx.beginPath();
            ctx.arc(px, py, pixelSize * 0.4, 0, 2 * Math.PI);
            ctx.fillStyle = campfire.isForestFire ? "#550000" : "#8B5A2B";
            ctx.fill();
            // If lit, draw fire
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

// --- Patch getTileType to return "burnt" if in burntTiles ---
const _originalGetTileType = getTileType;
function getTileTypePatched(x, y) {
    const key = `${x},${y}`;
    if (burntTiles.has(key)) return "burnt";
    return _originalGetTileType(x, y);
}
window.getTileType = getTileTypePatched;

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

// If a campfire is lit next to a forest, there is a high chance the forest catches fire
function trySpreadForestFire(worldX, worldY) {
    // Check all adjacent tiles for forest
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            if (dx === 0 && dy === 0) continue;
            let fx = worldX + dx;
            let fy = worldY + dy;
            if (getTileType(fx, fy) === "forest") {
                // 70% chance to ignite adjacent forest tile
                if (Math.random() < 0.7) {
                    // Mark this forest tile as burning
                    placedCampfires.set(`${fx},${fy}`, { lit: true, isForestFire: true, burnTime: 180 });
                }
            }
        }
    }
}

// Update burning forest tiles (spread and burn out, then burn to land)
function updateForestFires() {
    let newFires = [];
    for (let [key, campfire] of placedCampfires.entries()) {
        if (campfire.isForestFire) {
            // --- Make forest burn longer ---
            if (campfire.burnTimeStart === undefined) {
                // Store original burn time for spread calculation
                campfire.burnTimeStart = campfire.burnTime;
            }
            campfire.burnTime--;

            // --- Make fire spread more slowly at first, then faster ---
            // Spread chance increases as burnTime decreases
            let [fx, fy] = key.split(',').map(Number);
            let burnProgress = 1 - (campfire.burnTime / campfire.burnTimeStart); // 0 at start, 1 at end
            // Spread chance: starts at 5%, ramps up to 40%
            let spreadChance = 0.05 + 0.35 * burnProgress;

            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue;
                    let nx = fx + dx, ny = fy + dy;
                    if (getTileType(nx, ny) === "forest" && !placedCampfires.has(`${nx},${ny}`) && !burntTiles.has(`${nx},${ny}`)) {
                        if (Math.random() < spreadChance) {
                            newFires.push({ x: nx, y: ny });
                        }
                    }
                }
            }
            // Burn out after burnTime
            if (campfire.burnTime <= 0) {
                // Mark as burnt land
                burntTiles.add(key);
                placedCampfires.delete(key);
            }
        }
    }
    // Ignite new fires
    for (let fire of newFires) {
        // Burn time: 20s + 2s per adjacent forest tile (longer burn)
        let adj = countAdjacentForest(fire.x, fire.y);
        let burnTime = 20 * 60 + adj * 2 * 60;
        placedCampfires.set(`${fire.x},${fire.y}`, { lit: true, isForestFire: true, burnTime });
    }
}

// Call updateForestFires in your main game loop (main.js):
// Add this line in dayNightLoop() before drawMap():
// updateForestFires();