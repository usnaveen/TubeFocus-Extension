// ml_service.js
// Uses the global "transformers" object provided by transformers.min.js imported via importScripts

const { pipeline, env, cos_sim } = self.transformers;

// Configure ONNX Runtime to use local WASM files instead of fetching from CDN
// This is critical for Chrome Extension MV3 CSP compliance
env.allowLocalModels = false;
env.useBrowserCache = true;
env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('wasm/');

class PipelineSingleton {
    static task = 'feature-extraction';
    static model = 'Xenova/bge-micro-v2';
    static instance = null;

    static async getInstance(progress_callback = null) {
        if (this.instance === null) {
            this.instance = pipeline(this.task, this.model, { progress_callback });
        }
        return this.instance;
    }
}

// Background script listener
self.addEventListener('message', (event) => {
    // We'll receive BATCH_CALCULATE_SIMILARITY messages from background.js
    // Or, background.js can listen for chrome runtime messages and call us directly.
    // wait, since ml_service.js is imported into background.js, it shares the same service worker context.
});

// Expose a globally callable function since it's running in the background.js scope
self.calculateBatchSimilarity = async (goal, recommendations) => {
    try {
        // Get or initialize the model
        const extractor = await PipelineSingleton.getInstance((data) => {
            if (data.status === 'progress') {
                // console.log('[ML Worker] Loading progress:', data.file, Math.round(data.progress) + '%');
            }
        });

        // Calculate embedding for the user's goal
        const goalOutput = await extractor(goal, { pooling: 'cls', normalize: true });
        const goalVector = goalOutput.tolist()[0];

        const results = [];

        // Calculate embedding for each recommendation title
        for (const rec of recommendations) {
            const title = `${rec.title || ''} ${rec.channel || ''}`;
            const titleOutput = await extractor(title, { pooling: 'cls', normalize: true });
            const titleVector = titleOutput.tolist()[0];

            // Cosine similarity ranges from -1 to 1. Higher means more similar.
            const score = cos_sim(goalVector, titleVector);

            results.push({
                id: rec.id,
                score: score,
                title: rec.title,
                channel: rec.channel,
                thumbnail: rec.thumbnail || `https://i.ytimg.com/vi/${rec.videoId}/hqdefault.jpg`,
                videoId: rec.videoId
            });
        }

        return { success: true, results };
    } catch (error) {
        console.error('[ML Worker] Similarity calculation error:', error);
        return { success: false, error: error.message };
    }
};

console.log('[ML Worker] Transformers.js service loaded.');
