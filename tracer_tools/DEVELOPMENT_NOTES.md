# Development Fork: tracer_tools

This is a development fork of [jaybgager/tracer_tools](https://github.com/jaybgager/tracer_tools) maintained by BunPrinceton for enhanced features and utilities.

## What's New in This Fork

### New Core Functions (in `src/tracer_tools/utils.py`)

#### 1. `root_to_coords(root_ids, datastack, method="skeleton")`
Convert segment IDs to xyz coordinates - the INVERSE of the existing `coords_to_root` function.

**Use case**: When you have segment IDs and need to find where they are in the brain.

```python
from tracer_tools.utils import root_to_coords

# Single ID
coords = root_to_coords(720575941471915328, "brain_and_nerve_cord")
# Returns: [[x, y, z]]

# Multiple IDs (preserves order)
coords = root_to_coords([id1, id2, id3], "brain_and_nerve_cord")
# Returns: [[x1, y1, z1], [x2, y2, z2], [x3, y3, z3]]
```

**Methods**:
- `"skeleton"` (default): Uses skeleton centroid for anatomically meaningful position
- `"supervoxel"`: Faster, uses first supervoxel location

---

#### 2. `update_root_ids(old_root_ids, datastack)`
Update potentially outdated segment IDs to their current versions.

**Use case**: Neurons get merged/split over time. Old IDs become invalid. This fixes them.

```python
from tracer_tools.utils import update_root_ids

results = update_root_ids([old_id1, old_id2], "brain_and_nerve_cord")
# Returns: [
#   {'old_id': '123', 'new_id': '456', 'changed': True},
#   {'old_id': '789', 'new_id': '789', 'changed': False}
# ]
```

---

#### 3. `root_ids_to_coords_table(root_ids, datastack, method="skeleton")`
Format coordinates as tab-separated table for easy copy-paste to spreadsheets.

```python
from tracer_tools.utils import root_ids_to_coords_table

table = root_ids_to_coords_table([id1, id2], "brain_and_nerve_cord")
print(table)
# Outputs:
# root_id    x       y       z
# 123456789  12345   67890   234
# 987654321  54321   98765   567
```

---

### Utility Scripts (in `scripts/`)

#### 1. `get_coords_cli.py` - Interactive Coordinate Lookup
Paste a list of IDs, get coordinates back.

```bash
# Interactive mode
python scripts/get_coords_cli.py --datastack brain_and_nerve_cord

# Command line
python scripts/get_coords_cli.py -d brain_and_nerve_cord -i 123 456 789

# Save to file
python scripts/get_coords_cli.py -d brain_and_nerve_cord -o output.tsv
```

---

#### 2. `update_ids_cli.py` - ID Version Update Tool
Update old segment IDs to current versions.

```bash
# Update IDs
python scripts/update_ids_cli.py --datastack brain_and_nerve_cord

# Update AND get coordinates
python scripts/update_ids_cli.py -d brain_and_nerve_cord --with-coords
```

---

#### 3. `process_file_column.py` - Batch File Processing
Process CSV/TSV files and add coordinate columns.

```bash
# Add coords to file
python scripts/process_file_column.py mydata.csv --column root_id

# Update IDs first, then get coords
python scripts/process_file_column.py mydata.csv --column root_id --update-ids

# Specify output
python scripts/process_file_column.py mydata.csv --column 0 --output results.csv
```

**Input**: `mydata.csv`
```
root_id,cell_type
123456789,neuron_A
987654321,neuron_B
```

**Output**: `mydata_with_coords.csv`
```
root_id,cell_type,coord_x,coord_y,coord_z
123456789,neuron_A,12345,67890,234
987654321,neuron_B,54321,98765,567
```

---

#### 4. `full_pipeline.py` - Complete Workflow
Update IDs → Get Coords → Output (file/clipboard/terminal)

```bash
# Full pipeline with clipboard output (macOS)
python scripts/full_pipeline.py -d brain_and_nerve_cord --clipboard

# Save to file
python scripts/full_pipeline.py -d brain_and_nerve_cord --output results.tsv

# Skip ID update step
python scripts/full_pipeline.py -d brain_and_nerve_cord --no-update
```

---

## Development Documentation

- **`claude_analysis.md`**: Comprehensive analysis of the codebase with improvement priorities
- **`chatgpt_agent_template.txt`**: Reusable template for AI-assisted code analysis
- **`deepseek_query.py`**: API wrapper for DeepSeek queries

---

## Installation

```bash
# Clone this fork
git clone https://github.com/BunPrinceton/tracer_tools.git
cd tracer_tools

# Install in editable mode
pip install -e .

# Run scripts
python scripts/get_coords_cli.py --help
```

---

## Differences from Upstream

This fork adds:
- 3 new functions to `utils.py` (inverse coord lookup, ID updates, table formatting)
- 4 utility scripts for common workflows
- Development documentation and analysis

All changes are **additive** - no existing functionality was modified.

---

## Upstream Sync

To sync with Jay's original repo:

```bash
git remote add upstream https://github.com/jaybgager/tracer_tools.git
git fetch upstream
git merge upstream/main
```

---

## Contributing Back

When features are tested and stable, they can be proposed to the upstream repo via PR.

---

## Key Improvements Identified

See `claude_analysis.md` for full details. Top priorities:

1. **Quick wins** (1-2 hours):
   - Make `build_ng_link` return URL instead of just printing
   - Fix `bbox_corners_from_center` dimension bug
   - Add empty result validation

2. **Medium effort** (4-6 hours):
   - Batch query optimization for synapse counts
   - Generalize functions to work across all datastacks (not just FlyWire/BANC)
   - Add type hints

3. **Major** (8+ hours):
   - Create datastack abstraction layer
   - Add async/await support for long queries
   - Implement connection caching

---

## License

Same as upstream: GPL-3.0-only

---

## Contact

- Upstream maintainer: Jay Gager (jgager@princeton.edu)
- Fork maintainer: BunPrinceton (GitHub)
