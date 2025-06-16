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

function setLoadingProgress(percent, msgIndex = null) {
    const bar = document.getElementById('loading-bar');
    const msg = document.getElementById('loading-message');
    if (bar) bar.style.width = percent + "%";
    if (msg && msgIndex !== null && loadingMessages[msgIndex]) {
        msg.textContent = loadingMessages[msgIndex];
    }
}

window.loadingBarShouldRun = true;

function loopingLoadingBar() {
    let msgIdx = 0;
    const steps = 100;
    const interval = 18; // ms per step

    function animateBar() {
        let percent = 0;
        setLoadingProgress(0, msgIdx);

        const timer = setInterval(() => {
            // Stop if the game says we're ready
            if (!window.loadingBarShouldRun) {
                clearInterval(timer);
                // Hide the loading screen
                const loading = document.getElementById('loading-screen');
                if (loading) loading.style.display = 'none';
                return;
            }
            percent++;
            setLoadingProgress(percent, msgIdx);

            if (percent >= 100) {
                clearInterval(timer);
                msgIdx = (msgIdx + 1) % loadingMessages.length;
                setTimeout(() => {
                    if (window.loadingBarShouldRun) animateBar();
                }, 400); // Short pause before next message
            }
        }, interval);
    }

    animateBar();
}

window.addEventListener('DOMContentLoaded', loopingLoadingBar);