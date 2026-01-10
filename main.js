// ==========================
// SETUP CANVAS & INPUT
// ==========================
const canvas = document.getElementById("roomCanvas");
const ctx = canvas.getContext("2d");
const input = document.getElementById("inputBox");

// ==========================
// LOAD ROOM IMAGES
// ==========================
const roomImages = [];
const scaryImages = [3, 7]; // indices of scary images (room4.png, room8.png)
for (let i = 1; i <= 10; i++) {
  const img = new Image();
  img.src = `images/room${i}.png`;
  roomImages.push(img);
}

// ==========================
// DRAW FUNCTION
// ==========================
function drawRoom(image) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
}

// Show the first room once loaded
roomImages[0].onload = () => drawRoom(roomImages[0]);

// ==========================
// INPUT HANDLER
// ==========================
function handleUserInput() {
  const text = input.value.trim();
  if (!text) return;
  reactToInput(text);
  input.value = "";
}

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    handleUserInput();
  }
});

// ==========================
// REACT TO INPUT
// ==========================
let scaryTimeout = null; // tracks scary image auto-swap

function reactToInput(text) {
  if (!text) return;

  if (scaryTimeout) {
    clearTimeout(scaryTimeout);
    scaryTimeout = null;
  }

  // Step 1: pick a random image for user input
  let randomIndex = Math.floor(Math.random() * roomImages.length);
  drawRoom(roomImages[randomIndex]);

  // Step 2: if it is a scary image and no scary timer is active
  if (scaryImages.includes(randomIndex)) {
    // Schedule auto-swap after 2 seconds
    scaryTimeout = setTimeout(() => {
      // pick a non-scary image
      const nonScaryIndices = roomImages
        .map((_, i) => i)
        .filter(i => !scaryImages.includes(i));

      const nextIndex = nonScaryIndices[Math.floor(Math.random() * nonScaryIndices.length)];
      drawRoom(roomImages[nextIndex]);

      // clear the timeout tracker
      scaryTimeout = null;
    }, 1500);
  }

  console.log(`User typed: "${text}", room changed to room${randomIndex + 1}.png`);
}







