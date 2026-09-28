'use strict';

/**
 * Azure Functions HTTP trigger: POST /api/submit
 * Thin adapter around the framework-agnostic handleSubmit(). Reads the SWA
 * client principal header (auth.js), delegates, and maps the result to an
 * HTTP response. Path + role checks are explicit — the SWA front gate may
 * carry routes/roles, but the backend enforces them regardless.
 */

const { app } = require('@azure/functions');
const { handleSubmit } = require('../handler');
const { createDataStore } = require('../store');
const auth = require('../auth');
const { requestMeta } = require('../http-utils');

const limiter = auth.limiterFor(process.env, { max: 20, windowMs: 60000 });

app.http('submit', {
  methods: ['POST'],
  authLevel: 'anonymous', // SWA layer handles access; we enforce roles in handler
  route: 'submit',
  handler: async (request, context) => {
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

    try {
      const result = await handleSubmit({
        bodyText: await request.text(),
        principal,
        store,
        env: process.env,
        log: logger,
        audit,
        limiter,
        requestMeta: requestMeta(request),
      });
      return {
        status: result.status,
        jsonBody: result.body,
        headers: result.headers,
      };
    } catch (err) {
      context.log.error('submit handler threw: ' + (err && err.message));
      return {
        status: 500,
        jsonBody: { error: 'Internal error.' },
      };
    }
  },
});