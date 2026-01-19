// content.js
console.log('[content.js] injected - LOCAL DEVELOPMENT MODE');
console.log('[content.js] API Base URL:', 'http://localhost:8080');

let sessionActive = false;
let userGoal      = '';
let lastVideoId   = null;
let currentScore  = null;
let lastFlashTime = 0;
let scoreDisplay  = null;

// Create the score display component
function createScoreDisplay() {
  if (scoreDisplay) return scoreDisplay;
  
  scoreDisplay = document.createElement('div');
  scoreDisplay.id = 'tubefocus-score-display';
  scoreDisplay.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 20px;
    background: rgba(0, 0, 0, 0.4);
    color: white;
    padding: 8px 12px;
    border-radius: 6px;
    font-family: 'Roboto', sans-serif;
    font-size: 12px;
    font-weight: bold;
    z-index: 10000;
    transition: all 0.3s ease;
    backdrop-filter: blur(5px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    min-width: 60px;
    text-align: center;
    opacity: 0;
    transform: translateY(10px);
  `;
  document.body.appendChild(scoreDisplay);
  return scoreDisplay;
}

// NEW: Update the score display with various states
function updateScoreDisplay(state, data = {}) {
  if (!scoreDisplay) {
    scoreDisplay = createScoreDisplay();
  }

  let html = '';
  let color = '#fff';
  let borderColor = 'rgba(255, 255, 255, 0.1)';

  switch (state) {
    case 'loading':
      html = `<div style="font-size: 12px; opacity: 0.8;">Calculating...</div>`;
      color = '#ccc';
      borderColor = '#888';
      break;
    case 'error':
      const errorMsg = data.message || 'Error';
      html = `
        <div style="font-size: 11px; line-height: 1.2; text-align: center;">
          <div style="margin-bottom: 2px;">⚠️ Error</div>
          <div style="font-size: 9px; opacity: 0.9;">${errorMsg}</div>
        </div>
      `;
      color = '#dc2626';
      borderColor = '#dc2626';
      break;
    case 'success':
      const score = data.score;
      // Handle both decimal (0.52) and percentage (52) formats
      const percentage = score > 1 ? Math.round(score) : Math.round(score * 100);
      // Use normalized score for color calculation (always 0-1 range)
      const normalizedScore = score > 1 ? score / 100 : score;
      
      if (normalizedScore <= 0.3) color = '#dc2626';
      else if (normalizedScore >= 0.8) color = '#16a34a';
      else {
        const r1 = 220, g1 = 38, b1 = 38;
        const r2 = 22, g2 = 163, b2 = 74;
        const ratio = (normalizedScore - 0.3) / 0.5;
        const r = Math.round(r1 + (r2 - r1) * ratio);
        const g = Math.round(g1 + (g2 - g1) * ratio);
        const b = Math.round(b1 + (b2 - b1) * ratio);
        color = `rgb(${r}, ${g}, ${b})`;
      }
      borderColor = color;
      html = `
        <div style="font-size: 16px; margin-bottom: 2px;">${percentage}%</div>
        <div style="font-size: 10px; opacity: 0.7;">${data.category || 'Video'}</div>
      `;
      break;
  }

  scoreDisplay.innerHTML = html;
  scoreDisplay.style.color = color;
  scoreDisplay.style.borderColor = borderColor;
  scoreDisplay.style.opacity = '1';
  scoreDisplay.style.transform = 'translateY(0)';

  // Restore theme-aware styling
  chrome.storage.local.get('selectedTheme', (prefs) => {
    const theme = prefs.selectedTheme || 'crimson-vanilla';
    const themeColors = {
      'cocoa-lemon': { bg: '#774123', text: '#f3e924' },
      'crimson-vanilla': { bg: '#c1121f', text: '#fdf0d5' },
      'golden-ocean': { bg: '#1d352f', text: '#efc142' },
      'dusty-apricot': { bg: '#418994', text: '#fadfca' },
      'spiced-forest': { bg: '#263226', text: '#f68238' },
      'darkreader': { bg: '#181e22', text: '#ddd' }
    };

    if (themeColors[theme] && theme !== 'crimson-vanilla') {
      scoreDisplay.style.background = themeColors[theme].bg;
      // Let the state (success/error) control the text color for better contrast
    } else {
      // Reset to default for the base theme
      scoreDisplay.style.background = 'rgba(0, 0, 0, 0.4)';
    }
  });
}

// Hide the score display
function hideScoreDisplay() {
  if (scoreDisplay) {
    scoreDisplay.style.opacity = '0';
    scoreDisplay.style.transform = 'translateY(-10px)';
  }
}

// apply a green→red gradient across the page and key YouTube containers
function applyColor(score) {
  let primary = 'transparent';
  
  if (score !== null && score !== undefined) {
    // Handle both decimal (0.52) and percentage (52) formats
    const normalizedScore = score > 1 ? score / 100 : score;
    
    if (normalizedScore <= 0.3) primary = '#dc2626';
    else if (normalizedScore >= 0.8) primary = '#16a34a';
    else {
      const r1 = 220, g1 = 38, b1 = 38; // Red
      const r2 = 22, g2 = 163, b2 = 74; // Green
      const ratio = (normalizedScore - 0.3) / 0.5;
      const r = Math.round(r1 + (r2 - r1) * ratio);
      const g = Math.round(g1 + (g2 - g1) * ratio);
      const b = Math.round(b1 + (b2 - b1) * ratio);
      primary = `rgb(${r}, ${g}, ${b})`;
    }
  }

  const els = [
    document.documentElement, document.body,
    document.getElementById('masthead'),
    document.querySelector('ytd-app'),
    document.querySelector('ytd-page-manager'),
    document.querySelector('#content'),
    document.querySelector('#container'),
    document.querySelector('ytd-feed-filter-chip-bar-renderer')
  ];
  els.forEach(el => {
    if (el) {
      el.style.setProperty('background', primary, 'important');
      el.style.setProperty('background-color', primary, 'important');
    }
  });
}

// NEW: Revert all color changes to restore the page to its original state
function removeColor() {
  const els = [
    document.documentElement, document.body,
    document.getElementById('masthead'),
    document.querySelector('ytd-app'),
    document.querySelector('ytd-page-manager'),
    document.querySelector('#content'),
    document.querySelector('#container'),
    document.querySelector('ytd-feed-filter-chip-bar-renderer')
  ];
  els.forEach(el => {
    if (el) {
      el.style.removeProperty('background');
      el.style.removeProperty('background-color');
    }
  });
}

// Show error overlay (now flashes red and shows a toast message at the bottom)
function showErrorOverlay(msg) {
  // This function can remain as is for the flash effect, but the score display
  // will be handled by updateScoreDisplay('error', ...).
  const now = Date.now();
  if (now - lastFlashTime > 2000) {
    lastFlashTime = now;
    let flash = document.createElement('div');
    flash.style.position = 'fixed';
    flash.style.top = 0;
    flash.style.left = 0;
    flash.style.width = '100vw';
    flash.style.height = '100vh';
    flash.style.zIndex = 2147483647;
    flash.style.background = 'rgba(200,0,0,0.97)';
    flash.style.pointerEvents = 'none';
    flash.style.transition = 'opacity 0.7s';
    document.documentElement.appendChild(flash);
    setTimeout(() => {
      flash.style.opacity = '0';
      setTimeout(() => flash.remove(), 700);
    }, 1000);
  }
}

// ask background.js to score
function fetchScore(url, goal) {
  return new Promise((res, rej) => {
    const message = { type:'FETCH_SCORE', url, goal };

    chrome.runtime.sendMessage(message, r => {
      if (chrome.runtime.lastError) return rej(new Error(chrome.runtime.lastError.message));
      if (r.error)                 return rej(new Error(r.error));
      res(r); // Return full response object
    });
  });
}

// Listen for all messages from other parts of the extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'START_SESSION':
      sessionActive = true;
      userGoal = message.goal;
      hideScoreDisplay(); // Hide display when session starts
      console.log('[content.js] session STARTED:', userGoal);
      sendResponse({ success: true });
      break;
      
    case 'STOP_SESSION':
    case 'SESSION_STOPPED': // Handling both just in case
      sessionActive = false;
      userGoal = '';
      hideScoreDisplay(); // Hide display when session stops
      removeOverlay();    // Explicitly remove the error toast
      console.log('[content.js] session STOPPED, overlay removed');
      sendResponse({ success: true });
      break;

    case 'THEME_CHANGED':
      // Theme functionality removed in simplified version
      break;


    case 'RELOAD_WITH_TIMESTAMP':
      reloadWithTimestamp();
      break;

    case 'THEME_CHANGED':
      // Update the score display with new theme colors
      if (scoreDisplay && currentScore !== null) {
        let category = 'Simple Mode'; // Simplified category for the simplified version
        updateScoreDisplay('success', { score: currentScore, category: category });
      }
      break;

    case 'SCORE_MODE_CHANGED':
      // Scoring mode UI is kept for display but backend always uses simple mode
      // Just update the display if needed
      break;

    case 'SESSION_ENDED_AUTO':
      // Auto-refresh when session ends
      reloadWithTimestamp();
      break;
  }
});

// hydrate state on load
chrome.storage.local.get(
  ['sessionActive','goal','lastVideoId','currentScore','selectedTheme'],
  prefs => {
    sessionActive = !!prefs.sessionActive;
    userGoal      = prefs.goal || '';
    lastVideoId   = prefs.lastVideoId || null;
    currentScore  = prefs.currentScore || null;
    // Theme initialization
    const theme = prefs.selectedTheme || 'crimson-vanilla';
    document.documentElement.setAttribute('data-theme', theme);
    console.log('[content.js] init', { sessionActive, userGoal, lastVideoId, currentScore });

    const m = location.href.match(/[?&]v=([^&]+)/);
    if (sessionActive && m && m[1] === lastVideoId && currentScore != null) {
      applyColor(currentScore);
      chrome.runtime.sendMessage({ type: 'NEW_SCORE', score: currentScore });
    }
  }
);

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
  const toast = document.getElementById('tubefocus-toast');
  if (toast) toast.remove();
}


// main loop
async function tryScore() {
  if (!sessionActive) {
    removeColor(); // Use the new function to restore original colors
    hideScoreDisplay();
    return;
  }

  if (!location.href.includes('youtube.com/watch')) return;

  const m = location.href.match(/[?&]v=([^&]+)/);
  if (!m) return;

  const vid = m[1];
  if (vid === lastVideoId) {
    if (currentScore != null) applyColor(currentScore);
    return;
  }

  lastVideoId = vid;
  currentScore = null;
  
  // Ensure score display exists and show loading state
  if (!scoreDisplay) {
    scoreDisplay = createScoreDisplay();
  }
  updateScoreDisplay('loading');

  chrome.storage.local.get(['goal'], prefs => {
    const goal = prefs.goal || userGoal;

    // Always use simple scoring with title and description
    fetchScore(location.href, goal).then(response => {
      currentScore = response.score;
      applyColor(currentScore);
      
      // Extract category information from various possible response fields
      let category = 'Content'; // Better default fallback than "Video"
      
      if (response.category_name && response.category_name !== 'Unknown' && response.category_name !== '') {
        category = response.category_name;
      } else if (response.category && response.category !== 'Unknown' && response.category !== '') {
        category = response.category;
      } else if (response.video_category && response.video_category !== 'Unknown' && response.video_category !== '') {
        category = response.video_category;
      } else if (response.metadata && response.metadata.category && response.metadata.category !== 'Unknown' && response.metadata.category !== '') {
        category = response.metadata.category;
      } else {
        // If this is simple scoring (no category_name field), show mode-specific label
        if (response.mode) {
          switch (response.mode) {
            case 'title_only': category = 'Title Analysis'; break;
            case 'title_and_description': category = 'Title + Desc'; break;
            case 'title_and_clean_desc': category = 'Smart Analysis'; break;
            default: category = 'Simple Mode'; break;
          }
        } else {
          // Advanced mode but no category available
          category = 'YouTube Video';
        }
      }
      
      // Debug logging can be uncommented for troubleshooting
      // console.log('[content.js] Category resolved:', category, 'from response:', response);
      
      updateScoreDisplay('success', { score: currentScore, category: category });

      chrome.runtime.sendMessage({ type: 'NEW_SCORE', score: currentScore });

      chrome.storage.local.get('watchedScores', d => {
        const arr = d.watchedScores || [];
        arr.push(currentScore);
        chrome.storage.local.set({ watchedScores: arr, lastVideoId, currentScore });
      });

    }).catch(e => {
      const msg = e.message || 'Scoring failed';
      console.error('[content.js] scoring error:', e);

      if (msg.includes('Extension context invalidated')) {
        console.log('[TubeFocus] Context invalidated. Halting script on this page.');
        clearInterval(timerId);
        return;
      }

      // Map technical errors to user-friendly messages
      let userMsg = msg;
      if (msg.includes('Backend server not running')) {
        userMsg = "Can't fetch score";
      } else if (msg.includes('Cannot connect to backend')) {
        userMsg = "Connection failed";
      } else if (msg.includes('Backend server not available')) {
        userMsg = "Server unavailable";
      } else if (msg.includes('API endpoint not found')) {
        userMsg = "Service not found";
      } else if (msg.includes('Failed to fetch')) {
        userMsg = "Network error";
      }

      removeColor(); // Use the new function on error as well
      updateScoreDisplay('error', { message: userMsg });
      showErrorOverlay(userMsg);
      chrome.runtime.sendMessage({ type: 'ERROR', error: userMsg }, () => {
        if (chrome.runtime.lastError) { /* do nothing */ }
      });
    });
  });
}

const timerId = setInterval(tryScore, 1000);
window.addEventListener('unload', () => clearInterval(timerId));
