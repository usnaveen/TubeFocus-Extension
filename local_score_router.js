// local_score_router.js
// Thin facade: Bot 1 local scorer + Bot 3 confidence hybrid routing.
// Prefer importing hybridScore directly; this keeps the Bot 1 entrypoint stable.

import {
  hybridScore,
  loadHybridPrefs,
  DEFAULT_CONFIDENCE_THRESHOLD,
} from './hybridScorer.js';

const DEFAULTS = {
  LOCAL_FIRST: true,
  CLOUD_FALLBACK: true,
  // Bot 3 hybrid default (~0.55). Legacy LOW_CONFIDENCE kept as alias.
  LOW_CONFIDENCE: DEFAULT_CONFIDENCE_THRESHOLD,
  HYBRID_CONFIDENCE_THRESHOLD: DEFAULT_CONFIDENCE_THRESHOLD,
  OFFLINE_MODE: false,
  API_BASE_URL: 'https://yt-scorer-api-933573987016.us-central1.run.app',
  API_KEY: 'test_key',
};

/**
 * Primary Gatekeeper score path (local-first + confidence hybrid).
 * @param {{ goal, url, title, description, channel, forceCloud? }} input
 * @param {object} config  CONFIG from background / config.js
 */
export async function scoreVideoLocalFirst(input, config = {}) {
  const cfg = { ...DEFAULTS, ...config };
  const storagePrefs = await loadHybridPrefs({
    offlineMode: cfg.OFFLINE_MODE,
    confidenceThreshold:
      cfg.HYBRID_CONFIDENCE_THRESHOLD ?? cfg.LOW_CONFIDENCE ?? DEFAULT_CONFIDENCE_THRESHOLD,
    enableLocal: cfg.LOCAL_FIRST !== false,
    cloudFallback: cfg.CLOUD_FALLBACK !== false,
  });

  const forceCloud = Boolean(
    input.forceCloud || input.deepAudit || input.coach || config.forceCloud
  );

  return hybridScore(
    {
      goal: input.goal,
      url: input.url,
      title: input.title,
      description: input.description,
      channel: input.channel,
    },
    {
      apiBaseUrl: cfg.API_BASE_URL,
      apiKey: cfg.API_KEY,
      mode: input.mode || 'title_and_description',
      offlineMode: storagePrefs.offlineMode,
      confidenceThreshold: storagePrefs.confidenceThreshold,
      enableLocal: storagePrefs.enableLocal && cfg.LOCAL_FIRST !== false,
      cloudFallback: storagePrefs.cloudFallback && cfg.CLOUD_FALLBACK !== false,
      forceCloud,
    }
  );
}

export { hybridScore, loadHybridPrefs, DEFAULT_CONFIDENCE_THRESHOLD };
