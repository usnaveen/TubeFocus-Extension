# TubeFocus Extension - Local Development Setup

This branch (`local-dev-testing`) has been configured to work with the local Python development container instead of the production Cloud Run API.

## 🚀 Quick Start

### 1. Start the Local Dev Container

Navigate to the development container directory and start the API:

```bash
cd "../YouTube Productivity Score Development Container"
python api.py
```

The API will start on `http://localhost:8080`

### 2. Load the Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select this `TubeFocus Extension` folder
4. The extension should now be using local API endpoints

### 3. Test the Connection

Open the browser console and run:

```javascript
// Load the test script
const script = document.createElement('script');
script.src = 'http://localhost:3000/test_local_dev.js'; // Adjust port if needed
document.head.appendChild(script);

// Run tests
testLocalDev.runAllTests();
```

## 🔧 Configuration Changes Made

### API Endpoints Updated

- **Base URL**: Changed from `https://yt-scorer-api-49646986060.us-central1.run.app` to `http://localhost:8080`
- **Detailed Scoring**: `/predict` → `/score/detailed`
- **Simple Scoring**: `/simpletitledesc` → `/score/simple`
- **Feedback**: `/feedback` (unchanged)
- **Health**: `/health` (new endpoint for testing)

### Local Development Features

- Enhanced logging for API calls
- Disabled session upload (not available in dev container)
- Better error handling for local development
- Console messages indicating local dev mode

## 📊 Available Endpoints

The local dev container provides these endpoints:

| Endpoint | Method | Purpose | Request Body |
|-----------|--------|---------|--------------|
| `/health` | GET | Health check | None |
| `/score/detailed` | POST | Advanced scoring | `{video_id, goal, parameters}` |
| `/score/simple` | POST | Simple scoring | `{video_url, goal, mode}` |
| `/feedback` | POST | User feedback | `{desc_score, title_score, tags_score, category_score, user_score}` |

## 🧪 Testing

### Manual Testing

1. **Start a session** in the extension
2. **Navigate to YouTube** and watch a video
3. **Check the console** for API call logs
4. **Verify scoring** appears on the video

### Automated Testing

Use the `test_local_dev.js` script to test all endpoints:

```javascript
// Test individual endpoints
await testLocalDev.testHealth();
await testLocalDev.testSimpleScoring();
await testLocalDev.testDetailedScoring();

// Or run all tests
await testLocalDev.runAllTests();
```

## 🐛 Troubleshooting

### Common Issues

1. **"Failed to fetch" errors**
   - Ensure the dev container is running on port 8080
   - Check if the API is accessible at `http://localhost:8080/health`

2. **API key errors**
   - The dev container uses `changeme` as the default API key
   - This is already configured in the extension

3. **CORS errors**
   - The dev container is configured to allow Chrome extensions
   - If issues persist, check the `api.py` CORS configuration

4. **Endpoint not found**
   - Verify the endpoint names match between extension and dev container
   - Check the dev container logs for any startup errors

### Debug Steps

1. **Check dev container logs** for any Python errors
2. **Verify port 8080** is not blocked by firewall
3. **Test endpoints manually** using curl or Postman
4. **Check extension console** for detailed error messages

## 🔄 Switching Back to Production

To switch back to production endpoints:

1. **Revert the changes**:
   ```bash
   git checkout main
   ```

2. **Or manually update** `config.js`:
   ```javascript
   API_BASE_URL: 'https://yt-scorer-api-49646986060.us-central1.run.app'
   ```

3. **Update endpoint references** in `background.js` back to production names

## 📝 Development Notes

- **Session uploads** are disabled in local mode (not available in dev container)
- **YouTube API calls** may fail if no API key is configured (dev container handles this gracefully)
- **All API calls** are logged to the console for debugging
- **Error handling** is enhanced for local development scenarios

## 🎯 Next Steps

1. **Test the extension** with various YouTube videos
2. **Verify scoring accuracy** matches expectations
3. **Check performance** of local API calls
4. **Iterate on scoring algorithms** using the local setup
5. **Test feedback collection** and model retraining

---

**Note**: This is a development branch. Do not merge to main without reverting the local development changes.
