/**
 * Confidence hybrid routing (Coder Bot 3 / Tier A).
 *
 * Policy:
 *  1. Local-first via ml_service.scoreGoalRelevance (Bot 1).
 *  2. Use local when confidence >= threshold (default 0.55).
 *  3. Escalate to cloud when confidence is low OR forceCloud (audit/coach).
 *  4. Offline mode NEVER calls cloud.
 *
 * local_score_router.js delegates here so FETCH_SCORE stays one entry point.
 */

import { scoreGoalRelevance } from './ml_service.js';

export const DEFAULT_CONFIDENCE_THRESHOLD = 0.55;

async function callCloudScore({ apiBaseUrl, apiKey, videoUrl, goal, mode, cloudFetch }) {
  const body = {
    video_url: videoUrl,
    goal,
    mode: mode || 'title_and_description',
  };
  if (typeof cloudFetch === 'function') {
    return cloudFetch(body);
  }
  const res = await fetch(`${apiBaseUrl}/score`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey || '',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.json();
}

/**
 * @param {object} input
 * @param {string} input.goal
 * @param {string} [input.url]
 * @param {string} [input.title]
 * @param {string} [input.description]
 * @param {string} [input.channel]
 * @param {object} [options]
 */
export async function hybridScore(input, options = {}) {
  const goal = input.goal;
  const title = input.title || '';
  const description = input.description || '';
  const channel = input.channel || '';
  const videoUrl = input.url || input.videoUrl || '';

  const threshold =
    typeof options.confidenceThreshold === 'number'
      ? options.confidenceThreshold
      : DEFAULT_CONFIDENCE_THRESHOLD;
  const offline = Boolean(options.offlineMode);
  const forceCloud = Boolean(options.forceCloud);
  const enableLocal = options.enableLocal !== false;
  const cloudFallback = options.cloudFallback !== false;
  const t0 = Date.now();

  let local = null;
  let localMs = 0;

  if (enableLocal) {
    const lt0 = Date.now();
    local = await scoreGoalRelevance(goal, { title, description, channel });
    localMs = Date.now() - lt0;
    if (!local?.success) {
      local = null;
    }
  }

  const lowConfidence = !local || typeof local.confidence !== 'number' || local.confidence < threshold;
  const wantCloud = forceCloud || lowConfidence || !enableLocal;
  const mayCloud = !offline && cloudFallback && wantCloud;

  const meta = {
    hybrid: true,
    offline_mode: offline,
    force_cloud: forceCloud,
    confidence_threshold: threshold,
    local_score: local?.score ?? null,
    local_confidence: local?.confidence ?? null,
    local_model: local?.model ?? null,
    local_latency_ms: localMs,
    routed_to: 'local',
    reason: 'high_local_confidence',
  };

  if (offline) {
    if (!local) {
      return {
        error: 'Offline mode and local scorer unavailable',
        score: null,
        source: 'none',
        hybrid_meta: { ...meta, routed_to: 'none', reason: 'offline_no_local' },
        latency_ms: Date.now() - t0,
      };
    }
    meta.reason = forceCloud
      ? 'offline_forced_local_despite_forceCloud'
      : lowConfidence
        ? 'offline_low_confidence_kept_local'
        : 'offline_high_confidence';
    return {
      ...local,
      source: 'local',
      hybrid_meta: meta,
      latency_ms: Date.now() - t0,
    };
  }

  if (!mayCloud && local) {
    return {
      ...local,
      source: 'local',
      hybrid_meta: meta,
      latency_ms: Date.now() - t0,
    };
  }

  meta.routed_to = 'cloud';
  meta.reason = forceCloud
    ? 'force_cloud_audit_or_coach'
    : !enableLocal
      ? 'local_disabled'
      : 'low_local_confidence';

  const ct0 = Date.now();
  try {
    const cloud = await callCloudScore({
      apiBaseUrl: options.apiBaseUrl,
      apiKey: options.apiKey,
      videoUrl,
      goal,
      mode: options.mode,
      cloudFetch: options.cloudFetch,
    });
    meta.cloud_latency_ms = Date.now() - ct0;
    return {
      ...cloud,
      score: cloud.score ?? cloud,
      source: local ? 'hybrid' : 'cloud',
      local_score: local?.score ?? null,
      local_confidence: local?.confidence ?? null,
      model: local?.model,
      hybrid_meta: meta,
      latency_ms: Date.now() - t0,
    };
  } catch (err) {
    meta.cloud_error = err?.message || String(err);
    if (local) {
      meta.routed_to = 'local_fallback';
      meta.reason = 'cloud_failed_fallback_local';
      return {
        ...local,
        source: 'local_fallback',
        hybrid_meta: meta,
        latency_ms: Date.now() - t0,
        warning: 'Cloud score failed; used local result',
      };
    }
    return {
      error: meta.cloud_error,
      score: null,
      source: 'none',
      hybrid_meta: meta,
      latency_ms: Date.now() - t0,
    };
  }
}

export async function loadHybridPrefs(defaults = {}) {
  const keys = ['offlineMode', 'hybridConfidenceThreshold', 'enableLocalScorer', 'cloudFallback'];
  return new Promise((resolve) => {
    const fallback = {
      offlineMode: Boolean(defaults.offlineMode),
      confidenceThreshold: defaults.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD,
      enableLocal: defaults.enableLocal !== false,
      cloudFallback: defaults.cloudFallback !== false,
    };
    try {
      chrome.storage.local.get(keys, (data) => {
        resolve({
          offlineMode:
            typeof data.offlineMode === 'boolean' ? data.offlineMode : fallback.offlineMode,
          confidenceThreshold:
            typeof data.hybridConfidenceThreshold === 'number'
              ? data.hybridConfidenceThreshold
              : fallback.confidenceThreshold,
          enableLocal:
            typeof data.enableLocalScorer === 'boolean'
              ? data.enableLocalScorer
              : fallback.enableLocal,
          cloudFallback:
            typeof data.cloudFallback === 'boolean' ? data.cloudFallback : fallback.cloudFallback,
        });
      });
    } catch {
      resolve(fallback);
    }
  });
}

console.log('[hybridScorer] confidence hybrid routing loaded (threshold default', DEFAULT_CONFIDENCE_THRESHOLD, ')');
