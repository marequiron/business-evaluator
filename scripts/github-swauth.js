'use strict';

/**
 * github-swauth.js — real first-time sign-in WITHOUT Azure, using your own
 * GitHub account as the identity provider.
 *
 *   npm run auth:github
 *   -> open http://127.0.0.1:4174/
 *
 * This is a local SWA-equivalent that:
 *   - Serves the real app (via serve.js) with a RUNTIME-REWRITTEN copy of
 *     js/data.js (MANAGED_ACCESS enabled — the on-disk file is untouched).
 *   - Implements the SWA endpoints js/managed.js expects:
 *       /.auth/login/aad      -> redirects to the REAL GitHub OAuth login
 *       /auth/github/callback -> exchanges the code, fetches /user, issues
 *                                an HttpOnly session cookie, redirects home
 *       /.auth/me             -> clientPrincipal built from that session
 *       /.auth/logout         -> clears the session
 *   - Runs the REAL Phase-1 API handlers for /api/* (profile, submit) with
 *     the session principal, so onboarding/CSRF/rate-limit/role-gauges all
 *     behave exactly as in production. Only storage is the in-memory dev
 *     store (resets on restart).
 *
 * Identity/roles:
 *   - Identity key is GitHub's numeric user id (principal.userId) — never the
 *     login/email (userDetails). The access token is exchanged, used once to
 *     fetch /user, and NEVER stored (not in the cookie, not on disk).
 *   - Roles come from scripts/github-roles.local.json (gitignored) mapping
 *     GitHub usernames -> role arrays. Unmapped users get [] -> the app shows
 *     the safe "unassigned" banner. There is no ?as= persona override here —
 *     this server is *real* (the persona mock is scripts/mock-swauth.js).
 *
 * How to set up (one time, ~3 min, no admin):
 *   1. Create a GitHub OAuth App: github.com -> Settings -> Developer
 *      settings -> OAuth Apps -> New OAuth App.
 *        Homepage URL:            http://127.0.0.1:4174/
 *        Authorization callback:  http://127.0.0.1:4174/auth/github/callback
 *      (host must be 127.0.0.1 — not localhost.)
 *   2. Provide the client id/secret via env (GITHUB_CLIENT_ID /
 *      GITHUB_CLIENT_SECRET) or a gitignored scripts/.github-oauth.json:
 *        { "clientId": "...", "clientSecret": "..." }
 *   3. Map your username in scripts/github-roles.local.json (copy the
 *      .sample):  { "<your-github-username>": ["Evaluator"] }
 *   4. npm run auth:github, open http://127.0.0.1:4174/, sign in.
 *
 * Optional env:
 *   PORT / HOST                      bind port/host (default 4174 / 127.0.0.1)
 *   GITHUB_CLIENT_ID / _SECRET       OAuth app credentials
 *   GITHUB_CALLBACK_PATH             local callback route (default above)
 *   GITHUB_REDIRECT_URI              exact redirect_uri GitHub registered
 *   GITHUB_AUTH_URL / _TOKEN_URL / _API_URL  endpoint overrides (testing)
 *   GITHUB_ROLES_FILE                roles JSON path (default as above)
 *   ALLOW_IMPORTS=true               also enable the guest-import endpoint
 *   RATE_LIMIT_MAX / RATE_LIMIT_WINDOW_MS  pass-through to the real limiter
 */

const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const {
  createStaticServer,
  urlPath,
  queryOf,
  parseCookie,
  cookieHeader,
  clearCookieHeader,
  readBody,
  readBodyBuffer,
  json,
  redirect,
  html,
  serveManagedData,
} = require('./localauth-lib.js');
const handleSubmit = require('../api/src/handler.js').handleSubmit;
const { getProfileHandler, saveProfileHandler, importProfileHandler } = require('../api/src/profile-handler.js');
const auth = require('../api/src/auth.js');
const { createMemoryStore } = require('../api/src/store.js');

const ROOT = path.resolve(__dirname, '..');
const SESSION_COOKIE = 'coach_github';
const STATE_COOKIE = 'coach_github_state';
const SESSION_MAX_AGE = 8 * 60 * 60;
const STATE_MAX_AGE = 5 * 60;

function loadJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return fallback;
  }
}

/**
 * Build the clientPrincipal SWA would have produced for a GitHub user.
 * Identity key = numeric GitHub id (stable), never the login/email.
 */
function buildPrincipal(user, rolesByUser) {
  const roles = (rolesByUser[String(user.login || '')] || []).slice();
  return {
    identityProvider: 'github',
    userId: String(user.id),
    userDetails: String(user.login || ''),
    userRoles: roles,
    claims: [],
  };
}

/** Real GitHub transport (overridable per-instance for tests). */
function realGitHubTransport() {
  return {
    authUrl: process.env.GITHUB_AUTH_URL || 'https://github.com/login/oauth/authorize',
    tokenUrl: process.env.GITHUB_TOKEN_URL || 'https://github.com/login/oauth/access_token',
    apiUserUrl: (process.env.GITHUB_API_URL || 'https://api.github.com'),
    exchangeCode: async (clientId, clientSecret, code) => {
      const resp = await fetch(process.env.GITHUB_TOKEN_URL || 'https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
      });
      const text = await resp.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        data = {};
        new URLSearchParams(text).forEach((v, k) => { data[k] = v; });
      }
      if (!resp.ok || !data.access_token) {
        throw new Error(data.error_description || data.error || 'token_exchange_failed');
      }
      return data.access_token;
    },
    fetchUser: async (token) => {
      const resp = await fetch((process.env.GITHUB_API_URL || 'https://api.github.com') + '/user', {
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': 'Bearer ' + token,
          'User-Agent': 'business-evaluator-local/1.0',
        },
      });
      if (!resp.ok) throw new Error('user_fetch_failed');
      return resp.json();
    },
  };
}

function timingSafeEqualStr(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function nodeRequestMeta(req) {
  return {
    method: String(req.method || 'GET').toUpperCase(),
    origin: String(req.headers.origin || ''),
    secFetchSite: String(req.headers['sec-fetch-site'] || ''),
    ip: String((req.socket && req.socket.remoteAddress) || ''),
  };
}

function writeResult(res, result) {
  json(res, result.status, result.body, result.headers || {});
}

/**
 * Build the full server. `opts`:
 *   config    { clientId?, clientSecret?, rolesByUser, callbackPath? }
 *   transport { authUrl, exchangeCode, fetchUser }   (use realGitHubTransport())
 *   store     data store instance (default: a shared in-memory dev store)
 *   env       object handed to handlers (default: process.env)
 *   log       { error, info } (default: console)
 * Returns an http.Server that is NOT yet listening.
 */
function createGithubServer(opts) {
  const o = opts || {};
  const cfg = o.config || {};
  const rolesByUser = cfg.rolesByUser || {};
  const callbackPath = cfg.callbackPath || '/auth/github/callback';
  const transport = o.transport || realGitHubTransport();
  const dataStore = o.store || createMemoryStore();
  const env = o.env || process.env;
  const log = o.log || { error: (m) => console.error(m), info: (m) => console.log(m) };
  const staticServer = o.staticServer || createStaticServer(ROOT);

  const submitLimiter = auth.limiterFor(env, { max: 20, windowMs: 60000 });
  const profileLimiter = auth.limiterFor(env, { max: 60, windowMs: 60000 });

  function auditFor() {
    return auth.createAuditor({
      logger: log,
      persist: (entry) => dataStore.saveAuditEvent(entry),
    });
  }

  function sessionOf(req) {
    const raw = parseCookie(req.headers.cookie || '')[SESSION_COOKIE];
    if (!raw) return null;
    try {
      const s = JSON.parse(raw);
      if (!s || !s.i) return null;
      return s;
    } catch (e) {
      return null;
    }
  }

  function principalOf(session) {
    if (!session) return null;
    return {
      identityProvider: 'github',
      userId: String(session.i),
      userDetails: String(session.u || ''),
      userRoles: (rolesByUser[String(session.u || '')] || []).slice(),
      claims: [],
    };
  }

  async function handleProfileApi(req, res, handlerFn) {
    const principal = principalOf(sessionOf(req));
    const meta = nodeRequestMeta(req);
    const rate = profileLimiter.check(auth.rateKey(principal, meta));
    if (!rate.ok) {
      json(res, 429, { error: 'too_many_requests' }, {
        'Retry-After': String(Math.max(1, Math.ceil(rate.retryAfterMs / 1000))),
      });
      return;
    }
    try {
      const bodyBuffer = await readBodyBuffer(req, 512 * 1024);
      const result = await handlerFn({
        bodyText: bodyBuffer.toString('utf8'),
        bodyBuffer,
        principal,
        requestMeta: meta,
        store: dataStore,
        env,
        logger: log,
        audit: auditFor(),
      });
      writeResult(res, result);
    } catch (err) {
      log.error('profile handler threw: ' + (err && err.message));
      json(res, 500, { error: 'Internal error.' });
    }
  }

  async function handleSubmitApi(req, res) {
    const principal = principalOf(sessionOf(req));
    try {
      const result = await handleSubmit({
        bodyText: await readBody(req, 512 * 1024),
        principal,
        store: dataStore,
        env,
        log,
        audit: auditFor(),
        limiter: submitLimiter,
        requestMeta: nodeRequestMeta(req),
      });
      writeResult(res, result);
    } catch (err) {
      log.error('submit handler threw: ' + (err && err.message));
      json(res, 500, { error: 'Internal error.' });
    }
  }

  function redirectUriFor(req) {
    return cfg.redirectUri || ('http://' + (req.headers.host || '127.0.0.1') + callbackPath);
  }

  const server = http.createServer(async (req, res) => {
    const pathname = urlPath(req);
    const method = (req.method || 'GET').toUpperCase();

    try {
      /* ---- auth ---- */
      if (pathname === '/.auth/me' && method === 'GET') {
        const principal = principalOf(sessionOf(req));
        json(res, 200, { clientPrincipal: principal });
        return;
      }

      if (pathname === '/.auth/login/aad' && method === 'GET') {
        if (!cfg.clientId || !cfg.clientSecret) {
          html(res, 500, 'GitHub OAuth not configured',
            '<p>Set <code>GITHUB_CLIENT_ID</code>/<code>GITHUB_CLIENT_SECRET</code> ' +
            '(or create <code>scripts/.github-oauth.json</code>), then restart ' +
            '<code>npm run auth:github</code>.</p>' +
            '<p>See the steps at the top of <code>scripts/github-swauth.js</code>.</p>' +
            '<p><a href="/">Back to the app</a></p>');
          return;
        }
        const state = crypto.randomBytes(16).toString('hex');
        const params = new URLSearchParams({
          client_id: cfg.clientId,
          redirect_uri: redirectUriFor(req),
          scope: 'read:user',
          state,
        });
        redirect(res, transport.authUrl + '?' + params.toString(), {
          'Set-Cookie': cookieHeader(STATE_COOKIE, state, { maxAge: STATE_MAX_AGE }),
        });
        return;
      }

      if (pathname === callbackPath && method === 'GET') {
        const q = queryOf(req);
        const clearState = { 'Set-Cookie': clearCookieHeader(STATE_COOKIE) };
        const stateCookie = parseCookie(req.headers.cookie || '')[STATE_COOKIE];
        if (q.error) {
          html(res, 400, 'Sign-in cancelled', '<p>GitHub returned an error: ' +
            (q.error + (q.error_description ? ': ' + q.error_description : '')) +
            '</p><p><a href="/">Back to the app</a> (try again).</p>', clearState);
          return;
        }
        if (!q.code || !stateCookie || !timingSafeEqualStr(stateCookie, q.state)) {
          html(res, 400, 'Sign-in failed',
            '<p>The sign-in request was not valid (state mismatch).</p>' +
            '<p><a href="/">Back to the app</a> (try again).</p>', clearState);
          return;
        }
        try {
          const token = await transport.exchangeCode(cfg.clientId, cfg.clientSecret, q.code);
          const user = await transport.fetchUser(token);
          const session = {
            i: String(user.id || ''),
            u: String(user.login || ''),
            n: String(user.name && user.name !== null ? user.name : user.login || ''),
          };
          if (!session.i) throw new Error('missing_user_id');
          const setCookies = [
            cookieHeader(SESSION_COOKIE, JSON.stringify(session), { maxAge: SESSION_MAX_AGE }),
            clearCookieHeader(STATE_COOKIE),
          ];
          redirect(res, '/', { 'Set-Cookie': setCookies });
          log.info('sign-in ok: github user ' + session.i + ' (' + session.u + ')');
        } catch (err) {
          log.error('github sign-in failed: ' + (err && err.message));
          html(res, 502, 'Sign-in failed',
            '<p>Could not complete sign-in with GitHub: ' +
            (err && err.message ? err.message : 'unknown error') + '</p>' +
            '<p><a href="/">Back to the app</a> (try again).</p>', clearState);
        }
        return;
      }

      if (pathname === '/.auth/logout' && method === 'GET') {
        redirect(res, '/', {
          'Set-Cookie': [clearCookieHeader(SESSION_COOKIE), clearCookieHeader(STATE_COOKIE)],
        });
        return;
      }

      /* ---- real Phase-1 API handlers ---- */
      if (pathname === '/api/profile') {
        if (method === 'GET') {
          await handleProfileApi(req, res, getProfileHandler);
        } else if (method === 'POST') {
          await handleProfileApi(req, res, saveProfileHandler);
        } else {
          json(res, 405, { error: 'method_not_allowed' });
        }
        return;
      }

      if (pathname === '/api/profile/import' && method === 'POST') {
        await handleProfileApi(req, res, importProfileHandler);
        return;
      }

      if (pathname === '/api/submit' && method === 'POST') {
        await handleSubmitApi(req, res);
        return;
      }

      /* ---- rewritten data (managed mode ON) + real static app ---- */
      if (pathname === '/js/data.js' && method === 'GET') {
        serveManagedData(req, res, {
          allowGuestImport: true,
          submitApiUrl: 'http://' + (req.headers.host || '127.0.0.1') + '/api/submit',
        });
        return;
      }

      staticServer.emit('request', req, res);
    } catch (err) {
      log.error('unexpected proxy error: ' + (err && err.stack || err));
      try {
        json(res, 500, { error: 'Internal error.' });
      } catch (e) { /* response already sent */ }
    }
  });

  return server;
}

/* ---- real run (not under test) ---- */
const main = (() => {
  if (require.main !== module) return null;
  const PORT = Number(process.env.PORT) || 4174;
  const HOST = process.env.HOST || '127.0.0.1';
  const oauthFile = path.join(ROOT, 'scripts', '.github-oauth.json');
  const rolesFile = process.env.GITHUB_ROLES_FILE || path.join(ROOT, 'scripts', 'github-roles.local.json');

  const oauth = loadJson(oauthFile, {});
  const config = {
    clientId: process.env.GITHUB_CLIENT_ID || oauth.clientId || '',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || oauth.clientSecret || '',
    rolesByUser: loadJson(rolesFile, {}),
    callbackPath: process.env.GITHUB_CALLBACK_PATH || '/auth/github/callback',
    redirectUri: process.env.GITHUB_REDIRECT_URI || '',
  };

  const server = createGithubServer({ config, transport: realGitHubTransport() });
  server.listen(PORT, HOST, () => {
    console.log('');
    console.log('GitHub OAuth sign-in (local SWA-equivalent) — real login, no Azure');
    console.log('  http://' + HOST + ':' + PORT + '/');
    console.log('');
    console.log('  First-time flow: open the URL -> "Sign in to continue" ->');
    console.log('  click Sign in -> GitHub login -> authorize -> onboarding -> app.');
    const mapped = Object.keys(config.rolesByUser);
    if (config.clientId && config.clientSecret && mapped.length) {
      console.log('  Roles file ok: ' + mapped.join(', ') + (config.rolesByUser[mapped[0]].length ? '' : ''));
    }
    const problems = [];
    if (!config.clientId || !config.clientSecret) {
      problems.push('oauth credentials missing: set GITHUB_CLIENT_ID/GITHUB_CLIENT_SECRET or scripts/.github-oauth.json');
    } else if (config.rolesByUser && Object.keys(config.rolesByUser).length === 0) {
      problems.push('no roles mapped: put your GitHub username into scripts/github-roles.local.json');
    }
    problems.forEach((p) => console.log('  !! ' + p));
    console.log('');
    console.log('  Sign out: /.auth/logout  |  Guest import endpoint: on only with');
    console.log('  ALLOW_IMPORTS=true  |  Roles map: scripts/github-roles.local.json');
    console.log('  (unmapped GitHub users see the safe "unassigned" banner).');
    console.log('');
  });
  return server;
})();

module.exports = { createGithubServer, buildPrincipal, realGitHubTransport, SESSION_COOKIE, STATE_COOKIE };