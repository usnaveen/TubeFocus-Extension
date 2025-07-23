// popup.js

// --- DOM references ---
const goalInput      = document.getElementById('goalInput');
const startBtn       = document.getElementById('startSession');
const stopBtn        = document.getElementById('stopSession');
const scoreDisplay   = document.getElementById('scoreDisplay');
const summaryMessage = document.getElementById('summaryMessage');
const chartCanvas    = document.getElementById('scoreChart').getContext('2d');
const scoreModeEl    = document.getElementById('scoreMode');

const toggleOnBtn    = document.getElementById('toggleOn');
const toggleOffBtn   = document.getElementById('toggleOff');
const tabs           = document.querySelectorAll('.tabs button');
const sections       = document.querySelectorAll('section');

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
      labels, datasets: [{ label: 'Score per Video', data, fill: false, borderWidth: 2, borderColor: 'rgba(204, 120, 92, 1)' }]
    },
    options: {
      responsive: true,
      scales: {
        x: { 
            title: { display: true, text: 'Video #' },
            ticks: { color: '#ddd' },
            grid: { color: 'rgba(75, 108, 121, 0.5)' }
        },
        y: { 
            title: { display: true, text: 'Score' }, 
            min: 0, 
            max: 100,
            ticks: { color: '#ddd' },
            grid: { color: 'rgba(75, 108, 121, 0.5)' }
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
    chrome.tabs.sendMessage(id, message, () => {
      if (chrome.runtime.lastError) {
        console.error('[popup.js] sendMessage failed:', chrome.runtime.lastError.message);
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
    tabs.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    sections.forEach(s => s.classList.remove('active'));
    document.getElementById(btn.dataset.tab).classList.add('active');
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
  scoreModeEl.value = scoreMode || 'title_and_description';

  toggleOnBtn.classList.toggle('active', sessionActive);
  toggleOffBtn.classList.toggle('active', !sessionActive);

  if (sessionActive && sessionEndTime) {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((sessionEndTime - Date.now()) / 1000));
      const minutes = Math.floor(remaining / 60).toString().padStart(2, '0');
      const seconds = (remaining % 60).toString().padStart(2, '0');
      timerDisplay.textContent = `${minutes}:${seconds}`;
      if (remaining <= 0) {
        clearInterval(timerInterval);
        timerDisplay.textContent = '';
      }
    }, 1000);
  } else {
    if (timerInterval) clearInterval(timerInterval);
    timerDisplay.textContent = '';
  }

  getCurrentVideoId(videoId => {
    if (!videoId) {
      scoreDisplay.textContent = '–';
      return;
    }
    chrome.storage.local.get(['lastVideoId', 'currentScore'], s => {
      scoreDisplay.textContent =
        s.lastVideoId === videoId && s.currentScore != null
          ? s.currentScore
          : '–';
    });
  });
}

// --- Initialize UI & Listen for Changes ---
chrome.storage.local.get(['sessionActive', 'goal', 'scoreMode', 'sessionEndTime'], updateUI);
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    chrome.storage.local.get(['sessionActive', 'goal', 'scoreMode', 'sessionEndTime'], updateUI);
  }
});

const sessionDurationInput = document.getElementById('sessionDuration');

// --- Event Listeners for Toggles ---
toggleOffBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'STOP_SESSION' });
});

toggleOnBtn.addEventListener('click', () => {
  chrome.storage.local.get('sessionActive', prefs => {
    if (!prefs.sessionActive) {
      // This button doesn't start a session, it just indicates the 'On' state.
      // The actual session is started via the "Start Session" button.
      toggleOnBtn.classList.add('active');
      toggleOffBtn.classList.remove('active');
    }
  });
});


// --- Start Session ---
startBtn.addEventListener('click', () => {
  const goal = goalInput.value.trim();
  const duration = parseInt(sessionDurationInput.value, 10);
  const scoreMode = scoreModeEl.value;
  if (!goal || !duration || duration < 1) return;

  chrome.runtime.sendMessage({ type: 'START_SESSION', duration, goal, scoreMode });
});

// --- Stop Session ---
stopBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'STOP_SESSION' });
});

// --- Live “Current” score updates from content.js ---
chrome.runtime.onMessage.addListener(msg => {
  if (msg.type === 'NEW_SCORE') {
    scoreDisplay.textContent = msg.score;
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
    const count  = scores.length;
    const avg    = count ? (scores.reduce((a,b)=>a+b,0)/count).toFixed(2) : 0;
    const msgs   = avg >= 60 ? positiveMsgs : negativeMsgs;
    const feedback = msgs[Math.floor(Math.random()*msgs.length)];

    summaryMessage.innerHTML = `
      <div>Watched ${count} videos • Avg: ${avg}</div>
      <div class="feedback">${feedback || ''}</div>
    `;
    initChart(scores.map((_,i)=>i+1), scores);
  });
}

// --- Score Mode Change: Live update during session ---
scoreModeEl.addEventListener('change', () => {
  const newMode = scoreModeEl.value;
  chrome.storage.local.get('sessionActive', prefs => {
    if (prefs.sessionActive) {
      chrome.storage.local.set({ scoreMode: newMode }, () => {
        sendToContent({ type: 'SCORE_MODE_CHANGED', mode: newMode });
        // Show a brief message to the user
        scoreDisplay.textContent = 'Scoring mode changed. Score updating...';
        scoreDisplay.classList.remove('error');
        setTimeout(() => {
          chrome.storage.local.get(['lastVideoId','currentScore'], s => {
            scoreDisplay.textContent =
              s.currentScore != null ? s.currentScore : '\u2013';
          });
        }, 2000);
      });
    } else {
      chrome.storage.local.set({ scoreMode: newMode });
    }
  });
});