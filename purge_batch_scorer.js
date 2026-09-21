// purge_batch_scorer.js
// NAV-42: Batch MiniLM scoring + (goalHash, videoId) cache for Purge mode.
// Offline/local-first — no cloud/Jev required for v0.

import {
  scoreGoalRelevanceBatch,
  LOCAL_MODEL_ID
} from './ml_service.js';

const STORAGE_KEY = 'purgeScoreCacheV1';

const DEFAULTS = {
  PURGE_SCORE_BELOW: 40,
  UNSURE_BAND: 10,
  PURGE_LOW_CONFIDENCE: 0.45,
  PURGE_BATCH_SIZE: 20,
  PURGE_CACHE_MAX_ENTRIES: 500
};

/** In-memory mirror of chrome.storage.local[STORAGE_KEY]; hydrated on first use. */
let memoryCache = null;
let hydratePromise = null;
let persistTimer = null;

/** FNV-1a 32-bit → hex; stable goal hash so goal edits invalidate cache keys. */
export function hashGoal(goal) {
  const s = (goal || '').trim().toLowerCase().replace(/\s+/g, ' ');
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function cacheKey(goalHash, videoId) {
  return `${goalHash}:${videoId}`;
}

/**
 * Map score (0–100) + confidence → keep | purge | unsure.
 * Soft: low confidence forces unsure so Bot2 can leave the card visible.
 */
export function decidePurge(score, confidence, cfg = {}) {
  const purgeBelow = cfg.PURGE_SCORE_BELOW ?? DEFAULTS.PURGE_SCORE_BELOW;
  const band = cfg.UNSURE_BAND ?? DEFAULTS.UNSURE_BAND;
  const lowConf = cfg.PURGE_LOW_CONFIDENCE ?? DEFAULTS.PURGE_LOW_CONFIDENCE;

  if (typeof confidence === 'number' && confidence < lowConf) {
    return 'unsure';
  }
  if (typeof score !== 'number' || Number.isNaN(score)) {
    return 'unsure';
  }
  if (score < purgeBelow) return 'purge';
  if (score < purgeBelow + band) return 'unsure';
  return 'keep';
}

function storageGet(keys) {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(keys, (data) => resolve(data || {}));
    } catch (_) {
      resolve({});
    }
  });
}

function storageSet(obj) {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.set(obj, () => resolve());
    } catch (_) {
      resolve();
    }
  });
}

async function ensureCacheLoaded() {
  if (memoryCache) return memoryCache;
  if (!hydratePromise) {
    hydratePromise = storageGet([STORAGE_KEY]).then((data) => {
      memoryCache =
        data && typeof data[STORAGE_KEY] === 'object' && data[STORAGE_KEY]
          ? data[STORAGE_KEY]
          : {};
      return memoryCache;
    });
  }
  return hydratePromise;
}

function schedulePersist() {
  if (persistTimer) return;
  persistTimer = setTimeout(async () => {
    persistTimer = null;
    if (!memoryCache) return;
    await storageSet({ [STORAGE_KEY]: memoryCache });
  }, 250);
}

function trimCache(maxEntries) {
  if (!memoryCache) return;
  const keys = Object.keys(memoryCache);
  if (keys.length <= maxEntries) return;
  keys
    .map((k) => ({ k, ts: memoryCache[k]?.ts || 0 }))
    .sort((a, b) => a.ts - b.ts)
    .slice(0, keys.length - maxEntries)
    .forEach(({ k }) => {
      delete memoryCache[k];
    });
}

function normalizeVideo(v) {
  const videoId = (v && (v.videoId || v.id || v.video_id) || '').toString().trim();
  if (!videoId) return null;
  return {
    videoId,
    title: (v.title || '').toString(),
    channel: (v.channel || '').toString(),
    description: (v.description || '').toString()
  };
}

/**
 * Batch-score videos for Purge mode.
 * @param {string} goal
 * @param {Array<{videoId, title, channel?, description?}>} videos
 * @param {object} [config] — merge with DEFAULTS (PURGE_* knobs)
 * @returns {Promise<{ success, goalHash, results, stats }>}
 */
export async function scoreVideosBatch(goal, videos = [], config = {}) {
  const cfg = { ...DEFAULTS, ...config };
  const goalText = (goal || '').toString();
  const goalHash = hashGoal(goalText);
  const maxBatch = cfg.PURGE_BATCH_SIZE ?? DEFAULTS.PURGE_BATCH_SIZE;

  const seen = new Set();
  const ordered = [];
  for (const raw of videos) {
    const v = normalizeVideo(raw);
    if (!v || seen.has(v.videoId)) continue;
    seen.add(v.videoId);
    ordered.push(v);
  }

  await ensureCacheLoaded();

  const resultsById = new Map();
  const misses = [];

  for (const v of ordered) {
    const key = cacheKey(goalHash, v.videoId);
    const hit = memoryCache[key];
    if (hit && typeof hit.score === 'number') {
      const decision = decidePurge(hit.score, hit.confidence, cfg);
      resultsById.set(v.videoId, {
        videoId: v.videoId,
        score: hit.score,
        confidence: hit.confidence,
        similarity: hit.similarity,
        decision,
        cached: true,
        source: 'cache',
        model: hit.model || LOCAL_MODEL_ID
      });
      // Touch LRU
      memoryCache[key] = { ...hit, ts: Date.now(), decision };
    } else {
      misses.push(v);
    }
  }

  const toScore = misses.slice(0, maxBatch);
  const deferred = misses.slice(maxBatch);

  if (toScore.length) {
    const scored = await scoreGoalRelevanceBatch(goalText, toScore);
    if (!scored.success) {
      return {
        success: false,
        error: scored.error || 'Batch MiniLM scoring failed',
        goalHash,
        results: ordered.map((v) => resultsById.get(v.videoId)).filter(Boolean),
        stats: {
          requested: ordered.length,
          cached: resultsById.size,
          scored: 0,
          deferred: misses.length
        }
      };
    }

    for (const row of scored.results) {
      const decision = decidePurge(row.score, row.confidence, cfg);
      const entry = {
        videoId: row.videoId,
        score: row.score,
        confidence: row.confidence,
        similarity: row.similarity,
        decision,
        cached: false,
        source: 'local',
        model: row.model || LOCAL_MODEL_ID
      };
      resultsById.set(row.videoId, entry);

      const key = cacheKey(goalHash, row.videoId);
      memoryCache[key] = {
        score: row.score,
        confidence: row.confidence,
        similarity: row.similarity,
        decision,
        model: entry.model,
        ts: Date.now()
      };
    }

    trimCache(cfg.PURGE_CACHE_MAX_ENTRIES ?? DEFAULTS.PURGE_CACHE_MAX_ENTRIES);
    schedulePersist();
  }

  // Deferred overflow: mark unsure so Bot2 can retry next tick without hiding wrongly
  for (const v of deferred) {
    if (!resultsById.has(v.videoId)) {
      resultsById.set(v.videoId, {
        videoId: v.videoId,
        score: null,
        confidence: 0,
        decision: 'unsure',
        cached: false,
        source: 'deferred',
        model: LOCAL_MODEL_ID
      });
    }
  }

  const results = ordered.map((v) => resultsById.get(v.videoId)).filter(Boolean);
  const cachedCount = results.filter((r) => r.cached).length;

  return {
    success: true,
    goalHash,
    results,
    stats: {
      requested: ordered.length,
      unique: ordered.length,
      cached: cachedCount,
      scored: toScore.length,
      deferred: deferred.length,
      purge: results.filter((r) => r.decision === 'purge').length,
      keep: results.filter((r) => r.decision === 'keep').length,
      unsure: results.filter((r) => r.decision === 'unsure').length
    },
    thresholds: {
      PURGE_SCORE_BELOW: cfg.PURGE_SCORE_BELOW,
      UNSURE_BAND: cfg.UNSURE_BAND,
      PURGE_LOW_CONFIDENCE: cfg.PURGE_LOW_CONFIDENCE
    }
  };
}

/** Drop all purge cache entries (e.g. after debugging). */
export async function clearPurgeScoreCache() {
  memoryCache = {};
  hydratePromise = Promise.resolve(memoryCache);
  await storageSet({ [STORAGE_KEY]: {} });
}

/** Drop cache rows for one goal (optional helper). */
export async function clearPurgeScoreCacheForGoal(goal) {
  await ensureCacheLoaded();
  const prefix = `${hashGoal(goal)}:`;
  Object.keys(memoryCache).forEach((k) => {
    if (k.startsWith(prefix)) delete memoryCache[k];
  });
  schedulePersist();
}
