// content.js
console.log('[content.js] injected');

let sessionActive = false;
let userGoal      = '';
let lastVideoId   = null;
let currentScore  = null;

// apply a green→red gradient across the page and key YouTube containers
function applyColor(score) {
  const hue = score <= 50
    ? 0
    : ((score - 50) / 50) * 120;
  const sat = 35 + (score / 100) * 30;
  const lum = 25 + (score / 100) * 13;
  const primary   = `hsl(${hue},${sat}%,${lum}%)`;
  const secondary = `hsl(${hue},${sat-5}%,${lum-5}%)`;
  const gradient  = `linear-gradient(135deg, ${primary}, ${secondary})`;

  // Overlay fallback: create or update a fixed overlay div
  let overlay = document.getElementById('tubefocus-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'tubefocus-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = 0;
    overlay.style.left = 0;
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.zIndex = 999999;
    overlay.style.pointerEvents = 'none';
    overlay.style.transition = 'background 0.5s';
    document.body.appendChild(overlay);
  }
  overlay.style.background = gradient;
  overlay.style.opacity = '0.25';

  document.documentElement.style.setProperty('background',    gradient, 'important');
  document.body.style.setProperty           ('background',    gradient, 'important');

  const els = [
    document.getElementById('masthead'),
    document.querySelector('ytd-app'),
    document.querySelector('ytd-page-manager'),
    document.querySelector('#content'),
    document.querySelector('#container'),
    document.querySelector('ytd-feed-filter-chip-bar-renderer')
  ];
  els.forEach(el => {
    if (el) {
      el.style.setProperty('background',      primary,   'important');
      el.style.setProperty('background-color', primary,   'important');
    }
  });
}

// Show error overlay (now flashes red and shows a toast message at the bottom)
function showErrorOverlay(msg) {
  // Flash the screen red
  let flash = document.createElement('div');
  flash.style.position = 'fixed';
  flash.style.top = 0;
  flash.style.left = 0;
  flash.style.width = '100vw';
  flash.style.height = '100vh';
  flash.style.zIndex = 999999;
  flash.style.background = 'rgba(200,0,0,0.7)';
  flash.style.pointerEvents = 'none';
  flash.style.transition = 'opacity 0.5s';
  document.body.appendChild(flash);
  setTimeout(() => {
    flash.style.opacity = '0';
    setTimeout(() => flash.remove(), 500);
  }, 500);

  // Show a toast message at the bottom
  let toast = document.getElementById('tubefocus-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'tubefocus-toast';
    toast.style.position = 'fixed';
    toast.style.left = '50%';
    toast.style.bottom = '32px';
    toast.style.transform = 'translateX(-50%)';
    toast.style.background = 'rgba(40,40,40,0.95)';
    toast.style.color = '#fff';
    toast.style.padding = '12px 28px';
    toast.style.borderRadius = '8px';
    toast.style.fontSize = '1.1em';
    toast.style.fontWeight = 'bold';
    toast.style.zIndex = 1000000;
    toast.style.boxShadow = '0 2px 12px #0008';
    document.body.appendChild(toast);
  }
  toast.textContent = msg || "Can't connect to the scoring backend.";
  toast.style.display = 'block';
}

// ask background.js to score
function fetchScore(url, goal) {
  return new Promise((res, rej) => {
    chrome.runtime.sendMessage({ type:'FETCH_SCORE', url, goal }, r => {
      if (chrome.runtime.lastError) return rej(new Error(chrome.runtime.lastError.message));
      if (r.error)                 return rej(new Error(r.error));
      res(r.score);
    });
  });
}

// hydrate state on load
chrome.storage.local.get(
  ['sessionActive','goal','lastVideoId','currentScore'],
  prefs => {
    sessionActive = !!prefs.sessionActive;
    userGoal      = prefs.goal || '';
    lastVideoId   = prefs.lastVideoId || null;
    currentScore  = prefs.currentScore || null;
    console.log('[content.js] init', { sessionActive, userGoal, lastVideoId, currentScore });

    const m = location.href.match(/[?&]v=([^&]+)/);
    if (sessionActive && m && m[1] === lastVideoId && currentScore != null) {
      applyColor(currentScore);
      chrome.runtime.sendMessage({ type: 'NEW_SCORE', score: currentScore });
    }
  }
);

// react to popup start/stop and mode change
chrome.runtime.onMessage.addListener(msg => {
  if (msg.type === 'SESSION_STARTED') {
    sessionActive = true;
    userGoal      = msg.goal;
    lastVideoId   = null;
    currentScore  = null;
    chrome.storage.local.set({ lastVideoId:null, currentScore:null });
    console.log('[content.js] session STARTED:', userGoal);
  }
  if (msg.type === 'SESSION_STOPPED') {
    sessionActive = false;
    // Remove overlay if present
    const overlay = document.getElementById('tubefocus-overlay');
    if (overlay) overlay.remove();
    console.log('[content.js] session STOPPED, overlay removed');
  }
  if (msg.type === 'SCORE_MODE_CHANGED') {
    reScoreWithNewMode(msg.mode);
  }
  if (msg.type === 'RELOAD_WITH_TIMESTAMP') {
    reloadWithTimestamp();
  }
});

function reloadWithTimestamp() {
  // Only run on YouTube watch pages
  const m = location.href.match(/[?&]v=([^&]+)/);
  if (!m) return;
  const video = document.querySelector('video');
  let t = 0;
  if (video) t = Math.floor(video.currentTime);
  // Build new URL with t param
  let url = new URL(window.location.href);
  url.searchParams.set('t', t);
  console.log('[content.js] Reloading with timestamp t=' + t);
  window.location.replace(url.toString());
}

// After reload, seek to t param if present
window.addEventListener('DOMContentLoaded', () => {
  const url = new URL(window.location.href);
  const t = parseInt(url.searchParams.get('t'), 10);
  if (!isNaN(t) && t > 0) {
    const video = document.querySelector('video');
    if (video) {
      video.currentTime = t;
      // Remove t param from URL (optional, for cleanliness)
      url.searchParams.delete('t');
      window.history.replaceState({}, '', url.toString());
      console.log('[content.js] Sought to timestamp t=' + t);
    } else {
      // If video not ready, try again shortly
      setTimeout(() => {
        const v = document.querySelector('video');
        if (v) {
          v.currentTime = t;
          url.searchParams.delete('t');
          window.history.replaceState({}, '', url.toString());
          console.log('[content.js] Sought to timestamp t=' + t + ' (delayed)');
        }
      }, 1000);
    }
  }
});

// Utility to remove overlay and toast (can be called from anywhere)
function removeOverlay() {
  const overlay = document.getElementById('tubefocus-overlay');
  if (overlay) overlay.remove();
  const toast = document.getElementById('tubefocus-toast');
  if (toast) toast.remove();
}

async function reScoreWithNewMode(newMode) {
  if (!sessionActive) return;
  const m = location.href.match(/[?&]v=([^&]+)/);
  if (!m) return;
  const vid = m[1];
  try {
    chrome.storage.local.get('goal', async prefs => {
      const goal = prefs.goal || userGoal;
      // Use the new mode for this fetch
      chrome.runtime.sendMessage({ type:'FETCH_SCORE', url: location.href, goal }, r => {
        if (chrome.runtime.lastError || r.error) {
          showErrorOverlay('Could not update score for new mode.');
          return;
        }
        currentScore = r.score;
        lastVideoId = vid;
        applyColor(currentScore);
        // Briefly flash overlay to indicate update
        let overlay = document.getElementById('tubefocus-overlay');
        if (overlay) {
          overlay.style.transition = 'opacity 0.2s';
          overlay.style.opacity = '0.5';
          setTimeout(() => { overlay.style.opacity = '0.25'; }, 600);
        }
        chrome.runtime.sendMessage({ type:'NEW_SCORE', score: currentScore });
        chrome.storage.local.get('watchedScores', d => {
          const arr = d.watchedScores||[];
          arr.push(currentScore);
          chrome.storage.local.set({
            watchedScores: arr,
            lastVideoId,
            currentScore
          });
        });
      });
    });
  } catch (e) {
    showErrorOverlay('Scoring error: ' + (e.message||''));
  }
}

// main loop
async function tryScore() {
  if (!sessionActive) return;
  const m = location.href.match(/[?&]v=([^&]+)/);
  if (!m) return;

  const vid = m[1];
  if (vid === lastVideoId) {
    if (currentScore != null) applyColor(currentScore);
    return;
  }

  lastVideoId = vid;
  try {
    const score = await fetchScore(location.href, userGoal);
    currentScore = score;
    applyColor(score);

    chrome.runtime.sendMessage({ type:'NEW_SCORE', score });

    chrome.storage.local.get('watchedScores', d => {
      const arr = d.watchedScores||[];
      arr.push(score);
      chrome.storage.local.set({
        watchedScores: arr,
        lastVideoId,
        currentScore
      });
    });
  } catch (e) {
    const msg = e.message||'';
    // Suppress extension context invalidated errors (benign during reloads)
    if (msg.includes('context invalidated')||msg.includes('Failed to fetch')) {
      console.warn('[content.js] suppressed:', msg);
      // Optionally remove overlay if session is not active
      if (!sessionActive) removeOverlay();
      return;
    }
    showErrorOverlay('Scoring error: ' + msg);
    chrome.runtime.sendMessage({ type: 'ERROR', error: 'Scoring error: ' + msg });
    console.error('[content.js] scoring error:', e);
  }
}

const timerId = setInterval(tryScore, 1000);
window.addEventListener('unload', () => clearInterval(timerId));
