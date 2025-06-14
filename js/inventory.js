// Draw inventory on screen
function drawInventory() {
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(10, 50, 220, 30);
    ctx.fillStyle = "#fff";
    ctx.font = "16px monospace";
    ctx.fillText(
        "Inventory: " + (player.inventory.length ? player.inventory.join(", ") : "(empty)"),
        18,
        70
    );
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