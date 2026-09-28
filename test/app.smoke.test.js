'use strict';

/**
 * app.smoke.test.js
 * jsdom smoke test for the assembled Coach app (data.js + scoring.js +
 * storage.js + analyzer + app.js) so the same front-end the Tauri wrapper
 * ships is exercised headlessly in CI.
 *
 * Run: node test/app.smoke.test.js  (part of `npm test`)
 * Requires the jsdom devDependency (dev-only; no runtime cost).
 *
 * Coverage for the current phase:
 *  - shell renders (nav tabs, panels) and navigation works
 *  - "About your business" profile step renders, validates, and persists
 *  - storage module round-trips (export/import/reset)
 *  - scoring integrates with real CATEGORIES + READINESS_LEVELS
 *  - on-device analyzer mock flow (analyze -> review -> apply) still works
 * Later phases extend this file (assessment, dashboard, actions, scenarios,
 * progress, backup/restore buttons).
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
    .replace(/<script src="js\/(data|scoring|storage|analyzer-parse|analyzer|app)\.js"><\/script>/g, (m, name) => {
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
  w.scrollTo = () => {};
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

  // const/let globals (CATEGORIES, PROFILE_FIELDS, ...) live in the global
  // LEXICAL scope, not on window. Resolve them via the realm.
  const read = (name) => w.eval(name);

  return { dom: dom, w: w, read: read, opened: opened, copied: copied };
}

/** Build a complete answers map from uniform per-question values per category. */
function fullAnswers(cats, value) {
  const answers = {};
  cats.forEach((cat) => {
    cat.questions.forEach((_, i) => { answers[cat.id + '__' + i] = value; });
  });
  return answers;
}

/** Complete profile used by persistence tests (all required fields set). */
function fullProfile() {
  return {
    businessName: 'Bluebird Bakery',
    industry: 'Food & beverage',
    stage: 'Growing',
    employeeRange: '2-5',
    mainGoal: 'Grow revenue by 20%',
    mainChallenge: 'Limited bookkeeping time'
  };
}

function submitProfile(w, values) {
  const form = w.document.getElementById('profile-form');
  Object.keys(values).forEach((key) => {
    const c = form.querySelector('[name="' + key + '"]');
    if (c) c.value = values[key];
  });
  form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
}

(async () => {
  await test('renders 8 categories and the 7 coach panels (data panel has no tab)', () => {
    const { w, read } = makeApp();
    const cats = read('CATEGORIES');
    assert.strictEqual(cats.length, 8, 'expected 8 categories');
    cats.forEach((c) => assert.ok(c.questions.length === 5, c.id + ' should have 5 questions'));

    const tabs = Array.from(w.document.querySelectorAll('#coach-nav .nav-tab'));
    assert.strictEqual(tabs.length, 7, 'expected 7 nav tabs');
    const tabIds = tabs.map((t) => t.getAttribute('data-tab'));
    assert.deepStrictEqual(tabIds, ["profile", "assessment", "dashboard", "action-plan", "roadmap", "scenarios", "progress"]);

    assert.ok(w.document.getElementById('panel-data'), 'backup/restore panel exists');
    assert.strictEqual(w.document.querySelectorAll('.panel').length, 8, '8 panels total');

    assert.ok(w.document.getElementById('analyze'), 'analyzer section survives');
  });

  await test('navigation switches the visible panel and aria-current', () => {
    const { w } = makeApp();
    assert.ok(w.document.getElementById('panel-profile').hidden === false, 'profile starts visible');

    w.document.querySelector('#coach-nav .nav-tab[data-tab="dashboard"]').click();

    assert.ok(w.document.getElementById('panel-profile').hidden, 'profile hides');
    assert.ok(w.document.getElementById('panel-dashboard').hidden === false, 'dashboard shows');
    const active = w.document.querySelector('.nav-tab[aria-current="true"]');
    assert.strictEqual(active.getAttribute('data-tab'), 'dashboard');
  });

  await test('profile step renders a field per PROFILE_FIELDS and personalizes the greeting', () => {
    const { w, read } = makeApp();
    const fields = read('PROFILE_FIELDS');
    const inputs = w.document.querySelectorAll('#profile-form input[type=text], #profile-form select');
    assert.strictEqual(inputs.length, fields.length, 'one control per profile field');

    submitProfile(w, fullProfile());

    const saved = JSON.parse(w.localStorage.getItem('coach-profile-v1'));
    assert.strictEqual(saved.businessName, 'Bluebird Bakery');
    assert.strictEqual(saved.industry, 'Food & beverage');
    assert.strictEqual(w.document.getElementById('greeting').textContent, 'Welcome, Bluebird Bakery');
    assert.ok(w.localStorage.getItem('coach-profile-v1'), 'greeting personalizes from saved profile');
  });

  await test('profile validation requires the required fields', () => {
    const { w, read } = makeApp();
    submitProfile(w, { businessName: 'Only a Name', industry: '' });
    const note = w.document.getElementById('profile-save-note');
    assert.ok(note.hidden === false, 'error note shows');
    assert.ok(note.textContent.includes('industry'), 'points at the missing field');
    assert.strictEqual(w.localStorage.getItem('coach-profile-v1'), null, 'nothing saved without required fields');
    assert.strictEqual(read('loadProfile')().businessName, '', 'profile stays empty');

    submitProfile(w, fullProfile());
    assert.strictEqual(read('loadProfile')().businessName, 'Bluebird Bakery', 'valid save now works');
  });

  await test('info overlay opens, toggles, and closes on Escape', () => {
    const { w, read } = makeApp();
    const btn = read('createInfoButton')('About readiness', 'Your readiness reflects your answers today.');
    w.document.getElementById('panel-profile').appendChild(btn);
    btn.click();

    const overlay = w.document.getElementById('info-overlay');
    assert.ok(overlay, 'overlay element created on first use');
    assert.strictEqual(overlay.hidden, false, 'overlay should open');
    assert.ok(overlay.textContent.trim().length > 0);

    btn.click();
    assert.strictEqual(overlay.hidden, true, 'overlay should toggle closed');

    btn.click();
    w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.strictEqual(overlay.hidden, true, 'overlay should close on Escape');
  });

  await test('storage export/import round-trips and reset clears Coach data', () => {
    const { w, read } = makeApp();
    submitProfile(w, fullProfile());

    const answers = fullAnswers(read('CATEGORIES'), 4);
    w.localStorage.setItem('coach-answers-v1', JSON.stringify(answers));

    const exported = JSON.parse(read('exportAll')());
    assert.strictEqual(exported.app, 'business-growth-coach');
    assert.strictEqual(Object.keys(exported.answers).length, 40);
    assert.strictEqual(exported.profile.businessName, 'Bluebird Bakery');

    w.localStorage.removeItem('coach-profile-v1');
    w.localStorage.removeItem('coach-answers-v1');
    read('importAll')(JSON.stringify(exported));
    assert.strictEqual(read('loadProfile')().businessName, 'Bluebird Bakery', 'import restores profile');
    assert.strictEqual(Object.keys(read('loadAnswers')()).length, 40, 'import restores answers');

    assert.throws(() => read('importAll')('{"app":"nope"}'), /does not look like a Coach backup/);

    read('resetAllData')();
    assert.strictEqual(w.localStorage.getItem('coach-profile-v1'), null);
    assert.strictEqual(w.localStorage.getItem('coach-answers-v1'), null);
  });

  await test('scoring modules integrate with real data (0-100 readiness)', () => {
    const { w, read } = makeApp();
    const cats = read('CATEGORIES');

    const allFive = read('finalizeAssessment')(cats, fullAnswers(cats, 5));
    assert.strictEqual(allFive.overall, 100);
    assert.strictEqual(allFive.level, 'Well positioned to grow');

    const mixed = read('computeCategoryScores')(cats, fullAnswers(cats, 3));
    assert.strictEqual(read('overallReadiness')(mixed), 50);

    const withNa = read('computeCategoryScores')(cats, {
      [cats[0].id + '__0']: 5, [cats[0].id + '__1']: null, [cats[0].id + '__2']: 5,
      [cats[0].id + '__3']: null, [cats[0].id + '__4']: 5
    });
    assert.strictEqual(withNa[0].answered, 3, 'N/A excluded from denominator');
    assert.strictEqual(withNa[0].score100, 100, 'N/A does not penalise');
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

    const answers = JSON.parse(w.localStorage.getItem('coach-answers-v1'));
    const firstCatKeys = CATEGORIES[0].questions.map((_, i) => CATEGORIES[0].id + '__' + i);
    firstCatKeys.forEach((k) => assert.strictEqual(answers[k], 4, k + ' should be set by apply'));
    assert.ok(w.document.getElementById('analyze-status-text').textContent.includes('Applied'), 'status should confirm the apply');
  });

  await test('app loaded from the synced bundle also assembles (coach shell)', () => {
    const dist = path.join(ROOT, 'src-tauri', 'app-dist', 'index.html');
    assert.ok(fs.existsSync(dist), 'src-tauri/app-dist/index.html must exist (run npm run app:sync)');
    const html = fs.readFileSync(dist, 'utf8').replace(/<script src="[^"]+"><\/script>/g, '');
    const dom = new JSDOM(html, { url: 'http://localhost/index.html', pretendToBeVisual: true });
    assert.strictEqual(dom.window.document.querySelectorAll('#coach-nav .nav-tab').length, 7);
    assert.strictEqual(dom.window.document.querySelectorAll('#profile-form').length, 1);
  });

  await test('assessment: one category at a time, question radios render per page', () => {
    const { w, read } = makeApp();
    w.document.querySelector('#coach-nav .nav-tab[data-tab="assessment"]').click();
    const cats = read('CATEGORIES');

    const chips = w.document.querySelectorAll('#assess-category-list .cat-chip');
    assert.strictEqual(chips.length, 8, 'one chip per category');
    assert.ok(chips[0].getAttribute('aria-current') === 'true', 'first category active');

    const questions = w.document.querySelectorAll('#assess-question-panel .question');
    assert.strictEqual(questions.length, cats[0].questions.length, 'only active category renders');
    const radios = w.document.querySelectorAll('#assess-question-panel input[type=radio]');
    assert.strictEqual(radios.length, cats[0].questions.length * 6, '5 scale + N/A per question');

    assert.ok(w.document.getElementById('assess-prev-btn').disabled, 'prev disabled on first category');
    assert.ok(w.document.getElementById('assess-next-btn').disabled === false, 'next enabled');
  });

  await test('assessment: answers persist, chips mark done, Next validates the whole category', () => {
    const { w, read } = makeApp();
    w.document.querySelector('#coach-nav .nav-tab[data-tab="assessment"]').click();
    const cats = read('CATEGORIES');
    const cat = cats[0];

    // leave one question unanswered
    cat.questions.forEach((_, qi) => {
      if (qi === 2) return;
      w.document.querySelector('#question-' + qi + ' input[value="3"]').click();
    });
    // check partial save works even with gaps (Save button)
    w.document.getElementById('assess-save-btn').click();

    const saved = JSON.parse(w.localStorage.getItem('coach-answers-v1'));
    const asked = cat.questions.filter((_, i) => i !== 2).length;
    assert.strictEqual(Object.keys(saved).length, asked, 'only checked answers are stored');
    assert.strictEqual(answeredIn(chipDone(w, 0)), false, 'chip not done while gap remains');

    // N/A counts as answered
    w.document.querySelector('#question-2 input[data-na]').click();
    w.document.getElementById('assess-next-btn').click();

    assert.ok(w.document.querySelectorAll('#assess-question-panel .question').length > 0, 'advanced to a next category');
    const nextCat = cats[1];
    const firstQ = w.document.querySelector('#question-0 input');
    assert.ok(firstQ, 'next category rendered questions');
    assert.strictEqual(w.document.querySelector('.cat-chip[aria-current="true"]').getAttribute('data-cat-index'), '1', 'chip selection moved');
  });

  await test('assessment: Next blocks until the category is complete', () => {
    const { w } = makeApp();
    w.document.querySelector('#coach-nav .nav-tab[data-tab="assessment"]').click();
    w.document.getElementById('assess-next-btn').click();
    const box = w.document.getElementById('assess-validation-message');
    assert.ok(box.hidden === false, 'validation message shows');
    assert.ok(box.textContent.includes('unanswered'), 'message encourages completion');

    w.document.querySelectorAll('#assess-question-panel input[type=radio]:not(.na-checked)').forEach((inp, i) => {
      if (i % 6 === 0) inp.click();
    });
    w.document.getElementById('assess-next-btn').click();
    assert.strictEqual(box.hidden, true, 'validation clears once complete');
  });

  await test('dashboard: empty state guides to the assessment', () => {
    const { w } = makeApp();
    w.document.querySelector('#coach-nav .nav-tab[data-tab="dashboard"]').click();
    const body = w.document.getElementById('dashboard-body');
    assert.ok(body.textContent.includes('Take the assessment'), 'empty dashboard encourages the assessment');
  });

  await test('dashboard: renders readiness hero, bars, and supportive blocks from saved answers', () => {
    const { w, read } = makeApp();
    const cats = read('CATEGORIES');
    w.localStorage.setItem('coach-answers-v1', JSON.stringify(fullAnswers(cats, 4)));

    w.document.querySelector('#coach-nav .nav-tab[data-tab="dashboard"]').click();
    const body = w.document.getElementById('dashboard-body');
    const hero = body.querySelector('.readiness-hero');
    assert.strictEqual(hero.querySelector('.score').textContent, '75', '4/5 average -> readiness 75');
    assert.ok(hero.textContent.includes('Building momentum'), 'supportive level label');
    assert.strictEqual(body.querySelectorAll('.bar-row').length, 8, 'one bar per category');
    assert.ok(body.querySelectorAll('.bar-fill.bar-strength').length === 8, '4/5 answers are shared strengths');
    assert.ok(body.textContent.includes('improvement opportunities') === false, 'no opportunities when everything is strong');
    assert.ok(body.textContent.includes('working well'), 'strengths block shows');
  });

  await test('dashboard: partial answers still render with a supportive note', () => {
    const { w, read } = makeApp();
    const cats = read('CATEGORIES');
    const answers = {};
    cats[0].questions.forEach((_, i) => { answers[cats[0].id + '__' + i] = 5; });
    w.localStorage.setItem('coach-answers-v1', JSON.stringify(answers));

    w.document.querySelector('#coach-nav .nav-tab[data-tab="dashboard"]').click();
    const body = w.document.getElementById('dashboard-body');
    assert.ok(body.querySelector('.readiness-hero .score'), 'hero renders for partial data');
    const bars = body.querySelectorAll('.bar-row');
    const totals = Array.from(bars).map((r) => r.querySelector('.bar-score').textContent);
    assert.strictEqual(totals.filter((t) => t === '—').length, 7, 'unanswered categories show a dash');
    assert.strictEqual(totals.filter((t) => t === '100').length, 1);
    assert.ok(body.textContent.includes('foundation'), 'supportive partial note shows');
  });

  await test('actions: add, mark done, edit, and delete', () => {
    const { w } = makeApp();
    w.document.querySelector('#coach-nav .nav-tab[data-tab="action-plan"]').click();
    assert.ok(w.document.getElementById('actions-list').textContent.includes('No actions yet'));

    w.document.getElementById('action-add-btn').click();
    const editor = w.document.getElementById('action-editor-host');
    assert.ok(editor.hidden === false, 'editor opens');
    const fillAndSubmit = (title) => {
      editor.querySelector('#action-title').value = title;
      editor.querySelector('#action-priority').value = 'high';
      editor.querySelector('#action-horizon').value = 'short';
      editor.querySelector('#action-responsible').value = 'Me';
      editor.querySelector('form').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    };
    fillAndSubmit('Weekly cash-flow review');

    const saved = collectSavedActions(w);
    assert.strictEqual(saved.length, 1, 'one action stored');
    assert.strictEqual(saved[0].title, 'Weekly cash-flow review');
    assert.ok(w.document.getElementById('actions-list').textContent.includes('Weekly cash-flow review'));

    // mark done -> status pill
    const row = w.document.querySelector('#actions-list .action-row');
    row.querySelector('button').click();
    assert.strictEqual(collectSavedActions(w)[0].status, 'done');
    assert.ok(w.document.getElementById('actions-list').textContent.includes('Reopen'));

    // edit -> title change
    w.document.querySelector('#actions-list .action-row button').click(); // reopen
    w.document.querySelector('#actions-list .action-row .row-actions button:nth-of-type(2)').click(); // nobody says nth works well
    w.document.querySelectorAll('#actions-list .action-row .icon-btn')[1].click(); // Edit
    const editor2 = w.document.getElementById('action-editor-host');
    editor2.querySelector('#action-title').value = 'Weekly cash review v2';
    editor2.querySelector('form').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    assert.ok(w.document.getElementById('actions-list').textContent.includes('Weekly cash review v2'));
    assert.strictEqual(collectSavedActions(w).length, 1, 'edit updates in place, no duplicate');

    // delete
    w.document.querySelectorAll('#actions-list .action-row .icon-btn.danger')[0].click();
    assert.strictEqual(collectSavedActions(w).length, 0, 'delete removes the action');
  });

  await test('roadmap: guides with a suggested 30/90/12 path from answers', () => {
    const { w, read } = makeApp();
    const cats = read('CATEGORIES');
    w.localStorage.setItem('coach-answers-v1', JSON.stringify(fullAnswers(cats, 3)));
    w.document.querySelector('#coach-nav .nav-tab[data-tab="roadmap"]').click();
    const cols = w.document.querySelectorAll('#roadmap-body .roadmap-col');
    const titles = Array.from(cols).map((c) => c.querySelector('h3').textContent);
    assert.ok(titles.some((t) => t.includes('30 days')), '30-day column present');
    assert.ok(titles.some((t) => t.includes('90 days')), '90-day column present');
    assert.ok(titles.some((t) => t.includes('6-12 months')), '6-12 month column present');
    assert.ok(w.document.getElementById('roadmap-body').textContent.includes('links to at least one longer-term objective'));
  });

  await test('roadmap: empty assessment directs to the assessment tab', () => {
    const { w } = makeApp();
    w.document.querySelector('#coach-nav .nav-tab[data-tab="roadmap"]').click();
    assert.ok(w.document.getElementById('roadmap-body').textContent.includes('Begin your assessment'));
  });

  await test('scenarios: six scenario forms render and save preparations', () => {
    const { w, read } = makeApp();
    const scenarios = read('SCENARIOS');
    assert.strictEqual(scenarios.length, 6);
    w.document.querySelector('#coach-nav .nav-tab[data-tab="scenarios"]').click();
    const cards = w.document.querySelectorAll('#scenarios-list .scenario-card');
    assert.strictEqual(cards.length, 6, 'one card per scenario');

    const first = cards[0];
    first.querySelector('textarea[name="opsAffected"]').value = 'Shop front and online orders';
    first.querySelector('textarea[name="workaround"]').value = 'Move to a backup supplier';
    first.querySelector('form').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));

    const stored = JSON.parse(w.localStorage.getItem('coach-scenarios-v1'));
    assert.strictEqual(stored[scenarios[0].id].opsAffected, 'Shop front and online orders');
    const reRendered = w.document.querySelectorAll('#scenarios-list .scenario-card')[0];
    assert.ok(reRendered.textContent.includes('Prepared 2 of 6'), 'status reflects preparation');
  });

  await test('progress: first snapshot saves; comparisons only after two', () => {
    const { w, read } = makeApp();
    const cats = read('CATEGORIES');
    w.localStorage.setItem('coach-answers-v1', JSON.stringify(fullAnswers(cats, 4)));
    w.document.querySelector('#coach-nav .nav-tab[data-tab="progress"]').click();

    let body = w.document.getElementById('progress-body');
    assert.ok(body.textContent.includes('Save my first snapshot'));
    body.querySelector('button').click();
    body = w.document.getElementById('progress-body');
    assert.strictEqual(loadHistoryWith(w).length, 1, 'one snapshot stored');
    assert.ok(/comparison views appear once two snapshots/i.test(body.textContent), 'comparison nudges after first snapshot');

    // add a second snapshot with improved answers
    w.localStorage.setItem('coach-answers-v1', JSON.stringify(fullAnswers(cats, 5)));
    body.querySelector('button').click();
    body = w.document.getElementById('progress-body');
    const history = loadHistoryWith(w);
    assert.strictEqual(history.length, 2);
    assert.ok(body.textContent.includes('points since your last snapshot'));
    assert.ok(body.querySelector('.compare-table'), 'area-by-area comparison table renders');
  });

  await test('data tools: export report + backup + reset flows wire up', () => {
    const { w, read } = makeApp();
    const downloads = [];
    w.HTMLAnchorElement.prototype.click = function () {
      if (this.download) downloads.push(this.download);
    };

    w.document.getElementById('export-all-btn').click();
    assert.ok(downloads.includes('business-growth-coach-backup.json'), 'backup download triggered');
    w.document.getElementById('export-text-btn').click();
    assert.ok(downloads.includes('business-growth-coach-report.txt'), 'text report download triggered');

    w.localStorage.setItem('coach-profile-v1', JSON.stringify({ businessName: 'Bluebird Bakery', industry: 'x' }));
    w.document.getElementById('reset-all-btn').click();
    assert.strictEqual(w.localStorage.getItem('coach-profile-v1'), null, 'reset clears coach data');
  });

  console.log('');
  console.log(passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
})().catch((err) => {
  console.error('Smoke suite crashed:', err);
  process.exit(1);
});

function collectSavedActions(w) {
  return JSON.parse(w.localStorage.getItem('coach-actions-v1')) || [];
}

function loadHistoryWith(w) {
  return JSON.parse(w.localStorage.getItem('business-evaluator-history-v1')) || [];
}

function chipDone(w, index) {
  return w.document.querySelector('.cat-chip[data-cat-index="' + index + '"]');
}

function answeredIn(chip) {
  return chip.hasAttribute('data-done');
}