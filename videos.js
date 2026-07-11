/* ===== videos.js — Archive: Sensory Recalibration ===== */

const chatLog = document.getElementById('chat-log');

const messages = [
    "Connection secure.",
    "Subject identified. Pulse: Accelerated.",
    "You're watching the eye, aren't you?",
    "Don't worry. It's watching you back.",
    "The calibration is 42% complete.",
    "Your reflection is looking tired.",
    "Would you like to see what's behind the mirror?",
    "Do not close this window. We are almost finished."
];

let messageIndex = 0;

function addMessage() {
    if (messageIndex < messages.length) {
        const entry = document.createElement('div');
        entry.style.marginBottom = "10px";
        entry.innerHTML = `<span style="opacity:0.5;">[${new Date().toLocaleTimeString()}]</span> > ${messages[messageIndex]}`;
        chatLog.appendChild(entry);

        // Auto-scroll chat
        chatLog.scrollTop = chatLog.scrollHeight;

        messageIndex++;
        // New message every 6 to 12 seconds
        setTimeout(addMessage, Math.random() * 6000 + 6000);
    }
}

// Start the agent messages after 4 seconds
setTimeout(addMessage, 4000);

// All feed imagery (served as WebP)
const imagePool = [
    'images/room1.webp',
    'images/room2.webp',
    'images/room3.webp',
    'images/room4.webp',
    'images/room5.webp',
    'images/room6.webp',
    'images/room7.webp',
    'images/room8.webp',
    'images/room9.webp',
    'images/room10.webp'
];

// This selects ALL feeds with the class "image-feed"
const allImageFeeds = document.querySelectorAll('.image-feed');

allImageFeeds.forEach(feed => {
    feed.addEventListener('click', () => {
        const img = feed.querySelector('.surveillance-img');

        // 1. Glitch Effect
        img.style.filter = "invert(100%) contrast(500%) blur(20px)";
        feed.style.backgroundColor = "#fff";

        // 2. Random Swap
        let newIndex = Math.floor(Math.random() * imagePool.length);

        setTimeout(() => {
            img.src = imagePool[newIndex];

            // 3. Reset Styles
            img.style.filter = "grayscale(100%) contrast(150%) brightness(0.7) blur(0.5px)";
            feed.style.backgroundColor = "#000";

            // 4. Update the Agent Chat
            const log = document.getElementById('chat-log');
            const entry = document.createElement('div');
            entry.innerHTML = `> <span style="color:red;">INTERCEPT:</span> Switching feed to ${imagePool[newIndex]}`;
            log.appendChild(entry);
            log.scrollTop = log.scrollHeight;
        }, 150);
    });
});
