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