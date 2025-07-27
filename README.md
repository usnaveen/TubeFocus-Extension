# TubeFocus Chrome Extension

## Overview
TubeFocus is a Chrome extension that helps you stay focused and productive while watching YouTube. It scores each video you watch based on your study/work goal, gives you real-time feedback, and (optionally) uploads your session history for a witty, AI-generated summary.

## Features
- **Session Goals:** Set a clear goal before starting a session (e.g., "Studying Calculus").
- **Dual-Mode Scoring:**
  - *Title & Description*: Analyzes both the video title and description for relevance using advanced ML models.
  - *Title Only*: Faster, lighter check using just the title.
- **Advanced ML Scoring:** Uses ensemble of sentence transformers and zero-shot classification models for accurate relevance scoring.
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

## Architecture

### Frontend (Chrome Extension)
- **popup.html/js**: Main extension interface with tabs for setup, current session, and summary
- **content.js**: YouTube page integration and visual overlay
- **background.js**: Session management and API communication
- **styles.css**: Modern, responsive styling

### Backend Services
The project includes two backend implementations:

#### 1. Development Container
Located in `YouTube Productivity Score Development Container/`
- **Advanced ML Models**: Ensemble of sentence transformers and zero-shot classification
- **Model Training**: MLP regressor for personalized scoring
- **Multiple Scoring Modules**: Title, description, tags, and category analysis
- **API Endpoints**: `/predict` and `/upload` for scoring and summaries

#### 2. Docker Container
Located in `YouTube Productivity Score Docker Container/`
- **Production-ready**: Optimized for deployment
- **Simplified ML**: Focused on core scoring functionality
- **Cloud Run Ready**: Dockerized for easy deployment

## Setup

### Chrome Extension
1. Clone or download this repo.
2. Go to `chrome://extensions` and enable Developer Mode.
3. Click "Load unpacked" and select the `TubeFocus Extension` folder.
4. Pin the extension for easy access.

### Backend Setup

#### Development Environment
```bash
cd "YouTube Productivity Score Development Container"
pip install -r requirements.txt
python download_all_models.py  # Download ML models
python app.py  # Start development server
```

#### Production Deployment
```bash
cd "YouTube Productivity Score Docker Container"
docker build -t yt-scorer-backend:latest .
docker run -d -p 8080:8080 --name yt-scorer-backend yt-scorer-backend:latest
```

### Environment Variables
Set the following environment variables:
- `YOUTUBE_API_KEY`: Your YouTube Data API v3 key
- `API_KEY`: Secret key for backend API authentication
- Google Cloud credentials for Gemini 1.5 Flash (if using summaries)

## Usage
1. **Open the extension popup.**
2. **Set your goal** and session duration in the Setup tab.
3. **(Optional) Enable "Share Session History"** in Settings (gear icon at bottom right) if you want witty summaries.
4. **Start your session.**
5. As you watch YouTube videos, the background color will change based on relevance.
6. At session end, view your average score and (if enabled) your witty summary.

## ML Models Used

### Sentence Transformers (Ensemble)
- `all-MiniLM-L6-v2`: Fast, general-purpose embeddings
- `multi-qa-MiniLM-L6-cos-v1`: Optimized for question-answer similarity
- `paraphrase-MiniLM-L3-v2`: Specialized for paraphrase detection
- `all-mpnet-base-v2`: High-quality semantic embeddings
- `all-distilroberta-v1`: Robust RoBERTa-based embeddings

### Zero-Shot Classification
- `facebook/bart-large-mnli`: For zero-shot topic classification

### Cross-Encoder
- `cross-encoder/ms-marco-MiniLM-L6-v2`: For re-ranking and fine-grained scoring

## API Endpoints

### `/predict` (POST)
Score a YouTube video for relevance to a user goal.
```json
{
  "video_url": "https://www.youtube.com/watch?v=...",
  "goal": "learn about music videos",
  "mode": "title_and_description"
}
```

### `/upload` (POST)
Generate a witty, goal-aware summary using Gemini 1.5 Flash.
```json
{
  "goal": "learn about music videos",
  "session": [
    {"title": "Never Gonna Give You Up"},
    {"title": "How Music Videos Are Made"}
  ]
}
```

## Privacy
- By default, session history is **not** uploaded or stored.
- You control sharing via the settings toggle.
- All session data is deleted after upload.
- ML models run locally for scoring (no data sent to external services).

## Development
- **Frontend**: `popup.html`, `popup.js`, `content.js`, `background.js`, `styles.css`
- **Backend**: Flask-based API with ML model ensemble
- **Manifest v3**: Works on all Chromium browsers
- **Docker Support**: Production-ready containerization

## License
MIT
