// background.js
console.log('[background] service worker started - LOCAL DEVELOPMENT MODE');
console.log('[background] API Base URL:', 'http://localhost:8080');
console.log('[background] Available endpoints: /score/detailed, /score/simple, /score/simple/fast, /feedback, /health');

// Configuration - PRODUCTION
const CONFIG = {
  API_BASE_URL: 'https://simplescore-49646986060.asia-south2.run.app',
  API_KEY: 'test_key'
  // Note: Using Cloud Function (Gen 2) via /simple_score (mapped to root or explicit path)
};

const API_ENDPOINT = `${CONFIG.API_BASE_URL}/score/detailed`;

// --- Alarms for session management ---
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'sessionEnd') {
    chrome.storage.local.get(['sessionEndTime'], data => {
      if (Date.now() >= data.sessionEndTime) {
        // End the session and set flag to show summary when popup opens
        chrome.storage.local.set({ sessionActive: false, sessionEndTime: null, showSummaryOnOpen: true }, () => {
          // Show summary
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

      // Simplified scoring - always use simple mode with title and description
      const storageData = {
        sessionActive: true,
        sessionEndTime: endTime,
        goal: msg.goal,
        watchedScores: []  // Clear previous session scores when starting new session
      };

      chrome.storage.local.set(storageData, () => {
        chrome.alarms.create('sessionEnd', { delayInMinutes: msg.duration });
      });
    } else if (msg.type === 'STOP_SESSION') {
      // End session but preserve scores for summary and set flag to show summary
      chrome.storage.local.set({ sessionActive: false, sessionEndTime: null, showSummaryOnOpen: true }, () => {
        chrome.alarms.clear('sessionEnd');
        console.log('[background] Session stopped manually, showing summary.');
        // Show summary and reload the active tab like before
        chrome.runtime.sendMessage({ type: 'SHOW_SUMMARY' });

        // Reload the active tab to apply the stopped state (like before)
        chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
          if (tabs[0] && tabs[0].id) {
            chrome.tabs.reload(tabs[0].id);
          }
        });

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
    } else if (msg.type === 'videoData') {
      // msg: { videoId }
      chrome.storage.local.get(['sessionActive', 'goal'], async prefs => {
        if (prefs.sessionActive) {

          // Call backend to get score AND metadata (title/desc)
          // We no longer fetch metadata client-side to avoid exposing API keys

          let score = null;
          let title = '';
          let description = '';

          try {
            // Always use simple scoring endpoint
            const endpoint = `${CONFIG.API_BASE_URL}/score/simple`;
            const requestBody = {
              video_url: `https://www.youtube.com/watch?v=${msg.videoId}`,
              goal: prefs.goal,
              mode: 'title_and_description'
            };

            console.log('[background] Making API call to:', endpoint);

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

            // Backend now provides metadata!
            title = data.title || 'Unknown Video';
            description = data.description || '';

          } catch (e) {
            console.error('[background] API call failed:', e);
            score = null;
          }

          if (score !== null) {
            // Send score to content script for overlay
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

      // Always use simple scoring endpoint
      const endpoint = `${CONFIG.API_BASE_URL}/score/simple`;
      const requestBody = {
        video_url: msg.url,
        goal: msg.goal,
        mode: 'title_and_description'
      };

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

          // If it's a 404 error with the fast endpoint, try the regular endpoint
          if (msg.scoringType === 'simple' && endpoint.includes('/fast') && err.message.includes('404')) {
            console.log('[background] Fast endpoint not found, trying regular /score/simple endpoint');
            const fallbackEndpoint = `${CONFIG.API_BASE_URL}/score/simple`;

            fetch(fallbackEndpoint, {
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
                console.log('[background] LOCAL DEV: FETCH_SCORE fallback response:', data);
                sendResponse(data);
              })
              .catch(fallbackErr => {
                console.error('[background] LOCAL DEV: Fallback also failed:', fallbackErr);
                sendResponse({ error: 'Backend server not available' });
              });
            return;
          }

          console.log('[background] LOCAL DEV: Make sure the dev container is running on localhost:8080');

          // Provide more specific error messages
          let errorMessage = 'Connection failed';
          if (err.message.includes('Failed to fetch')) {
            errorMessage = 'Backend server not running';
          } else if (err.message.includes('404')) {
            errorMessage = 'API endpoint not found';
          } else if (err.message.includes('500')) {
            errorMessage = 'Server error occurred';
          } else if (err.message.includes('ENOTFOUND') || err.message.includes('ECONNREFUSED')) {
            errorMessage = 'Cannot connect to backend';
          } else {
            errorMessage = err.message;
          }

          sendResponse({ error: errorMessage });
        });
      return true; // Keep the message channel open for sendResponse
    }
});