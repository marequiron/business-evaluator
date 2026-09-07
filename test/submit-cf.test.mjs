/**
 * test/submit-cf.test.mjs
 * Plain-Node unit tests for the Cloudflare Pages Function (functions/api/submit.js).
 * Uses Node's built-in fetch/Request/Response/crypto (Node 18+). Run with:
 *   node test/submit-cf.test.mjs
 */

import assert from 'node:assert';
import { onRequestPost, validateSubmit, MAX_BODY_BYTES } from '../functions/api/submit.js';

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

function makeBody(overrides) {
  return JSON.stringify(validPayload(overrides));
}

function makeContext(bodyText, opts) {
  const env = Object.assign({ ENVIRONMENT: 'development' }, (opts && opts.env) || {});
  return {
    request: new Request('https://example.com/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bodyText,
    }),
    env,
    waitUntil: () => {},
  };
}

const CATEGORY_IDS_7 = CATEGORY_IDS;

(async () => {
  await test('valid submission -> 202 Accepted with id', async () => {
    const res = await onRequestPost(makeContext(makeBody()));
    assert.strictEqual(res.status, 202);
    const body = await res.json();
    assert.ok(body.id);
  });

  await test('stamps submittedAt and schemaVersion into KV record', async () => {
    let stored = [];
    const kv = {
      put: async (key, val) => { stored.push({ key, val: JSON.parse(val) }); return 'value'; },
    };
    const ctx = makeContext(makeBody(), { env: { SUBMISSIONS_KV: kv, ENVIRONMENT: 'production' } });
    const res = await onRequestPost(ctx);
    assert.strictEqual(res.status, 202);
    const body = await res.json();
    assert.strictEqual(body.stored, true);
    const record = stored.find((s) => s.key === body.id);
    assert.ok(record, 'main submission record should be stored under its id');
    assert.strictEqual(record.val.schemaVersion, 1);
    assert.ok(record.val.submittedAt);

    const meta = stored.find((s) => s.key === body.id + ':meta');
    assert.ok(meta, 'meta record should be written alongside the submission');
    assert.strictEqual(meta.val.language, 'simple');
    assert.ok(meta.val.submittedAt);
  });

  await test('strict validation: accepts unanswered (null score)', async () => {
    const ctx = makeContext(makeBody({
      categories: [
        ...CATEGORY_IDS_7.slice(0, 3).map((id) => ({ id, label: id, score: 4, band: 'strength' })),
        { id: 'hr', label: 'HR', score: null, band: 'unanswered' },
        ...CATEGORY_IDS_7.slice(4).map((id) => ({ id, label: id, score: 4, band: 'strength' })),
      ],
    }));
    const res = await onRequestPost(ctx);
    assert.strictEqual(res.status, 202);
  });

  await test('validate: rejects wrong category count', () => {
    const p = validPayload();
    p.categories.pop();
    assert.strictEqual(validateSubmit(p).ok, false);
  });

  await test('rejects out-of-range score', async () => {
    const p = validPayload();
    p.categories[0].score = 6;
    const res = await onRequestPost(makeContext(JSON.stringify(p)));
    assert.strictEqual(res.status, 400);
  });

  await test('rejects invalid band', async () => {
    const p = validPayload();
    p.categories[0].band = 'legendary';
    const res = await onRequestPost(makeContext(JSON.stringify(p)));
    assert.strictEqual(res.status, 400);
  });

  await test('empty body -> 400', async () => {
    const res = await onRequestPost(makeContext(''));
    assert.strictEqual(res.status, 400);
  });

  await test('invalid JSON -> 400', async () => {
    const res = await onRequestPost(makeContext('not json{{{'));
    assert.strictEqual(res.status, 400);
  });

  await test('oversized body -> 413', async () => {
    const big = JSON.stringify({ waste: 'x'.repeat(MAX_BODY_BYTES + 100) });
    const res = await onRequestPost(makeContext(big));
    assert.strictEqual(res.status, 413);
  });

  await test('REQUIRE_AUTH=true -> 403', async () => {
    const ctx = makeContext(makeBody(), { env: { REQUIRE_AUTH: 'true', ENVIRONMENT: 'production' } });
    const res = await onRequestPost(ctx);
    assert.strictEqual(res.status, 403);
  });

  await test('non-POST method -> 405', async () => {
    const ctx = {
      request: new Request('https://example.com/api/submit', { method: 'GET' }),
      env: {},
      waitUntil: () => {},
    };
    const res = await onRequestPost(ctx);
    assert.strictEqual(res.status, 405);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
