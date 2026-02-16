/* ==============================
   TubeFocus Dashboard – app.js
   ============================== */

// ---------- Config ----------
const API_BASE_URL = 'https://tubefocus-backend-320520374498.us-central1.run.app';
let AUTH_TOKEN = '';

function getHeaders() {
    const h = { 'Content-Type': 'application/json' };
    if (AUTH_TOKEN) h['Authorization'] = `Bearer ${AUTH_TOKEN}`;
    return h;
}

// ---------- State ----------
let contextVideo = null;   // Dragged video for focused-mode chat
let dashChart = null;      // Chart.js instance
let savedVideosCache = []; // Cache for drag source

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
    // Get token from Chrome storage if available
    if (typeof chrome !== 'undefined' && chrome.storage) {
        try {
            const data = await chrome.storage.local.get(['authToken']);
            if (data.authToken) AUTH_TOKEN = data.authToken;
        } catch (e) { /* not in extension context */ }
    }

    // Load all panels
    loadStatsPanel();
    loadSavedVideos();
    loadRecentSessions();
    loadHighlights();
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

        document.getElementById('saved-count').textContent = videos.length;
        document.getElementById('header-stats').textContent = `${videos.length} saved videos`;

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
            document.getElementById('avg-score').textContent = '--';
            document.getElementById('videos-watched').textContent = '--';
        }
    } catch (e) {
        console.warn('Stats load failed:', e);
        document.getElementById('avg-score').textContent = '--';
        document.getElementById('videos-watched').textContent = '--';
        document.getElementById('saved-count').textContent = '--';
        document.getElementById('header-stats').textContent = 'Offline';
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
        savedVideosCache = videos;

        badge.textContent = videos.length;

        if (!videos.length) {
            list.innerHTML = '<div class="empty-state">No saved videos yet. Use the extension to save videos!</div>';
            return;
        }

        list.innerHTML = videos.map((v, i) => `
      <div class="video-item"
           draggable="true"
           data-idx="${i}"
           onclick="window.open('https://youtube.com/watch?v=${esc(v.video_id)}','_blank')">
        <div class="video-title">${esc(v.title || v.video_id)}</div>
        <div class="video-meta">
          <span class="save-mode-badge">
            ${v.save_mode === 'link_only' ? '⊙ Link only' : '✦ Transcript indexed'}
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
        list.innerHTML = '<div class="empty-state">Could not load saved videos.</div>';
    }
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

        badge.textContent = highlights.length;

        if (!highlights.length) {
            list.innerHTML = '<div class="empty-state">No highlights yet. Highlight moments while watching!</div>';
            return;
        }

        list.innerHTML = highlights.map(h => `
      <div class="highlight-item">
        <div class="highlight-meta">
          <span class="highlight-timestamp">${formatTime(h.timestamp || 0)}</span>
          <span class="highlight-video-name">${esc(h.video_title || h.video_id || '')}</span>
        </div>
        <div class="highlight-text">"${esc(h.text || '')}"</div>
        ${h.note ? `<div class="highlight-note">${esc(h.note)}</div>` : ''}
      </div>
    `).join('');
    } catch (e) {
        console.warn('Highlights load failed:', e);
        list.innerHTML = '<div class="empty-state">Could not load highlights.</div>';
    }
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
        const body = { query: text };
        if (contextVideo) body.focus_video_id = contextVideo.video_id;

        const res = await fetch(`${API_BASE_URL}/librarian/chat`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(body),
        });
        const data = await res.json();

        // Remove loading
        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) loadingEl.remove();

        // Bot answer
        const answerText = data.answer || data.response || 'I could not find relevant information.';
        const sources = data.sources || [];
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

            // YouTube embed
            if (source.video_id) {
                html += `<iframe class="source-embed"
          src="https://www.youtube.com/embed/${esc(source.video_id)}"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen></iframe>`;
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
            <span class="source-highlight-time">${formatTime(ts)}</span>
            <span class="source-highlight-text">
              ${esc(h.text || '')}
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
    const iframes = document.querySelectorAll('.source-embed');
    iframes.forEach(iframe => {
        if (iframe.src.includes(videoId)) {
            iframe.src = `https://www.youtube.com/embed/${videoId}?start=${timestamp}&autoplay=1`;
        }
    });
}

// ========================================================
//  Helpers
// ========================================================
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
