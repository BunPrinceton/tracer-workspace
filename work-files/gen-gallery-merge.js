/* Merges the 5 reference/diagram collections into gallery/index.html as new
   stacked dataset-sections (unified card chrome), removes the 2 featured-panel
   links, and inserts a sticky section jump-nav. Reads figure-descriptions.json.
   Does NOT touch the standalone reference-figures/ or optic-lobe-diagrams/ pages
   or any image files. Writes gallery/index.html in place. */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const galleryPath = path.join(ROOT, "gallery", "index.html");
let html = fs.readFileSync(galleryPath, "utf8");
const figs = JSON.parse(fs.readFileSync(path.join(__dirname, "figure-descriptions.json"), "utf8"));

function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function encFile(file) {
  return encodeURIComponent(file).replace(/\(/g, "%28").replace(/\)/g, "%29");
}

// Section metadata: anchor, heading, badge, description (with source).
const SECTIONS = [
  { coll: "Cell Segmentation Visual Glossary", anchor: "visual-glossary", badge: "Glossary", count: "82 figures",
    desc: "Visual reference for hand-painting cell segmentations — myelin padding, membranes, glia, mitochondria, synapses, and common imaging defects. Source: Cell Segmentation Visual Glossary v1.0 (Selden Koolman)." },
  { coll: "Optic Lobe Cell Name Guide", anchor: "ol-cell-name-guide", badge: "Cell Guide", count: "58 figures",
    desc: "Naming reference for <i>Drosophila</i> optic-lobe cell types, with Fischbach atlas plates, light microscopy, and 3D examples (Dm, Tm, TmY, LC, Y types). Source: Optic Lobe Cell Name Guide (Amy Robinson)." },
  { coll: "Fly Synapses", anchor: "fly-synapses", badge: "Synapse", count: "29 figures",
    desc: "EM examples of fly synapses and their indicators — dense vesicle clusters, synaptic clefts, T-bars, and postsynaptic densities. Source: Optional – Fly synapses (FlyWire @ Princeton)." },
  { coll: "FlyWire Cheatsheet", anchor: "flywire-cheatsheet", badge: "Cheatsheet", count: "16 figures",
    desc: "Quick-reference pages of FlyWire proofreading keyboard shortcuts and commands. Source: FlyWire Cheatsheet (flywire@princeton)." },
  { coll: "Optic Lobe Cell Diagrams", anchor: "optic-lobe-diagrams", badge: "Diagram", count: "16 diagrams",
    desc: "Full-resolution <i>Drosophila</i> optic-lobe cell-type morphology renders — Dm, Tm, Mti, SDm, Y, and LPi types. Source: Diagrams – Layers (Kyle Willie)." }
];

const CATEGORY = { "Fly Synapses": "synapse" }; // others default to "reference"

function card(f, badgeLabel) {
  const src = f.dir + "/" + encFile(f.file);
  const slug = "fig-" + f.file.replace(/\.png$/i, "").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase().replace(/^-+|-+$/g, "");
  const descId = slug + "-desc";
  const cat = CATEGORY[f.collection] || "reference";
  const alt = esc(f.description);
  return (
'            <figure class="gallery-item" data-category="' + cat + '" id="' + slug + '">\n' +
'                <div class="gallery-image-container">\n' +
'                    <a href="' + src + '" aria-describedby="' + descId + '">\n' +
'                        <img src="' + src + '" alt="' + alt + '" loading="lazy">\n' +
'                    </a>\n' +
'                    <span class="gallery-category-badge" data-category="' + cat + '">' + esc(badgeLabel) + '</span>\n' +
'                </div>\n' +
'                <figcaption class="gallery-caption">\n' +
'                    <h3 class="gallery-title">\n' +
'                        <a href="' + src + '">' + esc(f.title) + '</a>\n' +
'                    </h3>\n' +
'                    <p class="gallery-description" id="' + descId + '">' + esc(f.description) + '</p>\n' +
'                    <div class="gallery-meta">\n' +
'                        <span class="gallery-meta-item">' + esc(f.source) + '</span>\n' +
(f.described ? '' : '                        <span class="gallery-meta-item">reference figure</span>\n') +
'                    </div>\n' +
'                </figcaption>\n' +
'            </figure>\n'
  );
}

function section(meta) {
  const items = figs.filter(f => f.collection === meta.coll);
  let cards = items.map(f => card(f, meta.badge)).join("\n");
  return (
'\n    <!-- ============================================================\n' +
'         COLLECTION: ' + meta.coll + '\n' +
'         ============================================================ -->\n' +
'    <section class="dataset-section" id="' + meta.anchor + '" aria-labelledby="' + meta.anchor + '-heading">\n' +
'        <div class="dataset-header">\n' +
'            <h2 id="' + meta.anchor + '-heading">' + esc(meta.coll) + '</h2>\n' +
'            <span class="dataset-badge">' + meta.count + '</span>\n' +
'        </div>\n' +
'        <p class="dataset-description">' + meta.desc + '</p>\n' +
'        <div class="gallery-grid">\n\n' + cards + '\n        </div>\n' +
'    </section>\n'
  );
}

const newSections = SECTIONS.map(section).join("\n");

// Jump-nav covering every section on the page (existing + new), in display order.
const JUMP = [
  ["#banc", "BANC"], ["#fafb-2019", "FAFB 2019"], ["#reference", "Reference"],
  ["#visual-glossary", "Visual Glossary"], ["#ol-cell-name-guide", "OL Cell Names"],
  ["#fly-synapses", "Fly Synapses"], ["#flywire-cheatsheet", "FlyWire Cheatsheet"],
  ["#optic-lobe-diagrams", "OL Diagrams"], ["#image-bounty", "Image Bounty"]
];
const jumpNav =
'    <nav class="section-jump" aria-label="Jump to gallery section">\n' +
JUMP.map(j => '        <a href="' + j[0] + '">' + j[1] + '</a>').join("\n") + "\n" +
'    </nav>\n';

const jumpCss =
'        /* Sticky in-page section navigation for the long merged gallery */\n' +
'        .section-jump { position: sticky; top: 0; z-index: 50; display: flex; gap: 0.4rem; overflow-x: auto; padding: 0.6rem 0; margin: 0 0 1.25rem; background: rgba(245,245,245,0.97); backdrop-filter: blur(4px); border-bottom: 1px solid #e5e5e5; }\n' +
'        .section-jump a { flex: 0 0 auto; font-size: 0.8125rem; font-weight: 600; color: #374151; background: #fff; border: 1px solid #d4d4d4; border-radius: 999px; padding: 0.3rem 0.75rem; text-decoration: none; white-space: nowrap; }\n' +
'        .section-jump a:hover { border-color: #2563eb; color: #2563eb; }\n' +
'        @media print { .section-jump { display: none; } }\n';

// --- apply edits ---
let changed = {};

// 1. Remove the two featured-collection panels (comment + aside).
const before1 = html.length;
html = html.replace(/[ \t]*<!--\s*=+\s*FEATURED COLLECTION[\s\S]*?<\/aside>\n?/g, "");
changed.featuredRemoved = html.length < before1;

// 2. Insert jump-nav before the FILTER CONTROLS comment.
const filterIdx = html.indexOf('<div class="filter-bar">');
const fComment = html.lastIndexOf("<!--", filterIdx);
html = html.slice(0, fComment) + jumpNav + "\n    " + html.slice(fComment);
changed.jumpNavInserted = true;

// 3. Insert the 5 new sections before the IMAGE BOUNTY comment.
const bountyIdx = html.indexOf("IMAGE BOUNTY LIST");
const bComment = html.lastIndexOf("<!--", bountyIdx);
html = html.slice(0, bComment) + newSections + "\n\n    " + html.slice(bComment);
changed.sectionsInserted = true;

// 4. Add jump-nav CSS before </style>.
html = html.replace("</style>", jumpCss + "    </style>");

fs.writeFileSync(galleryPath, html);
console.log("Edits applied:", JSON.stringify(changed));
console.log("New cards added:", figs.length);
console.log("Sections:", SECTIONS.map(s => s.coll + " (" + figs.filter(f => f.collection === s.coll).length + ")").join(", "));
