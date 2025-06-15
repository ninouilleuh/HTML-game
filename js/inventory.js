// Draw inventory on screen
function drawInventory() {
    ctx.fillStyle = "#fff";
    ctx.font = "16px monospace";
    let invText = "Inventory: " + (player.inventory.length ? player.inventory.join(", ") : "(empty)");
    if (typeof selectedItem !== "undefined" && selectedItem) {
        invText += `  [Selected: ${selectedItem}]`;
    }
    // Move inventory text up to avoid being too low (was y=70)
    ctx.fillText(invText, 18, 50);
}

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