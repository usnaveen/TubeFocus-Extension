// background.js
console.log('[background] service worker started - CLOUD RUN MODE');
console.log('[background] API Base URL:', 'https://yt-scorer-api-933573987016.us-central1.run.app');
console.log('[background] Available endpoints: /score/detailed, /score/simple, /score/simple/fast, /feedback, /health');

// Configuration - CLOUD RUN
const CONFIG = {
  API_BASE_URL: 'https://yt-scorer-api-933573987016.us-central1.run.app',
  API_KEY: 'test_key'
  // Note: Using Google Cloud Run deployment
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

      // Session data with coach mode
      const storageData = {
        sessionActive: true,
        sessionEndTime: endTime,
        goal: msg.goal,
        coachMode: msg.coachMode || 'balanced',
        coachInstructions: msg.coachInstructions || '',
        watchedScores: [],  // Clear previous session scores when starting new session
        totalWatchTime: 0,
        sessionStartTime: Date.now()
      };

      chrome.storage.local.set(storageData, () => {
        chrome.alarms.create('sessionEnd', { delayInMinutes: msg.duration });
        console.log('[background] Session started with coach mode:', msg.coachMode);
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
    } else if (msg.type === 'AUDIT_VIDEO') {
      console.log('[background] AUDIT_VIDEO request for:', msg.videoId);
      
      // Call the auditor endpoint
      const endpoint = `${CONFIG.API_BASE_URL}/audit`;
      const requestBody = {
        video_id: msg.videoId,
        title: msg.title,
        description: msg.description || '',
        goal: msg.goal,
        transcript: msg.transcript || null
      };
      
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
          console.log('[background] Auditor analysis received:', data);
          sendResponse(data);
        })
        .catch(err => {
          console.error('[background] Auditor analysis failed:', err);
          sendResponse({ error: err.message, analysis: null });
        });
      return true; // Keep the message channel open for sendResponse
    } else if (msg.type === 'COACH_ANALYZE') {
      console.log('[background] COACH_ANALYZE request for session:', msg.sessionId);
      
      // Call the coach endpoint
      const endpoint = `${CONFIG.API_BASE_URL}/coach/analyze`;
      const requestBody = {
        session_id: msg.sessionId,
        goal: msg.goal,
        session_data: msg.sessionData
      };
      
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
          console.log('[background] Coach analysis received:', data);
          sendResponse(data);
        })
        .catch(err => {
          console.error('[background] Coach analysis failed:', err);
          sendResponse({ error: err.message, analysis: null });
        });
      return true; // Keep the message channel open for sendResponse
    } else if (msg.type === 'LIBRARIAN_INDEX') {
      console.log('[background] LIBRARIAN_INDEX request for video:', msg.videoId);
      
      // Call the librarian index endpoint
      const endpoint = `${CONFIG.API_BASE_URL}/librarian/index`;
      const requestBody = {
        video_id: msg.videoId,
        title: msg.title,
        transcript: msg.transcript,
        goal: msg.goal,
        score: msg.score
      };
      
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
          console.log('[background] Librarian index result:', data);
          sendResponse({ success: true, data: data });
        })
        .catch(err => {
          console.error('[background] Librarian index failed:', err);
          sendResponse({ success: false, error: err.message });
        });
      return true; // Keep the message channel open for sendResponse
    } else if (msg.type === 'LIBRARIAN_SEARCH') {
      console.log('[background] LIBRARIAN_SEARCH request:', msg.query);
      
      // Call the librarian search endpoint
      const endpoint = `${CONFIG.API_BASE_URL}/librarian/search`;
      const requestBody = {
        query: msg.query,
        n_results: msg.n_results || 5
      };
      
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
          console.log('[background] Librarian search results:', data);
          sendResponse(data);
        })
        .catch(err => {
          console.error('[background] Librarian search failed:', err);
          sendResponse({ error: err.message, search_results: null });
        });
      return true; // Keep the message channel open for sendResponse
    } else if (msg.type === 'SAVE_HIGHLIGHT') {
      console.log('[background] SAVE_HIGHLIGHT request:', msg.highlight.videoId, '@', msg.highlight.timestampFormatted);
      
      // Store highlight locally first (for offline access)
      chrome.storage.local.get(['highlights'], (data) => {
        const highlights = data.highlights || [];
        highlights.push(msg.highlight);
        chrome.storage.local.set({ highlights }, () => {
          console.log('[background] Highlight saved locally, total:', highlights.length);
        });
      });
      
      // Also send to backend for indexing (if transcript available)
      if (msg.highlight.transcript) {
        const endpoint = `${CONFIG.API_BASE_URL}/librarian/index`;
        const requestBody = {
          video_id: `${msg.highlight.videoId}_highlight_${msg.highlight.timestamp}`,
          title: `[Highlight] ${msg.highlight.videoTitle} @ ${msg.highlight.timestampFormatted}`,
          transcript: `${msg.highlight.note ? msg.highlight.note + ' --- ' : ''}${msg.highlight.transcript}`,
          goal: 'highlight',
          score: 100,
          metadata: {
            type: 'highlight',
            original_video_id: msg.highlight.videoId,
            timestamp: msg.highlight.timestamp,
            video_url: msg.highlight.videoUrl,
            note: msg.highlight.note
          }
        };
        
        fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': CONFIG.API_KEY
          },
          body: JSON.stringify(requestBody)
        })
          .then(res => res.json())
          .then(data => {
            console.log('[background] Highlight indexed in backend:', data);
            sendResponse({ success: true, indexed: true });
          })
          .catch(err => {
            console.error('[background] Highlight indexing failed:', err);
            // Still success since we saved locally
            sendResponse({ success: true, indexed: false, error: err.message });
          });
      } else {
        // No transcript, just saved locally with note
        sendResponse({ success: true, indexed: false, reason: 'No transcript available' });
      }
      return true;
    } else if (msg.type === 'WATCH_STATUS_UPDATE') {
      // Store watch time for coach
      chrome.storage.local.set({ 
        totalWatchTime: msg.totalWatchTimeSeconds,
        lastWatchUpdate: Date.now()
      });
      
      // Optionally notify coach about watch status
      console.log('[background] Watch status updated:', msg.totalWatchTimeSeconds, 'seconds');
    } else if (msg.type === 'GET_HIGHLIGHTS') {
      // Retrieve all saved highlights
      chrome.storage.local.get(['highlights'], (data) => {
        sendResponse({ highlights: data.highlights || [] });
      });
      return true;
    }
});