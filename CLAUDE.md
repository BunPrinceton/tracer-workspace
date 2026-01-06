# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

**Unified neuroscience tracer workspace** for Princeton connectomics research:

| Component | Purpose |
|-----------|---------|
| `index.html` | Princeton Tracer Master Guide (GitHub Pages site) |
| `tracer_tools/` | Python library for CAVE/Neuroglancer integration |
| `tampermonkey-scripts/` | WebKnossos browser userscripts |
| `scripts/` | Google Drive doc downloader, HTML text extractor |
| `Ground-Truth-*/`, `Omni/`, `Misc/` | Training documentation (docx/html) |

**Live Site**: https://bunprinceton.github.io/tracer-workspace/ (edit `index.html`, push to deploy)

## tracer_tools

### Setup

```bash
cd tracer_tools
pip install -e .
pip install caveclient cloudvolume pandas nglui numpy plotly gspread google-auth-oauthlib
```

### Architecture

All functions in `tracer_tools/src/tracer_tools/utils.py` (~1350 lines). Each function creates fresh `CAVEclient` - no connection pooling.

**Function categories:**
- Coordinates: `coords_to_root`, `root_to_coords`, `convert_coord_res`, `calc_distance`
- ID management: `sv_to_root`, `root_to_svs`, `update_root_ids`
- Neuroglancer: `build_ng_link`, `roots_to_nt_link`, `get_state_json_from_url`
- CAVE queries: `get_synapse_counts`, `get_nt`, `get_table`, `get_table_data`
- Visualization: `visualize_skeletons`, `generate_color_list`

### Datastack Compatibility (Critical)

Most functions are hardcoded for specific datastacks:
- `build_ng_link` - **FlyWire and BANC only**
- `get_nt` - FlyWire only (hardcoded columns: `gaba`, `ach`, `glut`, `oct`, `ser`, `da`)
- `coords_to_root` - BANC focused (uses `middleauth+https` URL modification)

Synapse tables must have: `pre_pt_root_id`, `post_pt_root_id`, `pre_pt_position`, `post_pt_position`, `cleft_score`

### CLI Scripts

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

### ID Updates - Critical Implementation Detail

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
| `webknossos-wk-quick-rename-v2.4.0-STABLE.user.js` | Right-click | Quick rename segments |
| `wk-quick-rename-keyboard-shortcuts-v1.2-STABLE.user.js` | Various | Rename keyboard shortcuts |

**Install**: Tampermonkey extension → Dashboard → Import `.user.js` files
**Target URLs**: `*://webknossos.org/*`, `*://wk.zetta.ai/*`, `*://localhost:9090/*`
**Debug**: All scripts log with `[WK ...]` prefix in DevTools console

## Training Documentation

Training docs in root folders (`.docx` originals) and `drive_docs_output/` (HTML exports):

| Folder | Contents |
|--------|----------|
| `Ground-Truth-Protocol-History/` | GT protocols, verification procedures |
| `Ground-Truth-Training/` | Fly Synapses, Vesicle tracing, VAST guide |
| `Omni/` | Omni usage, keyboard commands |
| `Misc/` | Semantic segmentation, Neuroglancer Synapses |
| `New Documentation Styles-Templates-Files/` | Current GT SOP |

For large HTML files:
```bash
python scripts/extract_html_text.py "path/to/file.html" 0 15000
```

## Authentication

- **CAVE**: `~/.cloudvolume/secrets/cave-secret.json`
- **Google Sheets**: `google_credentials.json` in tracer_tools root

## Testing

No pytest suite. Manual testing via Jupyter notebooks in `tracer_tools/tests/`:
```bash
python -c "from tracer_tools.utils import coords_to_root; print(coords_to_root([[100000, 50000, 3000]], 'brain_and_nerve_cord'))"
```

## Upstream

Fork of https://github.com/jaybgager/tracer_tools with added: `root_to_coords`, `update_root_ids`, `root_ids_to_coords_table`, plus CLI scripts
