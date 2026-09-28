'use strict';

/**
 * localauth.test.js
 * Tests for scripts/github-swauth.js — the local SWA-equivalent that does a
 * REAL GitHub OAuth login. GitHub itself is never contacted here: the OAuth
 * exchange + user fetch are stubbed, while the /api/* routes run the REAL
 * api/src handlers (handleSubmit, profile handlers) with the real
 * envelope/limiter/auditor a harness node server.
 *
 * The two OAuth "users":
 *   code=octo     -> GitHub user id 1001, login "octocat"  (mapped to a role)
 *   code=stranger -> GitHub user id 2002, login "stranger" (unmapped -> [])
 *
 * Run: node test/localauth.test.js  (part of `npm test`)
 */

const assert = require('assert');
const { createGithubServer, buildPrincipal } = require('../scripts/github-swauth.js');
const { createMemoryStore } = require('../api/src/store.js');

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

const ROLES = { octocat: ['Evaluator'] };

const TRANSPORT = {
  authUrl: 'https://auth.local/authorize',
  exchangeCode: async (clientId, clientSecret, code) => {
    assert.strictEqual(clientId, 'cid');
    assert.strictEqual(clientSecret, 'csecret');
    return 'access-token-' + code;
  },
  fetchUser: async (token) => {
    if (token === 'access-token-octo') {
      return { id: 1001, login: 'octocat', name: 'Octo Cat' };
    }
    if (token === 'access-token-stranger') {
      return { id: 2002, login: 'stranger', name: null };
    }
    throw new Error('unexpected_token');
  },
};

const ENV = { ALLOW_IMPORTS: 'true', RATE_LIMIT_MAX: '1000', RATE_LIMIT_WINDOW_MS: '60000' };

const VALID_PROFILE = {
  displayName: 'Octo Cat',
  language: 'standard',
  consents: { consentData: true, consentShareAloud: true },
};

const VALID_SUBMIT = {
  language: 'standard',
  categories: [
    { id: 'financial', label: 'Financial health', score: 4.0, band: 'strength' },
    { id: 'team', label: 'Team', score: 3.0, band: 'opportunity' },
    { id: 'ops', label: 'Operations', score: 2.0, band: 'weakness' },
    { id: 'legal', label: 'Legal', score: 4.0, band: 'strength' },
    { id: 'customers', label: 'Customers', score: 3.0, band: 'opportunity' },
    { id: 'suppliers', label: 'Suppliers', score: 2.0, band: 'weakness' },
    { id: 'tech', label: 'Technology', score: 4.0, band: 'strength' },
    { id: 'brand', label: 'Brand', score: null, band: 'unanswered' },
  ],
};

function startServer(opts) {
  const config = Object.assign({
    clientId: 'cid',
    clientSecret: 'csecret',
    rolesByUser: ROLES,
    callbackPath: '/auth/github/callback',
  }, opts.config || {});
  const server = createGithubServer({
    config,
    transport: opts.transport || TRANSPORT,
    env: opts.env || ENV,
    store: opts.store || createMemoryStore(),
    log: { error: () => {}, info: () => {} },
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        server,
        base: 'http://127.0.0.1:' + port,
      });
    });
  });
}

function cookieHeaders(res) {
  if (typeof res.headers.getSetCookie === 'function') return res.headers.getSetCookie();
  return (res.headers.get('set-cookie') || '').split(',').filter(Boolean);
}

function cookieFrom(res, name) {
  for (const raw of cookieHeaders(res)) {
    const pair = raw.trim().split(';')[0];
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    if (pair.slice(0, idx) === name) return { value: decodeURIComponent(pair.slice(idx + 1)), raw };
  }
  return null;
}

async function signIn(ctx, code) {
  const login = await fetch(ctx.base + '/.auth/login/aad', { redirect: 'manual' });
  assert.strictEqual(login.status, 302);
  const state = cookieFrom(login, 'coach_github_state');
  assert.ok(state && state.value, 'state cookie set');
  const cb = await fetch(
    ctx.base + '/auth/github/callback?code=' + code + '&state=' + encodeURIComponent(state.value),
    { redirect: 'manual', headers: { Cookie: state.raw } }
  );
  assert.strictEqual(cb.status, 302);
  const session = cookieFrom(cb, 'coach_github');
  assert.ok(session, 'session cookie set');
  return session.raw;
}

(async () => {
  await test('buildPrincipal: mapped user gets roles, stable id, github provider', () => {
    const p = buildPrincipal({ id: 1001, login: 'octocat' }, ROLES);
    assert.strictEqual(p.identityProvider, 'github');
    assert.strictEqual(p.userId, '1001');
    assert.strictEqual(p.userDetails, 'octocat');
    assert.deepStrictEqual(p.userRoles, ['Evaluator']);
    assert.deepStrictEqual(p.claims, []);
  });

  await test('buildPrincipal: unmapped user gets no roles (unassigned fallback)', () => {
    const p = buildPrincipal({ id: 2002, login: 'stranger' }, ROLES);
    assert.deepStrictEqual(p.userRoles, []);
  });

  let ctx;
  await test('server boot on ephemeral port', async () => {
    ctx = await startServer({});
  });

  await test('GET /.auth/me signed out -> clientPrincipal null', async () => {
    const res = await fetch(ctx.base + '/.auth/me');
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(await res.json(), { clientPrincipal: null });
  });

  await test('GET /.auth/login/aad -> GitHub authorize redirect with state', async () => {
    const res = await fetch(ctx.base + '/.auth/login/aad', { redirect: 'manual' });
    assert.strictEqual(res.status, 302);
    const loc = new URL(res.headers.get('location'));
    assert.strictEqual(loc.origin + loc.pathname, TRANSPORT.authUrl);
    const params = new URLSearchParams(loc.search);
    assert.strictEqual(params.get('client_id'), 'cid');
    assert.strictEqual(params.get('scope'), 'read:user');
    assert.ok(params.get('state'), 'random state present');
    assert.match(params.get('redirect_uri'), /\/auth\/github\/callback$/);
    const state = cookieFrom(res, 'coach_github_state');
    assert.ok(state && state.value.length >= 16, 'state cookie present');
  });

  await test('callback with mismatched state -> 400', async () => {
    const res = await fetch(ctx.base + '/auth/github/callback?code=octo&state=bogus', { redirect: 'manual' });
    assert.strictEqual(res.status, 400);
  });

  await test('full OAuth flow: sign in as octocat, session carries identity, never the token', async () => {
    const login = await fetch(ctx.base + '/.auth/login/aad', { redirect: 'manual' });
    const state = cookieFrom(login, 'coach_github_state');
    const cb = await fetch(
      ctx.base + '/auth/github/callback?code=octo&state=' + encodeURIComponent(state.value),
      { redirect: 'manual', headers: { Cookie: state.raw } }
    );
    assert.strictEqual(cb.status, 302);
    const cookies = cookieHeaders(cb);
    assert.strictEqual(cookies.length, 2, 'session + state-clear emitted as SEPARATE Set-Cookie headers');
    const sessionRaw = cookieFrom(cb, 'coach_github').raw;
    assert.ok(cookieFrom(cb, 'coach_github_state'), 'state cookie cleared alongside the session');
    assert.ok(!/access-token/.test(sessionRaw), 'access token is not stored in the session cookie');
    const res = await fetch(ctx.base + '/.auth/me', { headers: { Cookie: sessionRaw } });
    assert.strictEqual(res.status, 200);
    const { clientPrincipal } = await res.json();
    assert.strictEqual(clientPrincipal.identityProvider, 'github');
    assert.strictEqual(clientPrincipal.userId, '1001');
    assert.strictEqual(clientPrincipal.userDetails, 'octocat');
    assert.deepStrictEqual(clientPrincipal.userRoles, ['Evaluator']);
  });

  await test('unmapped GitHub account -> signed in but roles [] (unassigned)', async () => {
    const sessionRaw = await signIn(ctx, 'stranger');
    const res = await fetch(ctx.base + '/.auth/me', { headers: { Cookie: sessionRaw } });
    const { clientPrincipal } = await res.json();
    assert.strictEqual(clientPrincipal.userId, '2002');
    assert.deepStrictEqual(clientPrincipal.userRoles, []);
  });

  await test('profile API (REAL handler): unauthenticated -> 401', async () => {
    const res = await fetch(ctx.base + '/api/profile');
    assert.strictEqual(res.status, 401);
  });

  await test('profile API: authenticated, no profile -> 404 no_profile', async () => {
    const sessionRaw = await signIn(ctx, 'stranger');
    const res = await fetch(ctx.base + '/api/profile', { headers: { Cookie: sessionRaw } });
    assert.strictEqual(res.status, 404);
    assert.strictEqual((await res.json()).error, 'no_profile');
  });

  await test('profile API: onboard (save then read back) via real handler', async () => {
    const sessionRaw = await signIn(ctx, 'octo');
    const save = await fetch(ctx.base + '/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: sessionRaw },
      body: JSON.stringify(VALID_PROFILE),
    });
    assert.strictEqual(save.status, 200);
    const saved = await save.json();
    assert.strictEqual(saved.displayName, 'Octo Cat');
    assert.strictEqual(saved.id, '1001');
    const read = await fetch(ctx.base + '/api/profile', { headers: { Cookie: sessionRaw } });
    assert.strictEqual(read.status, 200);
    assert.strictEqual((await read.json()).displayName, 'Octo Cat');
  });

  await test('profile API: invalid profile -> 400', async () => {
    const sessionRaw = await signIn(ctx, 'octo');
    const res = await fetch(ctx.base + '/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: sessionRaw },
      body: JSON.stringify({ displayName: '', language: 'standard', consents: { consentData: true, consentShareAloud: true } }),
    });
    assert.strictEqual(res.status, 400);
  });

  await test('import API: allowed -> 202; imports disabled -> 409', async () => {
    const onCtx = await startServer({ env: Object.assign({}, ENV, { ALLOW_IMPORTS: 'true' }) });
    const sessionRaw = await signIn(onCtx, 'octo');
    const ok = await fetch(onCtx.base + '/api/profile/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: sessionRaw },
      body: JSON.stringify({ itemCount: 3, note: 'guest workbook' }),
    });
    assert.strictEqual(ok.status, 202);
    onCtx.server.close();

    const offCtx = await startServer({ env: Object.assign({}, ENV, { ALLOW_IMPORTS: 'false' }) });
    const sessionRaw2 = await signIn(offCtx, 'octo');
    const denied = await fetch(offCtx.base + '/api/profile/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: sessionRaw2 },
      body: JSON.stringify({ itemCount: 3, note: 'x' }),
    });
    assert.strictEqual(denied.status, 409);
    assert.strictEqual((await denied.json()).error, 'imports_disabled');
    offCtx.server.close();
  });

  await test('submit API (REAL handler): unauthenticated -> 401', async () => {
    // Envelope passes (same-origin, as a browser would send); the role gate
    // then rejects the anonymous caller with 401.
    const res = await fetch(ctx.base + '/api/submit', {
      method: 'POST',
      headers: { 'Sec-Fetch-Site': 'same-origin' },
      body: '{}',
    });
    assert.strictEqual(res.status, 401);
  });

  await test('submit API: authenticated but roleless -> 403 missing_required_role', async () => {
    const sessionRaw = await signIn(ctx, 'stranger');
    const res = await fetch(ctx.base + '/api/submit', {
      method: 'POST',
      headers: { Cookie: sessionRaw, 'Sec-Fetch-Site': 'same-origin' },
      body: JSON.stringify(VALID_SUBMIT),
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual((await res.json()).detail, 'missing_required_role');
  });

  await test('submit API: Evaluator + same-origin -> 202 (stored via memory store)', async () => {
    const sessionRaw = await signIn(ctx, 'octo');
    const res = await fetch(ctx.base + '/api/submit', {
      method: 'POST',
      headers: { Cookie: sessionRaw, 'Sec-Fetch-Site': 'same-origin' },
      body: JSON.stringify(VALID_SUBMIT),
    });
    assert.strictEqual(res.status, 202);
    const body = await res.json();
    assert.ok(body.id, 'submission id returned');
  });

  await test('submit API: cross-site envelope rejected -> 403', async () => {
    const sessionRaw = await signIn(ctx, 'octo');
    const res = await fetch(ctx.base + '/api/submit', {
      method: 'POST',
      headers: { Cookie: sessionRaw, 'Sec-Fetch-Site': 'cross-site', Origin: 'https://evil.example' },
      body: JSON.stringify(VALID_SUBMIT),
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual((await res.json()).detail, 'cross_site_request_rejected');
  });

  await test('GET /.auth/logout clears BOTH cookies as separate Set-Cookie headers', async () => {
    const sessionRaw = await signIn(ctx, 'octo');
    const res = await fetch(ctx.base + '/.auth/logout', {
      redirect: 'manual',
      headers: { Cookie: sessionRaw },
    });
    assert.strictEqual(res.status, 302);
    const clears = cookieHeaders(res).map((c) => c.trim().split(';')[0]);
    assert.strictEqual(clears.length, 2);
    assert.ok(clears.includes('coach_github='), 'session cookie cleared');
    assert.ok(clears.includes('coach_github_state='), 'state cookie cleared');
    assert.ok(cookieHeaders(res).every((c) => /Max-Age=0/.test(c)), 'both cleared with Max-Age=0');
  });

  await test('/js/data.js served with MANAGED_ACCESS enabled + local submit apiUrl', async () => {
    const res = await fetch(ctx.base + '/js/data.js');
    assert.strictEqual(res.status, 200);
    const src = await res.text();
    assert.match(src, /enabled: true/);
    assert.match(src, /allowGuestImport: true/);
    assert.match(src, new RegExp('SUBMIT_FORM = \\{\\s*apiUrl: "http://127\\.0\\.0\\.1:' + ctx.server.address().port + '/api/submit"'));
  });

  ctx.server.close();

  console.log('');
  console.log(passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
})().catch((err) => {
  console.error('Localauth suite crashed:', err);
  process.exit(1);
});