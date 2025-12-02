# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**tracer_tools** is a Python library providing utilities for neuroscientists working with connectomics data. It simplifies interactions with CAVE (Connectome Annotation Versioning Engine) and Neuroglancer for querying, visualizing, and analyzing brain imaging data (primarily FlyWire and BANC datasets).

**Primary use case**: Allow neuroscientists without deep technical expertise to access backend connectomics data programmatically.

## Core Architecture

### Main Module: `src/tracer_tools/utils.py`

This single ~1300 line module contains all core functions. Functions fall into these categories:

1. **Coordinate Operations** (`coords_to_root`, `root_to_coords`, `convert_coord_res`, `calc_distance`, `bbox_corners_from_center`)
2. **ID Management** (`sv_to_root`, `root_to_svs`, `update_root_ids`)
3. **Neuroglancer Link Generation** (`build_ng_link`, `roots_to_nt_link`, `get_state_json_from_url`)
4. **CAVE Data Queries** (`get_synapse_counts`, `get_nt`, `get_table`, `get_table_data`)
5. **Datastack Metadata** (`get_all_stacks`, `get_stack_data`, `get_stack_tables`)
6. **Visualization** (`visualize_skeletons`, `generate_color_list`)
7. **Analysis** (`root_to_vol`)

### Key Design Patterns

**CAVEclient initialization**: Nearly every function creates a fresh `CAVEclient` instance. No connection pooling/caching exists.

```python
client = CAVEclient(datastack_name=datastack)
```

**Resolution handling**: Functions work with "viewer resolution" by default (from datastack metadata). Coordinates are returned/accepted in viewer resolution unless otherwise specified.

```python
viewer_res = [
    stack_info["viewer_resolution_x"],
    stack_info["viewer_resolution_y"],
    stack_info["viewer_resolution_z"],
]
```

**Batching strategy**: Recent additions use batched API calls to avoid N+1 query problems:
- `root_to_coords` (lines 1119-1207): Batches L2 cache lookups
- `update_root_ids` (lines 1210-1267): Processes IDs one-by-one due to API limitations

## Critical Implementation Details

### Datastack-Specific Hardcoding

**WARNING**: Many functions contain hardcoded assumptions for specific datastacks:

**FlyWire-only functions**:
- `get_nt`: Hardcoded neurotransmitter columns (`gaba`, `ach`, `glut`, etc.)
- `roots_to_nt_link`: Hardcoded NT→color mapping

**BANC-focused but theoretically general**:
- `coords_to_root`: Comment says "CURRENTLY ONLY SUPPORTS BANC FOR SURE"
- Uses `middleauth+https` URL modification (lines 188-189, 401-402)

**FlyWire/BANC dual support**:
- `build_ng_link`: Prototype marked as only working with these two datastacks
- Conditionally applies different synapse colors (lines 218-223)

### Column Name Assumptions

Synapse table queries assume columns named:
- `pre_pt_root_id` / `post_pt_root_id` (root IDs)
- `pre_pt_position` / `post_pt_position` (coordinates)
- `cleft_score` (FlyWire only, for filtering)

If a datastack uses different column names, queries will fail.

### Performance Considerations

**Batching is critical**: When processing many IDs, use functions that support batching:
- ✅ `root_to_coords` with `method="supervoxel"`: Batched L2 cache lookup
- ❌ `root_to_coords` with `method="skeleton"`: One-by-one skeleton fetch
- ⚠️ `update_root_ids`: Currently unbatched (API limitation)

**L2 cache vs Skeleton methods**:
- L2 cache (`method="supervoxel"`): Fast, uses representative coordinate from supervoxel
- Skeleton (`method="skeleton"`): Slow, uses anatomical centroid (more accurate)

### Batch Optimization Pattern

When querying updated root IDs from CAVE:

```python
# BAD: N queries
for root_id in root_ids:
    result = client.chunkedgraph.get_root_id(root_id)

# GOOD: Use chunkedgraph batching (if available)
# Check CAVEclient docs for batch methods like:
# - chunkedgraph.get_roots()
# - l2cache.get_l2data() with list of IDs
```

Current implementation in `root_to_coords` (lines 1153-1163):
1. Get L2 IDs for all roots (batched internally by chunkedgraph)
2. Fetch all L2 coordinates in single `get_l2data()` call
3. Map results back to original order

**To further optimize batching**: Look for CAVEclient methods accepting `List[int]` instead of single IDs.

## Utility Scripts (`scripts/`)

**Interactive CLI tools**:
- `get_coords_cli.py`: Paste IDs → get coordinates
- `update_ids_cli.py`: Update outdated IDs to current versions
- `full_pipeline.py`: Update IDs → coords → clipboard/file
- `process_file_column.py`: Batch process CSV/TSV files

**Google Sheets integration**:
- `sheets_coords_oauth.py`: OAuth-based Sheets coordinate updater
- `sheets_get_coords_safe.py`: Read from Sheets, update with coords
- `test_sheets_connection.py`: Verify Sheets API access

**API testing**:
- `save_cave_token.py`: Store CAVE auth tokens
- `deepseek_query.py`: DeepSeek API wrapper (development tool)

## Common Development Tasks

### Running Scripts

```bash
# Get coordinates for IDs
python scripts/get_coords_cli.py --datastack brain_and_nerve_cord --ids 720575941471915328

# Update outdated IDs
python scripts/update_ids_cli.py --datastack brain_and_nerve_cord --with-coords

# Process a CSV file
python scripts/process_file_column.py data.csv --column root_id --update-ids
```

### Testing Locally

```bash
# Import and test functions
python3
>>> from tracer_tools.utils import coords_to_root
>>> coords_to_root([[100000, 50000, 3000]], "brain_and_nerve_cord")
```

### Google Sheets Setup

See `GOOGLE_SHEETS_SETUP.md` for detailed instructions. Quick version:

1. Create service account at Google Cloud Console
2. Download JSON credentials → save as `google_credentials.json`
3. Share target Sheet with service account email
4. Run `python scripts/test_sheets_connection.py`

### Google Sheets Parallel Processing

For processing large datasets (5000+ rows) efficiently:

```bash
# Run 5 parallel batches simultaneously (each processes 1000 rows)
python3 scripts/sheets_coords_oauth.py --sheet "SHEET_ID" --offset 0 --limit 1000 --update-ids &
python3 scripts/sheets_coords_oauth.py --sheet "SHEET_ID" --offset 1000 --limit 1000 --update-ids &
python3 scripts/sheets_coords_oauth.py --sheet "SHEET_ID" --offset 2000 --limit 1000 --update-ids &
python3 scripts/sheets_coords_oauth.py --sheet "SHEET_ID" --offset 3000 --limit 1000 --update-ids &
python3 scripts/sheets_coords_oauth.py --sheet "SHEET_ID" --offset 4000 --limit 1000 --update-ids &

# Wait for all to complete, then merge
python3 scripts/sheets_merge.py --sheets SHEET_ID1 SHEET_ID2 SHEET_ID3 SHEET_ID4 SHEET_ID5
```

**Performance:** 5000 rows in ~5 minutes (vs ~21 minutes sequential)

## Critical Implementation Details: ID Updates

### The ID Update Accuracy Problem

**CRITICAL:** There are two methods for updating outdated root IDs, with different accuracy/speed tradeoffs:

#### Method 1: `get_latest_roots()` - Fast but Incorrect for Splits
```python
# FAST (instant) but gives WRONG IDs when neurons are split
new_root_ids = client.chunkedgraph.get_latest_roots(old_root_ids)
```
- ⚡ Very fast: batched, near-instant
- ❌ **Returns where the root ID itself went, not where the supervoxels went**
- ❌ **Gives wrong results when neurons are split**

**Example of wrong behavior:**
- Old ID: `720575941603442934`
- `get_latest_roots()` returns: `720575941612275302` ❌ (wrong branch)
- Correct ID should be: `720575941591053566` ✓ (where supervoxels actually went)

#### Method 2: Supervoxel Method - Accurate (CURRENT IMPLEMENTATION)
```python
# Get supervoxels from old root
sv_ids = client.chunkedgraph.get_leaves(old_root_id)
# Find where those supervoxels are now (batched)
new_root_ids = client.chunkedgraph.get_roots([sv_ids[0] for each old_id])
```
- ✓ **Correct: follows supervoxels through splits/merges**
- ✓ Batched: collect all supervoxels, then one `get_roots()` call
- ⏱️ Slower: ~4-5 minutes per 1000 IDs (vs instant)

**Why this matters:** When a neuron is split in the segmentation, the old root ID might track to a different branch than where the actual supervoxels went. The supervoxel method ensures you follow the correct lineage.

### Implementation in `update_root_ids()` (lines 1249-1334)

Current implementation uses the accurate supervoxel method with batching:

1. Get one supervoxel from each old root ID (one-by-one, fast)
2. Batch call `get_roots()` for all supervoxels (one API call)
3. Map results back to original IDs

**Key code pattern:**
```python
# Step 1: Get supervoxels (can't be batched, but fast)
for old_id in old_root_ids:
    sv_ids = client.chunkedgraph.get_leaves(old_id)
    id_to_sv[old_id] = sv_ids[0]

# Step 2: Batch get current roots (ONE API call for all)
new_roots = client.chunkedgraph.get_roots(list(id_to_sv.values()))
```

### L2 Coordinate Fetching (lines 1165-1180)

Must be chunked to avoid 504 Gateway Timeouts:

```python
# Chunk into batches of 100 to avoid server timeout
chunk_size = 100
for i in range(0, len(all_l2_ids), chunk_size):
    chunk = all_l2_ids[i:i + chunk_size]
    chunk_data = client.l2cache.get_l2data(chunk, attributes=["rep_coord_nm"])
    l2_data.update(chunk_data)
```

**Without chunking:** 999 IDs = 504 timeout ❌
**With chunking:** 999 IDs = 10 chunks of 100, all succeed ✓

## Important Constraints

### API Rate Limits

CAVEclient queries can hit rate limits with large batches. Current strategy:
- Progress logging every 100 items (see `root_to_coords` line 1160)
- No retry logic or exponential backoff implemented
- Consider adding delays for very large batches (1000+ IDs)

### Memory Limitations

**`get_table()` loads entire tables**: Some CAVE tables have millions of rows. For large tables:
- Use `client.materialize.query_table()` with filters instead
- Consider pagination if available in CAVEclient API

### Authentication

Scripts assume CAVE authentication is already configured. Users should have:
- `~/.cloudvolume/secrets/cave-secret.json` (for CAVEclient)
- `google_credentials.json` in project root (for Sheets scripts)

## Known Issues & Workarounds

### Issue: `build_ng_link` prints URL but doesn't return it
**Location**: Line 334
**Workaround**: Capture stdout or modify function to return URL

### Issue: `bbox_corners_from_center` doesn't modify dimensions
**Location**: Lines 28-29
**Problem**: Loop modifies local `dim`, not list elements
**Fix**: Use list comprehension: `dims = [d+1 if d%2!=0 else d for d in dims]`

### Issue: No validation for empty query results
**Impact**: Functions crash on empty DataFrames (e.g., invalid root IDs)
**Workaround**: Wrap calls in try-except or validate IDs first

### Issue: Hardcoded datastack assumptions prevent generalization
**Impact**: Many functions explicitly reject non-FlyWire/BANC datastacks
**Workaround**: Check function docstrings for compatibility before using

## Code Style Observations

- Uses list comprehensions extensively
- Prefers explicit loops over vectorization
- Minimal error handling (most functions assume valid inputs)
- Print statements for user feedback (not logging framework)
- Type hints recently added but not comprehensive
- Comments use `#` inline, not docstring format for implementation notes

## Extension Points

When adding new functions:

1. **Follow existing patterns**: Start with `client = CAVEclient(datastack_name=datastack)`
2. **Return data, don't print it**: Recent functions return results; older ones print URLs
3. **Support both single and list inputs**: Use pattern from `coords_to_root` (lines 390-391)
4. **Use batching for multiple IDs**: See `root_to_coords` implementation
5. **Document datastack compatibility**: Clearly state which datastacks are tested

## Performance Optimization Checklist

When optimizing for batch queries:

- [ ] Check if CAVEclient has batch method for this operation
- [ ] Use `l2cache.get_l2data(list)` for supervoxel data (not one-by-one)
- [ ] Use `filter_in_dict` with list of IDs for table queries (not N queries)
- [ ] Add progress logging for long operations (every 100 items)
- [ ] Consider memory usage for 1000+ items (batch in chunks if needed)
- [ ] Return results in same order as input (maintain ID mapping)

## Relationship to Upstream

This is a development fork with additive changes:
- **Upstream**: https://github.com/jaybgager/tracer_tools
- **Fork maintainer**: BunPrinceton
- **Additions**: `root_to_coords`, `update_root_ids`, `root_ids_to_coords_table`, plus CLI scripts
- **No modifications** to existing upstream functions

To sync with upstream:
```bash
git remote add upstream https://github.com/jaybgager/tracer_tools.git
git fetch upstream
git merge upstream/main
```

## Automation Systems

### Auto-Commit System
Automatically commits changes every 10 minutes via Task Scheduler:
- Enable: `D:\1337\setup-auto-commit.bat`
- Logs: `D:\1337\dev-journal\auto-commit.log`
- Check status: `schtasks /query /tn "DevJournal_AutoCommit"`

### Auto-Push System
Pushes commits to GitHub every 30 minutes:
- Enable: `D:\1337\setup-auto-push.bat`
- Only pushes when unpushed commits exist
- Safe for offline work

### Session Chronicles
Context preservation system in `D:\1337\dev-journal\chronicles\`:
- Created every 30-60 minutes during active coding
- Captures decisions, conversations, and ideas
- Auto-committed with code changes

## Working with Claude Code

### Multi-Project Workspace
- This is one of 29 projects at `D:\1337`
- Always verify your current directory before running commands
- Each project has its own git repository

### Claude Enhancements
Launch parallel Claude instances for 3x speedup:
```bash
cd D:/1337/claude-enhancements
./start_parallel_claudes.sh
```
