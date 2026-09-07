'use strict';

/**
 * handler.js
 * Framework-agnostic request processing for POST /api/submit.
 * No Azure imports here — the Azure Functions adapter (src/functions/submit.js)
 * injects the store and logging, which keeps this fully unit-testable in plain
 * Node with zero dependencies.
 */

const { validateSubmit, MAX_BODY_BYTES } = require('./validate');

function json(status, body) {
  return { status, headers: { 'Content-Type': 'application/json' }, body };
}

function hasRole(principal, requiredRole) {
  return !!principal && Array.isArray(principal.userRoles)
    && principal.userRoles.indexOf(requiredRole) !== -1;
}

/**
 * @param {object} args
 * @param {string} args.bodyText          raw request body
 * @param {object|null} args.principal    decoded x-ms-client-principal info
 * @param {(submission:object)=>Promise<{stored:boolean}>} args.store
 * @param {object} [args.env]             environment (injectable for tests)
 * @param {object} [args.log]             optional logger ({error, info})
 */
async function handleSubmit({ bodyText, principal, store, env, log }) {
  const cfg = env || {};
  const logger = log || { error: () => {}, info: () => {} };

  if (typeof bodyText !== 'string' || bodyText.trim().length === 0) {
    return json(400, { error: 'Empty request body.' });
  }
  if (bodyText.length > MAX_BODY_BYTES) {
    return json(413, { error: 'Payload too large.' });
  }

  // Optional authorization: require the SWA-injected "Submitters" role.
  if (cfg.REQUIRE_AUTH === 'true') {
    const role = cfg.SUBMITTER_ROLE || 'submitters';
    if (!hasRole(principal, role)) {
      return json(403, { error: 'You are not authorized to submit results.' });
    }
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
    submissionId: crypto.randomUUID(),
    submittedAt: new Date().toISOString(),
    principal: principal && principal.userId ? principal.userId : null,
  };

  let stored = false;
  try {
    const storeResult = await store(submission);
    stored = !!storeResult && storeResult.stored !== false;
  } catch (err) {
    logger.error('store failure: ' + (err && err.message));
    return json(500, { error: 'Could not store submission.' });
  }

  return json(202, { id: submission.submissionId, stored });
}

module.exports = { handleSubmit };