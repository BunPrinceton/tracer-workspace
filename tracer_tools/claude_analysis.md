# Claude Agent Analysis: Tracer Tools Repository

## TOOL INVENTORY

| # | Function | Current Power | Potential Power | Ease of Fix | Priority | Notes |
|---|----------|---|---|---|---|---|
| 1 | `bbox_corners_from_center` | 6/10 | 7/10 | 3/10 | Medium | Works but has a bug in dimension adjustment logic |
| 2 | `build_ng_link` | 8/10 | 9/10 | 5/10 | High | Powerful but hardcoded for 2 datastacks, prototype status |
| 3 | `calc_distance` | 9/10 | 9/10 | 2/10 | Low | Well-implemented, only minor docs improvement needed |
| 4 | `convert_coord_res` | 8/10 | 9/10 | 2/10 | Low | Solid utility, just needs better error handling |
| 5 | `coords_to_root` | 7/10 | 8/10 | 4/10 | Medium | Works but BANC-only, needs generalization |
| 6 | `generate_color_list` | 9/10 | 9/10 | 2/10 | Low | Excellent algorithm, minimal improvements needed |
| 7 | `get_all_stacks` | 7/10 | 8/10 | 2/10 | Low | Simple, functional, caching could help |
| 8 | `get_nt` | 7/10 | 8/10 | 4/10 | Medium | FlyWire-only, hardcoded column names, logic complex |
| 9 | `get_stack_data` | 8/10 | 8/10 | 1/10 | Low | Simple wrapper, works well |
| 10 | `get_stack_tables` | 8/10 | 8/10 | 1/10 | Low | Simple wrapper, works well |
| 11 | `get_state_json_from_url` | 7/10 | 8/10 | 2/10 | Low | Solid, needs better error handling |
| 12 | `get_synapse_counts` | 8/10 | 9/10 | 3/10 | Medium | Good but hardcoded column names, FlyWire-specific cleft filtering |
| 13 | `get_table` | 8/10 | 8/10 | 1/10 | Low | Simple wrapper, works well |
| 14 | `get_table_data` | 8/10 | 8/10 | 1/10 | Low | Simple wrapper, works well |
| 15 | `roots_to_nt_link` | 7/10 | 8/10 | 3/10 | Medium | FlyWire-only, hardcoded colors, depends on `get_nt` |
| 16 | `root_to_svs` | 8/10 | 8/10 | 1/10 | Low | Simple, effective, works as intended |
| 17 | `root_to_vol` | 9/10 | 9/10 | 1/10 | Low | Excellent implementation |
| 18 | `stringify_int_list` | 6/10 | 7/10 | 1/10 | Low | Works but underused, should be in more functions |
| 19 | `sv_to_root` | 8/10 | 8/10 | 1/10 | Low | Simple, effective, works as intended |
| 20 | `visualize_skeletons` | 8/10 | 8/10 | 3/10 | Low | Solid, only needs minor polish |

**Average Power Level: 7.7/10**

---

## MISSING TOOLS

### 1. `root_to_coords` (CRITICAL)
Convert root ID → coordinates. INVERSE of coords_to_root.

```python
def root_to_coords(root_id, datastack, skeleton_method=False):
    """Convert root ID to approximate coordinates.

    Arguments:
    root_id -- the 18-digit root ID (str or int)
    datastack -- the name of the datastack (str)
    skeleton_method -- if True, use skeleton centroid (bool, default False)

    Returns:
    coords -- xyz coordinates in viewer resolution (list of ints)
    """
    client = CAVEclient(datastack_name=datastack)
    stack_info = client.info.get_datastack_info()

    if skeleton_method:
        skeleton = client.skeleton.get_skeleton(root_id)
        vertices = np.array(skeleton['vertices'])
        centroid = vertices.mean(axis=0)
        return [int(c) for c in centroid]
    else:
        # Use supervoxel bounds
        sv_ids = client.chunkedgraph.get_leaves(root_id)
        # Implementation depends on API
        pass
```

### 2. `update_root_ids` (CRITICAL)
Update legacy root IDs to current versions.

```python
def update_root_ids(old_root_ids, datastack, timestamp=None):
    """Update legacy root IDs to current versions.

    Arguments:
    old_root_ids -- list of potentially outdated root IDs (list)
    datastack -- the name of the datastack (str)
    timestamp -- update to IDs valid at specific time (datetime, default None)

    Returns:
    updated_dict -- dict mapping old -> current root_ids (dict)
    """
    client = CAVEclient(datastack_name=datastack)
    updated_dict = {}

    for old_id in old_root_ids:
        try:
            current_id = client.chunkedgraph.get_root_id(old_id)
            updated_dict[str(old_id)] = str(current_id)
        except Exception:
            updated_dict[str(old_id)] = None

    return updated_dict
```

### 3. `batch_query_synapses`
Efficient batch synapse queries (reduces N queries → 2 queries).

### 4. `save_ng_link` / `load_root_ids_from_table`
File I/O utilities for persistent storage.

---

## WEAKNESSES

### Code Quality Issues
- **Hardcoded column names**: `pre_pt_root_id`, `post_pt_root_id` appear in 5+ functions
- **Hardcoded datastack assumptions**: Lines 40, 71-74, 186-189, 218-223 assume FlyWire/BANC
- **Magic numbers**: Line 501 `increment = int((1530) / n)` lacks explanation
- **Code duplication**: Lines 120-172 duplicate synapse fetching logic

### Error Handling Gaps
- No validation for empty results (crashes on empty DataFrames)
- No datastack validation before queries
- Missing try-except for network failures
- `visualize_skeletons` prints error and exits instead of raising exception

### Datastack Support Limitations
- `build_ng_link`: FlyWire/BANC only
- `get_nt`: FlyWire only
- `coords_to_root`: BANC only

### Performance Bottlenecks
- **N+1 query problem**: `get_synapse_counts` queries table once per root_id
- **No pagination**: `get_table` loads entire table into memory
- **Redundant queries**: Stack info queried multiple times

### API Issues
- `build_ng_link` prints URL but doesn't return it (line 334)
- Inconsistent return types in `get_nt`

---

## PRIORITY IMPROVEMENTS

### TIER 1: Quick Wins (Effort: 1-2, Impact: 6-8)
1. **Make build_ng_link return URL** - Change `print(url)` to `return url`
2. **Fix bbox_corners_from_center bug** - Local var mutation issue
3. **Add empty result validation**
4. **Add datastack validation**
5. **Extract hardcoded columns to config dict**

### TIER 2: Medium Effort (Effort: 3-5, Impact: 7-9)
6. **Add batch_query_synapses function**
7. **Implement root_to_coords** (CRITICAL)
8. **Extract synapse logic to helper function**
9. **Add type hints throughout**
10. **Generalize get_nt to all datastacks**

### TIER 3: Major Enhancements (Effort: 6-9, Impact: 6-8)
11. **Implement update_root_ids function**
12. **Add logging instead of print statements**
13. **Implement connection caching**
14. **Add async/await support**
15. **Create datastack abstraction layer**

---

## KEY CODE EXAMPLES

### Fix 1: bbox_corners_from_center Bug
```python
# BUG: Original modifies local variable, not list
dims = [dim + 1 if dim % 2 != 0 else dim for dim in dims]
```

### Fix 2: Configuration-Based Column Management
```python
CAVE_SCHEMA = {
    "flywire_fafb_production": {
        "synapse_columns": {
            "pre_root": "pre_pt_root_id",
            "post_root": "post_pt_root_id",
        },
        "syn_colors": {"in": "#FFFF00", "out": "#0000FF"}
    },
    "brain_and_nerve_cord": {
        "synapse_columns": {...},
        "syn_colors": {"in": "#FF6E4A", "out": "#3D81FF"}
    }
}
```

### Fix 3: Batch Query Optimization
```python
def get_synapse_counts_batch(root_ids, datastack, cleft_thresh=0):
    # Single batch query instead of N queries
    all_synapses = client.materialize.query_table(
        synapse_table,
        filter_in_dict={cols["post_root"]: root_ids}
    )
    # ... aggregate per ID
```

---

## SUMMARY

**Current State**: Solid foundation, 20 functions, avg power 7.7/10

**Top 3 Issues**:
1. Hardcoded datastack/column assumptions
2. N+1 query performance problem
3. Missing `root_to_coords` inverse function

**Quick Wins**: ~8 hours work → power level 8.8/10
