'use strict';

/**
 * Azure Functions HTTP trigger: POST /api/submit
 * Thin adapter around the framework-agnostic handleSubmit(). Reads the SWA
 * provided identity header, delegates, and maps the result to an HTTP
 * response. All validation/storage lives in src/handler.js + src/store.js.
 */

const { app } = require('@azure/functions');
const { handleSubmit } = require('../handler');
const { createStore } = require('../store');

app.http('submit', {
  methods: ['POST'],
  authLevel: 'anonymous', // SWA layer handles access; we enforce roles in handler
  route: 'submit',
  handler: async (request, context) => {
    const store = createStore();
    const principal = parsePrincipal(request);
    const logger = {
      error: (m) => context.log.error(m),
      info: (m) => context.log.info(m),
    };

    try {
      const result = await handleSubmit({
        bodyText: await request.text(),
        principal,
        store,
        env: process.env,
        log: logger,
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

/**
 * Azure Static Web Apps injects the authenticated user as the base64-encoded
 * x-ms-client-principal header. If the SWA header is URL-safe base64, swap
 * the characters back before decoding.
 */
function parsePrincipal(request) {
  const raw = request.headers.get('x-ms-client-principal');
  if (!raw) return null;
  try {
    const normalized = raw.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(Buffer.from(normalized, 'base64').toString('utf8'));
    return {
      identityProvider: decoded.identityProvider || null,
      userId: decoded.userId || decoded.userDetails || null,
      userDetails: decoded.userDetails || null,
      userRoles: Array.isArray(decoded.userRoles) ? decoded.userRoles : [],
    };
  } catch (e) {
    return null;
  }
}