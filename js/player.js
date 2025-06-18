// ORGANIZATION RULES:

// YES:

//Player state and data:
//The player object (position, color, inventory, etc.).
//Player movement logic:
//Functions like movePlayer(dx, dy) that handle moving the player and checking for valid tiles.
//Player placement logic:
//Functions like placePlayer() to spawn the player at the start.
//Player-specific events:
//Logic for random events that happen to the player (e.g., finding sticks).
//Helpers for player actions:
//Any helpers that are only used for the player (e.g., player health, stamina, etc., if you add them).

// NO:

//Enemy, campfire, or map logic:
//E.g., enemy AI, fire spreading, map drawing (except calling drawMap() after moving).
//General-purpose utility functions:
//E.g., wrapX, getTileType, isNearForest (unless only used by player logic).
//Inventory management functions:
//E.g., countInInventory, removeFromInventory (should be in inventory.js).
//Constants/configuration:
//E.g., tile colors, season names, etc. (should be in constants.js).
//Rendering logic for non-player entities:
//E.g., drawing enemies, campfires, or the map itself (should be in their respective files).
//Game loop or orchestration code:
//E.g., main game loop, input handling, or startup logic (should be in main.js).

////                    DOES NOT GO HERE!                    ////

//Enemy/campfire logic
//General utility functions (unless only used by player)
//Inventory management helpers (unless only for player)
//Game constants/configuration
//Main game loop or input handling


const player = {
    x: 0,
    y: 0,
    color: "#FFD700",
    inventory: []
};

// Move the player by dx, dy if possible
function movePlayer(dx, dy) {
    const newX = wrapX(player.x + dx);
    const newY = wrapY(player.y + dy);
    const tile = getTileType(newX, newY);
    if (tile !== "mountain" && tile !== "water") {
        player.x = newX;
        player.y = newY;
        // Random event: find a stick if on grass near forest, or in forest
        if (
            (tile === "grass" && typeof isNearForest === "function" && isNearForest(newX, newY)) ||
            tile === "forest"
        ) {
            // 5% chance for stick, 1% chance for big stick (only in forest)
            if (tile === "forest" && Math.random() < 0.01) {
                player.inventory.push("big stick");
                if (typeof message !== "undefined")
                    message = "You find a big stick among the trees. This could be useful for crafting or as a weapon!";
            } else if (Math.random() < 0.05) {
                player.inventory.push("stick");
                if (typeof message !== "undefined")
                    message = "You notice something on the ground. It's a sturdy stick, fallen from the nearby forest. You pick it up and feel a little more prepared for your journey.";
            }
        }
        if (typeof updateEnemies === "function") updateEnemies();
        if (typeof drawMap === "function") drawMap();
    }
}

// Place the player on a walkable tile near (0, 0)
function placePlayer() {
    let x = 0, y = 0;
    let maxRadius = 20;
    let found = false;
    for (let r = 0; r <= maxRadius && !found; r++) {
        for (let dx = -r; dx <= r && !found; dx++) {
            for (let dy = -r; dy <= r && !found; dy++) {
                if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
                const tile = getTileType(wrapX(x + dx), y + dy);
                if (tile !== "mountain" && tile !== "water") {
                    player.x = wrapX(x + dx);
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