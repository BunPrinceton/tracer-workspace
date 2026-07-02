/* gen-contributions.js — build/refresh the "Tracer Contributions" gallery section,
   its badge CSS, filter options, jump-nav link, and search INDEX entries.
   Idempotent & incremental: re-run after adding ITEMS to append new cards/entries.
   The whole section (between the START/END markers) is regenerated from ITEMS;
   INDEX entries are inserted only for items not already present.
   Run: node work-files/gen-contributions.js  (from repo root)
*/
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const GAL = path.join(ROOT, 'gallery', 'index.html');
const SEARCH = path.join(ROOT, 'search.js');

const BADGE = { funny: 'Funny', training: 'Training', figure: 'Figure' };

const ITEMS = [
  // ================= FUNNY =================
  { file: 'contrib-wolverine-claws.png', cat: 'funny', slug: 'contrib-wolverine-claws',
    title: "Wolverine's Claws",
    desc: "A segmented neuron whose parallel blade-like processes look uncannily like Wolverine's adamantium claws — a favorite “shapes seen in EM” find from the tracing team.",
    meta: ['Pareidolia', 'EM'], kw: ['funny', 'wolverine', 'claws', 'pareidolia', 'shapes seen in em', 'neuron'] },
  { file: 'contrib-ghost-face.png', cat: 'funny', slug: 'contrib-ghost-face',
    title: "The Ghost",
    desc: "An EM cross-section whose membrane outline reads as a wide-eyed cartoon ghost, from the team's running “faces seen in EM” collection.",
    meta: ['Pareidolia', 'EM'], kw: ['funny', 'ghost', 'face', 'pareidolia', 'faces seen in em'] },
  { file: 'contrib-dalmatian-running.png', cat: 'funny', slug: 'contrib-dalmatian-running',
    title: "Running Dalmatian",
    desc: "Cell profiles that come together into the silhouette of a running dalmatian — more connectomics pareidolia.",
    meta: ['Pareidolia', 'EM'], kw: ['funny', 'dalmatian', 'dog', 'running', 'pareidolia'] },
  { file: 'contrib-eggman.png', cat: 'funny', slug: 'contrib-eggman',
    title: "Eggman",
    desc: "A rounded EM profile the team nicknamed “Eggman” — a lighthearted find from the screenshots pile.",
    meta: ['Pareidolia', 'EM'], kw: ['funny', 'eggman', 'egg', 'pareidolia'] },
  { file: 'contrib-hippo.png', cat: 'funny', slug: 'contrib-hippo',
    title: "Hippo",
    desc: "An EM profile the team saw as a hippo — from the running “faces seen in EM” collection.",
    meta: ['Pareidolia', 'EM'], kw: ['funny', 'hippo', 'face', 'pareidolia', 'faces seen in em'] },
  { file: 'contrib-icy-thumbs-up.png', cat: 'funny', slug: 'contrib-icy-thumbs-up',
    title: "Icy Thumbs-Up",
    desc: "A frosty-looking segment shaped like a thumbs-up.",
    meta: ['Pareidolia', 'EM'], kw: ['funny', 'thumbs up', 'icy', 'pareidolia'] },
  { file: 'contrib-screaming-face.png', cat: 'funny', slug: 'contrib-screaming-face',
    title: "The Scream",
    desc: "Membrane contours that form a wide-mouthed screaming face.",
    meta: ['Pareidolia', 'EM'], kw: ['funny', 'scream', 'screaming', 'face', 'pareidolia'] },
  { file: 'contrib-big-nose-animal.png', cat: 'funny', slug: 'contrib-big-nose-animal',
    title: "Big-Nosed Animal",
    desc: "An EM profile resembling a big-nosed animal.",
    meta: ['Pareidolia', 'EM'], kw: ['funny', 'animal', 'nose', 'pareidolia'] },
  { file: 'contrib-crying-face.png', cat: 'funny', slug: 'contrib-crying-face',
    title: "Crying Face",
    desc: "A shape that reads as a teary, crying face.",
    meta: ['Pareidolia', 'EM'], kw: ['funny', 'crying', 'face', 'pareidolia'] },
  { file: 'contrib-zombie-thumbs-up.png', cat: 'funny', slug: 'contrib-zombie-thumbs-up',
    title: "Zombie Thumbs-Up",
    desc: "A ghoulish thumbs-up spotted in the EM.",
    meta: ['Pareidolia', 'EM'], kw: ['funny', 'zombie', 'thumbs up', 'pareidolia'] },
  { file: 'contrib-big-dipper-cell.png', cat: 'funny', slug: 'contrib-big-dipper-cell',
    title: "Big Dipper Cell",
    desc: "A cell whose processes trace out the Big Dipper constellation.",
    meta: ['Pareidolia', 'EM'], kw: ['funny', 'big dipper', 'constellation', 'cell', 'pareidolia'] },
  // ================= TRAINING =================
  { file: 'contrib-synapse-great-1.png', cat: 'training', slug: 'contrib-synapse-great-1',
    title: "Synapse Annotation — Great Example (1)",
    desc: "High-magnification D. virilis EM synapse with a clean pre→post annotation (cyan). A clear presynaptic vesicle cluster and well-defined cleft make this a textbook “great” quality tier for synapse ground truth.",
    meta: ['D. virilis', 'Synapse', 'Great tier'], kw: ['training', 'synapse', 'annotation', 'great', 'quality', 'vesicles', 'cleft', 'presynaptic', 'postsynaptic', 'drosophila virilis', 'ground truth'] },
  { file: 'contrib-synapse-great-7.png', cat: 'training', slug: 'contrib-synapse-great-7',
    title: "Synapse Annotation — Great Example (2)",
    desc: "Another crisp, high-clarity D. virilis synapse example at the “great” quality tier — unambiguous vesicle cloud and cleft, cleanly annotated.",
    meta: ['D. virilis', 'Synapse', 'Great tier'], kw: ['training', 'synapse', 'annotation', 'great', 'quality', 'vesicles', 'cleft', 'drosophila virilis'] },
  { file: 'contrib-synapse-fair-1.png', cat: 'training', slug: 'contrib-synapse-fair-1',
    title: "Synapse Annotation — Fair Example (1)",
    desc: "A lower-clarity, grainier D. virilis EM synapse (green annotation to two postsynaptic partners). Representative of the “fair” quality tier where the synapse is harder to resolve — a useful borderline reference for annotators.",
    meta: ['D. virilis', 'Synapse', 'Fair tier'], kw: ['training', 'synapse', 'annotation', 'fair', 'quality', 'borderline', 'polyadic', 'postsynaptic', 'drosophila virilis'] },
  { file: 'contrib-synapse-fair-12.png', cat: 'training', slug: 'contrib-synapse-fair-12',
    title: "Synapse Annotation — Fair Example (2)",
    desc: "Another “fair” quality-tier D. virilis synapse in noisier tissue — the sort of marginal call annotators need to recognize and handle consistently.",
    meta: ['D. virilis', 'Synapse', 'Fair tier'], kw: ['training', 'synapse', 'annotation', 'fair', 'quality', 'borderline', 'drosophila virilis'] },
  { file: 'contrib-synapse-annotation-layers.png', cat: 'training', slug: 'contrib-synapse-annotation-layers',
    title: "Synapse Annotation Layer Stack",
    desc: "A FlyWire synapse-annotation scene showing the full layer stack an annotator works with: production image, incoming and outgoing synapses, false-positive and false-negative flags, duplicate synapses, and T-bars/clefts, over the segmentation-with-graph and a bounding box.",
    meta: ['FlyWire', 'Layers', 'Synapse'], kw: ['training', 'synapse', 'annotation', 'layers', 'flywire', 'incoming', 'outgoing', 'false positive', 'false negative', 'duplicate', 't-bar', 'cleft', 'bounding box'] },
  { file: 'contrib-synapse-fp-fn-counts.png', cat: 'training', slug: 'contrib-synapse-fp-fn-counts',
    title: "Synapse QC — FP/FN Counts",
    desc: "A synapse ground-truth QC view: 138 incoming/outgoing synapses detected, with 39 false positives, 54 false negatives, 30 duplicates, and T-bars/clefts marked — the kind of tally used to score detection quality.",
    meta: ['QC', 'Synapse', 'Counts'], kw: ['training', 'synapse', 'qc', 'quality control', 'false positive', 'false negative', 'duplicate', 't-bar', 'cleft', 'counts', 'detection', 'fp', 'fn'] },
  { file: 'contrib-synapse-labeling-sets.png', cat: 'training', slug: 'contrib-synapse-labeling-sets',
    title: "Synapse Labeling Sets",
    desc: "An example of how synapse labeling sets are organized for annotation.",
    meta: ['Synapse', 'Labeling'], kw: ['training', 'synapse', 'labeling', 'sets', 'annotation', 'example'] },
  // ================= FIGURE =================
  { file: 'contrib-tracer-team-workflow.png', cat: 'figure', slug: 'contrib-tracer-team-workflow',
    title: "Tracer Team Workflow Breakdown",
    desc: "How the tracing team splits its effort: Proofreading (35%) toward a correct connectome, Ground Truthing (50%) for AI training, and Annotations (15%) for analysis — with the sub-tasks under each (axons, dendrites, spines, soma, synapses, mitochondria, myelin, glia, blood vessels, cell types).",
    meta: ['Overview', 'Workflow'], kw: ['figure', 'workflow', 'proofreading', 'ground truthing', 'annotations', 'overview', 'tracer team', 'pie chart'] },
  { file: 'contrib-mega-type-illustration.png', cat: 'figure', slug: 'contrib-mega-type-illustration',
    title: "Whole-Brain Cell-Type Illustration",
    desc: "A whole-brain “mega” cell-type illustration with a corrected color key — a big-picture reference showing many cell types laid out together.",
    meta: ['Whole brain', 'Cell types'], kw: ['figure', 'whole brain', 'cell types', 'illustration', 'mega type', 'key', 'morphology'] },
  { file: 'contrib-lm-em-aip5.png', cat: 'figure', slug: 'contrib-lm-em-aip5',
    title: "aIP5 — EM vs Light Microscopy",
    desc: "Side-by-side comparison of the aIP5 cell type reconstructed from EM against a light-microscopy reference, used to confirm cell-type identity across imaging modalities.",
    meta: ['Cell typing', 'LM vs EM'], kw: ['figure', 'light microscopy', 'lm', 'em', 'comparison', 'cell type', 'aip5', 'morphology', 'fru', 'dsx'] },
  { file: 'contrib-lm-em-asp8.png', cat: 'figure', slug: 'contrib-lm-em-asp8',
    title: "aSP8 — EM vs Light Microscopy",
    desc: "The aSP8 cell type matched between its EM reconstruction and a light-microscopy image — part of the fru/dsx cell-typing comparison set.",
    meta: ['Cell typing', 'LM vs EM'], kw: ['figure', 'light microscopy', 'lm', 'em', 'comparison', 'cell type', 'asp8', 'morphology'] },
  { file: 'contrib-lm-em-psp3.png', cat: 'figure', slug: 'contrib-lm-em-psp3',
    title: "pSP3 — EM vs Light Microscopy",
    desc: "pSP3 morphology compared across EM and light microscopy to validate the cell-type call.",
    meta: ['Cell typing', 'LM vs EM'], kw: ['figure', 'light microscopy', 'lm', 'em', 'comparison', 'cell type', 'psp3', 'morphology'] },
  { file: 'contrib-lm-em-adt5.png', cat: 'figure', slug: 'contrib-lm-em-adt5',
    title: "aDT5 — EM vs Light Microscopy",
    desc: "The aDT5 cell type shown as an EM reconstruction beside its light-microscopy reference stack.",
    meta: ['Cell typing', 'LM vs EM'], kw: ['figure', 'light microscopy', 'lm', 'em', 'comparison', 'cell type', 'adt5', 'morphology'] },
  { file: 'contrib-lm-em-pmp5.png', cat: 'figure', slug: 'contrib-lm-em-pmp5',
    title: "pMP5 (female) — EM vs Light Microscopy",
    desc: "pMP5 in the female brain, EM reconstruction against its light-microscopy match.",
    meta: ['Cell typing', 'LM vs EM'], kw: ['figure', 'light microscopy', 'lm', 'em', 'comparison', 'cell type', 'pmp5', 'female', 'morphology'] },
  { file: 'contrib-lm-em-asp4.png', cat: 'figure', slug: 'contrib-lm-em-asp4',
    title: "aSP4 — EM vs Light Microscopy",
    desc: "aSP4 morphology compared between EM and light microscopy — a case where the LM is noisy and the match takes care to call.",
    meta: ['Cell typing', 'LM vs EM'], kw: ['figure', 'light microscopy', 'lm', 'em', 'comparison', 'cell type', 'asp4', 'morphology'] },
];

// Bulk auth-blocked images downloaded in a second pass. Rendered as cards but
// indexed only at the collection level (below) to avoid flooding search with
// ~89 near-identical entries.
let AUTO = [];
try { AUTO = require('./auto-contrib-manifest.json'); } catch (e) { /* optional */ }
const seenSlug = new Set(ITEMS.map(i => i.slug));
AUTO = AUTO.filter(a => a.slug && !seenSlug.has(a.slug));
const ALL = ITEMS.concat(AUTO);

// collection-level INDEX entries for the bulk series (point at the section)
const COLLECTIONS = [
  { title: "Synapse Annotation Quality-Tier Examples (Great / Fair)",
    url: "gallery/#tracer-contributions", section: "Gallery \\u00b7 Tracer Contributions",
    description: "A set of D. virilis EM synapse annotations sorted into “great” and “fair” quality tiers — a training reference for what clear vs. borderline synapse calls look like.",
    keywords: ["synapse", "annotation", "great", "fair", "quality tier", "training", "d. virilis", "drosophila virilis", "ground truth", "examples"] },
  { title: "Cell-Type EM vs Light-Microscopy Comparisons",
    url: "gallery/#tracer-contributions", section: "Gallery \\u00b7 Tracer Contributions",
    description: "A large set of fly cell types shown as EM reconstructions beside their light-microscopy references (aDT/aIP/aSP/pIP/pMP/pSP families), used to confirm cell-type identity across imaging modalities.",
    keywords: ["light microscopy", "lm", "em", "comparison", "cell type", "cell typing", "morphology", "fru", "dsx", "figure", "adt", "aip", "asp", "pip", "pmp", "psp"] },
];

const DRIVE_EXTRAS = [
  ['Extracellular space (ground-truth set) — animation', 'https://drive.google.com/file/d/1eia2O_kXwKvUZGBIWTFOagzJTj6z6UjK/view'],
  ['Ground-truthing error — animation', 'https://drive.google.com/file/d/1xSv5Z1r0V6UjIPVJ2TrReSW_PEKGE_oe/view'],
  ['First upsampling set (shows hallucinations) — animation', 'https://drive.google.com/file/d/1wyQ__a4IgOgARy3icnJvqFct6HPWOFP1/view'],
  ['Glia wheel (looks like myelin at first) — video', 'https://drive.google.com/file/d/18_ItuicQjVP0uZVy6QdEKVVH9qPp304A/view'],
];

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function card(it) {
  const descId = it.slug + '-desc';
  const meta = it.meta.concat(['Contributed by the team'])
    .map(m => `                    <span class="gallery-meta-item">${esc(m)}</span>`).join('\n');
  return `            <figure class="gallery-item" data-category="${it.cat}" id="fig-${it.slug}">
                <div class="gallery-image-container">
                    <a href="contributions/${it.file}" aria-describedby="${descId}">
                        <img src="contributions/${it.file}" alt="${esc(it.desc.slice(0, 140))}" loading="lazy">
                    </a>
                    <span class="gallery-category-badge" data-category="${it.cat}">${BADGE[it.cat]}</span>
                </div>
                <figcaption class="gallery-caption">
                    <h3 class="gallery-title">
                        <a href="contributions/${it.file}">${esc(it.title)}</a>
                    </h3>
                    <p class="gallery-description" id="${descId}">${esc(it.desc)}</p>
                    <div class="gallery-meta">
${meta}
                    </div>
                </figcaption>
            </figure>`;
}

function section() {
  const cards = ALL.map(card).join('\n\n');
  const extras = DRIVE_EXTRAS
    .map(([t, u]) => `            <li><a href="${u}" target="_blank" rel="noopener noreferrer">${esc(t)}</a></li>`).join('\n');
  return `    <!-- tracer-contributions START (generated) -->
    <section class="dataset-section" id="tracer-contributions" aria-labelledby="contributions-heading">
        <div class="dataset-header">
            <h2 id="contributions-heading">Tracer Contributions</h2>
            <span class="dataset-badge">From the team</span>
        </div>
        <p class="dataset-description">
            Images shared by the tracing team, in three flavors: <strong>Funny</strong> (shapes and faces spotted in EM),
            <strong>Training</strong> (annotated examples like synapse quality tiers), and <strong>Figure</strong>
            (illustrations and cross-modality comparisons). Use the Filter control above to show one flavor at a time.
        </p>

        <div class="gallery-grid">

${cards}

        </div>

        <p class="dataset-description" style="margin-top:1.25rem;">
            A few larger animations and videos are hosted on Drive rather than embedded here:
        </p>
        <ul style="margin:0.5rem 0 0 1.25rem; line-height:1.8;">
${extras}
        </ul>
    </section>
    <!-- tracer-contributions END -->`;
}

function indexEntry(it) {
  const kw = it.kw.map(k => `"${k}"`).join(', ');
  const text = (it.kw.join(' ') + ' ' + it.desc.replace(/["\\]/g, '')).toLowerCase();
  return `        {
            title: "${it.title.replace(/"/g, '\\"')}",
            url: "gallery/#fig-${it.slug}",
            section: "Gallery \\u00b7 Tracer Contributions",
            description: "${it.desc.replace(/"/g, '\\"')}",
            aliases: [],
            keywords: [${kw}],
            text: "${text.replace(/"/g, '\\"')}"
        }`;
}

function collectionEntry(c) {
  const kw = c.keywords.map(k => `"${k}"`).join(', ');
  return `        {
            title: "${c.title.replace(/"/g, '\\"')}",
            url: "${c.url}",
            section: "${c.section}",
            description: "${c.description.replace(/"/g, '\\"')}",
            aliases: [],
            keywords: [${kw}]
        }`;
}

function run() {
  let g = fs.readFileSync(GAL, 'utf8');
  // CSS badges
  if (!g.includes('data-category="funny"')) {
    const a = `        .gallery-category-badge[data-category="structure"] {\n            background-color: rgba(5, 150, 105, 0.9);\n        }`;
    g = g.replace(a, a + `\n        .gallery-category-badge[data-category="funny"] {\n            background-color: rgba(217, 119, 6, 0.9);\n        }\n        .gallery-category-badge[data-category="training"] {\n            background-color: rgba(13, 148, 136, 0.9);\n        }\n        .gallery-category-badge[data-category="figure"] {\n            background-color: rgba(79, 70, 229, 0.9);\n        }`);
  }
  // filter options
  if (!g.includes('<option value="funny">')) {
    const a = `            <option value="segmentation">Segmentation</option>`;
    g = g.replace(a, a + `\n            <option value="funny">Funny</option>\n            <option value="training">Training</option>\n            <option value="figure">Figure</option>`);
  }
  // jump-nav link
  if (!g.includes('#tracer-contributions')) {
    const a = `        <a href="#image-bounty">Image Bounty</a>`;
    g = g.replace(a, `        <a href="#tracer-contributions">Contributions</a>\n` + a);
  }
  // section: replace whole block if present, else insert before image-bounty
  const secRe = /    <!-- tracer-contributions START \(generated\) -->[\s\S]*?<!-- tracer-contributions END -->/;
  if (secRe.test(g)) {
    g = g.replace(secRe, section());
  } else {
    g = g.replace(`    <section class="dataset-section" id="image-bounty"`, section() + '\n\n    <section class="dataset-section" id="image-bounty"');
  }
  fs.writeFileSync(GAL, g);
  console.log('gallery updated: section has ' + ITEMS.length + ' cards');

  // search INDEX: insert entries for any items not already present
  let s = fs.readFileSync(SEARCH, 'utf8');
  const nl = s.includes('\r\n') ? '\r\n' : '\n';
  const figMissing = ITEMS.filter(it => !s.includes(`gallery/#fig-${it.slug}"`));
  const collMissing = COLLECTIONS.filter(c => !s.includes(c.title));
  const parts = figMissing.map(indexEntry).concat(collMissing.map(collectionEntry));
  if (!parts.length) { console.log('search.js: no new INDEX entries'); return; }
  const anchor = `var INDEX = [` + nl;
  const block = parts.join(',\n').split('\n').join(nl) + ',' + nl;
  s = s.replace(anchor, anchor + block);
  fs.writeFileSync(SEARCH, s);
  console.log('search.js: +' + parts.length + ' INDEX entries (' + figMissing.length + ' figures, ' + collMissing.length + ' collections)');
}
run();
