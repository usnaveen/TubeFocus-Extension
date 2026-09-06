// Configuration for TubeFocus Extension — local-first + hybrid routing (Tier A)
const CONFIG = {
  // Cloud API (optional fallback / coach / librarian / forceCloud audit)
  API_BASE_URL: 'https://yt-scorer-api-933573987016.us-central1.run.app',
  API_KEY: 'kocwYq-3diqqe-barbur',

  // Tier A: on-device scorer is default; Gemini/Cloud Run on low confidence,
  // failure, or forceCloud (deep audit / coach). Offline never calls cloud.
  LOCAL_FIRST: true,
  CLOUD_FALLBACK: true,
  HYBRID_CONFIDENCE_THRESHOLD: 0.55,
  LOW_CONFIDENCE: 0.55, // alias for HYBRID_CONFIDENCE_THRESHOLD
  OFFLINE_MODE: false,
  LOCAL_MODEL_ID: 'Xenova/all-MiniLM-L6-v2',

  ENABLE_SESSION_HISTORY: false,
  SCORE_UPDATE_INTERVAL: 1000,
  DEBUG_MODE: true,
  LOCAL_DEV: false,
  LOG_API_CALLS: false
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
