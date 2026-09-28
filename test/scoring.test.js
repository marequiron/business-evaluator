'use strict';

/**
 * scoring.test.js
 * Pure unit tests for js/scoring.js. Runs in plain Node (`npm test`).
 * The scoring module reads global SCORE_BANDS / READINESS_LEVELS that live in
 * data.js (browser-lexical const), so we evaluate both sources in a shared
 * vm context first, then pull the functions out.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');
const dataCode = fs.readFileSync(path.join(ROOT, 'js', 'data.js'), 'utf8');
const scoringCode = fs.readFileSync(path.join(ROOT, 'js', 'scoring.js'), 'utf8');

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(dataCode, sandbox);
vm.runInContext(scoringCode, sandbox);

// const/let globals (CATEGORIES, SCORE_BANDS, ...) live in the realm's LEXICAL
// scope, not on the sandbox object — resolve them the same way the app does
// (read === the browser's eval).
const read = (expr) => vm.runInContext(expr, sandbox);

const computeCategoryScores = read('computeCategoryScores');
const overallReadiness = read('overallReadiness');
const levelFor = read('levelFor');
const finalizeAssessment = read('finalizeAssessment');
const topStrengths = read('topStrengths');
const topOpportunities = read('topOpportunities');
const immediateRisks = read('immediateRisks');
const quickWins = read('quickWins');
const roadmap30 = read('roadmap30');
const roadmap90 = read('roadmap90');
const roadmap12 = read('roadmap12');
const compareSnapshots = read('compareSnapshots');
const numericAnswersFor = read('numericAnswersFor');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log('PASS: ' + name);
  } catch (e) {
    failed += 1;
    console.error('FAIL: ' + name);
    console.error('  ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join('\n  ') : e));
  }
}

/** Build a full-answers map from a per-category answers object. */
function answersFrom(categories, perCat) {
  const answers = {};
  categories.forEach((cat) => {
    (perCat[cat.id] || []).forEach((value, i) => {
      answers[cat.id + '__' + i] = value;
    });
  });
  return answers;
}

test('all answers of 1 -> score100 0, readiness 0, level "Laying your foundation"', () => {
  const cats = read('CATEGORIES');
  const answers = answersFrom(cats, cats.reduce((m, c) => { m[c.id] = [1, 1, 1, 1, 1]; return m; }, {}));
  const scored = computeCategoryScores(cats, answers);
  scored.forEach((c) => assert.strictEqual(c.score100, 0, c.id));
  assert.strictEqual(overallReadiness(scored), 0);
  assert.strictEqual(levelFor(0).label, 'Laying your foundation');
});

test('all answers of 5 -> score100 100, readiness 100, level "Well positioned to grow"', () => {
  const cats = read('CATEGORIES');
  const answers = answersFrom(cats, cats.reduce((m, c) => { m[c.id] = [5, 5, 5, 5, 5]; return m; }, {}));
  const scored = computeCategoryScores(cats, answers);
  scored.forEach((c) => assert.strictEqual(c.score100, 100, c.id));
  assert.strictEqual(overallReadiness(scored), 100);
  assert.strictEqual(levelFor(100).label, 'Well positioned to grow');
});

test('all answers of 3 -> score100 50, readiness 50, level "Take your next step"', () => {
  const cats = read('CATEGORIES');
  const answers = answersFrom(cats, cats.reduce((m, c) => { m[c.id] = [3, 3, 3, 3, 3]; return m; }, {}));
  const scored = computeCategoryScores(cats, answers);
  scored.forEach((c) => assert.strictEqual(c.score100, 50, c.id));
  assert.strictEqual(overallReadiness(scored), 50);
  assert.strictEqual(levelFor(50).label, 'Take your next step');
});

test('Not Applicable answers are excluded, not punished', () => {
  const cats = read('CATEGORIES');
  const cat = cats[0];
  const answers = {};
  answers[cat.id + '__0'] = 5;
  answers[cat.id + '__1'] = null; // N/A
  answers[cat.id + '__2'] = 5;
  answers[cat.id + '__3'] = null;
  answers[cat.id + '__4'] = 5;
  const sc = computeCategoryScores(cats, answers)[0];
  assert.strictEqual(sc.answered, 3);
  assert.strictEqual(sc.score100, 100); // 5+5+5 over 3 answered -> avg 5
});

test('unanswered categories have null score and are excluded from readiness', () => {
  const cats = read('CATEGORIES');
  const answers = answersFrom(cats, { [cats[0].id]: [4, 4, 4, 4, 4] });
  const scored = computeCategoryScores(cats, answers);
  const answered = scored.filter((c) => c.score100 != null);
  assert.strictEqual(answered.length, 1);
  assert.strictEqual(overallReadiness(scored), 75);
});

test('finalizeAssessment returns overall + level + hint', () => {
  const cats = read('CATEGORIES');
  const answers = answersFrom(cats, cats.reduce((m, c) => { m[c.id] = [4, 4, 4, 4, 4]; return m; }, {}));
  const result = finalizeAssessment(cats, answers);
  assert.strictEqual(result.overall, 75);
  assert.strictEqual(result.level, 'Building momentum');
  assert.ok(result.levelHint.length > 0);
  assert.strictEqual(result.categories.length, cats.length);
});

test('topStrengths / topOpportunities split at STRENGTH_MIN', () => {
  const cats = read('CATEGORIES');
  const answers = answersFrom(cats, {
    [cats[0].id]: [5, 5, 5, 5, 5], // 100
    [cats[1].id]: [4, 4, 4, 4, 4], // 75
    [cats[2].id]: [3, 3, 3, 3, 3], // 50
    [cats[3].id]: [2, 2, 2, 2, 2], // 25
    [cats[4].id]: [1, 1, 1, 1, 1], // 0
    [cats[5].id]: [4, 4, 4, 4, 4], // 75
    [cats[6].id]: [4, 4, 4, 4, 4], // 75
    [cats[7].id]: [3, 3, 3, 3, 3], // 50
  });
  const scored = computeCategoryScores(cats, answers);
  const strengths = topStrengths(scored, 3);
  assert.strictEqual(strengths.length, 3);
  assert.strictEqual(strengths[0].id, cats[0].id);
  const opps = topOpportunities(scored, 3);
  assert.strictEqual(opps.length, 3);
  assert.strictEqual(opps[0].id, cats[4].id, 'lowest first');
});

test('immediateRisks only below RISK_MAX; quickWins bridge the middle', () => {
  const cats = read('CATEGORIES');
  const answers = answersFrom(cats, {
    [cats[0].id]: [1, 1, 1, 1, 1], // 0 -> risk
    [cats[1].id]: [2, 2, 2, 2, 2], // 25 -> risk
    [cats[2].id]: [3, 3, 3, 3, 3], // 50 -> quick win
    [cats[3].id]: [5, 5, 5, 5, 5], // 100 -> neither
  });
  const scored = computeCategoryScores(cats, answers);
  assert.strictEqual(immediateRisks(scored).length, 2);
  const wins = quickWins(scored);
  assert.ok(wins.some((c) => c.id === cats[2].id));
  assert.ok(!wins.some((c) => c.id === cats[3].id));
});

test('roadmap30/90/12 return recommendation text for the right categories', () => {
  const cats = read('CATEGORIES');
  const answers = answersFrom(cats, {
    [cats[0].id]: [5, 5, 5, 5, 5], // 100
    [cats[1].id]: [4, 4, 4, 4, 4], // 75
    [cats[2].id]: [2, 2, 2, 2, 2], // 25
    [cats[3].id]: [1, 1, 1, 1, 1], // 0
  });
  const scored = computeCategoryScores(cats, answers);
  const r30 = roadmap30(scored);
  assert.ok(r30.some((x) => x.id === cats[2].id || x.id === cats[3].id));
  r30.forEach((x) => assert.ok(x.text.length > 0, 'guidance text present'));
  const r90 = roadmap90(scored);
  assert.ok(r90.every((x) => x.text.length > 0));
  const r12 = roadmap12(scored);
  assert.ok(new Set(r12.map((x) => x.id)).size === r12.length);
});

test('compareSnapshots computes deltas, no fabrication when previous missing', () => {
  const prev = {
    overall: 50,
    categories: [{ id: 'a', label: 'A', icon: '', score100: 50, avg: 3 }]
  };
  const cur = {
    overall: 70,
    categories: [{ id: 'a', label: 'A', icon: '', score100: 75, avg: 4 }]
  };
  const cmp = compareSnapshots(prev, cur);
  assert.strictEqual(cmp.overallDelta, 20);
  assert.strictEqual(cmp.categories[0].delta, 25);

  const missing = compareSnapshots({ overall: null, categories: [] }, cur);
  assert.strictEqual(missing.overallDelta, null);
  assert.strictEqual(missing.categories[0].delta, null);
});

test('numericAnswersFor ignores N/A and undefined', () => {
  const cats = read('CATEGORIES');
  const id = cats[0].id;
  const values = Array.from(numericAnswersFor(cats[0], {
    [id + '__0']: 3, [id + '__1']: null, [id + '__2']: undefined, [id + '__3']: 5
  }));
  assert.deepStrictEqual(values, [3, 5]);
});

console.log('');
console.log(passed + ' passed, ' + failed + ' failed (scoring)');
if (failed > 0) process.exit(1);