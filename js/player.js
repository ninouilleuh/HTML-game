const player = {
    x: 0,
    y: 0,
    color: "#FFD700",
    inventory: []
};

// Move the player by dx, dy if possible
function movePlayer(dx, dy) {
    const newX = player.x + dx;
    const newY = player.y + dy;
    const tile = getTileType(newX, newY);
    if (tile !== "mountain" && tile !== "water") {
        player.x = newX;
        player.y = newY;
        // Random event: find a stick if on grass and near a forest
        if (tile === "grass" && typeof isNearForest === "function" && isNearForest(newX, newY)) {
            if (Math.random() < 0.05) {
                player.inventory.push("stick");
                if (typeof message !== "undefined")
                    message = "You notice something on the ground. It's a sturdy stick, fallen from the nearby forest. You pick it up and feel a little more prepared for your journey.";
            }
        }
        if (typeof updateEnemies === "function") updateEnemies();
        if (typeof drawMap === "function") drawMap();
    }
}

// Place the player on a walkable tile near (0,0)
function placePlayer() {
    let x = 0, y = 0;
    let maxRadius = 20;
    let found = false;
    for (let r = 0; r <= maxRadius && !found; r++) {
        for (let dx = -r; dx <= r && !found; dx++) {
            for (let dy = -r; dy <= r && !found; dy++) {
                if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
                const tile = getTileType(x + dx, y + dy);
                if (tile !== "mountain" && tile !== "water") {
                    player.x = x + dx;
                    player.y = y + dy;
                    found = true;
                }
            }
        }
    }
    if (!found) {
        player.x = 0;
        player.y = 0;
    }
}