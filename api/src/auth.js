'use strict';

/**
 * auth.js
 * Shared, framework-agnostic security helpers for the managed (Phase 1) API.
 *
 * Trust model
 * -----------
 * The identity source is Azure Static Web Apps, which injects the
 * x-ms-client-principal header on its own side. This module never verifies
 * that header itself — the SWA platform is the trust anchor. Deployment
 * requirements to keep that true:
 *   - Functions must run behind the SWA auth layer (never exposed directly).
 *   - SWA must be configured to strip client-supplied copies of the header
 *     (the SWA-managed "authenticate requests" mode does this).
 *
 * Identity key
 * ------------
 * The internal user key is `principal.userId` (SWA's stable IdP identifier,
 * e.g. the Entra ID object id / `sub`). IMPORTANT: it must never fall back to
 * `userDetails`, which is the human-readable UPN/email and can change.
 */

const DEFAULT_SUBMIT_ROLES = ['Evaluator', 'Reviewer', 'Administrator'];
const DEFAULT_LANGUAGES = ['simple', 'standard'];

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];
const SECRET_FIELD = /(token|secret|password|authorization|cookie|session|credential|key\b|bearer)/i;

/**
 * Decode the SWA x-ms-client-principal header into a normalized principal.
 * Returns null for anything that does not yield a stable userId.
 */
function parsePrincipal(rawHeader) {
  if (!rawHeader) return null;
  let decoded;
  try {
    const normalized = String(rawHeader).replace(/-/g, '+').replace(/_/g, '/');
    decoded = JSON.parse(Buffer.from(normalized, 'base64').toString('utf8'));
  } catch (e) {
    return null;
  }
  const userId = decoded.userId || decoded.sub || claimValue({
    claims: Array.isArray(decoded.claims) ? decoded.claims : [],
  }, ['oid', 'sub']);
  if (!userId) return null;
  return {
    identityProvider: decoded.identityProvider || null,
    userId: String(userId),
    userDetails: typeof decoded.userDetails === 'string' ? decoded.userDetails : '',
    userRoles: Array.isArray(decoded.userRoles) ? decoded.userRoles.slice() : [],
    claims: Array.isArray(decoded.claims) ? decoded.claims.slice() : [],
  };
}

/** Look up a claim by (case-insensitive) name; flattens name/typ & value/val. */
function claimValue(principal, expectedNames) {
  const names = expectedNames.map((n) => n.toLowerCase());
  for (const claim of (principal && principal.claims) || []) {
    const name = String(claim.name || claim.typ || '').toLowerCase();
    if (names.indexOf(name) !== -1) {
      return claim.value === undefined ? claim.val : claim.value;
    }
  }
  return null;
}

/** Tenant check against a statically allowed tenant id (claim "tid"). */
function tenantMatches(principal, allowedTenantId) {
  if (!allowedTenantId) return true; // not tenant-pinned
  const tid = claimValue(principal, ['tid', 'tenant_id', 'tenant-id']);
  if (tid) return String(tid).toLowerCase() === String(allowedTenantId).toLowerCase();
  return false;
}

function hasRole(principal, role) {
  return Array.isArray(principal.userRoles) && principal.userRoles.indexOf(role) !== -1;
}

/** Authenticated is required for any managed endpoint. */
function requireAuthenticated(principal) {
  if (!principal || !principal.userId) {
    return { ok: false, status: 401, body: { error: 'unauthenticated' } };
  }
  return { ok: true };
}

/** Authenticated AND holding at least one allowed role. */
function requireRole(principal, allowedRoles) {
  const base = requireAuthenticated(principal);
  if (!base.ok) return base;
  const roles = allowedRoles || DEFAULT_SUBMIT_ROLES;
  if (!roles.some((r) => hasRole(principal, r))) {
    return { ok: false, status: 403, body: { error: 'forbidden', detail: 'missing_required_role' } };
  }
  return { ok: true, principal };
}

/**
 * CSRF / request-envelope check for state-changing methods.
 * Safe methods pass. All others must be same-origin (per Sec-Fetch-Site) or
 * carry an Origin header listed in allowedOrigins. Browsers send
 * Sec-Fetch-Site on every cross-site request, so a cross-site form/fetch
 * cannot claim same-origin.
 */
function checkRequestEnvelope(meta, allowedOrigins) {
  const method = String((meta && meta.method) || 'GET').toUpperCase();
  if (SAFE_METHODS.indexOf(method) !== -1) return { ok: true };

  const secFetch = String((meta && meta.secFetchSite) || '').toLowerCase();
  if (secFetch === 'same-origin' || secFetch === 'none') return { ok: true };

  const origin = meta && meta.origin ? String(meta.origin) : '';
  if (origin && Array.isArray(allowedOrigins)) {
    if (allowedOrigins.indexOf('*') !== -1 || allowedOrigins.indexOf(origin) !== -1) {
      return { ok: true };
    }
  }
  return { ok: false, status: 403, body: { error: 'forbidden', detail: 'cross_site_request_rejected' } };
}

function parseOrigins(raw) {
  if (!raw) return [];
  return String(raw).split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * Minimal in-process sliding-window rate limiter.
 * Explicitly a TEMPORARY single-instance measure — it does not coordinate
 * across multiple function instances/processes. Use a durable store (Redis /
 * Cosmos / App Gateway) before production multi-instance traffic.
 */
function createRateLimiter(opts) {
  const max = Number((opts && opts.max) !== undefined ? opts.max : 20);
  const windowMs = Number((opts && opts.windowMs) !== undefined ? opts.windowMs : 60 * 1000);
  const buckets = new Map();
  function check(key) {
    const now = Date.now();
    let b = buckets.get(key);
    if (!b || now - b.started >= windowMs) {
      b = { started: now, count: 0 };
      buckets.set(key, b);
    }
    b.count += 1;
    if (b.count > max) {
      return { ok: false, retryAfterMs: Math.max(1, windowMs - (now - b.started)) };
    }
    return { ok: true };
  }
  return { check, reset: () => buckets.clear() };
}

function limiterFor(env, defaults) {
  return createRateLimiter({
    max: Number((env && env.RATE_LIMIT_MAX) !== undefined ? env.RATE_LIMIT_MAX : defaults.max),
    windowMs: Number((env && env.RATE_LIMIT_WINDOW_MS) !== undefined
      ? env.RATE_LIMIT_WINDOW_MS
      : defaults.windowMs),
  });
}

function rateKey(principal, meta) {
  if (principal && principal.userId) return principal.userId;
  return 'ip:' + ((meta && meta.ip) || 'unknown');
}

/** Strip anything that could leak credentials or PII-heavy payloads. */
function sanitizeMeta(meta) {
  const out = {};
  const src = meta && typeof meta === 'object' ? meta : {};
  Object.keys(src).forEach((k) => {
    if (SECRET_FIELD.test(k)) return;
    const v = src[k];
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[k] = v;
  });
  return out;
}

/**
 * Audit-event hook. Emits a sanitized entry to the logger and, optionally, to
 * a durable persist sink (e.g. a Cosmos 'audit' container). Never logs tokens,
 * cookies, authorization headers, or full payloads.
 */
function createAuditor(opts) {
  const o = opts || {};
  const log = o.log || { info: () => {}, error: () => {} };
  const persist = typeof o.persist === 'function' ? o.persist : null;

  function emit(eventName, principal, meta) {
    const entry = {
      event: eventName,
      userId: principal ? principal.userId : null,
      identityProvider: principal ? principal.identityProvider : null,
      timestamp: new Date().toISOString(),
      meta: sanitizeMeta(meta),
    };
    try {
      log.info('audit:' + eventName + ' user=' + entry.userId);
    } catch (e) { /* logging must never break a request */ }
    if (persist) {
      try { persist(entry); } catch (e) {
        try { log.error('audit persist failed: ' + (e && e.message)); } catch (e2) { /* noop */ }
      }
    }
    return entry;
  }
  return { emit };
}

module.exports = {
  DEFAULT_SUBMIT_ROLES,
  DEFAULT_LANGUAGES,
  parsePrincipal,
  claimValue,
  tenantMatches,
  hasRole,
  requireAuthenticated,
  requireRole,
  checkRequestEnvelope,
  parseOrigins,
  createRateLimiter,
  limiterFor,
  rateKey,
  sanitizeMeta,
  createAuditor,
};