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

// Tile property cache: { "x,y": { frame: N, humidity: ..., temp: ..., elevation: ..., tileType: ... } }
const tileCache = {};
let currentCacheFrame = 0;

// Call this at the start of each frame or hour
function incrementTileCacheFrame() {
    currentCacheFrame++;
}

// Helper to get a cache key
function getTileCacheKey(x, y) {
    return `${x},${y}`;
}

// Cached wrappers for tile property functions:
function getCachedHumidity(x, y) {
    const key = getTileCacheKey(x, y);
    if (tileCache[key] && tileCache[key].frame === currentCacheFrame && tileCache[key].humidity !== undefined) {
        return tileCache[key].humidity;
    }
    const h = getHumidity(x, y);
    if (!tileCache[key]) tileCache[key] = { frame: currentCacheFrame };
    tileCache[key].humidity = h;
    tileCache[key].frame = currentCacheFrame;
    return h;
}

function getCachedTemperature(x, y) {
    const key = getTileCacheKey(x, y);
    if (tileCache[key] && tileCache[key].frame === currentCacheFrame && tileCache[key].temp !== undefined) {
        return tileCache[key].temp;
    }
    const t = getTemperature(x, y);
    if (!tileCache[key]) tileCache[key] = { frame: currentCacheFrame };
    tileCache[key].temp = t;
    tileCache[key].frame = currentCacheFrame;
    return t;
}

function getCachedElevation(x, y) {
    const key = getTileCacheKey(x, y);
    if (tileCache[key] && tileCache[key].frame === currentCacheFrame && tileCache[key].elevation !== undefined) {
        return tileCache[key].elevation;
    }
    const e = getElevation(x, y);
    if (!tileCache[key]) tileCache[key] = { frame: currentCacheFrame };
    tileCache[key].elevation = e;
    tileCache[key].frame = currentCacheFrame;
    return e;
}

function getCachedTileType(x, y) {
    const key = getTileCacheKey(x, y);
    if (tileCache[key] && tileCache[key].frame === currentCacheFrame && tileCache[key].tileType !== undefined) {
        return tileCache[key].tileType;
    }
    const t = getTileType(x, y);
    if (!tileCache[key]) tileCache[key] = { frame: currentCacheFrame };
    tileCache[key].tileType = t;
    tileCache[key].frame = currentCacheFrame;
    return t;
}

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
    const biome = getBiome(x, y);
    x = wrapX(x);
    y = wrapY(y);
    //water first 
    // Rivers override other types
    if (riverTiles.has(`${x},${y}`)) {
        return "river";
    }

    // Ocean at the world edge (last 50 tiles)
    if ((y >= -5000 && y <= -4950) || (y >= 4950 && y <= 5000) ||
        (x >= -5000 && x <= -4950) || (x >= 4950 && x <= 5000)) {
        return "water";
    }

    
    //Elevation terrain types
    const elevation = getElevation(x, y);
    if (biome === "tropical" && elevation < 120) {
    const n = noise.noise2D(x * 0.2, y * 0.2) * 0.5 + 0.5;
    if (n < 0.6) return "swamp"; // 30% swamp
    if (n < 0.9) return "lake"; // 5% lake
    // Otherwise, let it fall through to normal land
}
   // if (biome === "tropical" && elevation < 120 ) {
        // Use noise for variety between swamp and lake
        // 60% swamp, 40% lake
     //   return "lake";
   // }

    if (elevation <= 50) {
        // Sea level: water or beach
        return "water";
    }

    if (elevation > 50 && elevation <= 200) {
        // Plains: flat, fertile land
        return "grass";
    }

    if (elevation > 200 && elevation <= 800) {
        // Hills: rolling terrain, mixed forest, scattered trees
        return "hill";
    }

    if (elevation > 800 && elevation <= 2500) {
        // Mountains: steep, rugged, sparse trees, rocks
        return "mountain";
    }

    if (elevation > 2500 && elevation <= 4000) {
        // High mountains: peak, often snow-capped, snow, bare rock, cold
        return "snow";
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
    const extraTiles = 3;
    const tilesX = Math.ceil(canvas.width / pixelSize) + 2 + extraTiles * 2;
    const tilesY = Math.ceil(canvas.height / pixelSize) + 2 + extraTiles * 2;
    const startX = player.x - Math.floor(tilesX / 2);
    const startY = player.y - Math.floor(tilesY / 2);

    for (let dx = 0; dx < tilesX; dx++) {
        for (let dy = 0; dy < tilesY; dy++) {
            const x = wrapX(startX + dx);
            const y = wrapY(startY + dy);
            const key = `${x},${y}`;
            // Use the original tile type for logic
            if (
                _originalGetTileType(x, y) === "grass" &&
                getHumidity(x, y) <= 30
            ) {
                dryGrassTiles.add(key);
            }
            // Remove dry grass if humidity rises above 30 or tile is no longer grass
            if (
                dryGrassTiles.has(key) &&
                (_originalGetTileType(x, y) !== "grass" || getHumidity(x, y) > 30)
            ) {
                dryGrassTiles.delete(key);
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

    // Tropical: constant, hot, minimal seasonality
    if (getBiome(x, y) === "tropical") {
        const base = 27;
        const variation = (noise.noise2D(x * 0.1, y * 0.1) * 4); // ±4°C
        return Math.max(24, Math.min(32, base + variation));
    }

    // Latitude: 0 at equator (y=0), 1 at poles (y=±5000)
    let latitudeNorm = Math.abs(y) / 5000; // 0 (equator) to 1 (pole)

    // Base temperature: 50°C at equator, -50°C at poles
    let temp = Math.round(50 - 100 * latitudeNorm);

    // --- Season modifier (now latitude-dependent) ---
    temp += getSeasonalTempAdjust(currentSeason, latitudeNorm);

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

    // Elevation adjustment: decrease temp by 0.65°C per 100m
    const elevation = getElevation(x, y);
    temp -= 0.65 * (elevation / 100);

    // --- Day/Night Cycle: Apply night cooling by biome ---
    if (!isDay()) {
        const tileType = getTileType(x, y);
        temp -= getNightCoolingByBiome(tileType);
    }

    // Boost temperature in tropics
    if (getBiome(x, y) === "tropical") {
        temp += 8; // boost temperature in tropics
    }

    // Adjust for subtropical regions
    if (getBiome(x, y) === "subtropical") {
        temp += 5; // hotter in subtropics
    }

    if (getBiome(x, y) === "subpolar") {
        // Short, cool summers and cold winters
        if (currentSeason === "summer") temp += 4;
        if (currentSeason === "winter") temp -= 16;
        temp -= 8; // Always cold
    }

    if (getBiome(x, y) === "polar") {
        temp -= 24; // Always very cold
        // Optionally, even colder in winter:
        if (currentSeason === "winter") temp -= 8;
    }

    return temp;
}

// Returns the seasonal temperature adjustment based on season and latitude
function getSeasonalTempAdjust(season, latitudeNorm) {
    // latitudeNorm: 0 at equator, 1 at poles
    switch (season) {
        case "spring":
        case "autumn":
            // Equator: ±5°C, Poles: +10°C
            return (1 - latitudeNorm) * 5 + latitudeNorm * 10;
        case "summer":
            // Equator: +10°C, Poles: +20°C
            return (1 - latitudeNorm) * 10 + latitudeNorm * 20;
        case "winter":
            // Equator: –10°C, Poles: –30°C
            return (1 - latitudeNorm) * (-10) + latitudeNorm * (-30);
        default:
            return 0;
    }
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

    // Elevation effect: higher elevation means lower humidity
    const elevation = getElevation(x, y);
    humidity -= elevation * 0.005; // 0.5% per 100m

    // --- Distance to water modifier ---
    const dist = distanceToNearestWater(x, y, 400);
    let waterBonus = 0;
    if (dist <= 8) {
        waterBonus = 70; // Very close to water
    } else if (dist <= 20) {
        waterBonus = 50;
    } else if (dist <= 60) {
        waterBonus = 30;
    } else if (dist <= 120) {
        waterBonus = 10;
    } else if (dist <= 300) {
        waterBonus = 0;
    } else if (dist <= 400) {
        waterBonus = -20 - ((dist - 300) / 100) * 40; // -20 to -60%
    } else {
        waterBonus = -60;
    }
    humidity += waterBonus;

    // --- Vegetation cover modifier ---
  //  const tileType = getTileType(x, y);
  //  if (tileType === "forest") {
        // Use noise for deterministic "randomness"
   //     let n = noise.noise2D(x * 0.1 + 1234, y * 0.1 - 5678) * 0.5 + 0.5; // 0..1
  //      humidity += 20 + n * 10; // +20–30%
 //   } else if (tileType === "grass" || tileType === "hill") {
  //      let n = noise.noise2D(x * 0.1 + 4321, y * 0.1 - 8765) * 0.5 + 0.5;
  //      humidity += 5 + n * 5; // +5–10%
  //  } else if (tileType === "desert" || tileType === "bare" || tileType === "mountain" || tileType === "snow") {
        // 0 bonus for bare/desert/mountain/snow
 //   }

    // --- Prevailing wind humidity bonus ---
    humidity += getWindHumidityBonus(x, y);

    // --- Rain shadow effect ---
    if (isInRainShadow(x, y, 30)) {
        humidity -= 30; // Strong drying on leeward side
    } else if (isWindwardOfMountain(x, y, 30)) {
        humidity += 20; // Extra moist on windward side
    }

    // Boost humidity in tropics
    if (getBiome(x, y) === "tropical") {
        humidity += 20; // boost humidity in tropics
    }

    // Adjust for subtropical regions
    if (getBiome(x, y) === "subtropical") {
        humidity -= 25; // much drier air in subtropics
    }

    // Reduce humidity in polar regions
    if (getBiome(x, y) === "polar") {
        humidity -= 20; // Very dry
    }
    

    // Tropical: nearly saturated air, 85–100% humidity
    if (getBiome(x, y) === "tropical") {
        const base = 92;
        const variation = (noise.noise2D(x * 0.13, y * 0.13) * 8); // ±8%
        humidity = Math.max(85, Math.min(100, base + variation));
    }
    // Increase humidity near rivers
    for (let dx = -3; dx <= 3; dx++) {
        for (let dy = -3; dy <= 3; dy++) {
            if (riverTiles.has(`${wrapX(x + dx)},${wrapY(y + dy)}`)) {
                humidity += 15 - 3 * (Math.abs(dx) + Math.abs(dy));
            }
        }
    }

    // Clamp to 0..100
    humidity = Math.max(0, Math.min(100, humidity));
    return Math.round(humidity);
}

// Prevailing wind direction: from ocean (west) to inland (east)
// You can change this to "north", "south", or "east" for different climates
const prevailingWind = "west";

// Returns prevailing wind direction at a given y (latitude)
function getPrevailingWindDirection(y) {
    const absY = Math.abs(y);
    if (absY <= 750) {
        return "east_to_west"; // Polar easterlies
    } else if (absY <= 2250) {
        return "west_to_east"; // Westerlies
    } else if (absY <= 2750) {
        return "east_to_west"; // Trade winds (equator)
    } else if (absY <= 4250) {
        return "west_to_east"; // Westerlies
    } else {
        return "east_to_west"; // Polar easterlies
    }
}

// Helper to compute wind-based humidity bonus
function getWindHumidityBonus(x, y) {
    // How far is this tile from the upwind ocean edge?
    let distToOcean = 9999;
    if (prevailingWind === "west") {
        distToOcean = x - WORLD_X_MIN;
    } else if (prevailingWind === "east") {
        distToOcean = WORLD_X_MAX - x;
    } else if (prevailingWind === "north") {
        distToOcean = y - WORLD_Y_MIN;
    } else if (prevailingWind === "south") {
        distToOcean = WORLD_Y_MAX - y;
    }

    // Tiles closer to the upwind ocean get more humidity
    // 0 tiles from ocean: +30%, 1000 tiles inland: 0%, 3000+ tiles inland: -20%
    let bonus = 30 - (distToOcean / 1000) * 30;
    if (distToOcean > 3000) bonus = -20;
    return bonus;
}

// Helper: returns +1 if wind blows east, -1 if west, 0 otherwise
function getWindStep(y) {
    const dir = getPrevailingWindDirection(y);
    if (dir === "west_to_east") return 1;
    if (dir === "east_to_west") return -1;
    return 0;
}

// Returns true if there is a mountain "upwind" of (x, y) within N tiles
function isInRainShadow(x, y, maxDist = 30) {
    const windStep = getWindStep(y);
    if (windStep === 0) return false;
    for (let d = 1; d <= maxDist; d++) {
        const checkX = wrapX(x - windStep * d);
        const elev = getElevation(checkX, y);
        if (elev > 2000) return true; // Mountain threshold
    }
    return false;
}

// Returns true if there is a mountain "upwind" within N tiles and we're on the windward side
function isWindwardOfMountain(x, y, maxDist = 30) {
    const windStep = getWindStep(y);
    if (windStep === 0) return false;
    for (let d = 1; d <= maxDist; d++) {
        const checkX = wrapX(x - windStep * d);
        const elev = getElevation(checkX, y);
        if (elev > 2000) {
            // If we're upwind of the mountain, we're windward
            return true;
        }
    }
    return false;
}

// Get the elevation at (x, y), from 0 (sea level) to 4000 (mountain top)
function getElevation(x, y) {
    x = wrapX(x);
    y = wrapY(y);

    // Ocean at the world edge (last 50 tiles)
    if (
        x >= 4950 || x <= -4950 ||
        y >= 4950 || y <= -4950
    ) {
        return Math.floor(Math.random() * 30); // Always sea level (0-30m)
    }

    // Very low frequency, mostly plains/hills
    const nx = x * 0.012;
    const ny = y * 0.012;

    let e =
        0.98 * (noise.noise2D(nx, ny) * 0.5 + 0.5) +
        0.015 * (noise.noise2D(nx * 2, ny * 2) * 0.5 + 0.5) +
        0.005 * (noise.noise2D(nx * 4, ny * 4) * 0.5 + 0.5);

    // Strong compression: almost all low, mountains extremely rare
    e = Math.pow(e, 4);

    e = Math.min(1, Math.max(0, e));
    return Math.round(e * 4000);
}

const WORLD_Y_MIN = -5000;
const WORLD_Y_MAX = 5000;
const WORLD_Y_SIZE = WORLD_Y_MAX - WORLD_Y_MIN + 1;
const WORLD_X_MIN = -5000;
const WORLD_X_MAX = 5000;
const WORLD_X_SIZE = WORLD_X_MAX - WORLD_X_MIN + 1;
const DRY_GRASS_HUMIDITY_THRESHOLD = 30;

// Patch getTileType to handle burnt, fresh, forced grass, and dry grass
const _originalGetTileType = getTileType;
function getTileTypePatched(x, y) {
    const key = `${x},${y}`;
    // Burnt/fresh/forced grass logic (from campfire.js)
    if (typeof burntTiles !== "undefined" && burntTiles.has(key)) {
        const info = burntTiles.get(key);
        if (info.stage === "burnt" && info.timeLeft > 0) return "burnt";
        if (info.stage === "fresh" && info.timeLeft > 0) return "fresh";
    }
    if (typeof forcedGrassTiles !== "undefined" && forcedGrassTiles.has(key)) return "grass";
    // Only check dry grass if base type is grass
    const baseType = _originalGetTileType(x, y);
    if (baseType === "grass" && typeof dryGrassTiles !== "undefined" && dryGrassTiles.has(key)) return "dry";
    return baseType;
}
window.getTileType = getTileTypePatched;

// Erosion map: stores erosion value for each tile (0 = none, 1 = max)
const erosionMap = new Map();

// Simulate erosion for a tile (x, y)
function simulateErosion(x, y) {
    // Get base elevation
    let elevation = getElevation(x, y);

    // Erosion is stronger at mid-elevations and near water
    let humidity = getHumidity(x, y);
    let isNearWater = false;
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            if (getTileType(wrapX(x + dx), wrapY(y + dy)) === "water") {
                isNearWater = true;
            }
        }
    }

    // Simple model: more erosion at mid elevation, high humidity, and near water
    let normElev = elevation / 4000;
    let erosion = 0;

    // Erosion peaks at mid elevations (hills/foothills)
    if (normElev > 0.15 && normElev < 0.7) {
        erosion += 0.5;
    }
    // More erosion if humid
    if (humidity > 60) {
        erosion += 0.3;
    }
    // More erosion if near water
    if (isNearWater) {
        erosion += 0.4;
    }

    // Clamp and store
    erosion = Math.min(1, Math.max(0, erosion));
    erosionMap.set(`${x},${y}`, erosion);
    return erosion;
}

// Get erosion value for a tile (x, y)
function getErosion(x, y) {
    const key = `${wrapX(x)},${wrapY(y)}`;
    if (erosionMap.has(key)) return erosionMap.get(key);
    return simulateErosion(x, y);
}

// Returns an array of {x, y} points representing a river path starting from (x, y)
function generateRiverPath(startX, startY, maxLength = 200) {
    let path = [];
    let x = startX, y = startY;
    let visited = new Set();
    let steps = 0;

    while (steps < maxLength) {
        path.push({x, y});
        visited.add(`${x},${y}`);

        // Stop at sea level, water, or another river (for merging)
        const elevation = getElevation(x, y);
        const tileType = getTileType(x, y);
        if (elevation <= 50 || tileType === "water" || tileType === "river") break;

        // Find the lowest neighbor (steepest descent)
        let lowest = {x, y, elevation};
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                let nx = wrapX(x + dx);
                let ny = wrapY(y + dy);
                let nelev = getElevation(nx, ny);
                if (nelev < lowest.elevation && !visited.has(`${nx},${ny}`)) {
                    lowest = {x: nx, y: ny, elevation: nelev};
                }
            }
        }

        // If no lower neighbor, stop (local minimum)
        if (lowest.x === x && lowest.y === y) break;

        // Move to the lowest neighbor
        x = lowest.x;
        y = lowest.y;
        steps++;
    }

    return path;
}

// Lower elevation along river paths to create valleys
function carveValleyAlongRiver(path) {
    for (let i = 0; i < path.length; i++) {
        const pt = path[i];
        // Valley depth: deeper near river center, shallower at edges
        const valleyDepth = Math.max(20, 80 - Math.floor(i / path.length * 60)); // 80m at source, 20m at mouth
        for (let dx = -2; dx <= 2; dx++) {
            for (let dy = -2; dy <= 2; dy++) {
                const key = `${wrapX(pt.x + dx)},${wrapY(pt.y + dy)}`;
                // Store valley depth in a map (to be subtracted from elevation)
                if (!window.valleyMap) window.valleyMap = new Map();
                window.valleyMap.set(key, Math.max(window.valleyMap.get(key) || 0, valleyDepth - (Math.abs(dx) + Math.abs(dy)) * 10));
            }
        }
    }
}

// Patch getElevation to include valley effect
const originalGetElevation = getElevation;
getElevation = function(x, y) {
    let elev = originalGetElevation(x, y);
    if (window.valleyMap) {
        const key = `${wrapX(x)},${wrapY(y)}`;
        if (window.valleyMap.has(key)) {
            elev -= window.valleyMap.get(key);
        }
    }
    return Math.max(0, elev);
};

const riverTiles = new Set();

function addRiver(startX, startY) {
    const path = generateRiverPath(startX, startY, 2000);
    carveValleyAlongRiver(path);
    let width = 1;
    for (let i = 0; i < path.length; i++) {
        const pt = path[i];
        if (riverTiles.has(`${pt.x},${pt.y}`)) {
            width = Math.min(width + 2, 20);
        }
        let progress = i / path.length;
        let naturalWidth = 1 + Math.floor(progress * 19);
        let riverWidth = Math.max(width, naturalWidth);
        for (let dx = -Math.floor(riverWidth / 2); dx <= Math.floor(riverWidth / 2); dx++) {
            for (let dy = -Math.floor(riverWidth / 2); dy <= Math.floor(riverWidth / 2); dy++) {
                riverTiles.add(`${wrapX(pt.x + dx)},${wrapY(pt.y + dy)}`);
            }
        }
    }
}


// Example: generate a few rivers at world generation
// Random river count between 50 and 200
const maxRivers = Math.floor(Math.random() * 151) + 50; // 50–200
let riverCount = 0;
const maxAttempts = 2000;

for (let i = 0; i < maxAttempts && riverCount < maxRivers; i++) {
    let x = Math.floor(Math.random() * 9000) - 4500;
    let y = Math.floor(Math.random() * 9000) - 4500;
    const elevation = getElevation(x, y);
    const humidity = getHumidity(x, y);

    if (elevation > 1500) {
        // Climate-dependent river spacing
        if (humidity > 60 && !isNearRiver(x, y, 50 + Math.floor(Math.random() * 150))) {
            // Humid: rivers every 50–200 tiles
            addRiver(x, y);
            riverCount++;
        } else if (humidity > 30 && !isNearRiver(x, y, 300 + Math.floor(Math.random() * 200))) {
            // Semi-arid: rivers every 300–500 tiles
            addRiver(x, y);
            riverCount++;
        } else if (humidity > 10 && !isNearRiver(x, y, 500 + Math.floor(Math.random() * 300))) {
            // Dry: rivers every 500–800 tiles
            addRiver(x, y);
            riverCount++;
        }
        // If humidity ≤ 10, no rivers (ephemeral or none)
    }
}

function isNearRiver(x, y, minDist = 50) {
    for (let dx = -minDist; dx <= minDist; dx++) {
        for (let dy = -minDist; dy <= minDist; dy++) {
            if (riverTiles.has(`${wrapX(x + dx)},${wrapY(y + dy)}`)) {
                return true;
            }
        }
    }
    return false;
}

function getNightCoolingByBiome(tileType) {
    switch (tileType) {
        case "desert":
            return 15;
        case "forest":
            return 8;
        case "water":
        case "coast":
        case "river":
            return 5;
        case "mountain":
        case "snow":
            return 10;
        default:
            return 6; // generic night cooling for other biomes
    }
}

function getBaseHumidityFromTemp(temp) {
    if (temp < -10) {
        // Very cold: 0–10%
        return 5 + Math.random() * 5;
    } else if (temp < 0) {
        // Cold: ~20%
        return 18 + Math.random() * 4;
    } else if (temp < 20) {
        // Cool to mild: ~40–60%
        return 40 + Math.random() * 20;
    } else if (temp < 40) {
        // Warm: ~60–80%
        return 60 + Math.random() * 20;
    } else {
        // Hot: ~20–40% (dry heat)
        return 20 + Math.random() * 20;
    }
}

function distanceToNearestWater(x, y, maxDist = 400) {
    for (let r = 1; r <= maxDist; r++) {
        for (let dx = -r; dx <= r; dx++) {
            for (let dy = -r; dy <= r; dy++) {
                if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue; // Only check perimeter
                let tx = wrapX(x + dx), ty = wrapY(y + dy);
                let type = getTileType(tx, ty);
                if (type === "water" || type === "river") {
                    return r;
                }
            }
        }
    }
    return maxDist + 1; // No water found within maxDist
}

// Call this for each tile to update rain/snow state
function updatePrecipitation(tile) {
    // Decrement rain_age if present
    if (tile.rain_age && tile.rain_age > 0) {
        tile.rain_age--;
        tile.raining = true;
    } else {
        tile.raining = false;
    }
    tile.snowing = false;

    // Decrement rain_cooldown if present
    if (tile.rain_cooldown && tile.rain_cooldown > 0) {
        tile.rain_cooldown--;
    }

    // Self-sustaining rain: if it rained last turn, boost humidity (evaporation)
    if (tile.rained_last_turn) {
        tile.humidity += 1;
    }

    // Only start new rain if not already raining AND not on cooldown
    if (!tile.raining && (!tile.rain_cooldown || tile.rain_cooldown <= 0) && tile.humidity >= 80) {
        const n = noise.noise2D(tile.x * 0.13 + 777, tile.y * 0.13 - 333) * 0.5 + 0.5;
        let chance = (tile.humidity - 80) / 120;

        const biome = getBiome(tile.x, tile.y);
        if (biome === "tropical") {
            chance *= 3; // Much more likely to rain in tropics
        }
        if (biome === "temperate") {
            chance *= 1.2; // Slightly more rain in temperate
        }
        if (biome === "subtropical") {
            chance *= 0.5; // Less rain in subtropics
        }

        if (tile.temperature >= 0) {
            if (n < chance) {
                tile.raining = true;
                tile.rain_age = 10;
                tile.humidity -= 10 + n * 20;
                tile.soil_moisture = (tile.soil_moisture || 0) + 20;
                if (tile.humidity >= 80) tile.humidity = 79;
            }
        } else {
            if (n < chance) {
                tile.snowing = true;
                tile.humidity -= 10 + n * 20;
                tile.soil_moisture = (tile.soil_moisture || 0) + 20;
            }
        }

        if (getBiome(tile.x, tile.y) === "tropical") {
            // Double the rain chance in tropics
            chance *= 2;
        }
    }

    // Always lose some humidity per frame while raining
    if (tile.raining) {
        tile.humidity -= 30;

        // --- Move raincloud downwind ---
        const windDir = getPrevailingWindDirection(tile.y);
        let dx = 0, dy = 0;
        if (windDir === "west_to_east") dx = 1;
        else if (windDir === "east_to_west") dx = -1;
        else if (windDir === "north_to_south") dy = 1;
        else if (windDir === "south_to_north") dy = -1;

        if (dx !== 0 || dy !== 0) {
            const downwindX = tile.x + dx;
            const downwindY = tile.y + dy;
            const downwindKey = `${downwindX},${downwindY}`;
            if (!tileCache[downwindKey]) tileCache[downwindKey] = { frame: currentCacheFrame, x: downwindX, y: downwindY };

            // --- Rain Shadow Effect: block rain if high elevation ---
            const elevation = getCachedElevation(downwindX, downwindY);
            if (elevation >= 1000) {
                // High elevation blocks raincloud movement
                // Optionally, you can reduce humidity here to simulate loss
                // tile.humidity -= 10;
            } else {
                // Share just enough humidity to drop below rain threshold
                const share = Math.max(0, tile.humidity - 79);
                tile.humidity -= share;
                tileCache[downwindKey].humidity = Math.min(100, (tileCache[downwindKey].humidity || 0) + share);

                // Only set rain_age if not already raining
                if ((tileCache[downwindKey].humidity || 0) >= 80 && (!tileCache[downwindKey].rain_age || tileCache[downwindKey].rain_age <= 0)) {
                    tileCache[downwindKey].rain_age = 20;
                }
            }
        }

        // Spread a small humidity boost to nearby tiles if raining
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                const nx = tile.x + dx;
                const ny = tile.y + dy;
                const nkey = `${nx},${ny}`;
                if (tileCache[nkey]) {
                    tileCache[nkey].humidity = Math.min(100, (tileCache[nkey].humidity || 0) + 2);
                }
            }
        }
    }

    // --- CLOUD LOGIC ---
    // A tile forms a cloud if it's very humid, not raining/snowing, and temp >= 10°C
    if (
        !tile.raining &&
        !tile.snowing &&
        tile.humidity >= 75 &&
        tile.temperature >= 10
    ) {
        // In tropical biome, increase cloud cover frequency
        if (getBiome(tile.x, tile.y) === "tropical") {
            // 80% chance of cloud cover each day (frame)
            const cloudChance = 0.8;
            // Use deterministic noise for "random" but stable cloud cover
            const n = noise.noise2D(tile.x * 0.21 + currentCacheFrame * 0.01, tile.y * 0.21 - currentCacheFrame * 0.01) * 0.5 + 0.5;
            tile.cloud = n < cloudChance;
        } else {
            tile.cloud = true;
        }
    } else {
        tile.cloud = false;
    }

    // Cloud spreads humidity downwind, but does not rain
    if (tile.cloud) {
        const windDir = getPrevailingWindDirection(tile.y);
        let dx = 0, dy = 0;
        if (windDir === "west_to_east") dx = 1;
        else if (windDir === "east_to_west") dx = -1;
        else if (windDir === "north_to_south") dy = 1;
        else if (windDir === "south_to_north") dy = -1;

        if (dx !== 0 || dy !== 0) {
            const downwindX = tile.x + dx;
            const downwindY = tile.y + dy;
            const downwindKey = `${downwindX},${downwindY}`;
            if (!tileCache[downwindKey]) tileCache[downwindKey] = { frame: currentCacheFrame, x: downwindX, y: downwindY };

            // Block cloud movement by high elevation (optional, like rain shadow)
            const elevation = getCachedElevation(downwindX, downwindY);
            if (elevation < 1000) {
                // Spread a small amount of humidity downwind
                const share = Math.min(3, tile.humidity - 70); // Only share excess
                if (share > 0) {
                    tile.humidity -= share;
                    tileCache[downwindKey].humidity = Math.min(100, (tileCache[downwindKey].humidity || 0) + share);
                }
            }
        }
    }

    // Clamp humidity
    tile.humidity = Math.max(0, Math.min(100, tile.humidity));

    // Track if it rained this turn for next turn
    tile.rained_last_turn = tile.raining;

    // If rain just ended, set cooldown
    if (!tile.raining && tile.rained_last_turn) {
        tile.rain_cooldown = 10; // 10 frames of cooldown before rain can restart
    }
}

// Tropical: -500 to +500 latitude
// Update getBiome to add Subtropical biome
function getBiome(x, y) {
    if (y >= -500 && y <= 500) {
        return "tropical";
    }
    if ((y > 500 && y <= 1500) || (y < -500 && y >= -1500)) {
        return "subtropical";
    }
    if ((y > 1500 && y <= 2500) || (y < -1500 && y >= -2500)) {
        return "temperate";
    }
    if ((y > 2500 && y <= 3000) || (y < -2500 && y >= -3000)) {
        return "subpolar";
    }
    // Polar: ±3000 to world edge
    if (Math.abs(y) > 3000) {
        return "polar";
    }
    return "default";
}


