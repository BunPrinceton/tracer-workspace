# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

**Unified neuroscience tracer workspace** for Princeton connectomics research:

| Component | Purpose |
|-----------|---------|
| Documentation site | Static HTML site (GitHub Pages) for training and SOPs |
| `tracer_tools/` | Python library for CAVE/Neuroglancer integration |
| `tampermonkey-scripts/` | WebKnossos browser userscripts |
| `scripts/` | Google Drive doc downloader, HTML text extractor |
| `drive_docs_output/` | Downloaded Google Docs (HTML format) |
| `slack-workspace-toolkit/` | Separate repo (own `.git/`) for Slack workspace management — not a submodule |

**Live Site**: https://borkbook.com (custom domain via CNAME; also accessible at https://bunprinceton.github.io/tracer-workspace/)

## Documentation Site

### Key Architecture Constraints

**No build system.** Pure static HTML served directly by GitHub Pages. No Jekyll, no bundler, no templating engine. This has major implications:

- **CSS is duplicated in every page** via inline `<style>` blocks. Shared stylesheets are the exception: `sop/print.css` (print rules) and `sop/sidebar.css` (the SOP-section left-rail + Procedure/Details layout, linked on every `/sop/` page); `/search.js` also injects a `<style>` at runtime for shared search UI bits. Updating the design system otherwise means editing every HTML file.
- **Navigation is duplicated in every page.** `_includes/nav.html` exists as a reference template only — it cannot be auto-included. Adding a nav item requires editing every page. Top-level nav links are centered (`justify-content: center`); the top-right search bar is absolutely positioned and doesn't shift the link layout.
- **External links open in new tabs** (`target="_blank" rel="noopener noreferrer"`), including "Suggest an edit" footer links which are built dynamically via JavaScript.
- **Deployment is just `git push` to `master`.** No build step, no CI/CD, no GitHub Actions. GitHub Pages rebuild takes 30-90s.

### Design System

All pages follow these principles (documented in `index.html` comments):
- **Colorblind-safe**: Blue/amber palette, no red/green semantic coloring
- **WCAG AA**: 4.5:1 contrast minimum
- **No animations or transitions** in chrome (the search-result landing-highlight pulse is the one intentional exception, and it respects `prefers-reduced-motion`)
- **44px minimum touch targets**
- Font stack: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` (no web fonts)
- Color palette: bg `#f5f5f5`, text `#1a1a1a`, links `#2563eb`, nav bg `#1a1a1a`, highlight (mark) `#fef3c7`
- `html { font-size: 18px; line-height: 1.6 }` and `scrollbar-gutter: stable` are universal
- `main { max-width: 1200px }` is the normalized content width on every content page

### Site Structure

```
/                    # Dashboard (index.html) — hero image + mission statement
/pipeline/           # Pipeline stages
/tasks/              # Task guides (3 accordion sections; sub-paths are redirect stubs to the index anchors)
/sop/                # SOPs — left-rail layout (sidebar.js/.css): Overview landing + per-SOP
                     # Procedure/Details views; versioned subdirs. See "SOP Section" below.
/gallery/            # Single unified gallery (~245 figures, 9 stacked sections): BANC, FAFB 2019,
                     # Reference Materials, Visual Glossary, OL Cell Name Guide, Fly Synapses,
                     # FlyWire Cheatsheet, Optic Lobe Diagrams, Image Bounty. Sticky section jump-nav.
/gallery/reference-figures/   # ORPHANED standalone page (185 figs) — merged into /gallery/ (2026-05-27);
                     # left intact (preserve-originals), unlinked. Image files still served from here.
/gallery/optic-lobe-diagrams/ # ORPHANED standalone page (16 diagrams) — likewise merged + unlinked.
/publications/       # Seung Lab publication stubs (13 papers)
/archive/            # All Documents index + search-results view (dual-role; see below)
/archive/<item>/     # Per-item historical pages: vast, omni, eyewire, desktop-annotation,
                     # manual-id-tracking, glossary, tool-evolution
/contribute/         # How to suggest changes
/ground-truth/       # Ground Truth Hub
/experimental/       # Experimental tools (Gen 2 scripts)
/drive_docs_output/  # Curated archived Google Docs (FlyWire-Training, Triage-Additions, etc.)
/search.js           # Site-wide search system — INDEX is the canonical page registry
```

### Search System (`/search.js`)

`/search.js` is loaded by every HTML page as `<script src=".../search.js" defer></script>` with depth-correct relative path. It is the heart of the site:

- **`INDEX` array** at the top of search.js is the **canonical registry of every page and every searchable artifact** (currently ~116 entries: pages + 44 BANC gallery images + per-collection reference-gallery entries + archived docs + per-item archive pages). The 185 merged reference figures are indexed at the **collection level** (one entry each → `gallery/#<section-anchor>`), not per-figure, to avoid flooding the dropdown. **Adding a page = adding an INDEX entry**, in the same commit. No other data source.
- **Entry schema**: `{title, url, section, description, aliases, keywords}`. Field weights for scoring: title=10, aliases=8, keywords=6, section=4, description=2 (exact word; fuzzy/transposition variants score 60-80% of these).
- **Matcher**: hand-rolled (no Fuse.js dep). Substring → prefix → 1-edit-distance → 1-transposition. Plus Google-style operators: `+word` required, `-word` excluded, `"exact phrase"`, `section:name` field filter.
- **Public API**: `window.SiteSearch = {INDEX, search, scoreEntry, highlight, parseQuery, SITE_ROOT}` — `/archive/` uses these to render its All Documents listing and search-results view from the same source.
- **Top-nav search bar** auto-injects into every page's `<nav>` (creates a `<ul>` if missing — robust to leaf docs with minimal nav). Dropdown shows up to 8 ranked results; Enter goes to `/archive/?q=...`; arrow + Enter opens highlighted result directly.
- **Landing handler**: every result link carries `#q=<term>` (combined with `#anchor` as `#anchor&q=term` when applicable). On landing, the handler opens any containing `<details>`, scrolls to the match, and pulse-highlights for ~3s before fading. When an anchor target is present, the highlight search is **scoped to that element** so gallery-image results jump to the right figure.
- **Redirect stubs preserve the hash** on their way through the meta refresh (tiny inline script before the `<meta http-equiv="refresh">`). Affects `tasks/<name>/`, `sop/.../v2.0.html`, etc.

### Archive Page (`/archive/`)

Dual-role since 2026-05-26:
1. **All Documents listing** (default view) — alphabetical, Fandom-style 3-column index of every page in the site, rendered live from `SiteSearch.INDEX`. Local filter input narrows in place.
2. **Search-results view** — when `?q=...` is in the URL, the page hides the alphabetical listing and renders scored results with rich per-item layout (title, section, description, URL). Banner contains an **editable refine-search input** pre-filled with the current query; submit = `?q=<new>`. Tip line below documents the operator syntax. Mode toggle is the CSS class `main.has-search-query`.

Historical content (deprecated tools, glossary, evolution timeline, legacy workflows) lives as standalone per-item sub-pages under `/archive/<item>/`. Discovery is via search and the All Documents listing — no hub pages.

### Site Editing Rules

**Read `EDITORIAL.md` before making site changes.** Key points:

- **Single-editor model**: All changes go through one maintainer for consistency. When coordinating with another Claude in parallel, drop a hand-off note in `work-files/` with pre-formatted data drops (JS-ready syntax for INDEX entries, etc.) — don't both edit `search.js` / `archive/index.html` / `gallery/index.html` simultaneously.
- **SOP versioning**: Never delete old versions, create new `vX.Y.html` files
- **Change classification**:
  - Wording fixes: Make directly
  - Structural changes: Consider impact
  - Navigation/architecture: Discuss with team lead first
- **Page titles**: `[Topic] - Princeton Tracers` (plural)
- **Heading hierarchy**: H1 for page title only, H2 for sections, H3 for subsections
- **When adding pages**: also add the INDEX entry in `search.js` in the same commit so the search system stays consistent with the file tree.

### SOP Section (`/sop/`)

Redesigned 2026-05-28 into a Google-docs-style layout — the first on the site, **scoped to `/sop/` as a test** (candidate to extend site-wide). Two shared assets, both loaded on every SOP page:
- **`sop/sidebar.css`** — linked in `<head>` (like `print.css`). Owns the left-rail + two-column layout + de-carded header (`.sop-page-header`) + view-card (`.sop-card`) + table/callout styling. Class-based selectors so they override the global dark `nav`.
- **`sop/sidebar.js`** — injected like `search.js`. **Single source of truth for the SOP list** (the `GROUPS` array). Renders the rail into `<aside id="sop-sidebar">`, depth-resolves links (works on `file://` + Pages), marks the active item, and — on a page that declares in-page views — builds a nested **Procedure / Details** sub-menu and toggles which view shows (hash-driven: `#procedure` / `#details`). Caret affordance ▸/▾.

Rail groups (chronological): **Current** (GT Task Handling SOP-001, Voxel Painting SOP-006 — both WebKnossos; Voxel Painting is the current GT method) · **Recent** (GT Protocol Guidelines SOP-005) · **Older** (GT Verification SOP-002, GT Checklist SOP-003, File Naming SOP-004 — VAST/Omni-era, still valid, not archived).

- **Landing (`sop/index.html`)** is an **Overview** (scope + a described, linked SOP list), not the old metadata table.
- **Each SOP page** de-cards its header (title like other pages, not boxed) and splits its body into two views: `<div class="sop-view sop-card active" data-view="procedure" data-view-label="Procedure">` (clean default) and `<div class="sop-view sop-card" data-view="details" data-view-label="Details">` (purpose, scope, version history, change log, related). The `active` class is the no-JS default.
- **To add an SOP**: add an entry to `GROUPS` in `sidebar.js`; wrap `<main>` in `<div class="sop-shell"><aside id="sop-sidebar">…</aside><main>…</main></div>`; give it the two `.sop-view` divs; link `sidebar.css` + `sidebar.js`; and add the INDEX entry in `search.js` (same commit).
- **NOT redesigned** (keep their own inline CSS): `sop/omni-export/`, `sop/vast-annotation/` (deprecated, archive-linked) and the `vX.Y.html` version stubs.

**Versioning (unchanged):** never delete old versions; create new `vX.Y.html`.
```
sop/gt-task-handling/
├── index.html     # Always current version (two-view layout)
├── v2.0.html      # Redirect stub to index.html (preserves search-result hash on its way through)
├── v1.0.html      # Deprecated (full content; never delete — keeps its own inline CSS)
```

### Task Page Pattern

`/tasks/index.html` is the canonical task page — three `<details>` accordion sections (Proofreading, Semantic Segmentation, Skeletonization) covering all task content inline. The subdirectory pages (`tasks/proofreading/`, `tasks/semantic-segmentation/`, `tasks/skeletonization/`, plus older `tasks/defect-annotation/`, `tasks/quality-assurance/`, `tasks/split-merge/`) are **redirect stubs** that bounce to `../#section-id`, preserving any incoming `#q=` hash for search-result deep links.

### Suggestion System

Every page footer has JavaScript that builds a GitHub Issues URL dynamically from the page title and URL, with `target="_blank"` set both in HTML and JS. Templates in `.github/ISSUE_TEMPLATE/` (content, SOP, gallery, correction). The `/contribute/` page explains the process.

## tracer_tools

### Setup

```bash
cd tracer_tools
pip install -e .
pip install caveclient cloudvolume pandas nglui numpy plotly gspread google-auth-oauthlib
```

### Architecture

All functions live in `tracer_tools/src/tracer_tools/utils.py` (~1350 lines). `__init__.py` is just `from tracer_tools.utils import *` (no `__all__`). Each function creates a fresh `CAVEclient` instance — no connection pooling.

**Function categories:**
- Coordinates: `coords_to_root`, `root_to_coords`, `convert_coord_res`, `calc_distance`
- ID management: `sv_to_root`, `root_to_svs`, `update_root_ids`
- Neuroglancer: `build_ng_link`, `roots_to_nt_link`, `get_state_json_from_url`
- CAVE queries: `get_synapse_counts`, `get_nt`, `get_table`, `get_table_data`
- Visualization: `visualize_skeletons`, `generate_color_list`

Fork of https://github.com/jaybgager/tracer_tools with added: `root_to_coords`, `update_root_ids`, `root_ids_to_coords_table`, plus CLI scripts.

### Datastack Compatibility (Critical)

Most functions are hardcoded for specific datastacks:
- `build_ng_link` — **FlyWire and BANC only**
- `get_nt` — FlyWire only (hardcoded columns: `gaba`, `ach`, `glut`, `oct`, `ser`, `da`)
- `coords_to_root` — BANC focused (uses `middleauth+https` URL modification)

Synapse tables must have: `pre_pt_root_id`, `post_pt_root_id`, `pre_pt_position`, `post_pt_position`, `cleft_score`

### Known Bugs

- **`build_ng_link` (line ~334)**: Prints URL but does **not return it**. Callers cannot capture the URL without modifying the function.
- **`bbox_corners_from_center` (lines ~28-29)**: Loop `for dim in dims: dim += 1` modifies the loop variable, not the list. Fix: `dims = [d+1 if d%2!=0 else d for d in dims]`
- **Duplicate imports**: `CAVEclient` and `nglui.statebuilder.*` are imported twice (lines ~1-4 and ~41-44) due to copy-paste.

### CLI Scripts — Two Generations

**Generation 1 (sequential):**
```bash
# Get coordinates for root IDs
python tracer_tools/scripts/get_coords_cli.py --datastack brain_and_nerve_cord --ids 720575941471915328

# Update outdated IDs (accurate supervoxel method)
python tracer_tools/scripts/update_ids_cli.py --datastack brain_and_nerve_cord --with-coords

# Batch validate IDs from file (see ID_VALIDATION_WORKFLOW_GUIDE.md)
python tracer_tools/scripts/validate_ids_batch.py --input ids.txt --output results.txt

# Google Sheets integration
python tracer_tools/scripts/sheets_coords_oauth.py --sheet "SHEET_ID" --offset 0 --limit 1000 --update-ids
```

**Generation 2 (parallel, faster — uses ThreadPoolExecutor with 20 workers, bypasses utils.py):**
```bash
python tracer_tools/scripts/fast_get_coords.py      # Parallel L2 lookups
python tracer_tools/scripts/fast_validate_ids.py     # Parallel supervoxel lookups, 5000+ IDs in <2 min
```

Gen 2 scripts use relative path resolution (`Path(__file__).resolve().parent.parent / "src"`) and also work when `tracer_tools` is `pip install -e`'d.

### ID Updates — Critical Implementation Detail

**WRONG (fast but fails on splits):**
```python
new_ids = client.chunkedgraph.get_latest_roots(old_ids)  # Follows root ID, not supervoxels
```

**CORRECT (current implementation):**
```python
sv_ids = client.chunkedgraph.get_leaves(old_id)
new_id = client.chunkedgraph.get_roots([sv_ids[0]])  # Follows supervoxels through splits
```

When a neuron splits, `get_latest_roots()` may return the wrong branch. The supervoxel method ensures you follow the correct lineage.

### Batching Requirements

L2 coordinate fetches must be chunked to avoid 504 timeouts:
```python
chunk_size = 100
for i in range(0, len(all_l2_ids), chunk_size):
    chunk = all_l2_ids[i:i + chunk_size]
    chunk_data = client.l2cache.get_l2data(chunk, attributes=["rep_coord_nm"])
```

### L2 vs Skeleton Coordinate Methods

- `method="supervoxel"` (L2 cache): Fast, uses representative coordinate
- `method="skeleton"`: Slow, uses anatomical centroid (more accurate)

## Large-Scale ID Validation

For validating thousands of IDs, see `ID_VALIDATION_WORKFLOW_GUIDE.md`. Key points:
- Batches of 1000 IDs, ~4-5 min per batch
- Uses supervoxel tracking for split-accuracy
- Output format: `OLD_ID -> NEW_ID` or `[OK - Current]`

## tampermonkey-scripts

WebKnossos userscripts for annotation workflows.

| Script | Shortcut | Function |
|--------|----------|----------|
| `webknossos-volume-opacity-toggle.user.js` | `Ctrl+Shift+O` | Toggle Volume layer opacity |
| `webknossos-pattern-opacity-toggle.user.js` | `Ctrl+Shift+P` | Toggle Pattern Opacity |
| `webknossos-2d-em-opacity-toggle.user.js` | `Ctrl+Shift+E` | Toggle EM layer opacity |
| `webknossos-wk-quick-rename-v2.4.0-STABLE.user.js` | Right-click | Quick rename segments (21 classes) |
| `wk-quick-rename-keyboard-shortcuts-v1.2-STABLE.user.js` | 1-9, Q, W, E | Rename keyboard shortcuts |

**Target URLs**: `*://webknossos.org/*`, `*://wk.zetta.ai/*`, `*://localhost:9090/*`
**Debug**: All scripts log with `[WK ...]` prefix in DevTools console.
**Fragility warning**: Opacity toggle scripts navigate Ant Design DOM structure (`.ant-spin-nested-loading`, `input.ant-input-number-input`). WebKnossos upgrades that change Ant Design versions or component structure will break them. They use React-compatible input mutation via `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set`.

## Training Documentation

Training docs in root folders (`.docx` originals) and `drive_docs_output/` (HTML exports). For large HTML files:
```bash
python scripts/extract_html_text.py "path/to/file.html" 0 15000
```

## Authentication

- **CAVE**: `~/.cloudvolume/secrets/cave-secret.json`
- **Google Sheets**: `google_credentials.json` in tracer_tools root (OAuth, not service account)

## Testing

No pytest suite. Manual testing via Jupyter notebooks in `tracer_tools/tests/`:
```bash
python -c "from tracer_tools.utils import coords_to_root; print(coords_to_root([[100000, 50000, 3000]], 'brain_and_nerve_cord'))"
```
