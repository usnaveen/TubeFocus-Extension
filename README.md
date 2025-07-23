# TubeFocus Chrome Extension

## Overview
TubeFocus is a Chrome extension that helps you stay focused and productive while watching YouTube. It scores each video you watch based on your study/work goal, gives you real-time feedback, and (optionally) uploads your session history for a witty, AI-generated summary.

## Features
- **Session Goals:** Set a clear goal before starting a session (e.g., "Studying Calculus").
- **Dual-Mode Scoring:**
  - *Title & Description*: Analyzes both the video title and description for relevance.
  - *Title Only*: Faster, lighter check using just the title.
- **Visual Feedback:** The extension overlays a color gradient on YouTube:
  - Green = highly relevant
  - Red = off-topic
  - Gradient transitions for nuance
- **Session Tracking (Privacy-Respecting):**
  - Toggle to enable/disable sharing your session history for summary analysis.
  - When enabled, video titles/descriptions are uploaded at session end for a witty summary (and then deleted locally).
- **Witty Session Summary:**
  - At session end, get a fun, goal-aware summary powered by Google Gemini 1.5 Flash (if sharing is enabled).
- **Modern UI:**
  - iOS-style toggle in a dedicated settings page
  - Responsive popup with tabs for Setup, Current, and Summary

## Setup
1. Clone or download this repo.
2. Go to `chrome://extensions` and enable Developer Mode.
3. Click "Load unpacked" and select the `TubeFocus Extension` folder.
4. Pin the extension for easy access.

## Usage
1. **Open the extension popup.**
2. **Set your goal** and session duration in the Setup tab.
3. **(Optional) Enable "Share Session History"** in Settings (gear icon at bottom right) if you want witty summaries.
4. **Start your session.**
5. As you watch YouTube videos, the background color will change based on relevance.
6. At session end, view your average score and (if enabled) your witty summary.

## Screenshots to Add
Please add the following screenshots to this README:

1. **Popup - Setup Tab**
   - *Filename:* `screenshot-setup.png`
   - *What to capture:* The Setup tab with a goal entered, session duration, and the Start Session button visible.

2. **Popup - Current Tab (During Session)**
   - *Filename:* `screenshot-current.png`
   - *What to capture:* The Current tab showing the timer, On/Off toggle, and current video score.

3. **Popup - Settings Page**
   - *Filename:* `screenshot-settings.png`
   - *What to capture:* The full settings page with the iOS-style toggle and privacy explanation.

4. **YouTube Overlay**
   - *Filename:* `screenshot-overlay.png`
   - *What to capture:* A YouTube video page with the color overlay visible (ideally showing a green or red gradient).

5. **Witty Summary (After Session)**
   - *Filename:* `screenshot-summary.png`
   - *What to capture:* The summary tab showing the witty AI-generated session summary (if sharing is enabled).

## Privacy
- By default, session history is **not** uploaded or stored.
- You control sharing via the settings toggle.
- All session data is deleted after upload.

## Development
- Main files: `popup.html`, `popup.js`, `content.js`, `background.js`, `styles.css`
- Manifest v3, works on all Chromium browsers

## License
MIT
