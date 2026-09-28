'use strict';

/**
 * store.cosmos.test.js
 * Plain-Node unit tests for the Cosmos store path (api/src/store.js). No
 * packages needed: run `npm test` (or `node test/store.cosmos.test.js`) from
 * the api/ folder.
 *
 * These tests use a FAKE `@azure/cosmos` client (injected by patching
 * Module._load), because the real client is a heavy Azure dependency and the
 * app also ships a Zero-install single-file build. They pin the exact Cosmos
 * DOCUMENT SHAPES the deployments rely on â€” most crucially that every written
 * item carries an `id` (partition key /id), which the memory-store tests
 * cannot catch.
 */

const assert = require('assert');
const Module = require('module');

const ops = { created: [], upserted: [], read: [], stores: { submissions: [], users: [], audit: [] } };

class FakeItems {
  constructor(containerName) { this.name = containerName; }
  async create(doc) {
    ops.created.push({ name: this.name, doc });
    return { resource: doc };
  }
  async upsert(doc) {
    ops.upserted.push({ name: this.name, doc });
    const arr = ops.stores[this.name];
    const i = arr.findIndex((d) => d.id === doc.id);
    if (i === -1) arr.push(doc); else arr[i] = doc;
    return { resource: doc };
  }
}

class FakeContainer {
  constructor(name) { this.name = name; this.items = new FakeItems(name); }
  item(id, partitionKeyValue) {
    ops.read.push({ name: this.name, id, partitionKeyValue });
    return {
      read: async () => {
        const hit = ops.stores[this.name].find((d) => d.id === id);
        if (hit) return { resource: hit };
        const e = new Error('Resource not found');
        e.code = 404;
        throw e;
      },
    };
  }
}

class FakeDatabase {
  container(name) { return new FakeContainer(name); }
}

class FakeCosmosClient {
  constructor(opts) { this.clientOpts = opts; }
  database() { return new FakeDatabase(); }
}

const realLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '@azure/cosmos') return { CosmosClient: FakeCosmosClient };
  return realLoad.call(this, request, parent, isMain);
};

const { createCosmosStore } = require('../src/store');

let passed = 0;
let failed = 0;

function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { passed += 1; console.log('PASS: ' + name); })
    .catch((err) => {
      failed += 1;
      console.error('FAIL: ' + name);
      console.error('  ' + (err && err.stack || err && err.message));
    });
}

function fresh() {
  ops.created.length = 0;
  ops.upserted.length = 0;
  ops.read.length = 0;
  ops.stores.submissions.length = 0;
  ops.stores.users.length = 0;
  ops.stores.audit.length = 0;
  return createCosmosStore({ COSMOS_ENDPOINT: 'https://fake.example', COSMOS_KEY: 'fake' });
}

(async function () {
  await test('cosmos store: storeSubmission writes an id (from submissionId) and the full doc', async () => {
    const s = fresh();
    const submission = { schemaVersion: 1, language: 'simple', submissionId: 'sub-1', principal: 'u1' };
    const result = await s.storeSubmission(submission);
    assert.strictEqual(result.stored, true);
    assert.strictEqual(ops.created.length, 1);
    assert.strictEqual(ops.created[0].name, 'submissions');
    assert.strictEqual(ops.created[0].doc.id, 'sub-1');
    assert.deepStrictEqual(
      ops.created[0].doc.categories, undefined,
      'categories field should be untouched');
    assert.strictEqual(ops.created[0].doc.principal, 'u1');
  });

  await test('cosmos store: rejects a submission that has no id at all', async () => {
    const s = fresh();
    await assert.rejects(() => s.storeSubmission({ language: 'simple' }), /without an id/);
    assert.strictEqual(ops.created.length, 0);
  });

  await test('cosmos store: saveProfile upserts with the id preserved', async () => {
    const s = fresh();
    const profile = { id: 'u7', userId: 'u7', displayName: 'Pat', language: 'simple' };
    const saved = await s.saveProfile('u7', profile);
    assert.strictEqual(ops.upserted.length, 1);
    assert.strictEqual(ops.upserted[0].name, 'users');
    assert.strictEqual(ops.upserted[0].doc.id, 'u7');
    assert.strictEqual(saved.id, 'u7');
  });

  await test('cosmos store: saveGuestImport appends imports (max 10) and keeps the id', async () => {
    const s = fresh();
    const existing = { id: 'u7', userId: 'u7', displayName: 'Pat' };
    for (let i = 0; i < 9; i += 1) existing.imports = (existing.imports || []).concat({ i });
    ops.stores.users.push(existing);

    await s.saveGuestImport('u7', { kind: 'guest-import', itemCount: 3, importedAt: 'now' });
    assert.strictEqual(ops.upserted.length, 1);
    const doc = ops.upserted[0].doc;
    assert.strictEqual(doc.id, 'u7');
    assert.strictEqual(doc.imports.length, 10);
    assert.strictEqual(doc.imports[9].itemCount, 3);
  });

  await test('cosmos store: saveAuditEvent creates an audit item with an id', async () => {
    const s = fresh();
    await s.saveAuditEvent({ event: 'submit.accepted', userId: 'u1', timestamp: 't' });
    assert.strictEqual(ops.created.length, 1);
    const doc = ops.created[0].doc;
    assert.strictEqual(ops.created[0].name, 'audit');
    assert.strictEqual(typeof doc.id, 'string');
    assert.ok(doc.id.length > 0);
    assert.strictEqual(doc.event, 'submit.accepted');
  });

  await test('cosmos store: getProfile reads with (userId, userId) partition key and maps 404 to null', async () => {
    const s = fresh();
    const missing = await s.getProfile('ghost');
    assert.strictEqual(missing, null);
    assert.strictEqual(ops.read.length, 1);
    assert.strictEqual(ops.read[0].name, 'users');
    assert.strictEqual(ops.read[0].id, 'ghost');
    assert.strictEqual(ops.read[0].partitionKeyValue, 'ghost');

    ops.stores.users.push({ id: 'u8', userId: 'u8', displayName: 'Kim' });
    const found = await s.getProfile('u8');
    assert.strictEqual(found.displayName, 'Kim');
  });

  await test('cosmos store: env container names are honored', async () => {
    ops.created.length = 0;
    const s = createCosmosStore({
      COSMOS_ENDPOINT: 'https://fake.example',
      COSMOS_KEY: 'fake',
      COSMOS_DATABASE: 'db-x',
      COSMOS_CONTAINER: 'boxes',
      COSMOS_USERS_CONTAINER: 'people',
      COSMOS_AUDIT_CONTAINER: 'log',
    });
    await s.storeSubmission({ submissionId: 's-9', language: 'simple' });
    await s.saveAuditEvent({ event: 'x' });
    const names = ops.created.map((r) => r.name).sort();
    assert.deepStrictEqual(names, ['boxes', 'log']);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();