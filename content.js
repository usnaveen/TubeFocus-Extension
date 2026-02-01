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
    const highlight = await showHighlightModal({
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
function showHighlightModal(data) {
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

// Listen for 'h' key to trigger highlight
document.addEventListener('keydown', (e) => {
  // Ignore if typing in an input text area
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) || document.activeElement.isContentEditable) {
    return;
  }

  if (e.key.toLowerCase() === 'h') {
    e.preventDefault();
    // Check if session is active via a variable we can access or storage
    // We can check the `sessionActive` variable which is global in this file
    if (typeof sessionActive !== 'undefined' && sessionActive) {
      showHighlightModal();
    } else {
      // Fallback or check storage if variable is not reliable
      chrome.storage.local.get('sessionActive', (d) => {
        if (d.sessionActive) showHighlightModal();
        else showErrorOverlay('Start a session to save highlights!');
      });
    }
  }
});

function showHighlightModal() {
  // Remove existing if any
  const existing = document.getElementById('tubefocus-highlight-modal');
  if (existing) existing.remove();

  // Get current timestamp text
  const video = document.querySelector('video');
  const timestamp = video ? video.currentTime : 0;

  // Create Modal
  const modal = document.createElement('div');
  modal.id = 'tubefocus-highlight-modal';

  // Fetch theme
  chrome.storage.local.get(['selectedTheme'], (prefs) => {
    const theme = prefs.selectedTheme || 'crimson-vanilla';

    // Theme map
    const themes = {
      'crimson-vanilla': { panel: '#d41b2a', bg: '#c1121f', text: '#fdf0d5', accent: '#fdf0d5', border: '#a80f1a' },
      'vanilla-crimson': { panel: '#fff7ed', bg: '#fdf0d5', text: '#c1121f', accent: '#c1121f', border: '#a80f1a' },
      'darkreader': { panel: '#32454e', bg: '#181e22', text: '#ddd', accent: '#cc785c', border: '#101417' },
      // Minimal fallback
    };

    // Fallback dictionary or use current choice
    const t = themes[theme] || themes['crimson-vanilla'];

    modal.style.cssText = `
      position: fixed;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      background: ${t.panel};
      color: ${t.text};
      border: 2px solid ${t.border};
      padding: 24px;
      border-radius: 12px;
      z-index: 2147483647;
      width: 400px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.5);
      font-family: 'Roboto Mono', monospace;
      animation: popIn 0.2s ease-out;
    `;

    modal.innerHTML = `
      <style>
        @keyframes popIn { from { opacity: 0; transform: translate(-50%, -45%); } to { opacity: 1; transform: translate(-50%, -50%); } }
        .tf-h-title { font-size: 1.2rem; font-weight: bold; color: ${t.accent}; margin-bottom: 12px; }
        .tf-h-textarea { 
          width: 100%; height: 80px; 
          background: ${t.bg}; color: ${t.text}; 
          border: 1px solid ${t.border}; 
          padding: 8px; border-radius: 6px; 
          font-family: inherit; margin-bottom: 12px;
        }
        .tf-h-textarea:focus { outline: 2px solid ${t.accent}; }
        .tf-actions { display: flex; justify-content: flex-end; gap: 8px; }
        .tf-btn { border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: bold; }
        .tf-btn-save { background: ${t.accent}; color: ${t.panel}; }
        .tf-btn-cancel { background: transparent; color: ${t.text}; border: 1px solid ${t.border}; }
      </style>
      <div class="tf-h-title">💾 Save Highlight</div>
      <div style="font-size:0.9rem; margin-bottom:8px; opacity:0.8;">Saving timestamp: ${Math.floor(timestamp)}s</div>
      <textarea class="tf-h-textarea" id="tf-note" placeholder="Add a note (optional)..."></textarea>
      <div class="tf-actions">
        <button class="tf-btn tf-btn-cancel" id="tf-cancel">Cancel</button>
        <button class="tf-btn tf-btn-save" id="tf-save">Save</button>
      </div>
    `;

    document.body.appendChild(modal);

    // Focus textarea
    setTimeout(() => document.getElementById('tf-note').focus(), 50);

    // Handlers
    document.getElementById('tf-cancel').onclick = () => modal.remove();
    document.getElementById('tf-save').onclick = () => {
      const note = document.getElementById('tf-note').value;
      saveHighlight(timestamp, note);
      modal.remove();
    };
  });
}

function saveHighlight(timestamp, note) {
  // Send to backend via background
  const m = location.href.match(/[?&]v=([^&]+)/);
  // Find lastVideoId if we can, or just use m[1]
  const videoId = m ? m[1] : (window.taskId || 'unknown');
  const title = document.title.replace(' - YouTube', '');

  chrome.runtime.sendMessage({
    type: 'INDEX_VIDEO',
    data: {
      video_id: videoId,
      title: title,
      transcript: note,
      goal: window.userGoal || 'Highlight',
      score: window.currentScore || 0,
      metadata: {
        type: 'highlight',
        timestamp: timestamp,
        note: note,
        video_url: location.href
      }
    }
  }, (response) => {
    if (response && response.success) {
      showErrorOverlay('Highlight Saved! ✅');
    } else {
      showErrorOverlay('Highlight Saved locally (offline).');
    }
  });
}
