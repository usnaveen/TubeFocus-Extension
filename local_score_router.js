// local_score_router.js
// Local-first scoring with optional cloud fallback (Gemini/Cloud Run).
// Hybrid confidence routing details are Coder Bot 3's slice; we expose confidence.

import { scoreGoalRelevance } from './ml_service.js';

const DEFAULTS = {
  LOCAL_FIRST: true,
  CLOUD_FALLBACK: false, // offline demo — cloud score host returns 404
  // Below this confidence, optionally call cloud (when CLOUD_FALLBACK).
  LOW_CONFIDENCE: 0.45,
  API_BASE_URL: 'https://yt-scorer-api-933573987016.us-central1.run.app',
  API_KEY: 'test_key'
};

async function cloudScore(url, goal, config) {
  const endpoint = `${config.API_BASE_URL}/score`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': config.API_KEY
    },
    body: JSON.stringify({
      video_url: url,
      goal,
      mode: 'title_and_description'
    })
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  const data = await res.json();
  return {
    ...data,
    score: data.score ?? data,
    source: 'cloud',
    confidence: typeof data.confidence === 'number' ? data.confidence : 0.5
  };
}

/**
 * Primary Gatekeeper score path: on-device MiniLM first; cloud only if
 * local fails or (optional) low confidence + CLOUD_FALLBACK.
 */
export async function scoreVideoLocalFirst({ goal, url, title, description, channel }, config = {}) {
  const cfg = { ...DEFAULTS, ...config };

  if (cfg.LOCAL_FIRST) {
    const local = await scoreGoalRelevance(goal, { title, description, channel });
    if (local.success) {
      const needCloud =
        cfg.CLOUD_FALLBACK &&
        typeof local.confidence === 'number' &&
        local.confidence < cfg.LOW_CONFIDENCE;

      if (!needCloud) {
        return local;
      }

      try {
        const cloud = await cloudScore(url, goal, cfg);
        return {
          ...cloud,
          local_score: local.score,
          local_confidence: local.confidence,
          source: 'hybrid',
          model: local.model
        };
      } catch (e) {
        console.warn('[score] cloud fallback failed, keeping local:', e.message);
        return local;
      }
    }
    console.warn('[score] local failed:', local.error);
  }

  if (cfg.CLOUD_FALLBACK || !cfg.LOCAL_FIRST) {
    return cloudScore(url, goal, cfg);
  }

  return { error: 'Local scorer unavailable and cloud fallback disabled', source: 'none' };
}
