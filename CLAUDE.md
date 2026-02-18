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

- **CSS is duplicated in every page** via inline `<style>` blocks. There is no shared stylesheet (except `sop/print.css` for print). Updating the design system means editing every HTML file.
- **Navigation is duplicated in every page.** `_includes/nav.html` exists as a reference template only — it cannot be auto-included. Adding a nav item requires editing every page.
- **Deployment is just `git push` to `master`.** No build step, no CI/CD, no GitHub Actions.

### Design System

All pages follow these principles (documented in `index.html` comments):
- **Colorblind-safe**: Blue/amber palette, no red/green semantic coloring
- **WCAG AA**: 4.5:1 contrast minimum
- **No animations or transitions** (intentional low-stimulation design)
- **44px minimum touch targets**
- Font stack: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` (no web fonts)
- Color palette: bg `#f5f5f5`, text `#1a1a1a`, links `#2563eb`, nav bg `#1a1a1a`

### Site Structure

```
/                    # Dashboard (index.html)
/pipeline/           # Pipeline stages
/tasks/              # Task guides (6 subdirectories)
/sop/                # SOPs with versioning (7 subdirectories)
/gallery/            # Visual reference gallery
/publications/       # Publication pages
/stats/              # Project statistics
/archive/            # Legacy tool documentation
/contribute/         # How to suggest changes
/ground-truth/       # Ground Truth Hub (not yet in nav bar)
```

### Site Editing Rules

**Read `EDITORIAL.md` before making site changes.** Key points:

- **Single-editor model**: All changes go through one maintainer for consistency
- **SOP versioning**: Never delete old versions, create new `vX.Y.html` files
- **Change classification**:
  - Wording fixes: Make directly
  - Structural changes: Consider impact
  - Navigation/architecture: Discuss with team lead first
- **Page titles**: `[Topic] - Princeton Tracer`
- **Heading hierarchy**: H1 for page title only, H2 for sections, H3 for subsections

### SOP Version Structure

```
sop/gt-task-handling/
├── index.html     # Always current version
├── v2.0.html      # Current
├── v1.0.html      # Deprecated (never delete)
```

### Task Page Template

`tasks/semantic-segmentation/index.html` is the canonical template for task pages. Required sections: Task Overview, Current SOP, Historical SOPs, Visual Examples, Common Failure Modes, Tools Used, Training Videos, Related Publications. Each task page has a `.task-id` badge (e.g., `TASK-02`).

### Suggestion System

Every page footer has JavaScript that builds a GitHub Issues URL dynamically from the page title and URL. Templates in `.github/ISSUE_TEMPLATE/` (content, SOP, gallery, correction). The `/contribute/` page explains the process.

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

Note: Gen 2 scripts contain hardcoded Windows paths for module resolution. They work when `tracer_tools` is `pip install -e`'d.

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
