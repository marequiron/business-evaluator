'use strict';

/**
 * localauth-lib.js
 * Shared plumbing for the local managed-mode auth servers — the persona mock
 * (scripts/mock-swauth.js) and the real GitHub OAuth login
 * (scripts/github-swauth.js):
 *   - static file serving on top of serve.js
 *   - the runtime `js/data.js` rewrite that turns MANAGED_ACCESS on without
 *     ever touching the on-disk file
 *   - small HTTP / cookie helpers.
 */

const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');

function createStaticServer(rootDir) {
  return require('../serve.js').createServer(rootDir || ROOT);
}

/**
 * Rewrite a copy of js/data.js so MANAGED_ACCESS is enabled, mirroring the
 * config used by real SWA-managed deployments. The on-disk file is never
 * modified.
 *   enabled           -> MANAGED_ACCESS.enabled = true
 *   tenantId          -> allowedTenantId set (Entra mock: "mock-tenant").
 *                        Leave empty for an IdP without a tenant claim
 *                        (GitHub OAuth — the tenant gate then passes freely).
 *   allowGuestImport  -> surface the one-time guest-import offer on onboarding
 *                        (equivalent of ALLOW_IMPORTS=true at the API).
 *   submitApiUrl      -> SUBMIT_FORM.apiUrl -> the local /api/submit endpoint
 *                        so the real submit flow can be exercised.
 */
function managedDataScript(source, opts) {
  const o = opts || {};
  let out = String(source);
  out = out.replace('  enabled: false,', '  enabled: true,');
  if (o.tenantId) {
    out = out.replace('  allowedTenantId: "",', '  allowedTenantId: "' + o.tenantId + '",');
  }
  if (o.allowGuestImport) {
    out = out.replace('  allowGuestImport: false', '  allowGuestImport: true');
  }
  if (o.submitApiUrl) {
    out = out.replace('const SUBMIT_FORM = {\n  apiUrl: "",', 'const SUBMIT_FORM = {\n  apiUrl: "' + o.submitApiUrl + '",');
  }
  return out;
}

function urlPath(req) {
  return String(req.url || '/').split('?')[0];
}

function queryOf(req) {
  const q = String(req.url || '').split('?')[1];
  const out = {};
  if (q) {
    q.split('&').forEach((pair) => {
      const idx = pair.indexOf('=');
      const k = idx === -1 ? pair : pair.slice(0, idx);
      const v = idx === -1 ? '' : pair.slice(idx + 1);
      if (k) out[decodeURIComponent(k)] = decodeURIComponent(v);
    });
  }
  return out;
}

function parseCookie(str) {
  const out = {};
  String(str || '').split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = decodeURIComponent(part.slice(idx + 1).trim());
    if (k) out[k] = v;
  });
  return out;
}

function cookieHeader(name, value, opts) {
  let h = name + '=' + encodeURIComponent(value || '') + '; Path=/; HttpOnly; SameSite=Lax';
  if (opts && opts.maxAge) h += '; Max-Age=' + Number(opts.maxAge);
  return h;
}

function clearCookieHeader(name) {
  return name + '=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0';
}

function readBody(req, maxBytes) {
  return readBuffered(req, maxBytes).then((buf) => buf.toString('utf8'));
}

function readBodyBuffer(req, maxBytes) {
  return readBuffered(req, maxBytes);
}

function readBuffered(req, maxBytes) {
  const limit = maxBytes || 512 * 1024;
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        const err = new Error('body_too_large');
        req.destroy();
        reject(err);
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/**
 * Write response headers, emitting each Set-Cookie as its OWN header when an
 * array is given. Browsers can (and sometimes do) discard a single
 * comma-joined `Set-Cookie: a, b` header, so we never rely on that form.
 * NOTE: headers must be set BEFORE writeHead — Node 24 flushes the header
 * block as soon as writeHead runs, so any append after it throws
 * ERR_HTTP_HEADERS_SENT.
 */
function sendHeaders(res, status, headers) {
  const rest = Object.assign({}, headers || {});
  const cookies = rest['Set-Cookie'];
  delete rest['Set-Cookie'];
  if (cookies !== undefined) {
    const list = Array.isArray(cookies) ? cookies : [cookies];
    list.forEach((c) => res.appendHeader('Set-Cookie', c));
  }
  res.writeHead(status, rest);
}

function json(res, status, body, extraHeaders) {
  const data = Buffer.from(JSON.stringify(body), 'utf8');
  sendHeaders(res, status, Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': data.length,
  }, extraHeaders || {}));
  res.end(data);
}

function redirect(res, to, extraHeaders) {
  sendHeaders(res, 302, Object.assign({ Location: to }, extraHeaders || {}));
  res.end();
}

function html(res, status, title, bodyHtml, extraHeaders) {
  const data = Buffer.from(
    '<!doctype html><html><head><meta charset="utf-8"><title>' + title +
    '</title><style>body{font-family:system-ui,sans-serif;max-width:640px;margin:48px auto;padding:0 16px;line-height:1.5}' +
    'a{color:#0b57d0}</style></head><body><h1>' + title + '</h1>' +
    bodyHtml + '</body></html>',
    'utf8');
  sendHeaders(res, status, Object.assign({
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': data.length,
  }, extraHeaders || {}));
  res.end(data);
}

/** Serve a runtime-rewritten copy of js/data.js (MANAGED_ACCESS on). */
function serveManagedData(req, res, opts) {
  fs.readFile(path.join(ROOT, 'js/data.js'), (err, buf) => {
    if (err) {
      json(res, 404, { error: 'not_found' });
      return;
    }
    const rewritten = managedDataScript(buf.toString('utf8'), opts || {});
    res.writeHead(200, {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Content-Length': Buffer.byteLength(rewritten),
    });
    res.end(rewritten);
  });
}

module.exports = {
  ROOT,
  createStaticServer,
  managedDataScript,
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
};