/* apply-tags.mjs — write the hand-made Figure Tagger tags into gallery/index.html.
   Run:  node work-files/tagger/apply-tags.mjs [path/to/figure-tags.json]
   (default: work-files/tagger/figure-tags.json). Idempotent — re-run after more tagging,
   and ALSO after any gallery generator (gen-gallery-merge.js / gen-gallery-sections.js /
   gen-contributions.js) since those emit cards without tags.

   For every <figure class="gallery-item">:
     - data-tags="A|B|C" is set/replaced. Tags come from figure-tags.json by figure id;
       cards not in the file (the auto-imported contributions) fall back to their
       data-category, title-cased ("figure" -> "Figure"). data-category is left alone so
       the generators' own bookkeeping keeps working.
     - the overlay <span class="gallery-category-badge"> is removed (tags now live in the
       caption, so they never cover the image).
     - a <div class="gallery-tags"> line of #hashtag links is written into the caption,
       after .gallery-meta (or at the end of the figcaption). Existing ones are replaced.
   Then the Filter <select> options are regenerated from the tag set, with counts.
   Afterwards run: node work-files/build-search-index.mjs  (tags feed figure keywords). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const GALLERY = path.join(ROOT, 'gallery', 'index.html');
const JSON_PATH = process.argv[2] ? path.resolve(process.argv[2]) : path.join(HERE, 'figure-tags.json');

const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
const byId = data.figures || {};
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const hashtag = t => '#' + t.replace(/\s+/g, '');
const titleCase = s => s.replace(/(^|[-_\s])(\w)/g, (m, p, c) => (p ? ' ' : '') + c.toUpperCase()).trim();

const raw = fs.readFileSync(GALLERY, 'utf8');
const EOL = raw.includes('\r\n') ? '\r\n' : '\n';
let html = raw.replace(/\r\n/g, '\n');

const counts = new Map();
let nFromFile = 0, nFallback = 0, nUnmatchedIds = 0;
const seen = new Set();

html = html.replace(/<figure class="gallery-item"([^>]*)>([\s\S]*?)<\/figure>/g, (whole, attrs, body) => {
  const id = (attrs.match(/\bid="([^"]+)"/) || [])[1];
  const category = (attrs.match(/data-category="([^"]+)"/) || [])[1] || '';
  let tags;
  if (id && byId[id] && Array.isArray(byId[id].tags) && byId[id].tags.length) { tags = byId[id].tags.slice(); nFromFile++; seen.add(id); }
  else { tags = category ? [titleCase(category)] : []; nFallback++; }
  tags.forEach(t => counts.set(t, (counts.get(t) || 0) + 1));

  // attribute
  let a = attrs.replace(/\s*data-tags="[^"]*"/, '');
  a = a.replace(/(data-category="[^"]*")/, `$1 data-tags="${esc(tags.join('|'))}"`);
  if (!/data-tags=/.test(a)) a += ` data-tags="${esc(tags.join('|'))}"`;

  // body: drop overlay badge, (re)write caption tag line
  let b = body.replace(/[ \t]*<span class="gallery-category-badge"[^>]*>[\s\S]*?<\/span>[ \t]*\n?/g, '');
  b = b.replace(/[ \t]*<div class="gallery-tags">[\s\S]*?<\/div>[ \t]*\n?/g, '');
  const indent = (b.match(/\n([ \t]*)<figcaption/) || [, '                '])[1] + '    ';
  const line = `${indent}<div class="gallery-tags">${tags.map(t => `<a class="gallery-tag" href="?filter=${encodeURIComponent(t)}" data-tag="${esc(t)}" title="Show every figure tagged ${esc(t)}">${esc(hashtag(t))}</a>`).join(' ')}</div>\n`;
  if (/<div class="gallery-meta">[\s\S]*?<\/div>/.test(b)) {
    b = b.replace(/(<div class="gallery-meta">[\s\S]*?<\/div>[ \t]*\n)/, `$1${line}`);
  } else {
    b = b.replace(/([ \t]*<\/figcaption>)/, `${line}$1`);
  }
  return `<figure class="gallery-item"${a}>${b}</figure>`;
});

nUnmatchedIds = Object.keys(byId).filter(id => byId[id].tags && byId[id].tags.length && !seen.has(id)).length;

// Filter dropdown options, alphabetical, with counts
const options = [...counts.entries()].sort((x, y) => x[0].localeCompare(y[0], 'en', { sensitivity: 'base' }))
  .map(([t, n]) => `            <option value="${esc(t)}">${esc(t)} (${n})</option>`).join('\n');
const selRe = /(<select id="category-filter"[^>]*>\n\s*<option value="all">[^<]*<\/option>\n)([\s\S]*?)(\n\s*<\/select>)/;
if (!selRe.test(html)) throw new Error('Filter <select> not found in the expected shape');
html = html.replace(selRe, `$1${options}$3`);

fs.writeFileSync(GALLERY, html.replace(/\n/g, EOL));
console.log(`apply-tags: ${nFromFile} figures tagged from ${path.relative(ROOT, JSON_PATH)}, ${nFallback} fell back to data-category, ${nUnmatchedIds} tagged ids not found in the gallery`);
console.log('tags:', [...counts.entries()].sort((x, y) => y[1] - x[1]).map(([t, n]) => `${t} ${n}`).join(' · '));
