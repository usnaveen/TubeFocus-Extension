/**
 * NAV-41 demo — Jev (TypeSafe System One) parallel purge decisions.
 * One state + N Choice questions in a single RTT.
 * Used by background service worker only (keeps API key off the page).
 */

const JEV_URL = 'https://api.typesafe.ai/v1/systemone';
const JEV_MODEL = 'jev-latest';

/**
 * @param {string} apiKey
 * @param {string} goal
 * @param {Array<{videoId:string,title?:string,channel?:string,description?:string}>} videos
 * @returns {Promise<{success:boolean,results:Array,error?:string,raw?:any}>}
 */
export async function scorePurgeWithJev(apiKey, goal, videos) {
  if (!apiKey) {
    return { success: false, error: 'missing_jev_api_key', results: [] };
  }
  const list = (videos || []).filter((v) => v && (v.videoId || v.id)).slice(0, 40);
  if (!list.length) {
    return { success: true, results: [], stats: { requested: 0 } };
  }

  const state = {
    goal: String(goal || '').trim() || 'general learning',
    task: 'Decide for each YouTube recommendation whether it helps the goal, drifts off-topic (purge), or is unclear.',
    videos: list.map((v) => ({
      id: v.videoId || v.id,
      title: v.title || '',
      channel: v.channel || '',
      description: (v.description || '').slice(0, 240)
    }))
  };

  /** @type {Record<string, object>} */
  const questions = {};
  for (const v of state.videos) {
    questions[`v_${v.id}`] = {
      type: 'choice',
      instructions:
        `For video id=${v.id} title="${(v.title || '').replace(/"/g, "'")}" channel="${(v.channel || '').replace(/"/g, "'")}": ` +
        `relative to the user goal, pick keep (on-goal), purge (off-topic / rabbit hole / entertainment), or unsure (too little signal).`,
      criteria: {
        keep: 'Clearly advances the stated learning/work goal',
        purge: 'Off-topic, rabbit hole, spam, or entertainment that distracts from the goal',
        unsure: 'Title/channel alone is too ambiguous to decide'
      }
    };
  }

  const body = {
    model: JEV_MODEL,
    state,
    questions
  };

  let response;
  try {
    response = await fetch(JEV_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });
  } catch (err) {
    return { success: false, error: err.message || String(err), results: [] };
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    return {
      success: false,
      error: `jev_http_${response.status}`,
      details: text.slice(0, 500),
      results: []
    };
  }

  const raw = await response.json();
  const answers = raw.answers || raw.results || raw;

  const results = state.videos.map((v) => {
    const key = `v_${v.id}`;
    const ans = answers[key] || answers[v.id] || {};
    const choice =
      ans.choice ||
      ans.selected ||
      (ans.answer && ans.answer.choice) ||
      'unsure';
    const confidence =
      typeof ans.confidence === 'number'
        ? ans.confidence
        : typeof ans.probability === 'number'
          ? ans.probability
          : 0.5;
    const decision = choice === 'keep' || choice === 'purge' || choice === 'unsure' ? choice : 'unsure';
    return {
      videoId: v.id,
      decision,
      score: decision === 'keep' ? Math.round(60 + confidence * 40) : decision === 'purge' ? Math.round(40 * (1 - confidence)) : 45,
      confidence,
      reason: `jev:${decision}`,
      source: 'jev',
      hide: decision === 'purge'
    };
  });

  return {
    success: true,
    results,
    stats: {
      requested: list.length,
      purge: results.filter((r) => r.decision === 'purge').length,
      keep: results.filter((r) => r.decision === 'keep').length,
      unsure: results.filter((r) => r.decision === 'unsure').length
    },
    engine: 'jev'
  };
}
