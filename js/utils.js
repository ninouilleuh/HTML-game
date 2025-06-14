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

// Get the type of a tile at (x, y)
function getTileType(x, y) {
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

// Helper to check if a grass tile is adjacent to a forest tile
function isNearForest(x, y) {
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            if (dx === 0 && dy === 0) continue;
            if (getTileType(x + dx, y + dy) === "forest") {
                return true;
            }
        }
    }
    return false;
}

// Helper to check if a tile is inside a forest
function isForest(x, y) {
    return getTileType(x, y) === "forest";
}

// Helper to check line of sight (Bresenham's line algorithm)
function hasLineOfSight(x0, y0, x1, y1) {
    let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    let sx = x0 < x1 ? 1 : -1;
    let sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let x = x0, y = y0;
    while (!(x === x1 && y === y1)) {
        if ((x !== x0 || y !== y0) && getTileType(x, y) === "mountain") return false;
        let e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x += sx; }
        if (e2 < dx) { err += dx; y += sy; }
    }
    return true;
}