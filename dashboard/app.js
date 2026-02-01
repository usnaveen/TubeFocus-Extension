const API_BASE_URL = 'http://localhost:8080';
let API_KEY = '';

// Load API Key from extension storage on init
chrome.storage.local.get(['settings'], (result) => {
    // Fallback if settings not found, though in extension env it should be there. 
    // For standalone testing, you might need to hardcode or mock.
    // Assuming 'settings' might hold it or we check a config.
    // Actually, in the extension context, we usually rely on background.js or storage.
    // Let's assume for now we can get the API KEY if it was stored. 
    // If not, we might fail calls.
    // IMPORTANT: The backend requires X-API-KEY.
    // Let's try to find it in common storage locations we used.

    // For now, let's assume a default or fetch from storage
    // If running inside extension tab, we have access to chrome.storage
});

// Since we are inside the extension, we can get config
// BUT, for simplicity, let's fetch the key from background or storage.
// The backend is local, so we just need the key configured in the backend (env var).
// We'll trust the user has setup the extension properly.
// We'll use a hardcoded dev key for now if storage fails, or just fetch form storage.

// Helper to get API Headers
async function getHeaders() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['apiKey'], (result) => {
            const key = result.apiKey || ''; // User configured key?
            // Actually, in our project `config.py` uses os.environ.
            // The extension usually sends the key in headers.
            // For this local dashboard, let's assume 'test_key' or similar if not set?
            // Let's just create a header with the stored key.
            resolve({
                'Content-Type': 'application/json',
                'X-API-KEY': key || 'test_key_123' // Fallback to a common dev key if needed
            });
        });
    });
}

// --- Tabs ---
function switchTab(tabName) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.section-view').forEach(s => s.classList.remove('active'));

    if (tabName === 'highlights') {
        document.querySelector('button[onclick="switchTab(\'highlights\')"]').classList.add('active');
        document.getElementById('highlights-view').classList.add('active');
        loadHighlights();
    } else {
        document.querySelector('button[onclick="switchTab(\'chat\')"]').classList.add('active');
        document.getElementById('chat-view').classList.add('active');
    }
}

// --- Highlights ---
async function loadHighlights() {
    const container = document.getElementById('highlights-container');
    container.innerHTML = '<div class="loading-spinner">Loading highlights...</div>';

    try {
        const headers = await getHeaders();
        const response = await fetch(`${API_BASE_URL}/librarian/get_highlights`, {
            method: 'GET',
            headers: headers
        });

        if (!response.ok) throw new Error('Failed to fetch');

        const data = await response.json();
        renderHighlights(data.highlights);

    } catch (error) {
        console.error(error);
        container.innerHTML = `<div class="empty-state">Failed to load highlights.<br><small>${error.message}</small></div>`;
    }
}

function renderHighlights(highlights) {
    const container = document.getElementById('highlights-container');
    container.innerHTML = '';

    if (!highlights || highlights.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📚</div>
                <h3>No highlights yet</h3>
                <p>Press <strong>'h'</strong> while watching a video to save a highlight!</p>
            </div>`;
        return;
    }

    highlights.forEach(h => {
        const date = new Date(h.timestamp || Date.now()).toLocaleDateString();
        const card = document.createElement('div');
        card.className = 'highlight-card';
        card.innerHTML = `
            <div class="highlight-text">"${h.text}"</div>
            ${h.note ? `<div class="highlight-note">📝 ${h.note}</div>` : ''}
            <div class="highlight-meta">
                <span>${date}</span>
                <a href="${h.video_url || '#'}" target="_blank" class="highlight-link">Watch Video ↗</a>
            </div>
        `;
        container.appendChild(card);
    });
}

// --- Chat ---
function handleEnter(e) {
    if (e.key === 'Enter') sendMessage();
}

async function sendMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    // Add User Message
    addMessage(text, 'user');
    input.value = '';
    input.disabled = true;
    document.getElementById('send-btn').disabled = true;

    // Add Loading Message
    const loadingId = addMessage('Thinking...', 'bot', true);

    try {
        const headers = await getHeaders();
        const response = await fetch(`${API_BASE_URL}/librarian/chat`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ query: text })
        });

        const data = await response.json();

        // Remove loading
        document.getElementById(loadingId).remove();

        // Add Bot Response
        addMessage(data.response.answer, 'bot');

        // Add Sources if any
        if (data.response.sources && data.response.sources.length > 0) {
            const sourcesHtml = `
                <div style="margin-top:0.5rem; font-size:0.85rem; opacity:0.8;">
                    <strong>Sources:</strong>
                    <ul>
                    ${data.response.sources.map(s => `<li>${s.title}</li>`).join('')}
                    </ul>
                </div>
            `;
            const lastMsg = document.querySelector('.chat-history').lastElementChild;
            lastMsg.innerHTML += sourcesHtml;
        }

    } catch (error) {
        document.getElementById(loadingId).innerText = "Error: Could not reach the Librarian.";
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
    div.innerText = text; // Safe text
    if (isLoading) div.id = 'loading-' + Date.now();

    // Very basic markdown parsing for bold
    if (!isLoading) {
        div.innerHTML = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
    }

    history.appendChild(div);
    history.scrollTop = history.scrollHeight;
    return div.id;
}

// --- Theme Init ---
function initTheme() {
    const select = document.getElementById('themeSelect');

    // Load saved
    chrome.storage.local.get(['selectedTheme'], (res) => {
        const theme = res.selectedTheme || 'crimson-vanilla';
        document.body.setAttribute('data-theme', theme);
        select.value = theme;
    });

    select.addEventListener('change', (e) => {
        const newTheme = e.target.value;
        document.body.setAttribute('data-theme', newTheme);
        chrome.storage.local.set({ selectedTheme: newTheme });
    });
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    loadHighlights(); // Load initial view
});
