/**
 * functions/api/submit.js
 * Cloudflare Pages Function: POST /api/submit
 *
 * Receives a submitted evaluation, validates it, stamps it, and persists it
 * to a Cloudflare KV namespace. Implements the same contract + failure
 * behaviour as the original Azure handler (see api/src/handler.js), but is
 * self-contained for Cloudflare Workers (ES module, no Node build step).
 *
 * Storage is delegated to a KV binding named SUBMISSIONS_KV (see wrangler.toml
 * / dashboard). When the binding is absent (local dev without config), it
 * falls back to log-and-ack so submissions are never silently dropped.
 */

const MAX_BODY_BYTES = 10 * 1024; // 10 KB

const ALLOWED_LANGUAGES = new Set(['simple', 'standard']);
const ALLOWED_BANDS = new Set(['weakness', 'opportunity', 'strength', 'unanswered']);
const REQUIRED_CATEGORY_COUNT = 7;
const MAX_SCORE = 5;
const MAX_LABEL_LENGTH = 120;

function reject(error, status) {
  return { ok: false, status: status || 400, error };
}

function validateSubmit(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return reject('Body must be a JSON object.');
  }

  if (typeof body.language !== 'string' || !ALLOWED_LANGUAGES.has(body.language)) {
    return reject('Missing or invalid "language" — must be "simple" or "standard".');
  }

  if (!Array.isArray(body.categories)) {
    return reject('"categories" must be an array.');
  }
  if (body.categories.length !== REQUIRED_CATEGORY_COUNT) {
    return reject(`"categories" must contain exactly ${REQUIRED_CATEGORY_COUNT} entries ` +
      `(one per assessment category), got ${body.categories.length}.`);
  }

  const seen = new Set();
  const categories = [];

  for (const entry of body.categories) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      return reject('Each category entry must be an object.');
    }

    const { id, label, score, band } = entry;

    if (typeof id !== 'string' || id.length === 0 || seen.has(id)) {
      return reject('Each category needs a unique, non-empty "id".');
    }
    seen.add(id);

    if (typeof band !== 'string' || !ALLOWED_BANDS.has(band)) {
      return reject(`Invalid "band" for "${id}".`);
    }

    if (band === 'unanswered') {
      if (score !== null && score !== undefined) {
        return reject(`Category "${id}" is "unanswered" but has a score — omit the score.`);
      }
    } else {
      if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > MAX_SCORE) {
        return reject(`Score for "${id}" must be a number between 0 and ${MAX_SCORE}.`);
      }
    }

    categories.push({
      id,
      label: typeof label === 'string' && label.length > 0
        ? label.slice(0, MAX_LABEL_LENGTH)
        : id,
      score: score === null || score === undefined ? null : Math.round(score * 10) / 10,
      band,
    });
  }

  return {
    ok: true,
    data: { language: body.language, categories },
  };
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestPost(context) {
  const { request, env, waitUntil } = context;

  if (request.method !== 'POST') {
    return json(405, { error: 'Method not allowed.' });
  }

  if (env.REQUIRE_AUTH === 'true') {
    return json(403, { error: 'You are not authorized to submit results.' });
  }

  const bodyText = await request.text();
  if (!bodyText || bodyText.trim().length === 0) {
    return json(400, { error: 'Empty request body.' });
  }
  if (bodyText.length > MAX_BODY_BYTES) {
    return json(413, { error: 'Payload too large.' });
  }

  let parsed;
  try {
    parsed = JSON.parse(bodyText);
  } catch (e) {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const result = validateSubmit(parsed);
  if (!result.ok) {
    return json(result.status || 400, { error: result.error });
  }

  const submission = {
    schemaVersion: 1,
    language: result.data.language,
    categories: result.data.categories,
    submissionId: crypto.randomUUID(),
    submittedAt: new Date().toISOString(),
  };

  const kv = env.SUBMISSIONS_KV;
  if (kv) {
    const storeResult = await kv.put(submission.submissionId, JSON.stringify(submission));
    if (storeResult !== undefined) {
      waitUntil(kv.put(`${submission.submissionId}:meta`, JSON.stringify({
        submittedAt: submission.submittedAt,
        language: submission.language,
      })));
    }
  } else if (env.DEV_NO_STORE === 'true' || env.ENVIRONMENT === 'development') {
    console.log('[dev] submission not persisted:', submission.submissionId);
  } else {
    return json(500, { error: 'Could not store submission.' });
  }

  return json(202, { id: submission.submissionId, stored: !!kv });
}

export { validateSubmit, MAX_BODY_BYTES };
