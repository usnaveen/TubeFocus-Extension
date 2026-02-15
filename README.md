# TubeFocus Chrome Extension

Chrome Extension (Manifest V3) that scores YouTube videos against your learning goal in real time, provides AI-powered coaching during study sessions, and builds a searchable library of everything you watch.

## How It Works

```mermaid
graph LR
    subgraph "YouTube Page"
        V[Video Playing]
        CS[Content Script<br/>content.js]
        SD[Score Display<br/>Badge + Color Overlay]
        CN[Coach Notification<br/>Slide-in Panel]
        HM[Highlight Modal]
    end

    subgraph "Extension Layer"
        BG[Background Service Worker<br/>background.js]
        PU[Popup UI<br/>popup.html + popup.js]
        ST[Chrome Storage<br/>Session State]
    end

    subgraph "Backend API"
        API[Flask API on Cloud Run]
    end

    V -->|URL change detected| CS
    CS -->|videoData message| BG
    BG -->|POST /score| API
    API -->|score + reasoning| BG
    BG -->|NEW_SCORE message| CS
    CS --> SD
    CS --> CN
    PU <-->|chrome.storage| ST
    PU -->|START_SESSION| BG
    BG <-->|chrome.storage| ST
    CS <-->|chrome.storage| ST
```

## Architecture

The extension follows Chrome's Manifest V3 architecture with three isolated execution contexts communicating via message passing and shared storage.

```mermaid
graph TB
    subgraph "Content Script Context (youtube.com)"
        CS_MAIN["Main Loop<br/><code>setInterval(tryScore, 1000)</code>"]
        CS_SCORE["Score Display<br/>Floating badge + page color"]
        CS_TRANS["Transcript Scraper<br/>YouTube UI extraction"]
        CS_COACH["Coach Monitor<br/>2-min check interval"]
        CS_WATCH["Watch Detector<br/>Play state + visibility"]
        CS_HL["Highlight System<br/>Modal + timestamp capture"]
    end

    subgraph "Background Service Worker"
        BG_MSG["Message Router"]
        BG_API["API Client<br/>Scoring, Audit, Coach, Librarian"]
        BG_ALARM["Alarm Manager<br/>Session timer"]
        BG_HL["Highlight Storage<br/>Local + backend sync"]
    end

    subgraph "Popup UI"
        PU_SETUP["Setup Tab<br/>Goal, duration, coach mode"]
        PU_CURR["Current Tab<br/>Live stats, audit, highlights"]
        PU_SUMM["Summary Tab<br/>Chart.js score graph"]
        PU_SET["Settings<br/>Theme, privacy toggle"]
    end

    subgraph "Shared State (chrome.storage.local)"
        ST["sessionActive, goal, coachMode<br/>watchedScores, currentScore<br/>selectedTheme, totalWatchTime"]
    end

    CS_MAIN --> CS_SCORE
    CS_MAIN -.->|FETCH_SCORE| BG_MSG
    CS_COACH -.->|COACH_ANALYZE| BG_MSG
    CS_TRANS -.->|response| PU_CURR
    CS_HL -.->|SAVE_HIGHLIGHT| BG_MSG
    CS_WATCH -->|totalWatchTime| ST

    BG_MSG --> BG_API
    BG_ALARM -->|sessionEnd| ST
    BG_HL --> ST

    PU_SETUP -.->|START_SESSION| BG_MSG
    PU_CURR -.->|AUDIT_VIDEO| BG_MSG
    PU_CURR -.->|LIBRARIAN_INDEX| BG_MSG

    CS_MAIN <--> ST
    BG_MSG <--> ST
    PU_SETUP <--> ST
```

## Features

### Real-Time Video Scoring

Every time you navigate to a new YouTube video during an active session, the content script:

1. Detects the video ID from the URL (polled every 1 second)
2. Sends a scoring request through the background service worker
3. Displays the relevance score (0-100%) as a floating badge
4. Applies a red-to-green color gradient across YouTube's UI containers

```mermaid
sequenceDiagram
    participant YT as YouTube Page
    participant CS as Content Script
    participant BG as Background SW
    participant API as Backend API

    loop Every 1 second
        CS->>CS: Check URL for video ID
        alt New video detected
            CS->>CS: Show "Calculating..." badge
            CS->>BG: FETCH_SCORE { url, goal }
            BG->>API: POST /score
            API-->>BG: { score: 78 }
            BG->>CS: NEW_SCORE { score: 78 }
            CS->>YT: Apply color overlay (green-ish)
            CS->>YT: Show "78%" badge
            CS->>CS: Push to watchedScores[]
        end
    end
```

**Color mapping:**
- Score <= 30%: Red (`#dc2626`)
- Score >= 80%: Green (`#16a34a`)
- Between: Smooth RGB interpolation

### Session Management

```mermaid
stateDiagram-v2
    [*] --> Idle: Extension loaded
    Idle --> Active: User clicks "Start Session"
    Active --> Active: Video scored
    Active --> Ended_Manual: User clicks "Stop Session"
    Active --> Ended_Auto: Timer alarm fires
    Ended_Manual --> Summary: Show score chart
    Ended_Auto --> Summary: Show score chart
    Summary --> Idle: User starts new session

    state Active {
        [*] --> Scoring
        Scoring --> CoachCheck: Every 2 minutes
        CoachCheck --> Scoring
        Scoring --> WatchTracking: Continuous
    }
```

**Session state** is stored in `chrome.storage.local` and synchronized across all three execution contexts:

| Key | Type | Description |
|-----|------|-------------|
| `sessionActive` | boolean | Whether a session is running |
| `goal` | string | User's learning goal |
| `sessionEndTime` | number | Unix timestamp for session end |
| `coachMode` | string | `strict`, `balanced`, `relaxed`, or `custom` |
| `watchedScores` | number[] | All scores from current session |
| `currentScore` | number | Score of the currently playing video |
| `totalWatchTime` | number | Seconds of active watching |
| `selectedTheme` | string | Current theme identifier |
| `showSummaryOnOpen` | boolean | Flag to auto-show summary tab |

### AI Coach

The content script runs a coach monitoring loop that checks behavioral patterns every 2 minutes:

1. Collects the last 15 video scores and metadata
2. Sends session data to `POST /coach/analyze`
3. Displays intervention notifications as slide-in panels on the YouTube page

**Coach modes** control intervention thresholds:

| Mode | Low Score Threshold | Max Distractions Before Alert |
|------|--------------------|-----------------------------|
| Strict | 50% | 1 |
| Balanced | 40% | 3 |
| Relaxed | 30% | 5 |
| Custom | 40% | 3 (+ user instructions) |

### Deep Analyze (Auditor)

The popup's "Deep Analyze" button triggers content verification:

1. Extracts video ID and title from the active tab
2. Sends to `POST /audit` via background service worker
3. Displays clickbait score, information density, and watch/skip/skim recommendation

### Video Library (Librarian)

"Save to Library" extracts the transcript directly from YouTube's native transcript panel (DOM scraping, not API) and indexes it for semantic search:

```mermaid
sequenceDiagram
    participant User
    participant PU as Popup
    participant CS as Content Script
    participant BG as Background SW
    participant API as Backend

    User->>PU: Click "Save to Library"
    PU->>CS: SCRAPE_TRANSCRIPT
    CS->>CS: Click transcript button in YouTube UI
    CS->>CS: Wait 1.5s for panel to load
    CS->>CS: Extract all segment text + timestamps
    CS-->>PU: { transcript, segmentCount, charCount }
    PU->>BG: LIBRARIAN_INDEX { videoId, title, transcript, goal, score }
    BG->>API: POST /librarian/index
    API-->>BG: { success: true }
    BG-->>PU: Indexed successfully
```

### Highlights

Users can save timestamped highlights with notes during video playback:

- **Via popup:** Click "Highlight Section" button
- **Via keyboard:** Press `H` while watching (not in a text input)
- Captures: current timestamp, video title, optional user note, and surrounding transcript text
- Stored locally in `chrome.storage` and synced to backend via Librarian

### Theme System

7 color schemes applied via CSS custom properties (`--bg`, `--panel`, `--text`, `--accent`, `--border`, `--highlight`):

| Theme | Background | Text |
|-------|-----------|------|
| Crimson Vanilla | `#c1121f` | `#fdf0d5` |
| Vanilla Crimson | `#fdf0d5` | `#c1121f` |
| Darkreader | `#181e22` | `#ddd` |
| Cocoa Lemon | `#774123` | `#f3e924` |
| Golden Ocean | `#1d352f` | `#efc142` |
| Dusty Apricot | `#418994` | `#fadfca` |
| Spiced Forest | `#263226` | `#f68238` |

Themes propagate to the YouTube page's score badge via `chrome.storage` listener in the content script.

## Message Protocol

All communication between contexts uses `chrome.runtime.sendMessage` and `chrome.tabs.sendMessage`.

```mermaid
graph LR
    subgraph "Popup → Background"
        A1["START_SESSION"]
        A2["STOP_SESSION"]
        A3["FETCH_SCORE"]
        A4["AUDIT_VIDEO"]
        A5["LIBRARIAN_INDEX"]
        A6["LIBRARIAN_SEARCH"]
        A7["SAVE_HIGHLIGHT"]
        A8["COACH_ANALYZE"]
    end

    subgraph "Background → Content Script"
        B1["NEW_SCORE"]
        B2["SESSION_ENDED_AUTO"]
        B3["THEME_CHANGED"]
    end

    subgraph "Popup → Content Script"
        C1["START_SESSION"]
        C2["SCRAPE_TRANSCRIPT"]
        C3["CREATE_HIGHLIGHT"]
    end

    subgraph "Content Script → Popup"
        D1["NEW_SCORE"]
        D2["SHOW_SUMMARY"]
        D3["ERROR"]
        D4["COACH_MESSAGE"]
    end
```

## Project Structure

```
extension/
├── manifest.json           # Chrome extension manifest (V3)
├── popup.html              # Popup UI markup
├── popup.js                # Popup logic (tabs, stats, search, audit)
├── content.js              # YouTube page integration
│                             - Score display and color overlay
│                             - Transcript scraper (DOM-based)
│                             - Coach monitoring loop
│                             - Watch time detection
│                             - Highlight system
├── background.js           # Service worker
│                             - API communication proxy
│                             - Session alarm management
│                             - Message routing
│                             - Highlight local storage
├── config.js               # API URL, feature flags
├── styles.css              # Theme system + all UI styles
├── libs/
│   └── chart.min.js        # Chart.js for score visualization
├── dashboard/
│   └── app.js              # Focus Hub dashboard (highlights + RAG chat)
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── Settings.svg            # Settings gear icon
└── changelogs/             # Change history
```

## Setup

### Prerequisites

- Chrome browser (version 88+ for Manifest V3 support)
- TubeFocus backend API running (local or Cloud Run)

### Installation

1. Clone the repository
2. Open `chrome://extensions` in Chrome
3. Enable "Developer mode" (top-right toggle)
4. Click "Load unpacked"
5. Select the `extension/` directory

### Configuration

Edit `config.js` to point to your backend:

```javascript
const CONFIG = {
  API_BASE_URL: 'https://your-cloud-run-url',
  API_KEY: 'your-api-key',
  SCORE_UPDATE_INTERVAL: 1000,
  DEBUG_MODE: false
};
```

Alternatively, `background.js` has its own `CONFIG` object that takes precedence for API calls. Ensure both match your deployment.

### Permissions

The extension requests these Chrome permissions:

| Permission | Purpose |
|------------|---------|
| `storage` | Persist session state, scores, and highlights |
| `tabs` | Read active tab URL for video detection |
| `alarms` | Session timer countdown |
| `notifications` | Coach intervention alerts |
| `scripting` | Dynamic content script injection |

**Host permissions:** `youtube.com` (content script injection) and the Cloud Run API URL.

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Platform | Chrome Extension Manifest V3 |
| Language | Vanilla JavaScript (ES6+) |
| Styling | CSS3 with custom properties (theming) |
| Charts | Chart.js |
| Storage | chrome.storage.local |
| Communication | chrome.runtime message passing |
