# Tier A scorer — manifest / background wiring notes

## Files in this slice
- `ml_service.js` — Transformers.js encoder; WebGPU preferred, WASM fallback; `scoreGoalRelevance` + batch filter
- `local_score_router.js` — local-first Gatekeeper path with optional cloud fallback + confidence
- `config.js` — `LOCAL_FIRST`, `CLOUD_FALLBACK`, `LOW_CONFIDENCE`

## background.js changes (apply on push)
1. Import: `import { scoreVideoLocalFirst } from './local_score_router.js';`
2. Keep: `import { calculateBatchSimilarity } from './ml_service.js';`
3. Replace `FETCH_SCORE` handler body to call `scoreVideoLocalFirst({ goal: msg.goal, url: msg.url, title: msg.title, description: msg.description })` then `sendResponse`
4. Replace `videoData` cloud-only fetch with the same router (pass title/desc when content script provides them)
5. Leave coach/librarian on cloud (out of scope)

## manifest.json additions
```json
"web_accessible_resources": [{
  "resources": ["wasm/*", "libs/*", "ml_service.js", "local_score_router.js"],
  "matches": ["https://*.youtube.com/*"]
}]
```
Service worker already `"type": "module"` — no offscreen required for first PR; add offscreen later if SW eviction bites.

## API surface for sibling bots
- Local result: `{ success, score (0-100), confidence (0-1), similarity, source: "local"|"hybrid"|"cloud", model }`
- Model id: `Xenova/all-MiniLM-L6-v2` (swap to fine-tuned/ONNX when Backend ml/ ships)

## Hybrid routing (Coder Bot 3)

- `hybridScorer.js` — confidence hybrid: local-first; cloud when `confidence < 0.55` or `forceCloud`; offline never calls cloud.
- `local_score_router.js` — delegates to `hybridScorer` while keeping `scoreVideoLocalFirst` API.
- Config: `HYBRID_CONFIDENCE_THRESHOLD` / `LOW_CONFIDENCE` (0.55), `OFFLINE_MODE`, storage overrides `offlineMode` / `hybridConfidenceThreshold`.
- `FETCH_SCORE` accepts `forceCloud` | `deepAudit` | `coach` to force Gemini for audit/coach paths.
- Backend docs: `docs/on-device-scoring.md` + `eval/` offline harness.
