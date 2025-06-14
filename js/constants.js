const pixelSize = 32;
const tileColors = {
    grass: "#4caf50",
    forest: "#2e7d32",
    water: "#2196f3",
    mountain: "#888888"
};

// --- Add these for day/night cycle ---
let timeOfDay = 0.25; // 0 = midnight, 0.25 = 6h, 0.5 = noon, 0.75 = 18h
const timeSpeedDay = 1 / (60 * 60 * 2);   // 2 minutes for a full day (adjust as you wish)
const timeSpeedNight = 1 / (60 * 60 * 4); // 4 minutes for a full night (slower)
function isDay() {
    return timeOfDay >= 0.23 && timeOfDay < 0.77; // 6h-18h
}