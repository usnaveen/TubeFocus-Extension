// background.js
console.log('[background] service worker started - LOCAL DEVELOPMENT MODE');
console.log('[background] API Base URL:', 'http://localhost:8080');
console.log('[background] Available endpoints: /score/detailed, /score/simple, /feedback, /health');

// Configuration - LOCAL DEVELOPMENT
const CONFIG = {
  API_BASE_URL: 'http://localhost:8080', // Local dev container
  API_KEY: 'changeme'
};

const API_ENDPOINT = `${CONFIG.API_BASE_URL}/score/detailed`;

// --- Alarms for session management ---
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'sessionEnd') {
    chrome.storage.local.get(['sessionEndTime', 'shareHistoryEnabled', 'goal'], data => {
      if (Date.now() >= data.sessionEndTime) {
        // End the session
        chrome.storage.local.set({ sessionActive: false, sessionEndTime: null }, () => {
          // Upload session data if sharing is enabled
          if (data.shareHistoryEnabled && sessionVideos.length > 0) {
            console.log('[background] LOCAL DEV: Session data upload disabled - /upload endpoint not available in dev container');
            console.log('[background] Session data would contain:', sessionVideos.length, 'videos');
            // For local development, just clear the session videos and show summary
            sessionVideos = [];
            chrome.runtime.sendMessage({ type: 'SHOW_SUMMARY' });
          } else {
            // No data to upload or sharing disabled, just show summary
            chrome.runtime.sendMessage({ type: 'SHOW_SUMMARY' });
          }
          
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

// --- Session data upload helper ---
async function uploadSessionData(goal, videos) {
  if (!videos || videos.length === 0) {
    console.log('[background] No videos to upload');
    return null;
  }
  
  console.log('[background] LOCAL DEV: Session data upload disabled - /upload endpoint not available in dev container');
  console.log('[background] Would upload session data for goal:', goal, 'with', videos.length, 'videos');
  
  // For local development, return mock success
  return { status: 'LOCAL_DEV_MODE', message: 'Upload simulated for local development' };
}

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
  if (msg.type === 'THEME_CHANGED') {
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
    const endTime = Date.now() + msg.duration * 60 * 1000;
    
    // Handle new scoring mode structure
    const storageData = { 
      sessionActive: true, 
      sessionEndTime: endTime, 
      goal: msg.goal, 
      watchedScores: [] 
    };
    
    if (msg.scoringType === 'simple') {
      storageData.scoringType = 'simple';
      storageData.simpleMode = msg.simpleMode || 'title_and_description';
    } else if (msg.scoringType === 'advanced') {
      storageData.scoringType = 'advanced';
      storageData.advancedMode = msg.advancedMode || ['title', 'description'];
    } else {
      // Legacy support for old scoreMode format
      storageData.scoreMode = msg.scoreMode || ['title', 'description'];
    }
    
    chrome.storage.local.set(storageData, () => {
      chrome.alarms.create('sessionEnd', { delayInMinutes: msg.duration });
    });
    sessionVideos = [];
  } else if (msg.type === 'STOP_SESSION') {
    // Clear session data without uploading when manually stopped
    chrome.storage.local.set({ sessionActive: false, sessionEndTime: null, watchedScores: [] }, () => {
      chrome.alarms.clear('sessionEnd');
      console.log('[background] Session stopped and data cleared.');
      // Reset session videos array
      sessionVideos = [];

      // Reload the active tab to apply the stopped state
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (tabs[0] && tabs[0].id) {
          chrome.tabs.reload(tabs[0].id);
        }
      });
    });
  } else if (msg.type === 'videoData') {
    // msg: { videoId }
    chrome.storage.local.get(['sessionActive', 'shareHistoryEnabled', 'goal', 'scoringType', 'simpleMode', 'advancedMode'], async prefs => {
      if (prefs.sessionActive && prefs.shareHistoryEnabled) {
        const meta = await fetchVideoMetadata(msg.videoId);
        let category = '';
        if (meta && meta.categoryId) {
          category = await fetchCategoryName(meta.categoryId);
        }
        // Call backend to get score
        let score = null;
        try {
          // Determine which endpoint to use based on scoring type
          let endpoint = `${CONFIG.API_BASE_URL}/score/detailed`;
          let requestBody = {
            video_id: msg.videoId,
            goal: prefs.goal
          };
          
          if (prefs.scoringType === 'simple') {
            // Use the new simple endpoint
            endpoint = `${CONFIG.API_BASE_URL}/score/simple`;
            requestBody = {
              video_url: `https://www.youtube.com/watch?v=${msg.videoId}`,
              goal: prefs.goal,
              mode: prefs.simpleMode || 'title_and_description'
            };
          } else {
            // Use the advanced endpoint
            requestBody.parameters = Array.isArray(prefs.advancedMode) ? prefs.advancedMode : ['title', 'description', 'tags', 'category'];
          }
          
          console.log('[background] LOCAL DEV: Making API call to:', endpoint);
          console.log('[background] Request body:', requestBody);
          
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'X-API-KEY': CONFIG.API_KEY
            },
            body: JSON.stringify(requestBody)
          });
          
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          
          const data = await res.json();
          score = data.score || data;
          console.log('[background] LOCAL DEV: API response:', data);
        } catch (e) {
          console.error('[background] LOCAL DEV: API call failed:', e);
          console.log('[background] LOCAL DEV: Make sure the dev container is running on localhost:8080');
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
    
    // Determine which endpoint to use based on scoring type
    let endpoint = API_ENDPOINT;
    let requestBody = {
      video_id: msg.url.match(/[?&]v=([^&]+)/)?.[1] || '',
      goal: msg.goal
    };
    
    if (msg.scoringType === 'simple') {
      // Use the new simple endpoint
      endpoint = `${CONFIG.API_BASE_URL}/score/simple`;
      requestBody = {
        video_url: msg.url,
        goal: msg.goal,
        mode: msg.simpleMode || 'title_and_description'
      };
    } else {
      // Use the advanced endpoint
      requestBody.parameters = Array.isArray(msg.advancedMode) ? msg.advancedMode : ['title', 'description', 'tags', 'category'];
    }
    
    console.log('[background] LOCAL DEV: FETCH_SCORE API call to:', endpoint);
    console.log('[background] LOCAL DEV: Request body:', requestBody);
    
    fetch(endpoint, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-API-KEY': CONFIG.API_KEY
      },
      body: JSON.stringify(requestBody)
    })
    .then(res => {
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return res.json();
    })
    .then(data => {
      console.log('[background] LOCAL DEV: FETCH_SCORE response:', data);
      sendResponse(data);
    })
    .catch(err => {
      console.error('[background] LOCAL DEV: FETCH_SCORE error:', err);
      console.log('[background] LOCAL DEV: Make sure the dev container is running on localhost:8080');
      sendResponse({ error: err.message });
    });
    return true; // Keep the message channel open for sendResponse
  } 
});