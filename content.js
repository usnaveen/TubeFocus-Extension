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
  
  // --- FIX: Capped lightness to prevent overly bright green ---
  const lum = 25 + (score / 100) * 13; // Max lightness is now 38% instead of 45%
  // --- END OF FIX ---

  const primary   = `hsl(${hue},${sat}%,${lum}%)`;
  const secondary = `hsl(${hue},${sat-5}%,${lum-5}%)`;
  const gradient  = `linear-gradient(135deg, ${primary}, ${secondary})`;

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

// react to popup start/stop
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
    console.log('[content.js] session STOPPED');
  }
});

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
    if (msg.includes('context invalidated')||msg.includes('Failed to fetch')) {
      console.warn('[content.js] suppressed:', msg);
      return;
    }
    console.error('[content.js] scoring error:', e);
  }
}

const timerId = setInterval(tryScore, 1000);
window.addEventListener('unload', () => clearInterval(timerId));
