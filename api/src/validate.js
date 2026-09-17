'use strict';

/**
 * validate.js
 * Pure, dependency-free validation of a submitted evaluation payload.
 * Kept separate from the Azure bindings so it can be unit-tested without
 * installing any packages.
 *
 * Contract (mirrors the front-end's buildSubmissionPayload()):
 *   {
 *     language: "simple" | "standard",
 *     categories: [                       // exactly 8, one per assessment category
 *       { id, label, score, band }        // score: number 0-5, or null when band === "unanswered"
 *     ]
 *   }
 */

const MAX_BODY_BYTES = 10 * 1024; // 10 KB

const ALLOWED_LANGUAGES = new Set(['simple', 'standard']);
const ALLOWED_BANDS = new Set(['weakness', 'opportunity', 'strength', 'unanswered']);
const REQUIRED_CATEGORY_COUNT = 8;
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

module.exports = { validateSubmit, MAX_BODY_BYTES };