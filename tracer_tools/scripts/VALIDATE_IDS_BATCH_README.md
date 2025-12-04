# Batch ID Validation Script - Complete Guide

## Overview

The `validate_ids_batch.py` script validates large lists of segment IDs against the CAVE (Connectome Annotation Versioning Engine) database. It checks if your IDs are current or if they've been updated due to neuron splits/merges in the segmentation.

**Key Features:**
- Processes 12,000+ IDs efficiently in 1000-ID batches
- Avoids API timeouts and rate limits
- Produces clear output showing which IDs are current and which have changed
- Generates summary statistics with progress tracking

## What This Does

When neurons in connectomics datasets are proofreaded, they sometimes get split or merged. This changes their root ID. This script:

1. Takes your list of segment IDs
2. Queries CAVE's supervoxel tracking to find the current root ID
3. Outputs which IDs are unchanged and which have been updated
4. Provides a summary of how many IDs changed

## Usage

### Basic Usage (Validate Your IDs)

```bash
# From C:\1337\tracer_docs\tracer_tools
python scripts/validate_ids_batch.py --input C:\Users\Benjamin\Desktop\ID_TO_CHECK.txt
```

This will:
1. Read all IDs from your file
2. Process them in 1000-ID batches (13 batches for 12,320 IDs)
3. Output results to `results_ID_TO_CHECK_validated.txt`
4. Print a summary to the console

### With Custom Output Path

```bash
python scripts/validate_ids_batch.py \
  --input C:\Users\Benjamin\Desktop\ID_TO_CHECK.txt \
  --output C:\Users\Benjamin\Desktop\ID_VALIDATION_RESULTS.txt
```

### With Progress Tracking

```bash
python scripts/validate_ids_batch.py \
  --input C:\Users\Benjamin\Desktop\ID_TO_CHECK.txt \
  --progress-log validation_progress.json
```

This saves a JSON file showing which batches completed and how many IDs changed in each.

### Different Batch Size

```bash
# Process in smaller batches (safer for unreliable connections)
python scripts/validate_ids_batch.py \
  --input C:\Users\Benjamin\Desktop\ID_TO_CHECK.txt \
  --batch-size 500
```

### Different Datastack

```bash
# If using FlyWire instead of BANC
python scripts/validate_ids_batch.py \
  --input C:\Users\Benjamin\Desktop\ID_TO_CHECK.txt \
  --datastack flywire_fafb_production
```

## Command-Line Options

| Option | Short | Default | Description |
|--------|-------|---------|-------------|
| `--input` | `-i` | **Required** | Input file with IDs (one per line or N→ID format) |
| `--output` | `-o` | `results_[input_name]_validated.txt` | Where to save results |
| `--datastack` | `-d` | `brain_and_nerve_cord` | BANC or flywire_fafb_production |
| `--batch-size` | `-b` | `1000` | IDs per batch (1000 recommended) |
| `--skip-header` | `-s` | — | Skip first line of input file |
| `--progress-log` | — | — | Save progress as JSON |

## Input File Format

The script accepts multiple formats:

**Format 1: Plain IDs (one per line)**
```
720575941733763115
720575941471105655
720575941414276497
```

**Format 2: Numbered format (N→ID)**
```
1→720575941733763115
2→720575941471105655
3→720575941414276497
```

Both formats are automatically detected and parsed correctly.

## Output Format

The output file contains:

### Header Section
```
# ID Validation Report
# Generated: ID_TO_CHECK
# Total IDs processed: 12320
# Changed: 8234
# Unchanged: 4086
# Percentage changed: 66.84%

---RESULTS---
```

### Result Section

**Unchanged IDs** (Current version in database):
```
720575941733763115                              [OK - Current]
```

**Changed IDs** (Have been updated):
```
720575941471105655    ->    720575941613190829
```

### Interpretation

- **[OK - Current]** - This ID is the current version in CAVE. No update needed.
- **-> NEW_ID** - This ID has been updated to a new version. Use the new ID going forward.

## Processing Time

For 12,320 IDs in 1000-ID batches:

- **Typical speed:** 4-5 minutes per 1000 IDs = ~50-65 minutes total
- **Network dependent:** Slower if connection is unstable
- **Batch size impact:**
  - 1000 IDs/batch: 13 total batches, ~50-60 min
  - 500 IDs/batch: 25 total batches, slightly faster per batch
  - 2000 IDs/batch: 7 batches, risk of API timeouts

## Progress Tracking

While the script runs, you'll see output like:

```
[Batch 1/13] Processing 1000 IDs...
  Checking 1000 IDs for updates (via supervoxels, batched)...
    Getting supervoxels: 100/1000...
    Getting supervoxels: 200/1000...
  Looking up current roots for 1000 supervoxels (batched)...
  [OK] Batch complete: 687 changed, 313 unchanged

[Batch 2/13] Processing 1000 IDs...
```

The script automatically:
- Shows progress every 100 IDs during supervoxel fetching
- Reports completion status for each batch
- Shows changed/unchanged counts per batch

## What Happens Behind the Scenes

The script uses CAVE's supervoxel tracking, which is the most accurate method:

1. **Get supervoxels:** For each old root ID, find one supervoxel it contains
2. **Track supervoxels:** Query CAVE to find the current root ID containing those supervoxels
3. **Batch queries:** Process all supervoxels in one batched API call (not one-by-one)

This method is accurate even when neurons are split—it follows the supervoxels through proofreading operations rather than just tracking the root ID itself.

**Why not use simpler methods?**
- ❌ `get_latest_roots()` is instant but incorrect for split neurons
- ✅ Supervoxel method is accurate and reasonably fast with batching

## Troubleshooting

### Script fails with "ImportError: No module named 'caveclient'"

**Solution:** Install dependencies:
```bash
cd C:\1337\tracer_docs\tracer_tools
pip install caveclient pandas nglui numpy plotly
pip install -e .
```

### Script gets stuck / times out

**Cause:** CAVE API is slow or connection is unstable

**Solutions:**
1. Reduce batch size: `--batch-size 500` or `--batch-size 250`
2. Run during off-peak hours
3. Check your internet connection
4. Restart and resume: The progress-log feature helps resume interrupted runs

### "Could not get supervoxels for ID" warnings

**Meaning:** This ID doesn't exist in CAVE or is invalid

**Solution:** Check that the ID is correctly formatted (18 digits, no spaces)

### Output file is empty or incomplete

**Cause:** Script was interrupted

**Solution:**
1. Check `validation_progress.json` to see which batches completed
2. You can manually extract the results you need
3. Or re-run to validate the full set again

## Advanced Usage

### Resume After Interruption

If the script is interrupted, the progress-log shows your progress:

```bash
# Check completed batches
cat C:\temp\validation_progress.json

# Then extract just the completed results
# (Manual: Combine JSON results if needed)
```

### Process Multiple Files

```bash
# Validate two different ID lists
python scripts/validate_ids_batch.py --input file1.txt --output file1_results.txt
python scripts/validate_ids_batch.py --input file2.txt --output file2_results.txt
```

### Export to CSV (Post-Processing)

You can convert the output to CSV:

```python
# Simple Python script to extract results
with open('ID_VALIDATION_RESULTS.txt') as f:
    for line in f:
        if '->' in line:
            old, new = line.split('->')
            print(f"{old.strip()},{new.strip()}")
```

## Integration with Other Tools

### With Google Sheets

After validation, you can:
1. Copy the "CHANGED" IDs from the results
2. Use `sheets_get_coords_safe.py` to fetch coordinates for updated IDs
3. Update your spreadsheet with new IDs and coordinates

### With Neuroglancer Links

1. Extract changed IDs from results
2. Use `build_ng_link()` to create visualization links for changed neurons
3. Review changes in Neuroglancer to verify updates

## Performance Notes

**Batch size recommendations:**

| Batch Size | Total Batches | Est. Time | Risk |
|-----------|---------------|-----------|------|
| 250 | 50 | ~2-3 hours | Slow, but safest |
| 500 | 25 | ~1.5-2 hours | Safe, balanced |
| **1000** | **13** | **~50-65 min** | **Recommended** |
| 2000 | 7 | ~25-35 min | Risk of timeouts |

**Network optimization:**
- Stable connection: Use 1000 or larger batches
- Unstable connection: Use 500 or smaller batches
- Running from office network: 1000+ safe
- Running from home/VPN: 500 recommended

## Next Steps After Validation

1. **Review changed IDs:** Check which IDs have been updated
2. **Update your data:** Replace old IDs with new ones in your files
3. **Fetch coordinates:** Use `root_to_coords()` or `get_coords_cli.py` to get positions for new IDs
4. **Visualize changes:** Use `build_ng_link()` to view updated neurons in Neuroglancer

## Questions or Issues

If you encounter problems:

1. Check the error messages in the console output
2. Review this troubleshooting section
3. Verify your input file format
4. Ensure your internet connection is stable
5. Try running a small test batch first: `--batch-size 100`

## Examples

### Example 1: Quick validation with default settings
```bash
python scripts/validate_ids_batch.py \
  --input C:\Users\Benjamin\Desktop\ID_TO_CHECK.txt
```

### Example 2: Safe validation with progress tracking
```bash
python scripts/validate_ids_batch.py \
  --input C:\Users\Benjamin\Desktop\ID_TO_CHECK.txt \
  --output results.txt \
  --batch-size 500 \
  --progress-log progress.json
```

### Example 3: FlyWire validation
```bash
python scripts/validate_ids_batch.py \
  --input flywire_ids.txt \
  --datastack flywire_fafb_production \
  --batch-size 1000 \
  --output flywire_results.txt
```
