'use strict';

/**
 * profile.test.js
 * Plain-Node unit tests for the /api/profile request path (get/save/import).
 * Run via `npm test` from the api/ folder.
 */

const assert = require('assert');
const {
  getProfileHandler,
  saveProfileHandler,
  importProfileHandler,
  validateProfile,
  MAX_PROFILE_BYTES,
} = require('../src/profile-handler');
const { createMemoryStore } = require('../src/store');
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

function actor(userId, roles) {
  return { userId: userId || 'user-1', identityProvider: 'aad', userDetails: 'u@test.test', userRoles: roles || ['Evaluator'] };
}

function validProfileOpts(overrides) {
  return Object.assign({
    store: createMemoryStore(),
    principal: actor(),
    env: {},
    bodyBuffer: Buffer.from(JSON.stringify({
      displayName: 'Pat Rivera',
      language: 'simple',
      consents: { consentData: true, consentShareAloud: true },
    })),
  }, overrides || {});
}

(async () => {
  await test('validateProfile: accepts valid onboarding', () => {
    const r = validateProfile({
      displayName: '  Pat Rivera  ',
      language: 'simple',
      consents: { consentData: true, consentShareAloud: true },
    }, 'u1');
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.profile.displayName, 'Pat Rivera', 'trimmed');
    assert.strictEqual(r.profile.userId, 'u1');
    assert.ok(r.profile.updatedAt);
  });

  await test('validateProfile: rejects missing/blank/oversized displayName', () => {
    assert.strictEqual(validateProfile({ displayName: '', language: 'simple', consents: {} }, 'u').ok, false);
    assert.strictEqual(validateProfile({ displayName: '   ', language: 'simple', consents: {} }, 'u').ok, false);
    assert.strictEqual(
      validateProfile({ displayName: 'x'.repeat(MAX_PROFILE_BYTES), language: 'simple', consents: {} }, 'u').ok, false);
  });

  await test('validateProfile: rejects unknown language or a non-true consent', () => {
    const base = { displayName: 'A', language: 'simple', consents: { consentData: true, consentShareAloud: true } };
    assert.strictEqual(validateProfile(Object.assign({}, base, { language: 'fancy' }), 'u').ok, false);
    assert.strictEqual(validateProfile(Object.assign({}, base, { consents: { consentData: true, consentShareAloud: false } }), 'u').ok, false);
    assert.strictEqual(validateProfile(Object.assign({}, base, { consents: { consentData: true } }), 'u').ok, false);
  });

  await test('get: 404 before onboarding, 200 after', async () => {
    const opts = validProfileOpts();
    let r = await getProfileHandler(opts);
    assert.strictEqual(r.status, 404);
    assert.strictEqual(r.body.error, 'no_profile');

    await saveProfileHandler(opts);
    r = await getProfileHandler(opts);
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.displayName, 'Pat Rivera');
  });

  await test('get/save: unauthenticated -> 401', async () => {
    const r = await getProfileHandler(validProfileOpts({ principal: null }));
    assert.strictEqual(r.status, 401);
    const s = await saveProfileHandler(validProfileOpts({ principal: null }));
    assert.strictEqual(s.status, 401);
  });

  await test('save: persists profile to the store by userId (not userDetails)', async () => {
    const opts = validProfileOpts({ principal: actor('user-stable', ['Evaluator']) });
    const r = await saveProfileHandler(opts);
    assert.strictEqual(r.status, 200);
    const saved = await opts.store.getProfile('user-stable');
    assert.strictEqual(saved.displayName, 'Pat Rivera');
    assert.strictEqual(saved.id, 'user-stable');
  });

  await test('save: rejects invalid JSON and oversized bodies', async () => {
    const bad = validProfileOpts({ bodyBuffer: Buffer.from('not-json') });
    assert.strictEqual((await saveProfileHandler(bad)).status, 400);

    const big = JSON.stringify({ displayName: 'x', language: 'simple', consents: {} }) + 'x'.repeat(MAX_PROFILE_BYTES);
    const oversized = validProfileOpts({ bodyBuffer: Buffer.from(big) });
    assert.strictEqual((await saveProfileHandler(oversized)).status, 413);
  });

  await test('save: store failure -> 500 with friendly error code', async () => {
    const opts = validProfileOpts({
      store: {
        saveProfile: async () => { throw new Error('boom'); },
        getProfile: async () => null,
      },
    });
    const r = await saveProfileHandler(opts);
    assert.strictEqual(r.status, 500);
    assert.strictEqual(r.body.error, 'profile_failure');
  });

  await test('import: disabled by default -> 409', async () => {
    const r = await importProfileHandler(validProfileOpts({ env: {} }));
    assert.strictEqual(r.status, 409);
    assert.strictEqual(r.body.error, 'imports_disabled');
  });

  await test('import: records a sanitized summary when enabled', async () => {
    const opts = validProfileOpts({
      env: { ALLOW_IMPORTS: 'true' },
      bodyBuffer: Buffer.from(JSON.stringify({ itemCount: 42, note: 'Linked my device data' })),
    });
    const r = await importProfileHandler(opts);
    assert.strictEqual(r.status, 202);
    assert.strictEqual(r.body.itemCount, 42);
    const profile = await opts.store.getProfile('user-1');
    assert.strictEqual(profile.imports.length, 1);
    assert.strictEqual(profile.imports[0].kind, 'guest-import');
    assert.strictEqual(profile.imports[0].note, 'Linked my device data');
  });

  await test('import: caps itemCount and note length', async () => {
    const opts = validProfileOpts({
      env: { ALLOW_IMPORTS: 'true' },
      bodyBuffer: Buffer.from(JSON.stringify({ itemCount: 2000000, note: 'n'.repeat(5000) })),
    });
    const r = await importProfileHandler(opts);
    assert.strictEqual(r.status, 202);
    assert.strictEqual(r.body.itemCount, 100000);
    assert.ok(r.body.note.length <= 200);
  });

  await test('import: oversize body -> 413, not persisted', async () => {
    const opts = validProfileOpts({
      env: { ALLOW_IMPORTS: 'true' },
      bodyBuffer: Buffer.from('z'.repeat(512 * 1024 + 1)),
    });
    const r = await importProfileHandler(opts);
    assert.strictEqual(r.status, 413);
  });

  await test('import: audit event emitted on success', async () => {
    const events = [];
    const audit = auth.createAuditor({ persist: (e) => events.push(e) });
    const opts = validProfileOpts({
      env: { ALLOW_IMPORTS: 'true' },
      audit,
      bodyBuffer: Buffer.from(JSON.stringify({ itemCount: 3 })),
    });
    await importProfileHandler(opts);
    assert.ok(events.some((e) => e.event === 'profile.import_guest' && e.userId === 'user-1'));
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();