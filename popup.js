// popup.js

// --- DOM references ---
const goalInput      = document.getElementById('goalInput');
const sessionDurationInput = document.getElementById('sessionDuration');
const startBtn       = document.getElementById('startSession');
const stopBtn        = document.getElementById('stopSession');
const scoreDisplay   = document.getElementById('scoreDisplay');
const summaryMessage = document.getElementById('summaryMessage');
const chartCanvas    = document.getElementById('scoreChart').getContext('2d');
const scoreModeBtn = document.getElementById('scoreModeBtn');
const scoreModeText = document.getElementById('scoreModeText');
const scoringModeModal = document.getElementById('scoringModeModal');
const closeModal = document.getElementById('closeModal');
const applyScoringMode = document.getElementById('applyScoringMode');

// Checkbox elements
const titleCheck = document.getElementById('titleCheck');
const descriptionCheck = document.getElementById('descriptionCheck');
const tagsCheck = document.getElementById('tagsCheck');
const categoryCheck = document.getElementById('categoryCheck');

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
  const { sessionActive, goal, scoreMode, sessionEndTime } = state;

  startBtn.disabled = sessionActive;
  stopBtn.disabled = !sessionActive;
  goalInput.value = goal || '';
  
  // Update scoring mode if provided
  if (scoreMode) {
    currentScoringMode = scoreMode;
    updateScoringModeDisplay();
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
      scoreDisplay.textContent = '–';
      return;
    }
    chrome.storage.local.get(['lastVideoId', 'currentScore'], s => {
      scoreDisplay.textContent =
        s.lastVideoId === videoId && s.currentScore != null
          ? (s.currentScore * 100).toFixed(1) + '%'
          : '–';
    });
  });
}

// --- Initialize UI & Listen for Changes ---
chrome.storage.local.get(['sessionActive', 'goal', 'scoreMode', 'sessionEndTime', 'shareHistoryEnabled', 'selectedTheme'], (prefs) => {
  updateUI(prefs);
  shareHistoryToggle.checked = !!prefs.shareHistoryEnabled;
  
  // Initialize theme
  const theme = prefs.selectedTheme || 'crimson-vanilla';
  document.documentElement.setAttribute('data-theme', theme);
  themeSelector.value = theme;
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    chrome.storage.local.get(['sessionActive', 'goal', 'scoreMode', 'sessionEndTime'], updateUI);
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

shareHistoryToggle.addEventListener('change', () => {
  const enabled = shareHistoryToggle.checked;
  chrome.storage.local.set({ shareHistoryEnabled: enabled });
  chrome.runtime.sendMessage({ type: 'SHARE_HISTORY_TOGGLE', enabled });
});

// Theme switching functionality
themeSelector.addEventListener('change', () => {
  const selectedTheme = themeSelector.value;
  document.documentElement.setAttribute('data-theme', selectedTheme);
  chrome.storage.local.set({ selectedTheme: selectedTheme });
  chrome.runtime.sendMessage({ type: 'THEME_CHANGED', theme: selectedTheme });
});

// --- Scoring Mode Modal Functionality ---
let currentScoringMode = ['title', 'description']; // Default mode

// Initialize scoring mode from storage
chrome.storage.local.get('scoreMode', (data) => {
  if (data.scoreMode) {
    currentScoringMode = data.scoreMode;
  }
  updateScoringModeDisplay(); // Always update display
});

function updateScoringModeDisplay() {
  const modeNames = {
    'title': 'Title',
    'description': 'Description', 
    'tags': 'Tags',
    'category': 'Category'
  };
  
  // Ensure currentScoringMode is an array
  if (!Array.isArray(currentScoringMode)) {
    currentScoringMode = ['title', 'description']; // Default fallback
  }
  
  const selectedNames = currentScoringMode.map(mode => modeNames[mode]);
  const displayText = selectedNames.length > 0 ? selectedNames.join(' + ') : 'None selected';
  scoreModeText.textContent = displayText;
  
  // Update checkboxes
  titleCheck.checked = currentScoringMode.includes('title');
  descriptionCheck.checked = currentScoringMode.includes('description');
  tagsCheck.checked = currentScoringMode.includes('tags');
  categoryCheck.checked = currentScoringMode.includes('category');
}

// Open modal
scoreModeBtn.addEventListener('click', () => {
  scoringModeModal.classList.add('active');
});

// Close modal
closeModal.addEventListener('click', () => {
  scoringModeModal.classList.remove('active');
});

// Close modal when clicking outside
scoringModeModal.addEventListener('click', (e) => {
  if (e.target === scoringModeModal) {
    scoringModeModal.classList.remove('active');
  }
});

// Apply scoring mode
applyScoringMode.addEventListener('click', () => {
  const newMode = [];
  if (titleCheck.checked) newMode.push('title');
  if (descriptionCheck.checked) newMode.push('description');
  if (tagsCheck.checked) newMode.push('tags');
  if (categoryCheck.checked) newMode.push('category');
  
  // Ensure at least one option is selected
  if (newMode.length === 0) {
    newMode.push('title'); // Default to title only
    titleCheck.checked = true;
  }
  
  currentScoringMode = newMode;
  updateScoringModeDisplay();
  
  // Save to storage
  chrome.storage.local.set({ scoreMode: currentScoringMode });
  
  // Close modal
  scoringModeModal.classList.remove('active');
  
  // Update active session if running
  chrome.storage.local.get('sessionActive', prefs => {
    if (prefs.sessionActive) {
      sendToContent({ type: 'SCORE_MODE_CHANGED', mode: currentScoringMode });
      scoreDisplay.textContent = 'Scoring mode changed. Score updating...';
      scoreDisplay.classList.remove('error');
      setTimeout(() => {
        chrome.storage.local.get(['lastVideoId','currentScore'], s => {
          scoreDisplay.textContent =
            s.currentScore != null ? (s.currentScore * 100).toFixed(1) + '%' : '\u2013';
        });
      }, 2000);
    }
  });
});

// Prevent unchecking all options
function preventUncheckAll(clickedCheckbox) {
  const checkboxes = [titleCheck, descriptionCheck, tagsCheck, categoryCheck];
  const checkedCount = checkboxes.filter(cb => cb.checked).length;
  // If this is the last checked checkbox being unchecked, prevent it
  if (checkedCount === 1 && !clickedCheckbox.checked) {
    clickedCheckbox.checked = true;
    return false; // Prevent the uncheck
  }
  return true; // Allow the check/uncheck
}

titleCheck.addEventListener('change', (e) => {
  preventUncheckAll(e.target);
});
descriptionCheck.addEventListener('change', (e) => {
  preventUncheckAll(e.target);
});
tagsCheck.addEventListener('change', (e) => {
  preventUncheckAll(e.target);
});
categoryCheck.addEventListener('change', (e) => {
  preventUncheckAll(e.target);
});

// --- Start Session ---
startBtn.addEventListener('click', () => {
  const goal = goalInput.value.trim();
  const duration = parseInt(sessionDurationInput.value, 10);
  if (!goal || !duration || duration < 1) return;

  chrome.runtime.sendMessage({ type: 'START_SESSION', duration, goal, scoreMode: currentScoringMode });
  
  // Send message to content.js to start session
  sendToContent({ type: 'START_SESSION', goal });
});

// --- Stop Session ---
function reloadTabWithTimestamp() {
  chrome.runtime.sendMessage({ type: 'RELOAD_WITH_TIMESTAMP' });
}

stopBtn.addEventListener('click', () => {
  reloadTabWithTimestamp();
  chrome.runtime.sendMessage({ type: 'STOP_SESSION' });
  
  // Send message to content.js to stop session
  sendToContent({ type: 'STOP_SESSION' });
});

toggleOffBtn.addEventListener('click', () => {
  reloadTabWithTimestamp();
  chrome.runtime.sendMessage({ type: 'STOP_SESSION' });
  
  // Send message to content.js to stop session
  sendToContent({ type: 'STOP_SESSION' });
});

// --- Live “Current” score updates from content.js ---
chrome.runtime.onMessage.addListener(msg => {
  if (msg.type === 'NEW_SCORE') {
    scoreDisplay.textContent = (msg.score * 100).toFixed(1) + '%';
    getCurrentVideoId(videoId => {
      if (!videoId) return;
      chrome.storage.local.set({ currentScore: msg.score, lastVideoId: videoId });
    });
  } else if (msg.type === 'SHOW_SUMMARY') {
    document.querySelector('[data-tab="summary"]').click();
  } else if (msg.type === 'ERROR') {
    scoreDisplay.textContent = msg.error || 'An error occurred.';
    scoreDisplay.classList.add('error');
  }
});

// --- Render session summary, chart & feedback ---
function renderSummary() {
  chrome.storage.local.get('watchedScores', data => {
    const scores = data.watchedScores || [];
    console.log('Retrieved scores for chart:', scores);
    
    const count  = scores.length;
    const avg    = count ? (scores.reduce((a,b)=>a+b,0)/count * 100).toFixed(1) : 0;
    const msgs   = avg >= 60 ? positiveMsgs : negativeMsgs;
    const feedback = msgs[Math.floor(Math.random()*msgs.length)];

    summaryMessage.innerHTML = `
      <div>Watched ${count} videos • Avg: ${avg}%</div>
      <div class="feedback">${feedback || ''}</div>
    `;
    
    // Convert scores from 0-1 to 0-100 for the chart
    const chartScores = scores.map(score => score * 100);
    console.log('Chart scores (0-100):', chartScores);
    initChart(scores.map((_,i)=>i+1), chartScores);
  });
}

