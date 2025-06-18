// ORGANIZATION RULES:

// YES:

//All logic related to the player's inventory:
//Functions for counting, adding, removing, or checking items in the inventory (like countInInventory, removeFromInventory).
//Functions for using, equipping, or selecting inventory items.
//Inventory management helpers (sorting, grouping, displaying inventory).
//Possibly the inventory data structure itself (e.g., player.inventory if not already in player.js).

// NO:

//Game logic unrelated to inventory:
//E.g., player movement, map drawing, enemy AI, campfire logic, etc.
//General-purpose utility functions:
//E.g., wrapX, getBiome, etc.
//Constants/configuration unrelated to inventory:
//E.g., tile colors, season names, etc. (should be in constants.js).
//Rendering logic for non-inventory UI:
//E.g., drawing the map, enemies, or campfires (should be in their respective files).
//Event listeners for unrelated input:
//E.g., movement keys, map clicks, etc.

////                    DOES NOT GO HERE!                    ////

//Player movement, map, or enemy logic
//General utility functions
//Non-inventory UI rendering
//Unrelated constants/configuration


// Count how many of an item are in the player's inventory
function countInInventory(item) {
    return player.inventory.filter(i => i === item).length;
}

// Remove a certain number of an item from the player's inventory
function removeFromInventory(item, count) {
    let removed = 0;
    player.inventory = player.inventory.filter(i => {
        if (i === item && removed < count) {
            removed++;
            return false;
        }
        return true;
    });
}
// ...other inventory functions...