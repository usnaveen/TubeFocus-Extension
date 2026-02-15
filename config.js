// Configuration for TubeFocus Extension - CLOUD RUN MODE
const CONFIG = {
  // API Configuration - CLOUD RUN
  API_BASE_URL: 'https://yt-scorer-api-933573987016.us-central1.run.app',
  API_KEY: 'kocwYq-3diqqe-barbur',

  // Feature flags
  ENABLE_SESSION_HISTORY: false, // MLP/feedback training removed

  // UI Configuration
  SCORE_UPDATE_INTERVAL: 1000, // milliseconds

  // Development mode
  DEBUG_MODE: true,

  // Local development settings
  LOCAL_DEV: false,
  LOG_API_CALLS: false
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
} 