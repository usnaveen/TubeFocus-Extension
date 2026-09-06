// Configuration for TubeFocus Extension — local-first scoring (Tier A)
const CONFIG = {
  // Cloud API (optional fallback / coach / librarian)
  API_BASE_URL: 'https://yt-scorer-api-933573987016.us-central1.run.app',
  API_KEY: 'kocwYq-3diqqe-barbur',

  // Tier A: on-device scorer is default; Gemini/Cloud Run only on low confidence or failure
  LOCAL_FIRST: true,
  CLOUD_FALLBACK: true,
  LOW_CONFIDENCE: 0.45,
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
