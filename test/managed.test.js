'use strict';

/**
 * managed.test.js
 * jsdom tests for the optional managed sign-in gateway (js/managed.js).
 * The base config in js/data.js has enabled:false, so these tests substitute
 * an enabled copy plus a fake fetch, then drive the state machine through its
 * states: signed-out, first-login, unassigned, ready, wrong-tenant, expired,
 * profile-failure, unavailable, and the explicit guest-import offer.
 *
 * Run: node test/managed.test.js  (part of `npm test`)
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');

let passed = 0;
let failed = 0;

function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { passed += 1; console.log('PASS: ' + name); })
    .catch((err) => {
      failed += 1;
      console.error('FAIL: ' + name);
      console.error('  ' + (err && err.stack ? err.stack.split('\n').slice(0, 3).join('\n  ') : err));
    });
}

function makeManaged() {
  const data = fs.readFileSync(path.join(ROOT, 'js', 'data.js'), 'utf8').replace(/<\/script>/g, '<\\/script>');
  const storage = fs.readFileSync(path.join(ROOT, 'js', 'storage.js'), 'utf8').replace(/<\/script>/g, '<\\/script>');
  const managed = fs.readFileSync(path.join(ROOT, 'js', 'managed.js'), 'utf8').replace(/<\/script>/g, '<\\/script>');
  const html = [
    '<!DOCTYPE html><html><body>',
    '<header id="greeting">x</header>',
    '<script>' + data + '<\/script>',
    '<script>' + storage + '<\/script>',
    '<script>' + managed + '<\/script>',
    '</body></html>'
  ].join('');

  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'http://localhost/index.html',
    pretendToBeVisual: true,
  });
  const w = dom.window;
  w.__navigatedTo = null;
  return w;
}

function initManaged(w, overrides, fetchImpl, onNavigate) {
  const config = Object.assign({
    enabled: true,
    apiBase: '/api',
    authEndpoint: '/.auth/me',
    signInPath: '/.auth/login/aad',
    signOutPath: '/.auth/logout',
    allowedTenantId: '',
    displayNameMax: 120,
    importMaxBytes: 524288,
    languages: [{ value: 'simple', label: 'Plain language' }],
    recognizedRoles: ['Evaluator', 'Reviewer', 'Administrator'],
    allowGuestImport: false
  }, overrides || {});
  const ma = w.eval('ManagedAccess');
  const opts = { config: config, fetch: fetchImpl };
  if (onNavigate) opts.navigate = (url) => { w.__navigatedTo = url; };
  return ma.init(opts).then(() => ma);
}

function jsonRes(status, body) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

function principalPayload(roles, claims) {
  return { clientPrincipal: {
    identityProvider: 'aad',
    userId: 'oid-123',
    userDetails: 'pat@contoso.test',
    userRoles: roles || ['Evaluator'],
    claims: claims || [{ name: 'tid', value: 'tenant-1' }],
  } };
}

(async () => {
  await test('disabled by default: init does nothing and no gate appears', async () => {
    const w = makeManaged();
    const ma = w.eval('ManagedAccess');
    const res = await ma.init({ fetch: () => { throw new Error('fetch must not be called'); } });
    assert.strictEqual(res.started, false);
    assert.strictEqual(w.document.getElementById('managed-gate'), null);
  });

  await test('signed-out: no clientPrincipal -> sign-in prompt', async () => {
    const w = makeManaged();
    const ma = await initManaged(w, null, () => jsonRes(401, undefined));
    assert.strictEqual(ma.getState(), 'signed-out');
    const gate = w.document.getElementById('managed-gate');
    assert.strictEqual(gate.hidden, false);
    assert.ok(gate.textContent.includes('Sign in to continue'));
  });

  await test('first-login: authenticated + no profile -> onboarding form; submit becomes ready', async () => {
    const calls = [];
    const w = makeManaged();
    const ma = await initManaged(w, { allowedTenantId: 'tenant-1' }, (url, opts) => {
      calls.push([url, opts && opts.method]);
      if (url === '/.auth/me') return jsonRes(200, principalPayload(['Evaluator']));
      if (url === '/api/profile' && (!opts || !opts.method || opts.method === 'GET')) {
        return jsonRes(404, undefined);
      }
      if (url === '/api/profile' && opts.method === 'POST') {
        return jsonRes(200, { id: 'oid-123', userId: 'oid-123', displayName: 'Pat Rivera', language: 'simple' });
      }
      return jsonRes(500, {});
    });
    assert.strictEqual(ma.getState(), 'first-login');
    assert.ok(w.document.getElementById('managed-gate').textContent.includes("Let's set up your space"));

    const name = w.document.querySelector('input[name="displayName"]');
    name.value = 'Pat Rivera';
    w.document.querySelector('select[name="language"]').value = 'simple';
    const boxes = w.document.querySelectorAll('input[type="checkbox"]');
    boxes[0].checked = true;
    boxes[1].checked = true;
    w.document.querySelector('.managed-onboard').dispatchEvent(
      new w.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 10));
    assert.strictEqual(ma.getState(), 'ready');
    assert.strictEqual(w.document.getElementById('managed-gate').hidden, true);
    assert.ok(w.document.getElementById('managed-banner').textContent.includes('Signed in as Pat Rivera'));
    assert.ok(calls.some((c) => c[0] === '/api/profile' && c[1] === 'POST'));
  });

  await test('onboarding: refuses with both consents unchecked', async () => {
    const w = makeManaged();
    const ma = await initManaged(w, null, (url) => {
      if (url === '/.auth/me') return jsonRes(200, principalPayload(['Evaluator']));
      if (url === '/api/profile') return jsonRes(404, undefined);
      return jsonRes(500, {});
    });
    assert.strictEqual(ma.getState(), 'first-login');
    w.document.querySelector('input[name="displayName"]').value = 'Pat';
    w.document.querySelector('.managed-onboard').dispatchEvent(
      new w.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 5));
    assert.strictEqual(ma.getState(), 'first-login', 'still onboarding');
    const err = w.document.querySelector('.managed-error');
    assert.strictEqual(err.hidden, false);
    assert.ok(err.textContent.includes('consent'));
  });

  await test('ready: existing profile + role reveals the app and shows the banner', async () => {
    const w = makeManaged();
    const ma = await initManaged(w, null, (url) => {
      if (url === '/.auth/me') return jsonRes(200, principalPayload(['Reviewer']));
      if (url === '/api/profile') return jsonRes(200, { displayName: 'Robin Lee', language: 'standard' });
      return jsonRes(500, {});
    });
    assert.strictEqual(ma.getState(), 'ready');
    assert.strictEqual(w.document.getElementById('managed-gate').hidden, true);
    const banner = w.document.getElementById('managed-banner');
    assert.ok(banner.textContent.includes('Robin Lee'));
    assert.ok(banner.textContent.includes('Reviewer'));
  });

  await test('unassigned: no recognized role shows a friendly banner, app usable', async () => {
    const w = makeManaged();
    const ma = await initManaged(w, null, (url) => {
      if (url === '/.auth/me') return jsonRes(200, principalPayload(['visitor']));
      if (url === '/api/profile') return jsonRes(200, { displayName: 'Visitor', language: 'simple' });
      return jsonRes(500, {});
    });
    assert.strictEqual(ma.getState(), 'unassigned');
    const banner = w.document.getElementById('managed-banner');
    assert.ok(banner.textContent.includes("hasn't assigned you a review role"));
    assert.strictEqual(w.document.getElementById('managed-gate').hidden, true);
  });

  await test('wrong-tenant: claim mismatch prompts sign out', async () => {
    const w = makeManaged();
    const ma = await initManaged(w, { allowedTenantId: 'tenant-1' }, (url) => {
      if (url === '/.auth/me') return jsonRes(200, principalPayload(['Evaluator'], [{ name: 'tid', value: 'tenant-2' }]));
      return jsonRes(500, {});
    });
    assert.strictEqual(ma.getState(), 'wrong-tenant');
    assert.ok(w.document.getElementById('managed-gate').textContent.includes("isn't from this organization"));
  });

  await test('expired: profile endpoint 401 -> sign-in prompt', async () => {
    const w = makeManaged();
    const ma = await initManaged(w, null, (url) => {
      if (url === '/.auth/me') return jsonRes(200, principalPayload(['Evaluator']));
      return jsonRes(401, {});
    });
    assert.strictEqual(ma.getState(), 'expired');
    assert.ok(w.document.getElementById('managed-gate').textContent.includes('has expired'));
  });

  await test('profile-failure & unavailable: friendly states with retry', async () => {
    const failing = makeManaged();
    const ma1 = await initManaged(failing, null, (url) => {
      if (url === '/.auth/me') return jsonRes(200, principalPayload(['Evaluator']));
      return jsonRes(500, {});
    });
    assert.strictEqual(ma1.getState(), 'profile-failure');
    assert.ok(failing.document.getElementById('managed-gate').textContent.includes('Something went wrong'));

    const rejector = makeManaged();
    const ma2 = await initManaged(rejector, null, (url) => {
      throw Object.assign(new Error('network down'), { status: 0 });
    });
    assert.strictEqual(ma2.getState(), 'unavailable');
    assert.ok(rejector.document.getElementById('managed-gate').textContent.includes("isn't available right now"));
  });

  await test('guest import: offered only when allowed and data exists; explicit POST', async () => {
    const calls = [];
    const w = makeManaged();
    w.localStorage.setItem('business-evaluator-history-v1', JSON.stringify([{ id: 'a' }, { id: 'b' }]));
    w.localStorage.setItem('coach-answers-v1', JSON.stringify({ 'a__0': 4, 'a__1': 5 }));
    const ma = await initManaged(w, { allowGuestImport: true }, (url, opts) => {
      calls.push([url, opts && opts.method]);
      if (url === '/.auth/me') return jsonRes(200, principalPayload(['Evaluator']));
      if (url === '/api/profile') return jsonRes(200, { displayName: 'Pat', language: 'simple' });
      if (url === '/api/profile/import') return jsonRes(202, { itemCount: 40, note: 'explicit' });
      return jsonRes(500, {});
    });
    assert.strictEqual(ma.getState(), 'ready');
    assert.ok(w.document.querySelector('.managed-import'), 'import offer rendered when data present');
    const btn = Array.from(w.document.querySelectorAll('.managed-import button'))
      .find((b) => b.textContent.includes('Link to my account'));
    assert.ok(btn, 'link button present');
    btn.click();
    await new Promise((r) => setTimeout(r, 10));
    assert.ok(calls.some((c) => c[0] === '/api/profile/import' && c[1] === 'POST'));
    assert.strictEqual(w.localStorage.getItem('coach-managed-import-offered-v1'), '1', 'offer remembered');
    assert.ok(w.document.querySelector('.managed-import').textContent.includes('Linked'));
  });

  await test('sign out: banner control navigates to /.auth/logout', async () => {
    const w = makeManaged();
    const ma = await initManaged(w, null, (url) => {
      if (url === '/.auth/me') return jsonRes(200, principalPayload(['Evaluator']));
      if (url === '/api/profile') return jsonRes(200, { displayName: 'Pat', language: 'simple' });
      return jsonRes(500, {});
    }, true);
    const btn = Array.from(w.document.querySelectorAll('#managed-banner button'))
      .find((b) => b.textContent.trim() === 'Sign out');
    assert.ok(btn);
    btn.click();
    assert.strictEqual(w.__navigatedTo, '/.auth/logout');
  });

  console.log('');
  console.log(passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
})().catch((err) => {
  console.error('Managed suite crashed:', err);
  process.exit(1);
});