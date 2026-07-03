// ==========================
// SETUP CANVAS & INPUT
// ==========================
const canvas = document.getElementById("roomCanvas");
const ctx = canvas.getContext("2d");
const input = document.getElementById("inputBox");
const progress = FocusRoom.getProgress();

// HUD element references
const roomCounterEl = document.getElementById('room-counter');
const inputCounterEl = document.getElementById('input-counter');
const exitHintEl = document.getElementById('exit-hint');
const containerEl = document.getElementById('container');

// ==========================
// LOAD ROOM IMAGES
// ==========================
const roomImages = [];
const scaryImages = [3, 7]; // indices of scary images (room4.png, room8.png)

// Phase questions (escalating)
const questions = {
  phase1: [
    "How aligned do you feel right now?",
    "Describe the last intrusive thought you noticed.",
    "What would make this space safer for you?",
    "Is your breathing steady?",
    "Name the color that feels calmest at this moment.",
    "What direction does your focus tilt toward?"
  ],
  phase2: [
    "The walls feel different. Do you notice?",
    "What is the shape of your doubt?",
    "How many times have you been in this room before?",
    "The silence between your thoughts — who owns it?",
    "What would happen if the room stopped listening?"
  ],
  phase3: [
    "You know why you're here, don't you?",
    "The data we collected says you're hiding something.",
    "Who are you when the room isn't watching?",
    "Your previous sessions suggest instability. Agree?",
    "The exit was never the point."
  ]
};

// Load images with error handling
let imagesLoaded = 0;
const totalImages = 10;
for (let i = 1; i <= totalImages; i++) {
  const img = new Image();
  img.onload = () => {
    imagesLoaded++;
    if (imagesLoaded === totalImages) {
      drawRoom(roomImages[0]);
    }
  };
  img.onerror = () => {
    console.warn(`Failed to load images/room${i}.png`);
    imagesLoaded++;
    if (imagesLoaded === totalImages) {
      drawRoom(roomImages[0]);
    }
  };
  img.src = `images/room${i}.png`;
  roomImages.push(img);
}

// Fallback: if images still haven't loaded after 5s, draw a procedural room
setTimeout(() => {
  if (imagesLoaded < totalImages) {
    console.warn('Images failed to load, using fallback background');
    drawRoom(null, 'normal');
  }
}, 5000);

// Fallback: if no images loaded, draw colored rect
canvas.addEventListener('error', () => {
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
});

// ==========================
// GAME STATE
// ==========================
let inputCount = 0;
let currentPhase = 1;
let scaryTimeout = null;
let scaryStage = 0;
let scaryProb = 0.05;
const scaryIncrement = 0.02;
const scaryMax = 0.6;
let lastQuestion = "";
let scaryCooldown = 0; // inputs between scary triggers (phase 3)
let currentRoom = 0; // tracks which room image index is displayed
let exitHintShown = false; // prevents race condition with updateHUD timing
const nonScaryIndices = roomImages.map((_, i) => i).filter(i => !scaryImages.includes(i));

// ==========================
// HUD & FEEDBACK
// ==========================
function updateHUD() {
  // Update room counter
  if (roomCounterEl) {
    roomCounterEl.textContent = String(currentRoom + 1);
  }
  // Update input counter
  if (inputCounterEl) {
    inputCounterEl.textContent = String(inputCount);
  }
  // Update phase dots
  for (let i = 1; i <= 3; i++) {
    const dot = document.getElementById('phase-dot-' + i);
    if (!dot) continue;
    dot.classList.remove('active', 'completed');
    if (i < currentPhase) dot.classList.add('completed');
    else if (i === currentPhase) dot.classList.add('active');
  }
  // Show exit hint after 5 inputs (use flag to avoid race condition)
  if (exitHintEl && inputCount >= 5 && !exitHintShown) {
    exitHintEl.classList.add('visible');
    exitHintShown = true;
  }
}

function showPhaseFlash(phase) {
  const flash = document.createElement('div');
  flash.className = 'phase-flash-overlay phase-' + phase + '-flash';
  containerEl.appendChild(flash);
  setTimeout(() => flash.remove(), 900);
}

function flashInputFeedback(type) {
  const cls = 'feedback-' + type;
  input.classList.add(cls);
  setTimeout(() => input.classList.remove(cls), 1200);
}

// Leave Room button: show confirmation after 8+ inputs
const leaveBtn = document.getElementById('leave-room-btn');
if (leaveBtn) {
  leaveBtn.addEventListener('click', (e) => {
    if (inputCount < 8) {
      e.preventDefault();
      // Show a message on canvas instead of leaving
      showTextOnCanvas("The room is not finished with you yet. Keep going.");
      // Flash the button briefly
      leaveBtn.style.borderColor = '#ff4444';
      leaveBtn.style.color = '#ff4444';
      setTimeout(() => {
        leaveBtn.style.borderColor = '';
        leaveBtn.style.color = '';
      }, 1500);
    }
    // After 8+ inputs, the default <a> href="results.html" works naturally
  });
}

// ==========================
// DRAW FUNCTION
// ==========================
function drawRoom(image, effect) {
  // Track current room index
  if (image && roomImages.indexOf(image) !== -1) {
    currentRoom = roomImages.indexOf(image);
  }

  // Fade transition
  canvas.classList.add('fading');
  setTimeout(() => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (image && image.complete && image.naturalWidth > 0) {
      // Phase effects
      if (effect === 'dim') {
        ctx.filter = 'brightness(0.6) contrast(1.2)';
      } else if (effect === 'distort') {
        ctx.filter = 'brightness(0.4) contrast(1.5) saturate(0.3)';
      } else {
        ctx.filter = 'none';
      }
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      ctx.filter = 'none';

      // Phase 3: add glitch overlay
      if (effect === 'distort') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        for (let i = 0; i < 5; i++) {
          const y = Math.random() * canvas.height;
          const h = Math.random() * 20 + 5;
          ctx.fillRect(0, y, canvas.width, h);
        }
      }
    } else {
      // Fallback colored background
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#666';
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('The room is loading...', canvas.width / 2, canvas.height / 2);
    }
    canvas.classList.remove('fading');
    updateHUD();
  }, 200);
}

// ==========================
// INPUT HANDLER
// ==========================
function handleUserInput() {
  const text = input.value.trim();
  if (!text) return;

  // Increment input count for this input
  inputCount++;

  // Easter egg: type "focus"
  if (text.toLowerCase() === 'focus') {
    drawRoom(roomImages[(inputCount - 1) % roomImages.length], currentPhase >= 3 ? 'distort' : currentPhase >= 2 ? 'dim' : 'normal');
    showTextOnCanvas("You see it now.");
    input.value = "";
    return;
  }

  // Exit mechanic: after 15+ inputs, exact "exit" returns to results
  if (inputCount >= 15 && text.toLowerCase() === 'exit') {
    showTextOnCanvas("The room releases you. For now.");
    input.value = "";
    setTimeout(() => {
      window.location.href = 'results.html';
    }, 1500);
    return;
  }

  // Save to progress
  progress.gameInputs.push(text);
  FocusRoom.saveProgress(progress);

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
// TEXT ON CANVAS
// ==========================
function showTextOnCanvas(text) {
  const overlayHeight = 140;
  const padding = 24;
  ctx.save();
  ctx.clearRect(0, canvas.height - overlayHeight - 10, canvas.width, overlayHeight + 10);

  if (text) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, canvas.height - overlayHeight, canvas.width, overlayHeight);

    ctx.fillStyle = "#f5f5f5";
    ctx.font = "24px 'Helvetica Neue', Arial, sans-serif";
    ctx.textBaseline = "top";

    const words = text.split(" ");
    const lineHeight = 30;
    let line = "";
    let y = canvas.height - overlayHeight + padding;

    words.forEach((word) => {
      const testLine = line ? `${line} ${word}` : word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > canvas.width - padding * 2) {
        ctx.fillText(line, padding, y);
        line = word;
        y += lineHeight;
      } else {
        line = testLine;
      }
    });

    if (line) {
      ctx.fillText(line, padding, y);
    }
  }

  ctx.restore();
}

// ==========================
// INTERPRET ANSWER
// ==========================
function interpretAnswer(text) {
  const normalized = text.toLowerCase();
  if (!normalized) return "neutral";
  if (/\bpanic\b|\bfear\b|\bscared\b|\bafraid\b|\bhelp\b|\brun\b|\bdark\b|\bterrified\b/.test(normalized)) return "fear";
  if (/\bcalm\b|\bsteady\b|\baligned\b|\bok\b|\bfine\b|\bpeace\b|\bsafe\b|\brest\b/.test(normalized)) return "calm";
  return "neutral";
}

// ==========================
// ASK QUESTION
// ==========================
function askQuestion() {
  const pool = questions[`phase${currentPhase}`] || questions.phase1;
  let newQuestion;
  do {
    newQuestion = pool[Math.floor(Math.random() * pool.length)];
  } while (newQuestion === lastQuestion && pool.length > 1);
  lastQuestion = newQuestion;
  showTextOnCanvas(lastQuestion);
}

// ==========================
// REACT TO INPUT (MAIN LOGIC)
// ==========================
function reactToInput(text) {
  if (!text) return;

  // If returning visitor, start at higher phase (inputCount is 1 on first call)
  if (inputCount === 1 && progress.totalVisits > 2) {
    currentPhase = Math.min(2, currentPhase + 1);
  }

  // Determine phase based on input count
  const oldPhase = currentPhase;
  if (inputCount >= 9 && currentPhase < 3) {
    currentPhase = 3;
  } else if (inputCount >= 6 && currentPhase < 2) {
    currentPhase = 2;
  }
  // Fire phase transition effect
  if (currentPhase !== oldPhase) {
    showPhaseFlash(currentPhase);
  }

  const reaction = interpretAnswer(text);

  // Visual feedback on input box based on sentiment
  if (reaction === 'fear' || reaction === 'calm') {
    flashInputFeedback(reaction);
  }

  // Update counts
  if (reaction === 'fear') progress.fearCount++;
  if (reaction === 'calm') progress.calmCount++;
  FocusRoom.saveProgress(progress);

  // Phase-specific effects
  const phaseEffect = currentPhase >= 3 ? 'distort' : currentPhase >= 2 ? 'dim' : 'normal';

  // Cancel previous scary timer
  if (scaryTimeout) {
    clearTimeout(scaryTimeout);
    scaryTimeout = null;
  }

  // Decide scary trigger (check BEFORE decrementing cooldown)
  let triggerScary = false;
  const canShowScary = scaryStage < scaryImages.length;

  if (currentPhase === 1) {
    // Phase 1: low probability, no cooldown
    triggerScary = canShowScary && Math.random() < scaryProb;
  } else if (currentPhase === 2) {
    // Phase 2: medium probability
    triggerScary = canShowScary && Math.random() < Math.min(scaryProb + 0.1, 0.4);
  } else {
    // Phase 3: high probability but with 3-input cooldown
    triggerScary = canShowScary && scaryCooldown === 0 && Math.random() < 0.5;
  }

  // Fear reaction always triggers scary if available
  if (reaction === 'fear' && canShowScary && (currentPhase < 3 || scaryCooldown === 0)) {
    triggerScary = true;
  }

  // Phase 3: scary cooldown — decrement AFTER trigger check
  if (scaryCooldown > 0) {
    scaryCooldown--;
  }

  // nonScaryIndices precomputed at init

  if (triggerScary && canShowScary) {
    // Show scary image
    const scaryIndex = scaryImages[scaryStage];
    drawRoom(roomImages[scaryIndex], phaseEffect);
    showTextOnCanvas("");

    // Auto-swap after duration based on phase
    const duration = currentPhase === 3 ? 800 : currentPhase === 2 ? 1200 : 1500;
    scaryTimeout = setTimeout(() => {
      const nextIndex = nonScaryIndices[Math.floor(Math.random() * nonScaryIndices.length)];
      drawRoom(roomImages[nextIndex], phaseEffect);
      askQuestion();
      scaryTimeout = null;
    }, duration);

    scaryStage = (scaryStage + 1) % scaryImages.length;
    if (currentPhase === 3) scaryCooldown = 3; // inputs between triggers (decrement happens after)
    scaryProb = 0.05;
  } else {
    // Normal room
    const randomIndex = nonScaryIndices[Math.floor(Math.random() * nonScaryIndices.length)];
    drawRoom(roomImages[randomIndex], phaseEffect);
    askQuestion();
    scaryProb = Math.min(scaryProb + scaryIncrement, scaryMax);
  }
}

// Initial question after load
setTimeout(() => askQuestion(), 1000);
