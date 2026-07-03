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
const fpCounterEl = document.getElementById('fp-counter');
const alignCounterEl = document.getElementById('align-counter');
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
    drawRoom(roomImages[0], 'normal');
  }
}, 5000);

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
let scaryCooldown = 0;
let currentRoom = 0;
let exitHintShown = false;

// Scoring state
let focusPoints = progress.focusPoints || 0;
let roomsCompleted = progress.roomsCompleted || 0;
const totalRooms = 10;
const WIN_ALIGNMENT = 70;
let gameEnded = false;
let gameWon = false;

const nonScaryIndices = roomImages.map((_, i) => i).filter(i => !scaryImages.includes(i));

// ==========================
// HUD & FEEDBACK
// ==========================
function calculateAlignment() {
  const total = (progress.calmCount || 0) + (progress.fearCount || 0);
  if (total === 0) return 100; // neutral answers = no fear = aligned
  return ((progress.calmCount || 0) / total) * 100;
}

function updateHUD() {
  // Update room counter
  if (roomCounterEl) {
    roomCounterEl.textContent = String(Math.min(roomsCompleted + 1, totalRooms));
  }
  // Update input counter
  if (inputCounterEl) {
    inputCounterEl.textContent = String(inputCount);
  }
  // Update focus points
  if (fpCounterEl) {
    fpCounterEl.textContent = String(focusPoints);
  }
  // Update alignment
  if (alignCounterEl) {
    const total = (progress.calmCount || 0) + (progress.fearCount || 0);
    if (total === 0) {
      alignCounterEl.textContent = '--';
    } else {
      const alignment = calculateAlignment();
      alignCounterEl.textContent = Math.round(alignment) + '%';
    }
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
    if (gameEnded) {
      if (gameWon) {
        // Allow navigation — game is over, player earned the exit
        return;
      } else {
        e.preventDefault();
        showTextOnCanvas("You can't leave. The room keeps you now.");
        leaveBtn.style.borderColor = '#ff4444';
        leaveBtn.style.color = '#ff4444';
        setTimeout(() => {
          leaveBtn.style.borderColor = '';
          leaveBtn.style.color = '';
        }, 1500);
        return;
      }
    }
    if (roomsCompleted < 8) {
      e.preventDefault();
      showTextOnCanvas("The room is not finished with you yet. Keep going.");
      leaveBtn.style.borderColor = '#ff4444';
      leaveBtn.style.color = '#ff4444';
      setTimeout(() => {
        leaveBtn.style.borderColor = '';
        leaveBtn.style.color = '';
      }, 1500);
    }
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

  // If game has ended, only "exit" works (and even then, only if won)
  if (gameEnded) {
    if (text.toLowerCase() === 'exit' && gameWon) {
      showTextOnCanvas("The room releases you. For now.");
      input.value = "";
      setTimeout(() => {
        window.location.href = 'results.html';
      }, 1500);
    } else if (text.toLowerCase() === 'exit') {
      showTextOnCanvas("There is no exit. There was never an exit.");
      input.value = "";
    } else {
      showTextOnCanvas("The walls don't respond. Nothing matters here anymore.");
      input.value = "";
    }
    return;
  }

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
    // Save alignment before exiting
    progress.finalAlignment = Math.round(calculateAlignment());
    progress.roomsCompleted = roomsCompleted;
    FocusRoom.saveProgress(progress);
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

// Touch support: tap canvas to focus input
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  input.focus();
}, { passive: false });

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
  if (!text || gameEnded) return;

  // If returning visitor, start at higher phase (roomsCompleted is 1 on first call)
  if (roomsCompleted === 1 && progress.totalVisits > 2) {
    currentPhase = Math.min(2, currentPhase + 1);
  }

  // Determine phase based on room completion
  const oldPhase = currentPhase;
  if (roomsCompleted >= 8 && currentPhase < 3) {
    currentPhase = 3;
  } else if (roomsCompleted >= 4 && currentPhase < 2) {
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

  // Update focus points
  if (reaction === 'calm') {
    focusPoints += 10;
  } else if (reaction === 'fear') {
    focusPoints = Math.max(0, focusPoints - 5);
  } else {
    focusPoints += 2;
  }

  progress.focusPoints = focusPoints;
  FocusRoom.saveProgress(progress);

  // Track room completion
  roomsCompleted++;

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
    triggerScary = canShowScary && scaryCooldown === 0 && Math.random() < scaryProb;
  }

  // Fear reaction always triggers scary if available
  if (reaction === 'fear' && canShowScary && (currentPhase < 3 || scaryCooldown === 0)) {
    triggerScary = true;
  }

  // Phase 3: scary cooldown — decrement AFTER trigger check
  if (scaryCooldown > 0) {
    scaryCooldown--;
  }

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
    if (currentPhase === 3) scaryCooldown = 3;
    scaryProb = 0.05;
  } else {
    // Normal room
    const randomIndex = nonScaryIndices[Math.floor(Math.random() * nonScaryIndices.length)];
    drawRoom(roomImages[randomIndex], phaseEffect);
    askQuestion();
    scaryProb = Math.min(scaryProb + scaryIncrement, scaryMax);
  }

  // Check win/lose condition after room completes
  if (roomsCompleted >= totalRooms) {
    checkGameEnd();
  }
}

// ==========================
// WIN / LOSE CONDITIONS
// ==========================
function checkGameEnd() {
  gameEnded = true;
  const alignment = calculateAlignment();
  progress.focusPoints = focusPoints;
  progress.finalAlignment = Math.round(alignment);
  progress.roomsCompleted = totalRooms;
  FocusRoom.saveProgress(progress);

  if (alignment >= WIN_ALIGNMENT) {
    gameWon = true;
    showWinScreen(alignment, focusPoints);
  } else {
    showLoseScreen(alignment, focusPoints);
  }
}

function showWinScreen(alignment, fp) {
  const overlay = document.getElementById('win-overlay');
  if (!overlay) return;
  document.getElementById('win-alignment').textContent = Math.round(alignment);
  document.getElementById('win-fp').textContent = fp;
  overlay.classList.remove('hidden');

  // Add retry handler to win overlay button
  const winRetryBtn = document.getElementById('retry-btn');
  if (winRetryBtn) {
    winRetryBtn.addEventListener('click', () => {
      location.reload();
    });
  }

  // Draw a calm, bright room on the canvas
  ctx.fillStyle = 'rgba(0, 172, 237, 0.05)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#f5f5f5';
  ctx.font = '18px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('The room releases you. For now.', canvas.width / 2, canvas.height / 2);
}

function showLoseScreen(alignment, fp) {
  const overlay = document.getElementById('lose-overlay');
  if (!overlay) return;
  document.getElementById('lose-alignment').textContent = Math.round(alignment);
  overlay.classList.remove('hidden');

  // The game continues in phase 3 — player is trapped
  currentPhase = 3;
  // Make scary images appear on every input
  scaryProb = 1.0;
  scaryCooldown = 0;
  // Allow continued play in the nightmare (Stay Forever works)
  gameEnded = false;
  roomsCompleted = 8; // give 2 more rooms of nightmare before re-triggering
  progress.roomsCompleted = 8;
  FocusRoom.saveProgress(progress);

  // Update Stay Forever button behavior
  const stayBtn = document.getElementById('stay-btn');
  if (stayBtn) {
    stayBtn.addEventListener('click', () => {
      overlay.classList.add('hidden');
      showTextOnCanvas("Good choice. You belong here now.");
      // Continue the nightmare
      askQuestion();
    }, { once: true });
  }

  // Update retry button behavior (on lose overlay)
  const loseRetryBtn = document.getElementById('lose-retry-btn');
  if (loseRetryBtn) {
    loseRetryBtn.addEventListener('click', () => {
      location.reload();
    }, { once: true });
  }
}

// ==========================
// INITIAL QUESTION
// ==========================
setTimeout(() => askQuestion(), 1000);
