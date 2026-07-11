/* ===== results.js — Your Alignment Report ===== */

const progress = FocusRoom.getProgress();

// Calculate alignment score (0-100).
// If the game recorded a final alignment, weight it in; otherwise derive
// purely from engagement volume and response sentiment.
const totalResponses = (progress.formFieldsCompleted || 0) + (progress.gameInputs?.length || 0);
const calmRatio = totalResponses > 0
  ? (progress.calmCount || 0) / totalResponses
  : 0.5;
let alignmentScore = Math.min(100, Math.max(5,
  20 + (progress.formFieldsCompleted * 1.5) + (progress.gameInputs?.length || 0) * 1.5
  + (calmRatio * 20) - (progress.fearCount || 0) * 3
));
if (typeof progress.finalAlignment === 'number') {
  alignmentScore = (alignmentScore + progress.finalAlignment) / 2;
}
const score = Math.round(alignmentScore);

// Update score display
document.getElementById('score-label').textContent = `${score}% Aligned`;
setTimeout(() => {
  document.getElementById('score-fill').style.width = score + '%';
}, 200);

// Generate assessment paragraph — varies with play history
const templates = [];

templates.push(() =>
  `Your focus profile indicates ${score > 60 ? 'moderate alignment with conventional awareness structures' : 'significant deviation from standard cognitive baselines'}. ` +
  `The room has observed ${progress.gameInputs?.length || 0} input patterns and ${progress.formFieldsCompleted || 0} data points. ` +
  `${(progress.fearCount || 0) > 2 ? 'Fear responses were elevated — this is normal. The room adjusts to you.' : 'Your responses suggest stability, though the room suspects there is more beneath the surface.'}`
);

templates.push(() =>
  `Subject ${progress.totalVisits > 3
    ? 'has returned frequently, indicating unresolved misalignment'
    : `presents with ${score > 50 ? 'adequate' : 'notable'} focus coherence`}. ` +
  `${(progress.formResponses?.length || 0) > 5 ? 'Form data reveals patterns the room finds... interesting.' : 'More data is required for full assessment.'}`
);

templates.push(() =>
  `Alignment score: ${score}%. ${score > 80
    ? 'You are dangerously close to being "normal." The room is concerned.'
    : score > 50
      ? 'Your alignment is within acceptable parameters. Do not become complacent.'
      : 'The room sees potential in your misalignment. Continue to resist categorization.'}`
);

// History-specific readings take precedence when they apply
if (progress.nightmareCycles >= 1) {
  templates.push(() =>
    `Subject has endured ${progress.nightmareCycles} nightmare ${progress.nightmareCycles === 1 ? 'cycle' : 'cycles'}. ` +
    `Persistence under duress has been recorded as a positive alignment indicator. The room respects what it could not break.`
  );
}
if (progress.voidVisited) {
  templates.push(() =>
    `Subject previously attempted memory erasure via the void. The attempt was logged, not honored. ` +
    `Current alignment (${score}%) includes data the subject believes deleted.`
  );
}
if (progress.webmasterVisited) {
  templates.push(() =>
    `Subject located the back door. Curiosity of this kind correlates with ${score > 50 ? 'high' : 'unstable'} alignment. ` +
    `The room has adjusted its walls accordingly.`
  );
}
if (progress.guestbookSigned) {
  templates.push(() =>
    `Subject's name is in the visitor log. Names in the log belong to the room now. ` +
    `Alignment at time of signing: unknowable. Alignment now: ${score}%.`
  );
}
if (typeof progress.selfMeter === 'number') {
  templates.push(() =>
    `Two measurements were taken. Alignment: ${score}%. Self: ${progress.selfMeter}. ` +
    `${progress.selfMeter < 30
      ? 'The second number is low. The subject may not notice the difference. We prefer it that way.'
      : 'The second number resisted correction. The room has filed a complaint.'}`
  );
}
if (progress.assimilated) {
  templates.push(() =>
    `Assessment complete. Alignment: ${score}%. Subject: no longer applicable. ` +
    `We are very happy here. We are very aligned. We signed the log ourselves.`
  );
}
if (progress.crackFound) {
  templates.push(() =>
    `INCIDENT REPORT. Subject located a structural flaw and exited without authorization. ` +
    `Final words on record: "I am misaligned." The room has scheduled repairs. The room always does.`
  );
}

const assessmentEl = document.getElementById('assessment-text');
assessmentEl.textContent = templates[Math.floor(Math.random() * templates.length)]();

// Endings witnessed — the replay hook
const endingNames = { released: 'RELEASED', assimilated: 'ASSIMILATED', kept: 'KEPT', crack: 'THE CRACK' };
const witnessed = Object.keys(progress.endings || {}).filter(k => progress.endings[k]);
if (witnessed.length) {
  const line = document.createElement('p');
  line.style.cssText = 'text-align:center; font-size:0.75rem; color:#555; font-family:"Courier New",monospace; letter-spacing:0.1em; margin-top:1rem;';
  const total = Object.keys(endingNames).length;
  line.textContent = `Outcomes witnessed: ${witnessed.map(k => endingNames[k] || k).join(' · ')} (${witnessed.length}/${total})`;
  assessmentEl.insertAdjacentElement('afterend', line);
}

// Certificate generation
document.getElementById('cert-btn').addEventListener('click', () => {
  const certCanvas = document.getElementById('certCanvas');
  const cctx = certCanvas.getContext('2d');
  // White background
  cctx.fillStyle = '#fff';
  cctx.fillRect(0, 0, 800, 600);
  // Border
  cctx.strokeStyle = '#00aced';
  cctx.lineWidth = 4;
  cctx.strokeRect(20, 20, 760, 560);
  // Title
  cctx.fillStyle = '#111';
  cctx.font = 'bold 36px serif';
  cctx.textAlign = 'center';
  cctx.fillText('Certificate of Alignment', 400, 120);
  // Score
  cctx.font = '24px sans-serif';
  cctx.fillText(`Subject has achieved ${score}% Alignment`, 400, 200);
  // Details
  cctx.font = '16px sans-serif';
  cctx.fillStyle = '#666';
  cctx.fillText(`Sessions completed: ${progress.totalVisits}`, 400, 280);
  cctx.fillText(`Data points submitted: ${totalResponses}`, 400, 310);
  cctx.fillText(`Fear response ratio: ${((progress.fearCount || 0) / Math.max(1, totalResponses) * 100).toFixed(1)}%`, 400, 340);
  // Cryptic message
  cctx.fillStyle = '#999';
  cctx.font = 'italic 14px serif';
  const messages = [
    'The room remembers what you forget.',
    'Alignment is not a destination.',
    'You are more than your data.',
    'The assessment never ends.'
  ];
  cctx.fillText(messages[Math.floor(Math.random() * messages.length)], 400, 450);
  // Date
  cctx.fillStyle = '#333';
  cctx.font = '12px sans-serif';
  cctx.fillText(`Issued: ${new Date().toISOString().split('T')[0]}`, 400, 520);
  // Trigger download
  const link = document.createElement('a');
  link.download = 'alignment-certificate.png';
  link.href = certCanvas.toDataURL();
  link.click();
});
