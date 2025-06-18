// ORGANIZATION RULES:

// YES:

//Global game state variables:
//Variables that represent the current state of the game and are updated as the game runs, such as:

//totalDay, seasonDay, currentSeason, currentSeasonIndex
//timeOfDay, message
//Arrays or objects tracking dynamic entities (e.g., enemies, fires, placedCampfires)
//Any other variables that change during gameplay and are needed across modules
//Functions for managing or resetting game state:

//Functions to reset, save, or load the game state
//Functions to advance the day, season, or other global state transitions

// NO:

//Constants or configuration:
//E.g., tile colors, season names, pixel size, etc. (should be in constants.js)
//Utility/helper functions:
//E.g., wrapX, getBiome, isNearWater (should be in utils.js)
//Rendering or drawing logic:
//E.g., drawMap, drawEnemies, etc. (should be in map.js, enemy.js, etc.)
//Game logic for specific systems:
//E.g., enemy AI, campfire logic, inventory management (should be in their respective files)
//Event listeners or main loop code:
//E.g., input handling, startGame, dayNightLoop (should be in main.js)

////                    DOES NOT GO HERE!                  ////
////                                                       ////
///////////////////////////////////////////////////////////////

//  --- TIME RELATED VARIABLES ---

let totalDay = 0; // Total days since game start
let timeOfDay = 0.25; // 0 = midnight, 0.25 = 6h, 0.5 = noon, 0.75 = 18h

let currentSeasonIndex = 0;
// Index of the current season in the SEASONS array.