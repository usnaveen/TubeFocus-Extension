// background.js
console.log('[background] service worker started - CLOUD RUN MODE');
console.log('[background] API Base URL:', 'https://yt-scorer-api-933573987016.us-central1.run.app');
console.log('[background] Available endpoints: /score/detailed, /score/simple, /score/simple/fast, /feedback, /health');

// Configuration - CLOUD RUN
const CONFIG = {
  API_BASE_URL: 'https://yt-scorer-api-933573987016.us-central1.run.app',
  API_KEY: 'test_key'
};

const API_ENDPOINT = `${CONFIG.API_BASE_URL}/score/detailed`;

function cacheLocalSavedVideo(item, saveMode = 'transcript') {
  if (!item?.video_id) return;
  chrome.storage.local.get(['localSavedVideos'], (data) => {
    const existing = Array.isArray(data.localSavedVideos) ? data.localSavedVideos : [];
    const normalized = {
      video_id: item.video_id,
      title: item.title || item.video_id,
      goal: item.goal || '',
      score: item.score || null,
      indexed_at: new Date().toISOString(),
      save_mode: saveMode,
      description: item.description || '',
      video_url: item.video_url || `https://youtube.com/watch?v=${item.video_id}`,
      embed_url: `https://www.youtube.com/embed/${item.video_id}`,
      thumbnail_url: `https://i.ytimg.com/vi/${item.video_id}/hqdefault.jpg`,
      note: item.description || ''
    };
    const deduped = [normalized, ...existing.filter((v) => v.video_id !== normalized.video_id)].slice(0, 80);
    chrome.storage.local.set({ localSavedVideos: deduped });
  });
}

function persistSessionSnapshot(reason = 'manual_stop') {
  chrome.storage.local.get(['sessionStartTime', 'goal', 'watchedScores', 'highlights', 'totalWatchTime'], (state) => {
    try {
      const watchedScores = Array.isArray(state.watchedScores) ? state.watchedScores : [];
      const normalizedScores = watchedScores.map((s) => (s > 1 ? s : s * 100));
      const avgScore = normalizedScores.length
        ? (normalizedScores.reduce((a, b) => a + b, 0) / normalizedScores.length)
        : 0;

      const sessionId = state.sessionStartTime
        ? `session_${state.sessionStartTime}`
        : `session_${Date.now()}`;

      const payload = {
        session_id: sessionId,
        goal: state.goal || '',
        focus_score: Number(avgScore.toFixed(2)),
        videos_watched: normalizedScores.length,
        highlights_count: Array.isArray(state.highlights) ? state.highlights.length : 0,
        watch_time_minutes: Math.floor((state.totalWatchTime || 0) / 60),
        date: new Date().toISOString().slice(0, 10),
        created_at: new Date().toISOString(),
        reason
      };

      fetch(`${CONFIG.API_BASE_URL}/firestore/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': CONFIG.API_KEY
        },
        body: JSON.stringify(payload)
      }).catch((err) => {
        console.warn('[background] Session snapshot save failed:', err);
      });
    } catch (err) {
      console.warn('[background] Session snapshot build failed:', err);
    }
  });
}

// --- Alarms for session management ---
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'sessionEnd') {
    chrome.storage.local.get(['sessionEndTime'], data => {
      if (Date.now() >= data.sessionEndTime) {
        persistSessionSnapshot('timer_end');
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
        coachEnabled: msg.coachEnabled !== false,
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
      persistSessionSnapshot('manual_stop');
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
            // Use unified score endpoint
            const endpoint = `${CONFIG.API_BASE_URL}/score`;
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

      // Use unified score endpoint
      const endpoint = `${CONFIG.API_BASE_URL}/score`;
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
            console.log('[background] Fast endpoint not found, trying regular /score endpoint');
            const fallbackEndpoint = `${CONFIG.API_BASE_URL}/score`;

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
        score: msg.score,
        segments: msg.segments || null  // Timestamped segments for hierarchical chunking
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
      const highlight = msg.highlight || {};
      const startTimestamp = Number.isFinite(highlight.startTimestamp) ? highlight.startTimestamp : (highlight.timestamp || 0);
      const endTimestamp = Number.isFinite(highlight.endTimestamp) ? highlight.endTimestamp : startTimestamp;
      const rangeLabel = highlight.rangeLabel || `${highlight.startTimestampFormatted || highlight.timestampFormatted || '0:00'} - ${highlight.endTimestampFormatted || highlight.timestampFormatted || '0:00'}`;

      console.log('[background] SAVE_HIGHLIGHT request:', highlight.videoId, '@', rangeLabel);

      const normalizedHighlight = {
        video_id: highlight.videoId,
        video_title: highlight.videoTitle,
        timestamp: startTimestamp,
        timestamp_formatted: highlight.startTimestampFormatted || highlight.timestampFormatted || '0:00',
        end_timestamp: endTimestamp,
        end_timestamp_formatted: highlight.endTimestampFormatted || highlight.timestampFormatted || '0:00',
        range_label: rangeLabel,
        note: highlight.note || '',
        transcript: highlight.transcript || '',
        video_url: highlight.videoUrl || '',
        created_at: highlight.createdAt || new Date().toISOString()
      };

      chrome.storage.local.get(['highlights'], (data) => {
        const highlights = data.highlights || [];
        highlights.push({ ...normalizedHighlight, videoId: highlight.videoId, videoTitle: highlight.videoTitle });
        chrome.storage.local.set({ highlights }, () => {
          console.log('[background] Highlight saved locally, total:', highlights.length);
        });
      });

      (async () => {
        let cloudSaved = false;
        let indexed = false;

        try {
          const cloudResponse = await fetch(`${CONFIG.API_BASE_URL}/highlights`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-KEY': CONFIG.API_KEY
            },
            body: JSON.stringify(normalizedHighlight)
          });
          cloudSaved = cloudResponse.ok;
        } catch (err) {
          console.warn('[background] Highlight cloud save failed:', err);
        }

        if (normalizedHighlight.transcript) {
          try {
            const indexResponse = await fetch(`${CONFIG.API_BASE_URL}/librarian/index`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': CONFIG.API_KEY
              },
              body: JSON.stringify({
                video_id: `${highlight.videoId}_highlight_${startTimestamp}_${endTimestamp}`,
                title: `[Highlight] ${highlight.videoTitle} @ ${rangeLabel}`,
                transcript: `${normalizedHighlight.note ? `${normalizedHighlight.note} --- ` : ''}${normalizedHighlight.transcript}`,
                goal: 'highlight',
                score: 100,
                metadata: {
                  type: 'highlight',
                  original_video_id: highlight.videoId,
                  timestamp: startTimestamp,
                  end_timestamp: endTimestamp,
                  range_label: rangeLabel,
                  video_url: normalizedHighlight.video_url,
                  note: normalizedHighlight.note
                }
              })
            });
            indexed = indexResponse.ok;
          } catch (err) {
            console.warn('[background] Highlight indexing failed:', err);
          }
        }

        sendResponse({ success: true, cloud_saved: cloudSaved, indexed });
      })();
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
    } else if (msg.type === 'LIBRARIAN_SAVE_ITEM') {
      console.log('[background] LIBRARIAN_SAVE_ITEM request:', msg.video_id);

      const endpoint = `${CONFIG.API_BASE_URL}/librarian/save`;

      fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': CONFIG.API_KEY
        },
        body: JSON.stringify({
          video_id: msg.video_id,
          title: msg.title,
          goal: msg.goal,
          score: msg.score,
          video_url: msg.video_url,
          transcript: msg.transcript || '',
          description: msg.description || '',
          segments: msg.segments || null
        })
      })
        .then(res => res.json())
        .then(data => {
          console.log('[background] Save item result:', data);
          if (data?.success) {
            cacheLocalSavedVideo({
              video_id: msg.video_id,
              title: msg.title,
              goal: msg.goal,
              score: msg.score,
              video_url: msg.video_url,
              description: msg.description || ''
            }, data.save_mode || 'transcript');
          }
          sendResponse(data);
        })
        .catch(err => {
          console.error('[background] Save item failed:', err);
          sendResponse({ success: false, error: err.message });
        });
      return true;
    } else if (msg.type === 'LIBRARIAN_SAVE_SUMMARY') {
      console.log('[background] LIBRARIAN_SAVE_SUMMARY request:', msg.video_id);

      const endpoint = `${CONFIG.API_BASE_URL}/librarian/save_summary`;

      fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': CONFIG.API_KEY
        },
        body: JSON.stringify({
          video_id: msg.video_id,
          title: msg.title,
          goal: msg.goal,
          video_url: msg.video_url,
          summary: msg.summary,
          source: msg.source || 'youtube_ask'
        })
      })
        .then(res => res.json())
        .then(data => {
          console.log('[background] Summary save result:', data);
          sendResponse(data);
        })
        .catch(err => {
          console.error('[background] Summary save failed:', err);
          sendResponse({ success: false, error: err.message });
        });
      return true;
    }
});
