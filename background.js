// background.js
console.log('[background] service worker started');

let sessionTimer = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'START_SESSION') {
    if (sessionTimer) {
      clearTimeout(sessionTimer);
    }
    sessionTimer = setTimeout(() => {
      chrome.storage.local.set({ sessionActive: false }, () => {
        chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'SESSION_STOPPED' });
          }
        });
        // Open the popup and switch to the summary tab
        chrome.action.openPopup();
        chrome.runtime.sendMessage({ type: 'SHOW_SUMMARY' });
      });
    }, msg.duration * 60 * 1000);
  } else if (msg.type === 'STOP_SESSION') {
    if (sessionTimer) {
      clearTimeout(sessionTimer);
      sessionTimer = null;
    }
  } else if (msg.type === 'FETCH_SCORE') {
    console.log('[background] FETCH_SCORE request', msg);
    fetch('https://yt-scorer-49646986060.us-central1.run.app/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ video_url: msg.url, goal: msg.goal })
    })
      .then(res => {
        if (!res.ok) return res.text().then(txt => { throw new Error(`HTTP ${res.status}: ${txt}`); });
        return res.json();
      })
      .then(data => {
        console.log('[background] got response', data);
        sendResponse({ score: data.score });
      })
      .catch(err => {
        console.error('[background] fetch error', err);
        sendResponse({ error: err.message });
      });
    // keep the channel open for async sendResponse
    return true;
  }
});

