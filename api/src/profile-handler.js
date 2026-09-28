'use strict';

/**
 * profile-handler.js
 * Framework-agnostic request logic for /api/profile:
 *   GET  /api/profile        -> the caller's onboarding profile (or 404)
 *   POST /api/profile        -> create/update the caller's profile
 *   POST /api/profile/import -> record an explicit guest-data import
 *
 * Auth requirements:
 *   - All routes: authenticated (401 otherwise).
 *   - No role gate on profiles: a first-time sign-in (Evaluator role) must be
 *     able to complete onboarding before any role is assigned to them.
 *
 * Onboarding fields (kept minimal — the tool is a self-rating form, not a
 * user directory):
 *   displayName (<= 120 chars)
 *   language     "simple" | "standard"
 *   consents     { consentData, consentShareAloud } both true
 */

const { json } = require('./http-utils');
const auth = require('./auth');

const DEFAULT_LANGUAGES = auth.DEFAULT_LANGUAGES;
const MAX_DISPLAY_NAME = 120;
const MAX_PROFILE_BYTES = 16 * 1024;

function validateProfile(body, userId) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, status: 400, body: { error: 'Body must be a JSON object.' } };
  }

  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
  if (!displayName || displayName.length > MAX_DISPLAY_NAME) {
    return {
      ok: false,
      status: 400,
      body: { error: `"displayName" is required and must be <= ${MAX_DISPLAY_NAME} characters.` },
    };
  }

  const language = body.language;
  if (typeof language !== 'string' || DEFAULT_LANGUAGES.indexOf(language) === -1) {
    return {
      ok: false,
      status: 400,
      body: { error: `"language" must be one of: ${DEFAULT_LANGUAGES.join(', ')}.` },
    };
  }

  const consents = body.consents;
  if (consents === null || typeof consents !== 'object' || Array.isArray(consents)) {
    return { ok: false, status: 400, body: { error: '"consents" must be an object.' } };
  }
  if (consents.consentData !== true || consents.consentShareAloud !== true) {
    return {
      ok: false,
      status: 400,
      body: { error: 'Both consents must be true to continue (consentData, consentShareAloud).' },
    };
  }

  return {
    ok: true,
    profile: {
      id: userId,
      userId,
      displayName: displayName.slice(0, MAX_DISPLAY_NAME),
      language,
      consents,
      updatedAt: new Date().toISOString(),
    },
  };
}

async function getProfileHandler(opts) {
  const { principal, store, audit } = opts;
  const authed = auth.requireAuthenticated(principal);
  if (!authed.ok) return json(authed.status, authed.body);

  const userId = principal.userId;
  let profile = null;
  try {
    profile = await store.getProfile(userId);
  } catch (err) {
    return json(500, { error: 'profile_failure' });
  }
  if (!profile) return json(404, { error: 'no_profile' });
  if (audit) audit.emit('profile.read', principal, {});
  return json(200, profile);
}

async function saveProfileHandler(opts) {
  const { bodyBuffer, principal, store, env, audit } = opts;
  const authed = auth.requireAuthenticated(principal);
  if (!authed.ok) return json(authed.status, authed.body);

  if (bodyBuffer.length > MAX_PROFILE_BYTES) {
    return json(413, { error: 'profile_too_large' });
  }
  let payload;
  try {
    payload = JSON.parse(bodyBuffer.toString('utf8'));
  } catch (e) {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const valid = validateProfile(payload, principal.userId);
  if (!valid.ok) return json(valid.status, valid.body);

  try {
    await store.saveProfile(principal.userId, valid.profile);
  } catch (err) {
    return json(500, { error: 'profile_failure' });
  }
  if (audit) audit.emit('profile.saved', principal, {});
  return json(200, valid.profile);
}

/**
 * POST /api/profile/import
 * Records an explicit guest-data import (name, item count, note) against the
 * caller's profile. Always returns ok:false when imports are disallowed —
 * see ALLOW_IMPORTS_CONFIG (this module's opt-in flag, currently off until
 * product confirms tenant-scoped safeguards).
 */
async function importProfileHandler(opts) {
  const { bodyBuffer, principal, store, env, audit } = opts;
  const authed = auth.requireAuthenticated(principal);
  if (!authed.ok) return json(authed.status, authed.body);

  const allowImports = String((env && env.ALLOW_IMPORTS) || 'false') === 'true';
  if (!allowImports) return json(409, { error: 'imports_disabled' });

  if (bodyBuffer.length > 512 * 1024) {
    return json(413, { error: 'import_too_large' });
  }
  let payload;
  try {
    payload = JSON.parse(bodyBuffer.toString('utf8'));
  } catch (e) {
    return json(400, { error: 'Invalid JSON body.' });
  }
  const itemCount = Number(payload && payload.itemCount);
  const record = {
    kind: 'guest-import',
    itemCount: Number.isFinite(itemCount) && itemCount > 0 ? Math.min(Math.floor(itemCount), 100000) : 0,
    note: typeof (payload && payload.note) === 'string'
      ? payload.note.slice(0, 200)
      : '',
    importedAt: new Date().toISOString(),
  };
  try {
    await store.saveGuestImport(principal.userId, record);
  } catch (err) {
    return json(500, { error: 'profile_failure' });
  }
  if (audit) audit.emit('profile.import_guest', principal, { items: record.itemCount });
  return json(202, record);
}

module.exports = {
  getProfileHandler,
  saveProfileHandler,
  importProfileHandler,
  validateProfile,
  MAX_PROFILE_BYTES,
  MAX_DISPLAY_NAME,
};