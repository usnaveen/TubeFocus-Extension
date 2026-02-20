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
let attachedHighlight = null; // Highlight attached to next chat message
let chatHistory = [];      // Conversation history for multi-turn chat
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
        <button class="item-delete-btn" onclick="deleteVideo(event, '${esc(v.video_id)}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"/></svg>
        </button>
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
      <div class="highlight-item" draggable="true" data-hidx="${idx}">
        <button class="item-delete-btn" onclick="deleteHighlight(event, '${esc(h.id || '')}')" style="top:10px; right:12px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"/></svg>
        </button>
        <div class="highlight-meta" style="padding-right: 32px;">
          <span class="highlight-timestamp" onclick="window.open('${esc(getHighlightWatchUrl(h))}','_blank')">${esc(h.range_label || formatTime(h.timestamp || 0))}</span>
          <span class="highlight-video-name">${esc(h.video_title || h.video_id || '')}</span>
          <button class="highlight-ask-btn" data-hidx="${idx}" title="Ask about this highlight">Ask AI</button>
        </div>
        <div class="highlight-text" onclick="window.open('${esc(getHighlightWatchUrl(h))}','_blank')">"${esc(h.note || h.text || h.transcript || 'Highlight saved')}"</div>
        ${h.note && h.transcript ? `<div class="highlight-note">${esc(h.transcript.slice(0, 180))}${h.transcript.length > 180 ? '...' : ''}</div>` : ''}
      </div>
    `).join('');

        // "Ask about this" button on highlight cards
        list.querySelectorAll('.highlight-ask-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                const idx = Number(btn.dataset.hidx);
                const h = highlightsCache[idx];
                if (!h) return;
                attachHighlightToChat(h);
            });
        });

        // Drag start/end on highlight items — sends FULL highlight data for chat context.
        list.querySelectorAll('.highlight-item').forEach(el => {
            el.addEventListener('dragstart', e => {
                const idx = Number(el.dataset.hidx || -1);
                const h = highlightsCache[idx];
                if (!h || !h.video_id) return;
                const payload = {
                    video_id: h.video_id,
                    video_title: h.video_title || `Video ${h.video_id}`,
                    title: h.video_title || `Video ${h.video_id}`,
                    range_label: h.range_label || '',
                    note: h.note || '',
                    transcript: h.transcript || '',
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

async function deleteHighlight(event, highlightId) {
    event.stopPropagation();
    if (!highlightId) {
        alert("Cannot delete this highlight (missing ID).");
        return;
    }
    if (!confirm("Are you sure you want to delete this highlight?")) return;

    const btn = event.currentTarget;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span style="font-size:10px;">...</span>';

    try {
        const res = await fetch(`${API_BASE_URL}/highlights/${highlightId}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        const data = await res.json();

        if (res.ok && data.success) {
            // Remove from UI immediately
            const item = btn.closest('.highlight-item');
            if (item) item.remove();

            // Re-fetch to update badge and cached arrays
            loadHighlights();
        } else {
            console.error('Delete failed:', data);
            alert("Failed to delete highlight: " + (data.error || data.message || "Unknown error"));
            btn.innerHTML = originalText;
        }
    } catch (err) {
        console.error('Delete error:', err);
        alert("Failed to delete highlight due to networking error.");
        btn.innerHTML = originalText;
    }
}

async function deleteVideo(event, videoId) {
    event.stopPropagation();
    if (!videoId) return;
    if (!confirm("Are you sure you want to delete this video and all its chunks?")) return;

    const btn = event.currentTarget;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span style="font-size:10px;">...</span>';

    try {
        const res = await fetch(`${API_BASE_URL}/librarian/video/${videoId}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        const data = await res.json();

        if (res.ok && data.success) {
            const item = btn.closest('.video-item');
            if (item) item.remove();

            loadSavedVideos();
        } else {
            console.error('Delete failed:', data);
            alert("Failed to delete video: " + (data.error || data.message || "Unknown error"));
            btn.innerHTML = originalText;
        }
    } catch (err) {
        console.error('Delete error:', err);
        alert("Failed to delete video due to networking error.");
        btn.innerHTML = originalText;
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
            const payload = JSON.parse(e.dataTransfer.getData('application/json'));
            if (payload && payload.video_id) {
                if (payload.from === 'highlight') {
                    // Dropped a highlight — attach it with full context
                    attachHighlightToChat(payload);
                } else {
                    // Dropped a video
                    setContextVideo(payload);
                    input.value = `Tell me about "${payload.title}" and its key highlights.`;
                    input.focus();
                }
            }
        } catch (err) { console.error('Drop parse error:', err); }
    });

    // Clear context
    clearBtn.addEventListener('click', () => clearContext());
}

function setContextVideo(video) {
    contextVideo = video;
    attachedHighlight = null; // Clear any attached highlight when setting video context
    const chip = document.getElementById('chat-context-chip');
    const label = document.getElementById('chat-context-label');
    const badge = document.getElementById('focus-badge');
    chip.classList.add('active');
    label.innerHTML = `Focused: <strong>${esc(video.title)}</strong>`;
    badge.style.display = 'inline-flex';
}

function attachHighlightToChat(highlight) {
    const videoContext = {
        video_id: highlight.video_id,
        title: highlight.video_title || `Video ${highlight.video_id}`
    };
    setContextVideo(videoContext);

    attachedHighlight = {
        video_id: highlight.video_id,
        video_title: highlight.video_title || '',
        range_label: highlight.range_label || '',
        note: highlight.note || '',
        transcript: highlight.transcript || ''
    };

    // Update chip to show highlight info
    const label = document.getElementById('chat-context-label');
    const rangeInfo = highlight.range_label ? ` [${highlight.range_label}]` : '';
    label.innerHTML = `Highlight: <strong>${esc(highlight.video_title || 'Video')}${rangeInfo}</strong>`;

    // Pre-populate chat input
    const input = document.getElementById('chat-input');
    const rangeText = highlight.range_label ? ` at ${highlight.range_label}` : '';
    input.value = `Tell me about my highlight${rangeText} on "${highlight.video_title || 'this video'}"`;
    input.focus();

    // Scroll to chat
    document.getElementById('chat-drop-zone').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function clearContext() {
    contextVideo = null;
    attachedHighlight = null;
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

    // Track user message in chat history
    chatHistory.push({ role: 'user', content: text });

    // Capture and clear attached highlight (used once per message)
    const currentAttachedHighlight = attachedHighlight;
    attachedHighlight = null;

    // Loading
    const loadingId = 'loading-' + Date.now();
    appendMessage('bot', 'Searching knowledge base...', loadingId, true);

    try {
        const body = { query: text };
        if (contextVideo) body.focus_video_id = contextVideo.video_id;

        // Send conversation history (last 6 messages for context)
        if (chatHistory.length > 1) {
            body.chat_history = chatHistory.slice(-7, -1); // Exclude the current message (already in query)
        }

        // Send attached highlight if present
        if (currentAttachedHighlight) {
            body.attached_highlight = currentAttachedHighlight;
        }

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
        const answerText = payload.answer || 'I could not find relevant information.';
        const sources = payload.sources || [];
        appendMessageWithSources('bot', answerText, sources, payload.meta || null);

        // Track assistant response in chat history
        chatHistory.push({ role: 'assistant', content: answerText });

        // Keep chat history bounded (last 10 messages)
        if (chatHistory.length > 10) {
            chatHistory = chatHistory.slice(-10);
        }

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

    // Parse Markdown for bot messages, plain text for user/loading
    if (type === 'bot' && !isLoading) {
        div.innerHTML = parseSimpleMarkdown(text);
    } else {
        div.textContent = text;
    }

    history.appendChild(div);
    history.scrollTop = history.scrollHeight;
}

function appendMessageWithSources(type, text, sources, meta = null) {
    const history = document.getElementById('chat-history');
    const wrapper = document.createElement('div');

    // Message bubble with Markdown
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${type}`;
    msgDiv.innerHTML = parseSimpleMarkdown(text);
    wrapper.appendChild(msgDiv);

    if (meta && type === 'bot') {
        const trace = document.createElement('div');
        const usedLlm = meta.used_llm === true;
        const focus = meta.focus_video_id ? ` | focus: ${meta.focus_video_id}` : '';
        const inferred = meta.inferred_focus ? ' | inferred focus' : '';
        trace.textContent = `RAG mode: ${usedLlm ? 'LLM' : 'Grounded fallback'}${focus}${inferred}`;
        trace.style.cssText = 'font-size:11px;opacity:0.7;margin:6px 4px 2px 6px;';
        wrapper.appendChild(trace);
    }

    // Source cards
    if (sources && sources.length > 0) {
        const cardsDiv = document.createElement('div');
        cardsDiv.className = 'source-cards';

        sources.forEach(source => {
            // SKIP rendering the card if it matches the current focused video
            // (The user already sees the big player/focus card for this video)
            if (meta && meta.focus_video_id) {
                const srcId = extractYoutubeId(source.video_id);
                const focusId = extractYoutubeId(meta.focus_video_id);
                if (srcId && focusId && srcId === focusId) {
                    return;
                }
            }

            // Also skip if it matches the manually set context contextVideo context
            if (contextVideo && contextVideo.video_id) {
                const srcId = extractYoutubeId(source.video_id);
                const ctxId = extractYoutubeId(contextVideo.video_id);
                if (srcId && ctxId && srcId === ctxId) {
                    return;
                }
            }

            const card = document.createElement('div');
            card.className = 'source-card';

            let html = `<div class="source-title">${esc(source.title || 'Video')}</div>`;

            const inExtensionPage = window.location.protocol === 'chrome-extension:';

            // Generate the embed URL
            let embedUrl = '';
            if (source.video_id) {
                // Ensure the domain matches the environment to avoid CSP/Error 153 issues if possible, 
                // but standard youtube-nocookie is usually safest for extensions.
                embedUrl = `https://www.youtube-nocookie.com/embed/${esc(source.video_id)}?enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`;
            }

            // Always render the player iframe if we have an embed URL, or fallback to thumbnail
            if (embedUrl) {
                const uniquePlayerId = `youtube-player-${source.video_id}-${Date.now()}`;
                html += `<div class="video-player-container" style="position:relative; padding-bottom:56.25%; height:0; overflow:hidden; margin-bottom:10px; border-radius:8px; background:#000;">
                    <iframe id="${uniquePlayerId}" src="${esc(embedUrl)}" 
                        style="position:absolute; top:0; left:0; width:100%; height:100%; border:0;" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowfullscreen>
                    </iframe>
                </div>`;

                // Add to highlight click tracking so we know which iframe to target
                card.dataset.playerId = uniquePlayerId;
                card.dataset.videoId = source.video_id;

            } else if (source.video_id) {
                const thumb = `https://i.ytimg.com/vi/${esc(source.video_id)}/hqdefault.jpg`;
                const watchUrl = `https://www.youtube.com/watch?v=${esc(source.video_id)}`;
                html += `<a href="${esc(watchUrl)}" target="_blank" rel="noopener noreferrer" style="display:block;position:relative;margin-bottom:10px;">
                    <img src="${esc(thumb)}" alt="thumbnail" style="width:100%;height:200px;object-fit:cover;border-radius:8px;background:#000;">
                    <span style="position:absolute;right:10px;bottom:10px;background:rgba(0,0,0,0.7);color:#fff;padding:6px 10px;border-radius:999px;font-size:12px;">Open on YouTube</span>
                </a>`;
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
                    // Pass the video_id and timestamp to the new play logic
                    html += `<div class="source-highlight-item" onclick="playInIframe(this, '${esc(source.video_id)}', ${ts})">
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

        // Only append wrapper if we actually added cards (didn't skip all of them)
        if (cardsDiv.children.length > 0) {
            wrapper.appendChild(cardsDiv);
        }
    }

    history.appendChild(wrapper);
    history.scrollTop = history.scrollHeight;
}

function parseSimpleMarkdown(text) {
    if (!text) return '';

    // Escape HTML first to prevent XSS
    let html = text.replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    // Bold (**text**)
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Italic (*text*)
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Headers (### text)
    html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');

    // Lists (- item)
    // We wrap lists in <ul> if we find consecutive lines starting with -
    // Simple approach: just replace "- " with a bullet point char or styled span
    // Better approach: convert to proper <ul> but regex is tricky. 
    // Let's go with a simple clean replacement for now:
    html = html.replace(/^- (.*$)/gm, '• $1');

    // Newlines to <br>
    html = html.replace(/\n/g, '<br>');

    return html;
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

function formatTime(sec) {
    if (!Number.isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

// Global function to handle playing a highlight inside the nearest iframe
window.playInIframe = function (element, videoId, startSeconds) {
    // Traverse UP to find the source-card container
    const card = element.closest('.source-card');
    if (card && card.dataset.playerId) {
        const iframe = document.getElementById(card.dataset.playerId);
        if (iframe) {
            // Update iframe src to autoplay at the specific timestamp
            const origin = encodeURIComponent(window.location.origin);
            iframe.src = `https://www.youtube-nocookie.com/embed/${esc(videoId)}?start=${Math.floor(startSeconds)}&autoplay=1&enablejsapi=1&origin=${origin}`;

            // Add momentary highlight effect
            element.style.background = 'rgba(255, 255, 255, 0.2)';
            setTimeout(() => { element.style.background = ''; }, 300);
            return;
        }
    }

    // Fallback logic if iframe wasn't found (e.g. they are in the popup with no iframe)
    jumpToTimestamp(videoId, startSeconds);
};

// Global for inline onclick
window.jumpToTimestamp = jumpToTimestamp;
function esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
}
