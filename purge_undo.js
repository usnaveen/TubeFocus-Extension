/**
 * NAV-43 — Soft-hide + Undo toast (~5s) + false-purge metrics
 *
 * Public surface (also on window.TubeFocusPurge / window.__tubefocusPurgeMetrics):
 *   softHide(el, { videoId, reason, score, title, toastMs }) → undo handle
 *   recordKeep({ videoId, reason, score })
 *   recordEscalate({ videoId, reason })
 *   getMetrics() / resetMetrics()
 *   hardRemove(el) — only after undo window; prefers soft-hide first
 *
 * Bot2 snap path should call softHide (or TubeFocusPurge.softHide) before any
 * hard DOM removal. Bot1 scorer stubs live in purge_interfaces.js.
 */
(function initTubeFocusPurgeUndo(global) {
  'use strict';

  const STORAGE_KEY = 'tubefocusPurgeMetrics';
  const HIDDEN_CLASS = 'tubefocus-filter-hidden';
  const SOFT_ATTR = 'data-tubefocus-purged';
  const VIDEO_ATTR = 'data-tubefocus-video-id';
  const REASON_ATTR = 'data-tubefocus-purge-reason';
  const TOAST_ID = 'tubefocus-purge-undo-toast';
  const STYLE_ID = 'tubefocus-purge-undo-styles';
  const DEFAULT_TOAST_MS = 5000;

  /** @type {{ keep: number, purge: number, undo: number, escalate: number, byVideoId: Object<string, {keep:number,purge:number,undo:number,escalate:number}> }} */
  const metrics = {
    keep: 0,
    purge: 0,
    undo: 0,
    escalate: 0,
    byVideoId: Object.create(null)
  };

  /** @type {Map<string, UndoHandle>} */
  const activeByKey = new Map();
  /** VideoIds (or handle keys) already counted toward purge this session. */
  const purgeMetricKeys = new Set();
  /** Keys already counted as keep this session. */
  const keepMetricKeys = new Set();
  /** @type {UndoHandle[]} */
  let pendingBatch = [];
  let toastTimer = null;
  let toastDeadline = 0;
  let persistTimer = null;
  let storageHydrated = false;

  /**
   * @typedef {Object} SoftHideOptions
   * @property {string} [videoId]
   * @property {string} [reason]
   * @property {number} [score]
   * @property {string} [title]
   * @property {number} [toastMs]
   * @property {boolean} [silent] - skip toast (still restorable)
   * @property {boolean} [countMetric] - default true
   */

  /**
   * @typedef {Object} UndoHandle
   * @property {string} id
   * @property {string|null} videoId
   * @property {Element|null} element
   * @property {string} reason
   * @property {boolean} restored
   * @property {boolean} dismissed
   * @property {() => boolean} undo
   * @property {() => void} dismiss
   */

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .${HIDDEN_CLASS} {
        display: none !important;
      }
      #${TOAST_ID} {
        position: fixed;
        bottom: 88px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10050;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        background: rgba(20, 3, 5, 0.96);
        color: #fdf0d5;
        border: 1px solid rgba(253, 240, 213, 0.35);
        border-radius: 999px;
        box-shadow: 0 12px 28px rgba(0, 0, 0, 0.35);
        font-family: "Roboto", "YouTube Noto", Arial, sans-serif;
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.2px;
        max-width: min(92vw, 420px);
      }
      #${TOAST_ID} .tubefocus-purge-undo-msg {
        flex: 1;
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      #${TOAST_ID} .tubefocus-purge-undo-btn {
        appearance: none;
        border: none;
        cursor: pointer;
        background: #fdf0d5;
        color: #140305;
        font-weight: 800;
        font-size: 12px;
        letter-spacing: 0.4px;
        text-transform: uppercase;
        padding: 7px 12px;
        border-radius: 999px;
      }
      #${TOAST_ID} .tubefocus-purge-undo-btn:hover {
        filter: brightness(1.05);
      }
      #${TOAST_ID} .tubefocus-purge-undo-meta {
        font-size: 11px;
        font-weight: 500;
        opacity: 0.7;
        white-space: nowrap;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function videoBucket(videoId) {
    if (!videoId) return null;
    if (!metrics.byVideoId[videoId]) {
      metrics.byVideoId[videoId] = { keep: 0, purge: 0, undo: 0, escalate: 0 };
    }
    return metrics.byVideoId[videoId];
  }

  function bump(kind, videoId) {
    if (!Object.prototype.hasOwnProperty.call(metrics, kind)) return;
    metrics[kind] += 1;
    const bucket = videoBucket(videoId);
    if (bucket) bucket[kind] += 1;
    publishMetrics();
    schedulePersist();
  }

  function snapshotMetrics() {
    return {
      keep: metrics.keep,
      purge: metrics.purge,
      undo: metrics.undo,
      escalate: metrics.escalate,
      falsePurge: metrics.undo,
      byVideoId: { ...metrics.byVideoId },
      updatedAt: Date.now()
    };
  }

  function publishMetrics() {
    const snap = snapshotMetrics();
    global.__tubefocusPurgeMetrics = snap;
    if (global.TubeFocusPurge) {
      global.TubeFocusPurge.metrics = snap;
    }
  }

  function schedulePersist() {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(persistMetrics, 250);
  }

  function persistMetrics() {
    persistTimer = null;
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
    try {
      chrome.storage.local.set({ [STORAGE_KEY]: snapshotMetrics() }, () => {
        void chrome.runtime?.lastError;
      });
    } catch (_e) {
      /* extension context may be invalidated */
    }
  }

  function hydrateFromStorage() {
    if (storageHydrated) return;
    storageHydrated = true;
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      publishMetrics();
      return;
    }
    try {
      chrome.storage.local.get([STORAGE_KEY], (data) => {
        if (chrome.runtime?.lastError) {
          publishMetrics();
          return;
        }
        const saved = data && data[STORAGE_KEY];
        if (saved && typeof saved === 'object') {
          metrics.keep = Number(saved.keep || 0);
          metrics.purge = Number(saved.purge || 0);
          metrics.undo = Number(saved.undo || saved.falsePurge || 0);
          metrics.escalate = Number(saved.escalate || 0);
          if (saved.byVideoId && typeof saved.byVideoId === 'object') {
            metrics.byVideoId = { ...saved.byVideoId };
          }
        }
        publishMetrics();
      });
    } catch (_e) {
      publishMetrics();
    }
  }

  function handleKey(el, videoId) {
    if (videoId) return `vid:${videoId}`;
    if (el && el.isConnected) {
      if (!el.dataset.tubefocusPurgeKey) {
        el.dataset.tubefocusPurgeKey = `el:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      }
      return el.dataset.tubefocusPurgeKey;
    }
    return `anon:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function applySoftHideDom(el, videoId, reason) {
    if (!el) return;
    ensureStyles();
    el.classList.add(HIDDEN_CLASS);
    el.setAttribute(SOFT_ATTR, '1');
    if (videoId) el.setAttribute(VIDEO_ATTR, videoId);
    if (reason) el.setAttribute(REASON_ATTR, String(reason));
  }

  function restoreSoftHideDom(el) {
    if (!el) return;
    el.classList.remove(HIDDEN_CLASS);
    el.removeAttribute(SOFT_ATTR);
    el.removeAttribute(REASON_ATTR);
  }

  function removeToast() {
    const existing = document.getElementById(TOAST_ID);
    if (existing) existing.remove();
  }

  function dismissBatch(commitHard) {
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    toastDeadline = 0;
    removeToast();
    const batch = pendingBatch.slice();
    pendingBatch = [];
    for (const handle of batch) {
      if (!handle || handle.restored || handle.dismissed) continue;
      handle.dismissed = true;
      activeByKey.delete(handle.id);
      if (commitHard && typeof global.TubeFocusPurgeSnap?.onUndoExpired === 'function') {
        try {
          global.TubeFocusPurgeSnap.onUndoExpired(handle);
        } catch (_e) {
          /* Bot2 optional hook */
        }
      }
    }
  }

  function undoBatch() {
    const batch = pendingBatch.slice();
    pendingBatch = [];
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    toastDeadline = 0;
    removeToast();

    let restoredCount = 0;
    for (const handle of batch) {
      if (!handle || handle.restored || handle.dismissed) continue;
      if (restoreHandle(handle, { countUndo: true })) restoredCount += 1;
    }
    return restoredCount;
  }

  function restoreHandle(handle, { countUndo = true } = {}) {
    if (!handle || handle.restored) return false;
    handle.restored = true;
    handle.dismissed = true;
    activeByKey.delete(handle.id);
    purgeMetricKeys.delete(handle.id);
    restoreSoftHideDom(handle.element);
    if (countUndo) bump('undo', handle.videoId);
    if (typeof global.TubeFocusPurgeSnap?.onRestored === 'function') {
      try {
        global.TubeFocusPurgeSnap.onRestored(handle);
      } catch (_e) {
        /* optional */
      }
    }
    return true;
  }

  function renderToast() {
    ensureStyles();
    const alive = pendingBatch.filter((h) => h && !h.restored && !h.dismissed);
    pendingBatch = alive;
    if (!alive.length) {
      removeToast();
      return;
    }

    let toast = document.getElementById(TOAST_ID);
    if (!toast) {
      toast = document.createElement('div');
      toast.id = TOAST_ID;
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);
    }

    const count = alive.length;
    const first = alive[0];
    const label = count === 1
      ? `Hidden${first.title ? `: ${first.title}` : first.videoId ? ` ${first.videoId}` : ''}`
      : `Hidden ${count} videos`;
    const remainingMs = Math.max(0, toastDeadline - Date.now());
    const remainingSec = Math.ceil(remainingMs / 1000);

    toast.innerHTML = '';
    const msg = document.createElement('span');
    msg.className = 'tubefocus-purge-undo-msg';
    msg.textContent = label.trim();
    toast.appendChild(msg);

    const meta = document.createElement('span');
    meta.className = 'tubefocus-purge-undo-meta';
    meta.textContent = `${remainingSec}s`;
    toast.appendChild(meta);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tubefocus-purge-undo-btn';
    btn.textContent = 'Undo';
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      undoBatch();
    });
    toast.appendChild(btn);
  }

  function scheduleToastExpiry(toastMs) {
    const ms = Number.isFinite(toastMs) && toastMs > 0 ? toastMs : DEFAULT_TOAST_MS;
    toastDeadline = Date.now() + ms;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      dismissBatch(true);
    }, ms);

    // Refresh countdown label once per second while toast is up.
    const tick = () => {
      if (!document.getElementById(TOAST_ID) || !pendingBatch.length) return;
      renderToast();
      if (Date.now() < toastDeadline - 50) {
        setTimeout(tick, 1000);
      }
    };
    setTimeout(tick, 1000);
  }

  /**
   * Soft-hide a card. DOM stays restorable. Shows Undo toast (~5s).
   * @param {Element} el
   * @param {SoftHideOptions} [options]
   * @returns {UndoHandle|null}
   */
  function softHide(el, options = {}) {
    if (!el) return null;
    hydrateFromStorage();
    ensureStyles();

    const videoId = options.videoId || el.getAttribute(VIDEO_ATTR) || null;
    const reason = options.reason || 'purged';
    const key = handleKey(el, videoId);

    // Re-hide of same card: refresh toast membership without double-counting purge.
    const existing = activeByKey.get(key);
    if (existing && !existing.restored && !existing.dismissed) {
      existing.element = el;
      existing.reason = reason;
      existing.title = options.title || existing.title || '';
      applySoftHideDom(el, videoId, reason);
      if (!options.silent) {
        if (!pendingBatch.includes(existing)) pendingBatch.push(existing);
        scheduleToastExpiry(options.toastMs);
        renderToast();
      }
      return existing;
    }

    applySoftHideDom(el, videoId, reason);

    /** @type {UndoHandle} */
    const handle = {
      id: key,
      videoId,
      element: el,
      reason,
      title: options.title || '',
      score: typeof options.score === 'number' ? options.score : null,
      restored: false,
      dismissed: false,
      undo() {
        // Single-item undo also clears it from the batch toast.
        pendingBatch = pendingBatch.filter((h) => h !== handle);
        const ok = restoreHandle(handle, { countUndo: true });
        if (!pendingBatch.length) {
          if (toastTimer) clearTimeout(toastTimer);
          toastTimer = null;
          toastDeadline = 0;
          removeToast();
        } else {
          renderToast();
        }
        return ok;
      },
      dismiss() {
        if (handle.restored || handle.dismissed) return;
        handle.dismissed = true;
        activeByKey.delete(handle.id);
        pendingBatch = pendingBatch.filter((h) => h !== handle);
        if (!pendingBatch.length) {
          if (toastTimer) clearTimeout(toastTimer);
          toastTimer = null;
          toastDeadline = 0;
          removeToast();
        } else {
          renderToast();
        }
      }
    };

    activeByKey.set(key, handle);

    if (options.countMetric !== false && !purgeMetricKeys.has(key)) {
      purgeMetricKeys.add(key);
      bump('purge', videoId);
    }

    if (!options.silent) {
      pendingBatch.push(handle);
      scheduleToastExpiry(options.toastMs);
      renderToast();
    }

    if (typeof global.TubeFocusPurgeSnap?.onSoftHidden === 'function') {
      try {
        global.TubeFocusPurgeSnap.onSoftHidden(handle, options);
      } catch (_e) {
        /* optional Bot2 animation hook */
      }
    }

    return handle;
  }

  /**
   * Hard-remove only after soft-hide / undo window. Prefer softHide first.
   * @param {Element} el
   * @param {SoftHideOptions} [options]
   */
  function hardRemove(el, options = {}) {
    if (!el) return null;
    const alreadySoft = el.getAttribute(SOFT_ATTR) === '1' || el.classList.contains(HIDDEN_CLASS);
    if (!alreadySoft) {
      // Soft-hide before hard remove (NAV-43 contract).
      softHide(el, { ...options, silent: true, countMetric: options.countMetric !== false });
    }
    try {
      el.remove();
    } catch (_e) {
      /* node may already be gone */
    }
    return true;
  }

  function recordKeep(info = {}) {
    hydrateFromStorage();
    const key = info.videoId ? `vid:${info.videoId}` : `keep:${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    if (info.videoId && keepMetricKeys.has(key)) return;
    if (info.videoId) keepMetricKeys.add(key);
    bump('keep', info.videoId || null);
  }

  function recordEscalate(info = {}) {
    hydrateFromStorage();
    bump('escalate', info.videoId || null);
  }

  function getMetrics() {
    hydrateFromStorage();
    return snapshotMetrics();
  }

  function resetMetrics() {
    metrics.keep = 0;
    metrics.purge = 0;
    metrics.undo = 0;
    metrics.escalate = 0;
    metrics.byVideoId = Object.create(null);
    purgeMetricKeys.clear();
    keepMetricKeys.clear();
    publishMetrics();
    persistMetrics();
  }

  function clearAllSoftHides() {
    dismissBatch(false);
    activeByKey.clear();
    purgeMetricKeys.clear();
    keepMetricKeys.clear();
    document.querySelectorAll(`[${SOFT_ATTR}="1"], .${HIDDEN_CLASS}`).forEach((el) => {
      restoreSoftHideDom(el);
    });
  }

  const api = {
    softHide,
    hardRemove,
    recordKeep,
    recordEscalate,
    getMetrics,
    resetMetrics,
    clearAllSoftHides,
    undoPending: undoBatch,
    DEFAULT_TOAST_MS,
    HIDDEN_CLASS,
    metrics: snapshotMetrics()
  };

  global.TubeFocusPurge = api;
  // Friendly aliases for Bot2 snap path
  global.TubeFocusPurgeUndo = api;
  publishMetrics();
  hydrateFromStorage();
})(typeof window !== 'undefined' ? window : self);
