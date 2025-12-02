# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a **unified neuroscience tracer workspace** containing:
- **tracer_tools/** - Python library for connectomics data (CAVE/Neuroglancer integration)
- **tampermonkey-scripts/** - WebKnossos browser userscripts
- **Training docs** - Protocol documentation in Office formats (Eyewire, Omni, Ground Truth)

## tracer_tools

### Installation & Setup

```bash
cd tracer_tools
pip install -e .

# Dependencies (not in pyproject.toml yet):
pip install caveclient cloudvolume pandas nglui osteoid numpy microviewer plotly
```

### Core Architecture

All functions live in `tracer_tools/src/tracer_tools/utils.py` (~1350 lines). Every function creates a fresh `CAVEclient` instance - no connection pooling.

**Function categories:**
- Coordinate operations: `coords_to_root`, `root_to_coords`, `convert_coord_res`, `calc_distance`
- ID management: `sv_to_root`, `root_to_svs`, `update_root_ids`
- Neuroglancer links: `build_ng_link`, `roots_to_nt_link`, `get_state_json_from_url`
- CAVE queries: `get_synapse_counts`, `get_nt`, `get_table`, `get_table_data`
- Visualization: `visualize_skeletons`, `generate_color_list`

### Critical: Datastack-Specific Code

Many functions have hardcoded assumptions for specific datastacks:
- `build_ng_link` - **Only works with `flywire_fafb_production` and `brain_and_nerve_cord` (BANC)**
- `get_nt` - FlyWire only (hardcoded NT columns: `gaba`, `ach`, `glut`, `oct`, `ser`, `da`)
- `coords_to_root` - BANC focused (uses `middleauth+https` URL modification)

Synapse queries assume columns: `pre_pt_root_id`, `post_pt_root_id`, `pre_pt_position`, `post_pt_position`, `cleft_score`

### CLI Scripts

```bash
# Get coordinates for root IDs
python tracer_tools/scripts/get_coords_cli.py --datastack brain_and_nerve_cord --ids 720575941471915328

# Update outdated IDs to current versions
python tracer_tools/scripts/update_ids_cli.py --datastack brain_and_nerve_cord --with-coords

# Process CSV file column
python tracer_tools/scripts/process_file_column.py data.csv --column root_id --update-ids

# Google Sheets integration (requires google_credentials.json)
python tracer_tools/scripts/sheets_coords_oauth.py --sheet "SHEET_ID" --offset 0 --limit 1000 --update-ids
```

### ID Update Methods - Critical Distinction

**Fast but WRONG for splits:**
```python
new_ids = client.chunkedgraph.get_latest_roots(old_ids)  # Tracks root ID, not supervoxels
```

**Accurate (current implementation):**
```python
sv_ids = client.chunkedgraph.get_leaves(old_id)
new_id = client.chunkedgraph.get_roots([sv_ids[0]])  # Follows supervoxels through splits
```

### Batching Pattern

L2 coordinate fetches must be chunked to avoid 504 timeouts:
```python
chunk_size = 100
for i in range(0, len(all_l2_ids), chunk_size):
    chunk = all_l2_ids[i:i + chunk_size]
    chunk_data = client.l2cache.get_l2data(chunk, attributes=["rep_coord_nm"])
```

## tampermonkey-scripts

WebKnossos Tampermonkey userscripts for annotation workflow enhancement.

### Stable Scripts (from DO_NOT_TOUCH)

| Script | Shortcut | Function |
|--------|----------|----------|
| `webknossos-volume-opacity-toggle.user.js` | `Ctrl+Shift+O` | Toggle Volume layer opacity (1 <-> saved value) |
| `webknossos-pattern-opacity-toggle.user.js` | `Ctrl+Shift+P` | Toggle Pattern Opacity |
| `webknossos-2d-em-opacity-toggle.user.js` | `Ctrl+Shift+E` | Toggle EM layer opacity |
| `webknossos-wk-quick-rename-v2.4.0-STABLE.user.js` | Right-click | Quick rename segments from context menu |
| `wk-quick-rename-keyboard-shortcuts-v1.2-STABLE.user.js` | Various | Keyboard shortcuts for renaming |

### Installation

1. Install Tampermonkey browser extension
2. Dashboard -> "+" tab or Import from file
3. Import `.user.js` files
4. Reload WebKnossos

### Target URLs

Scripts match: `*://webknossos.org/*`, `*://wk.zetta.ai/*`, `*://localhost:9090/*`

### Debugging

All scripts log to console with `[WK ...]` prefix. Open DevTools (F12) to see detection and action logs.

## Training Documentation

Office documents (`.docx`, `.pptx`, `.xlsx`) - Claude cannot read these directly.

| Folder | Content |
|--------|---------|
| `Eyewire/` | Eyewire neuron tracing guides |
| `Ground-Truth-Protocol-History/` | GT annotation protocols and SOPs |
| `Ground-Truth-Training/` | Synapse identification (vesicles, t-bars, PSDs) + training videos |
| `Omni/` | Omni segmentation tool guides |
| `Misc/` | Neuroglancer, VirtualBox, semantic segmentation |

## Authentication

- **CAVE**: `~/.cloudvolume/secrets/cave-secret.json`
- **Google Sheets**: `google_credentials.json` in tracer_tools root (service account)

## Upstream

tracer_tools is a fork of https://github.com/jaybgager/tracer_tools with added functions: `root_to_coords`, `update_root_ids`, `root_ids_to_coords_table`, plus CLI scripts.
