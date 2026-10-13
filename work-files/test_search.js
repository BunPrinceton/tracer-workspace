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

// Load the generated index exactly as the browser does (search-index.js calls addGenerated).
const CURATED = S.INDEX.length;
const genPath = path.join(__dirname, '..', 'search-index.js');
if (fs.existsSync(genPath)) new Function(fs.readFileSync(genPath, 'utf8'))();
console.log(`index: ${CURATED} curated + ${S.INDEX.length - CURATED} generated = ${S.INDEX.length} entries`);

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

/* ---- 5. SEARCH-ENGINE BEHAVIOUR (hard) — the 2026-10-13 rewrite ---- */
console.log(`\n=== 5. ENGINE BEHAVIOUR: narrowing, coverage, typos, fallback ===`);
function check(label, ok, detail) {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? '  (' + detail + ')' : ''}`);
  if (!ok) hardFail++;
}
{
  // More words can only narrow. The classic complaint: "Soma Region" (7) -> "Soma Region BANC" (18).
  const a = S.search('Soma Region').length, b = S.search('Soma Region BANC').length;
  check('adding a word never widens the result set', b <= a && b > 0, `"Soma Region"=${a}, "+BANC"=${b}`);
  const top = S.search('Soma Region BANC', 2).map(x => x.entry.title).join(' | ');
  check('"Soma Region BANC" puts the BANC soma-region figures first', /Dense Soma Region/.test(top) && /Sparse Soma Region/.test(top), top);
  // Every word must match: a 3-word query cannot return something matching only "BANC".
  const bad = S.search('Soma Region BANC').find(x => !x.missing.length && !/soma/i.test(JSON.stringify(x.entry)));
  check('no result lacks one of the query words (AND)', !bad, bad ? bad.entry.title : '');
}
{
  // Gallery captions are searchable: 15 "neuropil" mentions in the gallery, previously 4 hits.
  const n = S.search('neuropil').length;
  check('"neuropil" reaches the gallery captions', n >= 9, `${n} results`);
  const g = S.search('mitochondria', 1)[0];
  check('a glossary term outranks the glossary page for its own word', g && g.entry.url === 'glossary/#mitochondria', g && g.entry.url);
}
{
  // Junk queries fall back with explicit "missing" labels instead of a wall of weak hits.
  const r = S.search('yellow dog');
  check('"yellow dog" is a labelled fallback, not a wall of junk', r.fallback === true && r.every(x => x.missing.length === 1) && r.length < 15, `${r.length} results, fallback=${r.fallback}`);
  const zero = S.search('qzxvw plorth');
  check('gibberish returns nothing', zero.length === 0, `${zero.length}`);
}
{
  // Typos: fuzzy only for words the index has never seen; real words never match look-alikes.
  const t = S.search('synaspe layer', 1)[0];
  check('typo "synaspe layer" still finds the layer stack', t && /Synapse Annotation Layer Stack/.test(t.entry.title), t && t.entry.title);
  const dog = S.search('dog');
  check('"dog" does not fuzzy-match "do"/"dot"/"log"', dog.every(x => /dog|dalmatian|puppy|canine/i.test(JSON.stringify(x.entry))), `${dog.length} results`);
}
{
  // Plural stemming + stopwords + prefix-while-typing.
  check('"synapses" finds "synapse" entries', S.search('synapses').length >= S.search('synapse').length * 0.9);
  check('"how to vesicle" ignores the stopwords', S.search('how to vesicle').length > 0 && S.search('how to vesicle').terms.join(' ') === 'vesicle');
  check('"som" (still typing) prefix-matches soma', S.search('som', 3).some(x => /soma/i.test(x.entry.title)));
  check('trailing space disables the prefix bonus but still matches', S.search('soma ', 1)[0] && /soma/i.test(S.search('soma ', 1)[0].entry.title));
}
{
  // Flood control: 337 "Individuals" cards must not bury the collection page.
  const r = S.search('individual cell reconstruction');
  check('collection page outranks its own 300+ cards', r[0] && /Individual Cell Reconstructions/.test(r[0].entry.title), r[0] && r[0].entry.title);
  // Page-body words that live only in the harvested text bag are findable.
  const nm = S.search('nomachine', 1)[0];
  check('harvested page text is searchable ("nomachine")', nm && /NoMachine/i.test(nm.entry.title), nm && nm.entry.title);
}

/* ---- summary ---- */
console.log(`\n=== SUMMARY ===`);
if (hardFail) { console.log(`✗ ${hardFail} hard assertion(s) failed`); process.exit(1); }
console.log('✓ all hard assertions passed');
