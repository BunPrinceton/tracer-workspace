/* Coverage-assertion test suite for search.js.
   Upgraded from the original 5-probe smoke test into a real harness that:
     1. TITLE COVERAGE  — every INDEX entry must be findable by its own title (top-K).
     2. KEYWORD COVERAGE — informational: % of entries findable by a distinctive keyword.
     3. AND-BIAS         — multi-word queries must rank full-coverage entries above partials.
     4. IMAGE/OCR TEXT   — text baked into images/pages (the `text:` field) must be searchable.
   Exits non-zero if any HARD assertion fails. Run: node work-files/test_search.js
   Shims window/document just enough to load the IIFE and reach window.SiteSearch. */
const fs = require('fs');
const path = require('path');

const noop = () => elProxy;
const elProxy = new Proxy(function () {}, {
  get: (t, k) => (k === 'style' || k === 'classList' || k === 'dataset' ? elProxy
                 : k === 'length' ? 0
                 : typeof k === 'symbol' ? undefined : noop),
  set: () => true,
  apply: () => elProxy,
});
global.window = { addEventListener: () => {}, location: { hash: '', search: '', pathname: '/' } };
global.document = new Proxy({ readyState: 'loading' }, {
  get: (t, k) => k in t ? t[k]
    : k === 'currentScript' ? { src: 'http://x/search.js', getAttribute: () => 'search.js' }
    : k === 'querySelector' || k === 'getElementById' ? () => null
    : k === 'querySelectorAll' ? () => [] : noop,
});
global.navigator = { userAgent: 'node' };

const code = fs.readFileSync(path.join(__dirname, '..', 'search.js'), 'utf8');
new Function(code)();
const S = global.window.SiteSearch;
if (!S) { console.error('SiteSearch not exposed'); process.exit(1); }

const INDEX = S.INDEX;
let hardFail = 0;
const rank = (q, url, k) => {
  const r = S.search(q, k || 20);
  return r.findIndex(x => x.entry.url === url); // -1 if absent
};

/* ---- 1. TITLE COVERAGE (hard) ---- */
console.log(`\n=== 1. TITLE COVERAGE (${INDEX.length} entries, top-10) ===`);
const K = 10;
let titleMiss = [];
for (const e of INDEX) {
  // search by the title; cap to first 8 words so pathological long titles still work
  const q = String(e.title || '').split(/\s+/).slice(0, 8).join(' ');
  if (!q) continue;
  if (rank(q, e.url, K) === -1) titleMiss.push(e.title + '  [' + e.url + ']');
}
const titlePct = ((INDEX.length - titleMiss.length) / INDEX.length * 100).toFixed(1);
console.log(`  findable by title in top-${K}: ${INDEX.length - titleMiss.length}/${INDEX.length} (${titlePct}%)`);
if (titleMiss.length) { console.log('  MISSES:'); titleMiss.forEach(m => console.log('    - ' + m)); }
// hard threshold: 92% (a few entries share near-identical titles by design)
if (titlePct < 92) { console.log('  ✗ HARD FAIL: title coverage below 92%'); hardFail++; }
else console.log('  ✓ pass');

/* ---- 2. KEYWORD COVERAGE (informational) ---- */
console.log(`\n=== 2. KEYWORD COVERAGE (informational, top-20) ===`);
let kwHave = 0, kwHit = 0;
for (const e of INDEX) {
  const kws = (e.keywords || []).filter(w => w && w.length >= 4);
  if (!kws.length) continue;
  kwHave++;
  if (rank(kws[0], e.url, 20) !== -1) kwHit++;
}
console.log(`  findable by first distinctive keyword: ${kwHit}/${kwHave} (${(kwHit / kwHave * 100).toFixed(1)}%)  [not a hard gate]`);

/* ---- 3. AND-BIAS ORDERING (hard) ---- */
console.log(`\n=== 3. AND-BIAS: full-coverage must outrank partial ===`);
// each case: query, and a substring that must identify the TOP result's title/url
const andCases = [
  ['synapse layer', /layer/i],                    // both-word hit (title contains "layer") beats single "synapse" hits
  ['light microscopy comparison', /light[ -]microscopy/i],
  ['tracer team workflow', /workflow/i],
  ['dense vesicle', /vesicle|synapse/i],
];
for (const [q, re] of andCases) {
  const top = S.search(q, 1)[0];
  const ok = top && (re.test(top.entry.title) || re.test(top.entry.url));
  console.log(`  "${q}" -> ${top ? top.entry.title : '(none)'}  ${ok ? '✓' : '✗'}`);
  if (!ok) hardFail++;
}
// explicit ordering assertion: for "synapse layer", a both-word entry must beat a title-only "synapse" entry
{
  const res = S.search('synapse layer', 50);
  const both = res.find(x => /layer/i.test(x.entry.title + ' ' + (x.entry.keywords || []).join(' ')) && /synapse/i.test(x.entry.title + ' ' + (x.entry.keywords || []).join(' ')));
  const onlySyn = res.find(x => /synapse/i.test(x.entry.title) && !/layer/i.test(x.entry.title + ' ' + (x.entry.keywords || []).join(' ')));
  if (both && onlySyn) {
    const ok = both.score > onlySyn.score;
    console.log(`  ordering: "${both.entry.title}"(${both.score.toFixed(1)}) > "${onlySyn.entry.title}"(${onlySyn.score.toFixed(1)})  ${ok ? '✓' : '✗'}`);
    if (!ok) hardFail++;
  }
}

/* ---- 4. IMAGE / OCR TEXT (hard) ---- */
console.log(`\n=== 4. IMAGE / BAKED-IN TEXT searchability ===`);
// words that only appear in image/OCR text or contribution descriptions
const textProbes = [
  ['wolverine', /wolverine/i],
  ['eggman', /eggman/i],
  ['ground truthing', /ground|proofread|workflow/i],
];
for (const [q, re] of textProbes) {
  const top = S.search(q, 3)[0];
  const ok = top && re.test(top.entry.title + ' ' + top.entry.url);
  console.log(`  "${q}" -> ${top ? top.entry.title : '(none)'}  ${ok ? '✓' : '✗'}`);
  if (!ok) hardFail++;
}

/* ---- original smoke probes (kept, informational) ---- */
console.log(`\n=== smoke probes (informational) ===`);
for (const q of ['Pyramidal', 'General Morphology', 'depolarizing']) {
  const r = S.search(q, 2);
  console.log(`  ${q}: ` + (r.length ? r.map(x => x.entry.title).join(' | ') : '(none)'));
}

/* ---- summary ---- */
console.log(`\n=== SUMMARY ===`);
if (hardFail) { console.log(`✗ ${hardFail} hard assertion(s) failed`); process.exit(1); }
console.log('✓ all hard assertions passed');
