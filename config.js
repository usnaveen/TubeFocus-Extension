// Configuration for TubeFocus Extension
const CONFIG = {
  // API Configuration
  API_BASE_URL: 'http://localhost:8080', // Change this to your Cloud Run URL when deployed
  API_KEY: 'changeme',
  
  // Feature flags
  ENABLE_FEEDBACK: true,
  ENABLE_SESSION_HISTORY: true,
  
  // UI Configuration
  SCORE_UPDATE_INTERVAL: 1000, // milliseconds
  FEEDBACK_TOAST_DURATION: 2000, // milliseconds
  
  // Development mode
  DEBUG_MODE: true
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
} 