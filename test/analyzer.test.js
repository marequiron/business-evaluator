'use strict';

/**
 * analyzer.test.js
 * Plain-Node unit tests for the pure analyzer helpers. No packages needed:
 * run `npm test` (or `node test/analyzer.test.js`) from the repo root.
 */

const assert = require('assert');
const AnalyzerParse = require('../js/analyzer-parse.js');
const Analyzer = require('../js/analyzer.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { passed += 1; console.log('PASS: ' + name); })
    .catch((err) => {
      failed += 1;
      console.error('FAIL: ' + name);
      console.error('  ' + (err && err.message));
    });
}

const CATEGORIES = [
  { id: 'finance', label: 'Finance', questions: [{ text: 'We have cash flow.' }] },
  { id: 'marketing', label: 'Marketing', questions: [{ text: 'We know our market.' }] },
];

(async () => {
  // ---- documentToText ----
  await test('documentToText: txt passes through unchanged', () => {
    assert.strictEqual(AnalyzerParse.documentToText('notes.txt', 'hello\nworld'), 'hello\nworld');
  });

  await test('documentToText: csv joins rows with pipes', () => {
    const out = AnalyzerParse.documentToText('data.csv', 'a,b\n1,2');
    assert.strictEqual(out, 'a | b\n1 | 2');
  });

  await test('documentToText: csv respects quoted commas and escaped quotes', () => {
    const out = AnalyzerParse.documentToText('data.csv', 'name,note\n"Acme, Inc.","said ""hi"""');
    assert.strictEqual(out, 'name | note\nAcme, Inc. | said "hi"');
  });

  await test('documentToText: json flattens to key/value lines', () => {
    const out = AnalyzerParse.documentToText('biz.json', JSON.stringify({ name: 'Acme', tags: ['a', 'b'], nested: { x: 1 } }));
    assert.ok(out.includes('name: Acme'));
    assert.ok(out.includes('tags[0]: a'));
    assert.ok(out.includes('nested.x: 1'));
  });

  await test('documentToText: invalid json falls back to raw text', () => {
    assert.strictEqual(AnalyzerParse.documentToText('bad.json', '{not json'), '{not json');
  });

  await test('documentToText: unknown extension passes through', () => {
    assert.strictEqual(AnalyzerParse.documentToText('file.md', '# Title'), '# Title');
  });

  // ---- truncateDocument ----
  await test('truncateDocument: short text is untouched', () => {
    const r = AnalyzerParse.truncateDocument('abc', 10);
    assert.strictEqual(r.truncated, false);
    assert.strictEqual(r.text, 'abc');
  });

  await test('truncateDocument: long text is capped and flagged', () => {
    const r = AnalyzerParse.truncateDocument('abcdefghij', 4);
    assert.strictEqual(r.truncated, true);
    assert.ok(r.text.startsWith('abcd'));
    assert.ok(r.text.includes('truncated'));
  });

  // ---- buildAnalysisPrompt ----
  await test('buildAnalysisPrompt: returns system + user messages with ids and doc', () => {
    const p = AnalyzerParse.buildAnalysisPrompt(CATEGORIES, 'The business is great.', {});
    assert.strictEqual(p.messages.length, 2);
    assert.strictEqual(p.messages[0].role, 'system');
    assert.ok(p.messages[0].content.includes('finance, marketing'));
    assert.ok(p.messages[0].content.includes('ONLY a JSON array'));
    assert.strictEqual(p.messages[1].role, 'user');
    assert.ok(p.messages[1].content.includes('The business is great.'));
    assert.ok(p.messages[1].content.includes('<<<DOCUMENT'));
  });

  // ---- parseSuggestions ----
  await test('parseSuggestions: parses a clean JSON array', () => {
    const raw = '[{"id":"finance","score":4,"rationale":"good cash"},{"id":"marketing","score":null,"rationale":"no data"}]';
    const out = AnalyzerParse.parseSuggestions(raw, CATEGORIES);
    assert.strictEqual(out.length, 2);
    assert.strictEqual(out[0].id, 'finance');
    assert.strictEqual(out[0].score, 4);
    assert.strictEqual(out[1].score, null);
  });

  await test('parseSuggestions: tolerates prose and markdown fences', () => {
    const raw = 'Sure! Here you go:\n```json\n[{"id":"finance","score":3,"rationale":"ok"}]\n```\nHope that helps.';
    const out = AnalyzerParse.parseSuggestions(raw, CATEGORIES);
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].score, 3);
  });

  await test('parseSuggestions: accepts an object wrapper', () => {
    const raw = '{"suggestions":[{"id":"marketing","score":2,"rationale":"weak"}]}';
    const out = AnalyzerParse.parseSuggestions(raw, CATEGORIES);
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].id, 'marketing');
  });

  await test('parseSuggestions: drops unknown ids and duplicates', () => {
    const raw = '[{"id":"nope","score":5,"rationale":"x"},{"id":"finance","score":4,"rationale":"a"},{"id":"finance","score":1,"rationale":"dup"}]';
    const out = AnalyzerParse.parseSuggestions(raw, CATEGORIES);
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].score, 4);
  });

  await test('parseSuggestions: clamps and rounds out-of-range / decimal scores', () => {
    const raw = '[{"id":"finance","score":9,"rationale":"x"},{"id":"marketing","score":2.6,"rationale":"y"}]';
    const out = AnalyzerParse.parseSuggestions(raw, CATEGORIES);
    assert.strictEqual(out[0].score, 5);
    assert.strictEqual(out[1].score, 3);
  });

  await test('parseSuggestions: coerces numeric strings, nulls non-numeric', () => {
    const raw = '[{"id":"finance","score":"4","rationale":"x"},{"id":"marketing","score":"N/A","rationale":"y"}]';
    const out = AnalyzerParse.parseSuggestions(raw, CATEGORIES);
    assert.strictEqual(out[0].score, 4);
    assert.strictEqual(out[1].score, null);
  });

  await test('parseSuggestions: throws when no JSON is present', () => {
    assert.throws(() => AnalyzerParse.parseSuggestions('no json here', CATEGORIES), /valid JSON/);
  });

  await test('parseSuggestions: empty array is allowed', () => {
    assert.deepStrictEqual(AnalyzerParse.parseSuggestions('[]', CATEGORIES), []);
  });

  // ---- providers ----
  await test('createAnalyzer: selects the mock provider', () => {
    const a = Analyzer.createAnalyzer({ provider: 'mock' }, CATEGORIES);
    assert.strictEqual(a.id, 'mock');
  });

  await test('createAnalyzer: defaults to the on-device provider', () => {
    const a = Analyzer.createAnalyzer({}, CATEGORIES);
    assert.strictEqual(a.id, 'wllama');
  });

  await test('mock provider: analyze returns one suggestion per category', async () => {
    const a = Analyzer.createAnalyzer({ provider: 'mock' }, CATEGORIES);
    await a.load();
    assert.strictEqual(a.isLoaded(), true);
    const out = await a.analyze('Some document text of reasonable length.', {});
    assert.strictEqual(out.suggestions.length, 2);
    out.suggestions.forEach((s) => {
      assert.ok(s.score >= 1 && s.score <= 5);
      assert.ok(typeof s.rationale === 'string' && s.rationale.length > 0);
    });
  });

  await test('mock provider: honours explicit mockSuggestions', async () => {
    const canned = [{ id: 'finance', score: 5, rationale: 'canned' }];
    const a = Analyzer.createAnalyzer({ provider: 'mock', mockSuggestions: canned }, CATEGORIES);
    const out = await a.analyze('x', {});
    assert.deepStrictEqual(out.suggestions, canned);
  });

  await test('api provider: rejects until configured', async () => {
    const a = Analyzer.createAnalyzer({ provider: 'api', apiUrl: '' }, CATEGORIES);
    await assert.rejects(() => a.load(), /not configured/);
  });

  await test('isWebGpuAvailable: false outside a browser', () => {
    assert.strictEqual(Analyzer.isWebGpuAvailable(), false);
  });

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
})();
