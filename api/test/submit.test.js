'use strict';

/**
 * submit.test.js
 * Plain-Node unit tests for the /api/submit request path. No packages needed:
 * run `npm test` (or `node test/submit.test.js`) from the api/ folder.
 */

const assert = require('assert');
const { validateSubmit, MAX_BODY_BYTES } = require('../src/validate');
const { handleSubmit } = require('../src/handler');
const { createStore } = require('../src/store');

let passed = 0;
let failed = 0;

function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { passed += 1; console.log('PASS: ' + name); })
    .catch((err) => {
      failed += 1;
      console.error('FAIL: ' + name);
      console.error('  ' + (err && err.message));
    });
}

const CATEGORY_IDS = ['finance', 'marketing', 'operations', 'hr', 'technology', 'customer', 'strategy', 'legal'];

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

function fakeStore(result, throwIt) {
  return async function store(submission) {
    if (throwIt) throw new Error('boom');
    return result;
  };
}

function call(bodyText, opts) {
  return handleSubmit(Object.assign(
    {
      bodyText,
      principal: null,
      store: fakeStore({ stored: true }),
      env: {},
      log: { error: () => {}, info: () => {} },
    },
    opts
  ));
}

(async () => {
  await test('validate: accepts a valid 8-category payload', () => {
    const r = validateSubmit(validPayload());
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.data.categories.length, 8);
    assert.strictEqual(r.data.language, 'simple');
  });

  await test('validate: accepts unanswered (null score) categories', () => {
    const p = validPayload();
    p.categories[3].score = null;
    p.categories[3].band = 'unanswered';
    const r = validateSubmit(p);
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.data.categories[3].score, null);
    assert.strictEqual(r.data.categories[3].band, 'unanswered');
  });

  await test('validate: rejects null/non-object body', () => {
    assert.strictEqual(validateSubmit(null).ok, false);
    assert.strictEqual(validateSubmit([1, 2]).ok, false);
  });

  await test('validate: rejects missing/invalid language', () => {
    let p = validPayload(); delete p.language;
    assert.strictEqual(validateSubmit(p).ok, false);
    p = validPayload({ language: 'fancy' });
    assert.strictEqual(validateSubmit(p).ok, false);
  });

  await test('validate: rejects non-8 category count', () => {
    const p = validPayload();
    p.categories.pop();
    assert.strictEqual(validateSubmit(p).ok, false);
  });

  await test('validate: rejects duplicate ids', () => {
    const p = validPayload();
    p.categories[1].id = 'finance';
    assert.strictEqual(validateSubmit(p).ok, false);
  });

  await test('validate: rejects out-of-range / non-numeric scores', () => {
    let p = validPayload(); p.categories[0].score = 6;
    assert.strictEqual(validateSubmit(p).ok, false);
    p = validPayload(); p.categories[0].score = '4';
    assert.strictEqual(validateSubmit(p).ok, false);
    p = validPayload(); p.categories[0].score = NaN;
    assert.strictEqual(validateSubmit(p).ok, false);
  });

  await test('validate: rejects bad band', () => {
    const p = validPayload();
    p.categories[0].band = 'legendary';
    assert.strictEqual(validateSubmit(p).ok, false);
  });

  await test('validate: unanswered with a score is rejected', () => {
    const p = validPayload();
    p.categories[0].band = 'unanswered';
    p.categories[0].score = 4;
    assert.strictEqual(validateSubmit(p).ok, false);
  });

  await test('handler: 202 Accepted with id + stored flag', async () => {
    const r = await call(JSON.stringify(validPayload()));
    assert.strictEqual(r.status, 202);
    assert.ok(r.body.id);
    assert.strictEqual(r.body.stored, true);
  });

  await test('handler: stamps submissionId, submittedAt, no principal', async () => {
    let captured;
    const store = async (s) => { captured = s; return { stored: true }; };
    const r = await call(JSON.stringify(validPayload()), { store });
    assert.strictEqual(r.status, 202);
    assert.ok(captured.submissionId);
    assert.ok(captured.submittedAt);
    assert.strictEqual(captured.principal, null);
    assert.strictEqual(captured.schemaVersion, 1);
  });

  await test('handler: records principal when provided', async () => {
    let captured;
    const store = async (s) => { captured = s; return { stored: true }; };
    await call(JSON.stringify(validPayload()), {
      store,
      principal: { userId: 'user-123', userRoles: ['submitters'] },
    });
    assert.strictEqual(captured.principal, 'user-123');
  });

  await test('handler: empty body -> 400', async () => {
    const r = await call('');
    assert.strictEqual(r.status, 400);
  });

  await test('handler: invalid JSON -> 400', async () => {
    const r = await call('not json{{{');
    assert.strictEqual(r.status, 400);
  });

  await test('handler: oversized body -> 413', async () => {
    const big = JSON.stringify(validPayload({ categories: [] })) + 'x'.repeat(MAX_BODY_BYTES);
    const r = await call(big);
    assert.strictEqual(r.status, 413);
  });

  await test('handler: REQUIRE_AUTH denies missing role', async () => {
    const r = await call(JSON.stringify(validPayload()), {
      principal: { userId: 'u', userRoles: ['reader'] },
      env: { REQUIRE_AUTH: 'true', SUBMITTER_ROLE: 'submitters' },
    });
    assert.strictEqual(r.status, 403);
  });

  await test('handler: REQUIRE_AUTH allows submitters role', async () => {
    const r = await call(JSON.stringify(validPayload()), {
      principal: { userId: 'u-1', userRoles: ['submitters'] },
      env: { REQUIRE_AUTH: 'true', SUBMITTER_ROLE: 'submitters' },
    });
    assert.strictEqual(r.status, 202);
  });

  await test('handler: store failure -> 500', async () => {
    const r = await call(JSON.stringify(validPayload()), { store: fakeStore({}, true) });
    assert.strictEqual(r.status, 500);
  });

  await test('handler: values rounded to one decimal', async () => {
    const p = validPayload();
    p.categories[0].score = 4.246;
    let captured;
    const store = async (s) => { captured = s; return { stored: true }; };
    await call(JSON.stringify(p), { store });
    assert.ok(captured.categories.some((c) => c.score === 4.2));
  });

  await test('store: dev no-op returns stored:false', async () => {
    const store = createStore({ DEV_NO_STORE: 'true' });
    const r = await store({ submissionId: 'x' });
    assert.strictEqual(r.stored, false);
  });

  await test('store: unconfigured (prod) throws', async () => {
    const store = createStore({ COSMOS_CONNECTION_STRING: '', COSMOS_ENDPOINT: '', COSMOS_KEY: '' });
    assert.rejects(() => store({}), /Storage is not configured/);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();