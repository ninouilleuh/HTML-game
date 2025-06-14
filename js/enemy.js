const enemies = [];

// Spawn a few enemies at random walkable locations
function spawnInitialEnemies(count = 5) {
    let tries = 0;
    while (enemies.length < count && tries < 1000) {
        let ex = Math.floor(Math.random() * 100 - 50);
        let ey = Math.floor(Math.random() * 100 - 50);
        let tile = getTileType(ex, ey);
        // Don't spawn on water, mountain, or player
        if (tile !== "mountain" && tile !== "water" && !(ex === player.x && ey === player.y)) {
            // Don't spawn on a campfire
            if (!placedCampfires.has(`${ex},${ey}`)) {
                enemies.push({ x: ex, y: ey, state: "idle" });
            }
        }
        tries++;
    }
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
                //console.log(`Enemy at (${enemy.x},${enemy.y}) cannot see player (LOS blocked)`);
                return false;
            }
            if (getTileType(player.x, player.y) === "forest" && dist > 4) {
                //console.log(`Enemy at (${enemy.x},${enemy.y}) cannot see player (player deep in forest)`);
                return false;
            }
            //console.log(`Enemy at (${enemy.x},${enemy.y}) CAN see player`);
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
                    console.log(`Enemy at (${enemy.x},${enemy.y}) is pathfinding to player at (${player.x},${player.y}). Path found:`, enemy.chasePath ? enemy.chasePath.length : "none");
                }
            } else {
                enemy.chaseTimer++;
                let secondsLeft = Math.max(0, 10 - enemy.chaseTimer / 60).toFixed(2);
                //console.log(`Enemy at (${enemy.x},${enemy.y}) lost sight. Will stop tracking in ${secondsLeft}s`);
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
                    console.log(`Enemy moves from (${enemy.x},${enemy.y}) to (${next.x},${next.y}) while chasing.`);
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
                console.log(`Enemy at (${enemy.x},${enemy.y}) is searching for player at (${enemy.lastSeen.x},${enemy.lastSeen.y}). Path found:`, enemy.searchPath ? enemy.searchPath.length : "none");
            }

            // Move along the path
            enemy.moveCooldown = (enemy.moveCooldown || 0) + 1;
            let moveDelay = getTileType(enemy.x, enemy.y) === "forest" ? 60 : 30;
            if (enemy.moveCooldown >= moveDelay && enemy.searchPath && enemy.searchPath.length) {
                enemy.moveCooldown = 0;
                let next = enemy.searchPath.shift();
                if (next) {
                    console.log(`Enemy moves from (${enemy.x},${enemy.y}) to (${next.x},${next.y}) while searching.`);
                    enemy.x = next.x;
                    enemy.y = next.y;
                }
            }

            // If player is seen again, resume chase
            let distToPlayer = Math.abs(enemy.x - player.x) + Math.abs(enemy.y - player.y);
            if (distToPlayer <= 5 && canSeePlayer()) {
                console.log(`Enemy at (${enemy.x},${enemy.y}) spotted the player again! Resuming chase.`);
                enemy.state = "chasing";
                enemy.chaseTimer = 0;
                enemy.lastSeen = { x: player.x, y: player.y };
                enemy.searchTimer = 0;
                enemy.searchPath = null;
                continue;
            }

            // If reached last seen position or searched for 5 seconds, go idle
            if ((enemy.x === enemy.lastSeen.x && enemy.y === enemy.lastSeen.y) || enemy.searchTimer > 5 * 60) {
                console.log(`Enemy at (${enemy.x},${enemy.y}) finished searching. Returning to idle.`);
                enemy.state = "idle";
                enemy.searchTimer = 0;
                enemy.lastSeen = null;
                enemy.searchPath = null;
            }
        }
    }
}