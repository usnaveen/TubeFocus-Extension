# Purge mode (NAV-44 demo polish)

One branch that demos **Thanos snap** on YouTube Home + watch sidebar using **MiniLM only** (no API key). Optional **Jev** when a key is stored in `chrome.storage` (never commit a key).

| Piece | Issue | Role |
|-------|-------|------|
| Batch MiniLM + cache | NAV-42 / PR #12 | `SCORE_BATCH` offline scorer |
| Thanos snap + Jev + popup | NAV-41 / PR #13 | snap animation, engine switch, demo button |
| Undo toast + metrics | NAV-43 / PR #11 | softHide, Undo ~5s, false-purge counts |

`FETCH_SCORE` / single-video local-first path is unchanged.

---

## Demo steps (MiniLM — no key needed)

1. Load this unpacked extension in `chrome://extensions` (Developer mode → Load unpacked → this folder).
2. Open [YouTube Home](https://www.youtube.com/) **or** a watch page with a sidebar.
3. Open the TubeFocus popup:
   - Set a clear **goal** (e.g. `learn system design`) — used for scoring.
   - **Scorer** → `MiniLM — local / offline` (or leave `Auto`; without a key it uses MiniLM).
   - Leave the Jev key field empty.
   - Optionally check **Enable Purge during session**.
4. Click **Thanos Snap Now**.
5. First run may take a few seconds while MiniLM downloads/loads in the service worker; later snaps are faster (cache).
6. Off-goal cards **dust away**, then soft-hide. An **Undo** toast appears ~5s — click Undo to restore (counts as false-purge).
7. Popup metrics update: `keep · purge · undo/false · escalate`.

Jev path (optional): paste a TypeSafe/Jev key in the masked field (stored only in `chrome.storage.local` as `jevApiKey`). Choose `Auto` or `Jev`. If the key is missing or Jev fails, MiniLM runs automatically.

---

## Dual engine

| Engine | When | Message |
|--------|------|---------|
| **MiniLM** | Always works offline | `SCORE_BATCH` / `PURGE_SCORE_BATCH` → `purge_batch_scorer.js` |
| **Jev** | Only if `jevApiKey` (or `TYPESAFE_API_KEY`) is in `chrome.storage.local` | `PURGE_SCORE_JEV` → `purge_jev_scorer.js` |

Popup `purgeEngine`: `auto` | `minilm` | `jev`. Auto = Jev iff a key exists, else MiniLM.

---

## Message API — `SCORE_BATCH`

```js
chrome.runtime.sendMessage({
  type: 'SCORE_BATCH',          // alias: PURGE_SCORE_BATCH
  goal: 'learn system design',
  videos: [
    { videoId: 'abc123', title: '...', channel: '...', description: '...' }
  ]
  // optional: PURGE_SCORE_BELOW, UNSURE_BAND, PURGE_LOW_CONFIDENCE, PURGE_BATCH_SIZE
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
      confidence: 0.9,
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

Helpers (content):

```js
const candidates = TubeFocusPurge.collectCandidateVideos();
const { results } = await TubeFocusPurge.requestPurgeScoreBatch(goal, candidates);
// Snap only decision === 'purge'
await TubeFocusPurgeSnap.runPurgePass({ goal, engine: 'minilm' });
```

---

## Thresholds (`config.js`)

| Knob | Default | Meaning |
|------|---------|---------|
| `PURGE_SCORE_BELOW` | `40` | `score < 40` → **purge** |
| `UNSURE_BAND` | `10` | `40 ≤ score < 50` → **unsure**; `≥ 50` → **keep** |
| `PURGE_LOW_CONFIDENCE` | `0.45` | low MiniLM confidence forces **unsure** |
| `PURGE_BATCH_SIZE` | `20` | max MiniLM embeds per message |
| `PURGE_CACHE_MAX_ENTRIES` | `500` | LRU trim for persisted cache |

Cache key: `` `${goalHash}:${videoId}` `` (goal change → new hash). Clear: `{ type: 'CLEAR_PURGE_SCORE_CACHE' }`.

---

## End-to-end wire

```
popup [Thanos Snap Now]
  → background PURGE_RUN_DEMO
  → content TubeFocusPurgeSnap.runPurgePass
  → SCORE_BATCH (MiniLM) or PURGE_SCORE_JEV (if keyed)
  → snapHide → TubeFocusPurge.softHide (Undo toast + metrics)
```

Manifest content order: `purge_undo.js` → `purge_interfaces.js` → `purge_snap.js` → `content.js`.

---

## Files

| File | Role |
|------|------|
| `purge_batch_scorer.js` | MiniLM batch + cache + decisions |
| `ml_service.js` | embeddings / `scoreGoalRelevanceBatch` |
| `local_score_router.js` | single-video `FETCH_SCORE` (unchanged) |
| `purge_jev_scorer.js` | optional Jev Choice map |
| `purge_snap.js` | Thanos snap + `runPurgePass` |
| `purge_undo.js` | softHide, Undo, false-purge metrics |
| `purge_interfaces.js` | shared decision helpers |
| `background.js` | `SCORE_BATCH`, `PURGE_SCORE_JEV`, `PURGE_RUN_DEMO`, `FETCH_SCORE` |
| `popup.html` / `popup.js` | Purge toggle, engine, masked key, Snap, metrics |
| `config.js` | purge thresholds |

**Never commit API keys.** Store Jev keys only via the popup → `chrome.storage.local`.
