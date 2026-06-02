/* ==========================================================================
   Princeton Tracers — Site Search
   --------------------------------------------------------------------------
   Self-contained wiki-style search. Each page just loads this one file:

     <script src="search.js" defer></script>            (root pages)
     <script src="../search.js" defer></script>         (depth-1 pages)
     <script src="../../search.js" defer></script>      (depth-2 pages)

   The script auto-detects the site root from its own <script> URL, injects a
   search bar directly under <nav>, and runs a small in-browser fuzzy matcher
   over the INDEX below. Add new pages by appending to INDEX — no build step.

   Tunable knobs:
     - Field weights inside scoreEntry()
     - MAX_RESULTS (default 8)
     - Edit-distance / prefix / substring thresholds in scoreTermAgainstWords()
   ========================================================================== */

(function () {
    'use strict';

    var MAX_RESULTS = 8;

    /* ----------------------------------------------------------------------
       SEARCH INDEX
       Each entry:
         title       — display label
         url         — site-root-relative path (prefixed with SITE_ROOT)
         section     — breadcrumb shown beside the title
         description — 1-line summary (also searched, low weight)
         aliases     — alternate names users might type
         keywords    — concepts/tools/terms not in the title
       ---------------------------------------------------------------------- */
    var INDEX = [
        /* ---- Top-level hubs ---- */
        {
            title: 'Dashboard',
            url: '',
            section: 'Home',
            description: 'Princeton Tracers homepage — links to every section.',
            aliases: ['home', 'main page', 'start', 'landing'],
            keywords: ['princeton tracers', 'connectomics', 'overview']
        },
        {
            title: 'Task Guides',
            url: 'tasks/',
            section: 'Tasks',
            description: 'Overview of every annotation task type the team performs.',
            aliases: ['tasks', 'annotation tasks', 'task list', 'guides'],
            keywords: ['task hub', 'what we do']
        },
        {
            title: 'Standard Operating Procedures',
            url: 'sop/',
            section: 'SOPs',
            description: 'Index of every SOP — procedures, protocols, checklists.',
            aliases: ['sop', 'sops', 'procedures', 'protocols', 'standard operating procedures'],
            keywords: ['sop hub', 'protocol list']
        },
        {
            title: 'Gallery',
            url: 'gallery/',
            section: 'Gallery',
            description: 'Visual reference gallery — example annotations, defects, datasets.',
            aliases: ['gallery', 'examples', 'images', 'reference', 'pictures', 'screenshots'],
            keywords: ['banc images', 'visual examples', 'pipeline images']
        },
        {
            title: 'Publications',
            url: 'publications/',
            section: 'Publications',
            description: 'Seung Lab publications relevant to the connectomics pipeline.',
            aliases: ['publications', 'papers', 'publication list', 'doi'],
            keywords: ['research papers', 'journal articles']
        },
        {
            title: 'Pipeline',
            url: 'pipeline/',
            section: 'Pipeline',
            description: 'End-to-end pipeline stages from imaging to analysis.',
            aliases: ['pipeline', 'workflow', 'stages'],
            keywords: ['connectomics pipeline', 'data flow']
        },
        {
            title: 'Ground Truth Hub',
            url: 'ground-truth/',
            section: 'Ground Truth',
            description: 'Ground truth task documentation and shared resources.',
            aliases: ['ground truth', 'gt hub', 'gt'],
            keywords: ['gt resources', 'training data']
        },
        {
            title: 'Archive · All Documents',
            url: 'archive/',
            section: 'Archive',
            description: 'Comprehensive index of every page on the site. Also serves as the full search-results view when you press Enter in the site search.',
            aliases: ['archive', 'all documents', 'all pages', 'document index', 'index', 'appendix'],
            keywords: ['document list', 'all docs']
        },
        {
            title: 'VAST',
            url: 'archive/vast/',
            section: 'Archive · Deprecated Tool',
            description: 'Volume Annotation and Segmentation Tool — desktop application for manual segmentation annotation on Ubuntu/Linux. Replaced by WebKnossos.',
            aliases: ['vast', 'volume annotation segmentation tool'],
            keywords: ['deprecated', 'desktop tool', 'ubuntu', 'manual segmentation', 'legacy annotation']
        },
        {
            title: 'Omni',
            url: 'archive/omni/',
            section: 'Archive · Deprecated Tool',
            description: '3D proofreading and visualization tool for segmentation data. Desktop application replaced by WebKnossos + Neuroglancer.',
            aliases: ['omni'],
            keywords: ['deprecated', '3d proofreading', 'visualization', 'desktop tool', 'segmentation review', 'legacy']
        },
        {
            title: 'Eyewire',
            url: 'archive/eyewire/',
            section: 'Archive · Deprecated Tool',
            description: 'Browser-based citizen science game for neuron reconstruction. Pioneered gamified crowdsourced connectomics. Replaced by professional annotation tools.',
            aliases: ['eyewire'],
            keywords: ['deprecated', 'citizen science', 'crowdsourcing', 'gamified', 'public participation', 'legacy']
        },
        {
            title: 'Desktop-Based Annotation',
            url: 'archive/desktop-annotation/',
            section: 'Archive · Legacy Workflow',
            description: 'Original VAST + Omni annotation workflow on Ubuntu workstations with network-mounted storage. Single-user, file-based pipeline replaced by the current web-based collaborative workflow.',
            aliases: ['desktop annotation', 'desktop-based annotation', 'vast omni workflow', 'old workflow'],
            keywords: ['deprecated', 'ubuntu workflow', 'file-based', 'single-user', 'legacy workflow']
        },
        {
            title: 'Manual ID Tracking',
            url: 'archive/manual-id-tracking/',
            section: 'Archive · Legacy Workflow',
            description: 'Pre-CAVE workflow where segment IDs were tracked manually in spreadsheets. IDs could go stale silently when segmentation changed. Replaced by automated CAVE-based validation.',
            aliases: ['manual id tracking', 'spreadsheet tracking', 'id tracking'],
            keywords: ['deprecated', 'spreadsheet workflow', 'stale ids', 'pre-cave', 'manual validation', 'legacy workflow']
        },
        {
            title: 'Tool Evolution Timeline',
            url: 'archive/tool-evolution/',
            section: 'Archive',
            description: 'The arc of how our tooling has evolved across three eras: citizen science (Eyewire), professional desktop (VAST + Omni), and web-based collaboration (WebKnossos + Neuroglancer + CAVE).',
            aliases: ['tool evolution', 'evolution timeline', 'tool history', 'history'],
            keywords: ['eyewire era', 'vast era', 'omni era', 'webknossos', 'neuroglancer', 'cave', 'flywire', 'historical timeline']
        },
        {
            title: 'Historical Glossary',
            url: 'archive/glossary/',
            section: 'Archive',
            description: 'Terms from deprecated tools that may appear in legacy documentation — Omni terminology (dust, merger, supervoxel) and VAST terminology (volume, brush, label).',
            aliases: ['glossary', 'historical glossary', 'terminology', 'definitions', 'dictionary'],
            keywords: ['dust', 'merger', 'supervoxel', 'segment', 'spine', 'volume', 'brush', 'label', 'omni terminology', 'vast terminology']
        },
        {
            title: 'Experimental Tools',
            url: 'experimental/',
            section: 'Experimental',
            description: 'Generation 2 scripts and experimental utilities (faster, parallel).',
            aliases: ['experimental', 'gen 2', 'gen2', 'experiments'],
            keywords: ['fast_validate_ids', 'fast_get_coords', 'parallel scripts', 'threadpool']
        },
        {
            title: 'How to Suggest Changes',
            url: 'contribute/',
            section: 'Contribute',
            description: 'Suggest edits, file issues, or contribute documentation updates.',
            aliases: ['contribute', 'feedback', 'edit', 'suggest', 'pull request', 'pr', 'issue'],
            keywords: ['github issues', 'issue template', 'how to help']
        },
        {
            title: 'Sandy Pong',
            url: 'games/sandy-pong/',
            section: 'Games',
            description: 'Two-player online Pong with invite-only room codes. Off-topic; for fun.',
            aliases: ['pong', 'sandy pong', 'game', 'ping pong', 'racket'],
            keywords: ['multiplayer', 'game', 'pong', 'off-topic', 'fun']
        },

        /* ---- Task subpages ---- */
        {
            title: 'Proofreading (Tracing)',
            url: 'tasks/proofreading/',
            section: 'Tasks · TASK-01',
            description: 'Verifying and correcting AI-generated neuron segmentations. Includes split and merge operations.',
            aliases: ['proofreading', 'tracing', 'core task', 'task 1', 'task-01'],
            keywords: ['split', 'merge', 'split merge', 'segmentation correction', 'neuron tracing', 'three round triage', 'flywire', 'banc']
        },
        {
            title: 'Semantic Segmentation',
            url: 'tasks/semantic-segmentation/',
            section: 'Tasks · TASK-02',
            description: 'Painting and labeling tissue types and cellular structures in EM data.',
            aliases: ['semantic segmentation', 'painting', 'labeling', 'task 2', 'task-02'],
            keywords: ['voxel painting', 'soma', 'axon', 'dendrite', 'glia', 'myelin', 'mitochondria', 'synapse', 't-bar', 'tbar', 'vesicles', 'extracellular', 'classification']
        },
        {
            title: 'Skeletonization',
            url: 'tasks/skeletonization/',
            section: 'Tasks · TASK-03',
            description: 'Skeletal centerline representations of neuron morphology.',
            aliases: ['skeletonization', 'skeletonisation', 'skeleton', 'centerline', 'task 3', 'task-03'],
            keywords: ['teasar', 'kimimaro', 'swc', 'morphology', 'centerline tracing']
        },
        {
            title: 'Defect Annotation',
            url: 'tasks/defect-annotation/',
            section: 'Tasks',
            description: 'Marking imaging artifacts, tissue damage, and data-quality issues. Now part of Semantic Segmentation.',
            aliases: ['defect annotation', 'defects', 'artifacts', 'imaging defects', 'tears', 'folds'],
            keywords: ['section tear', 'fold', 'missing slice', 'staining artifact', 'damage', 'data quality']
        },
        {
            title: 'Quality Assurance',
            url: 'tasks/quality-assurance/',
            section: 'Tasks',
            description: 'QA review of completed annotation tasks.',
            aliases: ['quality assurance', 'qa', 'qc', 'review', 'verification', 'quality control'],
            keywords: ['task review', 'sanity check', 'verification']
        },
        {
            title: 'Split / Merge Resolution',
            url: 'tasks/split-merge/',
            section: 'Tasks',
            description: 'Resolving split and merge errors in segmentation. Now part of Proofreading.',
            aliases: ['split merge', 'split/merge', 'split', 'merge', 'merging', 'splitting', 'resolution'],
            keywords: ['proofreading subtask', 'segmentation errors', 'false merger', 'false split']
        },

        /* ---- SOPs ---- */
        {
            title: 'SOP-001: GT Task Handling',
            url: 'sop/gt-task-handling/',
            section: 'SOPs · SOP-001',
            description: 'How to receive, work on, and submit ground truth tasks (current version).',
            aliases: ['gt task handling', 'task handling', 'sop 1', 'sop-001', 'sop001'],
            keywords: ['ground truth', 'task assignment', 'task workflow', 'gt workflow']
        },
        {
            title: 'SOP-001 v2.0: GT Task Handling',
            url: 'sop/gt-task-handling/v2.0.html',
            section: 'SOPs · SOP-001 v2.0',
            description: 'Current pinned version (v2.0) of the GT Task Handling SOP.',
            aliases: ['gt task handling v2', 'sop 1 v2', 'sop-001 v2.0'],
            keywords: ['versioned sop', 'v2.0']
        },
        {
            title: 'SOP-001 v1.0: GT Task Handling (Deprecated)',
            url: 'sop/gt-task-handling/v1.0.html',
            section: 'SOPs · SOP-001 v1.0',
            description: 'Deprecated v1.0 of the GT Task Handling SOP.',
            aliases: ['gt task handling v1', 'sop 1 v1', 'sop-001 v1.0'],
            keywords: ['deprecated', 'old version', 'v1.0']
        },
        {
            title: 'SOP-002: GT Verification',
            url: 'sop/gt-verification/',
            section: 'SOPs · SOP-002',
            description: 'Verification procedures for ground truth annotations — checking synapses and other structures.',
            aliases: ['gt verification', 'verification', 'synapse verification', 'sop 2', 'sop-002', 'sop002'],
            keywords: ['verify', 'qa', 'sanity check', 'gt qa', 'synapse', 'synapse check', 'verification protocol']
        },
        {
            title: 'SOP-003: GT Checklist',
            url: 'sop/gt-checklist/',
            section: 'SOPs · SOP-003',
            description: 'Pre-submission checklist for ground truth tasks.',
            aliases: ['gt checklist', 'checklist', 'sop 3', 'sop-003', 'sop003'],
            keywords: ['pre-submission', 'task checklist', 'submission checklist']
        },
        {
            title: 'SOP-004: File Naming',
            url: 'sop/file-naming/',
            section: 'SOPs · SOP-004',
            description: 'File naming conventions for tracer team outputs.',
            aliases: ['file naming', 'naming convention', 'sop 4', 'sop-004', 'sop004'],
            keywords: ['file names', 'naming', 'naming standard']
        },
        {
            title: 'SOP-005: GT Protocol Guidelines',
            url: 'sop/gt-protocol-guidelines/',
            section: 'SOPs · SOP-005',
            description: 'Overall ground truth protocol guidelines.',
            aliases: ['gt protocol guidelines', 'protocol guidelines', 'gt protocol', 'sop 5', 'sop-005', 'sop005'],
            keywords: ['guidelines', 'protocol']
        },
        {
            title: 'Voxel Painting Cell Segmentation Protocol',
            url: 'sop/voxel-painting/',
            section: 'SOPs · Voxel Painting',
            description: 'How to hand-paint cells and structures in voxel space (current version, v1.2).',
            aliases: ['voxel painting', 'painting protocol', 'hand painting', 'cell painting', 'cell segmentation'],
            keywords: ['voxel', 'paint', 'manual segmentation', 'hand segmentation', 'v1.2']
        },
        {
            title: 'Voxel Painting Protocol v1.2',
            url: 'sop/voxel-painting/v1.2.html',
            section: 'SOPs · Voxel Painting v1.2',
            description: 'Versioned snapshot of the Voxel Painting Protocol at v1.2.',
            aliases: ['voxel painting v1.2', 'painting v1.2'],
            keywords: ['versioned', 'v1.2']
        },
        {
            title: 'SOP-D001: Omni Export Procedure (Deprecated)',
            url: 'sop/omni-export/',
            section: 'SOPs · Deprecated',
            description: 'Legacy Omni export procedure — kept for historical reference.',
            aliases: ['omni export', 'omni', 'sop-d001'],
            keywords: ['legacy', 'deprecated', 'export']
        },
        {
            title: 'SOP-D002: VAST Annotation (Deprecated)',
            url: 'sop/vast-annotation/',
            section: 'SOPs · Deprecated',
            description: 'Legacy VAST annotation tool procedure — kept for historical reference.',
            aliases: ['vast', 'vast annotation', 'sop-d002'],
            keywords: ['legacy', 'deprecated', 'annotation tool']
        },

        /* ---- Publications ---- */
        {
            title: 'FlyWire Methods',
            url: 'publications/flywire-methods/',
            section: 'Publications',
            description: 'Methods paper for the FlyWire fly brain connectome.',
            aliases: ['flywire methods', 'flywire paper'],
            keywords: ['flywire', 'fly brain', 'drosophila', 'connectome methods', 'methods paper']
        },
  {
    title: "FlyWire Self-Guided Training",
    url: "drive_docs_output/FlyWire-Training/FlyWire%20self-guided%20training.html",
    section: "Archive \u00b7 Training",
    description: "FlyWire's 10-step self-guided onboarding curriculum (datasets, glossary, sandbox, navigation, errors, access).",
    aliases: ["flywire self-guided training", "flywire onboarding", "flywire training"],
    keywords: ["FlyWire", "onboarding", "curriculum", "sandbox", "glossary"]
  },
  {
    title: "Archived Documents (Triage Additions)",
    url: "drive_docs_output/Triage-Additions/",
    section: "Archive \u00b7 Documents",
    description: "Index of 23 archived work documents (proofreading, segmentation, ground truth, training) recreated for the site.",
    aliases: ["triage additions", "archived documents"],
    keywords: ["archive", "documents", "recreations", "index"]
  },
  {
    title: "Cell Segmentation Visual Glossary",
    url: "gallery/#visual-glossary",
    section: "Gallery \u00b7 Reference Figures",
    description: "82-figure visual reference for hand-painting cell segmentations: myelin, membranes, glia, mitochondria, synapses, and imaging defects.",
    aliases: ["visual glossary", "segmentation glossary", "cell segmentation glossary"],
    keywords: ["visual glossary", "voxel painting", "cell segmentation", "myelin", "membrane", "glia", "mitochondria", "soma", "synapse", "vesicle", "blood vessel", "fat globule", "axon", "dendrite", "bouton", "defect", "reference", "figures"]
  },
  {
    title: "Optic Lobe Cell Name Guide",
    url: "gallery/#ol-cell-name-guide",
    section: "Gallery \u00b7 Reference Figures",
    description: "58-figure naming reference for Drosophila optic-lobe cell types, with Fischbach atlas plates and 3D examples.",
    aliases: ["optic lobe cell name guide", "cell name guide", "cell naming"],
    keywords: ["optic lobe", "cell naming", "cell types", "Fischbach", "medulla", "lamina", "lobula", "Dm", "Tm", "TmY", "Tm5", "LC", "Y11", "photoreceptor", "Drosophila", "reference", "figures"]
  },
  {
    title: "Fly Synapses (reference figures)",
    url: "gallery/#fly-synapses",
    section: "Gallery \u00b7 Reference Figures",
    description: "29 EM examples of fly synapses and their indicators: dense vesicle clusters, clefts, T-bars, and postsynaptic densities.",
    aliases: ["fly synapse figures", "synapse reference figures"],
    keywords: ["fly synapse", "synapse", "vesicle", "dense core vesicle", "cleft", "T-bar", "PSD", "postsynaptic density", "ground truth", "EM", "reference", "figures"]
  },
  {
    title: "FlyWire Cheatsheet (figures)",
    url: "gallery/#flywire-cheatsheet",
    section: "Gallery \u00b7 Reference Figures",
    description: "16 quick-reference pages of FlyWire proofreading keyboard shortcuts and commands.",
    aliases: ["flywire cheatsheet", "proofreading cheatsheet", "shortcuts"],
    keywords: ["FlyWire", "cheatsheet", "proofreading", "shortcuts", "commands", "keyboard", "reference", "figures"]
  },
  // --- Round-2 triage additions (Kyle Willie folder): 7 docs + optic-lobe gallery ---
  {
    title: "Ground Truth Errors",
    url: "drive_docs_output/Triage-Additions/Ground-truth/Ground%20Truth%20Errors.html",
    text: "ambiguous and annotated are areas aren because belong between blue border borders bottom corner difficult discern example hand in is it left segment that the there they this to which with yellow",
    section: "Archive \u00b7 Ground Truth",
    description: "Illustrated ground-truth annotation error example (ambiguous segment border).",
    aliases: ["ground truth errors"],
    keywords: ["ground truth", "error", "ambiguous border", "segmentation", "annotation"]
  },
  {
    title: "Vesicle Check List",
    url: "drive_docs_output/Triage-Additions/Synapse-GT/Vesicle%20Check%20List.html",
    section: "Archive \u00b7 Synapse Ground Truth",
    description: "Step-by-step vesicle-tracing checklist for synapse annotation (Vast auto-fill + conditional painting).",
    aliases: ["vesicle check list", "vesicle tracing"],
    keywords: ["vesicle", "synapse", "tracing", "Vast", "conditional painting", "cleft"]
  },
  {
    title: "Synapses in Fly",
    url: "drive_docs_output/Triage-Additions/Synapse-GT/Synapses%20in%20Fly.html",
    text: "4752341626388480 5195572990312448 5899060162461696 6289033881583616 alone an and annotated appspot are as at ationframework axon axons be beft between bodies both can classify cleft clefts com directly do dynamicannot dynamicannotationframework enough example figure fly found have https import in indicators is json least legitimate like long need neuromancer nglstate nick night not of okay on other passing possess post said same seung shared sharing should sides still synapse synapses synapsing synaptic terminate that the there through to touching two update url ve we with working www you zhihao",
    section: "Archive \u00b7 Synapse Ground Truth",
    description: "Slide update on identifying synapses in fly EM.",
    aliases: ["synapses in fly"],
    keywords: ["synapse", "fly", "FlyWire", "T-bar", "vesicle", "EM"]
  },
  {
    title: "How-to: Mammalian/Zfish Synapses",
    url: "drive_docs_output/Triage-Additions/Synapse-GT/How-to%20Mammalian-Zfish%20Synapses.html",
    text: "10 11 14 15 16 17 18 19 20 21 22 2d 3d able accumulation actin action actual actually adherens all along alongside alpha also an and annotate annotated annotating annotation appear are area areas aren arrow arrows as asterisk asterisks at attributes axis axon axonal axons base basic be been below between bigger blue blurry bottom bouton boutons branch branches briefly but by can carrying causes cell cells cellular change channels charge chemical clarity clear cleft click clustered color comes commonly consisting contact contents context converted cover creating crest cytoskeleton darkened darker data datasets demonstrate dendrite dendrites dendritic dense densely densities density depicted depolarizing different docked doesn doubled down draw each electrical em encounter end entire even every exact example examples featuring few fig figs filaments fish flat folded follow for form found from function gap gated gathering general good great green harder has have head heads here hold how if illustration images in indicate indicated indicators individual information instead interacting interactions interested into ion is it its junction just known labeled larger lateral left length lighter line lined ll location long looks luck maintain making mammal mammalian mammals marked markers marking may membrane mice miscellaneous more morphology most mostly multiple negative neuron neuronal neurons neurotransmitter no normally not note occasional occurring of often on once one only opens or other others over own part per pick point portion postsynaptic potential practice presynaptic punctum purple pyramidal reaches received receiving receptors reconstructed red released removed resource result running same section segment sending shape shaped shapes should showing shown signal similar simple single slice slide slightly small smudgiest soma some space spine spines spot still structure structures surround sweeps swelling synapse synapsed synapses synapseweb synapsing synaptic table take terminal than that the their them then these they thick thickened thin this those three tiniest tiny to together top transferred trouble two typical up upon use usually variety ve very vesicle vesicles via video visually voltage waiting wave wavelike we well what when where which width with work worked would yellow you zebrafish zfish",
    section: "Archive \u00b7 Synapse Ground Truth",
    description: "How-to for annotating synapses in mammalian and zebrafish EM (general morphology + annotation method).",
    aliases: ["mammalian synapses", "zebrafish synapses", "zfish synapses"],
    keywords: ["synapse", "mammal", "zebrafish", "morphology", "annotation", "PSD", "cleft"]
  },
  {
    title: "How to: Fly Synapse",
    url: "drive_docs_output/Triage-Additions/Synapse-GT/How%20to%20Fly%20Synapse.html",
    text: "10 11 12 13 14 15 about accumulating accumulation activity actually against all along also amorphously an and annotate annotated annotating annotation another any apparent appear appearing appears appropriate are area areas aren around arrow arrows as aside at attention away axon axonal axons bar bars be because been being below between beyond bleeds bodies body border borders both bounding bouton box branch branches bridging brush bumps but by can cases categories certain chance changing circular clarity clear cleft clefts cluster clusters color come comes common comparative comparison comprise confirmed congregation consider contents contrast correct could couple covering dark darkened darkest darkness data datasets demonstrates dendrite dendrites dendritic dense density difference different digging disappear disperse distance distinct do document does down drop due each earlier easiest easy either em encounter end entire even everything example examples exhibits explanatory extending extends facilitate fair false far few fig first fish fly follow followed follows for foremost form formation forming four from gap gaps general generally good green grouped grouping guide hanging harder has have heads here how however ideal identical identified if imperfect important in include indicate indicates indicating indicator indicators information instances interact into involve involved is isn issue it its just kind labeled lacking large lateral least left length less like line little ll located look looking looks majority make making mammalian many mark marked match may membrane mentioned method mixed moderate more move moved multicellular multiple must name near necessary need no non not note notice now numbers objects of off often on once one only onto or organelles other out outlined over paid parameters part parts perfect pinch pixel pixels place places plane point points possible postsynaptic predominantly present presynaptic prevent previous primary probably process progressing prominence prominency prominent psd psds quick reason reasonably receive recognize red regardless regions relatively replicate replicating revealed right same sand second secondary sections see seeing seem seen segment segmentation segments selection self sequential set shaded shape shaped shapes shot should show shrinking side sides sign signs similar simple size slices slide slides sliver small some something sometimes space spin spine spines spot starting structures such surfacing surround sweeping swelling synapse synapses synapsing synaptic table take that the them there therefore these they thickness thin thing this those though three through throughout to together top touching tracing trajectories transition tree two uncertain uncover up upon used variance varies variety various ve vertical very vesicle vesicles vetted video way we well what when where while widened will with within worry would you your",
    section: "Archive \u00b7 Synapse Ground Truth",
    description: "Detailed fly-synapse annotation guide: indicators, shapes, vesicles, clefts/gaps, T-bars, PSDs, tracing method.",
    aliases: ["fly synapse how to", "how to fly synapse"],
    keywords: ["synapse", "fly", "T-bar", "vesicle", "cleft", "postsynaptic density", "tracing"]
  },
  {
    title: "Focused Annotation: How to",
    url: "drive_docs_output/Triage-Additions/Annotation/Focused%20Annotation%20How%20to.html",
    section: "Archive \u00b7 Annotation",
    description: "How-to guide for focused annotation.",
    aliases: ["focused annotation"],
    keywords: ["focused annotation", "annotation", "how-to", "proofreading"]
  },
  {
    title: "Large_Fragment Label Policy",
    url: "drive_docs_output/Triage-Additions/Semantic-labeling/Large_Fragment%20Label%20Policy.html",
    section: "Archive \u00b7 Semantic Labeling",
    description: "Policy for labeling large fragments during semantic segmentation.",
    aliases: ["large fragment label policy", "large fragment policy"],
    keywords: ["large fragment", "label policy", "semantic segmentation", "labeling", "voxel painting"]
  },
  {
    title: "Optic Lobe Cell Diagrams",
    url: "gallery/#optic-lobe-diagrams",
    section: "Gallery \u00b7 Optic Lobe Diagrams",
    description: "16 full-resolution Drosophila optic-lobe cell-type morphology renders (Dm, Tm, Mti, SDm, Y, LPi).",
    aliases: ["optic lobe cell diagrams", "optic lobe diagrams", "cell diagrams"],
    keywords: ["optic lobe", "cell types", "Dm", "Tm", "Mti", "SDm", "LPi", "morphology", "diagrams", "Drosophila", "gallery"]
  },
  {
    title: "Seung lab proofreading-annotation empire operation manual",
    url: "drive_docs_output/Triage-Additions/Proofreading/Seung%20lab%20proofreading-annotation%20empire%20operation%20manual.html",
    section: "Archive \u00b7 Proofreading",
    description: "Lab-wide operations manual for proofreading and annotation workflows (Seung lab).",
    aliases: ["empire operation manual", "proofreading manual"],
    keywords: ["operations", "workflow", "seung lab", "annotation"]
  },
  {
    title: "Proofreading Tagging Guide (Protocol Update)",
    url: "drive_docs_output/Triage-Additions/Proofreading/Proofreading%20Tagging%20Guide%20(Protocol%20Update).html",
    text: "2nd acceptable according acted actions add adding addition additional after afterward again all already also amount an and another appear appears applied apply appropriate are area areas artifact artifacts as ask assignment association at attaching attempt automatically backbone backend banc based be because been before behavior being believe best bot brain branches break brought bubbles but button by call can cannot careful carrying cases cell cells change changed changes changing check checking circumstances clarification clean clearly commonly complete completed components confident confirmation confirming confirms connects consensus considered contain continuation coordinates correct corrections cost could coworkers criteria current currently cutoff damage data dataset day debris dependent depending determine determined different difficult diligence dissolved do does done due each edge edits effort end endpoint enter enters error errors essentially etc even exact example examples excessive expands expectations expected extracellular fails false far feasible few final finalized finalizing finish finished fix flexible for fragment fragments from full fully function get giver glial goals ground happen happens has have help helpful how however id if imaging important in include indicate indicator individuals inside insignificant inspect instructions integrity intended interference into investigated is isolated issue issues it jumps just know label labeling labels lack large largely lead leave leaves leaving left like likely link lists locating longer made major make making manually mark marked marker may mean meaningful means meant measure meets member merge merger merges middle might minimum misalignments missing mitochondria mitochondrion mixed more most move must necessarily need needed neurite neuron neurons new no nonetype normally not note nothing now occur occurs of off often on once one only onto opinion opposite option or original originally other our outcome outdated parameters path paused performed person picture please portion possible prevent preventing previously proceed producing progress proofread proofreader proofreaders proofreading properly protect provided purposes rarely rather re real reasonable receive recent reclassified reconstructable reconstructed reconstruction refined relative reliable remain remaining remove removed replace replaced replacement represents required requires resin restriction result review reviewed revisited rip ripped safety same seed segment segmentation senior set sheet should shred side similar since situation slide slightly small so solvable soma some someone space spelunker split splits starting state status step still stopping strictly structure submission submit submitted submitter successfully such supervoxel switching synaptic system tag tagged tagging tags taken taking task tasks team technical technically temporarily temporary termination than that the their then there these they this threshold time tiny tissue to tool torn trace traceability tracking tract treated truly typically un under unproofread unsure until unusual updated use used using valid value vary verification verified version versions want was way we were what whatever when where whether which who wip with within won words work worked workflow works worth would you yourself",
    section: "Archive \u00b7 Proofreading",
    description: "Slide guide for the proofreading tagging protocol update.",
    aliases: ["tagging guide", "tagging protocol"],
    keywords: ["tags", "protocol update", "banc-bot"]
  },
  {
    title: "How Ben Proofreads",
    url: "drive_docs_output/Triage-Additions/Proofreading/How%20Ben%20Proofreads.html",
    text: "10 1000 20 2nd 80 90 about acceptable accomplishing accuracy across adhered adjust after all always an and annotate any anywhere apply are area areas aren around arrives as ask asking assist at attempt available axonal axons back backbones banc be before begin beginning behind best better bigger bits bog brain branch branches build but by can care cb cell cells central certain challenge clicking coffee colleagues column columns come comes completed concerned confident consideration continuation continues couldn create data dataset defined dendrites dendritic describe detailed different difficult difficulty disrupt disrupted distinct divide do don done down during each easy elaborate else encounter end error errors especially established estimated etc evaluate every example fails fast fatigue features feedback feel feeling fill filled find finish finished first fix flow focus for free from general get give gives goal goals going great guidelines gut had hand happens hard harvested has have head help helped here history honest how idea if imagining important in individual information innervate innervation input inspection instructions instructor interested into investigating is isn issue it its journal journey keep kind know labeled large last lays legs level like limit list little ll locate look looking looks lot made make makes manageable many me measure meet mentally mergers mesh method middle might mind missed model months more morphological morphologies morphology most move much nanometer nanometers need needs neither neurites never new next no normal not notes noting now obvious of off on once opinion optimal option or other others out outcome outline over overwhelmingly own pace parameters parts per person personal personalized pillars plan plunge point points possible present problem process progress proof proofread proofreader proofreaders proofreading qualifies questions quick re ready really receive recognise refer refine relation remember removed require rewarding rough run same say seen segment segments set sheet should sits six skills slightly small smaller so solve soma somas some someone sometimes speed stand standard start status step still strange strategy stretch structure stuck stuff style success suggests suit sure tag tags tailor take takes task tasks tea tell termination terrible than that the them then there these they things this three time timeline times to toggle token tough tracing trapped trust try two type types under until up us usually valuable varies ve versa vice want wants was water way we weird well were what when where while will wins with workflow worst would years yes you your yourself",
    section: "Archive \u00b7 Proofreading",
    description: "Ben's personal proofreading walkthrough (slides).",
    aliases: ["how ben proofreads"],
    keywords: ["proofreading", "walkthrough", "workflow"]
  },
  {
    title: "AN-DN Task Guide",
    url: "drive_docs_output/Triage-Additions/Proofreading/AN-DN%20Task%20Guide.html",
    text: "20 2nd 3d 45 484 4a adjustments after all an and any appropriate are as at backbone banc be begin bot both bottom branches can case cell cells choices column columns comparison competition criteria date deselect didn different dn do done down drop edited ensure error errors etc example final find finished first fix fixed fixing flags for from good guide half has have hyperlink id if in index is issue it label large latest left like likely link links look major make mark match mergers mesh might mins missed mix more my name nblast necessary need needed needs neuron no not note notes of on once one only open opinion or out per place please pointing prevents proofread proofreading put quite re reselect resolve respectively review reviewer right root segment select selection share sheet side similar since spend starts step sure tag tags take that the there these this time to tough try types unless up updated use when which will with you your",
    section: "Archive \u00b7 Proofreading",
    description: "Task guide for ascending/descending neuron (AN/DN) proofreading.",
    aliases: ["an dn task guide", "ascending descending neuron"],
    keywords: ["AN", "DN", "ascending neuron", "descending neuron"]
  },
  {
    title: "vnc_nblast_scores_sorted task instructions",
    url: "drive_docs_output/Triage-Additions/Proofreading/vnc_nblast_scores_sorted%20task%20instructions.html",
    section: "Archive \u00b7 Proofreading",
    description: "Instructions for the NBLAST-sorted VNC proofreading task (verify/remove 'backbone proofread' labels).",
    aliases: ["vnc nblast task", "nblast scores sorted"],
    keywords: ["VNC", "NBLAST", "backbone proofread", "labels"]
  },
  {
    title: "Previously Marked Proofread Neurons",
    url: "drive_docs_output/Triage-Additions/Proofreading/Previously%20Marked%20Proofread%20Neurons.html",
    text: "2nd across actually add adding additional after all already also always and any appropriate appropriately are areas as ask assistance at banc be before better bot but by calling can catch cell cells center clarification click colleagues column come complete confidence confident connections continue criteria disconnected don done dozen dust early easy edits end error errors extracellular far few find finish first fix fixable for found glia good got hard harder has have help high id if in incomplete instead instructions investigate is isn issues it label labeled larger link list looked looking lot luck make many mark marked meet membranes might mistake mitochondria mostly my myelin name nature need neuroglancer neuron neurons next no not notes now objective of on one ones open opinion or organelles other our pathswaps pieces please previously process proofread proofreader proofreading questions re recategorized rectify refine relatively review right rows scattered see segment segments sheet should size slide small smaller so somas some sort sorted space status step still submit submitted such tag tagging tags task that the them then there therefore these they things this three threshold through tiny to too towards un updated use used ve we well weren what when will with without workflows you your",
    section: "Archive \u00b7 Proofreading",
    description: "Reference deck on neurons already marked proofread.",
    aliases: ["previously marked proofread"],
    keywords: ["proofread", "reference"]
  },
  {
    title: "Proofreading core cells in Minnie",
    url: "drive_docs_output/Triage-Additions/Proofreading/Proofreading%20core%20cells%20in%20Minnie.html",
    section: "Archive \u00b7 Proofreading",
    description: "Round-by-round procedure for proofreading pyramidal core cells in Minnie65 (dendrites then axons).",
    aliases: ["minnie core cells", "core cells proofreading"],
    keywords: ["Minnie", "Minnie65", "pyramidal", "dendrite", "axon"]
  },
  {
    title: "How to create masking layer for image defects",
    url: "drive_docs_output/Triage-Additions/Defect-annotation/How%20to%20create%20masking%20layer%20for%20image%20defects.html",
    section: "Archive \u00b7 Defect Annotation",
    description: "How to create a masking layer for image defects (2019, szichieh).",
    aliases: ["masking layer", "image defect masking"],
    keywords: ["defect", "mask", "alignment", "missing data"]
  },
  {
    title: "Cleft Annotation Comparison Protocol - Easy-Seg vs Synaptor-Seg",
    url: "drive_docs_output/Triage-Additions/Defect-annotation/Cleft%20Annotation%20Comparison%20Protocol%20-%20Easy-Seg%20vs%20Synaptor-Seg.html",
    section: "Archive \u00b7 Defect Annotation",
    description: "Protocol comparing cleft annotations between easy-seg and synaptor-seg and assigning a category.",
    aliases: ["cleft annotation comparison", "easy-seg vs synaptor-seg"],
    keywords: ["cleft", "synapse", "synaptor", "easy-seg"]
  },
  {
    title: "annotation standard",
    url: "drive_docs_output/Triage-Additions/Oldies-archive/annotation%20standard.html",
    text: "5676908286050304 571462419218432 5727442737037312 8841 active an and annotate annotation appspot are area as axon basics be because between bilayer black blank blood body but cell clear close colored com comparison components connected consistency could dataset dendrite density difference dilate don dot double dynamicannotatio dynamicannotationframework edge end er even every example examples except features figure find from general glia golgi have how htt https if image import important in include inhibitory invagination is it json judge keep kisuk leave less let list long means membrane membranes might mitochondria mitochondrial much multicut myelin neck need net neuromancer neuron nframework nglstate nkem not nucleus object of om on one or organelle other out oversegment personal pinky plasma pm possible post postsynaptic pre presynaptic ps psd psychology pyramidal questions reference same see segment separately seung sheets should soma space spot stackexchange standard super supposed sure synapse synaptic than that the them to tracing treat try ultrastructure unclear url use versus vesicle vessel what which white www you zone",
    section: "Archive \u00b7 Historical",
    description: "2019 annotation standards deck (szichieh).",
    aliases: ["annotation standard"],
    keywords: ["annotation", "standard", "guidelines"]
  },
  {
    title: "Minnie groundtruth difficult-interesting parts",
    url: "drive_docs_output/Triage-Additions/Oldies-archive/Minnie%20groundtruth%20difficult-interesting%20parts.html",
    text: "05386727424 100 1642164224 1834eurtgyhup45htyy9 19984 20 224 286777761 29114880000 4810399744 4829204480 544 56305 563111910283673 5633805205372928 5633808977100800 5636079655845888 5636917040250880 5639353092014080 564043207147520 5641820617834496 5642193863704576 5642728802091008 5646141827842048 564676 5650099170443264 5650215752171520 5651845423824896 565292874858496 5653475618717696 5653900347572 5655533763690496 5658210065186816 566112408305664 566161 5663835143798784 5665124573511680 566636 5666546613485568 5666973489823744 5667955980369 5668065354186752 5668825627361280 5669312018776064 5673026309849088 5675080696725504 5675522809921536 5678590574198784 5679987509166080 5680805767544832 5687622621986816 5688306327093248 5688862709907456 5691358622777344 5703983961210880 5704844431065088 5705441837318144 5706851204202496 57098 5710888728264704 571462419218432 571958664101 5720126934482944 5720249002360832 57214 5725938038865920 5731465027387392 5735660673564672 5737950928175104 5738859568562176 5738984857665536 5741966239203328 5742093692567552 574421767448166 5745202292588 5749548010962944 5750478579171328 5751324956164096 5751393823490048 5753897104703488 576008 5760563162382336 5762578928107520 5767047069827072 645526489890816 652017242439680 656735767330816 675046484836352 754577672470528 7735860224 87469561856 8880 920 all amework amicannotationframework an and annotate annotated annotating annotation another ap app appsp appspot are arrow as at ationframework axon basket be becomes beginning below best between bilayer black blank blood body boundaries bouton breaks brightly broken bunch but by c0qmsd1sc6yt5hny caused cb cell clear co color com compare completely consider considered consistent content core could coyy81k crazy criteria cytoplasm dark darker datasheet dendrite difficult do docs don dot double due dy dyn dyna dynamica dynamicannot dynamicannota dynamicannotat dynamicannotatio dynamicannotation dynamicannotationfr dynamicannotationfra dynamicannotationframe dynamicannotationframewo dynamicannotationframewor dynamicannotationframework edge edit empty encounter end envelope er example examples feature final fold folds following for framework gid glia glstate gnarly good google gray green groundtruth has here ht https idea im impo import in initial inside interesting interface invagination invaginations ionframework irregular is it js json just l1 label labeled leave leaving like link looks lstate matter me membrane membranes merge merger messy mework micannotationframework might minnie more mport multiple myelin myelinated namicannotationframework nearly neck need neuromancer neuron neurons nframework ng ngls nglsta nglstat nglstate nnotationframework no not note notes now nuclear objects oblique obvious of off om on one or organelle orphen ot other out parallel part parts perfect pm point poor port ppspot psd pspot q1 reason red right rk rl rt rule seems segment segmentation segmented separation seung shape sheath sheet sheets should side similar slices slide small soma some son space spherical spot spreadsheets strange structure structures subcellular summary super supposed synapses tate te the them then there these this though tionframework to together touching tps tricky two unannotated ur url usually very vessel vol005 vol006 vol007 vol008 vol009 vol010 vol011 vol012 vol013 vol014 vol015 vol016 vol018 vol019 vol020 vol022 vol023 vol024 vol025 vol026 vol027 vol028 vol029 volume was way weird well what when which whileas white why with work wrapping ww www ynamicannotationframework zoom",
    section: "Archive \u00b7 Historical",
    description: "2019 deck of difficult/interesting ground-truth cases in Minnie.",
    aliases: ["minnie groundtruth difficult"],
    keywords: ["ground truth", "Minnie", "edge cases"]
  },
  {
    title: "FlyWire Cheatsheet",
    url: "drive_docs_output/Triage-Additions/Training-onboarding/FlyWire%20Cheatsheet.html",
    text: "2d 3d able above accidentally activate activated add after again all already an and annotate annotation annotations answer any apart appears approach are around as at away axes axis back basic be been between blue bottom box brain briefly browser but button can cell cells center centered cheatsheet check circles click clicked clipboard close color colored comma commands confident coordinates copy create csv ctrl currently cut cuts dataset define delete deleted deselect desired doesn dot double down drag each edit either em enough exclamation export face find finger fingers first flywire for frontal fun functions gear germany get graph green group hack hand have having hide hit hotkeys hover however icon icons id ids if image implement in including instead is it its key keyboards keys layer layout left lines link list location looking lower mac make mark may memory menu merge merged merges merging meshes message mouse move multi multicut multiple navigate navigation nearest new next no not number obvious of on once one only or other over page pan panel part paste path period place play please point pointing points preferences pretty production question quick randomly re recolor recommended red redraw refresh remove rendering repeat responsibly reveal right rotate rotates sandbox save screen second segment segmentation segments select set share shift shortest show side sign single slices slide small snap snaps software something spacebar split splitting spreadsheet stack switch tab tabs that the them then there things to toggle top trackpad trackpads trash try turn two type under undo until upper upright use using view visible want was what wheel when where white whole xy xz you your yz zoom",
    section: "Archive \u00b7 Training",
    description: "Quick-command cheatsheet for FlyWire (navigation, annotations, splitting & merging).",
    aliases: ["flywire cheatsheet", "flywire commands"],
    keywords: ["FlyWire", "hotkeys", "commands", "split", "merge", "neuroglancer"]
  },
  {
    title: "Hippocampus CA3 training curriculum",
    url: "drive_docs_output/Triage-Additions/Training-onboarding/Hippocampus%20CA3%20training%20curriculum.html",
    section: "Archive \u00b7 Training",
    description: "Structured CA3 hippocampus onboarding/training curriculum.",
    aliases: ["CA3 training", "hippocampus curriculum"],
    keywords: ["CA3", "hippocampus", "training", "onboarding"]
  },
  {
    title: "Voxel Painting Cell Segmentation Work Instructions - Webknossos v1.2",
    url: "drive_docs_output/Triage-Additions/Voxel-painting/Voxel%20Painting%20Cell%20Segmentation%20Work%20Instructions%20-%20Webknossos%20v1.2.html",
    section: "Archive \u00b7 Voxel Painting",
    description: "Work instructions for voxel-painting cell segmentation in WebKnossos (v1.2).",
    aliases: ["voxel painting work instructions", "webknossos work instructions"],
    keywords: ["voxel painting", "webknossos", "cell segmentation"]
  },
  {
    title: "Cell Segmentation Visual Glossary v1.0",
    url: "drive_docs_output/Triage-Additions/Voxel-painting/Cell%20Segmentation%20Visual%20Glossary%20v1.0.html",
    text: "03 157 1980 336 398 400 60 able accumulation active against all almost always an and angles annotated another any anything anywhere appear appears are areas aren arise around as at attention automatically axon axonal axons backbone band bands be because being below between blank blobby blood blotches body bottom bounding bouton box brains branches bulb bunching bundles burd but by called can cases cell cells chemicals chromatin clear cleft click clickable cloud cluster clustered communicate confident connected constituent corresponding counts cracks cristae cut dark darker dendrite dendrites dendritic density determine different difficult distinct do doesn don dots down during easier easy ellipsoid else em emerging emptier empty en ensheaths epitumorous etc even every example examples except extension extremely face fat feature few fewer field fig filled filling find first five fiving fold folds for found from frozen full glia globule globules glossary guide guides handling happening happens has have having head heavily help here high highlighted how human hyperlinked if image images in individual info inner inside interaction invaginations is isn it its judgement just knobbly koolman label labeling lacking large larger lasts laterally layer leave less light like linear little ll long look lot make making mammal many may membrane membranes might missing mitochondria more most mostly mouse move much myelin myelinated nb neck need neighboring neocortex nerve nervous neurite neuron neurotransmitters new nice nm no not note nucleus numerous object objects occur oddly of often olfactory on one ones only or organelle organelles other outer outside overall owner packages padding paint painting parallel part particular parts pay people persist photo piece plane post process projections psd pushes pyramidal quick rare re recognise region release right round rounded same scale scroll second sections see seem segment segmentation segmented segments selden semantic separate several shading shadow shaped similar single sliced slide slides small smaller soma some something space spindly spine spines splotch spot status stretchy striations structure synapse synapses synapseweb synaptic take tears tell telling tem terminal text thalamus than that the their them then there these they thick thin think this those through time tiny tissue tll to together tongue top treat trouble trunk twigs two types until up use usually v1 ve vertical vertically very vesicle vesicles vessels visible visual volume voxel vs wall we weak what when whether while will with won you your yourself zone zoomed",
    section: "Archive \u00b7 Voxel Painting",
    description: "Visual glossary for cell segmentation: myelin, axons, dendrites, synapses, soma, glia, artifacts.",
    aliases: ["visual glossary", "cell segmentation glossary"],
    keywords: ["glossary", "myelin", "axon", "dendrite", "synapse", "soma", "glia", "artifacts"]
  },
  {
    title: "MEC Segmentation Label Revision",
    url: "drive_docs_output/Triage-Additions/Voxel-painting/MEC%20Segmentation%20Label%20Revision.html",
    section: "Archive \u00b7 Voxel Painting",
    description: "MEC dataset segmentation label revision notes (Zetta/Macrina).",
    aliases: ["MEC label revision"],
    keywords: ["MEC", "labels", "segmentation", "Zetta"]
  },
  {
    title: "MEC Label Review By Semantic Class",
    url: "drive_docs_output/Triage-Additions/Voxel-painting/MEC%20Label%20Review%20By%20Semantic%20Class.html",
    section: "Archive \u00b7 Voxel Painting",
    description: "Procedure for reviewing MEC voxel-painting labels organized by semantic class.",
    aliases: ["MEC label review", "semantic class review"],
    keywords: ["MEC", "semantic class", "review", "webknossos"]
  },
  {
    title: "Optic Lobe Cell Name Guide",
    url: "drive_docs_output/Triage-Additions/Naming-setup-misc/Optic%20Lobe%20Cell%20Name%20Guide.html",
    text: "073 10 1073 120 14 15 1506763112 17 20 2011 2013 2017 2019 2022 22 26 28 30 40 4622429303341056 50901 5265932240814080 57443 5863365614239744 65 6b abbreviation about above abstract add again ai al all along also an and anterior apparently appear approximate approximately arborization arborizations arborize arborizes arbors are around arrow arrowhead arrowheads articles ascends at axon axonal axons be before begin begins below between beyond bodies body border both bottom boundaries brain branch branches broad but c2 c3 called can cartridges cb cbs cell cells central centrifugal chiasm cholinergic circle circular class close cluster coetex colum column columnar columns com compilation complex cont cortex covering covers cross daf dataset dendrite dendrites dendritic descend description difference directions distal distinct dm dm1 dm11 dm20 dm3 dm4 dm5 dm8 do doi domains down elifesciences elsewhere encompassing estimate et example execu executive exhibit extends extensively few fibers field figure fine first fischbach five flow flywir flywire follow for form formation four from gabaergic globalv1 guide has hasegawa have hook https id identification if image in inner innervating interestingly into intrinsic is it its json just kelp know kruk krzysztof l1 l2 l3 l4 l5 label lacks lai lamina large lat laterally lawf lawf1 lawf2 layer layers lc lc1 lc12 lc4 lccn lccn1 lcn left length less li li1 lies lightbulb like link linking llpc lm lo5 lo6 lobe lobula local located looks lop lop1 lop3 lop4 lower lpc lpi lpi1 lplc lpt lpt1 lpt2 lt lt1 m1 m10 m3 m4 m5 m6 m7 m8 m9 main mainly making maybe medulla mi mi1 mi10 mi15 mi9 mid ml ml1 monopolar morphologically most mostly mt mt1 mt10 mt11 mt2 mt3 mt4 mt5 mt6 mt7 mt8 mt9 mti124 multiple name naming near nern neurite neuron neurons new next ngl nglstate not note of olt om on one only optic or org orient other outer outline outside overlap overlapping paper pdf per photoreceptor pictured plate pm pm1 pm4 pm9 pmlm7 pnas point postsynaptic potentially present presynaptic processes project projecting projection projections projects proximal putative r1 r7 raghu ramifications ramified reach reaching ref ref1 reference reference1 remains restricted retina retinula right runs same scale section see segment select send several shaped shinomiya show sideways similar single slide small smaller some source sources spanning spreading strata stratum subtype summary supp synapses system t1 t2 t3 t4a t4b t4c t4d takemura tangential terminal terminals terminate terminates termine that the their these they this three through tive tl tl1 tlp tlp1 tm tm1 tm2 tm20 tm27 tm27y tm3 tm4 tm5a tm5b tm9 tmlm7 tmp tmy tmy1 tmy14 tmy15 tmy16 tmy17 tmy18 tmy20 tmy3 tmy8 tmynew1 to top tracts translobula transmedullary turn two type types unicolumnar unique up upside url various ve vertical vertically via visual vpn vpn1 vs we were what where whereas which whose wide with within www y1 y11 y12 you",
    section: "Archive \u00b7 Reference",
    description: "Naming guide for optic-lobe cell types (Lawf, Tm, TmY, Dm, Pm, LC, etc.).",
    aliases: ["optic lobe cell name guide", "OL cell name guide"],
    keywords: ["optic lobe", "cell types", "naming", "medulla", "lobula"]
  },
  {
    title: "NoMachine Setup Instructions",
    url: "drive_docs_output/Triage-Additions/Naming-setup-misc/NoMachine%20Setup%20Instructions.html",
    section: "Archive \u00b7 Reference",
    description: "Setup instructions for NoMachine remote access.",
    aliases: ["nomachine setup"],
    keywords: ["NoMachine", "remote desktop", "setup"]
  },
  {
    title: "Working list of priorities-stages when handling datasets",
    url: "drive_docs_output/Triage-Additions/Naming-setup-misc/Working%20list%20of%20priorities-stages%20when%20handling%20datasets.html",
    section: "Archive \u00b7 Reference",
    description: "Working list of priorities/stages when handling datasets (Kyle Willie).",
    aliases: ["priorities stages datasets", "working list"],
    keywords: ["workflow", "priorities", "datasets", "stages"]
  },
  {
    title: "Optional - Fly synapses (re-sync 2026)",
    url: "drive_docs_output/Triage-Additions/Synapse-GT/Optional%20-%20Fly%20synapses%20(re-sync%202026).html",
    text: "10 11 12 13 14 15 16 17 18 19 1um 20 2018 21 22 23 24 2fsticky about access accumulated accumulating active activity actual add after ai al all along also although amorphously an analysis and annotate annotated annotation annotations another any apart apis apparent appear appearance appears archetypal are area aren around arrow arrows as aside associated at atypical auth automatically away axo axon axonal axons back bar bars be because been before being below ben between beyond biological bit blob bodies body border both boundaries bounding box brain branch branches bring bumps but by can careful case cases cell cells channel check claire clarity classify clear cleft clefts cluster clustered clusters coder com come comes comparative compared comparison components comprised concentration confidence confuse congregation connectivity considered contain containing core correct could couple covered covering credits criteria cross daf dark darkened darker darkest darkness dash data dataset datasets datastack dcvs defined dendrite dendrites dendritic dendro dense density depending described despite detail detected detectors difference different digging disappear disappears disperse disregarded distinct do document doesn don dots down drop due during dyads each easiest easy edna em en encounter end enough et etc even every example examples exceptions exhibits expert extending eye face fafb false feature features few fig figure find first fixation fly flywire follow followed follows for forcing form formation forming forum found four from functionally gager gain gap gaps generally glance global gone good green grouped grow guide happen harder has have helpful hence here highlighted hover how however https human identification identified if image images important in include incorrect indicate indicates indicating indicator indicators information instances instead interact into is isn issue it its jay judgement junctions just keen keep kind known kyle lab label labeled lacking large larger lateral learn least left length less like likely links little ll locations long look looking looks lots low majority make making manually many mark marked material may mckellar meet membrane membranes method middle might mixed moderate more most mouse move moved much multicellular multiple must name near nearby necessary neuron neurons no normal normand not note notice now numbers objects obvious of off often on once one only or organelles originating orthogonal other others our ours out outside over overview painting panel parallel parameters part particular particularly partners patches pedestal perfect pinch pixel pixels place places plane please point points possible possibly postsynaptic potential pre present press presynaptic prevent primary prod production programmatic prominency prominent provide provided psd psds pzxes rare re reasonably receive recognizing red references referred region regions regular relative relatively replicate require required resolution return revealed ribbon right rosette row same sand scattered second secondary section sections see seeing seen segment segments sequential set seung shaded shadow shape shaped shapes shift short shot should show shows shrinking side sides sign signs silverman similar since single site slice sliced slices slide slides sliver small snapshot so some something sometimes space spacebar sparse spot staining starting stepping structures subsequent such surfacing surmounted surround sweeping swelling synapse synapses synapsing synaptic table take tell terminals tested than that the their them there these they thicker thin this those though three through throughout tissue to together tools top touched touches towards tracers train trajectories transition travelling triads tricky try two typical typically unclear uncover unlike unlikely up upon url use used useful using usually variety vary very vesicle vesicles vetted video view viewed views visible visualize vs want wasn way we what when where whether which while will willie with within without won worry would xy xz yes you your yourself yz zheng",
    section: "Archive \u00b7 Synapse Ground Truth",
    description: "FlyWire synapse-recognition guide: vesicle clusters, clefts, T-bars, PSDs (2026 re-sync).",
    aliases: ["fly synapses"],
    keywords: ["synapse", "vesicle", "T-bar", "PSD", "cleft", "FlyWire"]
  },
  {
    title: "Bens Synapse Illustrations",
    url: "drive_docs_output/Triage-Additions/Synapse-GT/Bens%20Synapse%20Illustrations.html",
    section: "Archive \u00b7 Synapse Ground Truth",
    description: "Ben's synapse illustration reference (2016).",
    aliases: ["synapse illustrations"],
    keywords: ["synapse", "illustrations", "reference"]
  },
  {
    title: "Cell modeling instructions (shortcut)",
    url: "drive_docs_output/Triage-Additions/Skeletonization/Cell%20modeling%20instructions%20(shortcut).html",
    section: "Archive \u00b7 Skeletonization",
    description: "Cell modeling instructions (Drive shortcut; link-out).",
    aliases: ["cell modeling instructions"],
    keywords: ["cell modeling", "skeletonization"]
  },
        {
            title: "Soma Arrangement (Color Overlay)",
            url: "gallery/#fig-soma-arrangement-color-overlay",
            section: "Gallery \u00b7 BANC",
            description: "Dense cluster of cell bodies with color segmentation overlay. Each unique color represents an individually segmented soma.",
            aliases: [],
            keywords: ["structure", "dense", "cluster", "cell", "bodies", "color", "segmentation", "overlay", "each", "unique"]
        },
        {
            title: "Single Soma (Color Overlay)",
            url: "gallery/#fig-single-soma-color-overlay",
            section: "Gallery \u00b7 BANC",
            description: "Individual neuronal soma highlighted with color segmentation overlay, showing the cell body boundary and surrounding neighbors.",
            aliases: [],
            keywords: ["structure", "individual", "neuronal", "soma", "highlighted", "color", "segmentation", "overlay", "showing", "cell"]
        },
        {
            title: "Dense Soma Region",
            url: "gallery/#fig-dense-soma-region",
            section: "Gallery \u00b7 BANC",
            description: "Region densely packed with neuronal cell bodies. Nuclei and surrounding neuropil visible throughout.",
            aliases: [],
            keywords: ["structure", "region", "densely", "packed", "neuronal", "cell", "bodies", "nuclei", "surrounding", "neuropil"]
        },
        {
            title: "Sparse Soma Region",
            url: "gallery/#fig-sparse-soma-region",
            section: "Gallery \u00b7 BANC",
            description: "Region with fewer, well-separated cell bodies surrounded by extensive neuropil.",
            aliases: [],
            keywords: ["structure", "region", "fewer", "well", "separated", "cell", "bodies", "surrounded", "extensive", "neuropil"]
        },
        {
            title: "Dark Soma (Possible Glia)",
            url: "gallery/#fig-dark-soma-possible-glia",
            section: "Gallery \u00b7 BANC",
            description: "Darkly stained cell body with electron-dense cytoplasm, possibly glial in origin. Note the distinct contrast difference from surrounding neurons.",
            aliases: [],
            keywords: ["structure", "darkly", "stained", "cell", "body", "electron", "dense", "cytoplasm", "possibly", "glial"]
        },
        {
            title: "Large Soma with Organelles",
            url: "gallery/#fig-large-soma-with-organelles",
            section: "Gallery \u00b7 BANC",
            description: "Exceptionally large neuronal soma rich in organelles including prominent nucleus, endoplasmic reticulum, and mitochondria.",
            aliases: [],
            keywords: ["structure", "exceptionally", "large", "neuronal", "soma", "rich", "organelles", "including", "prominent", "nucleus"]
        },
        {
            title: "Large Soma with Organelles (View 2)",
            url: "gallery/#fig-large-soma-with-organelles-view-2",
            section: "Gallery \u00b7 BANC",
            description: "Second perspective of a large soma showing dense organelle packing. Note the extensive rough endoplasmic reticulum and clustered mitochondria.",
            aliases: [],
            keywords: ["structure", "second", "perspective", "large", "soma", "showing", "dense", "organelle", "packing", "note"]
        },
        {
            title: "Large Soma with Organelles (View 3)",
            url: "gallery/#fig-large-soma-with-organelles-view-3",
            section: "Gallery \u00b7 BANC",
            description: "Third view highlighting the scale of a large neuronal soma relative to surrounding neurites and neuropil.",
            aliases: [],
            keywords: ["structure", "third", "view", "highlighting", "scale", "large", "neuronal", "soma", "relative", "surrounding"]
        },
        {
            title: "Possibly Myelinated Soma",
            url: "gallery/#fig-possibly-myelinated-soma",
            section: "Gallery \u00b7 BANC",
            description: "Soma with an unusually thick membrane border, potentially myelinated. Note: horizontal line artifact from monitor capture is also visible.",
            aliases: [],
            keywords: ["structure", "soma", "unusually", "thick", "membrane", "border", "potentially", "myelinated", "note", "horizontal"]
        },
        {
            title: "Thick Membrane Border",
            url: "gallery/#fig-thick-membrane-border",
            section: "Gallery \u00b7 BANC",
            description: "Soma enclosed by an unusually thick, electron-dense membrane layer. Possible myelination of a cell body &mdash; an uncommon but documented feature. Is this a thing?",
            aliases: [],
            keywords: ["structure", "soma", "enclosed", "unusually", "thick", "electron", "dense", "membrane", "layer", "possible"]
        },
        {
            title: "Golgi Apparatus and Organelles",
            url: "gallery/#fig-golgi-apparatus-and-organelles",
            section: "Gallery \u00b7 BANC",
            description: "Golgi apparatus visible alongside mitochondria, cisternae, microvesicles, and vacuoles near a soma. Cell membrane border clearly delineated.",
            aliases: [],
            keywords: ["structure", "golgi", "apparatus", "visible", "alongside", "mitochondria", "cisternae", "microvesicles", "vacuoles", "near"]
        },
        {
            title: "Golgi Apparatus (Detail)",
            url: "gallery/#fig-golgi-apparatus-detail",
            section: "Gallery \u00b7 BANC",
            description: "Close-up view of Golgi apparatus showing stacked cisternae and associated vesicles within the cytoplasm.",
            aliases: [],
            keywords: ["structure", "close", "view", "golgi", "apparatus", "showing", "stacked", "cisternae", "associated", "vesicles"]
        },
        {
            title: "Membrane Whorls and Golgi Apparatus",
            url: "gallery/#fig-membrane-whorls-and-golgi-apparatus",
            section: "Gallery \u00b7 BANC",
            description: "Large, heavily stained membrane whorls alongside Golgi apparatus and various organelles within or near a cell body.",
            aliases: [],
            keywords: ["structure", "large", "heavily", "stained", "membrane", "whorls", "alongside", "golgi", "apparatus", "various"]
        },
        {
            title: "Dense Organelle Cluster Near Soma",
            url: "gallery/#fig-dense-organelle-cluster-near-soma",
            section: "Gallery \u00b7 BANC",
            description: "Heavily stained organelles including mitochondria clustered near a soma. Note the high electron density contrasting with surrounding cytoplasm.",
            aliases: [],
            keywords: ["structure", "heavily", "stained", "organelles", "including", "mitochondria", "clustered", "near", "soma", "note"]
        },
        {
            title: "Membrane Whorl",
            url: "gallery/#fig-membrane-whorl",
            section: "Gallery \u00b7 BANC",
            description: "Concentric membrane whorl forming a spiral pattern. These lamellar structures are occasionally encountered and may represent myelin figures or autophagic bodies.",
            aliases: [],
            keywords: ["structure", "concentric", "membrane", "whorl", "forming", "spiral", "pattern", "lamellar", "structures", "occasionally"]
        },
        {
            title: "Membrane Spirals (Close-up)",
            url: "gallery/#fig-membrane-spirals-close-up",
            section: "Gallery \u00b7 BANC",
            description: "High-magnification view of concentric membrane spirals. The tightly wound lamellae create a distinctive fingerprint-like pattern.",
            aliases: [],
            keywords: ["structure", "high", "magnification", "view", "concentric", "membrane", "spirals", "tightly", "wound", "lamellae"]
        },
        {
            title: "Orphan Mitochondria Cluster",
            url: "gallery/#fig-orphan-mitochondria-cluster",
            section: "Gallery \u00b7 BANC",
            description: "Isolated cluster of mitochondria and heavily stained myelin-like material. Appears to be an orphan object disconnected from a parent structure.",
            aliases: [],
            keywords: ["structure", "isolated", "cluster", "mitochondria", "heavily", "stained", "myelin", "like", "material", "appears"]
        },
        {
            title: "Orphan Mitochondria Cluster (With Context)",
            url: "gallery/#fig-orphan-mitochondria-cluster-with-context",
            section: "Gallery \u00b7 BANC",
            description: "Same orphan cluster shown with surrounding neuropil, dataset coordinates, and layer information for reference.",
            aliases: [],
            keywords: ["structure", "same", "orphan", "cluster", "shown", "surrounding", "neuropil", "dataset", "coordinates", "layer"]
        },
        {
            title: "Heavily Stained Dark Organelles",
            url: "gallery/#fig-heavily-stained-dark-organelles",
            section: "Gallery \u00b7 BANC",
            description: "Multiple organelles with abnormally heavy staining producing high-contrast, electron-dense profiles. Green horizontal line is a monitor capture artifact. Not sure where that comes from, hmm.",
            aliases: [],
            keywords: ["structure", "multiple", "organelles", "abnormally", "heavy", "staining", "producing", "high", "contrast", "electron"]
        },
        {
            title: "Unidentified Dense Body",
            url: "gallery/#fig-unidentified-dense-body",
            section: "Gallery \u00b7 BANC",
            description: "Dense, heavily stained structure of uncertain identity &mdash; possibly an organelle or a localized section artifact. Differential diagnosis is challenging at this magnification.",
            aliases: [],
            keywords: ["structure", "dense", "heavily", "stained", "uncertain", "identity", "mdash", "possibly", "organelle", "localized"]
        },
        {
            title: "Lipid Droplets",
            url: "gallery/#fig-lipid-droplets",
            section: "Gallery \u00b7 BANC",
            description: "Cluster of lipid droplets (fat globules) appearing as electron-dense spherical inclusions. Commonly found near cell bodies.",
            aliases: [],
            keywords: ["structure", "cluster", "lipid", "droplets", "globules", "appearing", "electron", "dense", "spherical", "inclusions"]
        },
        {
            title: "Staining Anomaly with Micro Tear",
            url: "gallery/#fig-staining-anomaly-with-micro-tear",
            section: "Gallery \u00b7 BANC",
            description: "Heavily stained structure with irregular contrast and a small tear visible within a strange organelle. Combines staining artifact with minor physical damage.",
            aliases: [],
            keywords: ["structure", "heavily", "stained", "irregular", "contrast", "small", "tear", "visible", "within", "strange"]
        },
        {
            title: "Parallel Axon Bundle",
            url: "gallery/#fig-parallel-axon-bundle",
            section: "Gallery \u00b7 BANC",
            description: "Bundle of neurites sectioned in the parallel plane, probably axonal. Note the uniform elongated profiles and consistent diameter.",
            aliases: [],
            keywords: ["structure", "bundle", "neurites", "sectioned", "parallel", "plane", "probably", "axonal", "note", "uniform"]
        },
        {
            title: "Section Damage",
            url: "gallery/#fig-section-damage",
            section: "Gallery \u00b7 BANC",
            description: "Physical damage to the tissue section visible as a dark linear disruption. Green arrows indicate affected regions. Do not annotate across damaged areas.",
            aliases: [],
            keywords: ["defect", "physical", "damage", "tissue", "section", "visible", "dark", "linear", "disruption", "green"]
        },
        {
            title: "Missing Section",
            url: "gallery/#fig-missing-section",
            section: "Gallery \u00b7 BANC",
            description: "Gap in tissue where a slice is absent, creating a void (black region). Green arrows point to the boundary. Data is unrecoverable in these areas.",
            aliases: [],
            keywords: ["defect", "tissue", "where", "slice", "absent", "creating", "void", "black", "region", "green"]
        },
        {
            title: "Membrane Blowout",
            url: "gallery/#fig-membrane-blowout",
            section: "Gallery \u00b7 BANC",
            description: "Localized membrane blowout where tissue has ruptured outward, creating a washed-out void. Green outline marks the affected boundary.",
            aliases: [],
            keywords: ["defect", "localized", "membrane", "blowout", "where", "tissue", "ruptured", "outward", "creating", "washed"]
        },
        {
            title: "Section Pinch",
            url: "gallery/#fig-section-pinch",
            section: "Gallery \u00b7 BANC",
            description: "Tissue compression artifact where the section was pinched during preparation, creating artificial convergence of structures.",
            aliases: [],
            keywords: ["defect", "tissue", "compression", "artifact", "where", "section", "pinched", "during", "preparation", "creating"]
        },
        {
            title: "Section Stretch",
            url: "gallery/#fig-section-stretch",
            section: "Gallery \u00b7 BANC",
            description: "Stretching artifact showing tissue pulled along one axis. Green arrows indicate the direction of distortion. Structures appear elongated and thinned.",
            aliases: [],
            keywords: ["defect", "stretching", "artifact", "showing", "tissue", "pulled", "along", "axis", "green", "arrows"]
        },
        {
            title: "Section Tear",
            url: "gallery/#fig-section-tear",
            section: "Gallery \u00b7 BANC",
            description: "Linear tear through the tissue section creating a clean void. Green arrows mark the tear boundaries. Do not trace structures across the gap.",
            aliases: [],
            keywords: ["defect", "linear", "tear", "through", "tissue", "section", "creating", "clean", "void", "green"]
        },
        {
            title: "Resin Tear",
            url: "gallery/#fig-resin-tear",
            section: "Gallery \u00b7 BANC",
            description: "Tear occurring within the embedding resin rather than the tissue itself. Shows clean break edges characteristic of resin fracture.",
            aliases: [],
            keywords: ["defect", "tear", "occurring", "within", "embedding", "resin", "rather", "than", "tissue", "itself"]
        },
        {
            title: "Section Folds (Overview)",
            url: "gallery/#fig-section-folds-overview",
            section: "Gallery \u00b7 BANC",
            description: "Zoomed-out view of the central brain region showing prominent section folds crossing the tissue. Dark diagonal lines are folded-over tissue creating doubled layers.",
            aliases: [],
            keywords: ["defect", "zoomed", "view", "central", "brain", "region", "showing", "prominent", "section", "folds"]
        },
        {
            title: "Folds with Rippling",
            url: "gallery/#fig-folds-with-rippling",
            section: "Gallery \u00b7 BANC",
            description: "Zoomed-out view showing section folds accompanied by wavy, faded rippling patterns. Tissue appears distorted across a large area.",
            aliases: [],
            keywords: ["defect", "zoomed", "view", "showing", "section", "folds", "accompanied", "wavy", "faded", "rippling"]
        },
        {
            title: "Severe Section Folds",
            url: "gallery/#fig-severe-section-folds",
            section: "Gallery \u00b7 BANC",
            description: "Extreme folding artifact with multiple overlapping fold layers creating near-total data loss in affected regions.",
            aliases: [],
            keywords: ["defect", "extreme", "folding", "artifact", "multiple", "overlapping", "fold", "layers", "creating", "near"]
        },
        {
            title: "Staining Artifact",
            url: "gallery/#fig-staining-artifact",
            section: "Gallery \u00b7 BANC",
            description: "Uneven heavy metal staining producing localized dark deposits that obscure underlying ultrastructure.",
            aliases: [],
            keywords: ["defect", "uneven", "heavy", "metal", "staining", "producing", "localized", "dark", "deposits", "obscure"]
        },
        {
            title: "Splotch Artifact",
            url: "gallery/#fig-splotch-artifact",
            section: "Gallery \u00b7 BANC",
            description: "Irregular dark splotching at section boundaries, likely from staining contamination or resin pooling during preparation.",
            aliases: [],
            keywords: ["defect", "irregular", "dark", "splotching", "section", "boundaries", "likely", "staining", "contamination", "resin"]
        },
        {
            title: "Combined Defects: Staining, Fold, Lipid Droplets",
            url: "gallery/#fig-combined-defects-staining-fold-lipid-droplets",
            section: "Gallery \u00b7 BANC",
            description: "Multiple artifacts in one region: uneven staining, tissue fold (dark diagonal band), and scattered lipid droplets (fat globules).",
            aliases: [],
            keywords: ["defect", "multiple", "artifacts", "region", "uneven", "staining", "tissue", "fold", "dark", "diagonal"]
        },
        {
            title: "Lipid Droplets (Section Artifact)",
            url: "gallery/#fig-lipid-droplets-section-artifact",
            section: "Gallery \u00b7 BANC",
            description: "Scattered lipid droplets (fat globules) appearing as dark spherical inclusions. Green arrows highlight individual droplets. Can be confused with biological structures.",
            aliases: [],
            keywords: ["defect", "scattered", "lipid", "droplets", "globules", "appearing", "dark", "spherical", "inclusions", "green"]
        },
        {
            title: "Multiple Section Errors (Central Chiasm)",
            url: "gallery/#fig-multiple-section-errors-central-chiasm",
            section: "Gallery \u00b7 BANC",
            description: "Central chiasm region exhibiting multiple simultaneous defects: large tissue distortions, folds, and torn areas. Severely compromised data integrity.",
            aliases: [],
            keywords: ["defect", "central", "chiasm", "region", "exhibiting", "multiple", "simultaneous", "defects", "large", "tissue"]
        },
        {
            title: "Section Cracks (aka Lightning&trade;)",
            url: "gallery/#fig-section-cracks-aka-lightningtrade",
            section: "Gallery \u00b7 BANC",
            description: "Zoomed-out view showing branching cracks propagating across the section. Nicknamed &ldquo;lightning&rdquo; for their characteristic branching pattern.",
            aliases: [],
            keywords: ["defect", "zoomed", "view", "showing", "branching", "cracks", "propagating", "across", "section", "nicknamed"]
        },
        {
            title: "Multiple Section Errors (Overview)",
            url: "gallery/#fig-multiple-section-errors-overview",
            section: "Gallery \u00b7 BANC",
            description: "Panoramic view showing a convergence of defect types: folds, cracks, pinch artifacts, and a missing section &mdash; all in one region.",
            aliases: [],
            keywords: ["defect", "panoramic", "view", "showing", "convergence", "types", "folds", "cracks", "pinch", "artifacts"]
        },
        {
            title: "T-bar Synapse",
            url: "gallery/#fig-t-bar-synapse",
            section: "Gallery \u00b7 FAFB 2019",
            description: "Classic T-bar morphology with platform structure, dense body visible in cross-section.",
            aliases: [],
            keywords: ["synapse", "classic", "morphology", "platform", "structure", "dense", "body", "visible", "cross", "section"]
        },
        {
            title: "Elongated T-bar",
            url: "gallery/#fig-elongated-t-bar",
            section: "Gallery \u00b7 FAFB 2019",
            description: "Extended platform variant. Note the longer horizontal extent compared to standard T-bars.",
            aliases: [],
            keywords: ["synapse", "extended", "platform", "variant", "note", "longer", "horizontal", "extent", "compared", "standard"]
        },
        {
            title: "Multiple T-bars (Smudge)",
            url: "gallery/#fig-multiple-t-bars-smudge",
            section: "Gallery \u00b7 FAFB 2019",
            description: "Clustered synapses appearing as smudge-like shapes. Common in regions of high synaptic density.",
            aliases: [],
            keywords: ["synapse", "clustered", "synapses", "appearing", "smudge", "like", "shapes", "common", "regions", "high"]
        },
        {
            title: "GT Protocol Reference 6",
            url: "gallery/#fig-gt-protocol-reference-6",
            section: "Gallery \u00b7 Reference Materials",
            description: "Ambiguous cases and decision criteria for edge cases.",
            aliases: [],
            keywords: ["synapse", "ambiguous", "cases", "decision", "criteria", "edge"]
        },
        {
            title: "GT Task Description (MEC cutout)",
            url: "gallery/#fig-gt-task-description-mec",
            section: "Gallery · Reference Materials",
            description: "WebKnossos task panel for the mec_cutout_0_upsampled volume, with the segmentation instructions for the task.",
            aliases: ["task description", "mec cutout task", "task instructions"],
            keywords: ["webknossos", "task", "segment", "cells", "myelin", "invaginations", "mitochondria", "extracellular", "volume", "orthogonal", "oblique"],
            text: "Datasets Annotations Tasks mec_cutout_0_upsampled volume orthogonal oblique. Segment all cells. Segment myelin as a separate object, without padding between the myelin and neighboring objects. Pay special attention to segment any invaginations, or invagination-like structures. Do NOT oversegment mitochondria. Leave extracellular space unsegmented."
        },
        {
            title: "WebKnossos AI Segmentation Panel",
            url: "gallery/#fig-wk-ai-segmentation-panel",
            section: "Gallery · Reference Materials",
            description: "AI-assisted segmentation settings panel in WebKnossos: prediction depth, confidence threshold, direction, and extra condition.",
            aliases: ["ai segmentation panel", "ai tool settings", "ai inference settings"],
            keywords: ["webknossos", "ai", "prediction", "depth", "confidence", "threshold", "direction", "forward", "backward", "points", "mask", "inference"],
            text: "Prediction Depth 16 Confidence Threshold 0.5 Direction Forward Backward Extra Condition None Points Mask Dataset upsample Owner"
        }
    ];

    /* ----------------------------------------------------------------------
       SITE ROOT DETECTION
       Reads the URL of this script tag so result links work whether the site
       is served from borkbook.com (root) or github.io/tracer-workspace/.
       ---------------------------------------------------------------------- */
    var SITE_ROOT = (function () {
        var scripts = document.getElementsByTagName('script');
        for (var i = scripts.length - 1; i >= 0; i--) {
            var src = scripts[i].src || '';
            if (/\/search\.js(\?|$)/.test(src)) {
                return src.replace(/search\.js(\?.*)?$/, '');
            }
        }
        return '/';
    })();

    /* ----------------------------------------------------------------------
       FUZZY SCORER
       Hand-rolled because the corpus is tiny (~30 entries) — no need for
       Fuse.js or an external CDN. Scoring rules per (query-term × field):
         exact word     → full weight
         prefix         → 0.8 × weight   (term ≥ 2 chars)
         substring      → 0.5 × weight   (term ≥ 4 chars)
         1-edit-distance → 0.6 × weight  (term ≥ 3 chars; handles typos)
       Then the entry's score is sum-over-terms of best (field) score, with a
       coverage multiplier that rewards entries matching every query term.
       ---------------------------------------------------------------------- */
    function tokenize(s) {
        return (s || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    }

    function within1Edit(a, b) {
        if (a === b) return true;
        if (Math.abs(a.length - b.length) > 1) return false;
        var shorter = a.length <= b.length ? a : b;
        var longer = a.length <= b.length ? b : a;
        var i = 0, j = 0, edits = 0;
        while (i < shorter.length && j < longer.length) {
            if (shorter[i] === longer[j]) { i++; j++; }
            else {
                edits++;
                if (edits > 1) return false;
                if (shorter.length === longer.length) { i++; j++; }
                else { j++; }
            }
        }
        if (j < longer.length) edits += longer.length - j;
        return edits <= 1;
    }

    // Single adjacent transposition (e.g. "synaspe" ~ "synapse", "mitochondira" ~ "mitochondria").
    // Common typo class not covered by 1-edit Levenshtein.
    function oneTransposition(a, b) {
        if (a.length !== b.length || a.length < 2) return false;
        var firstDiff = -1;
        for (var i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) {
                if (firstDiff === -1) {
                    firstDiff = i;
                } else if (i === firstDiff + 1 && a[firstDiff] === b[i] && a[i] === b[firstDiff]) {
                    for (var j = i + 1; j < a.length; j++) {
                        if (a[j] !== b[j]) return false;
                    }
                    return true;
                } else {
                    return false;
                }
            }
        }
        return false; // no diff found means strings are equal — but we returned true at the top already
    }

    function fuzzyMatch(term, word) {
        if (term.length >= 3 && (within1Edit(term, word) || oneTransposition(term, word))) return true;
        return false;
    }

    function scoreTermAgainstWords(term, words, weight) {
        var best = 0;
        for (var k = 0; k < words.length; k++) {
            var w = words[k];
            var s = 0;
            if (w === term) s = weight;
            else if (term.length >= 2 && w.indexOf(term) === 0) s = weight * 0.8;
            else if (term.length >= 4 && w.indexOf(term) !== -1) s = weight * 0.5;
            else if (fuzzyMatch(term, w)) s = weight * 0.6;
            if (s > best) best = s;
        }
        return best;
    }

    function fieldWords(arr) {
        var out = [];
        for (var i = 0; i < arr.length; i++) {
            var t = tokenize(arr[i]);
            for (var j = 0; j < t.length; j++) out.push(t[j]);
        }
        return out;
    }

    function scoreEntry(query, entry) {
        var terms = tokenize(query);
        if (!terms.length) return 0;

        var titleWords = tokenize(entry.title);
        var sectionWords = tokenize(entry.section);
        var descWords = tokenize(entry.description);
        var aliasWords = fieldWords(entry.aliases || []);
        var keywordWords = fieldWords(entry.keywords || []);
        // `text` holds bulk extracted content (OCR / harvested PDF page text).
        // Scored at the lowest weight so it never out-ranks curated fields.
        var textWords = entry.text ? tokenize(entry.text) : [];

        var total = 0;
        var matched = 0;
        for (var i = 0; i < terms.length; i++) {
            var term = terms[i];
            var s = Math.max(
                scoreTermAgainstWords(term, titleWords, 10),
                scoreTermAgainstWords(term, aliasWords, 8),
                scoreTermAgainstWords(term, keywordWords, 6),
                scoreTermAgainstWords(term, sectionWords, 4),
                scoreTermAgainstWords(term, descWords, 2),
                scoreTermAgainstWords(term, textWords, 2)
            );
            if (s > 0) matched++;
            total += s;
        }
        if (matched === 0) return 0;
        if (terms.length > 1) {
            // Reward entries that cover more query terms
            total *= (0.5 + 0.5 * (matched / terms.length));
        }
        return total;
    }

    /* ----------------------------------------------------------------------
       OPERATOR PARSER — Google-style query operators on top of the existing
       fuzzy scoring.
           +term       term must appear somewhere in the entry
           -term       entries containing this term are excluded
           "exact phrase"   exact substring must appear somewhere
           section:foo restrict to entries whose section contains "foo"
       Bare words keep current soft-OR behavior (contribute to score, with
       coverage bonus when multiple match). Operators are silent if absent —
       backward-compatible with every existing query.
       ---------------------------------------------------------------------- */
    function parseQuery(query) {
        var parsed = { terms: [], required: [], excluded: [], phrases: [], fields: {} };
        if (!query) return parsed;

        // Extract "quoted phrases" first
        var phraseRx = /"([^"]+)"/g;
        var m;
        while ((m = phraseRx.exec(query)) !== null) {
            var p = m[1].trim();
            if (p) parsed.phrases.push(p.toLowerCase());
        }
        var remaining = query.replace(phraseRx, ' ').trim();

        // Tokenize remaining on whitespace
        var tokens = remaining.split(/\s+/);
        for (var i = 0; i < tokens.length; i++) {
            var t = tokens[i];
            if (!t) continue;
            // Ignore an explicit "OR" — bare words already OR-combine
            if (t.toUpperCase() === 'OR') continue;
            // field:value (e.g. section:gallery) — colon not at start/end
            var colon = t.indexOf(':');
            if (colon > 0 && colon < t.length - 1) {
                var field = t.substring(0, colon).toLowerCase();
                var value = t.substring(colon + 1).toLowerCase();
                if (!parsed.fields[field]) parsed.fields[field] = [];
                parsed.fields[field].push(value);
                continue;
            }
            if (t.charAt(0) === '+' && t.length > 1) {
                parsed.required.push(t.substring(1).toLowerCase());
            } else if (t.charAt(0) === '-' && t.length > 1) {
                parsed.excluded.push(t.substring(1).toLowerCase());
            } else {
                parsed.terms.push(t.toLowerCase());
            }
        }
        return parsed;
    }

    function buildEntryHaystack(entry) {
        // Concatenated lowercase text of every searchable field — used for
        // operator filters (substring checks).
        var parts = [entry.title || '', entry.section || '', entry.description || ''];
        if (entry.aliases) for (var i = 0; i < entry.aliases.length; i++) parts.push(entry.aliases[i]);
        if (entry.keywords) for (var j = 0; j < entry.keywords.length; j++) parts.push(entry.keywords[j]);
        if (entry.text) parts.push(entry.text);
        return parts.join(' ').toLowerCase();
    }

    function search(query, limit) {
        var parsed = parseQuery(query);
        var hasFilters = parsed.required.length || parsed.excluded.length
            || parsed.phrases.length || Object.keys(parsed.fields).length;

        var results = [];
        for (var i = 0; i < INDEX.length; i++) {
            var entry = INDEX[i];

            // Apply operator filters (substring against entry haystack)
            if (hasFilters) {
                var hay = buildEntryHaystack(entry);
                var skip = false;
                for (var x = 0; !skip && x < parsed.excluded.length; x++) {
                    if (hay.indexOf(parsed.excluded[x]) !== -1) skip = true;
                }
                for (var r = 0; !skip && r < parsed.required.length; r++) {
                    if (hay.indexOf(parsed.required[r]) === -1) skip = true;
                }
                for (var p = 0; !skip && p < parsed.phrases.length; p++) {
                    if (hay.indexOf(parsed.phrases[p]) === -1) skip = true;
                }
                if (!skip && parsed.fields.section) {
                    var sec = (entry.section || '').toLowerCase();
                    var ok = false;
                    for (var f = 0; f < parsed.fields.section.length; f++) {
                        if (sec.indexOf(parsed.fields.section[f]) !== -1) { ok = true; break; }
                    }
                    if (!ok) skip = true;
                }
                if (skip) continue;
            }

            // Score using soft terms + required + phrases (all bias ranking;
            // required and phrases were gated above so this is purely additive).
            var scoreParts = parsed.terms.slice();
            for (var k = 0; k < parsed.required.length; k++) scoreParts.push(parsed.required[k]);
            for (var q = 0; q < parsed.phrases.length; q++) scoreParts.push(parsed.phrases[q]);

            var s;
            if (scoreParts.length) {
                s = scoreEntry(scoreParts.join(' '), entry);
            } else if (hasFilters) {
                // Filter-only query (e.g. "section:gallery") — accept with a
                // base score so results still appear consistently.
                s = 1;
            } else {
                s = 0;
            }
            if (s > 0) results.push({ score: s, entry: entry });
        }
        results.sort(function (a, b) { return b.score - a.score; });
        if (typeof limit === 'number' && limit > 0) return results.slice(0, limit);
        return results;
    }

    /* ----------------------------------------------------------------------
       HIGHLIGHT — wrap matched text in <mark> for visual emphasis in result
       listings. Two passes per text:
         1. Substring match each query term ≥ 2 chars (case-insensitive)
            → catches "synapse" inside "synapses".
         2. Whole-word fuzzy match (1-edit / 1-transposition) for words not
            already covered → catches "synapse" inside descriptions even when
            the user typed "syanpse".
       Returns HTML-safe string. Always escape first, then inject <mark>.
       ---------------------------------------------------------------------- */
    function escapeRegex(s) {
        return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function highlight(text, query) {
        if (!text) return '';
        var escaped = escapeHTML(text);
        if (!query) return escaped;

        var rawTerms = tokenize(query);
        var terms = [];
        for (var i = 0; i < rawTerms.length; i++) {
            if (rawTerms[i].length >= 2) terms.push(rawTerms[i]);
        }
        if (!terms.length) return escaped;

        // Pass 2: collect whole words from the text that fuzzy-match a term but
        // aren't already covered by substring matching.
        var fuzzyWords = {};
        var words = (text.match(/[a-zA-Z0-9]+/g) || []);
        for (var w = 0; w < words.length; w++) {
            var wLower = words[w].toLowerCase();
            var coveredBySubstring = false;
            for (var t = 0; t < terms.length; t++) {
                if (wLower.indexOf(terms[t]) !== -1) { coveredBySubstring = true; break; }
            }
            if (coveredBySubstring) continue;
            for (var t = 0; t < terms.length; t++) {
                var term = terms[t];
                if (term.length < 3) continue;
                if (within1Edit(term, wLower) || oneTransposition(term, wLower)) {
                    fuzzyWords[wLower] = true;
                    break;
                }
            }
        }

        // Build combined regex: substring patterns for terms + word-boundary
        // patterns for the fuzzy-matched words.
        var patterns = [];
        for (var i = 0; i < terms.length; i++) patterns.push(escapeRegex(terms[i]));
        for (var fw in fuzzyWords) {
            if (Object.prototype.hasOwnProperty.call(fuzzyWords, fw)) {
                patterns.push('\\b' + escapeRegex(fw) + '\\b');
            }
        }
        var rx = new RegExp('(' + patterns.join('|') + ')', 'gi');
        return escaped.replace(rx, '<mark>$1</mark>');
    }

    /* ----------------------------------------------------------------------
       "DID YOU MEAN" — when a query returns nothing, suggest a correction by
       swapping each unknown term for its closest fuzzy match in the index
       vocabulary (titles + aliases + keywords). Returns '' if nothing better
       was found or the suggestion equals the original.
       ---------------------------------------------------------------------- */
    var VOCAB = null;
    function buildVocab() {
        if (VOCAB) return VOCAB;
        var set = {};
        for (var i = 0; i < INDEX.length; i++) {
            var e = INDEX[i];
            var words = tokenize(e.title)
                .concat(fieldWords(e.aliases || []))
                .concat(fieldWords(e.keywords || []));
            for (var w = 0; w < words.length; w++) {
                if (words[w].length >= 3) set[words[w]] = true;
            }
        }
        VOCAB = Object.keys(set);
        return VOCAB;
    }

    function suggestQuery(query) {
        var terms = tokenize(query);
        if (!terms.length) return '';
        var vocab = buildVocab();
        var changed = false;
        var out = [];
        for (var i = 0; i < terms.length; i++) {
            var term = terms[i];
            // Already a substring of a known word? Keep it as typed.
            var known = false;
            for (var v = 0; v < vocab.length; v++) {
                if (vocab[v].indexOf(term) !== -1) { known = true; break; }
            }
            if (known || term.length < 3) { out.push(term); continue; }
            var best = null;
            for (var v2 = 0; v2 < vocab.length; v2++) {
                if (within1Edit(term, vocab[v2]) || oneTransposition(term, vocab[v2])) { best = vocab[v2]; break; }
            }
            if (best) { out.push(best); changed = true; } else out.push(term);
        }
        if (!changed) return '';
        var suggestion = out.join(' ');
        return suggestion.toLowerCase() === query.trim().toLowerCase() ? '' : suggestion;
    }

    /* ----------------------------------------------------------------------
       SNIPPET HELPERS — for the dropdown result rows.
         snippetWindow   trims a long description to a window around the match
         textContainsTerm whether any query term is visible in given text
         matchedTags     keyword/alias phrases a query hit (shows *why* a row
                         matched when the term isn't visible in title/desc)
       ---------------------------------------------------------------------- */
    function snippetWindow(text, query, radius) {
        if (!text || text.length <= radius * 2 + 20) return text || '';
        var lower = text.toLowerCase();
        var terms = tokenize(query);
        var pos = -1;
        for (var i = 0; i < terms.length; i++) {
            if (terms[i].length < 2) continue;
            var p = lower.indexOf(terms[i]);
            if (p !== -1 && (pos === -1 || p < pos)) pos = p;
        }
        if (pos === -1) return text.slice(0, radius * 2) + '…';
        var start = Math.max(0, pos - radius);
        var end = Math.min(text.length, pos + radius);
        var out = text.slice(start, end);
        if (start > 0) out = '…' + out;
        if (end < text.length) out = out + '…';
        return out;
    }

    function textContainsTerm(text, query) {
        var terms = tokenize(query);
        var words = tokenize(text);
        for (var t = 0; t < terms.length; t++) {
            var term = terms[t];
            if (term.length < 2) continue;
            for (var w = 0; w < words.length; w++) {
                if (words[w].indexOf(term) !== -1 || (term.length >= 3 && fuzzyMatch(term, words[w]))) return true;
            }
        }
        return false;
    }

    function matchedTags(entry, query) {
        var terms = tokenize(query);
        if (!terms.length) return [];
        var tags = (entry.aliases || []).concat(entry.keywords || []);
        var hits = [];
        var seen = {};
        for (var i = 0; i < tags.length; i++) {
            var tag = tags[i];
            var tagWords = tokenize(tag);
            var hit = false;
            for (var t = 0; t < terms.length && !hit; t++) {
                var term = terms[t];
                if (term.length < 2) continue;
                for (var w = 0; w < tagWords.length; w++) {
                    var tw = tagWords[w];
                    if (tw.indexOf(term) !== -1 || (term.length >= 3 && fuzzyMatch(term, tw))) { hit = true; break; }
                }
            }
            if (hit && !seen[tag.toLowerCase()]) { hits.push(tag); seen[tag.toLowerCase()] = true; }
        }
        return hits;
    }

    /* ----------------------------------------------------------------------
       PUBLIC API
       Exposed so other pages (notably the Archive / All Documents page) can
       render from the same source of truth instead of duplicating data.
       ---------------------------------------------------------------------- */
    window.SiteSearch = {
        INDEX: INDEX,
        search: search,
        scoreEntry: scoreEntry,
        highlight: highlight,
        parseQuery: parseQuery,
        SITE_ROOT: SITE_ROOT
    };

    /* ----------------------------------------------------------------------
       STYLES — injected as a single <style> so no per-page CSS is needed.
       ---------------------------------------------------------------------- */
    function injectStyles() {
        var style = document.createElement('style');
        style.setAttribute('data-site-search', '');
        style.textContent =
            // Reserve scrollbar gutter site-wide so no page shifts horizontally
            // when content overflows (or when expanding/collapsing accordion items).
            'html{scrollbar-gutter:stable;}' +
            // Width-lock for nav links: a hidden bold copy of the text sits below
            // each link with height:0, so the link box is always sized to its
            // bold-state width. The active aria-current="page" link can flip to
            // font-weight:600 without shifting any siblings. Requires data-text
            // attribute on each link — set by lockNavLinkWidths() below.
            'nav>ul>li>a,nav>ul>li>.nav-more-btn{display:inline-block;}' +
            'nav>ul>li>a::after,nav>ul>li>.nav-more-btn::after{content:attr(data-text);display:block;height:0;overflow:hidden;visibility:hidden;font-weight:600;user-select:none;pointer-events:none;}' +
            // Anchor the nav so the absolutely-positioned search can hug its right edge
            // without affecting the existing centered link layout.
            'nav{position:relative;}' +
            // Search bar floats at the right side of the nav with a small buffer from
            // the viewport edge — does NOT live in the link flow, so it never shifts
            // the centered nav links.
            '.nav-search{position:absolute;right:1rem;top:50%;transform:translateY(-50%);margin:0;list-style:none;}' +
            '.nav-search-wrap{position:relative;}' +
            '#site-search{width:220px;font:inherit;font-size:0.8125rem;padding:0.375rem 0.625rem;border:1px solid #444;border-radius:4px;background-color:rgba(255,255,255,0.08);color:#ffffff;box-sizing:border-box;-webkit-appearance:none;appearance:none;}' +
            '#site-search::placeholder{color:#a3a3a3;}' +
            '#site-search:focus{outline:none;background-color:rgba(255,255,255,0.15);border-color:#93c5fd;box-shadow:0 0 0 2px rgba(147,197,253,0.25);}' +
            // Dropdown — light surface, anchored to right edge of the input
            '.site-search-results{list-style:none;margin:0;padding:0;position:absolute;top:calc(100% + 6px);right:0;min-width:320px;max-width:min(420px,calc(100vw - 2rem));background-color:#ffffff;border:1px solid #d4d4d4;border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,0.18);max-height:70vh;overflow-y:auto;z-index:1001;display:none;}' +
            '.site-search-results.open{display:block;}' +
            '.site-search-results li{border-bottom:1px solid #f0f0f0;}' +
            '.site-search-results li:last-child{border-bottom:none;}' +
            '.site-search-results a{display:block;padding:0.625rem 0.875rem;text-decoration:none;color:#1a1a1a;}' +
            '.site-search-results a:hover,.site-search-results li.active a{background-color:#eff6ff;}' +
            '.site-search-results .result-title{font-weight:600;font-size:0.9375rem;color:#1a1a1a;}' +
            '.site-search-results .result-section{font-size:0.75rem;color:#2563eb;margin-left:0.5rem;}' +
            '.site-search-results .result-desc{font-size:0.8125rem;color:#525252;margin-top:0.125rem;line-height:1.4;}' +
            // Italic "matches: …" line shown when the hit was in a keyword/alias
            // rather than the visible title/description.
            '.site-search-results .result-tags{font-size:0.75rem;color:#737373;margin-top:0.1875rem;font-style:italic;}' +
            // Count header at the top of the dropdown ("12 matches" / "Showing top 8 of 12").
            '.site-search-count{font-size:0.6875rem;color:#737373;padding:0.375rem 0.875rem;background-color:#fafafa;border-bottom:1px solid #f0f0f0;text-transform:uppercase;letter-spacing:0.03em;}' +
            '.site-search-empty{padding:0.875rem;font-size:0.875rem;color:#737373;text-align:center;}' +
            // "Did you mean <suggestion>?" row on a no-results query.
            '.site-search-suggest-wrap{padding:0.625rem 0.875rem;font-size:0.875rem;color:#525252;text-align:center;}' +
            '.site-search-suggest{color:#2563eb;font-weight:600;text-decoration:none;}' +
            '.site-search-suggest:hover{text-decoration:underline;}' +
            // Highlighted matched text inside results (Ctrl-F style). Scoped so
            // we never restyle <mark> used elsewhere on the site.
            // No horizontal padding — otherwise the background extends past the
            // highlighted characters and creates a visible gap before the next
            // letter (e.g. "synapse|s" inside "synapses").
            '.site-search-results mark,.search-results-list mark,.all-docs-list mark{background-color:#fef3c7;color:inherit;padding:0;border-radius:2px;}' +
            // Landing highlight — what the user sees after clicking a search
            // result and landing on the destination page. Larger box-shadow halo
            // for a "look here!" effect, fades out after ~3 seconds.
            '.site-search-landing-highlight{background-color:#fef3c7;color:inherit;border-radius:3px;box-shadow:0 0 0 4px #fef3c7;transition:background-color 1.5s ease-out,box-shadow 1.5s ease-out;animation:site-search-landing-pulse 1.2s ease-in-out 1;}' +
            '.site-search-landing-highlight.fading{background-color:transparent;box-shadow:0 0 0 0 transparent;}' +
            '@keyframes site-search-landing-pulse{0%{background-color:#fef3c7;box-shadow:0 0 0 4px #fef3c7;}50%{background-color:#fbbf24;box-shadow:0 0 0 10px #fde68a;}100%{background-color:#fef3c7;box-shadow:0 0 0 4px #fef3c7;}}' +
            '@media (prefers-reduced-motion: reduce){.site-search-landing-highlight{animation:none;}}' +
            '.site-search-seeall{border-top:1px solid #e5e5e5;background-color:#fafafa;}' +
            '.site-search-seeall a{display:block;padding:0.625rem 0.875rem;text-decoration:none;color:#2563eb;font-weight:600;font-size:0.8125rem;}' +
            '.site-search-seeall a:hover{background-color:#eff6ff;text-decoration:underline;}' +
            '.site-search-hint{font-size:0.6875rem;color:#a3a3a3;padding:0.375rem 0.875rem;border-top:1px solid #f0f0f0;text-align:right;}' +
            // Narrow screens: drop the absolute position, let the search sit below the
            // nav links on its own row, full width.
            '@media (max-width:700px){nav{position:static;}.nav-search{position:static;transform:none;display:block;width:100%;margin-top:0.5rem;padding:0 0.5rem;box-sizing:border-box;}#site-search{width:100%;}.site-search-results{left:0;right:0;min-width:0;max-width:none;}}' +
            // Touch devices (no real hover): the More dropdown's CSS :hover/:focus-within
            // open is unreliable on tap, so we drive it explicitly with a JS-toggled class
            // (see initMoreDropdown). Scoped entirely inside @media (hover:none) so mouse /
            // laptop users keep the exact original hover behaviour — nothing here applies to them.
            '@media (hover:none){.nav-more:hover .nav-more-menu,.nav-more:focus-within .nav-more-menu{display:none;}.nav-more.nav-more-open .nav-more-menu{display:block;}}' +
            // iOS Safari auto-zooms to any focused input whose font-size is < 16px. The
            // search input is 0.8125rem (~13px), so tapping it zooms the page in — jarring,
            // and it leaves the viewport in a scale state where double-tap-to-reset misfires.
            // Bumping to exactly 16px on touch devices prevents the auto-zoom outright.
            // Mouse/desktop users keep the smaller 0.8125rem (this block never matches them).
            '@media (hover:none){#site-search{font-size:16px;}}' +
            // Back-to-top button — floats bottom-right, fades in once the user has
            // scrolled past ~2 viewport heights, smooth-scrolls to the top. Injected
            // on every page (see injectBackToTop) so no per-page edits are needed.
            // Sits below the search dropdown (z-index 1001) so it never overlaps it.
            '.site-backtotop{position:fixed;bottom:1.25rem;right:1.25rem;z-index:998;display:inline-flex;align-items:center;gap:0.375rem;padding:0.5rem 0.85rem;font:inherit;font-size:0.8125rem;font-weight:600;color:#ffffff;background-color:#1a1a1a;border:1px solid #444;border-radius:999px;box-shadow:0 2px 10px rgba(0,0,0,0.25);cursor:pointer;opacity:0;transform:translateY(8px);pointer-events:none;transition:opacity .2s ease,transform .2s ease,background-color .15s ease,border-color .15s ease;}' +
            '.site-backtotop.visible{opacity:1;transform:translateY(0);pointer-events:auto;}' +
            '.site-backtotop:hover{background-color:#333333;border-color:#666;}' +
            '.site-backtotop:focus-visible{outline:none;box-shadow:0 0 0 3px rgba(147,197,253,0.5);}' +
            '.site-backtotop .bt-arrow{font-size:0.95rem;line-height:1;}' +
            '@media (prefers-reduced-motion: reduce){.site-backtotop{transition:opacity .2s ease;transform:none;}.site-backtotop:not(.visible){transform:none;}}' +
            '@media print{.nav-search,.site-backtotop{display:none;}}';
        document.head.appendChild(style);
    }

    /* ----------------------------------------------------------------------
       DOM CONSTRUCTION — adds a <li class="nav-search"> to the existing
       navigation <ul> so the search input sits on the right of the top bar.
       Auto-creates a <ul> if the page's <nav> is minimal (e.g. just a single
       "← Back" link with no list), so leaf doc pages can host the bar too.
       ---------------------------------------------------------------------- */
    function injectSearchBar() {
        var nav = document.querySelector('nav');
        if (!nav) return null;
        var ul = nav.querySelector('ul');
        if (!ul) {
            ul = document.createElement('ul');
            ul.setAttribute('data-injected-by', 'site-search');
            nav.appendChild(ul);
        }

        var li = document.createElement('li');
        li.className = 'nav-search';
        li.innerHTML =
            '<div class="nav-search-wrap">' +
                '<input type="search" id="site-search" placeholder="Search…" autocomplete="off" aria-label="Search site" aria-controls="site-search-results" aria-haspopup="listbox">' +
                '<ul id="site-search-results" class="site-search-results" role="listbox"></ul>' +
            '</div>';
        ul.appendChild(li);
        return li;
    }

    /* ----------------------------------------------------------------------
       BACK-TO-TOP — a floating button appended to <body> on every page. Stays
       hidden until the user has scrolled past ~2 viewport heights, then fades
       in at the bottom-right. Click smooth-scrolls to the top (honours
       prefers-reduced-motion). Scroll handler is rAF-throttled.
       ---------------------------------------------------------------------- */
    function injectBackToTop() {
        if (document.querySelector('.site-backtotop')) return null;
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'site-backtotop';
        btn.setAttribute('aria-label', 'Back to top');
        btn.innerHTML = '<span class="bt-arrow" aria-hidden="true">↑</span> Back to top';
        document.body.appendChild(btn);

        var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        btn.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
        });

        var ticking = false;
        function onScroll() {
            if (ticking) return;
            ticking = true;
            window.requestAnimationFrame(function () {
                var y = window.pageYOffset || document.documentElement.scrollTop || 0;
                if (y > window.innerHeight * 2) btn.classList.add('visible');
                else btn.classList.remove('visible');
                ticking = false;
            });
        }
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll, { passive: true });
        onScroll();
        return btn;
    }

    function escapeHTML(s) {
        return (s || '').replace(/[&<>"']/g, function (c) {
            return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
        });
    }

    function renderResults(results, listEl, query, total, suggestion) {
        listEl.innerHTML = '';
        var queryStr = (query || '').trim();
        total = (typeof total === 'number') ? total : results.length;

        // Count header — only when there are results.
        if (results.length) {
            var countLi = document.createElement('li');
            countLi.className = 'site-search-count';
            countLi.textContent = total > results.length
                ? ('Showing top ' + results.length + ' of ' + total + ' matches')
                : (total + (total === 1 ? ' match' : ' matches'));
            listEl.appendChild(countLi);
        }

        if (!results.length) {
            var empty = document.createElement('li');
            empty.className = 'site-search-empty';
            empty.innerHTML = 'No matches for <strong>' + escapeHTML(queryStr) + '</strong>.';
            listEl.appendChild(empty);
            if (suggestion) {
                var sug = document.createElement('li');
                sug.className = 'site-search-suggest-wrap';
                sug.innerHTML = 'Did you mean <a href="#" class="site-search-suggest" data-suggest="' +
                    escapeHTML(suggestion) + '">' + escapeHTML(suggestion) + '</a>?';
                listEl.appendChild(sug);
            }
        } else {
            for (var i = 0; i < results.length; i++) {
                var r = results[i];
                var li = document.createElement('li');
                li.setAttribute('role', 'option');
                li.dataset.index = String(i);
                var a = document.createElement('a');
                a.href = appendSearchHash(SITE_ROOT + r.entry.url, queryStr);
                var descText = snippetWindow(r.entry.description || '', queryStr, 70);
                var html =
                    '<span class="result-title">' + highlight(r.entry.title, queryStr) + '</span>' +
                    '<span class="result-section">' + escapeHTML(r.entry.section) + '</span>' +
                    '<div class="result-desc">' + highlight(descText, queryStr) + '</div>';
                // When the query term isn't visible in the title/description,
                // surface the keyword/alias that actually matched so the row's
                // relevance is obvious (e.g. searching "dense" → "matches: dense cluster").
                if (!textContainsTerm((r.entry.title || '') + ' ' + (r.entry.description || ''), queryStr)) {
                    var tags = matchedTags(r.entry, queryStr);
                    if (tags.length) {
                        html += '<div class="result-tags">matches: ' +
                            highlight(tags.slice(0, 4).join(', '), queryStr) + '</div>';
                    }
                }
                a.innerHTML = html;
                li.appendChild(a);
                listEl.appendChild(li);
            }
        }
        // Always-present footer link to the full search-results view (the archive page).
        var seeAll = document.createElement('li');
        seeAll.className = 'site-search-seeall';
        var seeAllLink = document.createElement('a');
        seeAllLink.href = SITE_ROOT + 'archive/?q=' + encodeURIComponent(queryStr);
        seeAllLink.textContent = 'View all results for "' + queryStr + '" in Archive →';
        seeAll.appendChild(seeAllLink);
        listEl.appendChild(seeAll);

        var hint = document.createElement('li');
        hint.className = 'site-search-hint';
        hint.textContent = '↑↓ navigate · Enter → all results · Esc close';
        listEl.appendChild(hint);
    }

    /* ----------------------------------------------------------------------
       LINK BUILDER — appends a q= param to a URL's hash so the landing
       handler can find/highlight the term on the destination page. Handles
       URLs that already have a hash (e.g. tasks/#semantic-segmentation), in
       which case q= is added with & rather than #.
       ---------------------------------------------------------------------- */
    function appendSearchHash(url, query) {
        if (!query) return url;
        var encoded = 'q=' + encodeURIComponent(query);
        var hashIdx = url.indexOf('#');
        if (hashIdx === -1) return url + '#' + encoded;
        var existing = url.substring(hashIdx + 1);
        return url.substring(0, hashIdx) + '#' + (existing ? existing + '&' : '') + encoded;
    }

    /* ----------------------------------------------------------------------
       SEARCH LANDING
       When a page is loaded with #q=... in the URL hash (set on result links),
       walk the DOM for the first occurrence of any query term, open any
       containing <details> accordion, scroll into view, and pulse-highlight
       the matched text for ~3 seconds before fading it out. Mirrors Chrome's
       "Scroll to Text Fragment" feel, but works in every browser.
       ---------------------------------------------------------------------- */
    // Hash can carry both a bare anchor id (browser-native scroll target) and
    // a q= param, separated by &. e.g. "#semantic-segmentation&q=synapse"
    function parseLandingHash() {
        var hash = (window.location.hash || '').replace(/^#/, '');
        var out = { q: '', target: '' };
        if (!hash) return out;
        var parts = hash.split('&');
        for (var i = 0; i < parts.length; i++) {
            var p = parts[i];
            if (!p) continue;
            if (p.indexOf('q=') === 0) {
                try { out.q = decodeURIComponent(p.substring(2).replace(/\+/g, ' ')); } catch (e) {}
            } else if (p.indexOf('=') === -1 && !out.target) {
                out.target = p;
            }
        }
        return out;
    }

    function findFirstTextMatch(root, rx) {
        if (!root || typeof document.createTreeWalker !== 'function') return null;
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode: function (node) {
                var parent = node.parentNode;
                if (!parent) return NodeFilter.FILTER_REJECT;
                var tag = parent.tagName;
                if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NAV' || tag === 'FOOTER') {
                    return NodeFilter.FILTER_REJECT;
                }
                // Don't land on the search bar itself or its dropdown
                if (parent.closest && parent.closest('.nav-search, .site-search-bar, .search-mode-banner')) {
                    return NodeFilter.FILTER_REJECT;
                }
                if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        });
        var node;
        while ((node = walker.nextNode())) {
            var match = rx.exec(node.nodeValue);
            if (match) {
                return { node: node, start: match.index, end: match.index + match[0].length };
            }
        }
        return null;
    }

    function handleSearchLanding() {
        var params = parseLandingHash();

        // If a bare anchor target is in the hash, open it (and any containing
        // <details>) up front. Also use it as the SCOPE for the highlight
        // search below — without scoping, the page's first "synapse" might
        // be in a different figure than the one the user actually clicked.
        var scope = document.body;
        var targetEl = null;
        if (params.target) {
            targetEl = document.getElementById(params.target);
            if (targetEl) {
                var ancT = targetEl;
                while (ancT && ancT !== document.body) {
                    if (ancT.tagName === 'DETAILS' && !ancT.hasAttribute('open')) ancT.open = true;
                    ancT = ancT.parentNode;
                }
                scope = targetEl;
            }
        }

        if (!params.q) {
            if (targetEl && targetEl.scrollIntoView) {
                setTimeout(function () { targetEl.scrollIntoView({ block: 'start' }); }, 50);
            }
            return;
        }
        var query = params.q;

        var terms = [];
        var tokens = tokenize(query);
        for (var i = 0; i < tokens.length; i++) {
            if (tokens[i].length >= 2) terms.push(tokens[i]);
        }
        if (!terms.length) {
            // Operator-only query (e.g. just "section:gallery") — scroll to
            // target so the user at least lands in the right place.
            if (targetEl && targetEl.scrollIntoView) {
                setTimeout(function () { targetEl.scrollIntoView({ block: 'start' }); }, 50);
            }
            return;
        }

        var rx = new RegExp('(' + terms.map(escapeRegex).join('|') + ')', 'i');
        var found = findFirstTextMatch(scope, rx);
        if (!found) {
            // Term doesn't appear within the targeted element (e.g. the match
            // was in keywords/aliases, not visible body text) — fall back to
            // scrolling to the target itself with no highlight.
            if (targetEl && targetEl.scrollIntoView) {
                setTimeout(function () { targetEl.scrollIntoView({ block: 'center' }); }, 50);
            }
            return;
        }

        // Expand any containing <details> elements so the match is visible.
        var anc = found.node.parentNode;
        while (anc && anc !== document.body) {
            if (anc.tagName === 'DETAILS' && !anc.hasAttribute('open')) {
                anc.open = true;
            }
            anc = anc.parentNode;
        }

        try {
            var range = document.createRange();
            range.setStart(found.node, found.start);
            range.setEnd(found.node, found.end);
            var mark = document.createElement('mark');
            mark.className = 'site-search-landing-highlight';
            range.surroundContents(mark);

            // Wait one frame for any accordion 'toggle' scroll to settle, then scroll
            // to the highlighted match (block: center keeps it comfortably visible).
            setTimeout(function () {
                mark.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }, 120);

            // Begin fade-out at 3s; fully unwrap at 4.5s so the page DOM returns
            // to its original shape (no orphan <mark> elements left behind).
            setTimeout(function () { mark.classList.add('fading'); }, 3000);
            setTimeout(function () {
                if (mark.parentNode) {
                    var parent = mark.parentNode;
                    parent.replaceChild(document.createTextNode(mark.textContent), mark);
                    if (parent.normalize) parent.normalize();
                }
            }, 4500);
        } catch (e) {
            // surroundContents fails if the range crosses element boundaries — fall back
            // to scrolling to the containing element without a highlight wrap.
            if (found.node.parentNode && found.node.parentNode.scrollIntoView) {
                found.node.parentNode.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }
        }
    }

    /* ----------------------------------------------------------------------
       NAV WIDTH LOCK
       Mirror each top-level nav link's visible text into a data-text attribute
       so the CSS ::after pseudo-element (always-bold, height:0, hidden) can
       reserve the bold-state width permanently. Result: the active link can
       change font-weight without nudging neighbors.
       ---------------------------------------------------------------------- */
    function lockNavLinkWidths() {
        var nav = document.querySelector('nav');
        if (!nav) return;
        var nodes = nav.querySelectorAll('ul > li > a, ul > li > .nav-more-btn');
        for (var i = 0; i < nodes.length; i++) {
            var el = nodes[i];
            if (!el.hasAttribute('data-text')) {
                el.setAttribute('data-text', (el.textContent || '').trim());
            }
        }
    }

    /* ----------------------------------------------------------------------
       MORE DROPDOWN (touch only) — the per-page nav opens the More menu purely
       via CSS :hover/:focus-within, which is unreliable on touchscreens (a tap
       may or may not register as focus). On touch devices we take over: tap the
       button to toggle, tap outside or press Escape to close, with aria-expanded
       kept in sync. Gated on (hover:none) so mouse/laptop users get NO new
       behaviour and NO extra listeners — their hover dropdown is unchanged.
       ---------------------------------------------------------------------- */
    function initMoreDropdown() {
        if (!window.matchMedia || !window.matchMedia('(hover: none)').matches) return;
        var nav = document.querySelector('nav');
        if (!nav) return;
        var wrap = nav.querySelector('.nav-more');
        var btn = wrap && wrap.querySelector('.nav-more-btn');
        if (!wrap || !btn) return;

        function close() {
            wrap.classList.remove('nav-more-open');
            btn.setAttribute('aria-expanded', 'false');
        }
        function open() {
            wrap.classList.add('nav-more-open');
            btn.setAttribute('aria-expanded', 'true');
        }
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (wrap.classList.contains('nav-more-open')) close();
            else open();
        });
        // Tap anywhere outside the menu closes it.
        document.addEventListener('click', function(e) {
            if (!wrap.contains(e.target)) close();
        });
        // Escape closes it (keyboard / assistive tech).
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' || e.keyCode === 27) close();
        });
        // Following a menu link closes it (harmless; the page is navigating anyway).
        var menu = wrap.querySelector('.nav-more-menu');
        if (menu) {
            menu.addEventListener('click', function(e) {
                if (e.target.closest && e.target.closest('a')) close();
            });
        }
    }

    /* ----------------------------------------------------------------------
       INIT
       ---------------------------------------------------------------------- */
    function init() {
        injectStyles();
        lockNavLinkWidths();
        initMoreDropdown();
        handleSearchLanding();
        injectBackToTop();
        var bar = injectSearchBar();
        if (!bar) return;

        var input = bar.querySelector('#site-search');
        var list = bar.querySelector('#site-search-results');
        var currentResults = [];
        var activeIndex = -1;
        // Tracks whether the user has explicitly arrow-navigated the dropdown.
        // Plain Enter → archive search; arrow + Enter → open highlighted result.
        var userNavigated = false;

        function setActive(i) {
            activeIndex = i;
            var items = list.querySelectorAll('li[role="option"]');
            for (var k = 0; k < items.length; k++) {
                if (k === i) items[k].classList.add('active');
                else items[k].classList.remove('active');
            }
            if (i >= 0 && items[i]) items[i].scrollIntoView({ block: 'nearest' });
        }

        function update() {
            var q = input.value.trim();
            if (!q) {
                list.classList.remove('open');
                list.innerHTML = '';
                currentResults = [];
                activeIndex = -1;
                userNavigated = false;
                return;
            }
            // Run unlimited once to get the true match count, then slice for display.
            var all = search(q);
            var total = all.length;
            currentResults = all.slice(0, MAX_RESULTS);
            var suggestion = total === 0 ? suggestQuery(q) : '';
            renderResults(currentResults, list, q, total, suggestion);
            list.classList.add('open');
            // Visually highlight the top result, but treat it as "not user-selected"
            // so plain Enter still routes to the archive search-results page.
            activeIndex = currentResults.length ? 0 : -1;
            setActive(activeIndex);
            userNavigated = false;
        }

        function gotoArchiveSearch(q) {
            window.location.href = SITE_ROOT + 'archive/?q=' + encodeURIComponent(q);
        }

        input.addEventListener('input', update);
        input.addEventListener('focus', function () { if (input.value.trim()) update(); });

        input.addEventListener('keydown', function (e) {
            if (!list.classList.contains('open')) {
                if (e.key === 'ArrowDown' && input.value.trim()) { update(); e.preventDefault(); }
                else if (e.key === 'Enter') {
                    var q = input.value.trim();
                    if (q) { e.preventDefault(); gotoArchiveSearch(q); }
                }
                return;
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (currentResults.length) {
                    setActive((activeIndex + 1) % currentResults.length);
                    userNavigated = true;
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (currentResults.length) {
                    setActive((activeIndex - 1 + currentResults.length) % currentResults.length);
                    userNavigated = true;
                }
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (userNavigated && activeIndex >= 0 && currentResults[activeIndex]) {
                    var q = input.value.trim();
                    window.location.href = appendSearchHash(SITE_ROOT + currentResults[activeIndex].entry.url, q);
                } else {
                    var q = input.value.trim();
                    if (q) gotoArchiveSearch(q);
                }
            } else if (e.key === 'Escape') {
                input.blur();
                list.classList.remove('open');
            }
        });

        // "Did you mean" — clicking a suggestion re-runs the search with it.
        list.addEventListener('click', function (e) {
            var sug = e.target.closest && e.target.closest('.site-search-suggest');
            if (sug) {
                e.preventDefault();
                input.value = sug.getAttribute('data-suggest') || '';
                input.focus();
                update();
            }
        });

        document.addEventListener('click', function (e) {
            if (!bar.contains(e.target)) list.classList.remove('open');
        });

        // Wiki-style "/" shortcut to jump to the search box
        document.addEventListener('keydown', function (e) {
            if (e.key !== '/') return;
            var ae = document.activeElement;
            if (!ae) return;
            var tag = ae.tagName;
            if (ae === input || tag === 'INPUT' || tag === 'TEXTAREA' || ae.isContentEditable) return;
            e.preventDefault();
            input.focus();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
