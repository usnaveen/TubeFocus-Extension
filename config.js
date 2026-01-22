// Configuration for TubeFocus Extension - LOCAL DEVELOPMENT MODE
const CONFIG = {
  // API Configuration - LOCAL DEVELOPMENT
  API_BASE_URL: 'http://localhost:8080',
  API_KEY: 'test_key',

  // Feature flags
  ENABLE_SESSION_HISTORY: false, // MLP/feedback training removed

  // UI Configuration
  SCORE_UPDATE_INTERVAL: 1000, // milliseconds

  // Development mode
  DEBUG_MODE: true,

  // Local development settings
  LOCAL_DEV: true,
  LOG_API_CALLS: true
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
} 