/* build-search-index.mjs — harvest the site's HTML into search-index.js
   ------------------------------------------------------------------------
   search.js keeps the hand-curated INDEX (pages, aliases, keywords). This
   script generates everything that is too big or too repetitive to curate by
   hand and writes it to /search-index.js, which search.js loads at runtime:

     entries  - one per gallery <figure> (all ~1,290 of them, not just the 82
                curated ones), one per glossary term, and one per HTML page
                that has no curated entry.
     patches  - for pages that DO have a curated entry: a `text` bag of the
                page's visible words, so the engine can find words that only
                appear in the body (the "it's on the page but search can't see
                it" problem).
     groups   - gallery sections, so the dropdown can collapse "340 more in LM
                Comparison (Final)" instead of flooding the list.

   Run after editing any page or the gallery:  node work-files/build-search-index.mjs
   Idempotent, no dependencies. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'search-index.js');
const SITE_SUFFIX = / - (Princeton Tracers|Tracer Gallery)$/;
const TEXT_CAP = 900;          // unique words kept per page body

// Directories / files that never get their own generated page entry.
const NO_NEW_ENTRY = [
  /^work-files\//, /^node_modules\//, /^slack-workspace-toolkit\//, /^New Documentation/,
  /^drive_docs_output\//, /^datasets\//, /^games\//, /^index-legacy\.html$/, /^archive\/index\.html$/, /^_/,
  // Orphaned pages (see CLAUDE.md): kept on disk, unlinked, deliberately NOT searchable.
  /^tasks\//, /^ground-truth\//, /^gallery\/reference-figures\//, /^gallery\/optic-lobe-diagrams\//,
];
const NEVER_SCAN = [/^work-files\//, /^node_modules\//, /^\.git\//, /^_/];

/* ---------- tiny HTML helpers (the site is regular, generated HTML) ---------- */
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', rarr: '→', larr: '←',
  ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', middot: '·', hellip: '…', times: '×', deg: '°', micro: 'µ', copy: '©' };
function decode(s) {
  return String(s || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&([a-z]+);/gi, (m, n) => (ENT[n.toLowerCase()] !== undefined ? ENT[n.toLowerCase()] : m));
}
function stripTags(html) {
  return decode(String(html || '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ').trim();
}
function stripChrome(html) {   // drop nav/footer so page text = the page's own words
  return String(html || '')
    .replace(/<nav\b[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/gi, ' ');
}
function first(re, s, i = 1) { const m = re.exec(s); return m ? m[i] : ''; }
const STOP = new Set(('a an the of to in on for and or with by at from is are as it its this that these those how vs into be ' +
  'your you we our was were will can not no if then than when what which who where why all any each per via also more most ' +
  'about after before over under up down out off so but just only very here there').split(' '));
function words(text) {
  const seen = new Set(); const out = [];
  for (const w of String(text).toLowerCase().split(/[^a-z0-9]+/)) {
    if (w.length < 3 || w.length > 30 || STOP.has(w) || seen.has(w) || /^\d+$/.test(w)) continue;
    seen.add(w); out.push(w);
    if (out.length >= TEXT_CAP) break;
  }
  return out;
}
function sectionFromPath(url) {
  const seg = url.split('/')[0];
  return ({ sop: 'SOPs', tasks: 'Tasks', gallery: 'Gallery', archive: 'Archive', publications: 'Publications',
    experimental: 'Experimental', pipeline: 'Pipeline', 'task-history': 'Task History', glossary: 'Glossary',
    'ground-truth': 'Ground Truth', contribute: 'Contribute', thoughts: 'Thoughts', links: 'Links', thanks: 'Thanks' })[seg]
    || (seg ? seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ') : 'Home');
}

/* ---------- load the curated INDEX from search.js (same stub trick as the tests) ---------- */
function loadCurated() {
  const src = fs.readFileSync(path.join(ROOT, 'search.js'), 'utf8');
  const el = () => ({ setAttribute() {}, appendChild() {}, classList: { add() {} }, style: {}, addEventListener() {} });
  globalThis.window = globalThis;
  globalThis.document = { getElementsByTagName: () => [], querySelector: () => null, querySelectorAll: () => [],
    createElement: el, head: el(), body: el(), addEventListener() {}, readyState: 'loading' };
  globalThis.addEventListener = () => {};
  new Function(src)();
  return globalThis.SiteSearch.INDEX;
}
const canon = (u) => { u = decodeURIComponent(u.split('#')[0]); if (u === '' || u.endsWith('/')) u += 'index.html'; return u; };

/* ---------- 1. gallery figures ---------- */
function harvestGallery(curatedUrls) {
  const html = fs.readFileSync(path.join(ROOT, 'gallery', 'index.html'), 'utf8');
  const sections = [...html.matchAll(/<section[^>]*\bid="([^"]+)"[^>]*>/g)].map((m) => {
    const h2 = first(/<h2[^>]*>([\s\S]*?)<\/h2>/, html.slice(m.index, m.index + 2000));
    return { id: m[1], at: m.index, label: stripTags(h2).replace(/\s*\(\d+ figures?\)$/, '') };
  });
  const groups = {};
  for (const s of sections) groups['gallery:' + s.id] = { label: s.label, url: 'gallery/#' + s.id };
  const entries = [], patches = []; let skipped = 0;
  for (const m of html.matchAll(/<figure\b([^>]*)>([\s\S]*?)<\/figure>/g)) {
    const attrs = m[1], body = m[2];
    let sec = null; for (const s of sections) if (s.at < m.index) sec = s;
    const id = first(/\bid="([^"]+)"/, attrs);
    const descId = first(/<p class="gallery-description"[^>]*\bid="([^"]+)"/, body);
    const anchor = id || descId;
    if (!anchor) continue;
    const url = 'gallery/#' + anchor;
    const title = stripTags(first(/<h3 class="gallery-title">([\s\S]*?)<\/h3>/, body)) || stripTags(first(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/, body));
    if (!title) continue;
    const description = stripTags(first(/<p class="gallery-description"[^>]*>([\s\S]*?)<\/p>/, body));
    const alt = decode(first(/\balt="([^"]*)"/, body)).trim();
    const category = first(/data-category="([^"]+)"/, attrs);
    const meta = [...body.matchAll(/<span class="gallery-meta-item">([\s\S]*?)<\/span>/g)].map((x) => stripTags(x[1])).filter(Boolean);
    if (curatedUrls.has(url)) {
      // Hand-written entry wins, but it never saw the alt text / meta pills / caption: patch those in as text.
      skipped++;
      const bag = words(alt + ' ' + meta.join(' ') + ' ' + description);
      if (bag.length) patches.push({ url, text: bag.join(' ') });
      continue;
    }
    const keywords = [...new Set([...meta, category].filter(Boolean))];
    const e = { title, url, section: 'Gallery · ' + (sec ? sec.label : 'Gallery'), description, keywords, group: sec ? 'gallery:' + sec.id : undefined };
    if (alt && alt !== title && alt !== description) e.text = words(alt).join(' ');
    // Auto-imported contribution cards (no id, boilerplate caption) rank a notch below curated figures.
    e.weight = id ? 0.9 : 0.7;
    entries.push(e);
  }
  return { entries, groups, skipped, patches };
}

/* ---------- 2. glossary terms ---------- */
function harvestGlossary() {
  const html = fs.readFileSync(path.join(ROOT, 'glossary', 'index.html'), 'utf8');
  const out = [];
  for (const m of html.matchAll(/<section class="glossary-term" id="([^"]+)">([\s\S]*?)<\/section>/g)) {
    const title = stripTags(first(/<h2[^>]*>([\s\S]*?)<\/h2>/, m[2]));
    const description = stripTags(m[2].replace(/<h2[\s\S]*?<\/h2>/, ''));
    if (title) out.push({ title, url: 'glossary/#' + m[1], section: 'Glossary', description, keywords: ['glossary', 'definition', 'term'], group: 'glossary', weight: 1 });
  }
  return out;
}

/* ---------- 3. pages: new entries for uncovered pages, text patches for covered ones ---------- */
function listPages() {
  const out = [];
  (function walk(dir) {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, f.name); const rel = path.relative(ROOT, p).split(path.sep).join('/');
      if (NEVER_SCAN.some((re) => re.test(rel))) continue;
      if (f.isDirectory()) walk(p); else if (f.name.endsWith('.html')) out.push(rel);
    }
  })(ROOT);
  return out.sort();
}
function harvestPages(curated) {
  const byUrl = new Map(curated.map((e) => [canon(e.url), e]));
  const entries = [], patches = [];
  for (const rel of listPages()) {
    const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const isGallery = rel === 'gallery/index.html';
    const main = first(/<main\b[^>]*>([\s\S]*?)<\/main>/i, html) || stripChrome(html);
    const text = isGallery ? [] : words(stripTags(stripChrome(main)));
    const cur = byUrl.get(rel);
    if (cur) {
      if (text.length) patches.push({ url: cur.url, text: text.join(' ') });
      continue;
    }
    if (NO_NEW_ENTRY.some((re) => re.test(rel))) continue;
    const title = stripTags(first(/<title>([\s\S]*?)<\/title>/i, html)).replace(SITE_SUFFIX, '').trim()
      || stripTags(first(/<h1[^>]*>([\s\S]*?)<\/h1>/i, html));
    if (!title) continue;
    let description = decode(first(/<meta name="description" content="([^"]*)"/i, html)).trim()
      || stripTags(first(/<p class="lead"[^>]*>([\s\S]*?)<\/p>/i, main));
    if (!description) {
      for (const p of main.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) { const t = stripTags(p[1]); if (t.length >= 60) { description = t; break; } }
    }
    if (description.length > 220) description = description.slice(0, 217).replace(/\s+\S*$/, '') + '…';
    const heads = [...main.matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi)].map((h) => stripTags(h[1])).filter((t) => t && t.length < 60).slice(0, 12);
    const url = rel.replace(/index\.html$/, '').split('/').map(encodeURIComponent).join('/');
    const e = { title, url, section: sectionFromPath(rel), description, keywords: [...new Set(heads)], weight: 0.95 };
    if (/\/v\d+\.\d+\.html$/.test(rel)) { e.section += ' · older version'; e.weight = 0.8; }
    if (text.length) e.text = text.join(' ');
    entries.push(e);
  }
  return { entries, patches };
}

/* ---------- write ---------- */
const curated = loadCurated();
const curatedUrls = new Set(curated.map((e) => e.url));
const gal = harvestGallery(curatedUrls);
const glossary = harvestGlossary();
const pages = harvestPages(curated);
const groups = Object.assign({ glossary: { label: 'Glossary', url: 'glossary/' } }, gal.groups);
const payload = {
  generatedAt: new Date().toISOString().slice(0, 10),
  groups,
  entries: [...gal.entries, ...glossary, ...pages.entries],
  patches: [...gal.patches, ...pages.patches],
};
const js = '/* GENERATED by work-files/build-search-index.mjs — do not edit by hand.\n' +
  '   Gallery figures, glossary terms, uncovered pages and page-text bags for search.js. */\n' +
  'window.SITE_SEARCH_GENERATED = ' + JSON.stringify(payload) + ';\n' +
  'if (window.SiteSearch && window.SiteSearch.addGenerated) window.SiteSearch.addGenerated(window.SITE_SEARCH_GENERATED);\n';
fs.writeFileSync(OUT, js);
console.log(`search-index.js: ${(js.length / 1024).toFixed(0)} KB | gallery figures ${gal.entries.length} (+${gal.skipped} already curated) | glossary ${glossary.length} | new pages ${pages.entries.length} | text patches ${pages.patches.length + gal.patches.length} | groups ${Object.keys(groups).length}`);
for (const e of pages.entries) console.log('  + page:', e.url, '|', e.title, '|', e.section);
