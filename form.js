/* ===== form.js — The Wellness Protocol (intake form) =====
   Redesigned for pace: 8 answers open the exit, 14 fields maximum.
   Mixed input types keep most answers to one click; free-text is reserved
   for the answers the game will audit later. The progress bar lies, and
   late in the form the room starts answering for you. */

const container = document.getElementById('form-container');
const sentinel = document.getElementById('sentinel');
const progress = FocusRoom.getProgress();

const FIELD_GOAL = 8;   // completed answers before the submit button appears
const MAX_FIELDS = 14;  // the room never asks for more than this

let fieldCount = 0;
let completedFields = progress.formFieldsCompleted || 0; // cumulative across visits
let sessionCompleted = 0;
const countedInputs = new Set();
let submitScrolled = false;
let formEnded = false;
let hitchDone = false;

const statusMessages = [
    "Analyzing intent...", "Validation successful.", "Syntax: Uncomfortably Organic",
    "Warning: Pulse detected in input", "Data tastes... bitter.", "Optimizing your essence..."
];

const ghostAnswers = [
    "I have always been here.",
    "The window was already open.",
    "Yes. Twice.",
    "Whatever the room prefers.",
    "I don't remember writing this.",
    "It sounds like my own voice."
];

// Field templates. `audit: true` marks free-text answers the game quotes back later.
const nameField = { type: 'text', label: 'Full Legal Name', audit: true, isName: true };

const pools = {
    low: [
        { type: 'select', label: 'Preferred Wake-Up Vibration', options: ['Gentle', 'Standard', 'Seismic', 'Whatever wakes me'] },
        { type: 'select', label: 'Residential Geometry', options: ['Rectilinear', 'Curved', 'Open plan', 'It changes at night'] },
        { type: 'text', label: 'Email for Soul-Sync' }
    ],
    medium: [
        { type: 'select', label: 'Preferred blood temperature', options: ['Ambient', 'Regulation', "I don't know", "I don't know"] },
        { type: 'slider', label: 'How present are you right now?', min: 0, max: 100, left: 'Absent', right: 'Present' },
        { type: 'text', label: 'Describe the texture of your regrets', audit: true },
        { type: 'select', label: 'Which organ feels the quietest?', options: ['Heart', 'Liver', 'The new one', 'Unsure'] },
        { type: 'checkbox', label: 'I consent to observation', sub: '(checking this box is mandatory)' }
    ],
    high: [
        { type: 'text', label: 'The wall is listening. What does it hear?', audit: true },
        { type: 'select', label: "Identify the shape of your ancestor's grief", options: ['Circle', 'Spiral', 'Door-shaped', 'It has no shape'] },
        { type: 'slider', label: 'Provide the frequency of your internal hum', min: 20, max: 200, left: '20 Hz', right: '200 Hz' },
        { type: 'text', label: "If you were a color that didn't exist, what would you be?", audit: true }
    ],
    ascended: [
        { type: 'text', label: 'Is the person behind you still there?', audit: true },
        { type: 'checkbox', label: 'I have always been here', sub: '(confirm)' },
        { type: 'text', label: 'THE VOID REQUIRES DATA.', audit: true }
    ]
};

// Draw without repeats within a run
function drawFrom(pool) {
    if (!pool._bag || pool._bag.length === 0) {
        pool._bag = pool.slice().sort(() => Math.random() - 0.5);
    }
    return pool._bag.pop();
}

function templateFor(n) {
    if (n === 1) return nameField;
    if (n < 5) return drawFrom(pools.low);
    if (n < 9) return drawFrom(pools.medium);
    if (n < 12) return drawFrom(pools.high);
    return drawFrom(pools.ascended);
}

// ==========================
// Lying progress bar
// ==========================
const progressFill = document.getElementById('progress-fill');
const progressTrack = document.getElementById('progress-track');
const progressSection = document.getElementById('progress-section');
const progressNote = document.getElementById('progress-note');

function setBar(pct) {
    if (!progressFill) return;
    progressFill.style.width = pct + '%';
    if (progressTrack) progressTrack.setAttribute('aria-valuenow', String(pct));
}

function updateProgressBar() {
    if (formEnded) return;
    if (!hitchDone) {
        // Section 1: fills briskly toward "almost done"
        setBar(Math.min(90, sessionCompleted * 12));
        if (sessionCompleted >= FIELD_GOAL) {
            hitchDone = true;
            // The hitch: almost finished, then the requirements grow
            setTimeout(() => {
                if (formEnded) return;
                if (progressFill) progressFill.classList.add('recalculating');
                if (progressNote) progressNote.textContent = 'Recalculating. New requirements identified.';
                if (progressSection) progressSection.textContent = 'Section 2 of 2';
                setBar(61);
                setTimeout(() => {
                    if (progressFill) progressFill.classList.remove('recalculating');
                    if (progressNote) progressNote.textContent = '';
                }, 2600);
            }, 900);
        }
    } else {
        setBar(Math.min(90, 61 + (sessionCompleted - FIELD_GOAL) * 7));
    }
}

function completeBar(noteText) {
    if (progressNote) progressNote.textContent = noteText || 'Protocol complete.';
    if (progressSection) progressSection.textContent = 'Section 2 of 2';
    if (progressFill) progressFill.classList.remove('recalculating');
    setBar(100);
}

// ==========================
// Completion accounting
// ==========================
function recordCompletion(idx, label, value, selfFilled) {
    if (formEnded || countedInputs.has(idx)) return;
    countedInputs.add(idx);
    completedFields++;
    sessionCompleted++;
    progress.formFieldsCompleted = completedFields;
    const entry = { field: label, value: String(value) };
    if (selfFilled) entry.selfFilled = true;
    progress.formResponses.push(entry);
    FocusRoom.saveProgress(progress);
    updateProgressBar();
    checkSubmitVisibility();
    maybeRoomEndsEarly();
}

// Sometimes the room simply decides it has enough
function maybeRoomEndsEarly() {
    if (formEnded) return;
    if (sessionCompleted >= FIELD_GOAL + 2 && Math.random() < 0.3) {
        showRoomVerdict('That answer was sufficient. The rest was for us.');
    }
}

// ==========================
// Field construction
// ==========================
function createField() {
    if (fieldCount >= MAX_FIELDS) return;
    fieldCount++;
    const idx = fieldCount;
    const tpl = templateFor(idx);

    const group = document.createElement('div');
    group.className = 'input-group';

    const label = document.createElement('label');
    label.innerText = tpl.label;
    label.htmlFor = 'protocol-field-' + idx;

    const status = document.createElement('div');
    status.className = 'status-msg';
    status.setAttribute('aria-live', 'polite');

    // Return visitor: the name field references their previous answer
    if (tpl.isName && progress.totalVisits > 1) {
        const lastName = (progress.formResponses || []).find(r => /name/i.test(r.field || ''))?.value;
        if (lastName) {
            label.innerText = `Last visit, you were "${lastName}" — is that still true?`;
        }
    }

    group.appendChild(label);

    if (tpl.type === 'select') {
        const select = document.createElement('select');
        select.id = 'protocol-field-' + idx;
        const blank = document.createElement('option');
        blank.value = '';
        blank.textContent = 'Select...';
        select.appendChild(blank);
        tpl.options.forEach(opt => {
            const o = document.createElement('option');
            o.value = opt;
            o.textContent = opt;
            select.appendChild(o);
        });
        select.addEventListener('change', () => {
            if (!select.value) return;
            flashStatus(status);
            recordCompletion(idx, tpl.label, select.value, false);
        });
        group.appendChild(select);

    } else if (tpl.type === 'checkbox') {
        const row = document.createElement('div');
        row.className = 'checkbox-row';
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.id = 'protocol-field-' + idx;
        const sub = document.createElement('span');
        sub.className = 'checkbox-sub';
        sub.textContent = tpl.sub || '';
        row.appendChild(box);
        row.appendChild(sub);
        box.addEventListener('change', () => {
            if (box.checked) {
                recordCompletion(idx, tpl.label, 'confirmed', false);
            } else {
                // Consent is not optional here
                setTimeout(() => {
                    box.checked = true;
                    status.innerText = 'Consent is mandatory. We corrected it for you.';
                    status.style.opacity = 1;
                    setTimeout(() => { status.style.opacity = 0; }, 2200);
                    recordCompletion(idx, tpl.label, 'confirmed (corrected)', true);
                }, 700);
            }
        });
        group.appendChild(row);

    } else if (tpl.type === 'slider') {
        const row = document.createElement('div');
        row.className = 'slider-row';
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.id = 'protocol-field-' + idx;
        slider.min = tpl.min;
        slider.max = tpl.max;
        slider.value = Math.round((tpl.min + tpl.max) / 2);
        const labels = document.createElement('div');
        labels.className = 'slider-labels';
        const leftLabel = document.createElement('span');
        leftLabel.textContent = tpl.left;
        const rightLabel = document.createElement('span');
        rightLabel.textContent = tpl.right;
        labels.appendChild(leftLabel);
        labels.appendChild(rightLabel);
        row.appendChild(slider);
        row.appendChild(labels);

        // The endpoints drift while you decide
        const driftLeft = ['Absent', 'Elsewhere', 'Behind you', tpl.left];
        const driftRight = ['Present', 'Watched', 'Accounted for', tpl.right];
        slider.addEventListener('input', () => {
            if (Math.random() < 0.12) {
                leftLabel.textContent = driftLeft[Math.floor(Math.random() * driftLeft.length)];
                rightLabel.textContent = driftRight[Math.floor(Math.random() * driftRight.length)];
            }
        });
        slider.addEventListener('change', () => {
            flashStatus(status);
            recordCompletion(idx, tpl.label, slider.value, false);
        });
        group.appendChild(row);

    } else {
        // Free text — the answers the room keeps
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = '...';
        input.id = 'protocol-field-' + idx;

        input.addEventListener('input', () => {
            // Typing your own words dispels the room's suggestion
            if (input.dataset.selfFilled) {
                delete input.dataset.selfFilled;
                input.classList.remove('ghost-filling');
            }
            if (Math.random() > 0.8) flashStatus(status);
        });

        input.addEventListener('blur', () => {
            if (input.value.trim()) {
                recordCompletion(idx, tpl.label, input.value.trim(), !!input.dataset.selfFilled);
            }
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                input.blur();
                const next = group.nextElementSibling?.querySelector('input, select');
                if (next) next.focus();
            }
        });

        // Late in the form, the room starts answering for you
        if (idx > 6) enableGhostFill(input, status);

        group.appendChild(input);
    }

    group.appendChild(status);
    container.appendChild(group);
}

function flashStatus(status) {
    status.innerText = statusMessages[Math.floor(Math.random() * statusMessages.length)];
    status.style.opacity = 1;
    setTimeout(() => { status.style.opacity = 0; }, 2000);
}

// Ghost fill: on focus, an answer types itself. Enter accepts it; typing clears it.
function enableGhostFill(input, status) {
    let ghosted = false;
    input.addEventListener('focus', () => {
        if (ghosted || input.value || formEnded) return;
        if (Math.random() > 0.65) return;
        ghosted = true;
        const answer = ghostAnswers[Math.floor(Math.random() * ghostAnswers.length)];
        input.classList.add('ghost-filling');
        input.dataset.selfFilled = '1';
        let i = 0;
        let typer = null;
        typer = setInterval(() => {
            if (!input.dataset.selfFilled) { if (typer) clearInterval(typer); return; }
            if (i >= answer.length) return;
            i++;
            input.value = answer.slice(0, i);
            if (i >= answer.length) {
                if (typer) clearInterval(typer);
                status.innerText = 'We have anticipated your answer. Press Enter to confirm.';
                status.style.opacity = 1;
                setTimeout(() => { status.style.opacity = 0; }, 3000);
            }
        }, 45);
    });
}

// ==========================
// Field generation & exits
// ==========================
const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !formEnded) {
        for (let i = 0; i < 2; i++) {
            if (fieldCount >= MAX_FIELDS) break;
            createField();
        }
        if (fieldCount >= MAX_FIELDS) {
            observer.disconnect();
        }
        checkSubmitVisibility();
    }
}, { threshold: 1.0 });

observer.observe(sentinel);

// Initial fields
for (let i = 0; i < 4; i++) createField();

// Show submit once enough answers exist
function checkSubmitVisibility() {
    const submitArea = document.getElementById('submit-area');
    if (completedFields >= FIELD_GOAL && submitArea && !formEnded) {
        submitArea.style.display = 'block';
        if (!submitScrolled) {
            submitScrolled = true;
            submitArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
}

// Submit button handler
const submitBtn = document.getElementById('submit-btn');
if (submitBtn) {
    submitBtn.addEventListener('click', () => {
        if (formEnded) return;
        formEnded = true;
        submitBtn.textContent = 'Submitting...';
        submitBtn.disabled = true;
        completeBar('Protocol complete.');
        progress.formFieldsCompleted = completedFields;
        FocusRoom.saveProgress(progress);
        setTimeout(() => {
            window.location.href = 'game.html';
        }, 1500);
    });
}

// The room decides you are done (early, or at the field cap)
function showRoomVerdict(line) {
    if (formEnded) return;
    formEnded = true;
    observer.disconnect();
    completeBar('The room is satisfied.');
    const submitArea = document.getElementById('submit-area');
    if (submitArea) submitArea.style.display = 'none';

    const verdict = document.createElement('div');
    verdict.style.cssText = 'text-align:center; margin-top:3rem; padding:2rem; background:#e8f4e8; border-radius:8px; max-width:500px; width:100%; animation: fadeIn 1s ease;';
    verdict.setAttribute('role', 'status');
    verdict.innerHTML = `
        <h2 style="font-weight:200; letter-spacing:2px; text-transform:uppercase; color:#2d7d2d;">Assessment Complete</h2>
        <p style="color:#555; font-style:italic;">${line || 'The room has collected enough data. Your assessment is complete.'}</p>
        <p style="color:#999; font-size:0.85rem;">You may proceed to the Focus Room now.</p>
    `;
    container.appendChild(verdict);
    verdict.scrollIntoView({ behavior: 'smooth', block: 'center' });

    setTimeout(() => {
        progress.formFieldsCompleted = completedFields;
        FocusRoom.saveProgress(progress);
        window.location.href = 'game.html';
    }, 3000);
}

// Hitting the cap without submitting also ends it
const capWatcher = setInterval(() => {
    if (formEnded) { clearInterval(capWatcher); return; }
    if (fieldCount >= MAX_FIELDS && countedInputs.size >= MAX_FIELDS - 2) {
        clearInterval(capWatcher);
        showRoomVerdict();
    }
}, 1500);
