// ORGANIZATION RULES:

// YES:

//All logic related to enemies:
//The enemies array (tracking all enemy objects).
//Functions for spawning, updating, and drawing enemies (e.g., spawnInitialEnemies, updateEnemies, drawEnemies).
//Enemy AI and state management (e.g., chasing, searching, idle).
//Pathfinding logic used by enemies (e.g., findPath).
//Any enemy-specific helper functions (e.g., canSeePlayer if only used by enemies).


// NO:

//General-purpose utility functions:
//E.g., wrapX, wrapY, getTileType (unless only used for enemy logic).
//Player logic:
//E.g., player movement, inventory, or health (should be in player.js or inventory.js).
//Rendering logic for non-enemy entities:
//E.g., drawing campfires, tiles, or UI (should be in their respective files).
//Constants/configuration unrelated to enemies:
//E.g., tile colors, season names, etc. (should be in constants.js).
//Game loop or orchestration code:
//E.g., main game loop, input handling, or startup logic (should be in main.js).

////                    DOES NOT GO HERE!                    ////

//General map or player logic
//Non-enemy rendering or state
//Game constants/config unrelated to enemies
//Main game loop or input handling

const enemies = [];

// Spawn a few enemies at random walkable locations
function spawnInitialEnemies(count = 0) {
    // Disabled: do not spawn enemies for now
    return;
}

// Draw enemies
function drawEnemies(offsetX, offsetY, startX, startY, tilesX, tilesY) {
    for (let enemy of enemies) {
        // Only draw if in visible area
        if (
            enemy.x >= startX && enemy.x < startX + tilesX &&
            enemy.y >= startY && enemy.y < startY + tilesY
        ) {
            let dx = enemy.x - startX;
            let dy = enemy.y - startY;
            let px = dx * pixelSize + offsetX + pixelSize / 2;
            let py = dy * pixelSize + offsetY + pixelSize / 2;
            ctx.beginPath();
            ctx.arc(px, py, pixelSize * 0.4, 0, 2 * Math.PI);
            ctx.fillStyle = enemy.state === "chasing" ? "#ff2222" : "#990000";
            ctx.fill();
        }
    }
}

// A* pathfinding for 4-directional movement
function findPath(start, goal, isWalkable) {
    let openSet = [start];
    let cameFrom = {};
    let gScore = {};
    let fScore = {};
    let key = (p) => `${p.x},${p.y}`;
    gScore[key(start)] = 0;
    fScore[key(start)] = Math.abs(goal.x - start.x) + Math.abs(goal.y - start.y);

    while (openSet.length > 0) {
        openSet.sort((a, b) => fScore[key(a)] - fScore[key(b)]);
        let current = openSet.shift();
        if (current.x === goal.x && current.y === goal.y) {
            let path = [current];
            while (cameFrom[key(current)]) {
                current = cameFrom[key(current)];
                path.unshift(current);
            }
            return path;
        }
        for (let [dx, dy] of [[0,1],[1,0],[0,-1],[-1,0]]) {
            let neighbor = {x: current.x + dx, y: current.y + dy};
            if (!isWalkable(neighbor.x, neighbor.y)) continue;
            let tentative_gScore = gScore[key(current)] + 1;
            if (tentative_gScore < (gScore[key(neighbor)] ?? Infinity)) {
                cameFrom[key(neighbor)] = current;
                gScore[key(neighbor)] = tentative_gScore;
                fScore[key(neighbor)] = tentative_gScore + Math.abs(goal.x - neighbor.x) + Math.abs(goal.y - neighbor.y);
                if (!openSet.some(n => n.x === neighbor.x && n.y === neighbor.y)) {
                    openSet.push(neighbor);
                }
            }
        }
    }
    return null; // No path found
}

// Update enemy AI: chase if player is close, search last seen area if lost
function updateEnemies() {
    for (let enemy of enemies) {
        if (enemy.chaseTimer === undefined) enemy.chaseTimer = 0;
        if (enemy.moveCooldown === undefined) enemy.moveCooldown = 0;
        if (enemy.state === undefined) enemy.state = "idle";
        if (enemy.searchTimer === undefined) enemy.searchTimer = 0;
        if (enemy.lastSeen === undefined) enemy.lastSeen = null;

        let dist = Math.abs(enemy.x - player.x) + Math.abs(enemy.y - player.y);

        function canSeePlayer() {
            if (!hasLineOfSight(enemy.x, enemy.y, player.x, player.y)) {
                return false;
            }
            if (getTileType(player.x, player.y) === "forest" && dist > 4) {
               
                return false;
            }
            return true;
        }

        // Allow re-aggro ANY time player is close and visible
        if (enemy.state === "idle" && dist <= 5 && canSeePlayer()) {
            enemy.state = "chasing";
            enemy.chaseTimer = 0;
            enemy.lastSeen = { x: player.x, y: player.y };
            enemy.searchTimer = 0;
        }

        // Chasing state with pathfinding
        if (enemy.state === "chasing") {
            if (canSeePlayer()) {
                enemy.chaseTimer = 0;
                enemy.lastSeen = { x: player.x, y: player.y };
                // Recompute path to player if needed
                if (
                    !enemy.chasePath ||
                    !enemy.chasePath.length ||
                    enemy.chasePath[enemy.chasePath.length - 1].x !== player.x ||
                    enemy.chasePath[enemy.chasePath.length - 1].y !== player.y
                ) {
                    enemy.chasePath = findPath(
                        { x: enemy.x, y: enemy.y },
                        { x: player.x, y: player.y },
                        (x, y) => {
                            let t = getTileType(x, y);
                            return t !== "mountain" && t !== "water" &&
                                !enemies.some(e => e !== enemy && e.x === x && e.y === y);
                        }
                    );
                    if (enemy.chasePath && enemy.chasePath.length > 1) enemy.chasePath.shift();
                }
            } else {
                enemy.chaseTimer++;
                let secondsLeft = Math.max(0, 10 - enemy.chaseTimer / 60).toFixed(2);
                if (enemy.chaseTimer > 10 * 60) {
                    enemy.state = "searching";
                    enemy.searchTimer = 0;
                    enemy.chasePath = null;
                    continue;
                }
            }

            // Slow down enemy movement: move only every 30 frames (about 2 times per second)
            enemy.moveCooldown = (enemy.moveCooldown || 0) + 1;
            let moveDelay = getTileType(enemy.x, enemy.y) === "forest" ? 60 : 30;
            if (enemy.moveCooldown < moveDelay) continue;
            enemy.moveCooldown = 0;

            // Use pathfinding to move toward player
            if (enemy.chasePath && enemy.chasePath.length) {
                let next = enemy.chasePath.shift();
                if (next) {
                    enemy.x = next.x;
                    enemy.y = next.y;
                }
            } else {
                // Fallback: direct step if no path found
                let dx = player.x - enemy.x;
                let dy = player.y - enemy.y;
                let nx = enemy.x, ny = enemy.y;
                if (Math.abs(dx) > Math.abs(dy)) {
                    nx += Math.sign(dx);
                } else if (Math.abs(dy) > 0) {
                    ny += Math.sign(dy);
                }
                let tile = getTileType(nx, ny);
                if (
                    tile !== "mountain" &&
                    tile !== "water" &&
                    !(nx === player.x && ny === player.y) &&
                    !enemies.some(e => e !== enemy && e.x === nx && e.y === ny)
                ) {
                    enemy.x = nx;
                    enemy.y = ny;
                }
            }
        }

        // SEARCH STATE: move toward last seen position for 5 seconds, then idle
        if (enemy.state === "searching") {
            enemy.searchTimer++;

            // Pathfinding: compute path to last seen position if not already set or if destination changed
            if (!enemy.searchPath || !enemy.searchPath.length ||
                enemy.searchPath[enemy.searchPath.length - 1].x !== enemy.lastSeen.x ||
                enemy.searchPath[enemy.searchPath.length - 1].y !== enemy.lastSeen.y) {
                enemy.searchPath = findPath(
                    {x: enemy.x, y: enemy.y},
                    enemy.lastSeen,
                    (x, y) => {
                        let t = getTileType(x, y);
                        return t !== "mountain" && t !== "water" &&
                            !enemies.some(e => e !== enemy && e.x === x && e.y === y);
                    }
                );
                if (enemy.searchPath && enemy.searchPath.length > 1) enemy.searchPath.shift();
            }

            // Move along the path
            enemy.moveCooldown = (enemy.moveCooldown || 0) + 1;
            let moveDelay = getTileType(enemy.x, enemy.y) === "forest" ? 60 : 30;
            if (enemy.moveCooldown >= moveDelay && enemy.searchPath && enemy.searchPath.length) {
                enemy.moveCooldown = 0;
                let next = enemy.searchPath.shift();
                if (next) {
                    enemy.x = next.x;
                    enemy.y = next.y;
                }
            }

            // If player is seen again, resume chase
            let distToPlayer = Math.abs(enemy.x - player.x) + Math.abs(enemy.y - player.y);
            if (distToPlayer <= 5 && canSeePlayer()) {
                enemy.state = "chasing";
                enemy.chaseTimer = 0;
                enemy.lastSeen = { x: player.x, y: player.y };
                enemy.searchTimer = 0;
                enemy.searchPath = null;
                continue;
            }

            // If reached last seen position or searched for 5 seconds, go idle
            if ((enemy.x === enemy.lastSeen.x && enemy.y === enemy.lastSeen.y) || enemy.searchTimer > 5 * 60) {
                enemy.state = "idle";
                enemy.searchTimer = 0;
                enemy.lastSeen = null;
                enemy.searchPath = null;
            }
        }
    }
}