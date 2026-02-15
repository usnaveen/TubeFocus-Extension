const API_BASE_URL = 'https://yt-scorer-api-933573987016.us-central1.run.app';

// --- Chart.js setup ---
let scoreChart;
function initChart(labels = [], data = []) {
    const ctx = document.getElementById('dashboardChart').getContext('2d');
    if (scoreChart) scoreChart.destroy();

    // Gradient for the line
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(253, 240, 213, 0.5)'); // primary color low opacity
    gradient.addColorStop(1, 'rgba(253, 240, 213, 0)');

    scoreChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Focus Score',
                data,
                fill: true,
                backgroundColor: gradient,
                borderWidth: 2,
                borderColor: '#fdf0d5', // var(--primary)
                pointBackgroundColor: '#c1121f', // var(--bg)
                pointBorderColor: '#fdf0d5',
                pointRadius: 4,
                pointHoverRadius: 6,
                tension: 0.4 // Smooth curves
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    display: false, // hide x axis labels for cleaner look
                    grid: { display: false }
                },
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        color: 'rgba(253, 240, 213, 0.5)',
                        font: { size: 10 }
                    },
                    grid: {
                        color: 'rgba(253, 240, 213, 0.1)'
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#fdf0d5',
                    titleColor: '#c1121f',
                    bodyColor: '#c1121f',
                    displayColors: false,
                    callbacks: {
                        label: function (context) {
                            return context.parsed.y + '% Focus';
                        }
                    }
                }
            }
        }
    });
}

function loadChartData() {
    chrome.storage.local.get(['watchedScores'], (result) => {
        const scores = result.watchedScores || [];
        // Generate dummy labels 1..N
        const labels = scores.map((_, i) => `Video ${i + 1}`);
        // Ensure scores are 0-100
        const data = scores.map(s => s > 1 ? s : s * 100);

        initChart(labels, data);

        // Also update avg score here
        if (scores.length > 0) {
            const avg = data.reduce((a, b) => a + b, 0) / data.length;
            document.getElementById('avg-score').textContent = Math.round(avg) + '%';
            document.getElementById('videos-watched').textContent = scores.length;
        }
    });
}

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
    initDashboard();

    // Attach Event Listeners
    const sendBtn = document.getElementById('send-btn');
    const chatInput = document.getElementById('chat-input');

    if (sendBtn) sendBtn.addEventListener('click', sendMessage);
    if (chatInput) chatInput.addEventListener('keypress', handleEnter);
});

function initDashboard() {
    loadSavedVideos();
    loadHighlights();
    loadSavedSummaries();
    generateWittySummary();
}

// --- API Helpers ---
async function getHeaders() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['apiKey'], (result) => {
            // For now using default key
            resolve({
                'Content-Type': 'application/json',
                'X-API-KEY': result.apiKey || 'test_key'
            });
        });
    });
}

// --- 1. Stats & Summary ---
function generateWittySummary() {
    const messages = [
        "You're learning faster than a neural net on caffeine.",
        "Your focus score is trending up! Keep avoiding the cat videos.",
        "Inductive bias? More like inductive briiliance.",
        "Data ingested. Knowledge expending. Distractions terminated.",
        "You've saved enough content to write a thesis. Time to review?"
    ];
    const randomMsg = messages[Math.floor(Math.random() * messages.length)];
    document.getElementById('witty-summary').textContent = `"${randomMsg}"`;
}

// --- 2. Bookmarked Videos ---
async function loadSavedVideos() {
    const container = document.getElementById('saved-videos-list');
    try {
        const headers = await getHeaders();
        const response = await fetch(`${API_BASE_URL}/librarian/saved_videos`, { headers });
        const data = await response.json();

        container.innerHTML = '';
        if (data.videos && data.videos.length > 0) {
            document.getElementById('saved-count').textContent = data.videos.length;

            data.videos.forEach(v => {
                const el = document.createElement('div');
                el.className = 'video-item';
                const subLabel = v.save_mode === 'link_only'
                    ? (v.description ? `📝 ${v.description}` : 'Saved link + description')
                    : 'Transcript indexed';
                const openUrl = v.video_url || (v.video_id ? `https://youtube.com/watch?v=${v.video_id}` : null);
                el.innerHTML = `
                    <div class="video-title">${v.title}</div>
                    <div class="video-meta">
                        <span>${subLabel}</span>
                    </div>
                `;
                if (openUrl) {
                    el.addEventListener('click', () => window.open(openUrl, '_blank'));
                }
                container.appendChild(el);
            });
        } else {
            container.innerHTML = '<div class="empty">No saved videos yet.</div>';
            document.getElementById('saved-count').textContent = '0';
        }
    } catch (e) {
        container.innerHTML = '<div class="empty">Error loading bookmarks.</div>';
        console.error(e);
    }
}

// --- 3. Highlights ---
async function loadHighlights() {
    const container = document.getElementById('highlights-list');
    try {
        const headers = await getHeaders();
        const response = await fetch(`${API_BASE_URL}/librarian/get_highlights`, { headers });
        const data = await response.json();

        container.innerHTML = '';
        if (data.highlights && data.highlights.length > 0) {
            data.highlights.slice(0, 15).forEach(h => {
                const el = document.createElement('div');
                el.className = 'highlight-item';
                el.innerHTML = `
                    <div class="highlight-text">"${h.text || h.note || 'Point of Interest'}"</div>
                    <div class="video-meta" style="margin-top:4px;">
                        <span>${h.video_title || 'Video'}</span>
                    </div>
                `;
                container.appendChild(el);
            });
        } else {
            container.innerHTML = '<div class="empty">No highlights yet.</div>';
        }
    } catch (e) {
        container.innerHTML = '<div class="empty">Error loading highlights.</div>';
    }
}

// --- 3.5 Summaries ---
async function loadSavedSummaries() {
    const container = document.getElementById('summaries-list');
    if (!container) return;

    try {
        const headers = await getHeaders();
        const response = await fetch(`${API_BASE_URL}/librarian/summaries`, { headers });
        const data = await response.json();

        container.innerHTML = '';
        if (data.summaries && data.summaries.length > 0) {
            data.summaries.forEach((s) => {
                const el = document.createElement('div');
                el.className = 'video-item'; // Reuse styling
                el.innerHTML = `
                    <div class="video-title">🧠 ${s.title}</div>
                    <div class="video-meta">
                        <span>${(s.summary_preset || 'youtube_ask').replace(/_/g, ' ')}</span>
                    </div>
                `;
                el.addEventListener('click', () => {
                    const summaryText = s.summary || s.text || 'No summary text available.';
                    alert(`Summary for: ${s.title}\n\n${summaryText}`);
                });
                container.appendChild(el);
            });
        } else {
            container.innerHTML = '<div class="empty">No summaries saved yet.</div>';
        }
    } catch (e) {
        container.innerHTML = '<div class="empty">Error loading summaries.</div>';
    }
}

// --- 4. Chat ---
function handleEnter(e) {
    if (e.key === 'Enter') sendMessage();
}

async function sendMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    addMessage(text, 'user');
    input.value = '';
    input.disabled = true;
    document.getElementById('send-btn').disabled = true;

    const loadingId = addMessage('Searching knowledge base...', 'bot', true);

    try {
        const headers = await getHeaders();
        const response = await fetch(`${API_BASE_URL}/librarian/chat`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ query: text })
        });
        const data = await response.json();

        document.getElementById(loadingId).remove();
        addMessage(data.response.answer, 'bot');

        if (data.response.sources && data.response.sources.length > 0) {
            const sourcesHtml = `
                <div style="margin-top:10px; font-size:0.8rem; opacity:0.7; padding-top:10px; border-top:1px solid rgba(255,255,255,0.1);">
                    <strong>Sources:</strong>
                    <ul style="margin:5px 0 0 20px; padding:0;">
                    ${data.response.sources.map(s => `<li>${s.title}</li>`).join('')}
                    </ul>
                </div>
            `;
            const lastMsg = document.querySelector('.chat-history').lastElementChild;
            lastMsg.insertAdjacentHTML('beforeend', sourcesHtml);
        }

    } catch (e) {
        document.getElementById(loadingId).innerText = "Librarian is offline.";
    } finally {
        input.disabled = false;
        document.getElementById('send-btn').disabled = false;
        input.focus();
    }
}

function addMessage(text, type, isLoading = false) {
    const history = document.getElementById('chat-history');
    const div = document.createElement('div');
    div.className = `message ${type}`;
    if (isLoading) div.id = 'loading-' + Date.now();
    div.innerText = text; // safety

    // Markdown bold
    if (!isLoading) {
        div.innerHTML = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
    }

    history.appendChild(div);
    history.scrollTop = history.scrollHeight;
    return div.id;
}
