'use strict';

/**
 * Azure Functions HTTP trigger: /api/profile{/*}
 * Thin adapter around the framework-agnostic profile handlers, mirroring the
 * submit adapter. Routes:
 *   GET  /api/profile        -> caller's onboarding profile
 *   POST /api/profile        -> save onboarding profile
 *   POST /api/profile/import -> record explicit guest-data import
 */

const { app } = require('@azure/functions');
const { createDataStore } = require('../store');
const auth = require('../auth');
const { requestMeta } = require('../http-utils');
const {
  getProfileHandler,
  saveProfileHandler,
  importProfileHandler,
} = require('../profile-handler');

const limiter = auth.limiterFor(process.env, { max: 60, windowMs: 60000 });

function responder(handler) {
  return async (request, context) => {
    const store = createDataStore();
    const principal = auth.parsePrincipal(request.headers.get('x-ms-client-principal'));
    const logger = {
      error: (m) => context.log.error(m),
      info: (m) => context.log.info(m),
    };
    const audit = auth.createAuditor({
      logger,
      persist: store && typeof store.saveAuditEvent === 'function'
        ? (entry) => store.saveAuditEvent(entry)
        : null,
    });
    const meta = requestMeta(request);
    const rate = limiter.check(auth.rateKey(principal, meta));
    if (!rate.ok) {
      return {
        status: 429,
        jsonBody: { error: 'too_many_requests' },
        headers: { 'Retry-After': String(Math.max(1, Math.ceil(rate.retryAfterMs / 1000))) },
      };
    }
    try {
      const bodyBuffer = Buffer.from(await request.arrayBuffer());
      const result = await handler({
        bodyText: bodyBuffer.toString('utf8'),
        bodyBuffer,
        principal,
        requestMeta: meta,
        store,
        env: process.env,
        logger,
        audit,
      });
      return { status: result.status, jsonBody: result.body, headers: result.headers };
    } catch (err) {
      context.log.error('profile handler threw: ' + (err && err.message));
      return { status: 500, jsonBody: { error: 'Internal error.' } };
    }
  };
}

app.http('profile', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'profile',
  handler: responder(async (opts) => {
    if (String(opts.requestMeta.method).toUpperCase() === 'GET') {
      return getProfileHandler(opts);
    }
    return saveProfileHandler(opts);
  }),
});

app.http('profileImport', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'profile/import',
  handler: responder(importProfileHandler),
});