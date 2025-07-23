// background.js
console.log('[background] service worker started');

// background.js
console.log('[background] service worker started');

const API_ENDPOINT = 'https://yt-scorer-49646986060.us-central1.run.app/predict';

// --- Alarms for session management ---
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'sessionEnd') {
    chrome.storage.local.get('sessionEndTime', data => {
      if (Date.now() >= data.sessionEndTime) {
        // End the session
        chrome.storage.local.set({ sessionActive: false, sessionEndTime: null }, () => {
          chrome.runtime.sendMessage({ type: 'SHOW_SUMMARY' });
        });
        chrome.alarms.clear('sessionEnd');
      }
    });
  }
});

// --- Message listener ---
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'START_SESSION') {
    const endTime = Date.now() + msg.duration * 60 * 1000;
    chrome.storage.local.set({ sessionActive: true, sessionEndTime: endTime, goal: msg.goal, scoreMode: msg.scoreMode, watchedScores: [] }, () => {
      chrome.alarms.create('sessionEnd', { delayInMinutes: msg.duration });
    });
  } else if (msg.type === 'STOP_SESSION') {
    chrome.storage.local.set({ sessionActive: false, sessionEndTime: null }, () => {
      chrome.alarms.clear('sessionEnd');
    });
  } else if (msg.type === 'FETCH_SCORE') {
    console.log('[background] FETCH_SCORE request', msg);
    fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        video_url: msg.videoUrl,
        goal: msg.goal,
        mode: msg.scoreMode
      })
    })
    .then(res => res.json())
    .then(data => {
      console.log('[background] FETCH_SCORE response', data);
      sendResponse(data);
    })
    .catch(err => {
      console.error('[background] FETCH_SCORE error', err);
      sendResponse({ error: err.message });
    });
    return true; // Keep the message channel open for sendResponse
  }
});

