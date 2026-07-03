/* gen-gallery-sections.js — restructure the single "Tracer Contributions" block
   into multiple pill sections: Funny / Training / Figures / EM-vs-LM, plus one
   section per Austin folder (LM Comparison Final, Final Figures, Individuals,
   Codex EM). Re-buckets the existing 115 contribution cards (parsed from the
   current section, so no data is re-declared) and adds the 912 Austin cards
   from work-files/austin-manifest.json. Rebuilds the section-jump pills and
   appends 4 collection-level INDEX entries. Idempotent (replaces the marked
   region + regenerates the jump nav).
   Run: node work-files/gen-gallery-sections.js
*/
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const GAL = path.join(ROOT, 'gallery', 'index.html');
const SEARCH = path.join(ROOT, 'search.js');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

let g = fs.readFileSync(GAL, 'utf8');

// 1. grab the current contributions region and pull out its <figure> cards
const regionRe = /    <!-- tracer-contributions START \(generated\) -->[\s\S]*?<!-- tracer-contributions END -->/;
const region = (g.match(regionRe) || [''])[0];
const figs = region.match(/<figure class="gallery-item"[\s\S]*?<\/figure>/g) || [];
function bucketOf(fig) {
  const cat = (fig.match(/data-category="([^"]+)"/) || [])[1];
  const id = (fig.match(/id="(fig-[^"]+)"/) || [])[1] || '';
  if (cat === 'funny') return 'funny';
  if (cat === 'training') return 'training';
  if (/fig-contrib-lm-em-|fig-contrib-lmc-/.test(id)) return 'lm';
  return 'figures';
}
const existing = { funny: [], training: [], figures: [], lm: [] };
for (const f of figs) existing[bucketOf(f)].push(f);

// 2. build Austin cards from the manifest
const austin = JSON.parse(fs.readFileSync(path.join(ROOT, 'work-files', 'austin-manifest.json'), 'utf8'));
const clean = n => n.replace(/\.[^.]+$/, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
const DESCT = {
  lmfinal: n => `${n} — light-microscopy vs EM comparison (final figure set).`,
  'lmfinal-real': n => `${n} — light-microscopy vs EM comparison (final figures).`,
  individuals: n => `${n} — individual cell reconstruction.`,
  codex: n => `${n} — Codex EM screenshot.`,
};
const FOLDER_LABEL = {
  lmfinal: 'LM Comparison (Final)', 'lmfinal-real': 'Final Figures',
  individuals: 'Individuals', codex: 'Codex EM',
};
function austinCard(m) {
  const title = clean(m.orig);
  const desc = DESCT[m.tag](title);
  const descId = m.file.replace(/[^a-z0-9]/gi, '-') + '-d';
  return `            <figure class="gallery-item" data-category="figure">
                <div class="gallery-image-container">
                    <a href="contributions/${m.file}" aria-describedby="${descId}">
                        <img src="contributions/${m.file}" alt="${esc(title)}" loading="lazy">
                    </a>
                    <span class="gallery-category-badge" data-category="figure">Figure</span>
                </div>
                <figcaption class="gallery-caption">
                    <h3 class="gallery-title"><a href="contributions/${m.file}">${esc(title)}</a></h3>
                    <p class="gallery-description" id="${descId}">${esc(desc)}</p>
                    <div class="gallery-meta">
                        <span class="gallery-meta-item">${esc(FOLDER_LABEL[m.tag])}</span>
                        <span class="gallery-meta-item">Contributed by the team</span>
                    </div>
                </figcaption>
            </figure>`;
}
const byTag = { lmfinal: [], 'lmfinal-real': [], individuals: [], codex: [] };
for (const m of austin) if (byTag[m.tag]) byTag[m.tag].push(austinCard(m));

// 3. assemble sections
function sectionBlock(id, heading, badge, desc, cards) {
  return `    <section class="dataset-section" id="${id}" aria-labelledby="${id}-h">
        <div class="dataset-header">
            <h2 id="${id}-h">${esc(heading)}</h2>
            <span class="dataset-badge">${esc(badge)}</span>
        </div>
        <p class="dataset-description">${esc(desc)}</p>
        <div class="gallery-grid">

${cards.join('\n\n')}

        </div>
    </section>`;
}
const SECTIONS = [
  ['contrib-funny', 'Contributions — Funny', 'From the team', 'Shapes and faces the team has spotted in the EM — pure connectomics pareidolia.', existing.funny],
  ['contrib-training', 'Contributions — Training', 'From the team', 'Annotated training examples — synapse quality tiers and annotation/QC screenshots.', existing.training],
  ['contrib-figures', 'Contributions — Figures', 'From the team', 'Illustrations and overview figures explaining the work.', existing.figures],
  ['contrib-lm', 'Cell Types: EM vs Light Microscopy', 'Austin', 'Fly cell types shown as EM reconstructions beside their light-microscopy references, used to confirm identity across modalities.', existing.lm.concat(byTag.lmfinal.length ? [] : [])],
  ['contrib-lmfinal', 'LM Comparison (Final)', 'Austin', `Austin's "LM Comparison (Final)" set — ${byTag.lmfinal.length} EM-vs-light-microscopy figures.`, byTag.lmfinal],
  ['contrib-lmfinal-real', 'Final Figures (for real)', 'Austin', `Austin's "final figures, for real this time" set — ${byTag['lmfinal-real'].length} figures.`, byTag['lmfinal-real']],
  ['contrib-individuals', 'Individuals', 'Austin', `Austin's "Individuals" set — ${byTag.individuals.length} individual cell reconstructions.`, byTag.individuals],
  ['contrib-codex', 'Codex EM Screenshots', 'Austin', `Austin's "Codex EM Screenshots" set — ${byTag.codex.length} EM screenshots.`, byTag.codex],
];
const extras = (region.match(/A few larger animations[\s\S]*?<\/ul>/) || [''])[0];
const newRegion = `    <!-- tracer-contributions START (generated) -->
${SECTIONS.map(s => sectionBlock(...s)).join('\n\n')}

    <section class="dataset-section" id="contrib-extras" aria-labelledby="contrib-extras-h">
        <div class="dataset-header"><h2 id="contrib-extras-h">More on Drive</h2></div>
        <p class="dataset-description">${extras || 'Additional animations and videos are hosted on Drive.'}</p>
    </section>
    <!-- tracer-contributions END -->`;
g = g.replace(regionRe, newRegion);

// 4. rebuild the section-jump pills
const PILLS = [
  ['#banc', 'BANC'], ['#fafb-2019', 'FAFB 2019'], ['#reference', 'Reference'],
  ['#visual-glossary', 'Visual Glossary'], ['#ol-cell-name-guide', 'OL Cell Names'],
  ['#fly-synapses', 'Fly Synapses'], ['#flywire-cheatsheet', 'FlyWire Cheatsheet'],
  ['#optic-lobe-diagrams', 'OL Diagrams'],
  ['#contrib-funny', 'Funny'], ['#contrib-training', 'Training'], ['#contrib-figures', 'Figures'],
  ['#contrib-lm', 'EM vs LM'], ['#contrib-lmfinal', 'LM Final'], ['#contrib-lmfinal-real', 'Final Figures'],
  ['#contrib-individuals', 'Individuals'], ['#contrib-codex', 'Codex EM'],
  ['#image-bounty', 'Image Bounty'],
];
const jumpNav = `<nav class="section-jump" aria-label="Jump to gallery section">\n` +
  PILLS.map(([h, l]) => `        <a href="${h}">${l}</a>`).join('\n') + `\n    </nav>`;
g = g.replace(/<nav class="section-jump"[\s\S]*?<\/nav>/, jumpNav);
fs.writeFileSync(GAL, g);

// 5. append 4 Austin collection INDEX entries (with cell-type tokens for search)
let s = fs.readFileSync(SEARCH, 'utf8');
const nl = s.includes('\r\n') ? '\r\n' : '\n';
function tokens(tag) {
  const set = new Set();
  for (const m of austin) if (m.tag === tag) {
    const t = (m.orig.match(/^([a-zA-Z]{1,4}\d+[a-z]?)/) || [])[1];
    if (t) set.add(t.toLowerCase());
  }
  return [...set];
}
const COLLS = [
  ['LM Comparison (Final) — Cell-Type Figures', 'gallery/#contrib-lmfinal',
    "Austin's large final set of fly cell-type EM-vs-light-microscopy comparison figures.", tokens('lmfinal')],
  ['Final Figures (for real) — Cell-Type Comparisons', 'gallery/#contrib-lmfinal-real',
    "Austin's alternate final set of cell-type EM-vs-light-microscopy figures.", tokens('lmfinal-real')],
  ['Individual Cell Reconstructions (Austin)', 'gallery/#contrib-individuals',
    "Austin's collection of individual fly cell reconstructions.", tokens('individuals')],
  ['Codex EM Screenshots (Austin)', 'gallery/#contrib-codex',
    "Austin's collection of Codex EM screenshots.", tokens('codex')],
];
const missing = COLLS.filter(c => !s.includes(c[0]));
if (missing.length) {
  const entries = missing.map(([title, url, desc, toks]) => {
    const kw = ['figure', 'light microscopy', 'lm', 'em', 'cell type', 'comparison', 'austin'].concat(toks);
    return `        {
            title: "${title.replace(/"/g, '\\"')}",
            url: "${url}",
            section: "Gallery \\u00b7 Tracer Contributions",
            description: "${desc.replace(/"/g, '\\"')}",
            aliases: [],
            keywords: [${kw.map(k => `"${k}"`).join(', ')}],
            text: "${toks.join(' ')}"
        }`;
  }).join(',\n').split('\n').join(nl);
  s = s.replace(`var INDEX = [` + nl, `var INDEX = [` + nl + entries + ',' + nl);
  fs.writeFileSync(SEARCH, s);
}

const total = Object.values(existing).reduce((a, b) => a + b.length, 0) + austin.length;
console.log(`gallery restructured: ${SECTIONS.length} sections, ${total} contribution cards`);
console.log(`  existing re-bucketed: funny ${existing.funny.length}, training ${existing.training.length}, figures ${existing.figures.length}, lm ${existing.lm.length}`);
console.log(`  austin: ` + Object.entries(byTag).map(([k, v]) => `${k} ${v.length}`).join(', '));
console.log(`  search.js: +${missing.length} collection INDEX entries`);
