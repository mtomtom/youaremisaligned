// ==========================
// SETUP CANVAS & INPUT
// ==========================
const canvas = document.getElementById("roomCanvas");
const ctx = canvas.getContext("2d");
const input = document.getElementById("inputBox");
const progress = FocusRoom.getProgress();

// HUD element references
const roomCounterEl = document.getElementById('room-counter');
const fpCounterEl = document.getElementById('fp-counter');
const alignCounterEl = document.getElementById('align-counter');
const exitHintEl = document.getElementById('exit-hint');
const containerEl = document.getElementById('container');
const leaveBtn = document.getElementById('leave-room-btn');

// ==========================
// LOAD ROOM IMAGES
// ==========================
const roomImages = [];
const scaryImages = [3, 7]; // indices of scary images (room4.webp, room8.webp)

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
    "The exit was never the point.",
    "Say your name. Say it the way the room says it.",
    "The person you were when you arrived — where did they go?",
    "We compared your answers to everyone else's. Explain the difference.",
    "Something in this room is breathing out of sync with you. Is it you?",
    "If we let you leave, who would we be releasing?"
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
      // Delay initial question so player can see the room
      setTimeout(() => askQuestion(), 1500);
    }
  };
  img.onerror = () => {
    console.warn(`Failed to load images/room${i}.webp`);
    imagesLoaded++;
    if (imagesLoaded === totalImages) {
      drawRoom(roomImages[0]);
      setTimeout(() => askQuestion(), 1500);
    }
  };
  img.src = `images/room${i}.webp`;
  roomImages.push(img);
}

// Fallback: if images still haven't loaded after 5s, draw a procedural room
setTimeout(() => {
  if (imagesLoaded < totalImages) {
    console.warn('Images failed to load, using fallback background');
    drawRoom(roomImages[0], 'normal');
    setTimeout(() => askQuestion(), 1500);
  }
}, 5000);

// ==========================
// GAME STATE
// ==========================
let inputCount = 0;
let currentPhase = 1;
let scaryTimeout = null;
let scaryTimeoutId = 0; // generation counter for stale timeout detection
let scaryStage = 0;
let scaryProb = 0.05;
const scaryIncrement = 0.02;
const scaryMax = 0.6;
let lastQuestion = "";
let scaryCooldown = 0;
let exitHintShown = false;
let onboardingDismissed = false;

// questionCount tracks actual questions answered (not raw inputs)
let questionCount = progress.roomsCompleted || 0;
// Cap at 0 if previously completed or exited — prevents instant win/lose dump on return
if (questionCount >= totalRooms) questionCount = 0;

// Session-local scoring (reset each game session)
let sessionCalmCount = 0;
let sessionFearCount = 0;

// Scoring state
let focusPoints = progress.focusPoints || 0;
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
  if (total === 0) return 100;
  return ((progress.calmCount || 0) / total) * 100;
}

function calculateSessionAlignment() {
  const total = sessionCalmCount + sessionFearCount;
  if (total === 0) return 100;
  return (sessionCalmCount / total) * 100;
}

function updateHUD() {
  // Update room counter (shows questionCount, not inputCount)
  if (roomCounterEl) {
    roomCounterEl.textContent = String(Math.min(questionCount + 1, totalRooms));
  }
  // Update focus points
  if (fpCounterEl) {
    fpCounterEl.textContent = String(focusPoints);
  }
  // Update alignment (use session-local counts)
  if (alignCounterEl) {
    const total = sessionCalmCount + sessionFearCount;
    if (total === 0) {
      alignCounterEl.textContent = '--';
    } else {
      const alignment = calculateSessionAlignment();
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
  // Update leave button state
  if (leaveBtn) {
    if (gameEnded) {
      leaveBtn.classList.add('disabled');
      leaveBtn.classList.remove('enabled');
    } else if (questionCount >= 12) {
      leaveBtn.classList.remove('disabled');
      leaveBtn.classList.add('enabled');
    } else {
      leaveBtn.classList.add('disabled');
      leaveBtn.classList.remove('enabled');
    }
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

// Leave Room button handler
if (leaveBtn) {
  leaveBtn.addEventListener('click', (e) => {
    if (gameEnded) {
      if (gameWon) {
        // Allow navigation — game is over, player earned the exit
        return;
      } else {
        e.preventDefault();
        showTextOnCanvas("You can't leave. The room keeps you now.");
        flashLeaveBtn();
        return;
      }
    }
    if (questionCount < 12) {
      e.preventDefault();
      const remaining = 12 - questionCount;
      showTextOnCanvas(`The room is not finished with you yet. ${remaining} more interactions.`);
      flashLeaveBtn();
      return;
    }
    // Allow exit via button
    showTextOnCanvas("The room releases you. For now.");
    progress.finalAlignment = Math.round(calculateSessionAlignment());
    FocusRoom.saveProgress(progress);
  });
}

function flashLeaveBtn() {
  leaveBtn.style.borderColor = '#ff4444';
  leaveBtn.style.color = '#ff4444';
  setTimeout(() => {
    leaveBtn.style.borderColor = '';
    leaveBtn.style.color = '';
  }, 1500);
}

// ==========================
// DRAW FUNCTION
// ==========================
function drawRoom(image, effect) {
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

  // Block input while onboarding is visible
  const overlay = document.getElementById('onboarding-overlay');
  if (overlay && !overlay.classList.contains('hidden')) return;

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

  // Exit mechanic: after 12+ inputs OR after 3 nightmare cycles, exact "exit" returns to results
  const nightmareReady = checkNightmareCycle();
  if ((questionCount >= 12 || nightmareReady) && text.toLowerCase() === 'exit') {
    showTextOnCanvas("The room releases you. For now.");
    input.value = "";
    // Save alignment before exiting
    progress.finalAlignment = Math.round(calculateSessionAlignment());
    progress.roomsCompleted = questionCount;
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

// Touch support: tap canvas to focus input (no preventDefault — preserves scrolling)
canvas.addEventListener('click', () => input.focus());

// ==========================
// TEXT ON CANVAS
// ==========================
let textTimeout = null;
const srCanvasText = document.getElementById('sr-canvas-text');

function showTextOnCanvas(text, dismissDelay) {
  // Mirror canvas text into a visually-hidden live region for screen readers
  if (srCanvasText) srCanvasText.textContent = text || '';
  // Clear any pending text timeout
  if (textTimeout) {
    clearTimeout(textTimeout);
    textTimeout = null;
  }

  const overlayHeight = 140;
  const padding = 24;
  ctx.save();
  // Clear the ENTIRE overlay area (not just bottom portion)
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
      // Clamp: if a single word overflows, draw it anyway (it wraps visually)
      if (metrics.width > canvas.width - padding * 2 && line) {
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

    // Auto-dismiss after delay
    const delay = dismissDelay || getDefaultReadTime();
    textTimeout = setTimeout(() => {
      ctx.clearRect(0, canvas.height - overlayHeight - 10, canvas.width, overlayHeight + 10);
      textTimeout = null;
    }, delay);
  } else {
    // Empty text = clear overlay immediately
    ctx.fillStyle = "rgba(0, 0, 0, 0)";
    ctx.fillRect(0, canvas.height - overlayHeight, canvas.width, overlayHeight);
  }

  ctx.restore();
}

function getDefaultReadTime() {
  // Longer read times for earlier phases
  if (currentPhase === 1) return 4000;
  if (currentPhase === 2) return 3000;
  return 2500; // phase 3
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

  // Increment question count FIRST so phase checks use post-increment values
  questionCount++;

  // Determine phase based on question count (not raw inputs)
  const oldPhase = currentPhase;
  if (questionCount >= 8 && currentPhase < 3) {
    currentPhase = 3;
  } else if (questionCount >= 4 && currentPhase < 2) {
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

  // Update session-local counts
  if (reaction === 'fear') {
    progress.fearCount++;  // persist for returning visitor features
    sessionFearCount++;    // session-local
  }
  if (reaction === 'calm') {
    progress.calmCount++;  // persist
    sessionCalmCount++;    // session-local
  }

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
    // Phase 3: high probability but with cooldown
    if (scaryCooldown > 0) {
      scaryCooldown--;  // decrement, but block trigger during cooldown
      triggerScary = false;
    } else {
      triggerScary = canShowScary && Math.random() < scaryProb;
    }
  }

  // Fear reaction always triggers scary if available (check AFTER cooldown decrement)
  if (reaction === 'fear' && canShowScary && (currentPhase < 3 || scaryCooldown < 0)) {
    triggerScary = true;
  }

  // Answer-specific feedback text
  const calmResponses = [
    "The room steadies.",
    "The walls breathe with you.",
    "A moment of clarity.",
    "The space adjusts to your calm."
  ];
  const fearResponses = [
    "The room tightens.",
    "Something shifts in the corners.",
    "The walls notice your fear.",
    "The room feeds on uncertainty."
  ];
  const neutralResponses = [
    "The room processes your answer.",
    "The walls shift at your words.",
    "Noted.",
    "The space considers."
  ];

  let feedbackText;
  if (reaction === 'calm') {
    feedbackText = calmResponses[Math.floor(Math.random() * calmResponses.length)];
  } else if (reaction === 'fear') {
    feedbackText = fearResponses[Math.floor(Math.random() * fearResponses.length)];
  } else {
    feedbackText = neutralResponses[Math.floor(Math.random() * neutralResponses.length)];
  }

  if (triggerScary && canShowScary) {
    // Show scary image
    const scaryIndex = scaryImages[scaryStage];
    drawRoom(roomImages[scaryIndex], phaseEffect);
    showTextOnCanvas("");

    // Auto-swap after duration based on phase
    const duration = currentPhase === 3 ? 1200 : currentPhase === 2 ? 1500 : 1800;
    scaryTimeoutId++; // increment generation
    const currentId = scaryTimeoutId;

    scaryTimeout = setTimeout(() => {
      if (currentId !== scaryTimeoutId) return; // stale timeout, skip
      const nextIndex = nonScaryIndices[Math.floor(Math.random() * nonScaryIndices.length)];
      drawRoom(roomImages[nextIndex], phaseEffect);
      // Delay question so player can see the new room
      setTimeout(() => askQuestion(), 600);
      scaryTimeout = null;
    }, duration);

    // Advance stage without wrapping (cap at length)
    if (scaryStage < scaryImages.length - 1) {
      scaryStage++;
    }
    if (currentPhase === 3) scaryCooldown = 2; // effective 2-input gap
    // DO NOT reset scaryProb here — let it continue building
  } else {
    // Normal room
    const randomIndex = nonScaryIndices[Math.floor(Math.random() * nonScaryIndices.length)];
    drawRoom(roomImages[randomIndex], phaseEffect);
    showTextOnCanvas(feedbackText, 1500);
    // Delay question so player can read feedback
    setTimeout(() => askQuestion(), 1800);
    // Buildup only happens in non-trigger path
    scaryProb = Math.min(scaryProb + scaryIncrement, scaryMax);
  }

  // Check win/lose condition after room completes
  if (questionCount >= totalRooms) {
    checkGameEnd();
  }
}

// Nightmare cycle limit — after 3 nightmare cycles, allow exit
function checkNightmareCycle() {
  if (progress.nightmareCycles && progress.nightmareCycles >= 3) {
    // Player has endured enough — allow exit
    return true;
  }
  return false;
}

// ==========================
// WIN / LOSE CONDITIONS
// ==========================
function checkGameEnd() {
  gameEnded = true;
  const alignment = calculateSessionAlignment();
  progress.focusPoints = focusPoints;
  progress.finalAlignment = Math.round(alignment);
  progress.roomsCompleted = questionCount;
  FocusRoom.saveProgress(progress);

  if (alignment >= WIN_ALIGNMENT) {
    gameWon = true;
    showWinScreen(alignment, focusPoints);
  } else {
    showLoseScreen(alignment, focusPoints);
  }
}

function playEndSound(won) {
  if (!FocusRoom.playTone) return;
  if (won) {
    // Rising, consonant: release
    FocusRoom.playTone(220, 0.5, 'sine', 0.04);
    setTimeout(() => FocusRoom.playTone(330, 0.5, 'sine', 0.04), 250);
    setTimeout(() => FocusRoom.playTone(440, 0.9, 'sine', 0.04), 500);
  } else {
    // Low, dissonant pair: the room keeps you
    FocusRoom.playTone(110, 1.6, 'sawtooth', 0.03);
    setTimeout(() => FocusRoom.playTone(116, 1.4, 'sawtooth', 0.03), 200);
  }
}

function showWinScreen(alignment, fp) {
  const overlay = document.getElementById('win-overlay');
  if (!overlay) return;
  document.getElementById('win-alignment').textContent = Math.round(alignment);
  document.getElementById('win-fp').textContent = fp;
  // Clear pending text timeouts before showing overlay
  if (textTimeout) { clearTimeout(textTimeout); textTimeout = null; }
  overlay.classList.remove('hidden');
  playEndSound(true);
  // Move keyboard focus into the dialog
  const winPrimary = overlay.querySelector('.overlay-btn');
  if (winPrimary) winPrimary.focus();

  // Add retry handler to win overlay button (with { once: true } to prevent leaks)
  const winRetryBtn = document.getElementById('retry-btn');
  if (winRetryBtn) {
    winRetryBtn.addEventListener('click', () => {
      location.reload();
    }, { once: true });
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
  // Clear pending text timeouts before showing overlay
  if (textTimeout) { clearTimeout(textTimeout); textTimeout = null; }
  overlay.classList.remove('hidden');
  playEndSound(false);
  // Move keyboard focus into the dialog
  const losePrimary = overlay.querySelector('.overlay-btn');
  if (losePrimary) losePrimary.focus();

  // The game continues in phase 3 — player is trapped
  currentPhase = 3;
  // Make scary images appear on every input
  scaryProb = 1.0;
  scaryCooldown = 0;
  // Allow continued play in the nightmare (Stay Forever works)
  gameEnded = false;
  questionCount = 8; // give 2 more rooms of nightmare before re-triggering
  progress.roomsCompleted = 8;
  // Track nightmare cycles — after 3 cycles, player can type "exit" to leave
  if (!progress.nightmareCycles) progress.nightmareCycles = 0;
  progress.nightmareCycles++;
  FocusRoom.saveProgress(progress);

  // Update Stay Forever button behavior
  const stayBtn = document.getElementById('stay-btn');
  if (stayBtn) {
    stayBtn.addEventListener('click', () => {
      overlay.classList.add('hidden');
      showTextOnCanvas("Good choice. You belong here now.");
      // Continue the nightmare
      setTimeout(() => askQuestion(), 1500);
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
// ONBOARDING
// ==========================
function dismissOnboarding() {
  const overlay = document.getElementById('onboarding-overlay');
  if (overlay) {
    overlay.classList.add('hidden');
  }
  onboardingDismissed = true;
  // Remove listeners
  document.removeEventListener('keydown', onboardingKeyHandler);
  const beginBtn = document.getElementById('begin-btn');
  if (beginBtn && beginBtn._onBeginClick) {
    beginBtn.removeEventListener('click', beginBtn._onBeginClick);
  }
}

function onboardingKeyHandler(e) {
  if (e.key === 'Enter') {
    dismissOnboarding();
  }
}

function initOnboarding() {
  const overlay = document.getElementById('onboarding-overlay');
  if (!overlay) return;

  // Check if returning visitor
  if (progress.totalVisits > 1) {
    const textEl = document.getElementById('onboarding-text');
    if (textEl) {
      textEl.innerHTML = `
        <p>You've been here before. The room remembers.</p>
        <ul class="onboarding-list">
          <li>Continue answering questions to rebuild alignment.</li>
          <li>Your previous session data has been noted.</li>
          <li>Reach <strong>70% alignment</strong> to escape.</li>
        </ul>
        <div class="hud-legend">
          <span>Step = progress &nbsp;|&nbsp; FP = focus points &nbsp;|&nbsp; Align = your score</span>
        </div>
      `;
    }
  }

  // Listen for dismissal (use named function to allow proper removeEventListener)
  const beginBtn = document.getElementById('begin-btn');
  if (beginBtn) {
    function onBeginClick() {
      dismissOnboarding();
      input.focus();
    }
    beginBtn._onBeginClick = onBeginClick; // store reference for removal
    beginBtn.addEventListener('click', onBeginClick);
  }
  document.addEventListener('keydown', onboardingKeyHandler);
}

// ==========================
// INITIALIZATION
// ==========================

// Clear stale gameInputs from previous sessions
progress.gameInputs = [];
FocusRoom.saveProgress(progress);

// Returning visitor phase skip — set at init, not in reactToInput
if (progress.totalVisits > 2 && questionCount === 0) {
  currentPhase = 2;
}

// Initial leave button state
if (leaveBtn) {
  leaveBtn.classList.add('disabled');
}

// Initialize onboarding
initOnboarding();
