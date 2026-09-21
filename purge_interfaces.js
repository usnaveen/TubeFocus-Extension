/**
 * Purge-mode interface stubs (NAV-41 / NAV-42 / NAV-43).
 *
 * Bot1 (NAV-42): batch MiniLM + videoId cache — replace TubeFocusPurgeScorer
 * when that PR lands. Bot2 (NAV-41): snap-hide DOM — hook TubeFocusPurgeSnap
 * animation callbacks; always call TubeFocusPurge.softHide before hard remove.
 *
 * This file is intentionally side-effect light: it only fills gaps so Bot2's
 * snap path and the gatekeeper in content.js have a stable contract.
 */
(function initTubeFocusPurgeInterfaces(global) {
  'use strict';

  /**
   * @typedef {Object} PurgeScoreItem
   * @property {string} id - YouTube videoId
   * @property {string} [title]
   * @property {string} [channel]
   * @property {string} [description]
   */

  /**
   * @typedef {Object} PurgeScoreResult
   * @property {string} id
   * @property {'keep'|'purge'} decision
   * @property {number} score - relevance 0..1 (higher = more on-goal)
   * @property {number} [confidence]
   * @property {string} [reason]
   * @property {boolean} [fromCache]
   */

  const DEFAULT_THRESHOLD = 0.25;

  /**
   * Bot1 stub — batch score. Prefer real MiniLM router when present:
   *   - chrome.runtime message BATCH_CALCULATE_SIMILARITY (current gatekeeper)
   *   - or global.TubeFocusMiniLM.scoreBatch when NAV-42 lands
   */
  if (!global.TubeFocusPurgeScorer) {
    global.TubeFocusPurgeScorer = {
      threshold: DEFAULT_THRESHOLD,
      /**
       * @param {PurgeScoreItem[]} items
       * @param {{ goal?: string, threshold?: number }} [opts]
       * @returns {Promise<PurgeScoreResult[]>}
       */
      async scoreBatch(items, opts = {}) {
        if (typeof global.TubeFocusMiniLM?.scoreBatch === 'function') {
          return global.TubeFocusMiniLM.scoreBatch(items, opts);
        }
        // When NAV-42 background handler is present:
        if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
          try {
            const response = await new Promise((resolve) => {
              try {
                chrome.runtime.sendMessage({
                  type: 'PURGE_BATCH_SCORE',
                  goal: opts.goal || '',
                  recommendations: items || []
                }, resolve);
              } catch (_e) {
                resolve(null);
              }
            });
            if (response && response.success && Array.isArray(response.results)) {
              return response.results;
            }
          } catch (_e) {
            /* fall through to stub */
          }
        }
        // No-op keep-all stub so UI paths stay safe until Bot1 lands.
        return (items || []).map((item) => ({
          id: item.id,
          decision: 'keep',
          score: 1,
          confidence: 0,
          reason: 'stub_keep_pending_nav42',
          fromCache: false
        }));
      },
      /**
       * Cache lookup stub (NAV-42 fills this).
       * @param {string} videoId
       * @returns {PurgeScoreResult|null}
       */
      getCached(videoId) {
        if (typeof global.TubeFocusMiniLM?.getCached === 'function') {
          return global.TubeFocusMiniLM.getCached(videoId);
        }
        return null;
      }
    };
  }

  /**
   * Bot2 stub — snap animation hooks around softHide.
   * softHide itself lives in purge_undo.js (NAV-43).
   */
  if (!global.TubeFocusPurgeSnap) {
    global.TubeFocusPurgeSnap = {
      /**
       * Preferred Bot2 entry: soft-hide via NAV-43, optional snap class.
       * @param {Element} el
       * @param {{ videoId?: string, reason?: string, score?: number, title?: string }} [opts]
       */
      snapHide(el, opts = {}) {
        if (!el) return null;
        el.classList.add('tubefocus-snap-pending');
        const handle = global.TubeFocusPurge?.softHide
          ? global.TubeFocusPurge.softHide(el, opts)
          : null;
        // Animation polish lands with NAV-41; class is a stable hook point.
        requestAnimationFrame(() => {
          el.classList.remove('tubefocus-snap-pending');
          el.classList.add('tubefocus-snap-done');
        });
        return handle;
      },
      onSoftHidden(_handle, _opts) {},
      onRestored(_handle) {},
      onUndoExpired(_handle) {}
    };
  }

  /**
   * Decision helper shared by gatekeeper + future Bot2 loop.
   * @param {{ hide?: boolean, decision?: string, score?: number, reason?: string }} decision
   * @param {number} [threshold]
   */
  global.TubeFocusPurgeDecision = {
    shouldPurge(decision, threshold = DEFAULT_THRESHOLD) {
      if (!decision) return false;
      if (decision.decision === 'unsure' || decision.reason === 'unsure') return false;
      if (typeof decision.hide === 'boolean') return decision.hide;
      if (decision.decision === 'purge') return true;
      if (decision.decision === 'keep') return false;
      if (typeof decision.score === 'number') return decision.score < threshold;
      return false;
    }
  };
})(typeof window !== 'undefined' ? window : self);
