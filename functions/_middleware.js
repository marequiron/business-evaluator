/**
 * functions/_middleware.js
 * Runs before every request handled by the Worker (requires
 * "run_worker_first": true in wrangler.jsonc so it also runs for static
 * assets, not just /api routes).
 *
 * Forces every response to be served with Cache-Control: no-store so
 * Cloudflare's edge never caches stale copies of the site. Without this, the
 * CDN can keep serving an old index.html/css/js after a deploy until a cache
 * purge — which is unavailable on a bare workers.dev domain.
 */

const NO_BODY_STATUS = new Set([101, 204, 205, 304]);

export async function onRequest(context) {
  const response = await context.next();
  if (!response || !(response instanceof Response)) return response;

  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store");

  return new Response(NO_BODY_STATUS.has(response.status) ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}