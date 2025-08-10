// content.js
console.log('[content.js] injected - LOCAL DEVELOPMENT MODE');
console.log('[content.js] API Base URL:', 'http://localhost:8080');

let sessionActive = false;
let userGoal      = '';
let lastVideoId   = null;
let currentScore  = null;
let lastFlashTime = 0;
let scoreDisplay  = null;
let lastScores    = null; // Store individual scores for feedback

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
    cursor: pointer;
    transition: all 0.3s ease;
    backdrop-filter: blur(5px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    min-width: 60px;
    text-align: center;
    opacity: 0;
    transform: translateY(10px);
  `;
  
  // Create the feedback overlay
  const feedbackOverlay = document.createElement('div');
  feedbackOverlay.id = 'tubefocus-feedback-overlay';
  feedbackOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.5);
    z-index: 9999;
    display: none;
    align-items: center;
    justify-content: center;
  `;
  
  const feedbackModal = document.createElement('div');
  feedbackModal.style.cssText = `
    background: white;
    color: #333;
    padding: 24px;
    border-radius: 12px;
    text-align: center;
    max-width: 400px;
    width: 90%;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  `;
  
  feedbackModal.innerHTML = `
    <h3 style="margin: 0 0 16px 0; color: #333;">Rate this video's relevance</h3>
    <p style="margin: 0 0 20px 0; color: #666;">How relevant is this video to your goal? (0-100)</p>
    <div style="margin-bottom: 20px;">
      <input type="range" id="feedback-slider" min="0" max="100" value="50" style="width: 100%; height: 6px; border-radius: 3px; background: #ddd; outline: none;">
      <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 12px; color: #666;">
        <span>0</span>
        <span id="slider-value">50</span>
        <span>100</span>
      </div>
    </div>
    <div style="display: flex; gap: 8px; justify-content: center;">
      <button id="submit-feedback" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Submit</button>
      <button id="cancel-feedback" style="padding: 8px 16px; border: 1px solid #ddd; background: #f5f5f5; border-radius: 4px; cursor: pointer;">Cancel</button>
    </div>
  `;
  
  feedbackOverlay.appendChild(feedbackModal);
  document.body.appendChild(feedbackOverlay);
  
  // Add event listeners
  scoreDisplay.addEventListener('click', () => {
    feedbackOverlay.style.display = 'flex';
  });
  
  feedbackOverlay.addEventListener('click', (e) => {
    if (e.target === feedbackOverlay || e.target.id === 'cancel-feedback') {
      feedbackOverlay.style.display = 'none';
    }
  });
  
  // Add feedback slider listeners
  feedbackModal.addEventListener('input', (e) => {
    if (e.target.id === 'feedback-slider') {
      const value = e.target.value;
      document.getElementById('slider-value').textContent = value;
    }
  });
  
  feedbackModal.addEventListener('click', (e) => {
    if (e.target.id === 'submit-feedback') {
      const score = parseInt(document.getElementById('feedback-slider').value) / 100; // Convert 0-100 to 0-1
      submitFeedback(score);
      feedbackOverlay.style.display = 'none';
    }
  });
  
  document.body.appendChild(scoreDisplay);
  return scoreDisplay;
}

// Submit feedback to the API
async function submitFeedback(userScore) {
  if (!lastVideoId || !userGoal || !lastScores) return;
  
  // Immediately update the score display with the user's feedback score
  currentScore = userScore;
  applyColor(userScore);
  
  // Get the current category from the score display or use default
  const categoryElement = scoreDisplay ? scoreDisplay.querySelector('div:last-child') : null;
  const category = categoryElement ? categoryElement.textContent : 'Video';
  
  // Update the score display with the new user-provided score
  updateScoreDisplay(userScore, category);
  
  try {
    const response = await fetch(`${CONFIG.API_BASE_URL}/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': CONFIG.API_KEY
      },
      body: JSON.stringify({
        desc_score: lastScores.description_score || 0.0,
        title_score: lastScores.title_score || 0.0,
        tags_score: lastScores.tags_score || 0.0,
        category_score: lastScores.category_score || 0.0,
        user_score: userScore // Already in 0-1 format from slider
      })
    });
    
    if (response.ok) {
      console.log('Feedback submitted successfully');
      showFeedbackSuccess();
    } else {
      console.error('Feedback submission failed:', response.status, response.statusText);
    }
  } catch (error) {
    // Handle network errors gracefully
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      console.log('Feedback server not available - this is normal if the ML server is not running');
      showFeedbackSuccess(); // Still show success to user
    } else {
      console.error('Error submitting feedback:', error);
    }
  }
}

// Show feedback success message
function showFeedbackSuccess() {
  let toast = document.getElementById('tubefocus-feedback-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'tubefocus-feedback-toast';
    toast.style.position = 'fixed';
    toast.style.left = '50%';
    toast.style.bottom = '32px';
    toast.style.transform = 'translateX(-50%)';
    toast.style.background = '#16a34a';
    toast.style.color = '#fff';
    toast.style.padding = '14px 32px';
    toast.style.borderRadius = '8px';
    toast.style.fontSize = '1.1em';
    toast.style.fontWeight = 'bold';
    toast.style.zIndex = 1000000;
    toast.style.boxShadow = '0 2px 12px #0008';
    toast.style.textAlign = 'center';
    document.body.appendChild(toast);
  }
  toast.textContent = 'Feedback collected!';
  toast.style.display = 'block';
  setTimeout(() => {
    toast.style.display = 'none';
  }, 2000);
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
      html = `<div style="font-size: 12px; opacity: 0.9;">${data.message || 'Error'}</div>`;
      color = '#dc2626';
      borderColor = '#dc2626';
      break;
    case 'success':
      const score = data.score;
      const percentage = Math.round(score * 100);
      if (score <= 0.3) color = '#dc2626';
      else if (score >= 0.8) color = '#16a34a';
      else {
        const r1 = 220, g1 = 38, b1 = 38;
        const r2 = 22, g2 = 163, b2 = 74;
        const ratio = (score - 0.3) / 0.5;
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
    if (score <= 0.3) primary = '#dc2626';
    else if (score >= 0.8) primary = '#16a34a';
    else {
      const r1 = 220, g1 = 38, b1 = 38; // Red
      const r2 = 22, g2 = 163, b2 = 74; // Green
      const ratio = (score - 0.3) / 0.5;
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
function fetchScore(url, goal, scoringData = null) {
  return new Promise((res, rej) => {
    const message = { type:'FETCH_SCORE', url, goal };
    
    // Handle new scoring mode structure
    if (scoringData) {
      if (scoringData.type === 'simple') {
        message.scoringType = 'simple';
        message.simpleMode = scoringData.simpleMode || 'title_and_description';
      } else if (scoringData.type === 'advanced') {
        message.scoringType = 'advanced';
        message.advancedMode = scoringData.advancedMode || ['title', 'description'];
      } else {
        // Legacy support for old scoreMode format
        message.scoreMode = scoringData;
      }
    }
    
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
      // Update the score display with new theme colors
      if (scoreDisplay && currentScore !== null) {
        updateScoreDisplay(currentScore, lastScores?.category_name || 'Video');
      }
      break;

    case 'SCORE_MODE_CHANGED':
      reScoreWithNewMode(message.mode);
      break;

    case 'RELOAD_WITH_TIMESTAMP':
      reloadWithTimestamp();
      break;

    case 'SESSION_ENDED_AUTO':
      // Auto-refresh when session ends
      reloadWithTimestamp();
      break;
  }
});

// hydrate state on load
chrome.storage.local.get(
  ['sessionActive','goal','lastVideoId','currentScore','selectedTheme','scoringType','simpleMode','advancedMode'],
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

async function reScoreWithNewMode(newMode) {
  if (!sessionActive) return;
  const m = location.href.match(/[?&]v=([^&]+)/);
  if (!m) return;
  const vid = m[1];
  try {
    chrome.storage.local.get('goal', async prefs => {
      const goal = prefs.goal || userGoal;
      
      // Handle new scoring mode structure
      let scoringData = null;
      if (newMode.type === 'simple') {
        scoringData = {
          type: 'simple',
          simpleMode: newMode.simpleMode || 'title_and_description'
        };
      } else if (newMode.type === 'advanced') {
        scoringData = {
          type: 'advanced',
          advancedMode: newMode.advancedMode || ['title', 'description']
        };
      } else {
        // Legacy support for old format
        scoringData = newMode;
      }
      
      // Use the new mode for this fetch
      chrome.runtime.sendMessage({ 
        type:'FETCH_SCORE', 
        url: location.href, 
        goal, 
        ...scoringData 
      }, r => {
        if (chrome.runtime.lastError) {
          console.log('[content.js] Could not update score for new mode - server not available');
          return;
        }
        if (r.error) {
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
    const msg = e.message||'';
    // Always show error overlay for any backend error
    showErrorOverlay('Scoring error: ' + msg);
    chrome.runtime.sendMessage({ type: 'ERROR', error: 'Scoring error: ' + msg });
    console.error('[content.js] scoring error:', e);
  }
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
  updateScoreDisplay('loading');

  chrome.storage.local.get(['scoringType', 'simpleMode', 'advancedMode', 'goal'], prefs => {
    const goal = prefs.goal || userGoal;
    
    // Handle new scoring mode structure
    let scoringData = null;
    if (prefs.scoringType === 'simple') {
      scoringData = {
        type: 'simple',
        simpleMode: prefs.simpleMode || 'title_and_description'
      };
    } else if (prefs.scoringType === 'advanced') {
      scoringData = {
        type: 'advanced',
        advancedMode: prefs.advancedMode || ['title', 'description']
      };
    } else {
      // Legacy support for old scoreMode format
      scoringData = prefs.scoreMode || ['title', 'description'];
    }

    fetchScore(location.href, goal, scoringData).then(response => {
      currentScore = response.score;
      lastScores = response;
      applyColor(currentScore);
      updateScoreDisplay('success', { score: currentScore, category: response.category_name || 'Video' });

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

      removeColor(); // Use the new function on error as well
      updateScoreDisplay('error', { message: msg });
      showErrorOverlay(msg);
      chrome.runtime.sendMessage({ type: 'ERROR', error: msg }, () => {
        if (chrome.runtime.lastError) { /* do nothing */ }
      });
    });
  });
}

const timerId = setInterval(tryScore, 1000);
window.addEventListener('unload', () => clearInterval(timerId));
