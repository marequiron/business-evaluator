/**
 * test/compiled-worker.test.mjs
 * Smoke test for the compiled Worker bundle (dist/worker/index.js) that
 * Cloudflare actually deploys. Proves the functions/ -> dist build produces
 * a working end-to-end /api/submit handler through the real fetch entrypoint.
 * Run with:   node test/compiled-worker.test.mjs
 */

import assert from 'node:assert';
import worker from '../dist/worker/index.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { passed += 1; console.log('PASS: ' + name); })
    .catch((err) => {
      failed += 1;
      console.error('FAIL: ' + name);
      console.error('  ' + (err && err.stack || err));
    });
}

const CATEGORY_IDS = ['finance', 'marketing', 'operations', 'hr', 'technology', 'customer', 'strategy'];

function validPayload(overrides) {
  const payload = {
    language: 'simple',
    categories: CATEGORY_IDS.map((id) => ({
      id,
      label: id.toUpperCase(),
      score: 4,
      band: 'strength',
    })),
  };
  return Object.assign(payload, overrides || {});
}

function makeEnvelope(bodyText, opts) {
  const env = Object.assign({ ENVIRONMENT: 'production' }, (opts && opts.env) || {});
  const ctx = { waitUntil: () => {} };
  const request = new Request('https://example.com/api/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: bodyText,
  });
  return { request, env, ctx };
}

(async () => {
  await test('compiled bundle: valid submission -> 202, stored through KV binding', async () => {
    let stored = [];
    const kv = {
      put: async (key, val) => { stored.push({ key, val: JSON.parse(val) }); return 'value'; },
    };
    const { request, env, ctx } = makeEnvelope(JSON.stringify(validPayload()), { env: { SUBMISSIONS_KV: kv } });
    const res = await worker.fetch(request, env, ctx);
    assert.strictEqual(res.status, 202);
    const body = await res.json();
    assert.strictEqual(body.stored, true);
    const record = stored.find((s) => s.key === body.id);
    assert.ok(record, 'main record should be written under the submission id');
    assert.strictEqual(record.val.schemaVersion, 1);
    const meta = stored.find((s) => s.key === body.id + ':meta');
    assert.ok(meta, 'meta record should be written alongside the submission');
  });

  await test('compiled bundle: invalid payload -> 400', async () => {
    const bad = validPayload();
    bad.language = 'technical';
    const { request, env, ctx } = makeEnvelope(JSON.stringify(bad));
    const res = await worker.fetch(request, env, ctx);
    assert.strictEqual(res.status, 400);
  });

  await test('compiled bundle: REQUIRE_AUTH=true -> 403', async () => {
    const { request, env, ctx } = makeEnvelope(JSON.stringify(validPayload()), { env: { REQUIRE_AUTH: 'true' } });
    const res = await worker.fetch(request, env, ctx);
    assert.strictEqual(res.status, 403);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();