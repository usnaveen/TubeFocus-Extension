# Purge mode — batch scorer API (NAV-42)

Owner: Bot1. Snap-hide DOM is **Bot2 (NAV-41)**; Undo toast + metrics is **Bot3 (NAV-43)**.

Offline / local-first: on-device MiniLM via `ml_service.js` (`scoreGoalRelevanceBatch`). No Gemini/Jev required for v0.

## Message API (content → background)

```js
chrome.runtime.sendMessage({
  type: 'SCORE_BATCH',          // alias: PURGE_SCORE_BATCH
  goal: 'learn system design',
  videos: [
    { videoId: 'abc123', title: '...', channel: '...', description: '...' } // desc optional
  ]
  // optional overrides: PURGE_SCORE_BELOW, UNSURE_BAND, PURGE_LOW_CONFIDENCE, PURGE_BATCH_SIZE
}, (res) => { /* ... */ });
```

### Response

```js
{
  success: true,
  goalHash: 'a1b2c3d4',
  results: [
    {
      videoId: 'abc123',
      score: 28,              // 0–100 relevance
      confidence: 0.9,        // 0–1
      decision: 'purge',      // 'keep' | 'purge' | 'unsure'
      cached: false,
      source: 'local',        // 'local' | 'cache' | 'deferred'
      model: 'Xenova/all-MiniLM-L6-v2'
    }
  ],
  stats: { requested, unique, cached, scored, deferred, purge, keep, unsure },
  thresholds: { PURGE_SCORE_BELOW, UNSURE_BAND, PURGE_LOW_CONFIDENCE }
}
```

`FETCH_SCORE` / single-video path is unchanged.

## How Bot2 should call it

```js
const candidates = TubeFocusPurge.collectCandidateVideos();
// [{ videoId, title, channel, element }, ...]

const { results } = await TubeFocusPurge.requestPurgeScoreBatch(goal, candidates);
// Snap-hide only decision === 'purge' (NAV-41). Leave unsure/keep visible.
```

- Do **not** load transformers in the content script — background holds the model.
- On scroll/mutation, call again; cache hits return `cached: true` instantly.
- Background scores at most `PURGE_BATCH_SIZE` (~20) misses per call. Overflow → `decision: 'unsure'`, `source: 'deferred'` — retry next tick.

## Thresholds (`config.js`)

| Knob | Default | Meaning |
|------|---------|---------|
| `PURGE_SCORE_BELOW` | `40` | `score < 40` → **purge** |
| `UNSURE_BAND` | `10` | `40 ≤ score < 50` → **unsure**; `≥ 50` → **keep** |
| `PURGE_LOW_CONFIDENCE` | `0.45` | low MiniLM confidence forces **unsure** |
| `PURGE_BATCH_SIZE` | `20` | max MiniLM embeds per message |
| `PURGE_CACHE_MAX_ENTRIES` | `500` | LRU trim for persisted cache |

## Cache key design

- Key: `` `${goalHash}:${videoId}` ``
- `goalHash` = FNV-1a hex of normalized goal (`trim` + lower + collapse spaces)
- Goal change → new hash → automatic invalidation
- Layers: in-memory (SW lifetime) + `chrome.storage.local` (`purgeScoreCacheV1` or equivalent)
- Clear: `{ type: 'CLEAR_PURGE_SCORE_CACHE' }`

## Files

| File | Role |
|------|------|
| `purge_batch_scorer.js` | `scoreVideosBatch`, cache, `decidePurge` |
| `ml_service.js` | `scoreGoalRelevanceBatch` (goal embedded once) |
| `local_score_router.js` | single-video `FETCH_SCORE` (unchanged) |
| `background.js` | `SCORE_BATCH` / `PURGE_SCORE_BATCH` handlers |
| `config.js` | purge thresholds |
| `content.js` | `TubeFocusPurge.collectCandidateVideos` + `requestPurgeScoreBatch` |

## Out of scope

- Snap-hide / CSS animation (Bot2 / NAV-41)
- Undo toast + purge metrics (Bot3 / NAV-43)
- Cloud/Jev re-score of unsure band (later hybrid)
