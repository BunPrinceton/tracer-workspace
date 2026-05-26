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
    title: "Reference Figures Gallery",
    url: "gallery/reference-figures/",
    section: "Gallery \u00b7 Reference Figures",
    description: "185 figures extracted from archived training/reference docs (EM examples, cell-type diagrams).",
    aliases: ["reference figures", "extracted figures"],
    keywords: ["figures", "gallery", "EM", "diagrams", "visual glossary", "optic lobe"]
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
    section: "Archive \u00b7 Proofreading",
    description: "Slide guide for the proofreading tagging protocol update.",
    aliases: ["tagging guide", "tagging protocol"],
    keywords: ["tags", "protocol update", "banc-bot"]
  },
  {
    title: "How Ben Proofreads",
    url: "drive_docs_output/Triage-Additions/Proofreading/How%20Ben%20Proofreads.html",
    section: "Archive \u00b7 Proofreading",
    description: "Ben's personal proofreading walkthrough (slides).",
    aliases: ["how ben proofreads"],
    keywords: ["proofreading", "walkthrough", "workflow"]
  },
  {
    title: "AN-DN Task Guide",
    url: "drive_docs_output/Triage-Additions/Proofreading/AN-DN%20Task%20Guide.html",
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
    section: "Archive \u00b7 Historical",
    description: "2019 annotation standards deck (szichieh).",
    aliases: ["annotation standard"],
    keywords: ["annotation", "standard", "guidelines"]
  },
  {
    title: "Minnie groundtruth difficult-interesting parts",
    url: "drive_docs_output/Triage-Additions/Oldies-archive/Minnie%20groundtruth%20difficult-interesting%20parts.html",
    section: "Archive \u00b7 Historical",
    description: "2019 deck of difficult/interesting ground-truth cases in Minnie.",
    aliases: ["minnie groundtruth difficult"],
    keywords: ["ground truth", "Minnie", "edge cases"]
  },
  {
    title: "FlyWire Cheatsheet",
    url: "drive_docs_output/Triage-Additions/Training-onboarding/FlyWire%20Cheatsheet.html",
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

        var total = 0;
        var matched = 0;
        for (var i = 0; i < terms.length; i++) {
            var term = terms[i];
            var s = Math.max(
                scoreTermAgainstWords(term, titleWords, 10),
                scoreTermAgainstWords(term, aliasWords, 8),
                scoreTermAgainstWords(term, keywordWords, 6),
                scoreTermAgainstWords(term, sectionWords, 4),
                scoreTermAgainstWords(term, descWords, 2)
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

    function search(query, limit) {
        var results = [];
        for (var i = 0; i < INDEX.length; i++) {
            var s = scoreEntry(query, INDEX[i]);
            if (s > 0) results.push({ score: s, entry: INDEX[i] });
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
       PUBLIC API
       Exposed so other pages (notably the Archive / All Documents page) can
       render from the same source of truth instead of duplicating data.
       ---------------------------------------------------------------------- */
    window.SiteSearch = {
        INDEX: INDEX,
        search: search,
        scoreEntry: scoreEntry,
        highlight: highlight,
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
            '.site-search-empty{padding:0.875rem;font-size:0.875rem;color:#737373;text-align:center;}' +
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
            '@media print{.nav-search{display:none;}}';
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

    function escapeHTML(s) {
        return (s || '').replace(/[&<>"']/g, function (c) {
            return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
        });
    }

    function renderResults(results, listEl, query) {
        listEl.innerHTML = '';
        var queryStr = (query || '').trim();
        if (!results.length) {
            var empty = document.createElement('li');
            empty.className = 'site-search-empty';
            empty.textContent = 'No matches. Press Enter to view full results.';
            listEl.appendChild(empty);
        } else {
            for (var i = 0; i < results.length; i++) {
                var r = results[i];
                var li = document.createElement('li');
                li.setAttribute('role', 'option');
                li.dataset.index = String(i);
                var a = document.createElement('a');
                a.href = appendSearchHash(SITE_ROOT + r.entry.url, queryStr);
                a.innerHTML =
                    '<span class="result-title">' + highlight(r.entry.title, queryStr) + '</span>' +
                    '<span class="result-section">' + escapeHTML(r.entry.section) + '</span>' +
                    '<div class="result-desc">' + highlight(r.entry.description, queryStr) + '</div>';
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
        // <details>) up front. Lets us land on the right accordion section
        // before the highlight pass runs.
        if (params.target) {
            var targetEl = document.getElementById(params.target);
            if (targetEl) {
                var anc = targetEl;
                while (anc && anc !== document.body) {
                    if (anc.tagName === 'DETAILS' && !anc.hasAttribute('open')) anc.open = true;
                    anc = anc.parentNode;
                }
                if (!params.q && targetEl.scrollIntoView) {
                    setTimeout(function () { targetEl.scrollIntoView({ block: 'start' }); }, 50);
                }
            }
        }

        if (!params.q) return;
        var query = params.q;

        var terms = [];
        var tokens = tokenize(query);
        for (var i = 0; i < tokens.length; i++) {
            if (tokens[i].length >= 2) terms.push(tokens[i]);
        }
        if (!terms.length) return;

        var rx = new RegExp('(' + terms.map(escapeRegex).join('|') + ')', 'i');
        var found = findFirstTextMatch(document.body, rx);
        if (!found) return;

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
       INIT
       ---------------------------------------------------------------------- */
    function init() {
        injectStyles();
        lockNavLinkWidths();
        handleSearchLanding();
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
            currentResults = search(q, MAX_RESULTS);
            renderResults(currentResults, list, q);
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
