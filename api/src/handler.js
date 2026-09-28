'use strict';

/**
 * handler.js
 * Framework-agnostic request processing for POST /api/submit.
 * No Azure imports here — the Azure Functions adapter (src/functions/submit.js)
 * injects the store, logging, and request envelope.
 *
 * Security model (always enforced — managed mode):
 *   - 401 if no authenticated principal is present.
 *   - 403 if the principal holds none of the submit roles.
 *   - 403 for cross-site state-changing requests (CSRF envelope).
 *   - 429 when over the rate limit (in-process, temporary).
 *   - Audit events on accept/deny; identities are stable userIds, never tokens.
 */

const { randomUUID } = require('crypto');
const { validateSubmit, MAX_BODY_BYTES } = require('./validate');
const auth = require('./auth');
const { json } = require('./http-utils');

const SUBMIT_ROLES = auth.DEFAULT_SUBMIT_ROLES;

async function handleSubmit(opts) {
  const { bodyText, principal, store, env, log, audit, requestMeta } = opts;
  const cfg = env || {};
  const logger = log || { error: () => {}, info: () => {} };
  const dlStore = typeof store === 'function' ? store : (store && store.storeSubmission);
  if (typeof dlStore !== 'function') {
    throw new Error('store must be a function or expose storeSubmission()');
  }

  const envelope = auth.checkRequestEnvelope(requestMeta || {}, auth.parseOrigins(cfg.ALLOWED_ORIGINS));
  if (!envelope.ok) {
    return json(envelope.status, envelope.body);
  }

  const limiter = opts.limiter || auth.limiterFor(cfg, { max: 20, windowMs: 60000 });
  const rl = limiter.check(auth.rateKey(principal, requestMeta));
  if (!rl.ok) {
    return json(429, { error: 'too_many_requests' }, {
      'Retry-After': String(Math.max(1, Math.ceil(rl.retryAfterMs / 1000))),
    });
  }

  const authz = auth.requireRole(principal, SUBMIT_ROLES);
  if (!authz.ok) {
    if (audit) {
      audit.emit('submit.denied', principal, {
        status: authz.status,
        reason: authz.status === 401 ? 'unauthenticated' : 'missing_role',
      });
    }
    return json(authz.status, authz.body);
  }

  if (typeof bodyText !== 'string' || bodyText.trim().length === 0) {
    return json(400, { error: 'Empty request body.' });
  }
  if (bodyText.length > MAX_BODY_BYTES) {
    return json(413, { error: 'Payload too large.' });
  }

  let parsed;
  try {
    parsed = JSON.parse(bodyText);
  } catch (e) {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const result = validateSubmit(parsed);
  if (!result.ok) {
    return json(result.status || 400, { error: result.error });
  }

  const submission = {
    schemaVersion: 1,
    language: result.data.language,
    categories: result.data.categories,
    submissionId: randomUUID(),
    submittedAt: new Date().toISOString(),
    principal: authz.principal.userId,
  };

  let stored = false;
  try {
    const storeResult = await dlStore(submission);
    stored = !!storeResult && storeResult.stored !== false;
  } catch (err) {
    logger.error('store failure: ' + (err && err.message));
    return json(500, { error: 'Could not store submission.' });
  }

  if (audit) {
    audit.emit('submit.accepted', authz.principal, { submissionId: submission.submissionId });
  }
  return json(202, { id: submission.submissionId, stored });
}

module.exports = { handleSubmit, SUBMIT_ROLES };