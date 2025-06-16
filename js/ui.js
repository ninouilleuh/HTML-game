// Global message variable for UI feedback
let message = "";

// Selected item variable
let selectedItem = null;

// Draw message box if a message is set
function drawMessage() {
    if (!message) return;
    ctx.save();
    ctx.font = "18px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const lines = message.split("\n");
    const boxWidth = Math.max(...lines.map(line => ctx.measureText(line).width)) + 40;
    const boxHeight = 40 + lines.length * 28;
    const x = canvas.width / 2 - boxWidth / 2;
    const y = canvas.height - boxHeight - 40;

    // Background
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    ctx.fillRect(x, y, boxWidth, boxHeight);

    // Border
    ctx.strokeStyle = "#FFD700";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, boxWidth, boxHeight);

    // Text
    ctx.fillStyle = "#fff";
    lines.forEach((line, i) => {
        ctx.fillText(line, canvas.width / 2, y + 28 + i * 28);
    });

    // Hint
    ctx.font = "14px monospace";
    ctx.fillStyle = "#FFD700";
    ctx.fillText("Press [Space] or click to continue", canvas.width / 2, y + boxHeight - 14);
    ctx.restore();
}

// Top left: tile type and inventory
function drawTopLeftDebugOverlay() {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(10, 10, 320, 60);
    ctx.fillStyle = "#fff";
    ctx.font = "16px monospace";
    const tileType = getTileType(player.x, player.y);
    ctx.fillText(`Tile: ${tileType}`, 18, 30);

    // Show elevation for debug
    if (typeof getElevation === "function") {
        const elevation = getElevation(player.x, player.y);
        ctx.fillText(`Elevation: ${elevation}m`, 18, 50);
    }

    // Show erosion for debug
    if (typeof getErosion === "function") {
        const erosion = getErosion(player.x, player.y);
        ctx.fillText(`Erosion: ${(erosion * 100).toFixed(0)}%`, 18, 70);
    }

    ctx.restore();
}

function drawTopRightInfoBox() {
    ctx.save();
    const boxWidth = 220;
    const boxHeight = 90; // Increased height for humidity line
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(canvas.width - boxWidth - 10, 10, boxWidth, boxHeight);
    ctx.fillStyle = "#fff";
    ctx.font = "16px monospace";
    let y = 30;
    let x = canvas.width - boxWidth;
    // Hour
    if (typeof timeOfDay !== "undefined") {
        let hour = Math.floor((timeOfDay * 24)) % 24;
        let minute = Math.floor((timeOfDay * 24 * 60)) % 60;
        let timeStr = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
        ctx.fillText(`Time: ${timeStr}`, x + 8, y);
        y += 20;
    }
    // Temp
    if (typeof getTemperature === "function") {
        const temp = getTemperature(player.x, player.y);
        ctx.fillText(`Temp: ${temp}°C`, x + 8, y);
        y += 20;
    }
    // Humidity
    if (typeof getHumidity === "function") {
        const humidity = getCachedHumidity(player.x, player.y);
        ctx.fillText(`Humidity: ${humidity}%`, x + 8, y);
        y += 20;
    }
    // Wind Direction - NEW
    if (typeof getPrevailingWindDirection === "function") {
        const windDir = getPrevailingWindDirection(player.y);
        let windStr = "";
        switch (windDir) {
            case "west_to_east": windStr = " West → East"; break;
            case "east_to_west": windStr = " East ← West"; break;
            default: windStr = windDir;
        }
        ctx.fillText(`Wind: ${windStr}`, x + 8, y);
        y += 20;
    }
    // Season/Day
    if (typeof currentSeason !== "undefined") {
        ctx.fillText(`Season: ${currentSeason} (${seasonDay + 1}/${DAYS_PER_SEASON})`, x + 8, y);
    }
    ctx.restore();
}