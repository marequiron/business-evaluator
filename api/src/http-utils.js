'use strict';

/**
 * http-utils.js
 * Tiny shared helpers for HTTP adapters and handlers.
 */

function json(status, body, headers) {
  const h = { 'Content-Type': 'application/json' };
  Object.assign(h, headers || {});
  return { status, headers: h, body };
}

/** Parse and sanitize the origin/Sec-Fetch-Site/IP envelope for handlers. */
function requestMeta(request) {
  if (!request) return { method: 'GET' };
  const forwarded = request.headers.get('x-forwarded-for') || '';
  return {
    method: String(request.method || 'GET').toUpperCase(),
    origin: request.headers.get('origin') || '',
    secFetchSite: request.headers.get('sec-fetch-site') || '',
    ip: forwarded ? String(forwarded).split(',')[0].trim() : '',
  };
}

module.exports = { json, requestMeta };