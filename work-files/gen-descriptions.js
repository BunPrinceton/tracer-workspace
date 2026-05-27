/* Generates work-files/figure-descriptions.json from the seed export + manifest.
   - DESC: hand-authored title+description for figures with specific seeds.
   - Generic/skipped/diagram figures get consistent collection templates.
   - Keywords auto-derived from a domain vocabulary scanned over the description,
     plus per-collection base tags. */
const fs = require("fs");
const path = require("path");

const DESKTOP = "C:/Users/Benjamin/Desktop";
const seeds = JSON.parse(fs.readFileSync(path.join(DESKTOP, "figure-descriptions-seeds.json"), "utf8")).described;
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "figure-manifest.json"), "utf8"));

// Short source label (Author) for the trailing attribution.
const SRC_LABEL = {
  "Cell Segmentation Visual Glossary": "Visual Glossary v1.0 (Selden Koolman)",
  "Optic Lobe Cell Name Guide": "OL Cell Name Guide (Amy Robinson)",
  "Fly Synapses": "Optional – Fly synapses (FlyWire @ Princeton)",
  "FlyWire Cheatsheet": "FlyWire Cheatsheet",
  "Optic Lobe Cell Diagrams": "Diagrams – Layers (Kyle Willie)"
};

// [title, description] for figures with specific seeds. Description is the
// gallery caption; the source is appended automatically at emit time.
const DESC = {
  // ---------- Cell Segmentation Visual Glossary ----------
  "visual-glossary-005.png": ["Myelin sheath folds (EM)", "High-resolution EM cross-section of a myelinated axon showing the folds between the outer and inner tongues of the myelin sheath and the surrounding glia — a reference for how to pad segmentation around myelin."],
  "visual-glossary-006.png": ["Fat globule / membrane swirl", "An ambiguous region — likely a fat globule or membrane swirl — where one segment sits inside another with no clear border between them, illustrating two distinct segments that are easy to mistake for one."],
  "visual-glossary-008.png": ["Segmentation question (yellow circle)", "A submitted example asking how to handle the region circled in yellow — a borderline call for where one segment ends and another begins."],
  "visual-glossary-009.png": ["Segmentation question (purple circle)", "A submitted example asking how to handle the region circled in light purple — another ambiguous segmentation boundary."],
  "visual-glossary-010.png": ["Possible fat globule artifact", "A likely fat globule or imaging artifact that can be mistaken for cellular structure during voxel painting."],
  "visual-glossary-011.png": ["Possible fat globule artifact", "A fat globule or imaging artifact — a reminder that not every dark blob is a segmentable structure."],
  "visual-glossary-012.png": ["Possible fat globule artifact", "Another fat globule or imaging artifact shown for comparison."],
  "visual-glossary-016.png": ["Long thin axon (3D)", "A 3D segmentation of a long, thin axon backbone rendered in Neuroglancer."],
  "visual-glossary-017.png": ["Axon bundle cross-section", "A perpendicular-plane cut through an axonal bundle, showing many axons in cross-section."],
  "visual-glossary-018.png": ["Axon bouton (2D)", "An axonal bouton highlighted in a 2D EM slice."],
  "visual-glossary-019.png": ["Axon bouton neurite (3D)", "A 3D render of an axonal neurite carrying a bouton."],
  "visual-glossary-020.png": ["Axon–dendrite synapse", "An example synapse between an axon and the backbone of another cell — presumably a dendrite, and possibly an inhibitory synapse onto the shaft."],
  "visual-glossary-021.png": ["Myelinated axon among boutons", "A myelinated axon surrounded by other axonal boutons."],
  "visual-glossary-022.png": ["Myelinated axons, two cut planes", "Two myelin-wrapped axons captured in the same field — one cut in the parallel plane and one in the perpendicular plane."],
  "visual-glossary-023.png": ["Annotated synapse (vesicles + axon)", "An annotated EM image of a synapse, with the vesicle cluster and presynaptic axon labelled."],
  "visual-glossary-024.png": ["Annotated synapse site", "An annotated EM image pointing out the vesicles and axon at a synaptic site."],
  "visual-glossary-025.png": ["Annotated synapse site", "Another annotated synaptic site with the vesicles and axon called out."],
  "visual-glossary-026.png": ["Branch point (3D mesh)", "A 3D mesh of part of a cell in Neuroglancer, centred on the backbone where an axon-like branch splits off."],
  "visual-glossary-027.png": ["Backbone with organelles", "A large slice through a cell's backbone showing microtubules along with ER and lysosomes or mitochondria."],
  "visual-glossary-028.png": ["Bouton chain at branch tips", "The tips of an axonal branch showing a chain of boutons, alongside a branch with none — likely flagging a spot that needs more proofreading."],
  "visual-glossary-029.png": ["Neurite inside glia (autophagy)", "An EM view of a neurite enclosed within a glial cell, illustrating how a neurite can end where it was being broken down during imaging — likely autophagy."],
  "visual-glossary-030.png": ["Slender axonal branch (3D)", "A slender, probably axonal neuronal branch rendered in 3D."],
  "visual-glossary-031.png": ["Small branch, 2D + 3D", "A neuron shown side by side in 2D and 3D, with a perpendicular-plane view of one of its small branches."],
  "visual-glossary-032.png": ["Branch split / axon hillock", "A branch split point shown in 2D and 3D side by side, possibly marking where the axon hillock sits."],
  "visual-glossary-033.png": ["Synapse sites (yellow circles)", "An EM field with yellow circles highlighting several synaptic areas."],
  "visual-glossary-034.png": ["Synapses with large PSDs", "An EM field with blue arrows pointing to synapses that have large postsynaptic densities."],
  "visual-glossary-035.png": ["Annotated axon–dendrite synapse", "An annotated image showing a dendrite, an axon, and the point where they synapse."],
  "visual-glossary-036.png": ["Annotated axon–dendrite synapse", "Another annotated axon-to-dendrite synapse with the partners labelled."],
  "visual-glossary-037.png": ["Spine head onto axon (3D)", "A 3D view of a dendritic spine head synapsing onto the backbone of an axon."],
  "visual-glossary-038.png": ["Axon–dendrite synapse (2D, overlay)", "A 2D EM slice with the synapsing axon and dendrite picked out by segmentation overlay."],
  "visual-glossary-039.png": ["Axon–dendrite synapse (2D, overlay)", "Another 2D slice with the synapsing axon and dendrite highlighted."],
  "visual-glossary-040.png": ["Axon–dendrite synapse (raw EM)", "A 2D synapse between an axon and dendrite shown on raw EM with no segmentation overlay."],
  "visual-glossary-041.png": ["Axon–dendrite synapse (2D)", "A 2D EM view of an axon and dendrite synapsing."],
  "visual-glossary-042.png": ["Parallel-plane synapse smudge", "A parallel-plane synapse between axon and dendrite, showing the characteristic 'smudge' that forms where the synaptic gap runs in-plane with the cut."],
  "visual-glossary-043.png": ["Parallel-plane synapse (overlay)", "A parallel-plane axon–dendrite synapse with segmentation overlay."],
  "visual-glossary-044.png": ["Axon–dendrite synapse (3D)", "A 3D render of an axon and dendrite synapsing."],
  "visual-glossary-045.png": ["Synaptic gap / PSD (pink arrow)", "A 2D axon–dendrite synapse with a pink arrow pointing at the synaptic gap and postsynaptic density."],
  "visual-glossary-046.png": ["Synaptic gap / PSD (pink arrow)", "Another 2D synapse with a pink arrow marking the synaptic gap and PSD."],
  "visual-glossary-047.png": ["Synapse (bounding box)", "A small bounding box highlighting a single synapse."],
  "visual-glossary-048.png": ["Synapse (bounding box)", "Another bounding-box highlight around a synapse."],
  "visual-glossary-049.png": ["Uncertain synapse (annotated)", "An annotated 2D EM image of a highlighted segment where the annotator was unsure whether a synapse was present."],
  "visual-glossary-050.png": ["Synapse indicators (orange arrows)", "A 2D synapse with the axon highlighted and orange arrows pointing to the features that confirm it — vesicles, PSD, and so on."],
  "visual-glossary-051.png": ["Neuronal soma (EM)", "A clean, high-quality EM image of a neuronal soma."],
  "visual-glossary-052.png": ["Soma organelles (zoom)", "A zoomed-in view of the organelles inside a soma."],
  "visual-glossary-053.png": ["Soma organelles (zoom)", "Another zoomed-in view of soma organelles."],
  "visual-glossary-054.png": ["Soma, 2D + 3D", "A soma shown side by side in 2D EM and 3D."],
  "visual-glossary-055.png": ["Morphology reference plate", "A textbook-style reference plate describing cell morphology, annotating 3D renders for many of the glossary's terms."],
  "visual-glossary-056.png": ["Large soma", "A large neuronal soma."],
  "visual-glossary-057.png": ["Many somas", "A field containing many somas."],
  "visual-glossary-058.png": ["Glia, 2D + 3D", "A glial cell shown side by side in 2D and 3D."],
  "visual-glossary-059.png": ["Glia (3D)", "A glial cell rendered in 3D."],
  "visual-glossary-060.png": ["Glia, possible merger (3D)", "A large mass of glia in 3D — possibly a merger of several glial cells."],
  "visual-glossary-061.png": ["Large glia merger", "A large glia merger."],
  "visual-glossary-062.png": ["Glia outline (2D)", "A glial cell traced with a dotted outline in 2D."],
  "visual-glossary-063.png": ["Annotated glia", "An annotated EM image of glial cells."],
  "visual-glossary-064.png": ["Glia outline (2D)", "Another glial cell traced with a dotted outline in 2D."],
  "visual-glossary-065.png": ["Glia from multiple angles", "A large EM collage of a single glial cell viewed from several angles."],
  "visual-glossary-066.png": ["Synapses + glia reference", "A collage of synapses with the glia highlighted in some frames — a quick reference for spotting glia at a glance."],
  "visual-glossary-067.png": ["Glia highlight comparison", "The same EM view shown twice, side by side, with the glia highlighted in one and not the other."],
  "visual-glossary-068.png": ["Folded glial membranes", "A 2D-and-3D pair showing the layers of membrane glia form when folded into one another."],
  "visual-glossary-069.png": ["Myelinated axon cross-cut (HD)", "A high-definition 2D cross-cut of a myelinated neuron."],
  "visual-glossary-070.png": ["Myelinated axon cross-cut", "A 2D cross-cut of a myelinated neuron."],
  "visual-glossary-071.png": ["Myelinated axon cross-cut (HD)", "Another high-definition 2D cross-cut of a myelinated neuron."],
  "visual-glossary-072.png": ["Blood vessel", "A large EM image of a blood vessel."],
  "visual-glossary-073.png": ["Blood vessel", "Another large EM image of a blood vessel."],
  "visual-glossary-074.png": ["Glial soma + dense organelle", "A 2D view of what appears to be a glial soma containing a very densely stained organelle."],
  "visual-glossary-075.png": ["Membrane swirl", "A membrane swirl."],
  "visual-glossary-076.png": ["Membrane swirl / artifact", "A membrane swirl or imaging error, possibly involving a fat globule."],
  "visual-glossary-077.png": ["Three mitochondria", "Three mitochondria shown together in cross-section — a clean reference for mitochondrial membrane texture and staining."],
  "visual-glossary-078.png": ["Mitochondrion (parallel cut)", "A mitochondrion captured in the parallel plane."],
  "visual-glossary-079.png": ["Mitochondrion (perpendicular cut)", "A mitochondrion captured in the perpendicular plane."],
  "visual-glossary-080.png": ["Mitochondria", "More mitochondria shown for reference."],
  "visual-glossary-081.png": ["Mitochondria (arrow field)", "A field of arrows pointing to several mitochondria, used as a training aid for spotting them."],
  "visual-glossary-082.png": ["Dark spots in myelinated axon", "Red circles highlight a questionable dark-spot pattern inside a myelinated axon — likely imaging errors caused by fat globules."],

  // ---------- Optic Lobe Cell Name Guide ----------
  "ol-cell-name-guide-001.png": ["Title fly cartoon", "An illustrated cartoon fly opening the Optic Lobe Cell Name Guide."],
  "ol-cell-name-guide-002.png": ["Lightbulb menu options", "A screenshot of the lightbulb menu's drop-down list of options."],
  "ol-cell-name-guide-003.png": ["Fischbach cell-type collage", "A collage of the canonical optic-lobe cell types reproduced from the Fischbach reference, used as a visual naming key."],
  "ol-cell-name-guide-004.png": ["3D neuropil + cell names", "A collage of 3D neuropil renders labelled with cell names, showing where each cell type sits."],
  "ol-cell-name-guide-005.png": ["Medulla / lamina layering", "A side view of the medulla and lamina illustrating the region's layered structure and the tightly stratified layers individual cell types occupy."],
  "ol-cell-name-guide-006.png": ["Dm cell lattice patterns", "Dm cells shown together, illustrating their structural variations and the lattice-like patterns they form across the medulla."],
  "ol-cell-name-guide-007.png": ["Dm type examples (3D)", "A large panel of 3D examples spanning the different Dm cell types."],
  "ol-cell-name-guide-008.png": ["Medulla layers + photoreceptors", "A Fischbach plate showing the layers of the medulla and the photoreceptor cells."],
  "ol-cell-name-guide-009.png": ["Mi / TmY / Li cells (Fischbach)", "A Fischbach plate showing medulla-intrinsic, trans-lobula-plate, and lobula-intrinsic cells."],
  "ol-cell-name-guide-010.png": ["Lawf / Lai cells (Fischbach)", "A Fischbach plate showing Mawf1, Lawf2, and Lai cells and where they innervate."],
  "ol-cell-name-guide-011.png": ["Dm / Pm / Lcn cells (Fischbach)", "A Fischbach plate showing Dm cells along with Pm, Lcn, Lt, and TLp cells."],
  "ol-cell-name-guide-012.png": ["Fischbach reference plate", "A reference plate from the Fischbach optic-lobe atlas of Drosophila cell types."],
  "ol-cell-name-guide-013.png": ["Fischbach reference plate", "A reference plate from the Fischbach optic-lobe atlas of Drosophila cell types."],
  "ol-cell-name-guide-014.png": ["Fischbach reference plate", "A reference plate from the Fischbach optic-lobe atlas of Drosophila cell types."],
  "ol-cell-name-guide-015.png": ["Fischbach reference plate", "A reference plate from the Fischbach optic-lobe atlas of Drosophila cell types."],
  "ol-cell-name-guide-016.png": ["Layer innervation (light micro.)", "A light-microscopy image showing the various layers and the neurons that innervate at specific layers."],
  "ol-cell-name-guide-017.png": ["Tm5 subtypes (3D)", "3D renders illustrating the small differences between the Tm5 subtypes."],
  "ol-cell-name-guide-018.png": ["Fischbach reference plate", "A reference plate from the Fischbach optic-lobe atlas of Drosophila cell types."],
  "ol-cell-name-guide-019.png": ["Fischbach reference plate", "A reference plate from the Fischbach optic-lobe atlas of Drosophila cell types."],
  "ol-cell-name-guide-020.png": ["Whole Tm neuron (3D)", "A complete Tm neuron rendered in 3D."],
  "ol-cell-name-guide-021.png": ["Fischbach reference plate", "A reference plate from the Fischbach optic-lobe atlas of Drosophila cell types."],
  "ol-cell-name-guide-022.png": ["Fischbach reference plate", "A reference plate from the Fischbach optic-lobe atlas of Drosophila cell types."],
  "ol-cell-name-guide-023.png": ["Fischbach reference plate", "A reference plate from the Fischbach optic-lobe atlas of Drosophila cell types."],
  "ol-cell-name-guide-024.png": ["Fischbach reference plate", "A reference plate from the Fischbach optic-lobe atlas of Drosophila cell types."],
  "ol-cell-name-guide-025.png": ["TmY14 + subtype", "TmY14 shown side by side with a possible subtype."],
  "ol-cell-name-guide-026.png": ["TmY innervation variation", "A cartoon showing how a TmY subtype can vary by where it innervates."],
  "ol-cell-name-guide-027.png": ["TmY14", "A render of the TmY14 cell."],
  "ol-cell-name-guide-028.png": ["TmY15", "A render of the TmY15 cell."],
  "ol-cell-name-guide-029.png": ["TmY15", "Another render of the TmY15 cell."],
  "ol-cell-name-guide-030.png": ["TmY16", "A render of the TmY16 cell."],
  "ol-cell-name-guide-031.png": ["TmY18", "A render of the TmY18 cell."],
  "ol-cell-name-guide-032.png": ["TmY cell variety", "A panel showing a variety of TmY cells together."],
  "ol-cell-name-guide-033.png": ["TmY20", "A render of the TmY20 cell."],
  "ol-cell-name-guide-034.png": ["Tm cells (light micro.)", "Light-microscopy images of Tm cells."],
  "ol-cell-name-guide-035.png": ["Fischbach reference plate", "A reference plate from the Fischbach optic-lobe atlas of Drosophila cell types."],
  "ol-cell-name-guide-036.png": ["Fischbach reference plate", "A reference plate from the Fischbach optic-lobe atlas of Drosophila cell types."],
  "ol-cell-name-guide-037.png": ["Y11 (light micro.)", "A light-microscopy image of the Y11 cell."],
  "ol-cell-name-guide-038.png": ["Y12 (light micro.)", "A light-microscopy image of the Y12 cell."],
  "ol-cell-name-guide-040.png": ["Fischbach reference plate", "A reference plate from the Fischbach optic-lobe atlas of Drosophila cell types."],
  "ol-cell-name-guide-041.png": ["Fischbach reference plate", "A reference plate from the Fischbach optic-lobe atlas of Drosophila cell types."],
  "ol-cell-name-guide-042.png": ["Fischbach reference plate", "A reference plate from the Fischbach optic-lobe atlas of Drosophila cell types."],
  "ol-cell-name-guide-043.png": ["LC cell variety (Fischbach)", "A Fischbach plate showing the variety of LC (lobula columnar) cells."],
  "ol-cell-name-guide-044.png": ["Mt cells (Fischbach)", "A Fischbach plate showing Mt cells."],
  "ol-cell-name-guide-045.png": ["Fischbach reference plate", "A reference plate from the Fischbach optic-lobe atlas of Drosophila cell types."],
  "ol-cell-name-guide-046.png": ["Fischbach reference plate", "A reference plate from the Fischbach optic-lobe atlas of Drosophila cell types."],
  "ol-cell-name-guide-047.png": ["Fischbach reference plate", "A reference plate from the Fischbach optic-lobe atlas of Drosophila cell types."],
  "ol-cell-name-guide-048.png": ["LC + LT cells", "A figure showing LC (lobula columnar) and LT (lobula tangential) cells."],

  // ---------- Fly Synapses (specific) ----------
  "fly-synapses-001.png": ["Synaptic region (EM)", "An EM view of a fly synaptic region."],
  "fly-synapses-002.png": ["Synaptic region (EM)", "Another EM view of a fly synaptic region."],
  "fly-synapses-011.png": ["Dense-core vesicles", "A fly synapse example highlighting dense-core vesicles among the usual indicators (vesicle cluster, cleft, T-bar, PSD)."],
  "fly-synapses-012.png": ["Vesicles binding", "A fly synapse example showing vesicles binding at the release site, alongside the cleft, T-bar, and PSD."],
  "fly-synapses-026.png": ["Synapse GT painting extent", "A fly synapse annotated to show how much to paint for synapse ground-truth — the extent of the vesicle cluster, cleft, T-bar, and PSD."]
};

// Per-collection generic description templates (for click-filled / skipped figures).
function genericDesc(coll) {
  switch (coll) {
    case "Cell Segmentation Visual Glossary":
      return "A reference figure from the Cell Segmentation Visual Glossary illustrating a hand-painting segmentation rule or example (myelin, membrane, glia, mitochondria, or an imaging defect).";
    case "Optic Lobe Cell Name Guide":
      return "A reference figure from the Optic Lobe Cell Name Guide for identifying and naming Drosophila optic-lobe cell types.";
    case "Fly Synapses":
      return "An EM example of a fly synapse showing the key indicators: a dense vesicle cluster, synaptic cleft, T-bar, and postsynaptic density.";
    case "FlyWire Cheatsheet":
      return "A page from the FlyWire proofreading cheatsheet — keyboard shortcuts and command reference for working in the FlyWire interface.";
    default:
      return "Reference figure.";
  }
}

// Diagram description from the cell-type filename (+ view if present).
function diagramDesc(file) {
  const stem = file.replace(/\.png$/i, "").replace(/%20/g, " ");
  const viewM = /(anterior|posterior|side|lateral|ventral|dorsal)/i.exec(stem);
  const base = stem.replace(/[_ ](anterior|posterior|side|lateral|ventral|dorsal)$/i, "");
  const view = viewM ? (", " + viewM[1].toLowerCase() + " view") : "";
  return ["Morphology render of the Drosophila optic-lobe cell type " + base + (view ? (" (" + viewM[1].toLowerCase() + " view)") : "") + ".", base, view ? viewM[1].toLowerCase() : ""];
}

// Domain vocabulary for keyword extraction (scanned over the description text).
const VOCAB = ["myelin","axon","dendrite","dendritic","synapse","synaptic","vesicle","vesicles","cleft","t-bar","psd","postsynaptic","glia","glial","soma","somas","mitochondria","mitochondrion","bouton","boutons","spine","blood vessel","neurite","backbone","microtubule","lysosome","membrane","fat globule","autophagy","neuropil","medulla","lamina","lobula","photoreceptor","fischbach","segmentation","proofreading","cheatsheet","shortcut","merger","artifact","3d","cross-section","branch","hillock","cartoon"];
const CELLTYPES = ["dm2a","dm2b","dm3p","dm4","dm9","dm102b","mti123","mti124","sdm100c","sdm103","tm8b","tmy14","tmy15","tmy16","tmy18","tmy20","tm5","lc","lt","y11","y12","mt","lawf","lai","pm","lcn"];
const COLL_TAGS = {
  "Cell Segmentation Visual Glossary": ["visual glossary","voxel painting","cell segmentation","reference"],
  "Optic Lobe Cell Name Guide": ["optic lobe","cell naming","cell types","reference","drosophila"],
  "Fly Synapses": ["fly synapse","synapse","ground truth","reference"],
  "FlyWire Cheatsheet": ["flywire","cheatsheet","proofreading","shortcuts","reference"],
  "Optic Lobe Cell Diagrams": ["optic lobe","cell type","diagram","drosophila","morphology"]
};
function deriveKeywords(desc, coll, extra) {
  const low = (desc + " " + (extra || []).join(" ")).toLowerCase();
  const kw = new Set(COLL_TAGS[coll] || []);
  VOCAB.forEach(v => { if (low.indexOf(v) !== -1) kw.add(v.replace(/s$/, "")); });
  CELLTYPES.forEach(c => { if (low.indexOf(c) !== -1) kw.add(c); });
  return Array.from(kw).slice(0, 12);
}

// Build a quick lookup of which files were described (have seeds).
const describedFiles = new Set(seeds.map(s => s.file));

const out = [];
manifest.forEach(m => {
  const coll = m.collection, file = m.file;
  let title, description, extra = [];
  if (coll === "Optic Lobe Cell Diagrams") {
    const dd = diagramDesc(file);
    description = dd[0];
    title = file.replace(/\.png$/i, "").replace(/%20/g, " ");
    extra = [dd[1], dd[2]];
  } else if (DESC[file]) {
    title = DESC[file][0];
    description = DESC[file][1];
  } else {
    // generic (click-filled) or skipped → collection template
    const figNum = (file.match(/-(\d+)\.png$/) || [])[1];
    const shortColl = { "Cell Segmentation Visual Glossary": "Visual Glossary", "Optic Lobe Cell Name Guide": "OL Cell Name Guide", "Fly Synapses": "Fly Synapse", "FlyWire Cheatsheet": "FlyWire Cheatsheet" }[coll] || coll;
    title = shortColl + (figNum ? (" — fig " + parseInt(figNum, 10)) : "");
    description = genericDesc(coll);
  }
  out.push({
    collection: coll,
    dir: m.src_dir,
    file: file,
    title: title,
    description: description,
    source: SRC_LABEL[coll] || "",
    keywords: deriveKeywords(description + " " + title, coll, extra),
    described: describedFiles.has(file)   // false = skipped (generic caption)
  });
});

fs.writeFileSync(path.join(__dirname, "figure-descriptions.json"), JSON.stringify(out, null, 2));
const counts = {};
out.forEach(o => counts[o.collection] = (counts[o.collection] || 0) + 1);
console.log("Wrote figure-descriptions.json:", out.length, "entries");
console.log(JSON.stringify(counts, null, 2));
const skipped = out.filter(o => !o.described).length;
console.log("generic-caption (skipped) entries:", skipped);
