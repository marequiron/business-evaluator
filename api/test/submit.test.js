'use strict';

/**
 * submit.test.js
 * Plain-Node unit tests for the /api/submit request path. No packages needed:
 * run `npm test` (or `node test/submit.test.js`) from the api/ folder.
 *
 * Security contract under test:
 *   - anonymous -> 401
 *   - authenticated but no submit role -> 403
 *   - authenticated with a submit role -> 202 (with valid body)
 *   - CSRF envelope rejects cross-site state-changing requests
 *   - rate limiter trips at the configured ceiling
 */

const assert = require('assert');
const { validateSubmit, MAX_BODY_BYTES } = require('../src/validate');
const { handleSubmit } = require('../src/handler');
const { createStore, createDataStore, createMemoryStore } = require('../src/store');
const auth = require('../src/auth');

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

const CATEGORY_IDS = ['direction', 'market', 'financial', 'operations', 'people', 'technology', 'risk', 'innovation'];

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

function actor(role, userId) {
  return {
    userId: userId || 'user-123',
    userRoles: role ? [role] : [],
  };
}

function call(bodyText, opts) {
  return handleSubmit(Object.assign(
    {
      bodyText,
      principal: actor('Evaluator'),
      store: fakeStore({ stored: true }),
      env: {},
      log: { error: () => {}, info: () => {} },
      requestMeta: { method: 'POST', secFetchSite: 'same-origin', origin: '', ip: '1.2.3.4' },
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
    p.categories[1].id = CATEGORY_IDS[0];
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

  await test('handler: anonymous -> 401', async () => {
    const r = await call(JSON.stringify(validPayload()), { principal: null });
    assert.strictEqual(r.status, 401);
    assert.strictEqual(r.body.error, 'unauthenticated');
  });

  await test('handler: authenticated without a submit role -> 403', async () => {
    const r = await call(JSON.stringify(validPayload()), { principal: actor('Reader') });
    assert.strictEqual(r.status, 403);
    assert.strictEqual(r.body.detail, 'missing_required_role');
  });

  await test('handler: cross-site POST without allowlisted origin -> 403', async () => {
    const r = await call(JSON.stringify(validPayload()), {
      requestMeta: { method: 'POST', secFetchSite: 'cross-site', origin: 'https://evil.test', ip: '1.1.1.1' },
      env: { ALLOWED_ORIGINS: 'https://app.example.test' },
    });
    assert.strictEqual(r.status, 403);
    assert.strictEqual(r.body.detail, 'cross_site_request_rejected');
  });

  await test('handler: allowlisted cross-origin POST -> 202', async () => {
    const r = await call(JSON.stringify(validPayload()), {
      requestMeta: { method: 'POST', secFetchSite: 'cross-site', origin: 'https://app.example.test', ip: '1.1.1.1' },
      env: { ALLOWED_ORIGINS: 'https://app.example.test' },
    });
    assert.strictEqual(r.status, 202);
  });

  await test('handler: over the rate limit -> 429', async () => {
    const limiter = auth.createRateLimiter({ max: 1, windowMs: 60000 });
    await call(JSON.stringify(validPayload()), { limiter });
    const r = await call(JSON.stringify(validPayload()), { limiter });
    assert.strictEqual(r.status, 429);
    assert.strictEqual(r.body.error, 'too_many_requests');
    assert.ok(Number(r.headers['Retry-After']) > 0);
  });

  await test('handler: 202 Accepted with id + stored flag', async () => {
    const r = await call(JSON.stringify(validPayload()));
    assert.strictEqual(r.status, 202);
    assert.ok(r.body.id);
    assert.strictEqual(r.body.stored, true);
  });

  await test('handler: stamps submissionId, submittedAt, principal userId', async () => {
    let captured;
    const store = async (s) => { captured = s; return { stored: true }; };
    const r = await call(JSON.stringify(validPayload()), { store, principal: actor('Evaluator', 'user-abc') });
    assert.strictEqual(r.status, 202);
    assert.ok(captured.submissionId);
    assert.ok(captured.submittedAt);
    assert.strictEqual(captured.principal, 'user-abc');
    assert.strictEqual(captured.schemaVersion, 1);
  });

  await test('handler: audit emits accepted on success', async () => {
    const events = [];
    const audit = auth.createAuditor({ persist: (e) => events.push(e) });
    await call(JSON.stringify(validPayload()), { audit, principal: actor('Evaluator', 'user-aud') });
    assert.ok(events.some((e) => e.event === 'submit.accepted' && e.userId === 'user-aud'));
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
    await assert.rejects(() => store({}), /Storage is not configured/);
  });

  await test('data store: memory store persists profiles and imports', async () => {
    const s = createMemoryStore();
    await s.saveProfile('u9', { id: 'u9', userId: 'u9', displayName: 'Pat' });
    const got = await s.getProfile('u9');
    assert.strictEqual(got.displayName, 'Pat');
    const rec = await s.saveGuestImport('u9', { kind: 'guest-import', itemCount: 5, importedAt: 'x' });
    assert.strictEqual(rec.kind, 'guest-import');
    const after = await s.getProfile('u9');
    assert.strictEqual(after.imports.length, 1);
  });

  await test('data store: createDataStore throws when unconfigured in prod mode', async () => {
    const env = { COSMOS_CONNECTION_STRING: '', COSMOS_ENDPOINT: '', COSMOS_KEY: '' };
    assert.throws(() => createDataStore(env), /Storage is not configured/);
  });

  await test('data store: createDataStore returns memory store in dev', async () => {
    const s = createDataStore({ DEV_NO_STORE: 'true' });
    assert.strictEqual(typeof s.saveProfile, 'function');
    assert.strictEqual(typeof s.saveAuditEvent, 'function');
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();