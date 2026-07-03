/* ===== shared.js — The Focus Room ===== */

(function () {
  'use strict';

  // ========== localStorage Schema ==========
  const STORAGE_KEY = 'focusroom_progress';

  const defaultState = {
    formFieldsCompleted: 0,
    formResponses: [],
    gameInputs: [],
    fearCount: 0,
    calmCount: 0,
    sessionCount: 0,
    lastVisited: null,
    guestbookSigned: false,
    voidVisited: false,
    konamiUnlocked: false,
    webmasterVisited: false,
    totalVisits: 0
  };

  function loadProgress() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return { ...defaultState };
      const parsed = JSON.parse(stored);
      // Merge with defaults to handle schema updates
      return { ...defaultState, ...parsed };
    } catch (e) {
      return { ...defaultState };
    }
  }

  function saveProgress(progress) {
    try {
      // Cap arrays to prevent localStorage overflow
      if (progress.formResponses && progress.formResponses.length > 50) {
        progress.formResponses = progress.formResponses.slice(-50);
      }
      if (progress.gameInputs && progress.gameInputs.length > 100) {
        progress.gameInputs = progress.gameInputs.slice(-100);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch (e) {
      console.warn('localStorage write failed:', e);
    }
  }

  // Increment session count on load
  let progress = loadProgress();
  progress.totalVisits = (progress.totalVisits || 0) + 1;

  // Track return visits
  const now = new Date().toISOString();
  if (progress.lastVisited && progress.lastVisited !== now) {
    const lastVisit = new Date(progress.lastVisited);
    const hoursSince = (new Date() - lastVisit) / (1000 * 60 * 60);
    if (hoursSince > 1) {
      // Show return visitor banner (except on game/form pages)
      if (!isGameOrFormPage()) {
        showReturnBanner(progress.totalVisits);
      }
    }
  }
  progress.lastVisited = now;
  saveProgress(progress);

  // ========== Helper: detect page type ==========
  function isGameOrFormPage() {
    const path = window.location.pathname;
    return path.endsWith('game.html') || path.endsWith('form.html');
  }

  // ========== Return Visitor Banner ==========
  function showReturnBanner(visitCount) {
    const now = new Date();
    const lastVisit = progress.lastVisited ? new Date(progress.lastVisited) : null;
    let timeSinceMessage = '';

    if (lastVisit && !isNaN(lastVisit.getTime())) {
      const hoursSince = (now - lastVisit) / (1000 * 60 * 60);
      if (hoursSince < 24) {
        const minsSince = Math.round(hoursSince * 60);
        if (minsSince < 1) {
          timeSinceMessage = ' You returned before the last session finished loading.';
        } else if (minsSince < 60) {
          timeSinceMessage = ' You\'re back already. The room was just starting to miss your data.';
        } else {
          timeSinceMessage = ' ' + Math.round(hoursSince * 10) / 10 + ' hours since last visit. The room kept your chair warm.';
        }
      }
    }

    let msg;
    if (visitCount === 2) {
      msg = 'We remembered you.' + timeSinceMessage;
    } else if (visitCount === 3) {
      msg = 'You keep coming back. The room likes that.' + timeSinceMessage;
    } else if (visitCount >= 4) {
      msg = 'Session ████. Your alignment is... shifting. We can feel it.' + timeSinceMessage;
    } else {
      // Fallback for any count
      const fallbacks = [
        'Welcome back. You\'ve been here before.',
        'We remembered you. Interesting.',
        'Session ' + visitCount + '. The room notices patterns.',
        'Return visit logged. Your alignment is shifting.',
        'The Focus Room has missed your data.'
      ];
      msg = fallbacks[Math.min(visitCount - 1, fallbacks.length - 1)] + timeSinceMessage;
    }

    const banner = document.createElement('div');
    banner.className = 'return-banner';
    banner.textContent = msg;
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 5500);
  }

  // ========== Audio Manager ==========
  let audioCtx = null;
  let audioStarted = false;

  function initAudio() {
    if (audioStarted) return;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioStarted = true;
      // Start low hum
      playHum();
    } catch (e) {
      console.warn('AudioContext not available:', e);
    }
  }

  function playHum() {
    if (!audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      // Scale frequency slightly based on visit count for "louder on return"
      const freq = 55 + (progress.totalVisits * 2);
      osc.frequency.setValueAtTime(Math.min(freq, 80), audioCtx.currentTime);
      gain.gain.setValueAtTime(0.02, audioCtx.currentTime); // Very quiet
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      // Stop after a while to avoid constant drain
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 8);
      osc.stop(audioCtx.currentTime + 8);
    } catch (e) {
      // Silently fail
    }
  }

  // Start audio on first interaction (satisfies autoplay policy)
  function startAudioOnInteraction() {
    if (audioStarted) return;
    initAudio();
    // Remove listeners after first start
    document.removeEventListener('click', startAudioOnInteraction);
    document.removeEventListener('keydown', startAudioOnInteraction);
  }

  document.addEventListener('click', startAudioOnInteraction, { once: true });
  document.addEventListener('keydown', startAudioOnInteraction, { once: true });

  // Expose for Mobile Safari: resume on CTA click before redirect
  window.resumeAudio = function () {
    if (!audioCtx) initAudio();
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  };

  // ========== Cursor Trail (disabled on game/form pages) ==========
  if (!isGameOrFormPage() && !('ontouchstart' in window)) {
    let trailThrottle = 0;
    document.addEventListener('mousemove', (e) => {
      if (Date.now() - trailThrottle < 50) return; // throttle
      trailThrottle = Date.now();
      const dot = document.createElement('div');
      dot.className = 'cursor-trail';
      dot.style.left = (e.clientX - 3) + 'px';
      dot.style.top = (e.clientY - 3) + 'px';
      document.body.appendChild(dot);
      setTimeout(() => dot.remove(), 500);
    });
  }

  // ========== Visitor Counter ==========
  function updateVisitorCounter() {
    const el = document.getElementById('visitor-counter');
    if (!el) return;
    // Fake counter: base + random offset + real visits
    const base = 84721;
    const fakeVisits = base + Math.floor(Math.random() * 500) + progress.totalVisits * 3;
    // Occasional glitch: show wrong number briefly
    const glitch = Math.random() < 0.15;
    const display = glitch
      ? fakeVisits.toString().split('').map(c => Math.random() < 0.3 ? '#' : c).join('')
      : fakeVisits.toString();
    el.textContent = `You are visitor #${display} of the Focus Room`;
    // If glitched, correct after a beat
    if (glitch) {
      setTimeout(() => {
        el.textContent = `You are visitor #${fakeVisits} of the Focus Room`;
      }, 300);
    }
  }

  // ========== Inject "Archive" link into navigation ==========
  function injectArchiveLink() {
    // Try shared-nav first
    const navLinks = document.querySelector('.shared-nav .nav-links');
    if (navLinks) {
      const sessionsLink = navLinks.querySelector('a[href="game.html"]');
      if (sessionsLink && !navLinks.querySelector('a[href="videos.html"]')) {
        const archiveLink = document.createElement('a');
        archiveLink.href = 'videos.html';
        archiveLink.textContent = 'Archive';
        sessionsLink.parentNode.insertBefore(archiveLink, sessionsLink.nextSibling);
      }
      return;
    }
    // Fallback: index.html custom nav
    const tabs = document.querySelector('nav .tabs');
    if (tabs) {
      const sessionsLink = tabs.querySelector('a[href="game.html"]');
      if (sessionsLink && !tabs.querySelector('a[href="videos.html"]')) {
        const archiveLink = document.createElement('a');
        archiveLink.href = 'videos.html';
        archiveLink.textContent = 'Archive';
        sessionsLink.parentNode.insertBefore(archiveLink, sessionsLink.nextSibling);
      }
    }
  }

  // ========== Add subtle void link to footer ==========
  function injectVoidLink() {
    const footer = document.querySelector('.shared-footer');
    if (!footer) return;
    const container = footer.querySelector('#hidden-footer-links');
    if (!container) return;
    const link = document.createElement('a');
    link.href = 'void.html';
    link.textContent = '[ void ]';
    link.className = 'void-link';
    link.title = 'Forget everything.';
    container.appendChild(link);
  }

  // ========== Dim current-page link in nav ==========
  function dimCurrentNavLink() {
    const navLinks = document.querySelector('.shared-nav .nav-links')
      || document.querySelector('nav .tabs');
    if (!navLinks) return;
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    navLinks.querySelectorAll('a').forEach(a => {
      if (a.getAttribute('href') === currentPage) {
        a.classList.add('current-page');
      }
    });
  }

  // Run counter update
  function initSharedPage() {
    updateVisitorCounter();
    // Restore Konami unlock if previously earned
    if (loadProgress().konamiUnlocked) showVoidLink();
    // Inject Archive link and void link
    injectArchiveLink();
    injectVoidLink();
    dimCurrentNavLink();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSharedPage);
  } else {
    initSharedPage();
  }

  // ========== Konami Code ==========
  const konamiSequence = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','KeyB','KeyA'];
  let konamiIndex = 0;
  document.addEventListener('keydown', (e) => {
    if (e.code === konamiSequence[konamiIndex]) {
      konamiIndex++;
      if (konamiIndex === konamiSequence.length) {
        // Unlocked!
        progress.konamiUnlocked = true;
        saveProgress(progress);
        showVoidLink();
        alert('👁 CONGRATULATIONS. THE VOID IS NOW ACCESSIBLE. 👁');
        konamiIndex = 0;
      }
    } else {
      konamiIndex = 0;
    }
  });

  function showVoidLink() {
    const container = document.getElementById('hidden-footer-links');
    if (!container) return;
    // Don't overwrite the always-present void link injected by injectVoidLink()
    if (container.querySelector('.void-link')) return;
    container.innerHTML = '<a href="void.html">[ void ]</a>';
  }

  // ========== Public API (exposed to other pages) ==========
  window.FocusRoom = {
    getProgress: loadProgress,
    saveProgress,
    initAudio,
    playHum,
    STORAGE_KEY,
    defaultState,
    isGameOrFormPage
  };

})();
