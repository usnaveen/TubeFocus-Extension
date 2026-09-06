// ml_service.js
// On-device goal↔title/description scorer (Transformers.js).
// Prefers WebGPU; falls back to WASM (local ort wasm under wasm/).

import { pipeline, env, cos_sim } from './libs/transformers.min.js';

env.allowLocalModels = false;
env.useBrowserCache = true;
env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('wasm/');

// Prefer WebGPU when available; ONNX Runtime WASM is the fallback.
try {
  if (navigator?.gpu) {
    env.backends.onnx.backend = 'webgpu';
  }
} catch (_) {
  // Service worker / offscreen without GPU — WASM path remains.
}

/** Configurable MiniLM/SetFit-class encoder. Sibling train slice may ship a fine-tuned id. */
export const LOCAL_MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
/** Legacy default used for feed filtering; keep for BATCH_CALCULATE_SIMILARITY compat. */
export const FILTER_MODEL_ID = 'Xenova/bge-micro-v2';

class PipelineSingleton {
  static task = 'feature-extraction';
  static instances = new Map();

  static async getInstance(modelId = LOCAL_MODEL_ID, progress_callback = null) {
    if (!this.instances.has(modelId)) {
      this.instances.set(
        modelId,
        pipeline(this.task, modelId, {
          progress_callback,
          // dtype / device hints — transformers.js picks WebGPU when env allows
        })
      );
    }
    return this.instances.get(modelId);
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

async function embed(extractor, text) {
  const output = await extractor(text || '', { pooling: 'mean', normalize: true });
  return output.tolist()[0];
}

/**
 * Score a single video against the user goal (local-first Gatekeeper path).
 * @returns {{ success, score, confidence, similarity, source, model }}
 */
export async function scoreGoalRelevance(goal, { title = '', description = '', channel = '' } = {}) {
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
      backend: navigator?.gpu ? 'webgpu-or-wasm' : 'wasm'
    };
  } catch (error) {
    console.error('[ML] scoreGoalRelevance error:', error);
    return { success: false, error: error.message, source: 'local' };
  }
}

/** Batch feed-filter similarity (existing content.js path). */
export async function calculateBatchSimilarity(goal, recommendations) {
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
    return { success: false, error: error.message };
  }
}

console.log('[ML] Local Transformers.js scorer loaded (WebGPU preferred, WASM fallback).');
