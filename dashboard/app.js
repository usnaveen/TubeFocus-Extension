/* ==============================
   TubeFocus Dashboard – app.js
   ============================== */

// ---------- Config ----------
let API_BASE_URL = 'https://yt-scorer-api-933573987016.us-central1.run.app';
let API_KEY = 'test_key';

function getHeaders() {
    return {
        'Content-Type': 'application/json',
        'X-API-KEY': API_KEY
    };
}

// ---------- State ----------
let contextVideo = null;   // Dragged video for focused-mode chat
let dashChart = null;      // Chart.js instance
let savedVideosCache = []; // Cache for drag source
let highlightsCache = [];  // Cache for fallback lists/stats
let filteredRemovedCache = []; // Recently filtered-out recommendations

// ---------- Witty Messages ----------
const WITTY = [
    "You're learning faster than a neural net on caffeine.",
    "Your focus score is trending up! Keep avoiding the cat videos.",
    "Inductive bias? More like inductive brilliance.",
    "Data ingested. Knowledge expanding. Distractions terminated.",
    "You've saved enough content to write a thesis. Time to review?",
    "Your brain's gradient is descending towards wisdom.",
    "Knowledge retention: MAXIMUM. Procrastination: MINIMUM.",
];

// ========================================================
//  Init
// ========================================================
document.addEventListener('DOMContentLoaded', async () => {
    // Load optional overrides from extension storage
    if (typeof chrome !== 'undefined' && chrome.storage) {
        try {
            const localData = await chrome.storage.local.get(['apiBaseUrl']);
            if (localData.apiBaseUrl) API_BASE_URL = localData.apiBaseUrl;
        } catch (e) { /* not in extension context */ }
        try {
            const syncData = await chrome.storage.sync.get(['apiKey']);
            if (syncData.apiKey) API_KEY = syncData.apiKey;
        } catch (e) { /* not in extension context */ }
    }

    // Load all panels
    checkBackendStatus();
    loadStatsPanel();
    loadSavedVideos();
    loadRecentSessions();
    loadHighlights();
    loadFilteredCounter();
    setupSystemDetailsModal();
    setupChat();
});

// ========================================================
//  Stats Panel
// ========================================================
async function loadStatsPanel() {
    // Witty summary
    const el = document.getElementById('witty-summary');
    el.textContent = `"${WITTY[Math.floor(Math.random() * WITTY.length)]}"`;

    try {
        const res = await fetch(`${API_BASE_URL}/librarian/saved_videos`, { headers: getHeaders() });
        const data = await res.json();
        const videos = data.videos || [];

        updateSavedVideoStats(videos.length);

        // Try to load session stats
        const sessRes = await fetch(`${API_BASE_URL}/firestore/sessions?limit=7`, { headers: getHeaders() });
        const sessData = await sessRes.json();
        const sessions = sessData.sessions || [];

        if (sessions.length > 0) {
            const avgScore = Math.round(sessions.reduce((a, s) => a + (s.focus_score || 0), 0) / sessions.length);
            const totalVids = sessions.reduce((a, s) => a + (s.videos_watched || 0), 0);
            document.getElementById('avg-score').textContent = avgScore + '%';
            document.getElementById('videos-watched').textContent = totalVids;
            renderChart(sessions);
        } else {
            // Fallback to local extension stats when cloud sessions are absent.
            const localStats = await getLocalSessionFallback();
            document.getElementById('avg-score').textContent = localStats.avgScoreLabel;
            document.getElementById('videos-watched').textContent = localStats.videosLabel;
        }
    } catch (e) {
        console.warn('Stats load failed:', e);
        document.getElementById('avg-score').textContent = '--';
        document.getElementById('videos-watched').textContent = '--';
        document.getElementById('saved-count').textContent = '--';
        document.getElementById('header-stats').textContent = 'Offline';
    }
}

async function getLocalSessionFallback() {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        return { avgScoreLabel: '--', videosLabel: '--' };
    }
    try {
        const local = await chrome.storage.local.get(['watchedScores']);
        const watchedScores = local.watchedScores || [];
        if (!watchedScores.length) {
            return { avgScoreLabel: '--', videosLabel: '--' };
        }
        const normalized = watchedScores.map(s => (s > 1 ? s : s * 100));
        const avg = Math.round(normalized.reduce((a, b) => a + b, 0) / normalized.length);
        return {
            avgScoreLabel: `${avg}%`,
            videosLabel: `${normalized.length}`
        };
    } catch (_e) {
        return { avgScoreLabel: '--', videosLabel: '--' };
    }
}

function renderChart(sessions) {
    const canvas = document.getElementById('dashboardChart');
    if (!canvas) return;

    const labels = sessions.map(s => (s.date || '').slice(5)).reverse();
    const scores = sessions.map(s => s.focus_score || 0).reverse();

    if (dashChart) dashChart.destroy();

    dashChart = new Chart(canvas, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                data: scores,
                borderColor: '#fdf0d5',
                backgroundColor: 'rgba(253,240,213,0.15)',
                fill: true,
                tension: 0.4,
                pointRadius: 3,
                pointBackgroundColor: '#fdf0d5',
                borderWidth: 2,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: {
                    ticks: { color: 'rgba(253,240,213,0.5)', font: { size: 10 } },
                    grid: { color: 'rgba(253,240,213,0.08)' }
                },
                y: {
                    min: 0, max: 100,
                    ticks: { color: 'rgba(253,240,213,0.5)', font: { size: 10 } },
                    grid: { color: 'rgba(253,240,213,0.08)' }
                }
            }
        }
    });
}

// ========================================================
//  Saved Videos
// ========================================================
async function loadSavedVideos() {
    const list = document.getElementById('saved-videos-list');
    const badge = document.getElementById('videos-badge');

    try {
        const res = await fetch(`${API_BASE_URL}/librarian/saved_videos`, { headers: getHeaders() });
        const data = await res.json();
        const videos = data.videos || [];
        const localSaved = await getLocalSavedVideosCache();
        savedVideosCache = mergeSavedVideos(videos, localSaved);

        badge.textContent = savedVideosCache.length;

        if (!savedVideosCache.length && highlightsCache.length > 0) {
            // Fallback: build a pseudo saved list from highlights so drag-to-chat still works.
            const byVideo = new Map();
            highlightsCache.forEach(h => {
                const vid = h.video_id;
                if (!vid || byVideo.has(vid)) return;
                byVideo.set(vid, {
                    video_id: vid,
                    title: h.video_title || vid,
                    save_mode: 'from_highlights',
                    description: 'Recovered from highlights',
                    thumbnail_url: h.thumbnail_url || ''
                });
            });
            savedVideosCache = Array.from(byVideo.values());
        }

        if (!savedVideosCache.length) {
            badge.textContent = '0';
            updateSavedVideoStats(0);
            list.innerHTML = '<div class="empty-state">No saved videos yet. Use the extension to save videos!</div>';
            return;
        }

        badge.textContent = `${savedVideosCache.length}`;
        updateSavedVideoStats(savedVideosCache.length);
        list.innerHTML = savedVideosCache.map((v, i) => `
      <div class="video-item"
           draggable="true"
           data-idx="${i}"
           onclick="window.open('${esc(getWatchUrl(v))}','_blank')">
        <div class="video-title">${esc(v.title || v.video_id)}</div>
        <div class="video-meta">
          <span class="save-mode-badge">
            ${v.save_mode === 'link_only' ? '⊙ Link only' : (v.save_mode === 'from_highlights' ? '✦ From highlights' : '✦ Transcript indexed')}
          </span>
          ${v.description ? `<span style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(v.description)}</span>` : ''}
        </div>
      </div>
    `).join('');

        // Drag start/end on video items
        list.querySelectorAll('.video-item').forEach(el => {
            el.addEventListener('dragstart', e => {
                const idx = el.dataset.idx;
                e.dataTransfer.effectAllowed = 'copy';
                e.dataTransfer.setData('application/json', JSON.stringify(savedVideosCache[idx]));
                el.classList.add('dragging');
            });
            el.addEventListener('dragend', () => el.classList.remove('dragging'));
        });
    } catch (e) {
        console.warn('Saved videos load failed:', e);
        const localSaved = await getLocalSavedVideosCache();
        if (localSaved.length) {
            savedVideosCache = localSaved;
            badge.textContent = `${savedVideosCache.length}`;
            updateSavedVideoStats(savedVideosCache.length);
            list.innerHTML = savedVideosCache.map((v, i) => `
      <div class="video-item"
           draggable="true"
           data-idx="${i}"
           onclick="window.open('${esc(getWatchUrl(v))}','_blank')">
        <div class="video-title">${esc(v.title || v.video_id)}</div>
        <div class="video-meta">
          <span class="save-mode-badge">✦ Local cache</span>
          ${v.description ? `<span style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(v.description)}</span>` : ''}
        </div>
      </div>
    `).join('');
            return;
        }
        list.innerHTML = '<div class="empty-state">Could not load saved videos.</div>';
    }
}

async function getLocalSavedVideosCache() {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return [];
    try {
        const data = await chrome.storage.local.get(['localSavedVideos']);
        return Array.isArray(data.localSavedVideos) ? data.localSavedVideos : [];
    } catch (_e) {
        return [];
    }
}

function mergeSavedVideos(primary, secondary) {
    const byVideo = new Map();
    (primary || []).forEach((v) => {
        if (!v?.video_id) return;
        byVideo.set(v.video_id, v);
    });
    (secondary || []).forEach((v) => {
        if (!v?.video_id || byVideo.has(v.video_id)) return;
        byVideo.set(v.video_id, v);
    });
    return Array.from(byVideo.values());
}

// ========================================================
//  Recent Sessions
// ========================================================
async function loadRecentSessions() {
    const list = document.getElementById('sessions-list');

    try {
        const res = await fetch(`${API_BASE_URL}/firestore/sessions?limit=10`, { headers: getHeaders() });
        const data = await res.json();
        const sessions = data.sessions || [];

        if (!sessions.length) {
            const localStats = await getLocalSessionFallback();
            if (localStats.videosLabel !== '--') {
                list.innerHTML = `
          <div class="session-item">
            <div class="session-date">Local session cache</div>
            <div class="session-stats">
              <span>⊕ ${esc(localStats.avgScoreLabel)} focus</span>
              <span>▶ ${esc(localStats.videosLabel)} videos</span>
            </div>
          </div>`;
                return;
            }
            list.innerHTML = '<div class="empty-state">No sessions recorded yet.</div>';
            return;
        }

        list.innerHTML = sessions.map(s => `
      <div class="session-item">
        <div class="session-date">${esc(s.date || 'Unknown')}</div>
        <div class="session-stats">
          <span>⊕ ${s.focus_score || 0}% focus</span>
          <span>▶ ${s.videos_watched || 0} videos</span>
          <span>⊙ ${s.highlights_count || 0} highlights</span>
        </div>
      </div>
    `).join('');
    } catch (e) {
        console.warn('Sessions load failed:', e);
        list.innerHTML = '<div class="empty-state">Could not load sessions.</div>';
    }
}

// ========================================================
//  Highlights
// ========================================================
async function loadHighlights() {
    const list = document.getElementById('highlights-list');
    const badge = document.getElementById('highlights-badge');

    try {
        const res = await fetch(`${API_BASE_URL}/librarian/get_highlights`, { headers: getHeaders() });
        const data = await res.json();
        const highlights = data.highlights || [];
        highlightsCache = highlights;

        badge.textContent = highlights.length;

        if (!highlights.length) {
            list.innerHTML = '<div class="empty-state">No highlights yet. Highlight moments while watching!</div>';
            return;
        }

        list.innerHTML = highlights.map((h, idx) => `
      <div class="highlight-item" draggable="true" data-hidx="${idx}" onclick="window.open('${esc(getHighlightWatchUrl(h))}','_blank')">
        <div class="highlight-meta">
          <span class="highlight-timestamp">${esc(h.range_label || formatTime(h.timestamp || 0))}</span>
          <span class="highlight-video-name">${esc(h.video_title || h.video_id || '')}</span>
        </div>
        <div class="highlight-text">"${esc(h.note || h.text || h.transcript || 'Highlight saved')}"</div>
        ${h.note && h.transcript ? `<div class="highlight-note">${esc(h.transcript.slice(0, 180))}${h.transcript.length > 180 ? '...' : ''}</div>` : ''}
      </div>
    `).join('');

        // Drag start/end on highlight items for focused chat context.
        list.querySelectorAll('.highlight-item').forEach(el => {
            el.addEventListener('dragstart', e => {
                const idx = Number(el.dataset.hidx || -1);
                const h = highlightsCache[idx];
                if (!h || !h.video_id) return;
                const payload = {
                    video_id: h.video_id,
                    title: h.video_title || `Video ${h.video_id}`,
                    description: h.note || h.transcript || '',
                    from: 'highlight'
                };
                e.dataTransfer.effectAllowed = 'copy';
                e.dataTransfer.setData('application/json', JSON.stringify(payload));
                el.classList.add('dragging');
            });
            el.addEventListener('dragend', () => el.classList.remove('dragging'));
        });

        if (!savedVideosCache.length && highlights.length > 0) {
            // Rebuild saved-video panel using highlight-derived fallback entries.
            loadSavedVideos();
        }
    } catch (e) {
        console.warn('Highlights load failed:', e);
        list.innerHTML = '<div class="empty-state">Could not load highlights.</div>';
    }
}

async function loadFilteredCounter() {
    const totalEl = document.getElementById('filtered-total');
    const listEl = document.getElementById('filtered-popup-list');
    if (!totalEl || !listEl) return;

    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        totalEl.textContent = '0';
        listEl.innerHTML = '<div class="removed-popup-empty">Available inside extension context only.</div>';
        return;
    }

    try {
        const local = await chrome.storage.local.get(['filteredVideosRemovedTotal', 'filteredVideosRemovedRecent']);
        const total = Number(local.filteredVideosRemovedTotal || 0);
        filteredRemovedCache = Array.isArray(local.filteredVideosRemovedRecent) ? local.filteredVideosRemovedRecent : [];
        totalEl.textContent = `${total}`;

        if (!filteredRemovedCache.length) {
            listEl.innerHTML = '<div class="removed-popup-empty">No filtered videos recorded yet.</div>';
            return;
        }

        listEl.innerHTML = filteredRemovedCache.slice(0, 20).map((item) => `
      <a class="removed-item" href="${esc(item.url || `https://youtube.com/watch?v=${item.video_id || ''}`)}" target="_blank" rel="noopener noreferrer">
        <img class="removed-thumb" src="${esc(item.thumbnail_url || '')}" alt="thumbnail">
        <div class="removed-meta">
          <div class="removed-title">${esc(item.title || item.video_id || 'Removed video')}</div>
          <div class="removed-reason">${esc((item.reason || 'filtered').replace(/_/g, ' '))}</div>
        </div>
      </a>
    `).join('');
    } catch (e) {
        console.warn('Filtered counter load failed:', e);
        totalEl.textContent = '0';
        listEl.innerHTML = '<div class="removed-popup-empty">Could not load removed videos.</div>';
    }
}

function setupSystemDetailsModal() {
    const openBtn = document.getElementById('system-details-btn');
    const modal = document.getElementById('system-details-modal');
    const closeBtn = document.getElementById('system-details-close');
    const grid = document.getElementById('system-details-grid');
    if (!openBtn || !modal || !closeBtn || !grid) return;

    const blockedChannels = Array.isArray(self.TUBEFOCUS_ENTERTAINMENT_CHANNELS)
        ? self.TUBEFOCUS_ENTERTAINMENT_CHANNELS
        : [];

    const cards = [
        {
            title: 'RAG + Models',
            body: [
                'Chat model: gemini-2.0-flash',
                'Embeddings: models/text-embedding-004',
                'Vector store: Firestore vector search (cosine)',
                'Flow: retrieve -> source-card enrich -> generate'
            ].join('\n')
        },
        {
            title: 'Chunking Strategy',
            body: [
                'Tier 1: video summary (LLM-generated)',
                'Tier 2: ~90s temporal windows',
                'Tier 3: ~20s windows with 10s overlap',
                'Fallback: 500-char flat chunks when timestamps unavailable'
            ].join('\n')
        },
        {
            title: 'Core Prompts',
            body: [
                'Score mode: title_and_description',
                'Summary prompt: "Summarize this video transcript in 2-3 sentences..."',
                'Librarian system prompt: "Use only the user\'s saved library context..."'
            ].join('\n')
        },
        {
            title: 'Filter Logic',
            body: [
                'Blocked entertainment channels + keyword checks',
                'Local logistic model threshold: 0.45',
                'Heuristic drop: entertainment pattern + no goal overlap'
            ].join('\n')
        },
        {
            title: `Blocked Channels (${blockedChannels.length})`,
            body: blockedChannels.length ? blockedChannels.join('\n') : 'No blocklist loaded.'
        },
        {
            title: 'Telemetry Counters',
            body: [
                'filteredVideosRemovedTotal: cumulative removed count',
                'filteredVideosRemovedRecent: latest removed videos',
                'watchedScores: session score stream'
            ].join('\n')
        }
    ];

    const html = cards.map((card) => `
    <section class="details-card">
      <div class="details-card-title">${esc(card.title)}</div>
      <pre>${esc(card.body)}</pre>
    </section>
  `).join('');

    openBtn.addEventListener('click', () => {
        grid.innerHTML = html;
        modal.classList.add('open');
    });
    closeBtn.addEventListener('click', () => modal.classList.remove('open'));
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('open');
    });
}

// ========================================================
//  Chat
// ========================================================
function setupChat() {
    const input = document.getElementById('chat-input');
    const btn = document.getElementById('send-btn');
    const dropZone = document.getElementById('chat-drop-zone');
    const clearBtn = document.getElementById('chat-context-clear');

    btn.addEventListener('click', sendMessage);
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Drag-drop zone
    dropZone.addEventListener('dragover', e => {
        e.preventDefault();
        dropZone.classList.add('drag-target');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-target'));
    dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.classList.remove('drag-target');
        try {
            const video = JSON.parse(e.dataTransfer.getData('application/json'));
            if (video && video.video_id) {
                setContextVideo(video);
                input.value = `Tell me about "${video.title}" and its key highlights.`;
                input.focus();
            }
        } catch (err) { console.error('Drop parse error:', err); }
    });

    // Clear context
    clearBtn.addEventListener('click', () => clearContext());
}

function setContextVideo(video) {
    contextVideo = video;
    const chip = document.getElementById('chat-context-chip');
    const label = document.getElementById('chat-context-label');
    const badge = document.getElementById('focus-badge');
    chip.classList.add('active');
    label.innerHTML = `Focused: <strong>${esc(video.title)}</strong>`;
    badge.style.display = 'inline-flex';
}

function clearContext() {
    contextVideo = null;
    document.getElementById('chat-context-chip').classList.remove('active');
    document.getElementById('focus-badge').style.display = 'none';
}

async function sendMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    const history = document.getElementById('chat-history');

    // User message
    appendMessage('user', text);
    input.value = '';

    // Loading
    const loadingId = 'loading-' + Date.now();
    appendMessage('bot', 'Searching knowledge base...', loadingId, true);

    try {
        // Local deterministic fallback for inventory-style queries.
        if (isSavedInventoryQuery(text) && savedVideosCache.length > 0) {
            const loadingEl = document.getElementById(loadingId);
            if (loadingEl) loadingEl.remove();
            const local = buildLocalInventoryResponse(text);
            appendMessageWithSources('bot', local.answer, local.sources);
            history.scrollTop = history.scrollHeight;
            return;
        }

        const body = { query: text };
        if (contextVideo) body.focus_video_id = contextVideo.video_id;

        const res = await fetch(`${API_BASE_URL}/librarian/chat`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();

        // Remove loading
        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) loadingEl.remove();

        // Bot answer
        const payload = data.response || data || {};
        let answerText = payload.answer || 'I could not find relevant information.';
        let sources = payload.sources || [];

        // If backend claims empty inventory but dashboard already has videos, answer locally.
        const backendEmptyInventory = /do not have any saved videos|could not find matching saved videos/i.test(answerText.toLowerCase());
        if (backendEmptyInventory && savedVideosCache.length > 0) {
            const local = buildLocalInventoryResponse(text);
            answerText = local.answer;
            sources = local.sources;
        }

        appendMessageWithSources('bot', answerText, sources);

    } catch (e) {
        console.error('Chat error:', e);
        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) loadingEl.remove();
        appendMessage('bot', 'Sorry, I could not reach the knowledge base right now.');
    }

    // Scroll to bottom
    history.scrollTop = history.scrollHeight;
}

function appendMessage(type, text, id, isLoading) {
    const history = document.getElementById('chat-history');
    const div = document.createElement('div');
    div.className = `message ${type}${isLoading ? ' loading' : ''}`;
    if (id) div.id = id;
    div.textContent = text;
    history.appendChild(div);
    history.scrollTop = history.scrollHeight;
}

function appendMessageWithSources(type, text, sources) {
    const history = document.getElementById('chat-history');
    const wrapper = document.createElement('div');

    // Message bubble
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${type}`;
    msgDiv.textContent = text;
    wrapper.appendChild(msgDiv);

    // Source cards
    if (sources && sources.length > 0) {
        const cardsDiv = document.createElement('div');
        cardsDiv.className = 'source-cards';

        sources.forEach(source => {
            const card = document.createElement('div');
            card.className = 'source-card';

            let html = `<div class="source-title">${esc(source.title || 'Video')}</div>`;

            const inExtensionPage = window.location.protocol === 'chrome-extension:';

            // YouTube preview: avoid iframe embeds in extension pages due Error 153.
            const embedUrl = normalizeEmbedUrl(source.embed_url, source.video_id);
            if (!inExtensionPage && embedUrl) {
                html += `<iframe class="source-embed"
          src="${esc(embedUrl)}"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen></iframe>`;
            } else if (source.video_id) {
                const thumb = getSourceThumbnail(source);
                const watchUrl = source.video_url || getWatchUrl(source);
                if (thumb) {
                    html += `<a href="${esc(watchUrl)}" target="_blank" rel="noopener noreferrer" style="display:block;position:relative;margin-bottom:10px;">
            <img src="${esc(thumb)}" alt="thumbnail" style="width:100%;height:200px;object-fit:cover;border-radius:8px;background:#000;">
            <span style="position:absolute;right:10px;bottom:10px;background:rgba(0,0,0,0.7);color:#fff;padding:6px 10px;border-radius:999px;font-size:12px;">Open on YouTube</span>
          </a>`;
                } else {
                    html += `<a href="${esc(watchUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-bottom:10px;font-size:12px;">Open on YouTube</a>`;
                }
            }

            // Summary
            if (source.summary) {
                html += `<div class="source-summary">${esc(source.summary)}</div>`;
            }

            // Highlights
            const highlights = source.highlights || [];
            if (highlights.length > 0) {
                html += `<div class="source-highlights">
          <div class="source-highlights-title">Your Highlights (${highlights.length})</div>`;

                highlights.forEach(h => {
                    const ts = h.timestamp || 0;
                    html += `<div class="source-highlight-item" onclick="jumpToTimestamp('${esc(source.video_id)}',${ts})">
            <span class="source-highlight-time">${esc(h.range_label || formatTime(ts))}</span>
            <span class="source-highlight-text">
              ${esc(h.note || h.text || h.transcript || '')}
              ${h.note ? `<span class="source-highlight-note">Note: ${esc(h.note)}</span>` : ''}
            </span>
            <span class="source-highlight-play">▶</span>
          </div>`;
                });

                html += '</div>';
            }

            card.innerHTML = html;
            cardsDiv.appendChild(card);
        });

        wrapper.appendChild(cardsDiv);
    }

    history.appendChild(wrapper);
    history.scrollTop = history.scrollHeight;
}

function jumpToTimestamp(videoId, timestamp) {
    // Find the iframe for this video and update its src with timestamp
    const normalizedId = extractYoutubeId(videoId);
    if (!normalizedId) return;
    const iframes = document.querySelectorAll('.source-embed');
    iframes.forEach(iframe => {
        if (iframe.src.includes(normalizedId)) {
            iframe.src = `https://www.youtube.com/embed/${normalizedId}?start=${timestamp}&autoplay=1`;
        }
    });
}

// ========================================================
//  Helpers
// ========================================================
async function checkBackendStatus() {
    const statusEl = document.getElementById('backend-status');
    if (!statusEl) return;
    setBackendStatus(statusEl, 'connecting');
    try {
        const res = await fetch(`${API_BASE_URL}/health`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setBackendStatus(statusEl, 'online');
    } catch (e) {
        console.warn('Backend health check failed:', e);
        setBackendStatus(statusEl, 'offline');
    }
}

function setBackendStatus(el, state) {
    el.classList.remove('online', 'offline');
    const label = el.querySelector('.status-text');
    if (state === 'online') {
        el.classList.add('online');
        if (label) label.textContent = 'Backend connected';
        return;
    }
    if (state === 'offline') {
        el.classList.add('offline');
        if (label) label.textContent = 'Backend offline';
        return;
    }
    if (label) label.textContent = 'Connecting';
}

function updateSavedVideoStats(count) {
    const headerStats = document.getElementById('header-stats');
    const savedCount = document.getElementById('saved-count');
    if (savedCount) savedCount.textContent = count;
    if (headerStats) headerStats.textContent = `${count} saved videos`;
}

function extractYoutubeId(value) {
    const raw = (value || '').trim();
    if (!raw) return '';
    if (raw.includes('youtube.com') || raw.includes('youtu.be')) {
        const match = raw.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
        if (match) return match[1];
    }
    return raw.length === 11 ? raw : '';
}

function normalizeEmbedUrl(embedUrl, videoId) {
    const id = extractYoutubeId(embedUrl || '') || extractYoutubeId(videoId || '');
    if (!id) return '';
    return `https://www.youtube.com/embed/${id}`;
}

function getSourceThumbnail(source) {
    if (source?.thumbnail_url) return source.thumbnail_url;
    const id = extractYoutubeId(source?.video_id || source?.video_url || source?.embed_url || '');
    if (!id) return '';
    return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

function isSavedInventoryQuery(query) {
    const text = (query || '').toLowerCase();
    const inventoryTerms = ['do i have', 'how many', 'show', 'list', 'any', 'is there', 'what are'];
    const libraryTerms = ['saved', 'library', 'videos', 'video'];
    return inventoryTerms.some(t => text.includes(t)) && libraryTerms.some(t => text.includes(t));
}

function buildLocalInventoryResponse(query) {
    const text = (query || '').toLowerCase();
    const rawTokens = text.replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
    const stop = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'have', 'any', 'video', 'videos', 'saved', 'library', 'in', 'my', 'there', 'is', 'are', 'do', 'i', 'by', 'about', 'show', 'list']);
    const tokens = rawTokens.filter(t => t.length > 2 && !stop.has(t));

    const scored = savedVideosCache.map((v) => {
        const hay = `${(v.title || '').toLowerCase()} ${(v.description || '').toLowerCase()}`;
        const score = tokens.length ? tokens.reduce((n, t) => n + (hay.includes(t) ? 1 : 0), 0) : 1;
        return { score, video: v };
    }).filter(item => item.score > 0);

    scored.sort((a, b) => b.score - a.score);
    const matches = scored.length ? scored.map(item => item.video) : savedVideosCache;
    const top = matches.slice(0, 3);

    const lines = [`Yes. I found ${matches.length} saved video(s) in your library.`];
    top.forEach((v) => {
        lines.push(`- ${v.title || v.video_id}`);
    });

    return { answer: lines.join('\n'), sources: top };
}

function getWatchUrl(video) {
    if (!video) return '#';
    if (video.video_url) return video.video_url;
    const id = extractYoutubeId(video.video_id || '');
    if (!id) return '#';
    return `https://youtube.com/watch?v=${id}`;
}

function getHighlightWatchUrl(highlight) {
    const id = extractYoutubeId(highlight?.video_id || '');
    if (!id) return '#';
    const ts = Math.max(0, Number(highlight?.timestamp || 0));
    return `https://youtube.com/watch?v=${id}${ts ? `&t=${Math.floor(ts)}s` : ''}`;
}

function formatTime(seconds) {
    const s = Math.floor(seconds);
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
}
