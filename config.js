// Configuration for TubeFocus Extension — local-first scoring (Tier A) + Purge
const CONFIG = {
  // Cloud API (optional fallback / coach / librarian)
  API_BASE_URL: 'https://yt-scorer-api-933573987016.us-central1.run.app',
  API_KEY: 'kocwYq-3diqqe-barbur',

  // Tier A: on-device scorer is default; Gemini/Cloud Run only on low confidence or failure
  LOCAL_FIRST: true,
  CLOUD_FALLBACK: false, // demo: dead cloud host → stay offline (lexical/MiniLM only)
  LOW_CONFIDENCE: 0.45,
  LOCAL_MODEL_ID: 'Xenova/all-MiniLM-L6-v2',

  // Purge mode (NAV-42) — scores are 0–100 relevance
  // score < PURGE_SCORE_BELOW → purge
  // PURGE_SCORE_BELOW <= score < PURGE_SCORE_BELOW + UNSURE_BAND → unsure
  // score >= PURGE_SCORE_BELOW + UNSURE_BAND → keep
  PURGE_SCORE_BELOW: 40,
  UNSURE_BAND: 10,
  // Soft unsure when local confidence is weak (even if score is mid/high)
  PURGE_LOW_CONFIDENCE: 0.45,
  // Cap how many videos MiniLM scores per SCORE_BATCH call (~20)
  PURGE_BATCH_SIZE: 20,
  // Persist at most this many (goalHash, videoId) cache entries
  PURGE_CACHE_MAX_ENTRIES: 500,

  ENABLE_SESSION_HISTORY: false,
  SCORE_UPDATE_INTERVAL: 1000,
  DEBUG_MODE: true,
  LOCAL_DEV: false,
  LOG_API_CALLS: false
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
