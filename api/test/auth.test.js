'use strict';

/**
 * auth.test.js
 * Plain-Node unit tests for the shared auth/security helpers (src/auth.js).
 * Run via `npm test` from the api/ folder.
 */

const assert = require('assert');
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

function swaHeader(payload) {
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

(async () => {
  await test('parsePrincipal: prefers stable userId over userDetails', () => {
    const p = auth.parsePrincipal(swaHeader({
      identityProvider: 'aad',
      userId: 'stable-oid',
      userDetails: 'uppn@example.test',
      userRoles: ['Evaluator', 'Administrator'],
    }));
    assert.strictEqual(p.userId, 'stable-oid');
    assert.strictEqual(p.userDetails, 'uppn@example.test');
    assert.deepStrictEqual(p.userRoles, ['Evaluator', 'Administrator']);
  });

  await test('parsePrincipal: uses claims oid/sub when userId absent', () => {
    const p = auth.parsePrincipal(swaHeader({ claims: [{ name: 'oid', value: 'claim-oid' }] }));
    assert.strictEqual(p.userId, 'claim-oid');
    const q = auth.parsePrincipal(swaHeader({ claims: [{ typ: 'sub', val: 'claim-sub' }] }));
    assert.strictEqual(q.userId, 'claim-sub');
  });

  await test('parsePrincipal: drops URL-safe base64 and handles janky input', () => {
    const raw = Buffer.from(JSON.stringify({ userId: 'u-1' }))
      .toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
    assert.strictEqual(auth.parsePrincipal(raw).userId, 'u-1');
    assert.strictEqual(auth.parsePrincipal(null), null);
    assert.strictEqual(auth.parsePrincipal('!!!!not-base64!!!!'), null);
  });

  await test('parsePrincipal: userDetails alone never becomes an identity', () => {
    const p = auth.parsePrincipal(swaHeader({ userDetails: 'only-upn' }));
    assert.strictEqual(p, null);
  });

  await test('requireAuthenticated: 401 for null / missing userId', () => {
    assert.strictEqual(auth.requireAuthenticated(null).status, 401);
    assert.strictEqual(auth.requireAuthenticated({ userRoles: [] }).status, 401);
    assert.strictEqual(auth.requireAuthenticated({ userId: 'u' }).ok, true);
  });

  await test('requireRole: exact membership in allowed roles', () => {
    const anon = auth.requireRole({ userId: 'u' }, ['Evaluator']);
    assert.strictEqual(anon.status, 403);
    assert.strictEqual(anon.body.detail, 'missing_required_role');

    assert.strictEqual(auth.requireRole({ userId: 'u', userRoles: ['Evaluator'] }, ['Evaluator']).ok, true);
    assert.strictEqual(
      auth.requireRole({ userId: 'u', userRoles: ['Reviewer'] }, ['Evaluator', 'Reviewer']).ok, true);
    assert.strictEqual(
      auth.requireRole({ userId: 'u', userRoles: ['Administrator'] }, ['Evaluator', 'Reviewer', 'Administrator']).ok, true);
    assert.strictEqual(
      auth.requireRole({ userId: 'u', userRoles: ['something'] }, ['Evaluator']).status, 403);
  });

  await test('tenantMatches: pinned to exact tid, case-insensitive', () => {
    const mk = (claims) => ({ claims });
    assert.strictEqual(auth.tenantMatches(mk([{ name: 'tid', value: 'AAAA' }]), 'aaaa'), true);
    assert.strictEqual(auth.tenantMatches(mk([{ name: 'tid', value: 'bbbb' }]), 'aaaa'), false);
    assert.strictEqual(auth.tenantMatches(mk([]), 'aaaa'), false, 'no tid means denied when pinned');
    assert.strictEqual(auth.tenantMatches(mk([{ name: 'tid', value: 'x' }]), ''), true, 'empty pin allows all');
  });

  await test('checkRequestEnvelope: safe methods pass regardless of origin', () => {
    const origins = ['https://app.example.test'];
    for (const method of ['GET', 'HEAD', 'OPTIONS']) {
      assert.strictEqual(auth.checkRequestEnvelope({ method }, origins).ok, true, method);
    }
  });

  await test('checkRequestEnvelope: same-origin / none pass; cross-site rejected', () => {
    const origins = ['https://app.example.test'];
    assert.strictEqual(
      auth.checkRequestEnvelope({ method: 'POST', secFetchSite: 'same-origin' }, origins).ok, true);
    assert.strictEqual(
      auth.checkRequestEnvelope({ method: 'POST', secFetchSite: 'none' }, origins).ok, true);
    const bad = auth.checkRequestEnvelope({
      method: 'POST', secFetchSite: 'cross-site', origin: 'https://evil.test',
    }, origins);
    assert.strictEqual(bad.status, 403);
    assert.strictEqual(bad.body.detail, 'cross_site_request_rejected');
  });

  await test('checkRequestEnvelope: allowlisted origin passes even cross-site', () => {
    const origins = auth.parseOrigins('https://app.example.test, https://dev.example.test');
    const ok = auth.checkRequestEnvelope({
      method: 'POST', secFetchSite: 'cross-site', origin: 'https://dev.example.test',
    }, origins);
    assert.strictEqual(ok.ok, true);
    assert.strictEqual(auth.checkRequestEnvelope({ method: 'POST', origin: 'https://app.example.test' }, origins).ok, true);
  });

  await test('checkRequestEnvelope: wildcard '*' allows any listed origin', () => {
    assert.strictEqual(
      auth.checkRequestEnvelope({ method: 'POST', origin: 'https://anything.test' }, ['*']).ok, true);
    assert.strictEqual(auth.parseOrigins(' a , b ').join(','), 'a,b');
  });

  await test('createRateLimiter: window resets, per-key isolation', () => {
    const limiter = auth.createRateLimiter({ max: 2, windowMs: 60000 });
    assert.strictEqual(limiter.check('a').ok, true);
    assert.strictEqual(limiter.check('a').ok, true);
    assert.strictEqual(limiter.check('a').ok, false);
    assert.strictEqual(limiter.check('b').ok, true, 'other key unaffected');
    limiter.reset();
    assert.strictEqual(limiter.check('a').ok, true, 'reset clears buckets');
  });

  await test('rateKey: userId when known, ip: otherwise', () => {
    assert.strictEqual(auth.rateKey({ userId: 'u' }, {}), 'u');
    assert.strictEqual(auth.rateKey(null, { ip: '9.9.9.9' }), 'ip:9.9.9.9');
    assert.strictEqual(auth.rateKey(null, {}), 'ip:unknown');
  });

  await test('sanitizeMeta: strips secret-looking keys, keeps scalars', () => {
    const clean = auth.sanitizeMeta({
      userId: 'u', idToken: 'xxx', refreshToken: 'y', accessToken: 'z',
      client_secret: 's', authorization: 'Bearer x', cookie: 'abc',
      submissionId: 's1', status: 202, reason: 'ok',
    });
    assert.strictEqual(clean.userId, 'u');
    assert.strictEqual(clean.submissionId, 's1');
    assert.strictEqual(clean.status, 202);
    assert.strictEqual(clean.reason, 'ok');
    assert.strictEqual(clean.idToken, undefined);
    assert.strictEqual(clean.refreshToken, undefined);
    assert.strictEqual(clean.accessToken, undefined);
    assert.strictEqual(clean.client_secret, undefined);
    assert.strictEqual(clean.authorization, undefined);
    assert.strictEqual(clean.cookie, undefined);
  });

  await test('createAuditor: emits sanitized events to both logger and sink', async () => {
    const events = [];
    const logs = [];
    const audit = auth.createAuditor({
      log: { info: (m) => logs.push(m), error: () => {} },
      persist: (e) => events.push(e),
    });
    const e = audit.emit('submit.accepted', { userId: 'u1', identityProvider: 'aad' },
      { submissionId: 'x', token: 'should-not-leak' });
    assert.strictEqual(e.userId, 'u1');
    assert.strictEqual(e.event, 'submit.accepted');
    assert.strictEqual(e.meta.token, undefined);
    assert.strictEqual(e.meta.submissionId, 'x');
    assert.strictEqual(events.length, 1);
    assert.ok(logs.some((m) => m.includes('audit:submit.accepted')));
  });

  await test('createAuditor: logging/persist errors never throw', () => {
    const audit = auth.createAuditor({
      log: { info: () => { throw new Error('log broke'); }, error: () => {} },
      persist: () => { throw new Error('sink broke'); },
    });
    const e = audit.emit('x', { userId: 'u' }, {});
    assert.strictEqual(e.userId, 'u');
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();