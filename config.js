// Configuration for TubeFocus Extension
const CONFIG = {
  // API Configuration - Dev mode with multiple endpoints
  API_BASE_URL: 'https://yt-scorer-api-bd5usk72uq-uc.a.run.app', // Google Cloud Run API
  LOCAL_FLASK_URL: 'http://localhost:5001', // Local Flask app
  LOCAL_DOCKER_URL: 'http://localhost:8081', // Local Docker container
  API_KEY: 'changeme',
  
  // Feature flags
  ENABLE_FEEDBACK: true,
  ENABLE_SESSION_HISTORY: true,
  ENABLE_API_COMPARISON: true, // New flag for dev mode
  
  // UI Configuration
  SCORE_UPDATE_INTERVAL: 1000, // milliseconds
  FEEDBACK_TOAST_DURATION: 2000, // milliseconds
  
  // Development mode
  DEBUG_MODE: true // Set to true for development
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
} 