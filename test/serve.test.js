'use strict';

/**
 * serve.test.js
 * Behavior tests for the hardened local static server (serve.js).
 * Plain Node, no dependencies — matches the other repos' tests (`npm test`).
 *
 * Covers the security baseline:
 *   - default binding is 127.0.0.1 (verified by spawning serve.js directly)
 *   - path traversal above the repo root -> 403
 *   - malformed percent-encoding -> 400 (must not crash the server)
 *   - security headers present on responses
 *   - the Node `Server` banner header is not leaked
 */

const { spawn } = require('child_process');
const http = require('http');
const net = require('net');
const path = require('path');
const assert = require('assert');

const { createServer } = require('../serve');
const ROOT = path.join(__dirname, '..');

let passed = 0;
let failed = 0;

function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { passed += 1; console.log('PASS: ' + name); })
    .catch((e) => { failed += 1; console.error('FAIL: ' + name); console.error('  ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join('\n  ') : e)); });
}

function request(server, urlPath) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const req = http.request({
      host: '127.0.0.1',
      port: addr.port,
      path: urlPath,
      method: 'GET',
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.end();
  });
}

function startServer() {
  return new Promise((resolve, reject) => {
    const server = createServer(ROOT);
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

function waitForLine(child, pattern, timeoutMs) {
  return new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => { cleanup(); reject(new Error('timed out waiting for startup line')); }, timeoutMs);
    function onData(chunk) {
      buf += chunk.toString();
      const m = buf.match(pattern);
      if (m) { cleanup(); resolve(m); }
    }
    function onError(err) { cleanup(); reject(err); }
    function cleanup() {
      clearTimeout(timer);
      child.stdout.removeListener('data', onData);
      child.removeListener('error', onError);
    }
    child.stdout.on('data', onData);
    child.on('error', onError);
  });
}

function settle(server) {
  return new Promise((resolve) => server.close(resolve));
}

const main = () => Promise.all([

  test('server.get("/") serves the app shell with 200', async () => {
    const server = await startServer();
    try {
      const res = await request(server, '/');
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.length > 0);
      assert.ok(/<!doctype html/i.test(res.body));
      assert.ok(/text\/html/.test(res.headers['content-type']));
    } finally { await settle(server); }
  }),

  test('missing file -> 404', async () => {
    const server = await startServer();
    try {
      const res = await request(server, '/no-such-file-xyz.html');
      assert.strictEqual(res.status, 404);
    } finally { await settle(server); }
  }),

  test('path traversal above repo root -> 403', async () => {
    const server = await startServer();
    try {
      const encoded = '/' + '%2e%2e' + '/' + '%2e%2e' + '/serve.js';
      const res = await request(server, encoded);
      assert.strictEqual(res.status, 403);
      const raw = await request(server, '/../serve.js');
      assert.strictEqual(raw.status, 403);
    } finally { await settle(server); }
  }),

  test('malformed percent-encoding -> 400 and server keeps running', async () => {
    const server = await startServer();
    try {
      const res = await request(server, '/%zz%');
      assert.strictEqual(res.status, 400);
      const after = await request(server, '/');
      assert.strictEqual(after.status, 200, 'server must survive a malformed URL');
    } finally { await settle(server); }
  }),

  test('responses carry security headers', async () => {
    const server = await startServer();
    try {
      const res = await request(server, '/');
      assert.ok(/content-security-policy/i.test(Object.keys(res.headers).join(',')));
      assert.strictEqual(res.headers['x-content-type-options'], 'nosniff');
      assert.strictEqual(res.headers['referrer-policy'], 'strict-origin-when-cross-origin');
      assert.strictEqual(res.headers['x-frame-options'], 'DENY');
      assert.strictEqual(res.headers['server'], undefined, 'must not leak a Server banner');
    } finally { await settle(server); }
  }),

  test('default bind (no HOST) is 127.0.0.1', async () => {
    const port = await freePort();
    const env = Object.assign({}, process.env, { PORT: String(port) });
    delete env.HOST;
    const child = spawn(process.execPath, ['serve.js'], {
      cwd: ROOT,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    try {
      const m = await waitForLine(child, new RegExp('http://127\\.0\\.0\\.1:' + port + '/'), 8000);
      assert.ok(m, 'startup banner should advertise the localhost URL');
      const res = await request({ address: () => ({ port }) }, '/');
      assert.strictEqual(res.status, 200, 'server must be reachable on localhost');
    } finally {
      child.kill();
      await new Promise((r) => child.on('exit', r));
    }
  }),

]);

main().then(() => {
  console.log('');
  console.log(passed + ' passed, ' + failed + ' failed (serve)');
  if (failed > 0) process.exit(1);
});