// Detect if on mobile device
window.isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// Increase pixelSize for even more zoom on mobile
window.pixelSize = window.isMobile ? 28 : 14; // 48 for mobile, 14 for desktop

const tileColors = {
    grass: "#4caf50",
    forest: "#2e7d32",
    hill: "#bdb76b",    // khaki or similar for hills
    water: "#2196f3",
    mountain: "#888888",
    snow: "#e0f7fa",
    river : "#2196f3",

    
};

// --- Add these for day/night cycle ---
let timeOfDay = 0.25; // 0 = midnight, 0.25 = 6h, 0.5 = noon, 0.75 = 18h
const timeSpeedDay = 1 / (60 * 60 * 12 * 5);   // 12 minutes for a full day (adjust as you wish)
const timeSpeedNight = 1 / (60 * 60 * 24 * 5); // 24 minutes for a full night (slower)
function isDay() {
    return timeOfDay >= 0.23 && timeOfDay < 0.77; // 6h-18h
}

// --- Season system ---
const SEASONS = ["spring", "summer", "autumn", "winter"];
let currentSeasonIndex = 0;
let currentSeason = SEASONS[currentSeasonIndex];
let seasonDay = 0; // Days since start of current season
const DAYS_PER_SEASON = 30; // 30 in-game days per season

// Call this at the end of each in-game day
function advanceSeasonDay() {
    seasonDay++;
    if (seasonDay >= DAYS_PER_SEASON) {
        seasonDay = 0;
        currentSeasonIndex = (currentSeasonIndex + 1) % SEASONS.length;
        currentSeason = SEASONS[currentSeasonIndex];
        message = `The season has changed to ${currentSeason.toUpperCase()}!`;
    }
}