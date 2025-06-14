// Global message variable for UI feedback
let message = "";

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