'use strict';

/**
 * app.smoke.test.js
 * jsdom smoke test for the assembled app (data.js + analyzer + app.js) so the
 * same front-end the Tauri wrapper ships is exercised headlessly in CI.
 *
 * Run: node test/app.smoke.test.js  (part of `npm test`)
 * Requires the jsdom devDependency (dev-only; no runtime cost).
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');

let passed = 0;
let failed = 0;

function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { passed += 1; console.log('PASS: ' + name); })
    .catch((err) => {
      failed += 1;
      console.error('FAIL: ' + name);
      console.error('  ' + (err && err.stack ? err.stack.split('\n').slice(0, 3).join('\n  ') : err));
    });
}

function makeApp() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
    .replace(/<script src="js\/(data|analyzer-parse|analyzer|app)\.js"><\/script>/g, (m, name) => {
      const code = fs.readFileSync(path.join(ROOT, 'js', name + '.js'), 'utf8')
        .replace(/<\/script>/g, '<\\/script>');
      return `<script>${code}<\/script>`;
    })
    .replace(/<script src="[^"]+"><\/script>/g, '');

  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'http://localhost/index.html',
    pretendToBeVisual: true,
  });
  const w = dom.window;

  w.Element.prototype.scrollIntoView = function () {};
  w.alert = () => {};
  w.confirm = () => true;
  w.prompt = () => '';
  w.URL.createObjectURL = () => 'blob:smoke';
  w.URL.revokeObjectURL = () => {};
  const opened = [];
  w.open = (url) => { opened.push(url); return null; };
  const copied = [];
  Object.defineProperty(w.navigator, 'clipboard', {
    configurable: true,
    value: { writeText: (t) => { copied.push(t); return Promise.resolve(); } },
  });

  w.document.dispatchEvent(new w.Event('DOMContentLoaded', { bubbles: true }));

  // const/let globals (CATEGORIES, SUBMIT_FORM, ANALYZE, state, ...) live in
  // the global LEXICAL scope, not on window. Resolve them via the realm.
  const read = (name) => w.eval(name);

  return { dom: dom, w: w, read: read, opened: opened, copied: copied };
}

function totalQuestions(cats) {
  return cats.reduce((n, c) => n + c.questions.length, 0);
}

function fillAll(w, value) {
  const inputs = w.document.querySelectorAll('#assessment-form input[type=radio]');
  let n = 0;
  inputs.forEach((inp) => {
    if (inp.value === String(value)) { inp.click(); n += 1; }
  });
  return n;
}

function lastGroupName(w, resultsEl, text) {
  const candidates = Array.from(resultsEl.querySelectorAll('h2, h3, .group-title'));
  return candidates.some((el) => el.textContent.includes(text));
}

(async () => {
  await test('renders 8 categories with all questions', () => {
    const { w, read } = makeApp();
    const cats = read('CATEGORIES');
    assert.strictEqual(cats.length, 8, 'expected 8 categories');
    const cards = w.document.querySelectorAll('#assessment-form .category-card');
    assert.strictEqual(cards.length, 8);
    const radios = w.document.querySelectorAll('#assessment-form input[type=radio]');
    assert.strictEqual(radios.length, totalQuestions(cats) * 5, 'expected 5 radios per question');
  });

  await test('evaluate computes bands and renders groups + auto-saves snapshot', () => {
    const { w, read } = makeApp();
    const filled = fillAll(w, 3);
    const questions = totalQuestions(read('CATEGORIES'));
    assert.strictEqual(filled, questions, 'fillAll should set one value per question');

    w.document.getElementById('evaluate-btn').click();
    const resultsEl = w.document.getElementById('results');
    assert.ok(resultsEl.innerHTML.includes('Score Overview'), 'chart should render');
    assert.ok(lastGroupName(w, resultsEl, 'Opportunities'), 'all-3.0 average is in the Opportunity band');

    const payload = read('buildSubmissionPayload')();
    assert.strictEqual(payload.categories.length, 8);
    payload.categories.forEach((c) => {
      assert.strictEqual(c.score, 3, c.id + ' avg should be 3.0');
      assert.strictEqual(c.band, 'opportunity', c.id + ' band should be opportunity');
    });

    const historyText = w.document.getElementById('history-list').textContent;
    assert.ok(historyText.includes('Past snapshots (1)'), 'evaluate should auto-save one snapshot');
    const saved = JSON.parse(w.localStorage.getItem('business-evaluator-history-v1'));
    assert.strictEqual(saved.length, 1);
    assert.strictEqual(saved[0].scores.length, 8);
  });

  await test('answers persist to localStorage', () => {
    const { w, read } = makeApp();
    fillAll(w, 5);
    const raw = JSON.parse(w.localStorage.getItem('business-evaluator-answers-v1'));
    const keys = Object.keys(raw);
    assert.strictEqual(keys.length, totalQuestions(read('CATEGORIES')));
    keys.forEach((k) => assert.strictEqual(raw[k], 5));
  });

  await test('info overlay opens, toggles, and closes on Escape', () => {
    const { w } = makeApp();
    const btn = w.document.querySelector('.info-btn');
    assert.ok(btn, 'questions with a `simple` field should render a plain-language button');
    btn.click();
    const overlay = w.document.getElementById('info-overlay');
    assert.strictEqual(overlay.hidden, false, 'overlay should open');
    assert.ok(overlay.textContent.trim().length > 0);
    btn.click();
    assert.strictEqual(overlay.hidden, true, 'overlay should toggle closed');
    btn.click();
    w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.strictEqual(overlay.hidden, true, 'overlay should close on Escape');
  });

  await test('snapshot save + export history produces JSON', () => {
    const { w, read } = makeApp();
    fillAll(w, 4);
    w.document.getElementById('evaluate-btn').click();
    assert.ok(read('loadHistory')().length >= 1);

    const downloads = [];
    w.HTMLAnchorElement.prototype.click = function () {
      if (this.download) downloads.push(this.download);
    };

    read('exportHistoryJson')();
    assert.ok(downloads.includes('business-evaluator-history.json'));
    read('exportResults')();
    assert.ok(downloads.includes('business-evaluation-results.txt'));
  });

  await test('submitResults falls back to clipboard + window.open with no apiUrl', async () => {
    const { w, read, opened, copied } = makeApp();
    fillAll(w, 2);
    w.document.getElementById('evaluate-btn').click();
    assert.strictEqual(read('SUBMIT_FORM').apiUrl, '', 'test fixture assumes apiUrl empty');
    w.document.getElementById('submit-btn').click();
    await new Promise((r) => setTimeout(r, 20));
    assert.strictEqual(copied.length, 1, 'results should be copied to clipboard');
    assert.ok(copied[0].includes('BUSINESS SELF-EVALUATION RESULTS'));
    assert.strictEqual(opened.length, 0, 'no formUrl -> nothing opened in a new tab');
  });

  await test('reset clears answers and results', () => {
    const { w, read } = makeApp();
    fillAll(w, 1);
    const answers = Object.keys(JSON.parse(w.localStorage.getItem('business-evaluator-answers-v1')));
    assert.ok(answers.length > 0, 'answers exist before reset');
    w.document.getElementById('reset-btn').click();
    assert.strictEqual(Object.keys(read('state').answers).length, 0);
    assert.strictEqual(w.localStorage.getItem('business-evaluator-answers-v1'), '{}');
    assert.strictEqual(w.document.getElementById('results').innerHTML, '');
  });

  await test('mock analyzer flow: analyze -> review -> apply selected', async () => {
    const { w, read } = makeApp();
    const ANALYZE = read('ANALYZE');
    const CATEGORIES = read('CATEGORIES');
    ANALYZE.provider = 'mock';
    ANALYZE.mockSuggestions = [
      { id: CATEGORIES[0].id, score: 4, rationale: 'Looks healthy.' },
      { id: CATEGORIES[1].id, score: 2, rationale: 'Needs work.' },
    ];

    const input = w.document.getElementById('analyze-file');
    const file = new w.File(['finance and marketing notes for the business plan.'], 'notes.txt', { type: 'text/plain' });
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });

    w.document.getElementById('analyze-btn').click();

    for (let i = 0; i < 50; i += 1) {
      await new Promise((r) => setTimeout(r, 10));
      if (w.document.querySelectorAll('#analyze-results input[data-category]').length) break;
    }

    const rows = w.document.querySelectorAll('#analyze-results input[data-category]');
    assert.strictEqual(rows.length, 2, 'two suggestions should render as review rows');
    assert.ok(rows[0].checked, 'a usable suggestion starts checked');

    w.document.querySelector('#analyze-results button[type=button]').click();
    await new Promise((r) => setTimeout(r, 10));

    const answers = JSON.parse(w.localStorage.getItem('business-evaluator-answers-v1'));
    const firstCatKeys = CATEGORIES[0].questions.map((_, i) => CATEGORIES[0].id + '__' + i);
    firstCatKeys.forEach((k) => assert.strictEqual(answers[k], 4, k + ' should be set by apply'));
    assert.ok(w.document.getElementById('analyze-status-text').textContent.includes('Applied'), 'status should confirm the apply');
  });

  await test('app loaded from the synced bundle also assembles (8 categories)', () => {
    const dist = path.join(ROOT, 'src-tauri', 'app-dist', 'index.html');
    assert.ok(fs.existsSync(dist), 'src-tauri/app-dist/index.html must exist (run npm run app:sync)');
    const html = fs.readFileSync(dist, 'utf8').replace(/<script src="[^"]+"><\/script>/g, '');
    const dom = new JSDOM(html, { url: 'http://localhost/index.html', pretendToBeVisual: true });
    assert.strictEqual(dom.window.document.querySelectorAll('#assessment-form').length, 1);
  });

  console.log('');
  console.log(passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
})().catch((err) => {
  console.error('Smoke suite crashed:', err);
  process.exit(1);
});