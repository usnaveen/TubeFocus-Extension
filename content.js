// content.js
console.log('[content.js] injected - CLOUD RUN MODE');
console.log('[content.js] API Base URL:', 'https://yt-scorer-api-933573987016.us-central1.run.app');

let sessionActive = false;
let userGoal = '';
let lastVideoId = null;
let currentScore = null;
let currentIntentLabel = 'Video';
let lastFlashTime = 0;
let scoreDisplay = null;

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
      currentIntentLabel = (data.category || currentIntentLabel || 'Video').toString();
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
    const message = { type: 'FETCH_SCORE', url, goal };

    chrome.runtime.sendMessage(message, r => {
      if (chrome.runtime.lastError) return rej(new Error(chrome.runtime.lastError.message));
      if (r.error) return rej(new Error(r.error));
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
      if (typeof message.coachEnabled === 'boolean') {
        coachEnabled = message.coachEnabled;
      }
      recommendationDecisionCache.clear();
      queueVisibleRecommendations();
      hideScoreDisplay(); // Hide display when session starts
      console.log('[content.js] session STARTED:', userGoal);
      sendResponse({ success: true });
      break;

    case 'STOP_SESSION':
    case 'SESSION_STOPPED': // Handling both just in case
      sessionActive = false;
      userGoal = '';
      hideScoreDisplay(); // Hide display when session stops
      clearGatekeeperDecorations();
      removeOverlay();    // Explicitly remove the error toast
      console.log('[content.js] session STOPPED, overlay removed');
      sendResponse({ success: true });
      break;

    case 'RELOAD_WITH_TIMESTAMP':
      reloadWithTimestamp();
      break;

    case 'THEME_CHANGED':
      // Update the score display with new theme colors
      if (scoreDisplay && currentScore !== null) {
        let category = 'Simple Mode'; // Simplified category for the simplified version
        updateScoreDisplay('success', { score: currentScore, category: category });
        updateFilterStatusBadge();
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
  ['sessionActive', 'goal', 'lastVideoId', 'currentScore', 'selectedTheme', 'coachEnabled'],
  prefs => {
    sessionActive = !!prefs.sessionActive;
    userGoal = prefs.goal || '';
    lastVideoId = prefs.lastVideoId || null;
    currentScore = prefs.currentScore || null;
    coachEnabled = prefs.coachEnabled !== false;
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
      } else if (response.intent && response.intent !== '') {
        category = response.intent;
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
      updateFilterStatusBadge();

      chrome.runtime.sendMessage({ type: 'NEW_SCORE', score: currentScore });

      chrome.storage.local.get('watchedScores', d => {
        const arr = d.watchedScores || [];
        arr.push(currentScore);
        chrome.storage.local.set({ watchedScores: arr, lastVideoId, currentScore });

        // Track for Coach Agent
        trackVideoForCoach(vid, title || 'Unknown Video', currentScore);
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
      updateFilterStatusBadge();
      showErrorOverlay(userMsg);
      chrome.runtime.sendMessage({ type: 'ERROR', error: userMsg }, () => {
        if (chrome.runtime.lastError) { /* do nothing */ }
      });
    });
  });
}

const timerId = setInterval(tryScore, 1000);
window.addEventListener('unload', () => clearInterval(timerId));

// ===== TRANSCRIPT SCRAPER: Extract from YouTube's Native UI =====

/**
 * Scrapes transcript from YouTube's native transcript panel
 * More reliable than API - works for any video with transcripts enabled
 */
async function scrapeTranscriptFromYouTube() {
  console.log('[Transcript] Attempting to scrape transcript from YouTube UI...');

  try {
    // Step 1: Find and click the "Show transcript" button
    // YouTube's button is in the description area
    const transcriptButtons = [
      ...document.querySelectorAll('button[aria-label*="transcript" i]'),
      ...document.querySelectorAll('yt-button-shape[aria-label*="transcript" i]'),
      ...document.querySelectorAll('[class*="transcript"] button'),
    ];

    let transcriptButton = null;
    for (const btn of transcriptButtons) {
      const text = btn.textContent.toLowerCase();
      const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
      if (text.includes('transcript') || text.includes('show transcript') ||
        ariaLabel.includes('transcript') || ariaLabel.includes('show transcript')) {
        transcriptButton = btn;
        break;
      }
    }

    if (!transcriptButton) {
      console.warn('[Transcript] Show transcript button not found - transcript may not be available');
      return {
        success: false,
        error: 'Transcript button not found. This video may not have transcripts available.',
        transcript: null
      };
    }

    // Click the button to open transcript panel
    transcriptButton.click();
    console.log('[Transcript] Clicked show transcript button');

    // Step 2: Wait for transcript panel to load with retries
    console.log('[Transcript] Waiting for segments to load...');
    let segments = [];
    for (let i = 0; i < 10; i++) { // Try for 5 seconds (10 x 500ms)
      const transcriptPanel = document.querySelector('ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]');
      if (transcriptPanel) {
        segments = transcriptPanel.querySelectorAll('ytd-transcript-segment-renderer');
        if (segments.length > 0) {
          console.log(`[Transcript] Found ${segments.length} segments after ${i * 0.5}s`);
          break;
        }
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (segments.length === 0) {
      console.warn('[Transcript] No transcript segments found in panel after waiting');
      return {
        success: false,
        error: 'Transcript panel is empty or took too long to load. Please make sure the transcript is visible.',
        transcript: null
      };
    }

    // Combine all transcript text
    let fullTranscript = '';
    const segmentData = [];

    segments.forEach(segment => {
      const textEl = segment.querySelector('.segment-text');
      const timestampEl = segment.querySelector('.segment-timestamp');

      if (textEl) {
        const text = textEl.textContent.trim();
        const timestamp = timestampEl ? timestampEl.textContent.trim() : '';

        fullTranscript += text + ' ';
        segmentData.push({
          text: text,
          timestamp: timestamp
        });
      }
    });

    fullTranscript = fullTranscript.trim();

    console.log(`[Transcript] Successfully scraped ${segments.length} segments (${fullTranscript.length} chars)`);

    // Step 4: Close the transcript panel (optional - keep it open if user wants)
    // transcriptButton.click(); // Uncomment to auto-close

    return {
      success: true,
      transcript: fullTranscript,
      segments: segmentData,
      segmentCount: segments.length,
      charCount: fullTranscript.length,
      error: null
    };

  } catch (error) {
    console.error('[Transcript] Error scraping transcript:', error);
    return {
      success: false,
      error: `Failed to scrape transcript: ${error.message}`,
      transcript: null
    };
  }
}

/**
 * Listen for transcript scraping requests from popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SCRAPE_TRANSCRIPT') {
    // Run async scraping
    scrapeTranscriptFromYouTube().then(result => {
      sendResponse(result);
    });
    return true; // Keep channel open for async response
  }
});

// ===== COACH AGENT: Proactive Behavior Intervention =====

let coachCheckInterval = null;
let sessionVideosWatched = [];
let coachSessionId = null;
let coachEnabled = true;

function startCoachMonitoring() {
  if (!coachEnabled) return;
  if (coachCheckInterval) return; // Already running

  console.log('[Coach] Starting proactive monitoring');
  if (!coachSessionId) {
    coachSessionId = `coach_${Date.now()}`;
  }

  // Check every 2 minutes for behavioral patterns
  coachCheckInterval = setInterval(() => {
    if (sessionActive && sessionVideosWatched.length >= 3) {
      requestCoachAnalysis();
    }
  }, 120000); // 2 minutes
}

function stopCoachMonitoring() {
  if (coachCheckInterval) {
    clearInterval(coachCheckInterval);
    coachCheckInterval = null;
    sessionVideosWatched = [];
    coachSessionId = null;
    console.log('[Coach] Stopped monitoring');
  }
}

function trackVideoForCoach(videoId, title, score) {
  const videoData = {
    video_id: videoId,
    title: title,
    score: score,
    timestamp: new Date().toISOString()
  };

  sessionVideosWatched.push(videoData);

  // Keep only last 15 videos
  if (sessionVideosWatched.length > 15) {
    sessionVideosWatched.shift();
  }
}

async function requestCoachAnalysis() {
  if (!coachEnabled || !sessionActive || sessionVideosWatched.length === 0) return;

  console.log('[Coach] Requesting analysis with', sessionVideosWatched.length, 'videos');

  chrome.storage.local.get(['goal'], (prefs) => {
    const goal = prefs.goal || userGoal;
    if (!goal) return;
    if (!coachSessionId) {
      coachSessionId = `coach_${Date.now()}`;
    }

    chrome.runtime.sendMessage({
      type: 'COACH_ANALYZE',
      sessionId: coachSessionId,
      goal: goal,
      sessionData: sessionVideosWatched
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[Coach] Error:', chrome.runtime.lastError);
        return;
      }

      if (response && response.analysis && response.analysis.intervention_needed) {
        showCoachNotification(response.analysis);
      }
    });
  });
}

function showCoachNotification(analysis) {
  if (!analysis || !coachEnabled) return;

  // Remove existing notification if present
  const existing = document.getElementById('tubefocus-coach-notification');
  if (existing) existing.remove();

  const notification = document.createElement('div');
  notification.id = 'tubefocus-coach-notification';
  notification.className = 'tubefocus-coach-notification';
  notification.style.cssText = `
    position: fixed;
    bottom: 80px;
    right: 20px;
    max-width: 350px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 16px;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    z-index: 10001;
    font-family: 'Roboto', -apple-system, BlinkMacSystemFont, sans-serif;
    animation: slideIn 0.4s ease-out;
  `;

  // Icon based on pattern
  const patternIcons = {
    'doom_scrolling': '⚠️',
    'rabbit_hole': '🌀',
    'planning_paralysis': '🤔',
    'binge_watching': '📺',
    'on_track': '✅'
  };

  const pattern = analysis.pattern_detected || analysis.type || 'coach_message';
  const icon = patternIcons[pattern] || '💡';
  const message = analysis.message || 'Keep going with your learning goal.';

  notification.innerHTML = `
    <style>
      @keyframes slideIn {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      .tubefocus-coach-notification button {
        margin: 8px 8px 0 0;
        padding: 8px 16px;
        border: none;
        border-radius: 6px;
        font-weight: bold;
        cursor: pointer;
        font-size: 13px;
        transition: all 0.2s;
      }
      .tubefocus-coach-notification button:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0,0,0,0.2);
      }
      .coach-action {
        background: white;
        color: #667eea;
      }
      .coach-dismiss {
        background: rgba(255,255,255,0.2);
        color: white;
      }
    </style>
    <div style="display: flex; align-items: center; margin-bottom: 12px;">
      <span style="font-size: 24px; margin-right: 12px;">${icon}</span>
      <div>
        <div style="font-weight: bold; font-size: 15px;">Coach TubeFocus</div>
        <div style="font-size: 11px; opacity: 0.9;">${pattern.toString().replace(/_/g, ' ').toUpperCase()}</div>
      </div>
    </div>
    <div class="coach-message" style="margin-bottom: 12px; line-height: 1.4; font-size: 14px;">
      ${message}
    </div>
    <div>
      <button class="coach-action">${getActionButtonText(analysis.suggested_action)}</button>
      <button class="coach-dismiss">Later</button>
    </div>
  `;

  document.body.appendChild(notification);

  // Handle action button
  notification.querySelector('.coach-action').addEventListener('click', () => {
    handleCoachAction(analysis.suggested_action);
    notification.remove();
  });

  // Handle dismiss button
  notification.querySelector('.coach-dismiss').addEventListener('click', () => {
    notification.remove();
  });

  // Auto-dismiss after 15 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.animation = 'slideIn 0.4s ease-out reverse';
      setTimeout(() => notification.remove(), 400);
    }
  }, 15000);
}

function removeCoachNotification() {
  const existing = document.getElementById('tubefocus-coach-notification');
  if (existing) existing.remove();
}

function getActionButtonText(action) {
  const actionTexts = {
    'take_break': 'Take a Break',
    'refocus': 'Refocus Now',
    'bookmark_for_later': 'Bookmark These',
    'continue': 'Keep Going',
    'start_practicing': 'Start Practicing'
  };
  return actionTexts[action] || 'OK';
}

function handleCoachAction(action) {
  console.log('[Coach] User action:', action);

  switch (action) {
    case 'refocus':
      // Clear current session and show popup
      chrome.runtime.sendMessage({ type: 'SHOW_POPUP' });
      break;
    case 'take_break':
      // Pause session temporarily
      chrome.runtime.sendMessage({ type: 'PAUSE_SESSION' });
      break;
    case 'start_practicing':
      // Suggestion to close YouTube
      if (confirm('Ready to practice what you learned? Close YouTube and start building!')) {
        window.close();
      }
      break;
    default:
      console.log('[Coach] Action acknowledged');
  }
}

// Listen for session start/stop to manage coach monitoring
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;

  if (changes.coachEnabled) {
    coachEnabled = changes.coachEnabled.newValue !== false;
    if (!coachEnabled) {
      stopCoachMonitoring();
      removeCoachNotification();
    } else if (sessionActive) {
      startCoachMonitoring();
    }
  }

  if (changes.sessionActive) {
    sessionActive = !!changes.sessionActive.newValue;
    if (sessionActive && coachEnabled) {
      startCoachMonitoring();
    } else {
      stopCoachMonitoring();
      removeCoachNotification();
    }
  }
});

// Initialize coach monitoring if session is active
chrome.storage.local.get(['sessionActive', 'coachEnabled'], (prefs) => {
  coachEnabled = prefs.coachEnabled !== false;
  if (prefs.sessionActive && coachEnabled) {
    startCoachMonitoring();
  }
});

// ===== VIDEO HIGHLIGHT FEATURE =====

let highlightSelectionState = null;

function ensureHighlightSelectionStyles() {
  if (document.getElementById('tubefocus-highlight-selection-styles')) return;
  const style = document.createElement('style');
  style.id = 'tubefocus-highlight-selection-styles';
  style.textContent = `
    .tubefocus-highlight-mode {
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.95), 0 0 16px rgba(59, 130, 246, 0.75) !important;
      border-radius: 999px !important;
    }
    .tubefocus-highlight-range-overlay {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 8;
    }
    .tubefocus-highlight-range-fill {
      position: absolute;
      top: 0;
      height: 100%;
      background: linear-gradient(90deg, rgba(30, 144, 255, 0.45), rgba(56, 189, 248, 0.55));
      box-shadow: 0 0 12px rgba(59, 130, 246, 0.8);
      border-radius: 999px;
    }
    .tubefocus-highlight-marker {
      position: absolute;
      top: -3px;
      width: 4px;
      height: calc(100% + 6px);
      background: #60a5fa;
      box-shadow: 0 0 12px rgba(96, 165, 250, 0.9);
      border-radius: 2px;
    }
  `;
  document.head.appendChild(style);
}

function getVideoProgressBarElement() {
  return (
    document.querySelector('.ytp-progress-bar') ||
    document.querySelector('.ytp-progress-list') ||
    document.querySelector('.ytp-scrubber-container')
  );
}

function parseTimestampToSeconds(label) {
  const parts = String(label || '')
    .split(':')
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isFinite(value));

  if (!parts.length) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0];
}

function formatSecondsToLabel(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function cleanupHighlightSelection() {
  if (!highlightSelectionState) return;

  const state = highlightSelectionState;
  if (state.cleanupFns) {
    state.cleanupFns.forEach((cleanup) => {
      try { cleanup(); } catch (_e) { /* noop */ }
    });
  }

  if (state.progressBar) {
    state.progressBar.classList.remove('tubefocus-highlight-mode');
    const overlay = state.progressBar.querySelector('.tubefocus-highlight-range-overlay');
    if (overlay) overlay.remove();
    if (state.resetPosition) {
      state.progressBar.style.position = '';
    }
  }

  highlightSelectionState = null;
}

function updateHighlightSelectionOverlay() {
  const state = highlightSelectionState;
  if (!state || !state.progressBar || !Number.isFinite(state.videoDuration) || state.videoDuration <= 0) return;

  let overlay = state.progressBar.querySelector('.tubefocus-highlight-range-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'tubefocus-highlight-range-overlay';
    state.progressBar.appendChild(overlay);
  }

  overlay.innerHTML = '';

  if (state.startTime == null) return;

  const startPct = Math.max(0, Math.min(100, (state.startTime / state.videoDuration) * 100));
  const startMarker = document.createElement('div');
  startMarker.className = 'tubefocus-highlight-marker';
  startMarker.style.left = `calc(${startPct}% - 2px)`;
  overlay.appendChild(startMarker);

  if (state.endTime == null) return;

  const endPct = Math.max(0, Math.min(100, (state.endTime / state.videoDuration) * 100));
  const left = Math.min(startPct, endPct);
  const width = Math.max(0.6, Math.abs(endPct - startPct));

  const fill = document.createElement('div');
  fill.className = 'tubefocus-highlight-range-fill';
  fill.style.left = `${left}%`;
  fill.style.width = `${width}%`;
  overlay.appendChild(fill);

  const endMarker = document.createElement('div');
  endMarker.className = 'tubefocus-highlight-marker';
  endMarker.style.left = `calc(${endPct}% - 2px)`;
  overlay.appendChild(endMarker);
}

function transcriptExcerptForRange(segments, startSeconds, endSeconds) {
  if (!Array.isArray(segments) || segments.length === 0) return null;

  const clipped = segments
    .map((segment) => ({
      at: parseTimestampToSeconds(segment.timestamp),
      text: (segment.text || '').trim()
    }))
    .filter((segment) => Number.isFinite(segment.at) && segment.text);

  if (!clipped.length) return null;

  const excerpt = clipped
    .filter((segment) => segment.at >= startSeconds && segment.at <= (endSeconds + 1))
    .map((segment) => segment.text)
    .slice(0, 24);

  if (!excerpt.length) return null;
  return excerpt.join(' ');
}

async function persistHighlightRange(state, note) {
  const transcriptResult = await scrapeTranscriptFromYouTube();
  const transcriptExcerpt = transcriptResult?.success
    ? transcriptExcerptForRange(transcriptResult.segments || [], state.startTime, state.endTime)
    : null;

  const rangeLabel = `${formatSecondsToLabel(state.startTime)} - ${formatSecondsToLabel(state.endTime)}`;

  return new Promise((resolve) => {
    chrome.runtime.sendMessage({
      type: 'SAVE_HIGHLIGHT',
      highlight: {
        videoId: state.videoId,
        videoTitle: state.videoTitle,
        timestamp: state.startTime,
        timestampFormatted: formatSecondsToLabel(state.startTime),
        startTimestamp: state.startTime,
        endTimestamp: state.endTime,
        startTimestampFormatted: formatSecondsToLabel(state.startTime),
        endTimestampFormatted: formatSecondsToLabel(state.endTime),
        rangeLabel,
        note: note || '',
        transcript: transcriptExcerpt,
        videoUrl: `https://www.youtube.com/watch?v=${state.videoId}&t=${state.startTime}`,
        createdAt: new Date().toISOString()
      }
    }, (response) => resolve(response));
  });
}

async function createVideoHighlight() {
  try {
    if (highlightSelectionState?.active) {
      cleanupHighlightSelection();
      showToast('Highlight range selection cancelled.');
      return { success: false, error: 'selection_cancelled' };
    }

    const video = document.querySelector('video');
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) {
      return { success: false, error: 'No playable video found.' };
    }

    const videoId = new URL(window.location.href).searchParams.get('v');
    if (!videoId) {
      return { success: false, error: 'Video ID not found.' };
    }

    const progressBar = getVideoProgressBarElement();
    if (!progressBar) {
      return { success: false, error: 'Could not detect YouTube progress bar.' };
    }

    ensureHighlightSelectionStyles();

    const resetPosition = window.getComputedStyle(progressBar).position === 'static';
    if (resetPosition) {
      progressBar.style.position = 'relative';
    }

    highlightSelectionState = {
      active: true,
      videoId,
      videoTitle: document.querySelector('#title h1 yt-formatted-string')?.textContent?.trim() || document.title.replace(' - YouTube', ''),
      progressBar,
      videoDuration: video.duration,
      startTime: null,
      endTime: null,
      cleanupFns: [],
      resetPosition
    };

    progressBar.classList.add('tubefocus-highlight-mode');

    const handleProgressClick = async (event) => {
      const state = highlightSelectionState;
      if (!state || !state.active) return;

      event.preventDefault();
      event.stopPropagation();

      const rect = state.progressBar.getBoundingClientRect();
      if (!rect.width) return;

      const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      const clickedTime = Math.floor(ratio * state.videoDuration);

      if (state.startTime == null) {
        state.startTime = clickedTime;
        state.endTime = null;
        updateHighlightSelectionOverlay();
        showToast(`Start set at ${formatSecondsToLabel(clickedTime)}. Click again to set end.`);
        return;
      }

      state.endTime = clickedTime;
      if (state.endTime < state.startTime) {
        const swap = state.startTime;
        state.startTime = state.endTime;
        state.endTime = swap;
      }

      if ((state.endTime - state.startTime) < 2) {
        state.endTime = null;
        updateHighlightSelectionOverlay();
        showToast('Select at least a 2-second range.', true);
        return;
      }

      updateHighlightSelectionOverlay();
      const rangeLabel = `${formatSecondsToLabel(state.startTime)} - ${formatSecondsToLabel(state.endTime)}`;
      const modalResult = await showHighlightComposer({
        videoTitle: state.videoTitle,
        rangeLabel
      });
      cleanupHighlightSelection();

      if (modalResult.cancelled) {
        return;
      }

      const saveResult = await persistHighlightRange(state, modalResult.note);
      if (saveResult?.success) {
        showHighlightSavedNotification(rangeLabel);
      } else {
        showToast(saveResult?.error || 'Failed to save highlight range.', true);
      }
    };

    const handleEsc = (event) => {
      if (event.key !== 'Escape') return;
      cleanupHighlightSelection();
      showToast('Highlight range selection cancelled.');
    };

    progressBar.addEventListener('click', handleProgressClick, true);
    document.addEventListener('keydown', handleEsc, true);
    highlightSelectionState.cleanupFns.push(() => progressBar.removeEventListener('click', handleProgressClick, true));
    highlightSelectionState.cleanupFns.push(() => document.removeEventListener('keydown', handleEsc, true));

    showToast('Highlight mode: click the progress bar to set start, then end.');
    return { success: true, pending: true };
  } catch (error) {
    console.error('[Highlight] Range selection error:', error);
    cleanupHighlightSelection();
    return { success: false, error: error.message };
  }
}

function showHighlightComposer(data) {
  return new Promise((resolve) => {
    // Remove existing modal
    const existing = document.getElementById('tubefocus-highlight-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'tubefocus-highlight-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100000;
      font-family: 'Roboto', -apple-system, BlinkMacSystemFont, sans-serif;
    `;

    modal.innerHTML = `
      <div style="
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border-radius: 16px;
        padding: 24px;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        border: 1px solid rgba(255,255,255,0.1);
      ">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
          <span style="font-size: 28px;">✨</span>
          <div>
            <h3 style="margin: 0; color: #fff; font-size: 18px;">Save Highlight</h3>
            <p style="margin: 4px 0 0; color: #888; font-size: 13px;">${data.rangeLabel}</p>
          </div>
        </div>
        
        <p style="color: #ccc; font-size: 13px; margin-bottom: 12px; line-height: 1.4;">
          ${(data.videoTitle || '').substring(0, 80)}${(data.videoTitle || '').length > 80 ? '...' : ''}
        </p>
        
        <textarea 
          id="highlight-note" 
          placeholder="Add a note for this highlight range..."
          style="
            width: 100%;
            min-height: 80px;
            padding: 12px;
            border-radius: 8px;
            border: 2px solid rgba(255,255,255,0.1);
            background: rgba(255,255,255,0.05);
            color: #fff;
            font-size: 14px;
            resize: vertical;
            box-sizing: border-box;
          "
        ></textarea>
        
        <div style="display: flex; gap: 10px; margin-top: 16px;">
          <button id="highlight-save" style="
            flex: 1;
            padding: 12px;
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
            color: #fff;
            border: none;
            border-radius: 8px;
            font-weight: bold;
            font-size: 14px;
            cursor: pointer;
          ">Save Range</button>
          <button id="highlight-cancel" style="
            padding: 12px 20px;
            background: rgba(255,255,255,0.1);
            color: #fff;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            cursor: pointer;
          ">Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Focus textarea
    setTimeout(() => document.getElementById('highlight-note').focus(), 100);

    // Handle save
    document.getElementById('highlight-save').addEventListener('click', () => {
      const note = document.getElementById('highlight-note').value.trim();
      modal.remove();
      resolve({ note, cancelled: false });
    });

    // Handle cancel
    document.getElementById('highlight-cancel').addEventListener('click', () => {
      modal.remove();
      resolve({ cancelled: true });
    });

    // Handle escape key
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        modal.remove();
        resolve({ cancelled: true });
      } else if (e.key === 'Enter' && e.ctrlKey) {
        const note = document.getElementById('highlight-note').value.trim();
        modal.remove();
        resolve({ note, cancelled: false });
      }
    });
  });
}

function showHighlightSavedNotification(label) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    bottom: 100px;
    right: 20px;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-family: 'Roboto', sans-serif;
    font-size: 14px;
    z-index: 100001;
    animation: slideIn 0.3s ease-out;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  `;
  notification.innerHTML = `✨ Highlight saved: ${label}`;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideIn 0.3s ease-out reverse';
    setTimeout(() => notification.remove(), 300);
  }, 2000);
}

// ===== WATCH DETECTION =====

let watchDetectionInterval = null;
let totalWatchTimeSeconds = 0;
let lastWatchCheck = null;

function startWatchDetection() {
  if (watchDetectionInterval) return;

  lastWatchCheck = Date.now();

  watchDetectionInterval = setInterval(() => {
    const video = document.querySelector('video');
    if (!video) return;

    const isPlaying = !video.paused && !video.ended && video.readyState > 2;
    const isVisible = document.visibilityState === 'visible';
    const isWatching = isPlaying && isVisible;

    if (isWatching) {
      const elapsed = (Date.now() - lastWatchCheck) / 1000;
      totalWatchTimeSeconds += elapsed;

      // Store total watch time
      chrome.storage.local.set({ totalWatchTime: totalWatchTimeSeconds });

      // Notify background every 30 seconds
      if (Math.floor(totalWatchTimeSeconds) % 30 === 0) {
        chrome.runtime.sendMessage({
          type: 'WATCH_STATUS_UPDATE',
          isWatching: true,
          totalWatchTimeSeconds: totalWatchTimeSeconds
        });
      }
    }

    lastWatchCheck = Date.now();
  }, 1000);

  console.log('[Watch Detection] Started');
}

function stopWatchDetection() {
  if (watchDetectionInterval) {
    clearInterval(watchDetectionInterval);
    watchDetectionInterval = null;
  }
  totalWatchTimeSeconds = 0;
  chrome.storage.local.set({ totalWatchTime: 0 });
  console.log('[Watch Detection] Stopped');
}

// Start watch detection when session starts
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.sessionActive) {
    if (changes.sessionActive.newValue) {
      startWatchDetection();
    } else {
      stopWatchDetection();
    }
  }
});

// Initialize watch detection if session is active
chrome.storage.local.get(['sessionActive', 'totalWatchTime'], (prefs) => {
  if (prefs.sessionActive) {
    totalWatchTimeSeconds = prefs.totalWatchTime || 0;
    startWatchDetection();
  }
});

// ===== MESSAGE HANDLERS =====

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CREATE_HIGHLIGHT') {
    createVideoHighlight().then(result => sendResponse(result));
    return true; // Keep channel open for async response
  }

  if (message.type === 'GET_WATCH_STATUS') {
    const video = document.querySelector('video');
    const isPlaying = video && !video.paused && !video.ended;
    sendResponse({
      isWatching: isPlaying && document.visibilityState === 'visible',
      totalWatchTimeSeconds
    });
    return true;
  }
});

// Keyboard shortcut: press "h" to start/stop highlight range selection.
document.addEventListener('keydown', (e) => {
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) || document.activeElement.isContentEditable) {
    return;
  }

  if (e.key.toLowerCase() !== 'h' || e.ctrlKey || e.metaKey || e.altKey) {
    return;
  }

  e.preventDefault();
  createVideoHighlight();
});

// ===== NAVIGATOR AGENT: Chapters Feature =====

function isYouTubeVideoPage() {
  try {
    const url = new URL(window.location.href);
    return url.pathname === '/watch' || url.pathname.startsWith('/shorts/');
  } catch (_e) {
    return window.location.href.includes('/watch?v=');
  }
}

function findYouTubeActionsContainer() {
  const selectors = [
    '#top-level-buttons-computed',
    'ytd-watch-metadata #top-level-buttons-computed',
    'ytd-watch-metadata #actions-inner',
    'ytd-watch-metadata #actions',
    '#actions-inner',
    '#menu #top-level-buttons-computed',
    'ytd-segmented-like-dislike-button-renderer'
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el && isVisibleElement(el)) {
      return el;
    }
  }
  return null;
}

function getOrCreateFloatingActionsContainer() {
  let container = document.getElementById('tubefocus-floating-actions');
  if (container) return container;

  container = document.createElement('div');
  container.id = 'tubefocus-floating-actions';
  container.style.cssText = `
    position: fixed;
    right: 18px;
    top: 88px;
    z-index: 10050;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    border-radius: 12px;
    background: rgba(18, 18, 18, 0.88);
    border: 1px solid rgba(255, 255, 255, 0.15);
    backdrop-filter: blur(8px);
  `;

  document.body.appendChild(container);
  return container;
}

function removeFloatingActionsContainer() {
  const container = document.getElementById('tubefocus-floating-actions');
  if (container) container.remove();
}

function getOrCreateTubeFocusButton(id, label, iconPath, onClick) {
  let btn = document.getElementById(id);
  if (btn) return btn;
  btn = createYouTubeButton(id, label, iconPath);
  btn.addEventListener('click', onClick);
  return btn;
}

async function handleChaptersButtonClick(event) {
  event.stopPropagation();
  toggleChaptersPanel();
}

async function handleAddButtonClick(event) {
  if (event) event.stopPropagation();
  try {
    await openAddVideoModal();
  } catch (error) {
    console.error('[Add] Failed to open add modal:', error);
    showToast('Unable to open Add modal.', true);
  }
}

async function handleHighlightButtonClick(event) {
  if (event) event.stopPropagation();
  createVideoHighlight();
}

function placeTubeFocusButton(container, button, position = 'append') {
  if (!container || !button) return;
  if (position === 'prepend' && container.firstChild !== button) {
    container.insertBefore(button, container.firstChild);
  } else if (button.parentElement !== container) {
    container.appendChild(button);
  }
}

// Inject buttons into native action row, fallback to floating dock.
function injectTubeFocusButtons() {
  if (!isYouTubeVideoPage()) {
    removeFloatingActionsContainer();
    return;
  }

  const nativeActions = findYouTubeActionsContainer();
  const container = nativeActions || getOrCreateFloatingActionsContainer();

  if (nativeActions) {
    removeFloatingActionsContainer();
  }

  const chaptersBtn = getOrCreateTubeFocusButton(
    'tubefocus-chapters-btn',
    'Chapters',
    `<path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"></path>`,
    handleChaptersButtonClick
  );
  const addBtn = getOrCreateTubeFocusButton(
    'tubefocus-add-btn',
    'Add to Library',
    `<path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5z"></path>`,
    handleAddButtonClick
  );
  const highlightBtn = getOrCreateTubeFocusButton(
    'tubefocus-highlight-btn',
    'Highlight Range',
    `<path d="M6 2h12l-1 8h-3v10h-4V10H7L6 2zm3 2 .5 4h5l.5-4h-6z"></path>`,
    handleHighlightButtonClick
  );

  if (nativeActions) {
    placeTubeFocusButton(container, highlightBtn, 'prepend');
    placeTubeFocusButton(container, chaptersBtn, 'prepend');
    placeTubeFocusButton(container, addBtn, 'prepend');
  } else {
    placeTubeFocusButton(container, addBtn, 'append');
    placeTubeFocusButton(container, chaptersBtn, 'prepend');
    placeTubeFocusButton(container, highlightBtn, 'append');
  }
}

async function getVideoContext() {
  const videoId = new URLSearchParams(window.location.search).get('v');
  if (!videoId) return null;

  const titleEl = document.querySelector('#title h1 yt-formatted-string');
  const title = (titleEl ? titleEl.textContent : document.title).replace(' - YouTube', '');
  const goalPrefs = await new Promise(resolve => chrome.storage.local.get(['goal', 'currentScore'], resolve));

  return {
    videoId,
    title,
    goal: userGoal || goalPrefs.goal || 'General Learning',
    score: goalPrefs.currentScore || 50,
    videoUrl: window.location.href
  };
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeUiText(text) {
  return (text || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function isVisibleElement(el) {
  if (!el || !(el instanceof Element)) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function getElementUiText(el) {
  if (!el) return '';
  const text = normalizeUiText(el.innerText || el.textContent || '');
  const aria = normalizeUiText(el.getAttribute ? el.getAttribute('aria-label') : '');
  const title = normalizeUiText(el.getAttribute ? el.getAttribute('title') : '');
  return [text, aria, title].filter(Boolean).join(' ');
}

function findYouTubeAskButton() {
  const selectors = 'button, [role="button"], yt-button-shape button, ytd-button-renderer, tp-yt-paper-button';
  const candidates = [...document.querySelectorAll(selectors)];

  const askCandidates = candidates.filter(el => {
    if (!isVisibleElement(el)) return false;
    const label = getElementUiText(el);
    if (!label) return false;
    return /\bask\b/.test(label) && !label.includes('ask a question');
  });

  askCandidates.sort((a, b) => {
    const score = (el) => {
      let value = 0;
      const label = getElementUiText(el);
      if (label === 'ask') value += 5;
      if (label.includes('ask about this video')) value += 4;
      if (el.closest('#top-level-buttons-computed')) value += 4;
      if (el.closest('#actions-inner')) value += 2;
      return value;
    };
    return score(b) - score(a);
  });

  return askCandidates[0] || null;
}

function findYouTubeAskPanel() {
  const selectors = [
    'ytd-engagement-panel-section-list-renderer',
    '[role="dialog"]',
    'tp-yt-paper-dialog',
    'ytd-popup-container'
  ].join(', ');

  const candidates = [...document.querySelectorAll(selectors)];
  for (const panel of candidates) {
    if (!isVisibleElement(panel)) continue;
    const text = normalizeUiText(panel.innerText || panel.textContent || '');
    if (
      text.includes('ask about this video') ||
      text.includes('not sure what to ask') ||
      text.includes('made with gemini')
    ) {
      return panel;
    }
  }
  return null;
}

function getAskPanelSuggestionButtons(panel) {
  if (!panel) return [];
  const candidates = [...panel.querySelectorAll('button, [role="button"], yt-button-shape button, tp-yt-paper-button, yt-chip-cloud-chip-renderer')];
  return candidates.filter(el => {
    if (!isVisibleElement(el)) return false;
    const text = normalizeUiText(el.innerText || el.textContent || '');
    if (!text) return false;
    if (text.includes('ask a question')) return false;
    if (text.includes('learn more')) return false;
    if (text.includes('made with gemini')) return false;
    if (text === 'x' || text === 'close') return false;
    return text.length >= 6;
  });
}

function extractAskPanelSummary(panel, ignoredLines = []) {
  if (!panel) return '';

  const ignored = new Set(
    ignoredLines
      .map(line => normalizeUiText(line))
      .filter(Boolean)
  );

  const ignorePatterns = [
    /^ask about this video$/,
    /^not sure what to ask\??/,
    /^hello!? curious about what you'?re watching\??$/,
    /^i'?m here to help\.?$/,
    /^ask a question\.?$/,
    /^ai can make mistakes/,
    /^learn more$/,
    /^made with gemini/,
    /^summarize the video$/,
    /^recommend related content$/,
    /^close$/,
    /^x$/
  ];

  const lines = (panel.innerText || panel.textContent || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  const filtered = [];
  for (const line of lines) {
    const normalized = normalizeUiText(line);
    if (!normalized) continue;
    if (ignored.has(normalized)) continue;
    if (ignorePatterns.some(pattern => pattern.test(normalized))) continue;
    if (filtered.length && normalizeUiText(filtered[filtered.length - 1]) === normalized) continue;
    filtered.push(line);
  }

  return filtered.join('\n').trim();
}

async function scrapeSummaryFromYouTubeAskPanel() {
  console.log('[Summary] Attempting to scrape summary from YouTube Ask panel...');

  const askButton = findYouTubeAskButton();
  if (!askButton) {
    return {
      success: false,
      error: 'YouTube Ask button not found for this video.',
      summary: null
    };
  }

  askButton.click();
  await delay(1200);

  let panel = null;
  for (let i = 0; i < 10; i += 1) {
    panel = findYouTubeAskPanel();
    if (panel) break;
    await delay(400);
  }

  if (!panel) {
    return {
      success: false,
      error: 'YouTube Ask panel did not open.',
      summary: null
    };
  }

  const initialLines = (panel.innerText || panel.textContent || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  const suggestionButtons = getAskPanelSuggestionButtons(panel);
  if (!suggestionButtons.length) {
    return {
      success: false,
      error: 'Could not find Ask suggestions in the YouTube panel.',
      summary: null
    };
  }

  let summarySuggestion = suggestionButtons.find(btn => {
    const text = normalizeUiText(btn.innerText || btn.textContent || '');
    return text.includes('summarize');
  });

  if (!summarySuggestion) {
    summarySuggestion = suggestionButtons[0];
  }

  const suggestionTexts = suggestionButtons
    .map(btn => (btn.innerText || btn.textContent || '').trim())
    .filter(Boolean);

  summarySuggestion.click();
  await delay(1200);

  const ignoredLines = [...initialLines, ...suggestionTexts];
  const startedAt = Date.now();
  const timeoutMs = 45000;

  let bestSummary = '';
  let lastSummary = '';
  let stableTicks = 0;

  while (Date.now() - startedAt < timeoutMs) {
    panel = findYouTubeAskPanel() || panel;
    const candidate = extractAskPanelSummary(panel, ignoredLines);

    if (candidate.length > bestSummary.length) {
      bestSummary = candidate;
    }

    if (candidate && candidate === lastSummary) {
      stableTicks += 1;
    } else {
      stableTicks = 0;
      lastSummary = candidate;
    }

    if (candidate.length >= 120 && stableTicks >= 2) {
      break;
    }
    await delay(900);
  }

  const finalSummary = bestSummary.trim();
  if (!finalSummary) {
    return {
      success: false,
      error: 'Could not extract summary text from YouTube Ask panel.',
      summary: null
    };
  }

  return {
    success: true,
    summary: finalSummary
  };
}

async function openAddVideoModal() {
  const context = await getVideoContext();
  if (!context) {
    showToast('Could not read current video.', true);
    return;
  }

  const existing = document.getElementById('tubefocus-add-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'tubefocus-add-modal';
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 100120;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,0.72);
    font-family: 'Roboto', -apple-system, BlinkMacSystemFont, sans-serif;
  `;

  overlay.innerHTML = `
    <div style="
      width: min(520px, 92vw);
      background: #181818;
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 14px;
      padding: 18px;
      color: #fff;
      box-shadow: 0 18px 60px rgba(0,0,0,0.45);
    ">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <h3 style="margin:0; font-size:18px;">Add Video To Library</h3>
        <button id="tubefocus-add-close" style="background:none;border:none;color:#ccc;font-size:20px;cursor:pointer;">×</button>
      </div>

      <div style="font-size:13px; color:#bbb; margin-bottom:10px; line-height:1.35;">
        ${context.title}
      </div>

      <div id="tubefocus-transcript-status" style="
        font-size:13px;
        padding:8px 10px;
        border-radius:8px;
        background: rgba(255,255,255,0.06);
        margin-bottom:12px;
      ">Checking transcript availability...</div>

      <label style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:12px;cursor:pointer;">
        <input id="tubefocus-save-summary-toggle" type="checkbox" checked />
        Save YouTube Ask summary too
      </label>

      <label style="font-size:12px; color:#c8c8c8; display:block; margin-bottom:6px;">Description (for your future search)</label>
      <textarea id="tubefocus-add-description" placeholder="e.g. Must watch for RoPE/KV-cache revision" style="
        width:100%;
        min-height:84px;
        border-radius:10px;
        border:1px solid rgba(255,255,255,0.2);
        background: rgba(255,255,255,0.05);
        color:#fff;
        padding:10px;
        font-size:13px;
        resize: vertical;
        box-sizing: border-box;
      "></textarea>

      <div id="tubefocus-add-error" style="min-height:18px; margin-top:8px; font-size:12px; color:#ff8b8b;"></div>

      <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:12px;">
        <button id="tubefocus-add-cancel" style="
          border:1px solid rgba(255,255,255,0.25);
          background: transparent;
          color:#eee;
          border-radius:8px;
          padding:8px 14px;
          font-size:13px;
          cursor:pointer;
        ">Cancel</button>
        <button id="tubefocus-add-save" style="
          border:1px solid rgba(42,168,82,0.5);
          background: rgba(42,168,82,0.24);
          color:#fff;
          border-radius:8px;
          padding:8px 14px;
          font-size:13px;
          cursor:pointer;
          font-weight:700;
        ">Add Video</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector('#tubefocus-add-close').onclick = close;
  overlay.querySelector('#tubefocus-add-cancel').onclick = close;

  const statusEl = overlay.querySelector('#tubefocus-transcript-status');
  const errorEl = overlay.querySelector('#tubefocus-add-error');
  const saveBtn = overlay.querySelector('#tubefocus-add-save');
  const descEl = overlay.querySelector('#tubefocus-add-description');
  const summaryToggleEl = overlay.querySelector('#tubefocus-save-summary-toggle');

  const transcriptResult = await scrapeTranscriptFromYouTube();
  const transcript = transcriptResult?.success ? transcriptResult.transcript : '';
  const transcriptAvailable = !!transcript;

  if (transcriptAvailable) {
    statusEl.textContent = `Transcript available (${transcriptResult.segmentCount || 0} segments).`;
    statusEl.style.background = 'rgba(42,168,82,0.16)';
    statusEl.style.border = '1px solid rgba(42,168,82,0.45)';
  } else {
    statusEl.textContent = 'Transcript unavailable. Description is required to save this video.';
    statusEl.style.background = 'rgba(219,122,56,0.2)';
    statusEl.style.border = '1px solid rgba(219,122,56,0.45)';
  }

  saveBtn.onclick = async () => {
    errorEl.textContent = '';
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    try {
      const description = (descEl.value || '').trim();
      if (!transcriptAvailable && !description) {
        errorEl.textContent = 'Please add a description when transcript is unavailable.';
        saveBtn.disabled = false;
        saveBtn.textContent = 'Add Video';
        return;
      }

      const saveResponse = await new Promise(resolve => {
        chrome.runtime.sendMessage({
          type: 'LIBRARIAN_SAVE_ITEM',
          video_id: context.videoId,
          title: context.title,
          goal: context.goal,
          score: context.score,
          video_url: context.videoUrl,
          transcript: transcriptAvailable ? transcript : '',
          description
        }, resolve);
      });

      if (!saveResponse?.success) {
        throw new Error(saveResponse?.error || 'Failed to save video.');
      }

      if (summaryToggleEl.checked) {
        const summaryResult = await scrapeSummaryFromYouTubeAskPanel();
        if (summaryResult?.success && summaryResult.summary) {
          await new Promise(resolve => {
            chrome.runtime.sendMessage({
              type: 'LIBRARIAN_SAVE_SUMMARY',
              video_id: context.videoId,
              title: context.title,
              goal: context.goal,
              video_url: context.videoUrl,
              summary: summaryResult.summary,
              source: 'youtube_ask'
            }, resolve);
          });
        } else {
          console.warn('[Add] Summary requested but extraction failed:', summaryResult?.error);
        }
      }

      close();
      showToast('Video added to library.');
    } catch (error) {
      console.error('[Add] Save failed:', error);
      errorEl.textContent = error.message || 'Failed to add video.';
      saveBtn.disabled = false;
      saveBtn.textContent = 'Add Video';
    }
  };
}

function createYouTubeButton(id, label, iconPath) {
  const btn = document.createElement('button');
  btn.id = id;
  btn.className = 'yt-spec-button-shape-next yt-spec-button-shape-next--size-m tubefocus-icon-btn';
  btn.setAttribute('aria-label', label);
  btn.setAttribute('title', label);
  btn.style.cssText = `
    margin-right: 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0;
    cursor: pointer;
    border: 1px solid var(--yt-spec-10-percent-layer, rgba(255,255,255,0.2));
    border-radius: 50%;
    width: 34px;
    min-width: 34px;
    height: 34px;
    background: var(--yt-spec-badge-chip-background, rgba(255,255,255,0.08));
    color: var(--yt-spec-text-primary, #fff);
    outline: none;
  `;
  btn.innerHTML = `
    <div class="yt-spec-button-shape-next__icon" style="margin-right:0; display:flex; align-items:center; justify-content:center;">
      <svg height="18" viewBox="0 0 24 24" width="18" focusable="false" style="pointer-events:none; display:block; fill:currentColor;">
        ${iconPath}
      </svg>
    </div>
  `;
  return btn;
}

// Hook into loop
setInterval(injectTubeFocusButtons, 2000);
document.addEventListener('yt-navigate-finish', () => setTimeout(injectTubeFocusButtons, 500));

let chaptersPanel = null;

function summarizeChapterText(text) {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return 'Chapter';
  const words = clean.split(' ').slice(0, 8);
  let label = words.join(' ');
  if (clean.split(' ').length > words.length) label += '...';
  return label;
}

function generateTranscriptChapters(segments, durationSeconds) {
  if (!Array.isArray(segments) || segments.length === 0) return [];

  const parsed = segments
    .map((segment) => ({
      seconds: parseTimestampToSeconds(segment.timestamp),
      text: (segment.text || '').trim()
    }))
    .filter((segment) => Number.isFinite(segment.seconds) && segment.text)
    .sort((a, b) => a.seconds - b.seconds);

  if (!parsed.length) return [];

  const effectiveDuration = Number.isFinite(durationSeconds) && durationSeconds > 0
    ? durationSeconds
    : parsed[parsed.length - 1].seconds;

  const targetCount = Math.min(10, Math.max(4, Math.floor((effectiveDuration || 600) / 240)));
  const step = Math.max(1, Math.floor(parsed.length / targetCount));

  const chapters = [];
  const seenTimes = new Set();
  for (let i = 0; i < parsed.length; i += step) {
    const segment = parsed[i];
    if (seenTimes.has(segment.seconds)) continue;
    seenTimes.add(segment.seconds);
    chapters.push({
      time: formatSecondsToLabel(segment.seconds),
      title: summarizeChapterText(segment.text),
      seconds: segment.seconds
    });
  }

  const first = parsed[0];
  if (first && !seenTimes.has(first.seconds)) {
    chapters.unshift({
      time: formatSecondsToLabel(first.seconds),
      title: summarizeChapterText(first.text),
      seconds: first.seconds
    });
  }

  return chapters
    .sort((a, b) => a.seconds - b.seconds)
    .slice(0, 12);
}

function createChaptersPanel() {
  const panel = document.createElement('div');
  panel.id = 'tubefocus-chapters-panel';
  panel.className = 'tubefocus-chapters-panel';

  panel.innerHTML = `
    <div class="chapters-header">
      <span>Video Chapters</span>
      <button class="chapters-close" title="Close">×</button>
    </div>
    <div id="chapters-content" class="chapters-list">
      <div class="chapters-loading">
        <div class="spinner" style="display:inline-block; border-left-color: #3ea6ff;"></div>
        <div style="margin-top:10px">Analyzing content...</div>
      </div>
    </div>
    <div id="chapters-footer" class="chapters-source" style="display:none"></div>
  `;

  document.body.appendChild(panel);

  // Close handler
  panel.querySelector('.chapters-close').addEventListener('click', (e) => {
    e.stopPropagation();
    panel.classList.remove('open');
  });

  return panel;
}

function toggleChaptersPanel() {
  if (!chaptersPanel) {
    chaptersPanel = createChaptersPanel();
  }

  const panel = document.getElementById('tubefocus-chapters-panel');

  if (panel.classList.contains('open')) {
    panel.classList.remove('open');
  } else {
    panel.classList.add('open');
    loadChapters();
  }
}

async function loadChapters() {
  const container = document.getElementById('chapters-content');
  const footer = document.getElementById('chapters-footer');

  if (!container || !footer) return;

  if (!isYouTubeVideoPage()) {
    container.innerHTML = '<div class="chapters-loading">Open a video to view chapters.</div>';
    return;
  }

  container.innerHTML = `
    <div class="chapters-loading">
      <div class="spinner" style="display:inline-block; border-left-color: #3ea6ff;"></div>
      <div style="margin-top:10px">Reading transcript timestamps...</div>
    </div>
  `;
  footer.style.display = 'none';

  try {
    const transcriptResult = await scrapeTranscriptFromYouTube();
    if (!transcriptResult?.success || !Array.isArray(transcriptResult.segments) || transcriptResult.segments.length === 0) {
      container.innerHTML = '<div class="chapters-loading">Transcript unavailable. Chapters could not be generated.</div>';
      return;
    }

    const video = document.querySelector('video');
    const duration = video && Number.isFinite(video.duration) ? video.duration : 0;
    const chapters = generateTranscriptChapters(transcriptResult.segments, duration);
    renderChapters(chapters, 'transcript_timestamps');
  } catch (e) {
    container.innerHTML = `<div class="chapters-loading" style="color:#ff8a80">${e.message}</div>`;
  }
}

function renderChapters(chapters, source) {
  const container = document.getElementById('chapters-content');
  const footer = document.getElementById('chapters-footer');

  if (!chapters || chapters.length === 0) {
    container.innerHTML = '<div class="chapters-loading">No chapters could be generated for this video.</div>';
    return;
  }

  const video = document.querySelector('video');
  let html = '';
  chapters.forEach(chapter => {
    const seconds = Number.isFinite(chapter.seconds)
      ? chapter.seconds
      : parseTimestampToSeconds(chapter.time);

    html += `
      <div class="chapter-item" data-seconds="${seconds}">
        <div class="chapter-time">${chapter.time}</div>
        <div class="chapter-title">${chapter.title}</div>
      </div>
    `;
  });

  container.innerHTML = html;
  container.querySelectorAll('.chapter-item').forEach((row) => {
    row.addEventListener('click', () => {
      if (!video) return;
      const seconds = Number(row.getAttribute('data-seconds'));
      if (!Number.isFinite(seconds)) return;
      video.currentTime = Math.max(0, seconds);
    });
  });

  // Update footer with source info
  let sourceText = 'Generated from transcript timestamps';
  let sourceIcon = '🧭';
  if (source === 'transcript_timestamps') {
    sourceText = 'Generated from transcript timestamps';
    sourceIcon = '📝';
  }

  footer.innerHTML = `<span>${sourceIcon}</span> <span>${sourceText}</span>`;
  footer.style.display = 'flex';
}

// ===== LOCAL RECOMMENDATION FILTER =====

const recommendationDecisionCache = new Map();
const filteredRecommendationRuntimeSet = new Set();
let filteredRecentVideosCache = [];
let filteredRecentVideosLoaded = false;
let gatekeeperObserver = null;
let scanTimeout = null;
const RECOMMENDATION_SELECTORS = [
  'ytd-compact-video-renderer',
  'ytd-video-renderer',
  'ytd-rich-item-renderer',
  'ytd-grid-video-renderer'
].join(', ');
let cachedGoalProfile = {
  goal: '',
  tokens: [],
  tokenSet: new Set(),
  technicalIntent: 0
};

const ENTERTAINMENT_CHANNELS = Array.isArray(self.TUBEFOCUS_ENTERTAINMENT_CHANNELS)
  ? self.TUBEFOCUS_ENTERTAINMENT_CHANNELS
  : [];

const ENTERTAINMENT_CHANNEL_KEYWORDS = [
  'entertainment',
  'music',
  'records',
  'vevo',
  'gaming',
  'games',
  'movieclips',
  'cartoon',
  'nursery',
  'kids',
  'playhouse',
  'toys',
  'comedy',
  'vlog',
  'prank',
  'reaction'
];

const ENTERTAINMENT_TITLE_PATTERNS = [
  /\bprank\b/i,
  /\breaction\b/i,
  /\bfunny\b/i,
  /\bcomedy\b/i,
  /\bvlog\b/i,
  /\bchallenge\b/i,
  /\bvs\b/i,
  /\bshorts?\b/i,
  /\broast\b/i,
  /\bstream highlights?\b/i,
  /\bfortnite\b/i,
  /\bminecraft\b/i,
  /\bgta\b/i,
  /\bfree fire\b/i,
  /\broblox\b/i,
  /\bpubg\b/i,
  /\bmusic video\b/i,
  /\bofficial video\b/i,
  /\blyrics?\b/i
];

const CLICKBAIT_TITLE_PATTERNS = [
  /\byou won't believe\b/i,
  /\bthis changed everything\b/i,
  /\bshocking\b/i,
  /\binsane\b/i,
  /\bwent wrong\b/i,
  /\bwatch till end\b/i,
  /\bmust watch\b/i,
  /\bviral\b/i
];

const EDUCATIONAL_TITLE_HINTS = [
  /\btutorial\b/i,
  /\bcourse\b/i,
  /\blearn\b/i,
  /\bexplained\b/i,
  /\bguide\b/i,
  /\blecture\b/i,
  /\broadmap\b/i,
  /\binterview\b/i,
  /\bcase study\b/i,
  /\bhow to\b/i,
  /\bdeep dive\b/i,
  /\bwalkthrough\b/i
];

const TECHNICAL_TITLE_HINTS = [
  /\bpython\b/i,
  /\bjavascript\b/i,
  /\btypescript\b/i,
  /\breact\b/i,
  /\bmachine learning\b/i,
  /\bai\b/i,
  /\bllm\b/i,
  /\bdata\b/i,
  /\balgorithm\b/i,
  /\bsystem design\b/i,
  /\bbackend\b/i,
  /\bfrontend\b/i,
  /\bapi\b/i
];

const GOAL_STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'into', 'about', 'over',
  'under', 'your', 'their', 'while', 'when', 'where', 'what', 'which', 'would',
  'should', 'could', 'have', 'has', 'had', 'will', 'shall', 'want', 'need', 'learn',
  'study', 'watch', 'video', 'videos'
]);

const LOCAL_FILTER_MODEL = {
  threshold: 0.45,
  bias: -0.25,
  weights: {
    goal_overlap: 3.0,
    educational_hits: 0.95,
    technical_hits: 0.8,
    technical_intent_boost: 0.45,
    long_form_bonus: 0.35,
    entertainment_hits: -1.45,
    clickbait_hits: -1.55,
    channel_keyword_hit: -1.15,
    uppercase_ratio: -0.8
  }
};

function injectGatekeeperStyles() {
  if (document.getElementById('tubefocus-recommendation-filter-styles')) return;
  const style = document.createElement('style');
  style.id = 'tubefocus-recommendation-filter-styles';
  style.textContent = `
    .tubefocus-filter-hidden {
      display: none !important;
    }
  `;
  document.head.appendChild(style);
}

function normalizeFilterText(text) {
  return (text || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function normalizeChannelName(name) {
  return normalizeFilterText(name)
    .normalize('NFKD')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const NORMALIZED_ENTERTAINMENT_CHANNELS = new Set(
  ENTERTAINMENT_CHANNELS
    .map(normalizeChannelName)
    .filter(Boolean)
);

function tokenizeFilterText(text) {
  return normalizeFilterText(text)
    .split(/[^a-z0-9]+/)
    .filter(token => token.length > 2);
}

function countPatternHits(patterns, text) {
  if (!text) return 0;
  let count = 0;
  for (const pattern of patterns) {
    if (pattern.test(text)) count += 1;
  }
  return count;
}

function getUppercaseRatio(text) {
  if (!text) return 0;
  const letters = (text.match(/[a-z]/gi) || []);
  if (!letters.length) return 0;
  const upper = letters.filter(ch => ch === ch.toUpperCase()).length;
  return upper / letters.length;
}

function logistic(value) {
  return 1 / (1 + Math.exp(-value));
}

function clamp(value, minValue, maxValue) {
  return Math.min(maxValue, Math.max(minValue, value));
}

function getGoalProfile(goal) {
  const normalizedGoal = normalizeFilterText(goal);
  if (cachedGoalProfile.goal === normalizedGoal) {
    return cachedGoalProfile;
  }

  const goalTokens = tokenizeFilterText(normalizedGoal)
    .filter(token => !GOAL_STOPWORDS.has(token));
  const technicalIntent = TECHNICAL_TITLE_HINTS.some(pattern => pattern.test(normalizedGoal)) ? 1 : 0;

  cachedGoalProfile = {
    goal: normalizedGoal,
    tokens: goalTokens,
    tokenSet: new Set(goalTokens),
    technicalIntent
  };
  return cachedGoalProfile;
}

function extractSidebarRecommendation(element) {
  const anchor = element.querySelector('a#thumbnail') || element.querySelector('a#video-title');
  const titleSpan = element.querySelector('#video-title, #video-title-link, h3 a#video-title');

  if (!anchor || !titleSpan) return null;
  const href = anchor.getAttribute('href') || '';
  const idMatch = href.match(/[?&]v=([^&]+)/) || href.match(/\/shorts\/([^/?&]+)/);
  if (!idMatch || !idMatch[1]) return null;

  const channelNode =
    element.querySelector('#channel-name a') ||
    element.querySelector('#channel-name yt-formatted-string') ||
    element.querySelector('ytd-channel-name #text') ||
    element.querySelector('#byline-container #text');

  return {
    id: idMatch[1],
    title: (titleSpan.textContent || '').trim(),
    channel: channelNode ? (channelNode.textContent || '').trim() : '',
    element
  };
}

function updateFilterStatusBadge() {
  const existing = document.getElementById('tubefocus-filter-status');
  if (!sessionActive) {
    if (existing) existing.remove();
    return;
  }

  const host =
    document.querySelector('#secondary-inner') ||
    document.querySelector('#secondary') ||
    document.querySelector('ytd-watch-flexy #secondary');
  const targetHost = host || document.body;

  const hiddenCount = document.querySelectorAll('.tubefocus-filter-hidden').length;
  const scorePct = Number.isFinite(currentScore)
    ? (currentScore > 1 ? Math.round(currentScore) : Math.round(currentScore * 100))
    : null;
  const rawIntent = (currentIntentLabel || 'Video').replace(/\s+/g, ' ').trim();
  const shortIntent = rawIntent.length > 20 ? `${rawIntent.slice(0, 20)}...` : rawIntent;
  let badge = existing;
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'tubefocus-filter-status';
    badge.style.cssText = `
      margin: 8px 0 10px;
      padding: 7px 10px;
      border-radius: 999px;
      background: rgba(0, 0, 0, 0.62);
      color: var(--yt-spec-text-primary, #fff);
      border: 1px solid rgba(253, 240, 213, 0.34);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.2px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      position: fixed;
      bottom: 62px;
      left: 20px;
      z-index: 10040;
      max-width: 420px;
      white-space: nowrap;
      cursor: default;
    `;

    const main = document.createElement('span');
    main.className = 'tubefocus-filter-main';
    main.style.cssText = `
      overflow: hidden;
      text-overflow: ellipsis;
    `;
    badge.appendChild(main);

    const count = document.createElement('span');
    count.className = 'tubefocus-filter-count';
    count.style.cssText = `
      color: #fdf0d5;
      font-family: 'Roboto Mono', monospace;
      font-weight: 700;
      cursor: pointer;
    `;
    badge.appendChild(count);

    const popup = document.createElement('div');
    popup.className = 'tubefocus-filter-popup';
    popup.style.cssText = `
      position: absolute;
      left: 0;
      bottom: 34px;
      width: 360px;
      max-height: 360px;
      overflow-y: auto;
      background: rgba(20, 3, 5, 0.96);
      border: 1px solid rgba(253, 240, 213, 0.3);
      border-radius: 10px;
      box-shadow: 0 14px 30px rgba(0, 0, 0, 0.34);
      padding: 8px;
      display: none;
    `;
    badge.appendChild(popup);

    badge.addEventListener('mouseenter', () => {
      renderFilteredPopupContent(popup);
      popup.style.display = 'block';
    });
    badge.addEventListener('mouseleave', () => {
      popup.style.display = 'none';
    });

    targetHost.appendChild(badge);
  }

  const mainNode = badge.querySelector('.tubefocus-filter-main');
  const countNode = badge.querySelector('.tubefocus-filter-count');
  if (mainNode) {
    const scoreLabel = scorePct !== null ? `${scorePct}%` : '--%';
    mainNode.textContent = `${scoreLabel} ${shortIntent}`;
  }
  if (countNode) {
    countNode.textContent = `| ${hiddenCount}`;
  }

  ensureFilteredRecentVideosCacheLoaded();
}

function ensureFilteredRecentVideosCacheLoaded() {
  if (filteredRecentVideosLoaded) return;
  chrome.storage.local.get(['filteredVideosRemovedRecent'], (data) => {
    filteredRecentVideosCache = Array.isArray(data.filteredVideosRemovedRecent)
      ? data.filteredVideosRemovedRecent
      : [];
    filteredRecentVideosLoaded = true;
    const popup = document.querySelector('#tubefocus-filter-status .tubefocus-filter-popup');
    if (popup && popup.style.display === 'block') {
      renderFilteredPopupContent(popup);
    }
  });
}

function formatFilterReasonLabel(reason) {
  const label = (reason || 'filtered').toString().replace(/_/g, ' ').trim();
  return label || 'filtered';
}

function renderFilteredPopupContent(popup) {
  if (!popup) return;
  popup.innerHTML = '';

  const title = document.createElement('div');
  title.textContent = 'Recently filtered videos';
  title.style.cssText = `
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: rgba(253, 240, 213, 0.75);
    margin: 2px 4px 8px;
    font-weight: 700;
  `;
  popup.appendChild(title);

  const recent = filteredRecentVideosCache.slice(0, 12);
  if (!recent.length) {
    const empty = document.createElement('div');
    empty.textContent = 'No filtered videos recorded yet.';
    empty.style.cssText = `
      color: rgba(253, 240, 213, 0.75);
      font-size: 12px;
      padding: 8px 6px;
    `;
    popup.appendChild(empty);
    return;
  }

  for (const item of recent) {
    const link = document.createElement('a');
    link.href = item.url || `https://www.youtube.com/watch?v=${item.video_id || ''}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      text-decoration: none;
      border: 1px solid transparent;
      border-radius: 8px;
      padding: 7px;
      margin-bottom: 4px;
    `;
    link.addEventListener('mouseenter', () => {
      link.style.borderColor = 'rgba(253, 240, 213, 0.28)';
      link.style.background = 'rgba(255, 255, 255, 0.05)';
    });
    link.addEventListener('mouseleave', () => {
      link.style.borderColor = 'transparent';
      link.style.background = 'transparent';
    });

    const img = document.createElement('img');
    img.src = item.thumbnail_url || '';
    img.alt = 'thumb';
    img.style.cssText = `
      width: 90px;
      height: 50px;
      border-radius: 6px;
      object-fit: cover;
      background: rgba(255, 255, 255, 0.08);
      flex-shrink: 0;
    `;
    link.appendChild(img);

    const meta = document.createElement('div');
    meta.style.cssText = `min-width: 0; color: #fdf0d5;`;

    const titleLine = document.createElement('div');
    titleLine.textContent = item.title || item.video_id || 'Removed video';
    titleLine.style.cssText = `
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    `;
    meta.appendChild(titleLine);

    const reasonLine = document.createElement('div');
    reasonLine.textContent = formatFilterReasonLabel(item.reason);
    reasonLine.style.cssText = `
      font-size: 10px;
      color: rgba(253, 240, 213, 0.72);
      margin-top: 2px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    `;
    meta.appendChild(reasonLine);

    link.appendChild(meta);
    popup.appendChild(link);
  }
}

function buildFilteredVideoPayload(recommendation, decision) {
  if (!recommendation || !recommendation.id) return null;
  return {
    video_id: recommendation.id,
    title: recommendation.title || recommendation.id,
    channel: recommendation.channel || '',
    reason: decision?.reason || 'filtered',
    score: typeof decision?.score === 'number' ? Number(decision.score.toFixed(3)) : null,
    thumbnail_url: `https://i.ytimg.com/vi/${recommendation.id}/hqdefault.jpg`,
    url: `https://www.youtube.com/watch?v=${recommendation.id}`,
    removed_at: new Date().toISOString()
  };
}

function recordFilteredRecommendation(recommendation, decision) {
  if (!decision?.hide || !recommendation?.id) return;
  if (filteredRecommendationRuntimeSet.has(recommendation.id)) return;
  filteredRecommendationRuntimeSet.add(recommendation.id);

  const payload = buildFilteredVideoPayload(recommendation, decision);
  if (!payload) return;

  chrome.storage.local.get(['filteredVideosRemovedTotal', 'filteredVideosRemovedRecent'], (data) => {
    const total = Number(data.filteredVideosRemovedTotal || 0) + 1;
    const recent = Array.isArray(data.filteredVideosRemovedRecent) ? data.filteredVideosRemovedRecent : [];
    const deduped = [payload, ...recent.filter(item => item.video_id !== payload.video_id)];
    filteredRecentVideosCache = deduped.slice(0, 40);
    filteredRecentVideosLoaded = true;
    chrome.storage.local.set({
      filteredVideosRemovedTotal: total,
      filteredVideosRemovedRecent: filteredRecentVideosCache
    });
  });
}

function isBlockedEntertainmentChannel(channelName) {
  const normalized = normalizeChannelName(channelName);
  if (!normalized) return false;

  if (NORMALIZED_ENTERTAINMENT_CHANNELS.has(normalized)) {
    return true;
  }

  for (const blocked of NORMALIZED_ENTERTAINMENT_CHANNELS) {
    if (blocked.length < 10) continue;
    if (normalized.includes(blocked) || blocked.includes(normalized)) {
      return true;
    }
  }

  return ENTERTAINMENT_CHANNEL_KEYWORDS.some(keyword => normalized.includes(keyword));
}

function overlapsGoal(title, goal) {
  const goalProfile = getGoalProfile(goal);
  if (!goalProfile.tokens.length) return 0;
  const titleTokens = new Set(tokenizeFilterText(title));
  const overlapCount = goalProfile.tokens.reduce((count, token) => count + (titleTokens.has(token) ? 1 : 0), 0);
  return overlapCount / goalProfile.tokens.length;
}

function scoreRecommendationWithLocalModel(recommendation, goal) {
  const title = recommendation.title || '';
  const channel = recommendation.channel || '';
  const normalizedTitle = normalizeFilterText(title);
  const goalProfile = getGoalProfile(goal || 'general learning');

  const features = {
    goal_overlap: overlapsGoal(title, goal || 'general learning'),
    educational_hits: clamp(countPatternHits(EDUCATIONAL_TITLE_HINTS, normalizedTitle), 0, 3),
    technical_hits: clamp(countPatternHits(TECHNICAL_TITLE_HINTS, normalizedTitle), 0, 3),
    technical_intent_boost: goalProfile.technicalIntent,
    long_form_bonus: /\b\d+\s*(min|mins|minutes|hour|hours)\b/i.test(title) ? 1 : 0,
    entertainment_hits: clamp(countPatternHits(ENTERTAINMENT_TITLE_PATTERNS, normalizedTitle), 0, 3),
    clickbait_hits: clamp(countPatternHits(CLICKBAIT_TITLE_PATTERNS, normalizedTitle), 0, 3),
    channel_keyword_hit: ENTERTAINMENT_CHANNEL_KEYWORDS.some(keyword => normalizeChannelName(channel).includes(keyword)) ? 1 : 0,
    uppercase_ratio: clamp(getUppercaseRatio(title), 0, 1)
  };

  const w = LOCAL_FILTER_MODEL.weights;
  const z =
    LOCAL_FILTER_MODEL.bias +
    (w.goal_overlap * features.goal_overlap) +
    (w.educational_hits * features.educational_hits) +
    (w.technical_hits * features.technical_hits) +
    (w.technical_intent_boost * (features.technical_intent_boost * features.technical_hits)) +
    (w.long_form_bonus * features.long_form_bonus) +
    (w.entertainment_hits * features.entertainment_hits) +
    (w.clickbait_hits * features.clickbait_hits) +
    (w.channel_keyword_hit * features.channel_keyword_hit) +
    (w.uppercase_ratio * features.uppercase_ratio);

  return {
    score: logistic(z),
    features
  };
}

function shouldHideRecommendation(recommendation, goal) {
  if (isBlockedEntertainmentChannel(recommendation.channel || '')) {
    return {
      hide: true,
      reason: 'blocked_channel',
      score: 0.0
    };
  }

  const model = scoreRecommendationWithLocalModel(recommendation, goal);
  const features = model.features;
  const heuristicDrop =
    features.entertainment_hits >= 2 &&
    features.goal_overlap === 0 &&
    features.educational_hits === 0;

  if (heuristicDrop) {
    return {
      hide: true,
      reason: 'entertainment_pattern',
      score: model.score
    };
  }

  return {
    hide: model.score < LOCAL_FILTER_MODEL.threshold,
    reason: model.score < LOCAL_FILTER_MODEL.threshold ? 'low_model_score' : 'keep',
    score: model.score
  };
}

function applyRecommendationFilter(element, decision) {
  if (!element) return;
  if (decision.hide) {
    element.classList.add('tubefocus-filter-hidden');
  } else {
    element.classList.remove('tubefocus-filter-hidden');
  }
  if (typeof decision.score === 'number') {
    element.setAttribute('data-tubefocus-score', decision.score.toFixed(3));
  } else {
    element.removeAttribute('data-tubefocus-score');
  }
  updateFilterStatusBadge();
}

function processSidebarItem(element) {
  if (!sessionActive) return;
  if (element.getAttribute('data-tubefocus-filtered') === '1') return;

  const recommendation = extractSidebarRecommendation(element);
  if (!recommendation) return;

  let decision = recommendationDecisionCache.get(recommendation.id);
  if (!decision) {
    decision = shouldHideRecommendation(recommendation, userGoal || 'General Learning');
    recommendationDecisionCache.set(recommendation.id, decision);
  }
  applyRecommendationFilter(recommendation.element, decision);
  recordFilteredRecommendation(recommendation, decision);
  recommendation.element.setAttribute('data-tubefocus-filtered', '1');
}

function queueVisibleRecommendations() {
  if (!sessionActive) return;
  document.querySelectorAll(RECOMMENDATION_SELECTORS).forEach(processSidebarItem);
  updateFilterStatusBadge();
}

function scheduleBatchProcessing() {
  if (scanTimeout) clearTimeout(scanTimeout);
  scanTimeout = setTimeout(queueVisibleRecommendations, 150);
}

function clearGatekeeperDecorations() {
  recommendationDecisionCache.clear();
  filteredRecommendationRuntimeSet.clear();
  document.querySelectorAll('.tubefocus-filter-hidden').forEach((el) => {
    el.classList.remove('tubefocus-filter-hidden');
  });
  document.querySelectorAll('[data-tubefocus-filtered="1"]').forEach((el) => {
    el.removeAttribute('data-tubefocus-filtered');
    el.removeAttribute('data-tubefocus-score');
  });
  updateFilterStatusBadge();
}

function startGatekeeperObserver() {
  if (gatekeeperObserver) return;
  console.log('[Gatekeeper] Starting local recommendation filter...');
  injectGatekeeperStyles();

  gatekeeperObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (!mutation.addedNodes || mutation.addedNodes.length === 0) continue;
      scheduleBatchProcessing();
      return;
    }
  });

  gatekeeperObserver.observe(document.body, { childList: true, subtree: true });
  scheduleBatchProcessing();
}

// Start immediately
startGatekeeperObserver();


function showToast(message, isError = false) {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
    background: ${isError ? '#ff4444' : '#4caf50'}; color: white; padding: 10px 20px;
    border-radius: 20px; font-weight: bold; z-index: 10001; animation: fadeInOut 3s forwards;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
