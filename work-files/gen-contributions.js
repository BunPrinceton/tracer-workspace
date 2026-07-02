/* gen-contributions.js — insert the "Tracer Contributions" gallery section,
   its badge CSS, filter options, jump-nav link, and search INDEX entries.
   Idempotent: guarded by the marker "tracer-contributions" so re-runs no-op.
   Run: node work-files/gen-contributions.js  (from repo root)
*/
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const GAL = path.join(ROOT, 'gallery', 'index.html');
const SEARCH = path.join(ROOT, 'search.js');

// class -> badge label
const BADGE = { funny: 'Funny', training: 'Training', figure: 'Figure' };

// contributed images (all live in gallery/contributions/)
const ITEMS = [
  // ---- FUNNY ----
  { file: 'contrib-wolverine-claws.png', cat: 'funny', slug: 'contrib-wolverine-claws',
    title: "Wolverine's Claws",
    desc: "A segmented neuron whose parallel blade-like processes look uncannily like Wolverine's adamantium claws — a favorite “shapes seen in EM” find from the tracing team.",
    meta: ['Pareidolia', 'EM'], who: 'team',
    kw: ['funny', 'wolverine', 'claws', 'pareidolia', 'shapes seen in em', 'neuron'] },
  { file: 'contrib-ghost-face.png', cat: 'funny', slug: 'contrib-ghost-face',
    title: "The Ghost",
    desc: "An EM cross-section whose membrane outline reads as a wide-eyed cartoon ghost, from the team's running “faces seen in EM” collection.",
    meta: ['Pareidolia', 'EM'], who: 'team',
    kw: ['funny', 'ghost', 'face', 'pareidolia', 'faces seen in em'] },
  { file: 'contrib-dalmatian-running.png', cat: 'funny', slug: 'contrib-dalmatian-running',
    title: "Running Dalmatian",
    desc: "Cell profiles that come together into the silhouette of a running dalmatian — more connectomics pareidolia.",
    meta: ['Pareidolia', 'EM'], who: 'team',
    kw: ['funny', 'dalmatian', 'dog', 'running', 'pareidolia'] },
  { file: 'contrib-eggman.png', cat: 'funny', slug: 'contrib-eggman',
    title: "Eggman",
    desc: "A rounded EM profile the team nicknamed “Eggman” — a lighthearted find from the screenshots pile.",
    meta: ['Pareidolia', 'EM'], who: 'Austin',
    kw: ['funny', 'eggman', 'egg', 'pareidolia'] },
  // ---- TRAINING ----
  { file: 'contrib-synapse-great-1.png', cat: 'training', slug: 'contrib-synapse-great-1',
    title: "Synapse Annotation — Great Example (1)",
    desc: "High-magnification D. virilis EM synapse with a clean pre→post annotation (cyan). A clear presynaptic vesicle cluster and well-defined cleft make this a textbook “great” quality tier for synapse ground truth.",
    meta: ['D. virilis', 'Synapse', 'Great tier'], who: 'Kyle',
    kw: ['training', 'synapse', 'annotation', 'great', 'quality', 'vesicles', 'cleft', 'presynaptic', 'postsynaptic', 'drosophila virilis', 'ground truth'] },
  { file: 'contrib-synapse-great-7.png', cat: 'training', slug: 'contrib-synapse-great-7',
    title: "Synapse Annotation — Great Example (2)",
    desc: "Another crisp, high-clarity D. virilis synapse example at the “great” quality tier — unambiguous vesicle cloud and cleft, cleanly annotated.",
    meta: ['D. virilis', 'Synapse', 'Great tier'], who: 'Kyle',
    kw: ['training', 'synapse', 'annotation', 'great', 'quality', 'vesicles', 'cleft', 'drosophila virilis'] },
  { file: 'contrib-synapse-fair-1.png', cat: 'training', slug: 'contrib-synapse-fair-1',
    title: "Synapse Annotation — Fair Example (1)",
    desc: "A lower-clarity, grainier D. virilis EM synapse (green annotation to two postsynaptic partners). Representative of the “fair” quality tier where the synapse is harder to resolve — a useful borderline reference for annotators.",
    meta: ['D. virilis', 'Synapse', 'Fair tier'], who: 'Kyle',
    kw: ['training', 'synapse', 'annotation', 'fair', 'quality', 'borderline', 'polyadic', 'postsynaptic', 'drosophila virilis'] },
  { file: 'contrib-synapse-fair-12.png', cat: 'training', slug: 'contrib-synapse-fair-12',
    title: "Synapse Annotation — Fair Example (2)",
    desc: "Another “fair” quality-tier D. virilis synapse in noisier tissue — the sort of marginal call annotators need to recognize and handle consistently.",
    meta: ['D. virilis', 'Synapse', 'Fair tier'], who: 'Kyle',
    kw: ['training', 'synapse', 'annotation', 'fair', 'quality', 'borderline', 'drosophila virilis'] },
  // ---- FIGURE ----
  { file: 'contrib-tracer-team-workflow.png', cat: 'figure', slug: 'contrib-tracer-team-workflow',
    title: "Tracer Team Workflow Breakdown",
    desc: "How the tracing team splits its effort: Proofreading (35%) toward a correct connectome, Ground Truthing (50%) for AI training, and Annotations (15%) for analysis — with the sub-tasks under each (axons, dendrites, spines, soma, synapses, mitochondria, myelin, glia, blood vessels, cell types).",
    meta: ['Overview', 'Workflow'], who: 'team',
    kw: ['figure', 'workflow', 'proofreading', 'ground truthing', 'annotations', 'overview', 'tracer team', 'pie chart'] },
  { file: 'contrib-lm-em-aip5.png', cat: 'figure', slug: 'contrib-lm-em-aip5',
    title: "aIP5 — EM vs Light Microscopy",
    desc: "Side-by-side comparison of the aIP5 cell type reconstructed from EM against a light-microscopy reference, used to confirm cell-type identity across imaging modalities.",
    meta: ['Cell typing', 'LM vs EM'], who: 'Austin',
    kw: ['figure', 'light microscopy', 'lm', 'em', 'comparison', 'cell type', 'aip5', 'morphology', 'fru', 'dsx'] },
  { file: 'contrib-lm-em-asp8.png', cat: 'figure', slug: 'contrib-lm-em-asp8',
    title: "aSP8 — EM vs Light Microscopy",
    desc: "The aSP8 cell type matched between its EM reconstruction and a light-microscopy image — part of the fru/dsx cell-typing comparison set.",
    meta: ['Cell typing', 'LM vs EM'], who: 'Austin',
    kw: ['figure', 'light microscopy', 'lm', 'em', 'comparison', 'cell type', 'asp8', 'morphology'] },
  { file: 'contrib-lm-em-psp3.png', cat: 'figure', slug: 'contrib-lm-em-psp3',
    title: "pSP3 — EM vs Light Microscopy",
    desc: "pSP3 morphology compared across EM and light microscopy to validate the cell-type call.",
    meta: ['Cell typing', 'LM vs EM'], who: 'Austin',
    kw: ['figure', 'light microscopy', 'lm', 'em', 'comparison', 'cell type', 'psp3', 'morphology'] },
  { file: 'contrib-lm-em-adt5.png', cat: 'figure', slug: 'contrib-lm-em-adt5',
    title: "aDT5 — EM vs Light Microscopy",
    desc: "The aDT5 cell type shown as an EM reconstruction beside its light-microscopy reference stack.",
    meta: ['Cell typing', 'LM vs EM'], who: 'Austin',
    kw: ['figure', 'light microscopy', 'lm', 'em', 'comparison', 'cell type', 'adt5', 'morphology'] },
  { file: 'contrib-lm-em-pmp5.png', cat: 'figure', slug: 'contrib-lm-em-pmp5',
    title: "pMP5 (female) — EM vs Light Microscopy",
    desc: "pMP5 in the female brain, EM reconstruction against its light-microscopy match.",
    meta: ['Cell typing', 'LM vs EM'], who: 'Austin',
    kw: ['figure', 'light microscopy', 'lm', 'em', 'comparison', 'cell type', 'pmp5', 'female', 'morphology'] },
  { file: 'contrib-lm-em-asp4.png', cat: 'figure', slug: 'contrib-lm-em-asp4',
    title: "aSP4 — EM vs Light Microscopy",
    desc: "aSP4 morphology compared between EM and light microscopy — a case where the LM is noisy and the match takes care to call.",
    meta: ['Cell typing', 'LM vs EM'], who: 'Austin',
    kw: ['figure', 'light microscopy', 'lm', 'em', 'comparison', 'cell type', 'asp4', 'morphology'] },
];

// extra animations/videos that live on Drive (too large to embed)
const DRIVE_EXTRAS = [
  ['Extracellular space (ground-truth set) — animation', 'https://drive.google.com/file/d/1eia2O_kXwKvUZGBIWTFOagzJTj6z6UjK/view'],
  ['Ground-truthing error — animation', 'https://drive.google.com/file/d/1xSv5Z1r0V6UjIPVJ2TrReSW_PEKGE_oe/view'],
  ['First upsampling set (shows hallucinations) — animation', 'https://drive.google.com/file/d/1wyQ__a4IgOgARy3icnJvqFct6HPWOFP1/view'],
  ['Big Dipper cell — full-resolution image', 'https://drive.google.com/file/d/1FobyQK3yS6am6ANv0Tj2e7ukyZzsk9KI/view'],
  ['Glia wheel (looks like myelin at first) — video', 'https://drive.google.com/file/d/18_ItuicQjVP0uZVy6QdEKVVH9qPp304A/view'],
];

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const altFor = it => esc(it.desc.slice(0, 140));

function card(it) {
  const descId = it.slug + '-desc';
  const meta = it.meta.concat(['Contributed: ' + it.who])
    .map(m => `                    <span class="gallery-meta-item">${esc(m)}</span>`).join('\n');
  return `            <figure class="gallery-item" data-category="${it.cat}" id="fig-${it.slug}">
                <div class="gallery-image-container">
                    <a href="contributions/${it.file}" aria-describedby="${descId}">
                        <img src="contributions/${it.file}" alt="${altFor(it)}" loading="lazy">
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
  const cards = ITEMS.map(card).join('\n\n');
  const extras = DRIVE_EXTRAS
    .map(([t, u]) => `            <li><a href="${u}" target="_blank" rel="noopener noreferrer">${esc(t)}</a></li>`)
    .join('\n');
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
    <!-- tracer-contributions END -->
`;
}

function indexEntries() {
  return ITEMS.map(it => {
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
  }).join(',\n');
}

function run() {
  let g = fs.readFileSync(GAL, 'utf8');
  if (g.includes('tracer-contributions START')) {
    console.log('gallery already has contributions section — skipping HTML insert');
  } else {
    // 1. badge CSS after the structure badge rule
    const cssAnchor = `        .gallery-category-badge[data-category="structure"] {\n            background-color: rgba(5, 150, 105, 0.9);\n        }`;
    const cssAdd = cssAnchor + `\n        .gallery-category-badge[data-category="funny"] {\n            background-color: rgba(217, 119, 6, 0.9);\n        }\n        .gallery-category-badge[data-category="training"] {\n            background-color: rgba(13, 148, 136, 0.9);\n        }\n        .gallery-category-badge[data-category="figure"] {\n            background-color: rgba(79, 70, 229, 0.9);\n        }`;
    if (!g.includes(cssAnchor)) throw new Error('CSS anchor not found');
    g = g.replace(cssAnchor, cssAdd);

    // 2. select options after the segmentation option
    const optAnchor = `            <option value="segmentation">Segmentation</option>`;
    g = g.replace(optAnchor, optAnchor + `\n            <option value="funny">Funny</option>\n            <option value="training">Training</option>\n            <option value="figure">Figure</option>`);

    // 3. jump-nav link before Image Bounty
    const navAnchor = `        <a href="#image-bounty">Image Bounty</a>`;
    g = g.replace(navAnchor, `        <a href="#tracer-contributions">Contributions</a>\n` + navAnchor);

    // 4. section before the image-bounty section
    const secAnchor = `    <section class="dataset-section" id="image-bounty"`;
    g = g.replace(secAnchor, section() + '\n' + secAnchor);

    fs.writeFileSync(GAL, g);
    console.log('gallery/index.html updated: +CSS, +options, +jump link, +section (' + ITEMS.length + ' cards)');
  }

  // 5. search INDEX entries
  let s = fs.readFileSync(SEARCH, 'utf8');
  if (s.includes('gallery/#fig-contrib-wolverine-claws')) {
    console.log('search.js already has contribution entries — skipping');
  } else {
    const nl = s.includes('\r\n') ? '\r\n' : '\n';
    const anchor = `var INDEX = [` + nl;
    if (!s.includes(anchor)) throw new Error('INDEX anchor not found');
    const entries = indexEntries().split('\n').join(nl);
    s = s.replace(anchor, anchor + entries + ',' + nl);
    fs.writeFileSync(SEARCH, s);
    console.log('search.js updated: +' + ITEMS.length + ' INDEX entries');
  }
}
run();
