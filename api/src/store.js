'use strict';

/**
 * store.js
 * Persistence for the managed (Phase 1) API.
 *
 * Data model (when Cosmos is configured):
 *   - database `business-evaluator` (COSMOS_DATABASE)
 *   - container `submissions` (COSMOS_CONTAINER)  -> evaluation submissions
 *   - container `users`        (COSMOS_USERS_CONTAINER) -> keyed by userId
 *     (the stable IdP identifier). Holds profile + guest-import history.
 *   - container `audit`        (COSMOS_AUDIT_CONTAINER) -> audit entries
 *
 * Behaviour when storage is NOT configured:
 *  - DEV_NO_STORE=true (or local Functions development env) -> in-memory
 *    dev store (used while scaffolding / before approval; resets on restart).
 *  - anything else -> throws, so handlers surface 500 and nothing is
 *    silently dropped.
 *
 * Backwards compat: createStore(env) still returns a submission-only sink
 * function (log-and-return in dev, throwing when unconfigured). Prefer
 * createDataStore(env) for new code.
 */

const { randomUUID } = require('crypto');

function createCosmosStore(env) {
  const { CosmosClient } = require('@azure/cosmos');
  const connectionString = env.COSMOS_CONNECTION_STRING;
  const endpoint = env.COSMOS_ENDPOINT;
  const key = env.COSMOS_KEY;
  const client = connectionString
    ? new CosmosClient(connectionString)
    : new CosmosClient({ endpoint, key });
  const database = client.database(env.COSMOS_DATABASE || 'business-evaluator');
  const submissions = database.container(env.COSMOS_CONTAINER || 'submissions');
  const users = database.container(env.COSMOS_USERS_CONTAINER || 'users');
  const audit = database.container(env.COSMOS_AUDIT_CONTAINER || 'audit');

  /* Cosmos DB requires every item to carry an `id` property (used for the
   * partition key /id on each container). Normalize documents before write so
   * a missing/foreign key field never surfaces as a hard 500. */
  function normalize(doc, idValue) {
    const id = doc && doc.id !== undefined ? doc.id : idValue;
    if (!id) throw new Error('Cannot persist a document without an id (got ' + (idValue === undefined ? 'none' : idValue) + ').');
    return Object.assign({ id: id }, doc || {});
  }

  async function storeSubmission(submission) {
    const doc = normalize(submission, submission && submission.submissionId);
    await submissions.items.create(doc);
    return { stored: true };
  }

  async function getProfile(userId) {
    try {
      const { resource } = await users.item(userId, userId).read();
      return resource || null;
    } catch (e) {
      if (e && e.code === 404) return null;
      throw e;
    }
  }

  async function saveProfile(userId, profile) {
    const doc = normalize(profile, userId);
    await users.items.upsert(doc);
    return doc;
  }

  async function saveGuestImport(userId, record) {
    const current = await getProfile(userId);
    const existing = (current && Array.isArray(current.imports)) ? current.imports : [];
    const profile = current || { id: userId, userId };
    profile.imports = existing.concat(record).slice(-10);
    const doc = normalize(profile, userId);
    await users.items.upsert(doc);
    return record;
  }

  async function saveAuditEvent(entry) {
    const doc = normalize(entry, (entry && entry.id) || randomUUID());
    await audit.items.create(doc);
    return entry;
  }

  return { storeSubmission, getProfile, saveProfile, saveGuestImport, saveAuditEvent };
}

/** In-memory dev store: same shape as the Cosmos store, resets on restart. */
function createMemoryStore() {
  const profiles = new Map();
  const auditEntries = [];
  return {
    async storeSubmission(submission) {
      // eslint-disable-next-line no-console
      console.log('[dev] submission not persisted:', submission.submissionId);
      return { stored: false };
    },
    async getProfile(userId) { return profiles.get(userId) || null; },
    async saveProfile(userId, profile) { profiles.set(userId, profile); return profile; },
    async saveGuestImport(userId, record) {
      const current = profiles.get(userId);
      const existing = (current && Array.isArray(current.imports)) ? current.imports : [];
      const profile = current || { id: userId, userId };
      profile.imports = existing.concat(record).slice(-10);
      profiles.set(userId, profile);
      return record;
    },
    async saveAuditEvent(entry) {
      auditEntries.push(entry);
      if (auditEntries.length > 10000) auditEntries.shift();
      return entry;
    },
  };
}

/**
 * Submission-only sink (log-and-return in dev, throwing when unconfigured).
 * Retained for backward compatibility / simple callers.
 */
function createStore(envOpts) {
  const env = envOpts || process.env;
  if (env.COSMOS_CONNECTION_STRING || (env.COSMOS_ENDPOINT && env.COSMOS_KEY)) {
    const s = createCosmosStore(env);
    return async function storeSubmission(submission) {
      return s.storeSubmission(submission);
    };
  }
  if (env.DEV_NO_STORE === 'true' || env.AZURE_FUNCTIONS_ENVIRONMENT === 'Development') {
    return createMemoryStore().storeSubmission;
  }
  return async function storeSubmission() {
    throw new Error('Storage is not configured. Set COSMOS_CONNECTION_STRING ' +
      '(or COSMOS_ENDPOINT + COSMOS_KEY), or set DEV_NO_STORE=true for local dev.');
  };
}

/** Preferred entry point for handlers: full data store object. */
function createDataStore(envOpts) {
  const env = envOpts || process.env;
  if (env.COSMOS_CONNECTION_STRING || (env.COSMOS_ENDPOINT && env.COSMOS_KEY)) {
    return createCosmosStore(env);
  }
  if (env.DEV_NO_STORE === 'true' || env.AZURE_FUNCTIONS_ENVIRONMENT === 'Development') {
    return createMemoryStore();
  }
  throw new Error('Storage is not configured. Set COSMOS_CONNECTION_STRING ' +
    '(or COSMOS_ENDPOINT + COSMOS_KEY), or set DEV_NO_STORE=true for local dev.');
}

module.exports = { createStore, createDataStore, createMemoryStore, createCosmosStore };