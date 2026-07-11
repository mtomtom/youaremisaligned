/* ===== form.js — The Wellness Protocol (intake form) ===== */

const container = document.getElementById('form-container');
const sentinel = document.getElementById('sentinel');
let fieldCount = 0;
const progress = FocusRoom.getProgress();
let completedFields = progress.formFieldsCompleted || 0;
const countedInputs = new Set();
let submitScrolled = false;

const prompts = {
    low: ["Full Legal Name", "Email for Soul-Sync", "Residential Geometry", "Preferred Wake-Up Vibration"],
    medium: ["How many birds did you count today?", "Describe the texture of your regrets", "Which organ feels the quietest?", "Percentage of self currently occupied by water"],
    high: ["The wall is listening. What does it hear?", "Identify the shape of your ancestor's grief", "Provide the frequency of your internal hum", "If you were a color that didn't exist, what would you be?"],
    ascended: ["Is the person behind you still there?", "Upload the sound of your last blinking", "Are you sure you are breathing correctly?", "THE VOID REQUIRES DATA."]
};

const statusMessages = [
    "Analyzing intent...", "Validation successful.", "Syntax: Uncomfortably Organic",
    "Warning: Pulse detected in input", "Data tastes... bitter.", "Optimizing your essence..."
];

function createField() {
    fieldCount++;
    let pool;
    if (fieldCount < 4) pool = prompts.low;
    else if (fieldCount < 8) pool = prompts.medium;
    else if (fieldCount < 12) pool = prompts.high;
    else pool = prompts.ascended;

    const text = pool[Math.floor(Math.random() * pool.length)];

    const group = document.createElement('div');
    group.className = 'input-group';

    const label = document.createElement('label');
    label.innerText = text;
    label.htmlFor = 'protocol-field-' + fieldCount;

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = "...";
    input.id = 'protocol-field-' + fieldCount;
    input.dataset.fieldIndex = fieldCount;

    const status = document.createElement('div');
    status.className = 'status-msg';
    status.setAttribute('aria-live', 'polite');

    // Return visitor: reference past answers
    if (fieldCount === 1 && progress.totalVisits > 1) {
        const lastAnswer = progress.formResponses?.[0]?.value || '...';
        label.innerText = `Last visit, you answered "${lastAnswer}" — has this changed?`;
    }

    // Add subtle uncanny effects as user types
    input.addEventListener('input', (e) => {
        if (fieldCount > 8) {
            const isMobile = 'ontouchstart' in window;
            const blurVal = e.target.value.length / 5;
            const maxBlur = isMobile ? 0.5 : 2;
            input.style.filter = `blur(${Math.min(blurVal, maxBlur)}px)`;
            const maxSpacing = isMobile ? 0 : 15;
            label.style.letterSpacing = isMobile ? '0px' : `${Math.min(e.target.value.length, maxSpacing)}px`;
        }

        if (Math.random() > 0.8) {
            status.innerText = statusMessages[Math.floor(Math.random() * statusMessages.length)];
            status.style.opacity = 1;
            setTimeout(() => { status.style.opacity = 0; }, 2000);
        }
    });

    // Track completion on blur (only count each field once)
    input.addEventListener('blur', () => {
        const idx = parseInt(input.dataset.fieldIndex);
        if (input.value.trim() && !countedInputs.has(idx)) {
            countedInputs.add(idx);
            completedFields++;
            progress.formFieldsCompleted = completedFields;
            progress.formResponses.push({ field: text, value: input.value.trim() });
            FocusRoom.saveProgress(progress);
            checkSubmitVisibility();
        }
    });

    group.appendChild(label);
    group.appendChild(input);
    group.appendChild(status);
    container.appendChild(group);

    // Auto-focus logic for the "never ending" feel
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            // If there's a next input, focus it; otherwise, the observer will handle it
            const next = group.nextElementSibling?.querySelector('input');
            if (next) next.focus();
        }
    });
}

// Maximum number of fields the room will ever ask for
const MAX_FIELDS = 30;

// Intersection Observer to detect when user reaches the bottom
const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
        // Generate 3 new fields, but stop at the max
        let generated = 0;
        for (let i = 0; i < 3; i++) {
            if (fieldCount >= MAX_FIELDS) break;
            createField();
            generated++;
        }
        // If we hit the max, the room decides you've provided enough
        if (fieldCount >= MAX_FIELDS) {
            observer.disconnect();
            showRoomVerdict();
        }
        checkSubmitVisibility();
    }
}, { threshold: 1.0 });

observer.observe(sentinel);

// Initial fields
for (let i = 0; i < 4; i++) createField();

// Show submit button after 20 completed fields
function checkSubmitVisibility() {
    const submitArea = document.getElementById('submit-area');
    if (completedFields >= 20 && submitArea) {
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
        submitBtn.textContent = 'Submitting...';
        submitBtn.disabled = true;
        // Update progress with actual completed count
        progress.formFieldsCompleted = completedFields;
        FocusRoom.saveProgress(progress);
        setTimeout(() => {
            window.location.href = 'game.html';
        }, 1500);
    });
}

// When the room has collected enough data, it decides for you
function showRoomVerdict() {
    const verdict = document.createElement('div');
    verdict.style.cssText = 'text-align:center; margin-top:3rem; padding:2rem; background:#e8f4e8; border-radius:8px; max-width:500px; width:100%; animation: fadeIn 1s ease;';
    verdict.innerHTML = `
        <h2 style="font-weight:200; letter-spacing:2px; text-transform:uppercase; color:#2d7d2d;">Assessment Complete</h2>
        <p style="color:#555; font-style:italic;">The room has collected enough data. Your assessment is complete.</p>
        <p style="color:#999; font-size:0.85rem;">You may proceed to the Focus Room now.</p>
    `;
    container.appendChild(verdict);
    verdict.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Auto-redirect after a pause
    setTimeout(() => {
        progress.formFieldsCompleted = completedFields;
        FocusRoom.saveProgress(progress);
        window.location.href = 'game.html';
    }, 3000);
}
