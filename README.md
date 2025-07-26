# TubeFocus Chrome Extension

## Overview
TubeFocus is an intelligent Chrome extension that helps users stay focused and productive while watching YouTube. It uses advanced machine learning models to score each video's relevance to your study/work goal, provides real-time visual feedback, and optionally generates witty AI-powered session summaries.

## 🚀 Key Features

### Core Functionality
- **Goal-Based Session Management**: Set specific learning/work goals before starting a session
- **Real-Time Video Scoring**: Instantly evaluates video relevance using multiple ML models
- **Visual Feedback System**: Color-coded overlay on YouTube (green=relevant, red=off-topic)
- **Dual Scoring Modes**: 
  - **Title & Description**: Comprehensive analysis using full video metadata
  - **Title Only**: Fast, lightweight scoring for quick assessments
- **Session Tracking**: Monitor your focus throughout the session with detailed analytics
- **Privacy-First Design**: All scoring happens locally by default

### Advanced Features
- **Multi-Modal Scoring**: Choose which video attributes to analyze (title, description, tags, category)
- **Personalized Learning**: MLP neural network learns from your feedback to improve accuracy
- **Witty AI Summaries**: Optional session summaries powered by Google Gemini 1.5 Flash
- **Theme System**: 7 beautiful color themes with iOS-style toggles
- **Feedback Integration**: Rate videos to improve the scoring algorithm
- **Responsive UI**: Modern, intuitive interface with tabbed navigation

## 🏗️ Architecture

### Frontend (Chrome Extension)
```
TubeFocus Extension/
├── manifest.json          # Extension configuration (Manifest V3)
├── popup.html/js          # Main extension interface with tabs
├── content.js             # YouTube page integration & visual overlay
├── background.js          # Session management & API communication
├── styles.css             # Modern responsive styling with themes
├── config.js              # Configuration management
└── icons/                 # Extension icons
```

### Backend Services
The project includes two complete backend implementations:

#### 1. Development Container (Advanced)
```
YouTube Productivity Score Development Container/
├── api.py                 # Main Flask API with advanced scoring
├── scoring_modules.py     # Multi-modal scoring algorithms
├── model_trainer.py       # MLP neural network training
├── youtube_api.py         # YouTube Data API integration
├── data_manager.py        # Feedback data persistence
├── main.py               # CLI testing interface
└── models/               # Local ML model cache
```

#### 2. Production Docker Container
```
YouTube Productivity Score Docker Container/
├── app.py                # Production Flask API
├── score_model.py        # Optimized scoring engine
├── youtube_scraper.py    # Video metadata extraction
├── Dockerfile           # Production containerization
└── requirements.txt     # Production dependencies
```

## 🤖 Machine Learning Implementation

### Model Ensemble Architecture

The system uses a sophisticated ensemble of state-of-the-art NLP models:

#### 1. Sentence Transformers (Embedding Models)
- **`all-MiniLM-L6-v2`**: Fast, general-purpose embeddings (384 dimensions)
- **`multi-qa-MiniLM-L6-cos-v1`**: Optimized for question-answer similarity
- **`paraphrase-MiniLM-L3-v2`**: Specialized for paraphrase detection
- **`all-mpnet-base-v2`**: High-quality semantic embeddings (768 dimensions)

#### 2. Cross-Encoder
- **`cross-encoder/ms-marco-MiniLM-L6-v2`**: Fine-grained relevance scoring

#### 3. Zero-Shot Classification
- **`facebook/bart-large-mnli`**: Multi-label topic classification

### Scoring Algorithm Details

#### Multi-Modal Scoring System
The scoring engine analyzes four distinct video attributes:

1. **Title Scoring** (`score_title`)
   ```python
   # Uses sentence transformers for semantic similarity
   goal_emb = embedding_model.encode(goal, convert_to_tensor=True)
   title_emb = embedding_model.encode(title, convert_to_tensor=True)
   similarity = util.cos_sim(goal_emb, title_emb)
   ```

2. **Description Scoring** (`score_description`)
   ```python
   # Combines embedding similarity, cross-encoder, and keyword overlap
   score = (
       0.35 * embedding_similarity +
       0.30 * cross_encoder_score +
       0.25 * title_similarity +
       0.10 * keyword_overlap
   )
   ```

3. **Tags Scoring** (`score_tags`)
   ```python
   # Uses zero-shot classification with confidence thresholds
   zs = classifier(goal, candidate_labels=tags_list)
   relevant_tags = [(label, score) for label, score in zip(labels, scores) if score >= threshold]
   ```

4. **Category Scoring** (`score_category`)
   ```python
   # Zero-shot classification of video category relevance
   category_score = classifier(goal, candidate_labels=[category_name])
   ```

#### Goal Deconstruction
The system intelligently breaks down complex goals:
```python
def deconstruct_goal(goal):
    sub_goals = re.split(r',| and | particularly ', goal)
    sub_goals.append(goal)  # Include original goal
    return [g.strip() for g in sub_goals if g.strip()]
```

#### Personalized Learning (MLP Neural Network)
After collecting user feedback, the system trains a Multi-Layer Perceptron:
```python
mlp = MLPRegressor(hidden_layer_sizes=(8,), activation='relu', max_iter=500)
mlp.fit(X, y)  # X: [desc_score, title_score, tags_score, category_score], y: user_score
```

### Model Caching & Performance
- **Local Model Storage**: All models cached locally for offline operation
- **LRU Caching**: Video metadata cached to reduce API calls
- **Batch Processing**: Efficient scoring for multiple videos
- **Memory Optimization**: Models loaded once at startup

## 🔧 Technical Implementation

### Chrome Extension Architecture

#### Manifest V3 Compliance
```json
{
  "manifest_version": 3,
  "permissions": ["storage", "notifications", "tabs", "alarms", "scripting"],
  "host_permissions": ["https://*.youtube.com/*", "https://yt-scorer-*.run.app/*"],
  "background": {"service_worker": "background.js"},
  "content_scripts": [{"matches": ["https://*.youtube.com/*"], "js": ["content.js"]}]
}
```

#### Content Script Integration
- **YouTube Page Detection**: Automatically detects video pages
- **Visual Overlay**: Dynamic color-coded background based on relevance score
- **Score Display**: Floating score indicator with feedback integration
- **Theme Synchronization**: Real-time theme updates across all tabs

#### Background Service Worker
- **Session Management**: Handles session start/stop and timing
- **API Communication**: Manages requests to scoring backend
- **Storage Management**: Persists session data and user preferences
- **Alarm System**: Automatic session termination

### API Endpoints

#### `/predict` (POST)
Scores video relevance using selected parameters:
```json
{
  "video_id": "dQw4w9WgXcQ",
  "goal": "learn Python programming",
  "parameters": ["title", "description", "tags", "category"]
}
```

Response:
```json
{
  "title_score": 0.85,
  "description_score": 0.92,
  "tags_score": 0.78,
  "category_score": 0.95,
  "score": 0.88,
  "category_name": "Education"
}
```

#### `/feedback` (POST)
Collects user feedback for model improvement:
```json
{
  "desc_score": 0.92,
  "title_score": 0.85,
  "tags_score": 0.78,
  "category_score": 0.95,
  "user_score": 0.90
}
```

#### `/upload` (POST)
Generates witty session summaries using Gemini 1.5 Flash:
```json
{
  "goal": "learn Python programming",
  "session": [
    {"title": "Python Tutorial for Beginners"},
    {"title": "Data Structures in Python"},
    {"title": "10 Hours of Relaxing Music"}
  ]
}
```

### Visual Feedback System

#### Color Gradient Algorithm
```javascript
function applyColor(score) {
  if (score >= 80) return 'rgba(0, 255, 0, 0.3)';      // Green (highly relevant)
  if (score >= 60) return 'rgba(255, 255, 0, 0.3)';    // Yellow (moderately relevant)
  if (score >= 40) return 'rgba(255, 165, 0, 0.3)';    // Orange (somewhat relevant)
  return 'rgba(255, 0, 0, 0.3)';                       // Red (off-topic)
}
```

#### Score Display Component
- **Floating Indicator**: Positioned at bottom-left of YouTube
- **Click Interaction**: Opens feedback modal for user ratings
- **Smooth Animations**: CSS transitions for professional feel
- **Responsive Design**: Adapts to different screen sizes

## 🎨 User Interface

### Theme System
7 carefully crafted color schemes:
- **Crimson Vanilla**: Classic red and cream
- **Dark Reader**: Dark mode with orange accents
- **Cocoa Lemon**: Warm brown with bright yellow
- **Golden Ocean**: Deep green with gold highlights
- **Dusty Apricot**: Teal with soft peach
- **Spiced Forest**: Dark green with orange spice
- **Vanilla Crimson**: Light cream with red accents

### Tabbed Interface
1. **Setup Tab**: Goal setting, session duration, scoring mode selection
2. **Current Tab**: Real-time session monitoring with score display
3. **Summary Tab**: Session analytics and AI-generated summary
4. **Settings Tab**: Privacy controls, theme selection, and preferences

### Scoring Mode Modal
Interactive modal for selecting which video attributes to analyze:
- **Title**: Fast, lightweight scoring
- **Description**: Comprehensive content analysis
- **Tags**: Category-based relevance
- **Category**: High-level topic matching

## 🔒 Privacy & Security

### Data Handling
- **Local Processing**: All scoring happens locally by default
- **Optional Sharing**: Session history sharing is opt-in only
- **Secure API**: API key authentication for backend communication
- **Data Deletion**: Session data deleted after summary generation

### Privacy Controls
- **Settings Toggle**: iOS-style switch for session sharing
- **Granular Control**: Choose exactly what data to share
- **Transparent Processing**: Clear indication of data usage
- **No Persistent Storage**: No personal data stored on servers

## 🚀 Deployment

### Chrome Extension Setup
1. Clone the repository
2. Navigate to `chrome://extensions/`
3. Enable Developer Mode
4. Click "Load unpacked" and select `TubeFocus Extension/`
5. Pin the extension for easy access

### Backend Deployment

#### Development Environment
```bash
cd "YouTube Productivity Score Development Container"
pip install -r requirements.txt
python download_all_models.py  # Download ML models (~2GB)
python api.py  # Start development server
```

#### Production Deployment (Google Cloud Run)
```bash
cd "YouTube Productivity Score Docker Container"
docker build -t yt-scorer-backend:latest .
docker run -d -p 8080:8080 --name yt-scorer-backend yt-scorer-backend:latest
```

### Environment Variables
```bash
# Required
YOUTUBE_API_KEY=your_youtube_api_key
API_KEY=your_secret_api_key

# Optional (for summaries)
GOOGLE_CLOUD_PROJECT=your_gcp_project
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
```

## 📊 Performance & Optimization

### Model Loading
- **Lazy Loading**: Models loaded only when needed
- **Memory Management**: Efficient tensor operations
- **Caching Strategy**: LRU cache for video metadata
- **Batch Processing**: Optimized for multiple video scoring

### Extension Performance
- **Service Worker**: Non-blocking background operations
- **Content Script Optimization**: Minimal DOM manipulation
- **Storage Efficiency**: Compressed session data
- **Memory Leak Prevention**: Proper cleanup of event listeners

## 🔧 Development

### Project Structure
```
TubeFocus Extension/
├── manifest.json          # Extension configuration
├── popup.html            # Main UI
├── popup.js              # UI logic and state management
├── content.js            # YouTube integration
├── background.js         # Service worker
├── styles.css            # Styling and themes
├── config.js             # Configuration
└── icons/                # Extension icons

YouTube Productivity Score Development Container/
├── api.py                # Flask API server
├── scoring_modules.py    # ML scoring algorithms
├── model_trainer.py      # Neural network training
├── youtube_api.py        # YouTube API integration
├── data_manager.py       # Data persistence
├── main.py              # CLI interface
├── requirements.txt     # Python dependencies
└── models/              # Local model cache
```

### Key Dependencies
```python
# ML & NLP
sentence-transformers>=2.2.0
transformers>=4.30.0
torch>=2.0.0
scikit-learn>=1.3.0

# Web Framework
Flask==2.3.2
flask-cors==4.0.0

# YouTube API
google-api-python-client==2.84.0

# AI/ML Services
google-cloud-aiplatform>=1.38.0
```

### Testing
- **CLI Testing**: Use `main.py` for manual testing
- **API Testing**: Health check endpoint at `/health`
- **Extension Testing**: Load in Chrome with developer mode
- **Model Testing**: Individual scoring module tests

## 🤝 Contributing

### Development Workflow
1. Fork the repository
2. Create a feature branch
3. Make changes with proper documentation
4. Test thoroughly with different video types
5. Submit a pull request with detailed description

### Code Standards
- **Python**: PEP 8 compliance, type hints where appropriate
- **JavaScript**: ES6+ syntax, consistent formatting
- **CSS**: BEM methodology, CSS custom properties
- **Documentation**: Comprehensive docstrings and comments

## 📈 Future Enhancements

### Planned Features
- **Multi-Platform Support**: Firefox and Safari extensions
- **Advanced Analytics**: Detailed focus metrics and trends
- **Social Features**: Share progress with study groups
- **Integration APIs**: Connect with productivity tools
- **Mobile App**: Native iOS/Android applications

### Technical Improvements
- **Model Optimization**: Quantized models for faster inference
- **Real-time Learning**: Continuous model updates
- **Multi-language Support**: Internationalization
- **Advanced UI**: More interactive visualizations

## 📄 License
MIT License - See LICENSE file for details

## 🙏 Acknowledgments
- **Hugging Face**: For the excellent transformer models
- **Google Cloud**: For Gemini 1.5 Flash integration
- **YouTube Data API**: For video metadata access
- **Chrome Extensions Team**: For Manifest V3 support

---

**TubeFocus** - Stay focused, stay productive, stay learning! 🎯
