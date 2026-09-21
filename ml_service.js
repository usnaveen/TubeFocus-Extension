// ml_service.js
// On-device goal↔title/description scorer (Transformers.js).
// MV3 service-worker safe: ONNX WASM is single-threaded with proxy disabled
// (URL.createObjectURL is not available in Chrome extension service workers).
// If MiniLM cannot load, falls back to lexical token-overlap scoring so
// SCORE_BATCH / Purge keep working fully offline.

import { pipeline, env, cos_sim } from './libs/transformers.min.js';

env.allowLocalModels = false;
env.useBrowserCache = true;
env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('wasm/');

// Detect MV3 service worker (no DOM, no createObjectURL for ORT worker proxy).
const IS_SERVICE_WORKER =
  typeof ServiceWorkerGlobalScope !== 'undefined' &&
  typeof self !== 'undefined' &&
  self instanceof ServiceWorkerGlobalScope;

const CAN_CREATE_OBJECT_URL =
  typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';

// SW-safe ONNX: blob-worker proxy + multi-thread WASM need createObjectURL.
try {
  if (env.backends?.onnx?.wasm) {
    env.backends.onnx.wasm.numThreads = 1;
    env.backends.onnx.wasm.proxy = false;
  }
} catch (_) {
  /* ignore */
}

// Prefer WebGPU only outside the service worker; SW keeps default WASM.
try {
  if (!IS_SERVICE_WORKER && navigator?.gpu) {
    env.backends.onnx.backend = 'webgpu';
  }
} catch (_) {
  // Service worker / offscreen without GPU — WASM path remains.
}

/** Configurable MiniLM/SetFit-class encoder. Sibling train slice may ship a fine-tuned id. */
export const LOCAL_MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
/** Legacy default used for feed filtering; keep for BATCH_CALCULATE_SIMILARITY compat. */
export const FILTER_MODEL_ID = 'Xenova/bge-micro-v2';

/** Set once MiniLM load fails so we skip repeated createObjectURL crashes. */
let miniLmUnavailable = false;
let miniLmDisableReason = '';

function markMiniLmUnavailable(reason) {
  miniLmUnavailable = true;
  miniLmDisableReason = reason || miniLmDisableReason || 'MiniLM unavailable';
  console.warn('[ML] MiniLM disabled, using lexical fallback:', miniLmDisableReason);
}

// Proactively skip MiniLM when blob URLs cannot be created (classic MV3 SW failure).
if (IS_SERVICE_WORKER && !CAN_CREATE_OBJECT_URL) {
  markMiniLmUnavailable('URL.createObjectURL is not a function (MV3 service worker)');
}

class PipelineSingleton {
  static task = 'feature-extraction';
  static instances = new Map();

  static async getInstance(modelId = LOCAL_MODEL_ID, progress_callback = null) {
    if (miniLmUnavailable) {
      throw new Error(miniLmDisableReason || 'MiniLM unavailable in this context');
    }
    if (!this.instances.has(modelId)) {
      this.instances.set(
        modelId,
        pipeline(this.task, modelId, {
          progress_callback
        })
      );
    }
    try {
      return await this.instances.get(modelId);
    } catch (err) {
      this.instances.delete(modelId);
      markMiniLmUnavailable(err?.message || String(err));
      throw err;
    }
  }
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

/** Map cosine similarity (~-1..1) to a 0–100 relevance score. */
export function similarityToScore(sim) {
  return Math.round(clamp01((sim + 1) / 2) * 100);
}

/**
 * Confidence heuristic for hybrid routing (Coder Bot 3).
 * High |sim| → confident local decision; mid-band → low confidence.
 */
export function confidenceFromSimilarity(sim) {
  const strength = Math.abs(sim);
  if (strength >= 0.55) return 0.9;
  if (strength >= 0.35) return 0.65;
  return 0.35;
}

const STOP = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'what', 'when',
  'where', 'why', 'how', 'learn', 'learning', 'video', 'videos', 'about',
  'into', 'a', 'an', 'to', 'of', 'in', 'on', 'is', 'are', 'you', 'your',
  'my', 'me', 'we', 'our', 'it', 'its', 'as', 'by', 'or', 'be', 'at',
  'vs', 'using', 'use', 'used'
]);

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

/**
 * Lexical token-overlap fallback when Transformers/ONNX cannot run in the SW.
 * Same shape as MiniLM local results so routers/purge keep working offline.
 */
export function lexicalScoreGoalRelevance(goal, { title = '', description = '', channel = '' } = {}) {
  const goalToks = tokenize(goal);
  const videoToks = new Set(tokenize(`${title} ${channel} ${description}`));
  if (!goalToks.length) {
    return {
      success: true,
      score: 50,
      confidence: 0.2,
      similarity: 0,
      source: 'lexical',
      model: 'lexical-token-overlap',
      title,
      description,
      backend: 'lexical'
    };
  }
  const hits = goalToks.filter((t) => videoToks.has(t)).length;
  const ratio = hits / goalToks.length;
  // Map overlap → soft similarity in roughly [-0.2, 0.9] then 0–100 score
  const similarity = Math.max(-0.2, Math.min(0.95, -0.2 + ratio * 1.15));
  const score = similarityToScore(similarity);
  const confidence = Math.max(0.25, Math.min(0.85, Math.abs(ratio - 0.5) * 1.2 + 0.35));
  return {
    success: true,
    score,
    confidence: Number(confidence.toFixed(4)),
    similarity,
    source: 'lexical',
    model: 'lexical-token-overlap',
    title,
    description,
    backend: 'lexical',
    reason: `overlap=${ratio.toFixed(3)} hits=${hits}/${goalToks.length}`
  };
}

function shouldUseLexical(err) {
  const msg = (err && err.message) || String(err || '');
  return (
    miniLmUnavailable ||
    /createObjectURL/i.test(msg) ||
    /Failed to fetch/i.test(msg) ||
    /no available backend/i.test(msg) ||
    /onnxruntime/i.test(msg) ||
    /onnx/i.test(msg)
  );
}

async function embed(extractor, text) {
  const output = await extractor(text || '', { pooling: 'mean', normalize: true });
  return output.tolist()[0];
}

/**
 * Score a single video against the user goal (local-first Gatekeeper path).
 * @returns {{ success, score, confidence, similarity, source, model }}
 */
export async function scoreGoalRelevance(goal, { title = '', description = '', channel = '' } = {}) {
  if (miniLmUnavailable) {
    return lexicalScoreGoalRelevance(goal, { title, description, channel });
  }

  try {
    const extractor = await PipelineSingleton.getInstance(LOCAL_MODEL_ID);
    const goalVector = await embed(extractor, goal);
    const videoText = [title, channel, description].filter(Boolean).join(' ').slice(0, 2000);
    const videoVector = await embed(extractor, videoText);
    const similarity = cos_sim(goalVector, videoVector);
    const score = similarityToScore(similarity);
    const confidence = confidenceFromSimilarity(similarity);
    return {
      success: true,
      score,
      confidence,
      similarity,
      source: 'local',
      model: LOCAL_MODEL_ID,
      title,
      description,
      backend: !IS_SERVICE_WORKER && navigator?.gpu ? 'webgpu-or-wasm' : 'wasm'
    };
  } catch (error) {
    console.error('[ML] scoreGoalRelevance error:', error);
    if (shouldUseLexical(error)) {
      markMiniLmUnavailable(error?.message || String(error));
      return lexicalScoreGoalRelevance(goal, { title, description, channel });
    }
    return { success: false, error: error.message, source: 'local' };
  }
}

/**
 * Batch score videos against one goal (embeds goal once).
 * @param {string} goal
 * @param {Array<{videoId, title?, channel?, description?}>} videos
 * @returns {{ success, results: Array<{videoId, score, confidence, similarity, ...}>, model }}
 */
export async function scoreGoalRelevanceBatch(goal, videos = []) {
  const asLexicalBatch = () => {
    const results = (videos || []).map((v) => {
      const videoId = (v.videoId || v.id || '').toString();
      const title = v.title || '';
      const channel = v.channel || '';
      const description = v.description || '';
      const scored = lexicalScoreGoalRelevance(goal, { title, description, channel });
      return {
        videoId,
        score: scored.score,
        confidence: scored.confidence,
        similarity: scored.similarity,
        title,
        channel,
        description,
        source: 'lexical',
        model: 'lexical-token-overlap',
        reason: scored.reason
      };
    });
    return {
      success: true,
      results,
      source: 'lexical',
      model: 'lexical-token-overlap',
      backend: 'lexical'
    };
  };

  if (miniLmUnavailable) {
    return asLexicalBatch();
  }

  try {
    const extractor = await PipelineSingleton.getInstance(LOCAL_MODEL_ID);
    const goalVector = await embed(extractor, goal || '');
    const results = [];

    for (const v of videos) {
      const videoId = (v.videoId || v.id || '').toString();
      const title = v.title || '';
      const channel = v.channel || '';
      const description = v.description || '';
      const videoText = [title, channel, description].filter(Boolean).join(' ').slice(0, 2000);
      const videoVector = await embed(extractor, videoText);
      const similarity = cos_sim(goalVector, videoVector);
      results.push({
        videoId,
        score: similarityToScore(similarity),
        confidence: confidenceFromSimilarity(similarity),
        similarity,
        title,
        channel,
        description,
        source: 'local',
        model: LOCAL_MODEL_ID
      });
    }

    return {
      success: true,
      results,
      source: 'local',
      model: LOCAL_MODEL_ID,
      backend: !IS_SERVICE_WORKER && navigator?.gpu ? 'webgpu-or-wasm' : 'wasm'
    };
  } catch (error) {
    console.error('[ML] scoreGoalRelevanceBatch error:', error);
    if (shouldUseLexical(error)) {
      markMiniLmUnavailable(error?.message || String(error));
      return asLexicalBatch();
    }
    return { success: false, error: error.message, source: 'local', results: [] };
  }
}

/** Batch feed-filter similarity (existing content.js path). */
export async function calculateBatchSimilarity(goal, recommendations) {
  const lexicalResults = () =>
    (recommendations || []).map((rec) => {
      const scored = lexicalScoreGoalRelevance(goal, {
        title: rec.title || '',
        channel: rec.channel || ''
      });
      return {
        id: rec.id,
        score: scored.similarity,
        title: rec.title,
        channel: rec.channel,
        thumbnail: rec.thumbnail || `https://i.ytimg.com/vi/${rec.videoId}/hqdefault.jpg`,
        videoId: rec.videoId,
        source: 'lexical'
      };
    });

  if (miniLmUnavailable) {
    return {
      success: true,
      results: lexicalResults(),
      source: 'lexical',
      model: 'lexical-token-overlap'
    };
  }

  try {
    const extractor = await PipelineSingleton.getInstance(FILTER_MODEL_ID, (data) => {
      if (data.status === 'progress') {
        // loading
      }
    });

    const goalOutput = await extractor(goal, { pooling: 'cls', normalize: true });
    const goalVector = goalOutput.tolist()[0];
    const results = [];

    for (const rec of recommendations) {
      const title = `${rec.title || ''} ${rec.channel || ''}`;
      const titleOutput = await extractor(title, { pooling: 'cls', normalize: true });
      const titleVector = titleOutput.tolist()[0];
      const score = cos_sim(goalVector, titleVector);
      results.push({
        id: rec.id,
        score,
        title: rec.title,
        channel: rec.channel,
        thumbnail: rec.thumbnail || `https://i.ytimg.com/vi/${rec.videoId}/hqdefault.jpg`,
        videoId: rec.videoId
      });
    }

    return { success: true, results, source: 'local', model: FILTER_MODEL_ID };
  } catch (error) {
    console.error('[ML] Similarity calculation error:', error);
    if (shouldUseLexical(error)) {
      markMiniLmUnavailable(error?.message || String(error));
      return {
        success: true,
        results: lexicalResults(),
        source: 'lexical',
        model: 'lexical-token-overlap'
      };
    }
    return { success: false, error: error.message };
  }
}

console.log(
  '[ML] Local Transformers.js scorer loaded (SW-safe ONNX; lexical fallback if MiniLM unavailable).'
);
