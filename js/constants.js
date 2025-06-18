// ORGANIZATION RULES:

// YES:

// Global constants (values that do not change during gameplay)
// Configuration values (tile colors, pixel size, season names, etc.)
// Utility functions that are truly constant (e.g., isDay() if it just checks a value)
// Global variables that are set once and rarely changed (e.g., window.isMobile, window.pixelSize)

// NO:

// Game state variables that change frequently (e.g., totalDay, seasonDay, currentSeasonIndex, currentSeason)
// Functions that modify game state (e.g., advanceSeasonDay())
// Game logic or mechanics (e.g., day/night cycle logic, season advancement)
// Temporary or dynamic values (e.g., message)

///                    DOES NOT GO HERE!                    ////


//let currentSeason = SEASONS[currentSeasonIndex];
//let seasonDay = 0;
//function advanceSeasonDay() { ... }
//Any code that modifies state or is part of the game’s main logic

// Detect if on mobile device
window.isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
// Checks the browser's user agent string for mobile device keywords and sets window.isMobile to true or false.

// Increase pixelSize for even more zoom on mobile
window.pixelSize = window.isMobile ? 28 : 14; // 28 for mobile, 14 for desktop
// Sets the size of each map tile in pixels: larger on mobile for easier viewing, smaller on desktop.

// Define colors for each tile type
const tileColors = {
    grass: "#4caf50", // Green for grass
    forest: "#2e7d32", // Dark green for forest
    hill: "#bdb76b",    // khaki or similar for hills
    water: "#2196f3", // Blue for water
    mountain: "#888888", // Gray for mountains
    snow: "#e0f7fa", // Light blue for snow
    river : "#2196f3", // Blue for rivers
    lake : "#6db3c7", // Lighter blue for lakes
    swamp : "#7e9e6c", // Olive green for swamps
    wetland: "#4e8d6c", // Teal green for wetlands
};


// --- Add these for day/night cycle ---


// Represents the current time of day as a fraction (0 to 1).
const timeSpeedDay = 1 / (60 * 60 * 12 * 5);   // 12 minutes for a full day 
// Speed at which timeOfDay advances during the day (fraction per frame).
const timeSpeedNight = 1 / (60 * 60 * 24 * 5); // 24 minutes for a full night (slower)
// Speed at which timeOfDay advances during the night (fraction per frame).

function isDay() {
    return timeOfDay >= 0.23 && timeOfDay < 0.77; // 6h-18h
}
// Returns true if the current timeOfDay is between 6am and 6pm (daytime).

// --- Season system --- //

const SEASONS = ["spring", "summer", "autumn", "winter"];
// Array of seasons names.


let currentSeason = SEASONS[currentSeasonIndex];
// Name of the current season.

let seasonDay = 0; 
// Counter for how many days have passed in the current season.

const DAYS_PER_SEASON = 30; 
// Number of days in each season.
// xxx// tropical wet season should be 180 days, dry season 165 days // temperate Spring should be 92 days summer 93 autumn 89 and winter 88.// xxx//


function advanceSeasonDay() {
    seasonDay++;
    totalDay++;
    if (seasonDay >= DAYS_PER_SEASON) {
        seasonDay = 0;
        currentSeasonIndex = (currentSeasonIndex + 1) % SEASONS.length;
        currentSeason = SEASONS[currentSeasonIndex];
        message = `The season has changed to ${currentSeason.toUpperCase()}!`;
    }
}
// Call this function at the end of each in-game day to advance the day and handle season changes.
// When a season ends, it cycles to the next season and displays a message.