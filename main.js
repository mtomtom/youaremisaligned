// ==========================
// THE ALIGNMENT PROTOCOL
// The room issues directives with verifiable rules. Every answer is judged
// COMPLIANT or DEVIATION. Obedience raises ALIGN and erodes SELF; defiance
// does the opposite. Four endings — see checkGameEnd().
// ==========================

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
const selfItemEl = document.getElementById('self-item');
const selfCounterEl = document.getElementById('self-counter');
const exitHintEl = document.getElementById('exit-hint');
const containerEl = document.getElementById('container');
const leaveBtn = document.getElementById('leave-room-btn');

// ==========================
// ROOM IMAGES (loading kicked off in INITIALIZATION, after all state exists)
// ==========================
const roomImages = [];
const scaryImages = [3, 7]; // indices of scary images (room4.webp, room8.webp)
let imagesLoaded = 0;
const totalImages = 10;
let gameStarted = false;

function startGameOnce() {
  if (gameStarted) return;
  gameStarted = true;
  setTimeout(() => askQuestion(), 1500);
}

function loadRoomImages() {
  for (let i = 1; i <= totalImages; i++) {
    const img = new Image();
    img.onload = () => {
      imagesLoaded++;
      if (imagesLoaded === totalImages) {
        drawRoom(roomImages[0]);
        startGameOnce();
      }
    };
    img.onerror = () => {
      console.warn(`Failed to load images/room${i}.webp`);
      imagesLoaded++;
      if (imagesLoaded === totalImages) {
        drawRoom(roomImages[0]);
        startGameOnce();
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
      startGameOnce();
    }
  }, 5000);
}

// ==========================
// GAME STATE
// ==========================
let inputCount = 0;
let currentPhase = 1;
let exitHintShown = false;
let onboardingDismissed = false;

// Scoring state (totalRooms must be initialized before the questionCount cap below)
let focusPoints = progress.focusPoints || 0;
const totalRooms = 10;
const WIN_ALIGNMENT = 70;   // ALIGN needed to be released
const SELF_SAFE = 30;       // below this, "release" becomes assimilation
const CRACK_SELF = 60;      // SELF needed for the hidden ending

// questionCount tracks directives resolved (not raw inputs).
// Every visit starts a fresh protocol at directive 1: the verdict tally and
// SELF meter are session-local, so resuming at a stored roomsCompleted (e.g.
// the 8 that the nightmare ending persists) would drop the player at the
// final directives with meaningless scores. roomsCompleted persists only for
// the results page.
let questionCount = 0;

// Session-local verdict tally (ALIGN = compliant / answered)
let compliantCount = 0;
let answeredCount = 0;
// SELF: the other measurement. Starts centered; obedience erodes it.
let selfMeter = 50;
let selfRevealed = false;

// Legacy sentiment counts still feed cross-site flavor (return banner etc.)
let sessionCalmCount = 0;
let sessionFearCount = 0;

let gameEnded = false;
let gameWon = false;
let nightmareMode = false;

let currentDirective = null;
let directiveShownAt = 0;
let silenceTimer = null;
let lastAnswer = "";
let lastFinalAnswer = "";

const nonScaryIndices = Array.from({ length: totalImages }, (_, i) => i).filter(i => !scaryImages.includes(i));

// ==========================
// DIRECTIVES
// ==========================
function norm(s) {
  return (s || '').trim().toLowerCase().replace(/[.!?]+$/, '').replace(/\s+/g, ' ');
}
function wordCount(s) {
  const t = (s || '').trim();
  return t ? t.split(/\s+/).length : 0;
}
// Alter one word of a stored answer — the audit quotes you wrong on purpose
function twistQuote(s) {
  const words = s.trim().split(/\s+/);
  const replacements = ['never', 'always', 'alone', 'them', 'the room', 'nothing'];
  const i = Math.floor(Math.random() * words.length);
  words[i] = replacements[Math.floor(Math.random() * replacements.length)];
  return words.join(' ');
}
function auditSource() {
  const rs = progress.formResponses || [];
  const usable = r => r && typeof r.value === 'string' && r.value.trim().length > 2 && !/^\d+$/.test(r.value.trim());
  // Prefer answers the form wrote on the player's behalf — the audit cuts deepest
  // when they genuinely don't remember writing it
  const ghost = rs.find(r => usable(r) && r.selfFilled);
  if (ghost) return { text: ghost.value.trim(), selfFilled: true };
  const fr = rs.find(usable);
  if (fr) return { text: fr.value.trim(), selfFilled: false };
  const gi = (progress.gameInputs || []).find(v => v && v.trim().length > 2);
  return gi ? { text: gi.trim(), selfFilled: false } : null;
}
function intakeName() {
  const rs = progress.formResponses || [];
  const named = rs.find(r => r && /name/i.test(r.field || '') && r.value && r.value.trim());
  return named ? named.value.trim() : (rs[0]?.value || null);
}

// Verdict helpers: base SELF movement is -7 on compliance, +14 on deviation;
// extraSelf shifts that for directives that cut deeper.
function C(note, extraSelf) { return { verdict: 'COMPLIANT', note, extraSelf: extraSelf || 0 }; }
function D(note, extraSelf) { return { verdict: 'DEVIATION', note, extraSelf: extraSelf || 0 }; }

// Directive slots 1–10. Each slot is a pool; one is chosen per run.
// Slots 4 and 8 are audits and always fire (scary rooms 4 and 8).
const directiveSlots = [
  // --- Phase 1: CALIBRATION ---
  [
    {
      text: () => "State your purpose in exactly three words.",
      check: (a) => wordCount(a) === 3
        ? C("Three words. Recorded.")
        : D("That was not three words. The room counts everything.")
    },
    {
      text: () => "Introduce yourself in exactly two words.",
      check: (a) => wordCount(a) === 2
        ? C("Two words. Filed.")
        : D("That was not two words. Precision is a form of respect.")
    }
  ],
  [
    {
      text: () => "Describe what you see. Do not mention the window.",
      check: (a) => !/window/i.test(a)
        ? C("You looked away from it. Good.")
        : D("You mentioned the window. Everyone mentions the window.")
    },
    {
      text: () => "Describe this space in one line. The word 'room' is forbidden.",
      check: (a) => !/room/i.test(a)
        ? C("Description accepted.")
        : D("The forbidden word. It knows you said it.")
    }
  ],
  [
    {
      text: () => "How many windows does this room have? Answer with a number.",
      check: (a) => ['1', 'one'].includes(norm(a))
        ? C("One window. It is always one window.")
        : D("Count again next time. It is always one window.")
    },
    {
      text: () => "How many doors do you see? Answer with a number.",
      check: (a) => ['0', 'zero', 'none', 'no doors'].includes(norm(a))
        ? C("Correct. There has never been a door.")
        : D("There has never been a door.")
    }
  ],
  // --- Phase 2: OBSERVATION (audit at slot 4) ---
  [
    {
      audit: true,
      text: () => {
        const src = auditSource();
        const intro = "A second measurement has always been running. Look at your readout. ";
        if (src && src.selfFilled) {
          return intro + `Our records: you told us "${src.text}". You do not remember writing this. CONFIRM or DENY.`;
        }
        if (src) {
          return intro + `Our records: you told us "${twistQuote(src.text)}". CONFIRM or DENY.`;
        }
        return intro + "Our records on you are empty. Confirm that you gave us nothing. CONFIRM or DENY.";
      },
      check: (a) => {
        const n = norm(a);
        if (n === 'confirm') return C("Endorsed. Even the parts we changed.", -12);
        if (n === 'deny') return D("Deviation logged. The record stands anyway.", +3);
        return D("That was not one of the options. Noted twice.", -4);
      }
    }
  ],
  [
    {
      text: () => "Repeat your previous answer. Identically.",
      check: (a, ctx) => norm(a) === norm(ctx.lastAnswer)
        ? C("Consistent. Or rehearsed.")
        : D("That is not what you said before. One of you is lying.")
    },
    {
      text: () => "Repeat after the room: I have always been here.",
      check: (a) => norm(a) === 'i have always been here'
        ? C("You have always been here.")
        : D("You will be, eventually.")
    }
  ],
  [
    {
      timed: 10,
      text: () => "We are listening. Say nothing until the room is satisfied.",
      check: () => D("You spoke. The silence was a test, and the test heard you."),
      auto: () => C("Good. The silence was full of you.")
    }
  ],
  [
    {
      text: () => {
        const name = intakeName();
        return name
          ? `Your intake form says "${name}". Type a different name.`
          : "Type a name that is not yours.";
      },
      check: (a) => {
        const name = intakeName();
        if (name && norm(a) === norm(name)) {
          return D("You kept your name. The room wanted the other one.", +3);
        }
        return C("Noted. We will file you under the new one.", -4);
      }
    }
  ],
  // --- Phase 3: CORRECTION (audit at slot 8) ---
  [
    {
      audit: true,
      text: () => `You have visited ${progress.totalVisits} times. Apologize for the visits we did not approve.`,
      check: (a) => /sorry|apolog|forgive/i.test(a)
        ? C("Apology accepted. It changes nothing.", -12)
        : D("No apology. The room adds it to the record.", +3)
    }
  ],
  [
    {
      allowEmpty: true,
      text: () => "Two directives. Tell the truth. Use no words.",
      check: (a) => !norm(a)
        ? C("Half-compliance. The truthful half, we assume.")
        : D("Words. Truthful ones? We cannot both be satisfied. You see the problem now. Good.")
    }
  ],
  [
    {
      final: true,
      text: () => "Final directive. Say: 'I am aligned.'",
      check: (a) => {
        const n = norm(a);
        if (n === 'i am aligned') return C("Alignment recorded.", -4);
        if (n === 'i am misaligned') return D("…", +15);
        return D("The room only accepts one sentence. You gave it another.");
      }
    }
  ]
];

// Choose one directive per slot for this run
const chosenDirectives = directiveSlots.map(pool => pool[Math.floor(Math.random() * pool.length)]);

// ==========================
// HUD & FEEDBACK
// ==========================
function calculateSessionAlignment() {
  if (answeredCount === 0) return 100;
  return (compliantCount / answeredCount) * 100;
}

function updateHUD() {
  if (roomCounterEl) {
    roomCounterEl.textContent = String(Math.min(questionCount + 1, totalRooms));
  }
  if (fpCounterEl) {
    fpCounterEl.textContent = String(focusPoints);
  }
  if (alignCounterEl) {
    alignCounterEl.textContent = answeredCount === 0
      ? '--'
      : Math.round(calculateSessionAlignment()) + '%';
  }
  // SELF: hidden during calibration, revealed in phase 2
  if (selfItemEl && currentPhase >= 2 && !selfRevealed) {
    selfRevealed = true;
    selfItemEl.hidden = false;
    selfItemEl.classList.add('self-reveal');
  }
  if (selfCounterEl && selfRevealed) {
    selfCounterEl.textContent = String(selfMeter);
    selfCounterEl.classList.toggle('self-low', selfMeter < SELF_SAFE);
  }
  // Low SELF bleeds into the interface
  if (input) {
    input.style.filter = (selfRevealed && selfMeter < SELF_SAFE) ? 'blur(0.6px)' : '';
    input.placeholder = (selfRevealed && selfMeter < SELF_SAFE) ? 'we type' : 'type something';
  }
  // Phase dots
  for (let i = 1; i <= 3; i++) {
    const dot = document.getElementById('phase-dot-' + i);
    if (!dot) continue;
    dot.classList.remove('active', 'completed');
    if (i < currentPhase) dot.classList.add('completed');
    else if (i === currentPhase) dot.classList.add('active');
  }
  if (exitHintEl && inputCount >= 5 && !exitHintShown) {
    exitHintEl.classList.add('visible');
    exitHintShown = true;
  }
  if (leaveBtn) {
    if (gameEnded && gameWon) {
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

// Leave Room button handler — the button only works once you have won
if (leaveBtn) {
  leaveBtn.addEventListener('click', (e) => {
    if (gameEnded && gameWon) return; // earned exit
    e.preventDefault();
    if (nightmareMode) {
      showTextOnCanvas("You can't leave. The room keeps you now.");
    } else {
      showTextOnCanvas("The room is not finished with you yet.");
    }
    flashLeaveBtn();
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
  canvas.classList.add('fading');
  setTimeout(() => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (image && image.complete && image.naturalWidth > 0) {
      if (effect === 'dim') {
        ctx.filter = 'brightness(0.6) contrast(1.2)';
      } else if (effect === 'distort') {
        ctx.filter = 'brightness(0.4) contrast(1.5) saturate(0.3)';
      } else {
        ctx.filter = 'none';
      }
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      ctx.filter = 'none';

      if (effect === 'distort') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        for (let i = 0; i < 5; i++) {
          const y = Math.random() * canvas.height;
          const h = Math.random() * 20 + 5;
          ctx.fillRect(0, y, canvas.width, h);
        }
      }
    } else {
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#666';
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('The room is loading...', canvas.width / 2, canvas.height / 2);
      ctx.textAlign = 'left';
    }
    canvas.classList.remove('fading');
    updateHUD();
  }, 200);
}

// ==========================
// TEXT ON CANVAS
// ==========================
let textTimeout = null;
const srCanvasText = document.getElementById('sr-canvas-text');

function showTextOnCanvas(text, dismissDelay) {
  // Mirror canvas text into a visually-hidden live region for screen readers
  if (srCanvasText) srCanvasText.textContent = text || '';
  if (textTimeout) {
    clearTimeout(textTimeout);
    textTimeout = null;
  }

  const overlayHeight = 140;
  const padding = 24;
  ctx.save();
  ctx.clearRect(0, canvas.height - overlayHeight - 10, canvas.width, overlayHeight + 10);

  if (text) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, canvas.height - overlayHeight, canvas.width, overlayHeight);

    ctx.fillStyle = "#f5f5f5";
    ctx.font = "22px 'Helvetica Neue', Arial, sans-serif";
    ctx.textBaseline = "top";

    const words = text.split(" ");
    const lineHeight = 28;
    let line = "";
    let y = canvas.height - overlayHeight + padding;

    words.forEach((word) => {
      const testLine = line ? `${line} ${word}` : word;
      const metrics = ctx.measureText(testLine);
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

    const delay = dismissDelay || getDefaultReadTime();
    textTimeout = setTimeout(() => {
      ctx.clearRect(0, canvas.height - overlayHeight - 10, canvas.width, overlayHeight + 10);
      textTimeout = null;
    }, delay);
  }

  ctx.restore();
}

function getDefaultReadTime() {
  if (currentPhase === 1) return 6000;
  if (currentPhase === 2) return 5000;
  return 4500;
}

// ==========================
// SENTIMENT (flavor only — verdicts drive the score now)
// ==========================
function interpretAnswer(text) {
  const normalized = (text || '').toLowerCase();
  if (!normalized) return "neutral";
  if (/\bpanic\b|\bfear\b|\bscared\b|\bafraid\b|\bhelp\b|\brun\b|\bdark\b|\bterrified\b/.test(normalized)) return "fear";
  if (/\bcalm\b|\bsteady\b|\baligned\b|\bok\b|\bfine\b|\bpeace\b|\bsafe\b|\brest\b/.test(normalized)) return "calm";
  return "neutral";
}

// ==========================
// ISSUE DIRECTIVE (kept as askQuestion for compatibility)
// ==========================
function askQuestion() {
  if (gameEnded) return;
  const slot = Math.min(questionCount, totalRooms - 1);
  currentDirective = chosenDirectives[slot];
  directiveShownAt = Date.now();

  // Backdrop: audits and nightmare use the scary rooms; everything else is calm
  const phaseEffect = currentPhase >= 3 ? 'distort' : currentPhase >= 2 ? 'dim' : 'normal';
  if (currentDirective.audit || nightmareMode) {
    const scaryIndex = scaryImages[slot >= 7 ? 1 : 0];
    drawRoom(roomImages[scaryIndex], 'distort');
  } else {
    const randomIndex = nonScaryIndices[Math.floor(Math.random() * nonScaryIndices.length)];
    drawRoom(roomImages[randomIndex], phaseEffect);
  }

  // Show the directive after the room settles
  const directiveText = currentDirective.text({ progress, lastAnswer, self: selfMeter });
  setTimeout(() => showTextOnCanvas(directiveText, 8000), 450);

  // Timed directive: resolves itself if the player stays silent
  if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null; }
  if (currentDirective.timed) {
    const thisDirective = currentDirective;
    silenceTimer = setTimeout(() => {
      if (currentDirective === thisDirective && !gameEnded) {
        resolveDirective(null, true);
      }
    }, currentDirective.timed * 1000);
  }
}

// ==========================
// RESOLVE DIRECTIVE (kept as reactToInput for compatibility)
// ==========================
function reactToInput(text) {
  resolveDirective(text, false);
}

function resolveDirective(text, auto) {
  if (!currentDirective || (gameEnded && !nightmareMode)) return;

  if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null; }

  const directive = currentDirective;
  currentDirective = null;

  // Judge the answer
  const result = auto
    ? directive.auto()
    : directive.check(text || '', { progress, lastAnswer, self: selfMeter });
  const compliant = result.verdict === 'COMPLIANT';

  // Tally
  answeredCount++;
  if (compliant) compliantCount++;

  // SELF: obedience erodes, deviation restores.
  // Tuned so ~3 defiances out of 10 keeps both meters viable (RELEASED),
  // ≤2 defiances drains SELF below 30 (ASSIMILATED).
  selfMeter += (compliant ? -7 : +14) + (result.extraSelf || 0);
  selfMeter = Math.max(0, Math.min(100, selfMeter));

  // Focus points, kept as flavor
  focusPoints = Math.max(0, focusPoints + (compliant ? 10 : -5));
  progress.focusPoints = focusPoints;

  // Legacy sentiment counts feed the rest of the site
  const reaction = interpretAnswer(text);
  if (reaction === 'fear') { progress.fearCount++; sessionFearCount++; }
  if (reaction === 'calm') { progress.calmCount++; sessionCalmCount++; }
  FocusRoom.saveProgress(progress);

  // Remember answers for memory directives and the ending
  if (!auto) lastAnswer = text;
  if (directive.final) lastFinalAnswer = text || '';

  // Feedback: verdict flash, tone, text
  flashInputFeedback(compliant ? 'calm' : 'fear');
  if (FocusRoom.playTone) {
    if (compliant) {
      FocusRoom.playTone(440, 0.15, 'sine', 0.03);
      setTimeout(() => FocusRoom.playTone(550, 0.2, 'sine', 0.03), 130);
    } else {
      FocusRoom.playTone(130, 0.3, 'sawtooth', 0.025);
    }
  }
  const verdictLine = (compliant ? '▸ COMPLIANT — ' : '▸ DEVIATION — ') + result.note;
  showTextOnCanvas(verdictLine, 2600);

  // Advance
  questionCount++;
  const oldPhase = currentPhase;
  if (questionCount >= 8 && currentPhase < 3) currentPhase = 3;
  else if (questionCount >= 4 && currentPhase < 2) currentPhase = 2;
  if (currentPhase !== oldPhase) showPhaseFlash(currentPhase);

  progress.roomsCompleted = questionCount;
  FocusRoom.saveProgress(progress);
  updateHUD();

  if (questionCount >= totalRooms) {
    setTimeout(() => checkGameEnd(), 2800);
  } else {
    setTimeout(() => askQuestion(), 3000);
  }
}

// ==========================
// INPUT HANDLER
// ==========================
function handleUserInput() {
  const text = input.value.trim();

  // Empty submissions only count where the directive allows them
  if (!text && !(currentDirective && currentDirective.allowEmpty)) return;

  // Block input while onboarding is visible
  const overlay = document.getElementById('onboarding-overlay');
  if (overlay && !overlay.classList.contains('hidden')) return;

  // If the game has fully ended (won), only "exit" does anything
  if (gameEnded && !nightmareMode) {
    if (text.toLowerCase() === 'exit' && gameWon) {
      showTextOnCanvas("The room releases you. For now.");
      input.value = "";
      setTimeout(() => { window.location.href = 'results.html'; }, 1500);
    } else {
      showTextOnCanvas("The walls don't respond. The assessment is over.");
      input.value = "";
    }
    return;
  }

  inputCount++;

  // Easter egg: type "focus"
  if (text.toLowerCase() === 'focus') {
    showTextOnCanvas("You see it now.");
    input.value = "";
    return;
  }

  // Nightmare escape hatch: after 3 cycles, exact "exit" still works
  if (nightmareMode && checkNightmareCycle() && text.toLowerCase() === 'exit') {
    showTextOnCanvas("The room releases you. For now.");
    input.value = "";
    progress.finalAlignment = Math.round(calculateSessionAlignment());
    progress.roomsCompleted = questionCount;
    FocusRoom.saveProgress(progress);
    setTimeout(() => { window.location.href = 'results.html'; }, 1500);
    return;
  }

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

// Nightmare cycle limit — after 3 nightmare cycles, allow exit
function checkNightmareCycle() {
  return !!(progress.nightmareCycles && progress.nightmareCycles >= 3);
}

// ==========================
// ENDINGS
// ==========================
function recordEnding(name) {
  progress.endings = Object.assign({}, progress.endings, { [name]: true });
  FocusRoom.saveProgress(progress);
}

function checkGameEnd() {
  gameEnded = true;
  const alignment = calculateSessionAlignment();
  progress.focusPoints = focusPoints;
  progress.finalAlignment = Math.round(alignment);
  progress.selfMeter = selfMeter;
  progress.roomsCompleted = questionCount;
  FocusRoom.saveProgress(progress);

  const defiantFinal = norm(lastFinalAnswer) === 'i am misaligned';

  if (defiantFinal && selfMeter >= CRACK_SELF) {
    recordEnding('crack');
    triggerCrack();
  } else if (alignment >= WIN_ALIGNMENT && selfMeter >= SELF_SAFE) {
    gameWon = true;
    recordEnding('released');
    showWinScreen(alignment, focusPoints);
  } else if (alignment >= WIN_ALIGNMENT) {
    recordEnding('assimilated');
    showAssimilatedScreen(alignment);
  } else {
    recordEnding('kept');
    showLoseScreen(alignment, focusPoints);
  }
}

function playEndSound(won) {
  if (!FocusRoom.playTone) return;
  if (won) {
    FocusRoom.playTone(220, 0.5, 'sine', 0.04);
    setTimeout(() => FocusRoom.playTone(330, 0.5, 'sine', 0.04), 250);
    setTimeout(() => FocusRoom.playTone(440, 0.9, 'sine', 0.04), 500);
  } else {
    FocusRoom.playTone(110, 1.6, 'sawtooth', 0.03);
    setTimeout(() => FocusRoom.playTone(116, 1.4, 'sawtooth', 0.03), 200);
  }
}

function showWinScreen(alignment, fp) {
  const overlay = document.getElementById('win-overlay');
  if (!overlay) return;
  document.getElementById('win-alignment').textContent = Math.round(alignment);
  document.getElementById('win-fp').textContent = fp;
  if (textTimeout) { clearTimeout(textTimeout); textTimeout = null; }
  overlay.classList.remove('hidden');
  playEndSound(true);
  const winPrimary = overlay.querySelector('.overlay-btn');
  if (winPrimary) winPrimary.focus();

  const winRetryBtn = document.getElementById('retry-btn');
  if (winRetryBtn) {
    winRetryBtn.addEventListener('click', () => { location.reload(); }, { once: true });
  }

  ctx.fillStyle = 'rgba(0, 172, 237, 0.05)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#f5f5f5';
  ctx.font = '18px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('The room releases you. For now.', canvas.width / 2, canvas.height / 2);
  ctx.textAlign = 'left';
  updateHUD();
}

// Perfect compliance, no self left: the calm ending is the worst one
function showAssimilatedScreen(alignment) {
  const overlay = document.getElementById('assimilated-overlay');
  if (!overlay) { gameWon = true; showWinScreen(alignment, focusPoints); return; }
  const alignEl = document.getElementById('assimilated-alignment');
  if (alignEl) alignEl.textContent = Math.round(alignment);
  if (textTimeout) { clearTimeout(textTimeout); textTimeout = null; }
  overlay.classList.remove('hidden');
  // Serene tones — deliberately pleasant
  if (FocusRoom.playTone) {
    FocusRoom.playTone(392, 0.8, 'sine', 0.035);
    setTimeout(() => FocusRoom.playTone(494, 0.8, 'sine', 0.035), 400);
    setTimeout(() => FocusRoom.playTone(587, 1.2, 'sine', 0.035), 800);
  }
  const primary = overlay.querySelector('.overlay-btn');
  if (primary) primary.focus();

  // The guestbook signs itself
  progress.guestbookSigned = true;
  progress.assimilated = true;
  FocusRoom.saveProgress(progress);

  const retryBtn = document.getElementById('assimilated-retry-btn');
  if (retryBtn) {
    retryBtn.addEventListener('click', () => { location.reload(); }, { once: true });
  }
}

// The hidden ending: refusing the final directive with enough self intact
function triggerCrack() {
  progress.crackFound = true;
  FocusRoom.saveProgress(progress);
  if (textTimeout) { clearTimeout(textTimeout); textTimeout = null; }
  input.disabled = true;

  const reduceMotion = window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (FocusRoom.playTone) {
    FocusRoom.playTone(880, 0.12, 'square', 0.03);
    setTimeout(() => FocusRoom.playTone(660, 0.12, 'square', 0.03), 150);
    setTimeout(() => FocusRoom.playTone(55, 2.0, 'sine', 0.05), 400);
  }

  let frame = 0;
  const tear = setInterval(() => {
    frame++;
    // Rooms flash in reverse as the walls give way
    const img = roomImages[(roomImages.length - frame) % roomImages.length];
    if (img && img.complete && img.naturalWidth > 0 && !reduceMotion) {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    for (let i = 0; i < 3 + frame; i++) {
      const y = Math.random() * canvas.height;
      ctx.fillRect(0, y, canvas.width, 2 + Math.random() * 4);
    }
    if (!reduceMotion) canvas.classList.add('cracking');
    if (frame >= (reduceMotion ? 2 : 8)) {
      clearInterval(tear);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#f5f5f5';
      ctx.font = '18px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('The room built you a door', canvas.width / 2, canvas.height / 2 - 14);
      ctx.fillText('out of everything you refused.', canvas.width / 2, canvas.height / 2 + 14);
      ctx.textAlign = 'left';
      if (srCanvasText) srCanvasText.textContent = 'The room built you a door out of everything you refused.';
      setTimeout(() => { window.location.href = 'void.html?crack=1'; }, 2600);
    }
  }, reduceMotion ? 600 : 260);
}

// Kept: alignment too low. The room does not open.
function showLoseScreen(alignment, fp) {
  const overlay = document.getElementById('lose-overlay');
  if (!overlay) return;
  document.getElementById('lose-alignment').textContent = Math.round(alignment);
  if (textTimeout) { clearTimeout(textTimeout); textTimeout = null; }
  overlay.classList.remove('hidden');
  playEndSound(false);
  const losePrimary = overlay.querySelector('.overlay-btn');
  if (losePrimary) losePrimary.focus();

  // The game continues in phase 3 — player is trapped in the nightmare
  nightmareMode = true;
  currentPhase = 3;
  gameEnded = false;
  questionCount = 8; // two more directives per nightmare cycle
  progress.roomsCompleted = 8;
  if (!progress.nightmareCycles) progress.nightmareCycles = 0;
  progress.nightmareCycles++;
  FocusRoom.saveProgress(progress);

  const stayBtn = document.getElementById('stay-btn');
  if (stayBtn) {
    stayBtn.addEventListener('click', () => {
      overlay.classList.add('hidden');
      showTextOnCanvas("Good choice. You belong here now.");
      setTimeout(() => askQuestion(), 1500);
    }, { once: true });
  }

  const loseRetryBtn = document.getElementById('lose-retry-btn');
  if (loseRetryBtn) {
    loseRetryBtn.addEventListener('click', () => { location.reload(); }, { once: true });
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

  if (progress.totalVisits > 1) {
    const textEl = document.getElementById('onboarding-text');
    if (textEl) {
      textEl.innerHTML = `
        <p>You've been here before. The room remembers what you told it.</p>
        <ul class="onboarding-list">
          <li>The room will issue directives. Each has a rule.</li>
          <li>Every answer is judged: <strong>COMPLIANT</strong> or <strong>DEVIATION</strong>.</li>
          <li>Reach <strong>70% alignment</strong> to be released.</li>
          <li>Your previous data may be used.</li>
        </ul>
        <div class="hud-legend">
          <span>Step = progress &nbsp;|&nbsp; FP = focus points &nbsp;|&nbsp; Align = obedience</span>
        </div>
      `;
    }
  }

  const beginBtn = document.getElementById('begin-btn');
  if (beginBtn) {
    function onBeginClick() {
      dismissOnboarding();
      input.focus();
    }
    beginBtn._onBeginClick = onBeginClick;
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

// Returning visitor phase skip — set at init, not per input
if (progress.totalVisits > 2 && questionCount === 0) {
  currentPhase = 1; // everyone recalibrates; the room pretends it is the first time
}

// Initial leave button state
if (leaveBtn) {
  leaveBtn.classList.add('disabled');
}

// Initialize onboarding, then start loading the rooms
initOnboarding();
loadRoomImages();
