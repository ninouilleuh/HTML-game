// ORGANIZATION RULES:

// YES:

//All logic related to the loading screen/bar:
//Functions and variables for displaying, updating, and hiding the loading bar and loading messages.
//Loading messages and animation:
//Arrays of messages, animation timers, and progress updates for the loading UI.
//DOM manipulation for loading elements:
//Code that updates or hides the loading bar/message elements.
//Flags or state related to the loading process:
//E.g., window.loadingBarShouldRun.

// NO:

//Game logic unrelated to loading:
//E.g., map generation, player setup, enemy spawning, etc.
//Main game loop or gameplay event listeners:
//E.g., startGame(), dayNightLoop(), or input handling.
//Constants or configuration for the main game:
//E.g., tile colors, season names, etc.
//Utility functions not related to loading:
//E.g., noise functions, biome checks, etc.
//Rendering or UI logic for anything except the loading screen.

////                    DOES NOT GO HERE!                    ////

//Any game setup or main loop logic
//Any gameplay or map logic
//Any unrelated UI or rendering code


// Array of fun loading messages to display during loading
const loadingMessages = [
    "Filling the seas...",
    "Curving the mountains...",
    "Growing the forests...",
    "Planting the grass...",
    "Scattering the stones...",
    "Carving the rivers...",
    "Spawning wildlife...",
    "Warming the sun...",
    "Settling the clouds...",
    "Breathing the wind..."
];

// Updates the loading bar's width and message
function setLoadingProgress(percent, msgIndex = null) {
    const bar = document.getElementById('loading-bar'); // Get the loading bar element
    const msg = document.getElementById('loading-message');  // Get the loading message element
    if (bar) bar.style.width = percent + "%"; // Set bar width
    if (msg && msgIndex !== null && loadingMessages[msgIndex]) {
        msg.textContent = loadingMessages[msgIndex]; // Set loading message
    }
}
// Global flag to control whether the loading bar should keep running
window.loadingBarShouldRun = true;

// Main function to animate the loading bar and cycle messages
function loopingLoadingBar() {
    let msgIdx = 0; // Current message index
    const steps = 100; // Number of steps to fill the bar
    const interval = 18; // ms per step
    // Animates the loading bar from 0 to 100%
    function animateBar() {
        let percent = 0;
        setLoadingProgress(0, msgIdx); // Start at 0% with current message

        const timer = setInterval(() => {
           // If the game is ready, stop the loading bar and hide the screen
            if (!window.loadingBarShouldRun) {
                clearInterval(timer);
                // Hide the loading screen
                const loading = document.getElementById('loading-screen');
                if (loading) loading.style.display = 'none';
                return;
            }
            percent++;
            setLoadingProgress(percent, msgIdx); // Update bar and message

            // When bar reaches 100%, cycle to next message and restart
            if (percent >= 100) {
                clearInterval(timer);
                msgIdx = (msgIdx + 1) % loadingMessages.length; // Next message
                setTimeout(() => {
                    if (window.loadingBarShouldRun) animateBar(); // Restart if still loading
                }, 400); // Short pause before next message
            }
        }, interval);
    }

    animateBar();// Start the animation
}

// Start the loading bar animation when the DOM is ready

window.addEventListener('DOMContentLoaded', loopingLoadingBar);