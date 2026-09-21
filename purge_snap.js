/**
 * NAV-41 — Thanos snap-hide for YouTube feed + watch sidebar.
 * Demo: Jev parallel Choice map scores cards → snap → softHide (NAV-43 Undo).
 * Offline fallback: MiniLM SCORE_BATCH.
 */
(function initTubeFocusPurgeSnap(global) {
  'use strict';

  const STYLE_ID = 'tubefocus-purge-snap-styles';
  const SNAP_CLASS = 'tubefocus-thanos-snap';
  const PENDING = 'tubefocus-snap-pending';
  const DONE = 'tubefocus-snap-done';
  const ANIM_MS = 420;

  const CARD_SELECTORS = [
    'ytd-rich-item-renderer',
    'ytd-compact-video-renderer',
    'ytd-video-renderer',
    'ytd-grid-video-renderer'
  ].join(',');

  const hooks = {
    onSoftHidden: function () {},
    onRestored: function () {},
    onUndoExpired: function () {}
  };

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent =
      '@keyframes tubefocus-thanos-dust{' +
      '0%{opacity:1;transform:scale(1);filter:blur(0);clip-path:inset(0)}' +
      '35%{opacity:.85;transform:scale(.98);filter:blur(.6px) brightness(1.15);box-shadow:0 0 24px rgba(180,80,255,.45)}' +
      '70%{opacity:.35;transform:scale(.86) translateY(10px);filter:blur(2.5px);clip-path:inset(0 8%)}' +
      '100%{opacity:0;transform:scale(.72) translateY(28px);filter:blur(6px);clip-path:inset(0 45%);max-height:0;margin:0;padding:0}' +
      '}' +
      '.' + PENDING + '{pointer-events:none!important;will-change:transform,opacity,filter,clip-path}' +
      '.' + SNAP_CLASS + '{animation:tubefocus-thanos-dust ' + ANIM_MS +
      'ms cubic-bezier(.25,.1,.25,1) forwards;pointer-events:none!important;overflow:hidden!important;transform-origin:center}';
    (document.head || document.documentElement).appendChild(style);
  }

  function softHideFn() {
    var api = global.TubeFocusPurge || global.TubeFocusPurgeUndo;
    if (!api || typeof api.softHide !== 'function') return null;
    return api.softHide.bind(api);
  }

  function snapHide(el, opts) {
    opts = opts || {};
    if (!el || el.nodeType !== 1) return null;
    ensureStyles();

    var options = {
      videoId: opts.videoId || el.getAttribute('data-tubefocus-video-id') || null,
      reason: opts.reason || 'purged',
      score: opts.score,
      title: opts.title || '',
      toastMs: opts.toastMs
    };

    var hide = softHideFn();

    function applySoft() {
      el.classList.remove(PENDING, SNAP_CLASS);
      el.classList.add(DONE);
      el.removeAttribute('data-tubefocus-snapping');
      var handle = hide ? hide(el, options) : null;
      try { hooks.onSoftHidden(handle, options); } catch (_e) {}
      return handle;
    }

    if (opts.skipAnim) return applySoft();

    el.classList.add(PENDING, SNAP_CLASS);
    el.setAttribute('data-tubefocus-snapping', '1');

    var proxy = {
      id: 'snap:' + (options.videoId || 'pending'),
      videoId: options.videoId,
      element: el,
      reason: options.reason,
      _inner: null,
      undo: function () {
        el.classList.remove(PENDING, SNAP_CLASS, DONE);
        el.removeAttribute('data-tubefocus-snapping');
        return proxy._inner && typeof proxy._inner.undo === 'function'
          ? proxy._inner.undo()
          : false;
      },
      dismiss: function () {
        if (proxy._inner && typeof proxy._inner.dismiss === 'function') proxy._inner.dismiss();
      }
    };

    var settled = false;
    function finish() {
      if (settled) return;
      settled = true;
      proxy._inner = applySoft();
      if (proxy._inner && proxy._inner.id) proxy.id = proxy._inner.id;
    }

    function onEnd(ev) {
      if (ev && ev.target !== el) return;
      el.removeEventListener('animationend', onEnd);
      finish();
    }
    el.addEventListener('animationend', onEnd);
    setTimeout(function () {
      el.removeEventListener('animationend', onEnd);
      finish();
    }, ANIM_MS + 100);

    return proxy;
  }

  function snapHideMany(items) {
    return (items || []).map(function (item) {
      var el = item && (item.el || item.element);
      return el ? snapHide(el, item) : null;
    });
  }

  function extractVideoId(el) {
    var attr = el.getAttribute('data-tubefocus-video-id');
    if (attr) return attr;
    var a = el.querySelector('a#thumbnail[href], a#video-title[href], a[href*="/watch"], a[href*="/shorts/"]');
    if (!a) return null;
    try {
      var u = new URL(a.getAttribute('href') || '', location.origin);
      if (u.pathname.indexOf('/shorts/') === 0) return u.pathname.split('/')[2] || null;
      return u.searchParams.get('v');
    } catch (_e) {
      return null;
    }
  }

  function extractTitle(el) {
    var t = el.querySelector('#video-title, #video-title-link, yt-formatted-string#video-title, h3 a');
    return (t && (t.getAttribute('title') || t.textContent || '').trim()) || '';
  }

  function extractChannel(el) {
    var c = el.querySelector('#channel-name a, ytd-channel-name yt-formatted-string, #text.complex-string');
    return (c && c.textContent.trim()) || '';
  }

  function collectCards(root) {
    var scope = root || document;
    var nodes = Array.prototype.slice.call(scope.querySelectorAll(CARD_SELECTORS));
    var seen = {};
    var out = [];
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.getAttribute('data-tubefocus-purged') === '1') continue;
      if (el.classList.contains('tubefocus-filter-hidden')) continue;
      var videoId = extractVideoId(el);
      if (!videoId || seen[videoId]) continue;
      seen[videoId] = true;
      out.push({
        el: el,
        element: el,
        videoId: videoId,
        id: videoId,
        title: extractTitle(el),
        channel: extractChannel(el)
      });
    }
    return out;
  }

  
  function normalizePurgeResults(raw) {
    if (!raw) return [];
    var list = raw.results || raw.scores || raw.data || [];
    if (!Array.isArray(list) && raw.success && Array.isArray(raw.recommendations)) list = raw.recommendations;
    return (list || []).map(function (r) {
      var id = r.videoId || r.id;
      var decision = r.decision;
      var score = typeof r.score === 'number' ? r.score : null;
      if (!decision && score != null) {
        // MiniLM often returns 0..1 similarity
        var s = score > 1 ? score / 100 : score;
        decision = s < 0.25 ? 'purge' : s < 0.4 ? 'unsure' : 'keep';
        score = Math.round(s * 100);
      }
      decision = decision || 'unsure';
      return {
        videoId: id,
        id: id,
        decision: decision,
        score: score == null ? 50 : score,
        confidence: typeof r.confidence === 'number' ? r.confidence : 0.5,
        reason: r.reason || ('score:' + decision),
        hide: decision === 'purge'
      };
    });
  }

  function scoreViaBackground(goal, videos, engine) {
    return new Promise(function (resolve) {
      try {
        chrome.runtime.sendMessage(
          {
            type: engine === 'jev' ? 'PURGE_SCORE_JEV' : 'BATCH_CALCULATE_SIMILARITY',
            goal: goal || '',
            recommendations: (videos || []).map(function (v) {
              return {
                id: v.videoId || v.id,
                videoId: v.videoId || v.id,
                title: v.title || '',
                channel: v.channel || '',
                description: v.description || ''
              };
            })
          },
          function (response) {
            if (chrome.runtime.lastError) {
              resolve({ success: false, error: chrome.runtime.lastError.message, results: [] });
              return;
            }
            resolve(response || { success: false, results: [] });
          }
        );
      } catch (err) {
        resolve({ success: false, error: err.message || String(err), results: [] });
      }
    });
  }

  function storageGet(keys) {
    return new Promise(function (resolve) {
      try {
        chrome.storage.local.get(keys, function (cfg) { resolve(cfg || {}); });
      } catch (_e) {
        resolve({});
      }
    });
  }

  /**
   * Demo purge pass.
   * opts.engine: 'jev' | 'minilm' | 'auto' (jev if key present)
   */
  async function runPurgePass(opts) {
    opts = opts || {};
    var engine = opts.engine || 'auto';
    var purge = global.TubeFocusPurge || {};
    var cards;
    if (typeof purge.collectCandidateVideos === 'function') {
      cards = purge.collectCandidateVideos().map(function (c) {
        return {
          el: c.element,
          element: c.element,
          videoId: c.videoId,
          id: c.videoId,
          title: c.title || '',
          channel: c.channel || ''
        };
      });
    } else {
      cards = collectCards();
    }
    if (!cards.length) return { scanned: 0, purged: 0, kept: 0, unsure: 0, engine: null };

    var useJev = engine === 'jev';
    if (engine === 'auto') {
      var cfg = await storageGet(['jevApiKey', 'purgeEngine']);
      useJev = !!(cfg.jevApiKey || cfg.purgeEngine === 'jev');
    }

    var results = [];
    var used = useJev ? 'jev' : 'minilm';
    if (useJev) {
      var res = await scoreViaBackground(opts.goal || '', cards, 'jev');
      if (res.success && Array.isArray(res.results) && res.results.length) {
        results = normalizePurgeResults(res);
      } else {
        used = 'minilm';
        var res2 = await scoreViaBackground(opts.goal || '', cards, 'minilm');
        results = normalizePurgeResults(res2);
      }
    } else if (typeof purge.requestPurgeScoreBatch === 'function') {
      var res3 = await purge.requestPurgeScoreBatch(opts.goal || '', cards);
      results = normalizePurgeResults(res3);
    } else {
      var res4 = await scoreViaBackground(opts.goal || '', cards, 'minilm');
      results = normalizePurgeResults(res4);
    }

    var byId = {};
    for (var i = 0; i < results.length; i++) {
      var r = results[i];
      byId[r.videoId || r.id] = r;
    }

    var purged = 0;
    var kept = 0;
    var unsure = 0;
    var decisionApi = global.TubeFocusPurgeDecision;
    var toSnap = [];

    for (var j = 0; j < cards.length; j++) {
      var card = cards[j];
      if (!card.el) continue;
      var d = byId[card.videoId] || { decision: 'keep', score: 1 };
      if (d.decision === 'unsure' || d.reason === 'unsure') {
        unsure += 1;
        continue;
      }
      var should = decisionApi
        ? decisionApi.shouldPurge(d)
        : d.decision === 'purge' || d.hide === true;
      if (should) {
        toSnap.push({ card: card, d: d });
      } else {
        kept += 1;
        if (typeof purge.recordKeep === 'function') {
          purge.recordKeep({ videoId: card.videoId, reason: d.reason || 'keep', score: d.score });
        }
      }
    }

    toSnap.forEach(function (item, idx) {
      setTimeout(function () {
        snapHide(item.card.el, {
          videoId: item.card.videoId,
          title: item.card.title,
          score: typeof item.d.score === 'number' ? item.d.score : undefined,
          reason: item.d.reason || 'purged'
        });
      }, idx * 55);
    });
    purged = toSnap.length;

    return { scanned: cards.length, purged: purged, kept: kept, unsure: unsure, engine: used };
  }

  var api = {
    snapHide: snapHide,
    snapHideMany: snapHideMany,
    collectCards: collectCards,
    runPurgePass: runPurgePass,
    get onSoftHidden() { return hooks.onSoftHidden; },
    set onSoftHidden(fn) { hooks.onSoftHidden = fn; },
    get onRestored() { return hooks.onRestored; },
    set onRestored(fn) { hooks.onRestored = fn; },
    get onUndoExpired() { return hooks.onUndoExpired; },
    set onUndoExpired(fn) { hooks.onUndoExpired = fn; },
    ANIM_MS: ANIM_MS,
    CARD_SELECTORS: CARD_SELECTORS
  };

  global.TubeFocusPurgeSnap = api;
})(typeof window !== 'undefined' ? window : self);
