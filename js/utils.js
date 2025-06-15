// Simplex noise for natural terrain
class SimplexNoise {
    constructor(seed = 0) {
        this.p = new Uint8Array(256);
        for (let i = 0; i < 256; i++) this.p[i] = i;
        let n, q;
        for (let i = 255; i > 0; i--) {
            n = Math.floor((seed = (seed * 9301 + 49297) % 233280) / 233280 * (i + 1));
            q = this.p[i];
            this.p[i] = this.p[n];
            this.p[n] = q;
        }
        this.perm = new Uint8Array(512);
        for (let i = 0; i < 512; i++) this.perm[i] = this.p[i & 255];
    }
    dot(g, x, y) { return g[0] * x + g[1] * y; }
    noise2D(xin, yin) {
        const grad3 = [
            [1,1],[-1,1],[1,-1],[-1,-1],
            [1,0],[-1,0],[1,0],[-1,0],
            [0,1],[0,-1],[0,1],[0,-1]
        ];
        let perm = this.perm;
        let F2 = 0.5 * (Math.sqrt(3) - 1);
        let s = (xin + yin) * F2;
        let i = Math.floor(xin + s);
        let j = Math.floor(yin + s);
        let G2 = (3 - Math.sqrt(3)) / 6;
        let t = (i + j) * G2;
        let X0 = i - t;
        let Y0 = j - t;
        let x0 = xin - X0;
        let y0 = yin - Y0;
        let i1, j1;
        if (x0 > y0) { i1 = 1; j1 = 0; }
        else { i1 = 0; j1 = 1; }
        let x1 = x0 - i1 + G2;
        let y1 = y0 - j1 + G2;
        let x2 = x0 - 1 + 2 * G2;
        let y2 = y0 - 1 + 2 * G2;
        let ii = i & 255;
        let jj = j & 255;
        let gi0 = perm[ii + perm[jj]] % 12;
        let gi1 = perm[ii + i1 + perm[jj + j1]] % 12;
        let gi2 = perm[ii + 1 + perm[jj + 1]] % 12;
        let t0 = 0.5 - x0 * x0 - y0 * y0;
        let n0 = t0 < 0 ? 0 : (t0 *= t0, t0 * t0 * this.dot(grad3[gi0], x0, y0));
        let t1 = 0.5 - x1 * x1 - y1 * y1;
        let n1 = t1 < 0 ? 0 : (t1 *= t1, t1 * t1 * this.dot(grad3[gi1], x1, y1));
        let t2 = 0.5 - x2 * x2 - y2 * y2;
        let n2 = t2 < 0 ? 0 : (t2 *= t2, t2 * t2 * this.dot(grad3[gi2], x2, y2));
        return 70 * (n0 + n1 + n2);
    }
}

// Generate a random seed for each reload
const seed = Math.floor(Math.random() * 1000000);
const noise = new SimplexNoise(seed);

// Tile cache for performance
const tileCache = new Map();

// Wrap x into [-5000, 5000]
function wrapX(x) {
    let wrapped = ((x - WORLD_X_MIN) % WORLD_X_SIZE + WORLD_X_SIZE) % WORLD_X_SIZE + WORLD_X_MIN;
    return wrapped;
}

// Wrap y into [-5000, 5000]
function wrapY(y) {
    let wrapped = ((y - WORLD_Y_MIN) % WORLD_Y_SIZE + WORLD_Y_SIZE) % WORLD_Y_SIZE + WORLD_Y_MIN;
    return wrapped;
}

// Get the type of a tile at (x, y)
function getTileType(x, y) {
    x = wrapX(x);
    y = wrapY(y);

    // Force water tiles at the bottom and top borders (y)
    if ((y >= -5000 && y <= -4950) || (y >= 4950 && y <= 5000)) {
        return "water";
    }

    // Force water tiles at the left and right borders (x)
    if ((x >= -5000 && x <= -4950) || (x >= 4950 && x <= 5000)) {
        return "water";
    }

    const key = `${x},${y}`;
    if (tileCache.has(key)) return tileCache.get(key);

    let nx = x * 0.045, ny = y * 0.045;
    let e = noise.noise2D(nx, ny) * 0.5 + 0.5;
    let m = noise.noise2D(nx + 100, ny + 100) * 0.5 + 0.5;
    let f = noise.noise2D(nx - 100, ny - 100) * 0.5 + 0.5;

    let riverNoise = Math.abs(noise.noise2D(nx * 0.5 + 200, ny * 0.5 - 200));
    let isRiver = riverNoise < 0.025 && e > 0.22;

    let type = "grass";
    if (isRiver) type = "water";
    else if (e < 0.16) type = "water";
    else if (m > 0.72 && e > 0.36) type = "mountain";
    else if (f > 0.68 && e > 0.34) type = "forest";

    tileCache.set(key, type);
    return type;
}

// Add a dry grass tile color if not present
if (typeof tileColors !== "undefined" && !tileColors.dry) tileColors.dry = "#d1c97a"; // yellowish for dry grass

// Track dry grass tiles
const dryGrassTiles = new Set();

// Helper to check if a tile is near water (within radius)
function isNearWater(x, y, radius = 4) {
    for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
            if (dx === 0 && dy === 0) continue;
            if (getTileType(wrapX(x + dx), wrapY(y + dy)) === "water") {
                return true;
            }
        }
    }
    return false;
}

// Update dry grass tiles (call this in your main game loop)
function updateDryGrass() {
    // Use the same area as drawMap for consistency
    const extraTiles = 10; // match drawMap's extraTiles
    const tilesX = Math.ceil(canvas.width / pixelSize) + 2 + extraTiles * 2;
    const tilesY = Math.ceil(canvas.height / pixelSize) + 2 + extraTiles * 2;
    const startX = player.x - Math.floor(tilesX / 2);
    const startY = player.y - Math.floor(tilesY / 2);

    for (let dx = 0; dx < tilesX; dx++) {
        for (let dy = 0; dy < tilesY; dy++) {
            const x = wrapX(startX + dx);
            const y = wrapY(startY + dy);
            const key = `${x},${y}`;
            if (
                getTileType(x, y) === "grass" &&
                !isNearWater(x, y, 4) &&
                getTemperature(x, y) >= 25
            ) {
                dryGrassTiles.add(key);
            }
            // No more spontaneous burning of dry grass
        }
    }
}

// Patch getTileType to return "dry" for dry grass tiles
const _originalGetTileTypeDry = window.getTileType || getTileType;
function getTileTypeWithDry(x, y) {
    const key = `${x},${y}`;
    if (dryGrassTiles.has(key)) return "dry";
    return _originalGetTileTypeDry(x, y);
}
window.getTileType = getTileTypeWithDry;

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

// Helper to check if a grass tile is adjacent to a forest tile
function isNearForest(x, y) {
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            if (dx === 0 && dy === 0) continue;
            if (getTileType(wrapX(x + dx), wrapY(y + dy)) === "forest") {
                return true;
            }
        }
    }
    return false;
}

// Helper to check if a tile is inside a forest
function isForest(x, y) {
    return getTileType(wrapX(x), wrapY(y)) === "forest";
}

// Helper to check line of sight (Bresenham's line algorithm)
function hasLineOfSight(x0, y0, x1, y1) {
    x0 = wrapX(x0); y0 = wrapY(y0);
    x1 = wrapX(x1); y1 = wrapY(y1);
    let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    let sx = x0 < x1 ? 1 : -1;
    let sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let x = x0, y = y0;
    while (!(x === x1 && y === y1)) {
        if ((x !== x0 || y !== y0) && getTileType(x, y) === "mountain") return false;
        let e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x = wrapX(x + sx); }
        if (e2 < dx) { err += dx; y = wrapY(y + sy); }
    }
    return true;
}

function isPlayerDeepInForest() {
    if (getTileType(player.x, player.y) !== "forest") return false;
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            if (dx === 0 && dy === 0) continue;
            if (getTileType(player.x + dx, player.y + dy) !== "forest") {
                return false;
            }
        }
    }
    return true;
}

// Get the temperature at (x, y), from -50 (cold) to +50 (hot)
function getTemperature(x, y) {
    x = wrapX(x);
    y = wrapY(y);

    // Latitude: 0 at equator (y=0), 1 at poles (y=±5000)
    let latitudeNorm = Math.abs(y) / 5000; // 0 (equator) to 1 (pole)

    // Base temperature: 50°C at equator, -50°C at poles
    let temp = Math.round(50 - 100 * latitudeNorm);

    // --- Season modifier ---
    // spring: -10 (wet/cool), summer: +30, autumn: 0, winter: -30
    let seasonMod = 0;
    switch (currentSeason) {
        case "spring":
            seasonMod = -10;
            break;
        case "summer":
            seasonMod = 30;
            break;
        case "winter":
            seasonMod = -30;
            break;
        // autumn: no modifier
    }
    temp += seasonMod;

    // Add some local noise for variation
    let nx = x * 0.03, ny = y * 0.03;
    let localNoise = noise.noise2D(nx + 300, ny - 300) * 0.5 + 0.5; // 0..1
    temp += Math.round((localNoise - 0.5) * 10); // ±5°C local variation

    // Progressive mountain chill: colder the closer you are to mountains (radius 1 to 4)
    let mountainInfluence = 0;
    let maxRadius = 4;
    let totalWeight = 0;
    let minDistToMountain = Infinity;
    for (let r = 1; r <= maxRadius; r++) {
        let weight = 1 / r;
        let count = 0;
        let tiles = 0;
        for (let dx = -r; dx <= r; dx++) {
            for (let dy = -r; dy <= r; dy++) {
                if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
                tiles++;
                if (getTileType(wrapX(x + dx), wrapY(y + dy)) === "mountain") {
                    count++;
                    let dist = Math.abs(dx) + Math.abs(dy);
                    if (dist < minDistToMountain) minDistToMountain = dist;
                }
            }
        }
        if (tiles > 0) {
            mountainInfluence += (count / tiles) * weight;
            totalWeight += weight;
        }
    }
    let mountainChill = -0.7 * (mountainInfluence / (totalWeight || 1));
    temp += Math.round(mountainChill * 20); // up to -14°C if surrounded by mountains

    // If close to a mountain, cap max temperature based on distance (progressive)
    if (minDistToMountain <= maxRadius) {
        const maxTemps = [null, 5, 15, 25, 35];
        let mountainCap = maxTemps[minDistToMountain] !== undefined ? maxTemps[minDistToMountain] : 50;
        if (temp > mountainCap) temp = mountainCap;
    }

    return temp;
}

// Get the humidity at (x, y), from 0 (dry) to 100 (very humid)
function getHumidity(x, y) {
    x = wrapX(x);
    y = wrapY(y);

    // Base humidity: higher near water, lower near poles, some noise
    let latitudeNorm = 1 - Math.abs(y) / 5000; // 1 at equator, 0 at poles
    let nx = x * 0.025, ny = y * 0.025;
    let noiseVal = noise.noise2D(nx + 500, ny - 500) * 0.5 + 0.5; // 0..1
    let nearWater = isNearWater(x, y, 3) ? 1 : 0;

    // Combine: latitude (40%), noise (30%), water proximity (30%)
    let baseHumidity = 40 * latitudeNorm + 30 * noiseVal + 30 * nearWater;

    // Clamp to 0..100
    baseHumidity = Math.max(0, Math.min(100, baseHumidity));

    // Temperature-based humidity bands
    const temp = getTemperature(x, y);
    let minH = 0, maxH = 0;

    if (temp > 55 || temp < -10) {
        minH = maxH = 0;
    } else if (temp > 45 && temp <= 55) {
        minH = 5; maxH = 20;
    } else if (temp > 35 && temp <= 45) {
        minH = 10; maxH = 40;
    } else if (temp > 25 && temp <= 35) {
        minH = 50; maxH = 100;
    } else if (temp > 10 && temp <= 25) {
        minH = 40; maxH = 80;
    } else if (temp > 0 && temp <= 10) {
        minH = 20; maxH = 50;
    } else if (temp >= -10 && temp <= 0) {
        minH = 10; maxH = 30;
    }

    // Map baseHumidity (0..100) into the allowed band
    let humidity = minH + (maxH - minH) * (baseHumidity / 100);
    return Math.round(humidity);
}

const WORLD_Y_MIN = -5000;
const WORLD_Y_MAX = 5000;
const WORLD_Y_SIZE = WORLD_Y_MAX - WORLD_Y_MIN + 1;
const WORLD_X_MIN = -5000;
const WORLD_X_MAX = 5000;
const WORLD_X_SIZE = WORLD_X_MAX - WORLD_X_MIN + 1;