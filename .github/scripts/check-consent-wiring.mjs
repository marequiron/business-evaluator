/**
 * .github/scripts/check-consent-wiring.mjs
 * Cheap structural guard (plain Node, no DOM) that the consent gate UI is
 * fully wired: the checkbox/block exist in index.html, app.js hooks of
 * consent-block, and data.js defines SUBMIT_FORM.consentText.
 * Run by ci.yml. Fails loudly if any piece is missing.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const fail = (msg) => {
  console.error('FAIL: ' + msg);
  process.exit(1);
};

const contains = (file, frag) => {
  const rel = path.relative(root, file);
  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes(frag)) fail(`${rel} must contain "${frag}"`);
  return true;
};

const indexHtml = path.join(root, 'public', 'index.html');
const appJs = path.join(root, 'public', 'js', 'app.js');
const dataJs = path.join(root, 'public', 'js', 'data.js');

contains(indexHtml, 'id="consent-block"');
contains(indexHtml, 'id="consent-checkbox"');
contains(indexHtml, 'id="consent-text"');

contains(appJs, 'setupConsentGate');
contains(appJs, 'getElementById("consent-block")');
contains(appJs, 'getElementById("consent-checkbox")');

contains(dataJs, 'consentText:');

console.log('OK: consent gate wiring is intact (index.html <-> app.js <-> data.js)');