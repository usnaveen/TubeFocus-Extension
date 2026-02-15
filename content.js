// content.js
console.log('[content.js] injected - CLOUD RUN MODE');
console.log('[content.js] API Base URL:', 'https://yt-scorer-api-933573987016.us-central1.run.app');

let sessionActive = false;
let userGoal = '';
let lastVideoId = null;
let currentScore = null;
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
  ['sessionActive', 'goal', 'lastVideoId', 'currentScore', 'selectedTheme'],
  prefs => {
    sessionActive = !!prefs.sessionActive;
    userGoal = prefs.goal || '';
    lastVideoId = prefs.lastVideoId || null;
    currentScore = prefs.currentScore || null;
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

    // Step 2: Wait for transcript panel to load
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Step 3: Find transcript panel and extract text
    const transcriptPanel = document.querySelector('ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]');

    if (!transcriptPanel) {
      console.warn('[Transcript] Transcript panel not found after clicking button');
      return {
        success: false,
        error: 'Transcript panel did not load. Please try again.',
        transcript: null
      };
    }

    // Extract transcript segments
    const segments = transcriptPanel.querySelectorAll('ytd-transcript-segment-renderer');

    if (segments.length === 0) {
      console.warn('[Transcript] No transcript segments found in panel');
      return {
        success: false,
        error: 'Transcript panel is empty.',
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

function startCoachMonitoring() {
  if (coachCheckInterval) return; // Already running

  console.log('[Coach] Starting proactive monitoring');

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
  if (!sessionActive || sessionVideosWatched.length === 0) return;

  console.log('[Coach] Requesting analysis with', sessionVideosWatched.length, 'videos');

  chrome.storage.local.get(['goal'], (prefs) => {
    const goal = prefs.goal || userGoal;
    if (!goal) return;

    const sessionId = `session_${Date.now()}`;

    chrome.runtime.sendMessage({
      type: 'COACH_ANALYZE',
      sessionId: sessionId,
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

  const icon = patternIcons[analysis.pattern_detected] || '💡';

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
        <div style="font-size: 11px; opacity: 0.9;">${analysis.pattern_detected.replace('_', ' ').toUpperCase()}</div>
      </div>
    </div>
    <div class="coach-message" style="margin-bottom: 12px; line-height: 1.4; font-size: 14px;">
      ${analysis.message}
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
  if (area === 'local' && changes.sessionActive) {
    if (changes.sessionActive.newValue) {
      startCoachMonitoring();
    } else {
      stopCoachMonitoring();
    }
  }
});

// Initialize coach monitoring if session is active
chrome.storage.local.get(['sessionActive'], (prefs) => {
  if (prefs.sessionActive) {
    startCoachMonitoring();
  }
});

// ===== VIDEO HIGHLIGHT FEATURE =====

/**
 * Creates a highlight at the current video timestamp
 */
async function createVideoHighlight() {
  console.log('[Highlight] Creating highlight...');

  try {
    const video = document.querySelector('video');
    if (!video) {
      return { success: false, error: 'No video found on page' };
    }

    const currentTime = Math.floor(video.currentTime);
    const videoId = new URL(window.location.href).searchParams.get('v');
    const videoTitle = document.querySelector('h1.ytd-video-primary-info-renderer yt-formatted-string, #title h1 yt-formatted-string')?.textContent || document.title;

    // Format timestamp
    const minutes = Math.floor(currentTime / 60);
    const seconds = currentTime % 60;
    const timestampFormatted = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    // Create highlight modal
    const highlight = await showHighlightComposer({
      videoId,
      videoTitle,
      timestamp: currentTime,
      timestampFormatted
    });

    if (highlight.cancelled) {
      return { success: false, error: 'Cancelled by user' };
    }

    // Try to get transcript for this section
    let transcriptExcerpt = null;
    try {
      transcriptExcerpt = await getTranscriptForTimestamp(currentTime, 30); // 30 seconds around timestamp
    } catch (e) {
      console.log('[Highlight] No transcript available for this section');
    }

    // Save highlight via background script
    chrome.runtime.sendMessage({
      type: 'SAVE_HIGHLIGHT',
      highlight: {
        videoId,
        videoTitle,
        timestamp: currentTime,
        timestampFormatted,
        note: highlight.note,
        transcript: transcriptExcerpt,
        videoUrl: `https://www.youtube.com/watch?v=${videoId}&t=${currentTime}`,
        createdAt: new Date().toISOString()
      }
    }, (response) => {
      if (response && response.success) {
        showHighlightSavedNotification(timestampFormatted);
      }
    });

    return { success: true, timestamp: timestampFormatted };

  } catch (error) {
    console.error('[Highlight] Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Show highlight modal for user to add a note
 */
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
            <p style="margin: 4px 0 0; color: #888; font-size: 13px;">at ${data.timestampFormatted}</p>
          </div>
        </div>
        
        <p style="color: #ccc; font-size: 13px; margin-bottom: 12px; line-height: 1.4;">
          ${data.videoTitle.substring(0, 60)}${data.videoTitle.length > 60 ? '...' : ''}
        </p>
        
        <textarea 
          id="highlight-note" 
          placeholder="Add a note about this highlight (optional)..."
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
          ">Save Highlight</button>
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

/**
 * Get transcript text around a specific timestamp
 */
async function getTranscriptForTimestamp(timestamp, windowSeconds = 30) {
  // Check if transcript panel is already open
  let transcriptPanel = document.querySelector('ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]');

  if (!transcriptPanel) {
    // Try to open transcript
    const transcriptButton = document.querySelector('button[aria-label*="transcript" i], button[aria-label*="Show transcript" i]');
    if (transcriptButton) {
      transcriptButton.click();
      await new Promise(r => setTimeout(r, 1500));
      transcriptPanel = document.querySelector('ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]');
    }
  }

  if (!transcriptPanel) {
    return null;
  }

  // Get transcript segments
  const segments = transcriptPanel.querySelectorAll('ytd-transcript-segment-renderer');
  if (!segments.length) return null;

  const relevantText = [];
  const startTime = Math.max(0, timestamp - windowSeconds / 2);
  const endTime = timestamp + windowSeconds / 2;

  segments.forEach(segment => {
    const timestampEl = segment.querySelector('.segment-timestamp');
    const textEl = segment.querySelector('.segment-text');

    if (timestampEl && textEl) {
      const timeText = timestampEl.textContent.trim();
      const [mins, secs] = timeText.split(':').map(Number);
      const segmentTime = mins * 60 + secs;

      if (segmentTime >= startTime && segmentTime <= endTime) {
        relevantText.push(textEl.textContent.trim());
      }
    }
  });

  return relevantText.length > 0 ? relevantText.join(' ') : null;
}

/**
 * Show notification when highlight is saved
 */
function showHighlightSavedNotification(timestamp) {
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
  notification.innerHTML = `✨ Highlight saved at ${timestamp}`;
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

// Keyboard shortcut: press "h" to save a highlight in active sessions.
document.addEventListener('keydown', (e) => {
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) || document.activeElement.isContentEditable) {
    return;
  }

  if (e.key.toLowerCase() !== 'h' || e.ctrlKey || e.metaKey || e.altKey) {
    return;
  }

  e.preventDefault();
  if (sessionActive) {
    createVideoHighlight();
    return;
  }

  chrome.storage.local.get('sessionActive', (d) => {
    if (d.sessionActive) {
      createVideoHighlight();
    } else {
      showErrorOverlay('Start a session to save highlights!');
    }
  });
});

// ===== NAVIGATOR AGENT: Chapters Feature =====

function injectChaptersButton() {
  // 1. Check if button already exists
  if (document.getElementById('tubefocus-chapters-btn')) return;

  // 2. Find injection target (YouTube's action bar near Like/Share)
  // #top-level-buttons-computed is the standard container for Like, Share, etc.
  // Also try #actions-inner or #flexible-item-buttons for robustness
  const actionsBar = document.querySelector('#top-level-buttons-computed') ||
    document.querySelector('.ytd-menu-renderer');

  if (!actionsBar) return; // Not ready yet

  // 3. Create Button
  const btn = document.createElement('button');
  btn.id = 'tubefocus-chapters-btn';
  btn.className = 'tubefocus-chapters-btn';
  btn.innerHTML = `
    <span style="font-size: 18px; margin-right: 6px;">📑</span>
    <span>Chapters</span>
  `;

  // 4. Inject
  // Try to insert as first child to be visible
  actionsBar.insertBefore(btn, actionsBar.firstChild);

  // 5. Add Click Listener
  btn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent YT navigation
    toggleChaptersPanel();
  });
  console.log('[Navigator] Chapters button injected');
}

// Hook into the main loop to ensure button persists
// We'll append this check to tryScore or// Inject Buttons (Chapters + Save) seamlessly
function injectTubeFocusButtons() {
  const actionsRow = document.querySelector('#top-level-buttons-computed');
  if (!actionsRow) return;

  // 1. Inject Chapters Button
  if (!document.getElementById('tubefocus-chapters-btn')) {
    const btn = createYouTubeButton('tubefocus-chapters-btn', 'Chapters',
      `<path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"></path>`
    );
    btn.addEventListener('click', async () => {
      const vid = new URLSearchParams(window.location.search).get('v');
      if (!vid) return;
      const txt = btn.querySelector('.yt-spec-button-shape-next__button-text-content');
      const originalText = txt.innerText;
      txt.innerText = 'Loading...';
      try {
        const r = await new Promise(resolve => chrome.runtime.sendMessage({ type: 'GET_CHAPTERS', videoId: vid }, resolve));
        if (r.success && r.result && r.result.chapters) showChaptersUI(r.result.chapters);
        else alert('No chapters found.');
      } catch (e) { console.error(e); } finally { txt.innerText = originalText; }
    });
    actionsRow.insertBefore(btn, actionsRow.firstChild);
  }

  // 2. Inject unified Save button.
  if (!document.getElementById('tubefocus-save-btn')) {
    const saveBtn = createYouTubeButton('tubefocus-save-btn', 'Save to Library',
      `<path d="M17 3H5a2 2 0 0 0-2 2v14l8-3.2L19 19V5a2 2 0 0 0-2-2zm0 13.05-6-2.4-6 2.4V5h12v11.05z"></path>`
    );
    saveBtn.addEventListener('click', handleSaveVideoToLibrary);
    actionsRow.insertBefore(saveBtn, actionsRow.firstChild);
  }

  // 3. Inject Gemini summary save button.
  if (!document.getElementById('tubefocus-summary-btn')) {
    const summaryBtn = createYouTubeButton('tubefocus-summary-btn', 'Save Summary',
      `<path d="M4 4h16v10H7l-3 3V4zm3 3v2h10V7H7zm0 3v2h7v-2H7z"></path>`
    );
    summaryBtn.addEventListener('click', handleSaveGeminiSummary);
    const saveBtn = document.getElementById('tubefocus-save-btn');
    if (saveBtn) {
      actionsRow.insertBefore(summaryBtn, saveBtn.nextSibling);
    } else {
      actionsRow.insertBefore(summaryBtn, actionsRow.firstChild);
    }
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

function setActionButtonState(buttonId, label) {
  const btn = document.getElementById(buttonId);
  if (!btn) return null;
  const textNode = btn.querySelector('.yt-spec-button-shape-next__button-text-content');
  if (!textNode) return null;
  const previous = textNode.innerText;
  textNode.innerText = label;
  return () => {
    textNode.innerText = previous;
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

async function handleSaveVideoToLibrary() {
  const restore = setActionButtonState('tubefocus-save-btn', 'Saving...');
  try {
    const context = await getVideoContext();
    if (!context) {
      showToast('Could not find this video.', true);
      return;
    }

    const transcriptResult = await scrapeTranscriptFromYouTube();
    const transcript = transcriptResult?.success ? transcriptResult.transcript : '';

    let description = '';
    if (!transcript) {
      description = window.prompt('Transcript is unavailable. Add a short description to save this video link:') || '';
      description = description.trim();
      if (!description) {
        showToast('Save cancelled. Description is required without transcript.', true);
        return;
      }
    }

    const saveResponse = await new Promise(resolve => {
      chrome.runtime.sendMessage({
        type: 'LIBRARIAN_SAVE_ITEM',
        video_id: context.videoId,
        title: context.title,
        goal: context.goal,
        score: context.score,
        video_url: context.videoUrl,
        transcript,
        description
      }, resolve);
    });

    if (saveResponse?.success) {
      const mode = saveResponse.save_mode === 'transcript' ? 'with transcript' : 'as link + description';
      showToast(`Saved ${mode}.`);
    } else {
      showToast(saveResponse?.error || 'Failed to save video.', true);
    }
  } catch (e) {
    console.error('Save to library failed:', e);
    showToast('Error saving video.', true);
  } finally {
    if (restore) restore();
  }
}

async function handleSaveGeminiSummary() {
  const restore = setActionButtonState('tubefocus-summary-btn', 'Saving summary...');
  try {
    const context = await getVideoContext();
    if (!context) {
      showToast('Could not find this video.', true);
      return;
    }

    const summaryResult = await scrapeSummaryFromYouTubeAskPanel();
    if (!summaryResult?.success || !summaryResult.summary) {
      showToast(summaryResult?.error || 'Failed to capture YouTube summary.', true);
      return;
    }

    const summaryResponse = await new Promise(resolve => {
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

    if (summaryResponse?.success) {
      showToast('YouTube summary saved.');
    } else {
      showToast(summaryResponse?.error || 'Failed to save summary.', true);
    }
  } catch (e) {
    console.error('Summary save failed:', e);
    showToast('Error saving summary.', true);
  } finally {
    if (restore) restore();
  }
}

function createYouTubeButton(id, label, iconPath) {
  const btn = document.createElement('button');
  btn.id = id;
  btn.className = 'yt-spec-button-shape-next yt-spec-button-shape-next--tonal yt-spec-button-shape-next--mono yt-spec-button-shape-next--size-m';
  btn.setAttribute('aria-label', label);
  btn.style.cssText = `margin-right: 8px; display: inline-flex; align-items: center; cursor: pointer; border: none; outline: none;`;
  btn.innerHTML = `
    <div class="yt-spec-button-shape-next__icon" style="margin-right: 6px; display: flex; align-items: center;">
      <svg height="24" viewBox="0 0 24 24" width="24" focusable="false" style="pointer-events: none; display: block; width: 100%; height: 100%; fill: currentColor;">
        ${iconPath}
      </svg>
    </div>
    <div class="yt-spec-button-shape-next__button-text-content">${label}</div>
  `;
  return btn;
}

// Hook into loop
setInterval(injectTubeFocusButtons, 2000);

function showChaptersUI(chapters) {
  // Simple overlay for chapters
  let chest = document.getElementById('tubefocus-chapters-overlay');
  if (chest) chest.remove();

  chest = document.createElement('div');
  chest.id = 'tubefocus-chapters-overlay';
  chest.style.cssText = `
        position: fixed;
        right: 20px;
        top: 80px;
        width: 300px;
        background: rgba(30,30,30,0.95);
        backdrop-filter: blur(10px);
        color: white;
        padding: 15px;
        border-radius: 12px;
        z-index: 9999;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        font-family: 'Roboto', sans-serif;
        max-height: 80vh;
        overflow-y: auto;
        border: 1px solid rgba(255,255,255,0.1);
    `;

  let html = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:10px;">
            <h3 style="margin:0; font-size:16px;">Video Chapters</h3>
            <button id="close-chapters" style="background:none; border:none; color:white; cursor:pointer; font-size:20px;">×</button>
        </div>
        <div class="chapters-list">
    `;

  chapters.forEach(c => {
    html += `
            <div class="chapter-item" style="display:flex; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.05); cursor:pointer;">
                <span style="color:#3ea6ff; font-weight:bold; width:50px; flex-shrink:0;">${c.time}</span>
                <span style="opacity:0.9;">${c.title}</span>
            </div>
        `;
  });

  html += '</div>';
  chest.innerHTML = html;
  document.body.appendChild(chest);

  // Close handler
  document.getElementById('close-chapters').onclick = () => chest.remove();

  // Click handlers
  chest.querySelectorAll('.chapter-item').forEach((row, idx) => {
    row.onclick = () => {
      const timeStr = chapters[idx].time; // "MM:SS" or "H:MM:SS"
      const parts = timeStr.split(':').map(Number);
      let seconds = 0;
      if (parts.length === 3) seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
      else seconds = parts[0] * 60 + parts[1];

      document.querySelector('video').currentTime = seconds;
      chest.remove();
    };
  });
}

// Fetch Auditor Verification
async function fetchAuditorVerdict(videoId, title, goal) {
  if (!videoId || !goal) return;

  console.log('[Auditor] Fetching verdict...');
  try {
    const r = await new Promise(resolve => chrome.runtime.sendMessage({
      type: 'AUDIT_VIDEO',
      videoId, title, goal
    }, resolve));

    if (r.success && r.analysis) {
      updateScoreWithVerdict(r.analysis);
    }
  } catch (e) {
    console.error('[Auditor] Failed:', e);
  }
}

function updateScoreWithVerdict(analysis) {
  if (!scoreDisplay) return;

  const verdict = analysis.community_verdict;
  const badge = analysis.verdict_badge;

  // Append to score display
  const verdictDiv = document.createElement('div');
  verdictDiv.style.cssText = `
        font-size: 10px;
        margin-top: 4px;
        padding-top: 4px;
        border-top: 1px solid rgba(255,255,255,0.2);
        opacity: 0.9;
    `;
  verdictDiv.innerHTML = `
        <span style="font-weight:bold;">${badge}</span> (${verdict}%)
    `;
  scoreDisplay.appendChild(verdictDiv);
}

let chaptersPanel = null;

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

  // Get Video ID
  const m = location.href.match(/[?&]v=([^&]+)/);
  if (!m) {
    container.innerHTML = '<div class="chapters-loading">No video found</div>';
    return;
  }
  const videoId = m[1];

  container.innerHTML = `
    <div class="chapters-loading">
      <div class="spinner" style="display:inline-block; border-left-color: #3ea6ff;"></div>
      <div style="margin-top:10px">Navigator extracts wisdom...</div>
    </div>
  `;
  footer.style.display = 'none';

  try {
    // Call Background -> API
    // Request chapters through background -> backend.
    chrome.runtime.sendMessage({
      type: 'GET_CHAPTERS',
      videoId: videoId
    }, (response) => {

      if (chrome.runtime.lastError) {
        container.innerHTML = `<div class="chapters-loading" style="color:#ff8a80">Error: ${chrome.runtime.lastError.message}</div>`;
        return;
      }

      if (response && response.error) {
        container.innerHTML = `<div class="chapters-loading" style="color:#ff8a80">Error: ${response.error}</div>`;
        return;
      }

      if (!response || !response.result) {
        container.innerHTML = `<div class="chapters-loading">No chapters found.</div>`;
        return;
      }

      const result = response.result;
      renderChapters(result.chapters, result.source);
    });

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

  let html = '';
  chapters.forEach(chapter => {
    // Parse time to seconds for seeking
    let seconds = 0;
    const parts = chapter.time.split(':').reverse();
    if (parts[0]) seconds += parseInt(parts[0]);
    if (parts[1]) seconds += parseInt(parts[1]) * 60;
    if (parts[2]) seconds += parseInt(parts[2]) * 3600;

    html += `
      <div class="chapter-item" onclick="document.querySelector('video').currentTime = ${seconds};">
        <div class="chapter-time">${chapter.time}</div>
        <div class="chapter-title">${chapter.title}</div>
      </div>
    `;
  });

  container.innerHTML = html;

  // Update footer with source info
  let sourceText = 'Source: Unknown';
  let sourceIcon = '❓';

  if (source === 'comments') {
    sourceText = 'Extracted from Community Comments';
    sourceIcon = '💬';
  } else if (source === 'ai_generated') {
    sourceText = 'Generated by AI from Transcript';
    sourceIcon = '🤖';
  }

  footer.innerHTML = `<span>${sourceIcon}</span> <span>${sourceText}</span>`;
  footer.style.display = 'flex';
}

// ===== LOCAL RECOMMENDATION FILTER =====

const recommendationDecisionCache = new Map();
let gatekeeperObserver = null;
let scanTimeout = null;
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
  const titleSpan = element.querySelector('#video-title');

  if (!anchor || !titleSpan) return null;
  const href = anchor.getAttribute('href') || '';
  const idMatch = href.match(/[?&]v=([^&]+)/);
  if (!idMatch) return null;

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
  recommendation.element.setAttribute('data-tubefocus-filtered', '1');
}

function queueVisibleRecommendations() {
  if (!sessionActive) return;
  document.querySelectorAll('ytd-compact-video-renderer').forEach(processSidebarItem);
}

function scheduleBatchProcessing() {
  if (scanTimeout) clearTimeout(scanTimeout);
  scanTimeout = setTimeout(queueVisibleRecommendations, 150);
}

function clearGatekeeperDecorations() {
  recommendationDecisionCache.clear();
  document.querySelectorAll('.tubefocus-filter-hidden').forEach((el) => {
    el.classList.remove('tubefocus-filter-hidden');
  });
  document.querySelectorAll('[data-tubefocus-filtered="1"]').forEach((el) => {
    el.removeAttribute('data-tubefocus-filtered');
    el.removeAttribute('data-tubefocus-score');
  });
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
