/**
 * .github/scripts/live-smoke.mjs
 * Live smoke test pinned to the deployed workers.dev URL (run by the
 * live-smoke.yml workflow — manual trigger or daily schedule).
 *
 * Verifies two things against production:
 *   1. The static site serves (200 + expected title).
 *   2. POST /api/submit validates, stamps and stores a submission (202,
 *      stored:true) through the SUBMISSIONS_KV binding.
 *
 * Submissions written here are identifiable ("pipeline-smoke <ts>" labels) so
 * they can be filtered/purged from the SUBMISSIONS KV namespace later.
 *
 * Run locally with:  node .github/scripts/live-smoke.mjs
 */

const LIVE_URL = process.env.LIVE_URL || 'https://business-evaluator.marequiron.workers.dev';

const CATEGORY_IDS = ['finance', 'marketing', 'operations', 'hr', 'technology', 'customer', 'strategy'];
const SMOKE_TAG = `pipeline-smoke ${Date.now()}`;

function fail(msg) {
  console.error('FAIL: ' + msg);
  process.exit(1);
}

const body = JSON.stringify({
  language: 'simple',
  categories: CATEGORY_IDS.map((id) => ({
    id,
    label: SMOKE_TAG,
    score: 4,
    band: 'strength',
  })),
});

// 1. Static site serves
const siteRes = await fetch(LIVE_URL, { redirect: 'follow' });
if (siteRes.status !== 200) fail(`expected 200 from ${LIVE_URL}, got ${siteRes.status}`);
const html = await siteRes.text();
if (!html.includes('Business Self-Evaluation Tool')) {
  fail('site HTML does not contain the app title');
}
console.log(`PASS: static site serves at ${LIVE_URL}`);

// 2. API stores a submission through the KV binding
const apiRes = await fetch(LIVE_URL + '/api/submit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body,
});
const data = await apiRes.json().catch(() => ({}));
if (apiRes.status !== 202) {
  fail(`expected 202 from POST /api/submit, got ${apiRes.status}: ${JSON.stringify(data)}`);
}
if (data.stored !== true) fail(`expected stored:true, got ${JSON.stringify(data)}`);
if (!data.id) fail('response did not include a submission id');

console.log(`PASS: /api/submit stored submission ${data.id} (${SMOKE_TAG})`);
console.log(`OK: live smoke test passed for ${LIVE_URL}`);