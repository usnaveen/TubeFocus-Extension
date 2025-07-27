// background.js
console.log('[background] service worker started');

// Configuration - now using Cloud Run API
const CONFIG = {
  API_BASE_URL: 'https://yt-scorer-api-bd5usk72uq-uc.a.run.app', // Google Cloud Run API
  API_KEY: 'changeme'
};

const API_ENDPOINT = `${CONFIG.API_BASE_URL}/predict`;

// --- Alarms for session management ---
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'sessionEnd') {
    chrome.storage.local.get('sessionEndTime', data => {
      if (Date.now() >= data.sessionEndTime) {
        // End the session
        chrome.storage.local.set({ sessionActive: false, sessionEndTime: null }, () => {
          chrome.runtime.sendMessage({ type: 'SHOW_SUMMARY' });
          // Send message to all tabs to refresh
          chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
              if (tab.url && tab.url.includes('youtube.com')) {
                chrome.tabs.sendMessage(tab.id, { type: 'SESSION_ENDED_AUTO' }, () => {
                  // Ignore errors if content script not loaded
                });
              }
            });
          });
        });
        chrome.alarms.clear('sessionEnd');
      }
    });
  }
});

let sessionVideos = [];

// --- YouTube API helpers ---
const YT_API_KEY = 'YOUR_YOUTUBE_API_KEY'; // TODO: Replace with your key or load from storage

async function fetchVideoMetadata(videoId) {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${YT_API_KEY}`;
  const resp = await fetch(url);
  const data = await resp.json();
  if (!data.items || !data.items[0]) return null;
  const snippet = data.items[0].snippet;
  return {
    title: snippet.title,
    description: snippet.description,
    tags: snippet.tags || [],
    categoryId: snippet.categoryId
  };
}

async function fetchCategoryName(categoryId) {
  const url = `https://www.googleapis.com/youtube/v3/videoCategories?part=snippet&id=${categoryId}&key=${YT_API_KEY}`;
  const resp = await fetch(url);
  const data = await resp.json();
  if (!data.items || !data.items[0]) return '';
  return data.items[0].snippet.title;
}

// --- Message listener ---
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'TEST_CONNECTION') {
    // Test connection handler for debugging
    console.log('[background] Test connection received');
    sendResponse({ status: 'connected', timestamp: Date.now() });
  } else if (msg.type === 'THEME_CHANGED') {
    // Forward theme change to all content scripts
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.url && tab.url.includes('youtube.com')) {
          chrome.tabs.sendMessage(tab.id, { type: 'THEME_CHANGED', theme: msg.theme }, () => {
            // Ignore errors if content script not loaded
          });
        }
      });
    });
  } else
  if (msg.type === 'START_SESSION') {
    console.log('[background] START_SESSION received:', msg);
    const endTime = Date.now() + msg.duration * 60 * 1000;
    chrome.storage.local.set({ sessionActive: true, sessionEndTime: endTime, goal: msg.goal, scoreMode: msg.scoreMode, watchedScores: [] }, () => {
      chrome.alarms.create('sessionEnd', { delayInMinutes: msg.duration });
      sendResponse({ success: true });
    });
    sessionVideos = [];
    return true; // Keep message channel open
  } else if (msg.type === 'STOP_SESSION') {
    chrome.storage.local.get(['sessionActive', 'goal', 'shareHistoryEnabled'], prefs => {
      if (prefs.sessionActive && prefs.shareHistoryEnabled && sessionVideos.length > 0) {
        fetch(`${CONFIG.API_BASE_URL}/upload`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-API-KEY': CONFIG.API_KEY
          },
          body: JSON.stringify({
            goal: prefs.goal,
            session: sessionVideos
          })
        }).then(() => {
          sessionVideos = [];
        }).catch(() => {
          sessionVideos = [];
        });
      } else {
        sessionVideos = [];
      }
    });
    chrome.storage.local.set({ sessionActive: false, sessionEndTime: null }, () => {
      chrome.alarms.clear('sessionEnd');
    });
  } else if (msg.type === 'videoData') {
    // msg: { videoId }
    chrome.storage.local.get(['sessionActive', 'shareHistoryEnabled', 'goal', 'scoreMode'], async prefs => {
      if (prefs.sessionActive && prefs.shareHistoryEnabled) {
        const meta = await fetchVideoMetadata(msg.videoId);
        let category = '';
        if (meta && meta.categoryId) {
          category = await fetchCategoryName(meta.categoryId);
        }
        // Call backend to get score
        let score = null;
        try {
          const res = await fetch(`${CONFIG.API_BASE_URL}/predict`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'X-API-KEY': CONFIG.API_KEY
            },
            body: JSON.stringify({
              video_id: msg.videoId,
              goal: prefs.goal,
              parameters: Array.isArray(prefs.scoreMode) ? prefs.scoreMode : ['title', 'description', 'tags', 'category']
            })
          });
          const data = await res.json();
          score = data.score || data;
        } catch (e) {
          score = null;
        }
        sessionVideos.push({
          videoId: msg.videoId,
          title: meta ? meta.title : '',
          description: meta ? meta.description : '',
          tags: meta ? meta.tags : [],
          category,
          score,
          timestamp: Date.now()
        });
        // Send score to content script for overlay
        if (score !== null) {
          chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
            if (tabs[0]) {
              chrome.tabs.sendMessage(tabs[0].id, { type: 'NEW_SCORE', score });
            }
          });
        }
      }
    });
  } else if (msg.type === 'FETCH_SCORE') {
    console.log('[background] FETCH_SCORE request', msg);
    fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-API-KEY': CONFIG.API_KEY
      },
      body: JSON.stringify({
        video_id: msg.url.match(/[?&]v=([^&]+)/)?.[1] || '',
        goal: msg.goal,
        parameters: Array.isArray(msg.scoreMode) ? msg.scoreMode : ['title', 'description', 'tags', 'category']
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
  } else if (msg.type === 'RELOAD_WITH_TIMESTAMP') {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs[0]) {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: function() {
            try {
              const video = document.querySelector('video');
              let t = 0;
              if (video) t = Math.floor(video.currentTime);
              let url = new URL(window.location.href);
              url.searchParams.set('t', t);
              window.location.replace(url.toString());
            } catch (e) {
              window.location.reload();
            }
          }
        });
      }
    });
  }
});