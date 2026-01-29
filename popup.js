// popup.js

// --- DOM references ---
const goalInput      = document.getElementById('goalInput');
const sessionDurationInput = document.getElementById('sessionDuration');
const startBtn       = document.getElementById('startSession');
const stopBtn        = document.getElementById('stopSession');
const summaryMessage = document.getElementById('summaryMessage');
const chartCanvas    = document.getElementById('scoreChart').getContext('2d');

// Coach stats elements
const videosWatchedEl = document.getElementById('videosWatched');
const averageScoreEl = document.getElementById('averageScore');
const currentScoreEl = document.getElementById('currentScore');
const sessionStatusEl = document.getElementById('sessionStatus');
const watchTimeEl = document.getElementById('watchTime');
const coachMessageEl = document.getElementById('coachMessage');
const coachTextEl = document.getElementById('coachText');
const coachModeSelect = document.getElementById('coachMode');
const customInstructionsContainer = document.getElementById('customInstructionsContainer');
const coachInstructionsInput = document.getElementById('coachInstructions');

// Save video and highlight buttons
const saveVideoButton = document.getElementById('saveVideoButton');
const saveVideoStatus = document.getElementById('saveVideoStatus');
const highlightButton = document.getElementById('highlightButton');

const toggleOnBtn    = document.getElementById('toggleOn');
const toggleOffBtn   = document.getElementById('toggleOff');
const tabs           = document.querySelectorAll('.tabs button');
const sections       = document.querySelectorAll('section');



const shareHistoryToggle = document.getElementById('shareHistoryToggle');
const themeSelector = document.getElementById('themeSelector');

// --- Positive / negative feedback arrays ---
const positiveMsgs = [
    "Incredible focus! You're on a roll.",
    "Amazing work! You're making real progress toward your goal.",
    "That was a masterclass in concentration. Bravo!",
    "Your dedication is paying off. Keep up the great work!",
    "Excellent session! You stayed right on target.",
    "Productivity level: Expert. Well done!",
    "You're a learning machine! Nothing can stop you.",
    "You're crushing your goals. Awesome job!",
    "Your focus is inspiring. Keep that momentum going!",
    "Top-tier performance! You should be proud of this session."
];
const negativeMsgs = [
    "A little scattered, but every step is part of the journey. Let's refocus.",
    "It seems you got a bit sidetracked. Let's try to stick to the goal next time.",
    "Not every session is perfect. What can we improve for the next one?",
    "A challenging session, but don't give up. The next one will be better.",
    "Focus is a muscle. Let's keep training it together.",
    "Okay, let's analyze what happened and come back stronger.",
    "Remember your goal. Let's aim for higher scores next time.",
    "Don't be discouraged. Learning has its ups and downs.",
    "A slight detour, but the destination is still the same. You can do it.",
    "Let's tighten up the focus for the next session. You've got this."
];
// --- END OF ARRAYS ---

// --- Chart.js setup ---
let scoreChart;
function initChart(labels = [], data = []) {
  if (scoreChart) scoreChart.destroy();
  scoreChart = new Chart(chartCanvas, {
    type: 'line',
    data: {
      labels, 
      datasets: [{ 
        label: 'Score per Video', 
        data, 
        fill: false, 
        borderWidth: 2, 
        borderColor: 'rgba(204, 120, 92, 1)',
        pointBackgroundColor: 'rgba(204, 120, 92, 1)',
        pointBorderColor: 'rgba(204, 120, 92, 1)',
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 2,
      scales: {
        x: { 
            title: { 
              display: true, 
              text: 'Video #',
              color: '#ddd',
              font: { size: 10 }
            },
            ticks: { 
              color: '#ddd',
              font: { size: 9 }
            },
            grid: { color: 'rgba(75, 108, 121, 0.3)' }
        },
        y: { 
            title: { 
              display: true, 
              text: 'Score', 
              color: '#ddd',
              font: { size: 10 }
            }, 
            min: 0, 
            max: 100,
            ticks: { 
              color: '#ddd',
              font: { size: 9 },
              stepSize: 20,
              callback: function(value) {
                return value + '%';
              }
            },
            grid: { color: 'rgba(75, 108, 121, 0.3)' }
        }
      },
      plugins: {
          legend: {
              display: false
          }
      }
    }
  });
}

// --- Utility: send message to content.js (no alerts) ---
function sendToContent(message) {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    const id = tabs[0]?.id;
    if (!id) {
      console.warn('No active YouTube tab found.');
      return;
    }
    
    // Check if we're on a YouTube page before sending message
    const url = tabs[0]?.url || '';
    if (!url.includes('youtube.com')) {
      console.log('Not on YouTube page, skipping message send');
      return;
    }
    
    chrome.tabs.sendMessage(id, message, () => {
      if (chrome.runtime.lastError) {
        // This is expected if the content script is not loaded (e.g., not a YouTube tab)
        console.log('[popup.js] Content script not available:', chrome.runtime.lastError.message);
      }
    });
  });
}

// --- Utility: get the current tab’s videoId ---
function getCurrentVideoId(cb) {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    const url = tabs[0]?.url || '';
    const m = url.match(/[?&]v=([^&]+)/);
    cb(m ? m[1] : null);
  });
}

// --- Tab switching logic ---
tabs.forEach(btn => {
  btn.addEventListener('click', () => {
    console.log('Tab clicked:', btn.dataset.tab);
    tabs.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    sections.forEach(s => s.classList.remove('active'));
    const targetSection = document.getElementById(btn.dataset.tab);
    if (targetSection) {
      targetSection.classList.add('active');
      console.log('Activated section:', btn.dataset.tab);
    } else {
      console.error('Section not found:', btn.dataset.tab);
    }
    if (btn.dataset.tab === 'summary') renderSummary();
  });
});

const timerDisplay = document.getElementById('timerDisplay');
let timerInterval = null;

// --- Centralized UI Update ---
function updateUI(state) {
  const { sessionActive, goal, sessionEndTime, coachMode } = state;

  startBtn.disabled = sessionActive;
  stopBtn.disabled = !sessionActive;
  goalInput.value = goal || '';
  
  // Update coach mode if provided
  if (coachMode && coachModeSelect) {
    coachModeSelect.value = coachMode;
  }

  toggleOnBtn.classList.toggle('active', sessionActive);
  toggleOffBtn.classList.toggle('active', !sessionActive);

  const timerDisplayEl = document.getElementById('timerDisplay');
  if (sessionActive && sessionEndTime) {
    timerDisplayEl.classList.remove('emoji');
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((sessionEndTime - Date.now()) / 1000));
      const minutes = Math.floor(remaining / 60).toString().padStart(2, '0');
      const seconds = (remaining % 60).toString().padStart(2, '0');
      timerDisplayEl.textContent = `${minutes}:${seconds}`;
      if (remaining <= 0) {
        clearInterval(timerInterval);
        timerDisplayEl.textContent = '';
      }
    }, 1000);
  } else {
    if (timerInterval) clearInterval(timerInterval);
    timerDisplayEl.textContent = '⏳';
    timerDisplayEl.classList.add('emoji');
  }

  getCurrentVideoId(videoId => {
    if (!videoId) {
      if (currentScoreEl) currentScoreEl.textContent = '–';
      return;
    }
    chrome.storage.local.get(['lastVideoId', 'currentScore'], s => {
      if (s.lastVideoId === videoId && s.currentScore != null) {
        // Handle both decimal (0.52) and percentage (52) formats
        const score = s.currentScore;
        const percentage = score > 1 ? score : (score * 100);
        if (currentScoreEl) currentScoreEl.textContent = percentage.toFixed(1) + '%';
      } else {
        if (currentScoreEl) currentScoreEl.textContent = '–';
      }
    });
  });
  
  // Update session stats
  updateSessionStats(state);
}

// --- Update Session Stats (Coach) ---
function updateSessionStats(prefs) {
  const watchedScores = prefs.watchedScores || [];
  const sessionActive = prefs.sessionActive || false;
  
  // Update video count
  videosWatchedEl.textContent = watchedScores.length;
  
  // Update average score
  if (watchedScores.length > 0) {
    const avg = watchedScores.reduce((a, b) => a + b, 0) / watchedScores.length;
    // Handle both decimal and percentage formats
    const avgPercentage = avg > 1 ? avg : (avg * 100);
    averageScoreEl.textContent = avgPercentage.toFixed(1) + '%';
    
    // Color code based on average
    if (avgPercentage >= 70) {
      averageScoreEl.style.color = '#4ade80';
    } else if (avgPercentage >= 50) {
      averageScoreEl.style.color = '#fbbf24';
    } else {
      averageScoreEl.style.color = '#f87171';
    }
  } else {
    averageScoreEl.textContent = '–';
    averageScoreEl.style.color = '';
  }
  
  // Update current score
  if (prefs.currentScore != null) {
    const score = prefs.currentScore;
    const percentage = score > 1 ? score : (score * 100);
    currentScoreEl.textContent = percentage.toFixed(1) + '%';
  } else {
    currentScoreEl.textContent = '–';
  }
  
  // Update session status
  if (sessionActive) {
    sessionStatusEl.classList.add('active');
    sessionStatusEl.classList.remove('inactive');
    sessionStatusEl.title = 'Session Active';
  } else {
    sessionStatusEl.classList.add('inactive');
    sessionStatusEl.classList.remove('active');
    sessionStatusEl.title = 'No Active Session';
  }
}

// --- Coach Mode Handler ---
if (coachModeSelect) {
  coachModeSelect.addEventListener('change', () => {
    const mode = coachModeSelect.value;
    if (mode === 'custom') {
      customInstructionsContainer.style.display = 'block';
    } else {
      customInstructionsContainer.style.display = 'none';
    }
    // Save preference
    chrome.storage.local.set({ coachMode: mode });
  });
}

// --- Highlight Button Handler ---
if (highlightButton) {
  highlightButton.addEventListener('click', async () => {
    console.log('[Highlight] Button clicked');
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.url || !tab.url.includes('youtube.com/watch')) {
        saveVideoStatus.textContent = '❌ Not on a YouTube video page';
        saveVideoStatus.style.color = '#ef4444';
        setTimeout(() => { saveVideoStatus.textContent = ''; }, 3000);
        return;
      }
      
      // Send message to content script to capture current timestamp and open highlight modal
      chrome.tabs.sendMessage(tab.id, { type: 'CREATE_HIGHLIGHT' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('[Highlight] Error:', chrome.runtime.lastError);
          saveVideoStatus.textContent = '❌ Could not create highlight';
          saveVideoStatus.style.color = '#ef4444';
        } else if (response && response.success) {
          saveVideoStatus.textContent = '✅ Highlight saved!';
          saveVideoStatus.style.color = '#10b981';
        }
        setTimeout(() => { saveVideoStatus.textContent = ''; }, 3000);
      });
      
    } catch (error) {
      console.error('[Highlight] Error:', error);
      saveVideoStatus.textContent = '❌ Error creating highlight';
      saveVideoStatus.style.color = '#ef4444';
      setTimeout(() => { saveVideoStatus.textContent = ''; }, 3000);
    }
  });
}

// --- Save Video to Library Handler ---
if (saveVideoButton) {
  saveVideoButton.addEventListener('click', async () => {
    console.log('[Save Video] Button clicked');
    
    // Disable button during processing
    saveVideoButton.disabled = true;
    saveVideoStatus.textContent = '⏳ Extracting transcript...';
    saveVideoStatus.style.color = '#3b82f6';
    
    try {
      // Get current tab (should be YouTube)
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.url || !tab.url.includes('youtube.com/watch')) {
        saveVideoStatus.textContent = '❌ Not on a YouTube video page';
        saveVideoStatus.style.color = '#ef4444';
        setTimeout(() => {
          saveVideoStatus.textContent = '';
          saveVideoButton.disabled = false;
        }, 3000);
        return;
      }
      
      // Extract video ID from URL
      const videoIdMatch = tab.url.match(/[?&]v=([^&]+)/);
      if (!videoIdMatch) {
        saveVideoStatus.textContent = '❌ Could not extract video ID';
        saveVideoStatus.style.color = '#ef4444';
        setTimeout(() => {
          saveVideoStatus.textContent = '';
          saveVideoButton.disabled = false;
        }, 3000);
        return;
      }
      
      const videoId = videoIdMatch[1];
      console.log('[Save Video] Video ID:', videoId);
      
      // Request transcript scraping from content script
      chrome.tabs.sendMessage(tab.id, { type: 'SCRAPE_TRANSCRIPT' }, async (response) => {
        if (chrome.runtime.lastError) {
          console.error('[Save Video] Error:', chrome.runtime.lastError);
          saveVideoStatus.textContent = '❌ Error communicating with page';
          saveVideoStatus.style.color = '#ef4444';
          setTimeout(() => {
            saveVideoStatus.textContent = '';
            saveVideoButton.disabled = false;
          }, 3000);
          return;
        }
        
        if (!response || !response.success) {
          saveVideoStatus.textContent = `❌ ${response?.error || 'Failed to extract transcript'}`;
          saveVideoStatus.style.color = '#ef4444';
          setTimeout(() => {
            saveVideoStatus.textContent = '';
            saveVideoButton.disabled = false;
          }, 5000);
          return;
        }
        
        console.log('[Save Video] Transcript scraped:', response.charCount, 'chars');
        saveVideoStatus.textContent = `✓ Extracted ${response.segmentCount} segments. Saving...`;
        
        // Get current goal
        chrome.storage.local.get(['goal', 'currentScore'], async (prefs) => {
          const goal = prefs.goal || 'General learning';
          const score = prefs.currentScore || 50;
          
          // Send to Librarian for indexing
          chrome.runtime.sendMessage({
            type: 'LIBRARIAN_INDEX',
            videoId: videoId,
            title: tab.title.replace(' - YouTube', ''),
            transcript: response.transcript,
            goal: goal,
            score: score
          }, (indexResponse) => {
            if (chrome.runtime.lastError) {
              console.error('[Save Video] Index error:', chrome.runtime.lastError);
              saveVideoStatus.textContent = '❌ Failed to save to library';
              saveVideoStatus.style.color = '#ef4444';
            } else if (indexResponse && indexResponse.success) {
              saveVideoStatus.textContent = '✅ Saved to library!';
              saveVideoStatus.style.color = '#10b981';
              
              // Refresh librarian stats
              loadLibrarianStats();
            } else {
              saveVideoStatus.textContent = '❌ Failed to index video';
              saveVideoStatus.style.color = '#ef4444';
            }
            
            // Re-enable button
            setTimeout(() => {
              saveVideoStatus.textContent = '';
              saveVideoButton.disabled = false;
            }, 3000);
          });
        });
      });
      
    } catch (error) {
      console.error('[Save Video] Error:', error);
      saveVideoStatus.textContent = '❌ Unexpected error';
      saveVideoStatus.style.color = '#ef4444';
      setTimeout(() => {
        saveVideoStatus.textContent = '';
        saveVideoButton.disabled = false;
      }, 3000);
    }
  });
}

// --- Initialize UI & Listen for Changes ---
chrome.storage.local.get(['sessionActive', 'goal', 'coachMode', 'coachInstructions', 'sessionEndTime', 'selectedTheme', 'watchedScores', 'showSummaryOnOpen', 'totalWatchTime'], (prefs) => {
  updateUI(prefs);

  // Initialize coach mode
  if (prefs.coachMode && coachModeSelect) {
    coachModeSelect.value = prefs.coachMode;
    if (prefs.coachMode === 'custom') {
      customInstructionsContainer.style.display = 'block';
    }
  }
  if (prefs.coachInstructions && coachInstructionsInput) {
    coachInstructionsInput.value = prefs.coachInstructions;
  }
  
  // Update watch time display
  if (watchTimeEl && prefs.totalWatchTime) {
    const mins = Math.floor(prefs.totalWatchTime / 60);
    watchTimeEl.textContent = `${mins}m`;
  }

  // Initialize theme
  const theme = prefs.selectedTheme || 'crimson-vanilla';
  document.documentElement.setAttribute('data-theme', theme);
  themeSelector.value = theme;
  
  // If session just ended and there are scores to show, switch to summary tab
  if (!prefs.sessionActive && prefs.watchedScores && prefs.watchedScores.length > 0 && prefs.showSummaryOnOpen) {
    const summaryTab = document.querySelector('[data-tab="summary"]');
    if (summaryTab) {
      summaryTab.click();
      renderSummary();
    }
    // Clear the flag so we don't show summary every time popup opens
    chrome.storage.local.set({ showSummaryOnOpen: false });
  }
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    chrome.storage.local.get(['sessionActive', 'goal', 'coachMode', 'sessionEndTime', 'totalWatchTime'], updateUI);
  }
});

// --- Event Listeners for Toggles ---
toggleOffBtn.addEventListener('click', () => {
  chrome.storage.local.get('sessionActive', prefs => {
    if (!prefs.sessionActive) {
      // This button doesn't start a session, it just indicates the 'On' state.
      // The actual session is started via the "Start Session" button.
      toggleOnBtn.classList.add('active');
      toggleOffBtn.classList.remove('active');
    }
  });
});

// Settings modal logic
const settingsIcon = document.getElementById('settingsIcon');
const settingsPage = document.getElementById('settings');
const backToMainBtn = document.getElementById('backToMain');

let lastActiveTab = 'setup';

settingsIcon.addEventListener('click', () => {
  // Remember the last active tab
  const activeSection = document.querySelector('section.active');
  if (activeSection && activeSection.id !== 'settings') {
    lastActiveTab = activeSection.id;
  }
  // Deactivate all sections and activate settings
  document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
  settingsPage.classList.add('active');
});

backToMainBtn.addEventListener('click', () => {
  // Deactivate settings and activate the last active tab (default to setup)
  settingsPage.classList.remove('active');
  const toActivate = document.getElementById(lastActiveTab) || document.getElementById('setup');
  toActivate.classList.add('active');
});


// Theme switching functionality
themeSelector.addEventListener('change', () => {
  const selectedTheme = themeSelector.value;
  document.documentElement.setAttribute('data-theme', selectedTheme);
  chrome.storage.local.set({ selectedTheme: selectedTheme });
  chrome.runtime.sendMessage({ type: 'THEME_CHANGED', theme: selectedTheme });
});

// --- Coach Mode Initialization ---
chrome.storage.local.get(['coachMode', 'coachInstructions'], (data) => {
  if (coachModeSelect && data.coachMode) {
    coachModeSelect.value = data.coachMode;
    if (data.coachMode === 'custom') {
      customInstructionsContainer.style.display = 'block';
    }
  }
  if (coachInstructionsInput && data.coachInstructions) {
    coachInstructionsInput.value = data.coachInstructions;
  }
});

// Save custom instructions when changed
if (coachInstructionsInput) {
  coachInstructionsInput.addEventListener('blur', () => {
    chrome.storage.local.set({ coachInstructions: coachInstructionsInput.value });
  });
}

// --- Coach Message Display ---
function showCoachMessage(message, type = 'info') {
  if (!coachMessageEl || !coachTextEl) return;
  
  coachTextEl.textContent = message;
  coachMessageEl.style.display = 'block';
  
  // Style based on message type
  if (type === 'success') {
    coachMessageEl.style.borderLeftColor = '#10b981';
  } else if (type === 'warning') {
    coachMessageEl.style.borderLeftColor = '#f59e0b';
  } else if (type === 'break') {
    coachMessageEl.style.borderLeftColor = '#ef4444';
  } else {
    coachMessageEl.style.borderLeftColor = '#667eea';
  }
}

// Listen for coach messages from background
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'COACH_MESSAGE') {
    showCoachMessage(msg.message, msg.messageType);
  }
});



// --- Start Session ---
startBtn.addEventListener('click', () => {
  const goal = goalInput.value.trim();
  const duration = parseInt(sessionDurationInput.value, 10);
  if (!goal || !duration || duration < 1) return;

  // Get coach mode and instructions
  const coachMode = coachModeSelect ? coachModeSelect.value : 'balanced';
  const coachInstructions = coachInstructionsInput ? coachInstructionsInput.value : '';

  chrome.runtime.sendMessage({ 
    type: 'START_SESSION', 
    duration, 
    goal,
    coachMode,
    coachInstructions
  });
  
  // Send message to content.js to start session
  sendToContent({ type: 'START_SESSION', goal, coachMode, coachInstructions });
});

// --- Stop Session ---
stopBtn.addEventListener('click', () => {
  // The background script now handles all stop logic, including the reload.
  chrome.runtime.sendMessage({ type: 'STOP_SESSION' });
});

toggleOffBtn.addEventListener('click', () => {
  // The background script now handles all stop logic, including the reload.
  chrome.runtime.sendMessage({ type: 'STOP_SESSION' });
});

// --- Live "Current" score updates from content.js ---
chrome.runtime.onMessage.addListener(msg => {
  if (msg.type === 'NEW_SCORE') {
    // Handle both decimal (0.52) and percentage (52) formats
    const score = msg.score;
    const percentage = score > 1 ? score : (score * 100);
    if (currentScoreEl) currentScoreEl.textContent = percentage.toFixed(1) + '%';
    
    // Update coach stats
    chrome.storage.local.get(['watchedScores', 'sessionActive', 'currentScore'], (prefs) => {
      updateSessionStats(prefs);
    });
    getCurrentVideoId(videoId => {
      if (!videoId) return;
      chrome.storage.local.set({ currentScore: msg.score, lastVideoId: videoId });
    });
  } else if (msg.type === 'SHOW_SUMMARY') {
    // Switch to summary tab and ensure it renders
    const summaryTab = document.querySelector('[data-tab="summary"]');
    if (summaryTab) {
      summaryTab.click();
      // Small delay to ensure tab switch completes, then render summary
      setTimeout(() => {
        renderSummary();
      }, 100);
    }
  } else if (msg.type === 'ERROR') {
    if (currentScoreEl) {
      currentScoreEl.textContent = msg.error || 'An error occurred.';
      currentScoreEl.classList.add('error');
    }
  }
});

// --- Render session summary, chart & feedback ---
function renderSummary() {
  chrome.storage.local.get(['watchedScores', 'sessionActive'], data => {
    const scores = data.watchedScores || [];
    const sessionActive = data.sessionActive || false;
    console.log('Retrieved scores for chart:', scores, 'Session active:', sessionActive);
    
    const count = scores.length;
    
    if (count === 0) {
      // No session data to show
      if (sessionActive) {
        summaryMessage.innerHTML = `
          <div>Session in progress...</div>
          <div class="feedback">Start watching videos to see your scores!</div>
        `;
      } else {
        summaryMessage.innerHTML = `
          <div>No session data</div>
          <div class="feedback">Start a new session to track your video scores!</div>
        `;
      }
      initChart([], []); // Empty chart
      return;
    }
    
    // Handle both decimal (0.52) and percentage (52) formats for scores
    const normalizedScores = scores.map(score => score > 1 ? score / 100 : score);
    const avg = count ? (normalizedScores.reduce((a,b)=>a+b,0)/count * 100).toFixed(1) : 0;
    const msgs = avg >= 60 ? positiveMsgs : negativeMsgs;
    const feedback = msgs[Math.floor(Math.random()*msgs.length)];

    // Show different message based on session state
    const sessionStatus = sessionActive ? "Current session" : "Last session";
    summaryMessage.innerHTML = `
      <div>${sessionStatus}: ${count} videos • Avg: ${avg}%</div>
      <div class="feedback">${feedback || ''}</div>
    `;
    
    // Convert normalized scores (0-1) to percentage (0-100) for the chart
    const chartScores = normalizedScores.map(score => score * 100);
    console.log('Chart scores (normalized to 0-100):', chartScores);
    initChart(scores.map((_,i)=>i+1), chartScores);
  });
}

// ===== LIBRARIAN: History Search =====

const historySearchInput = document.getElementById('historySearch');
const searchButton = document.getElementById('searchButton');
const searchResults = document.getElementById('searchResults');
const indexedCountEl = document.getElementById('indexedCount');
const chunksCountEl = document.getElementById('chunksCount');

// Load librarian stats when History tab is opened
const historyTab = document.querySelector('[data-tab="history"]');
if (historyTab) {
  historyTab.addEventListener('click', loadLibrarianStats);
}

function loadLibrarianStats() {
  // This is a placeholder - in production, this would call the backend
  // For now, show placeholder text
  indexedCountEl.textContent = 'N/A (Backend needed)';
  chunksCountEl.textContent = 'N/A (Backend needed)';
}

if (searchButton && historySearchInput) {
  searchButton.addEventListener('click', performSearch);
  historySearchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      performSearch();
    }
  });
}

function performSearch() {
  const query = historySearchInput.value.trim();
  
  if (!query) {
    searchResults.innerHTML = `
      <div style="text-align: center; color: #f87171; font-size: 0.9em;">
        Please enter a search query
      </div>
    `;
    return;
  }
  
  searchResults.innerHTML = `
    <div style="text-align: center; color: #999; font-size: 0.9em;">
      Searching for "${query}"...
    </div>
  `;
  
  // Call backend search endpoint
  chrome.runtime.sendMessage({
    type: 'LIBRARIAN_SEARCH',
    query: query
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('[Librarian] Error:', chrome.runtime.lastError);
      searchResults.innerHTML = `
        <div style="text-align: center; color: #f87171; font-size: 0.9em;">
          Search failed. Backend may not be running.
        </div>
      `;
      return;
    }
    
    displaySearchResults(response);
  });
}

function displaySearchResults(response) {
  if (!response || !response.search_results) {
    searchResults.innerHTML = `
      <div style="text-align: center; color: #f87171; font-size: 0.9em;">
        No results found
      </div>
    `;
    return;
  }
  
  const results = response.search_results.results || [];
  
  if (results.length === 0) {
    searchResults.innerHTML = `
      <div style="text-align: center; color: #999; font-size: 0.9em;">
        No videos found matching your query.<br/>
        <span style="font-size: 0.8em;">Videos are indexed automatically as you watch them.</span>
      </div>
    `;
    return;
  }
  
  let html = `<div style="font-size: 0.85em; color: #999; margin-bottom: 8px;">Found ${results.length} results:</div>`;
  
  results.forEach(result => {
    const scoreColor = result.score >= 70 ? '#4ade80' : result.score >= 50 ? '#fbbf24' : '#f87171';
    html += `
      <div class="search-result-item">
        <div class="search-result-title">${result.title}</div>
        <div class="search-result-snippet">${result.snippet}</div>
        <div class="search-result-meta">
          <span>Goal: ${result.goal}</span>
          <span class="search-result-score" style="color: ${scoreColor};">${result.score}%</span>
        </div>
      </div>
    `;
  });
  
  searchResults.innerHTML = html;
}

