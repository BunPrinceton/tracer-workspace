#!/usr/bin/env python3
"""
Batch validate segment IDs against CAVE for freshness.

Processes large lists (1000+) of IDs in chunks to avoid API timeouts.
Outputs a file with changed IDs clearly marked and unchanged IDs with proper spacing.

Usage:
    # Validate IDs from file, process in 1000-ID batches
    python validate_ids_batch.py --input C:\\Users\\Benjamin\\Desktop\\ID_TO_CHECK.txt --datastack brain_and_nerve_cord --batch-size 1000

    # Output to specific file
    python validate_ids_batch.py --input C:\\Users\\Benjamin\\Desktop\\ID_TO_CHECK.txt --output results_12320_ids.txt

    # Specify datastack
    python validate_ids_batch.py --input C:\\Users\\Benjamin\\Desktop\\ID_TO_CHECK.txt --datastack brain_and_nerve_cord
"""

import argparse
import sys
import os
import json
from pathlib import Path
from typing import List, Dict, Tuple

# Add tracer_tools to path for imports
script_dir = Path(__file__).parent
project_root = script_dir.parent
src_dir = project_root / "src"
sys.path.insert(0, str(src_dir))

try:
    from tracer_tools.utils import update_root_ids
except ImportError as e:
    print(f"Error: Could not import tracer_tools: {e}", file=sys.stderr)
    print(f"Tried to import from: {src_dir}", file=sys.stderr)
    print("Ensure it's installed: pip install -e .", file=sys.stderr)
    sys.exit(1)


def parse_id_file(filepath: str) -> List[str]:
    """Parse ID file and extract just the IDs.

    Handles format: "N→ID" (extracts ID part)
    Also handles plain IDs one per line.
    """
    ids = []
    try:
        with open(filepath, 'r') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue

                # Handle "N→ID" format
                if '→' in line:
                    parts = line.split('→')
                    if len(parts) >= 2:
                        id_part = parts[-1].strip()
                        if id_part:
                            ids.append(id_part)
                else:
                    # Plain ID
                    if line and line.isdigit():
                        ids.append(line)
    except FileNotFoundError:
        print(f"Error: File not found: {filepath}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error reading file: {e}", file=sys.stderr)
        sys.exit(1)

    return ids


def validate_batch(batch_ids: List[str], datastack: str, batch_num: int, total_batches: int) -> List[Dict]:
    """Validate a single batch of IDs.

    Returns list of result dicts with old_id, new_id, changed.
    """
    print(f"\n[Batch {batch_num}/{total_batches}] Processing {len(batch_ids)} IDs...")

    try:
        results = update_root_ids(batch_ids, datastack)
        return results
    except Exception as e:
        print(f"Error processing batch {batch_num}: {e}", file=sys.stderr)
        return []


def format_output(all_results: List[Dict]) -> Tuple[str, int, int]:
    """Format results for output.

    Creates output with changed IDs clearly marked and unchanged IDs with exact spacing preserved.

    Returns: (formatted_output, changed_count, unchanged_count)
    """
    lines = []
    changed_count = 0
    unchanged_count = 0

    for result in all_results:
        old_id = result.get('old_id')
        new_id = result.get('new_id')
        changed = result.get('changed')

        if new_id is None:
            # Could not validate
            lines.append(f"# ERROR: Could not validate {old_id}")
        elif changed:
            # ID changed - output clearly marked
            changed_count += 1
            # Format: OLD_ID -> NEW_ID (with spacing padding for readability)
            lines.append(f"{old_id}    ->    {new_id}")
        else:
            # ID unchanged - preserve with exact spacing format
            unchanged_count += 1
            # Unchanged IDs get exact spacing (20 chars + indicators)
            lines.append(f"{old_id}                              [OK - Current]")

    output = "\n".join(lines)
    return output, changed_count, unchanged_count


def generate_summary_file(output_text: str, filepath: str, total_ids: int, changed_count: int, unchanged_count: int):
    """Write results to file with summary header."""
    summary = f"""# ID Validation Report
# Generated: {Path(filepath).stem}
# Total IDs processed: {total_ids}
# Changed: {changed_count}
# Unchanged: {unchanged_count}
# Percentage changed: {(changed_count/total_ids*100 if total_ids > 0 else 0):.2f}%

---RESULTS---

{output_text}
"""

    try:
        with open(filepath, 'w') as f:
            f.write(summary)
        print(f"\nResults written to: {filepath}")
        print(f"Total lines: {len(output_text.splitlines())}")
    except Exception as e:
        print(f"Error writing output file: {e}", file=sys.stderr)
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description="Batch validate segment IDs against CAVE for freshness",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument("--input", "-i", required=True,
                        help="Input file with IDs (one per line or N→ID format)")
    parser.add_argument("--output", "-o",
                        help="Output file path (default: results_[input_name].txt)")
    parser.add_argument("--datastack", "-d", default="brain_and_nerve_cord",
                        help="Datastack name (default: brain_and_nerve_cord)")
    parser.add_argument("--batch-size", "-b", type=int, default=1000,
                        help="Number of IDs per batch (default: 1000)")
    parser.add_argument("--skip-header", "-s", action="store_true",
                        help="Skip first line of input file")
    parser.add_argument("--progress-log",
                        help="Save progress to JSON file (for resuming interrupted batches)")

    args = parser.parse_args()

    # Validate output path
    if not args.output:
        input_name = Path(args.input).stem
        args.output = f"results_{input_name}_validated.txt"

    print(f"ID Validation Batch Processor")
    print(f"============================")
    print(f"Input file: {args.input}")
    print(f"Output file: {args.output}")
    print(f"Datastack: {args.datastack}")
    print(f"Batch size: {args.batch_size}")

    # Parse input file
    print(f"\nParsing input file...")
    all_ids = parse_id_file(args.input)

    if not all_ids:
        print("Error: No IDs found in input file", file=sys.stderr)
        sys.exit(1)

    print(f"Found {len(all_ids)} IDs to validate")

    # Process in batches
    total_batches = (len(all_ids) + args.batch_size - 1) // args.batch_size
    all_results = []
    progress = []

    for batch_num in range(total_batches):
        start_idx = batch_num * args.batch_size
        end_idx = min((batch_num + 1) * args.batch_size, len(all_ids))
        batch_ids = all_ids[start_idx:end_idx]

        # Validate batch
        batch_results = validate_batch(
            batch_ids,
            args.datastack,
            batch_num + 1,
            total_batches
        )

        if batch_results:
            all_results.extend(batch_results)

            # Log progress
            changed_in_batch = sum(1 for r in batch_results if r.get('changed'))
            progress.append({
                "batch": batch_num + 1,
                "start_idx": start_idx,
                "end_idx": end_idx,
                "count": len(batch_ids),
                "changed": changed_in_batch
            })

            print(f"  [OK] Batch complete: {changed_in_batch} changed, {len(batch_ids) - changed_in_batch} unchanged")
        else:
            print(f"  [ERROR] Batch failed (see errors above)")

    # Save progress log if requested
    if args.progress_log:
        with open(args.progress_log, 'w') as f:
            json.dump(progress, f, indent=2)
        print(f"\nProgress log saved to: {args.progress_log}")

    # Format and save output
    print(f"\nFormatting results...")
    output_text, changed_count, unchanged_count = format_output(all_results)

    generate_summary_file(
        output_text,
        args.output,
        len(all_ids),
        changed_count,
        unchanged_count
    )

    # Print summary
    print(f"\n{'='*50}")
    print(f"VALIDATION SUMMARY")
    print(f"{'='*50}")
    print(f"Total IDs processed: {len(all_ids)}")
    print(f"IDs changed: {changed_count} ({changed_count/len(all_ids)*100:.2f}%)")
    print(f"IDs unchanged: {unchanged_count} ({unchanged_count/len(all_ids)*100:.2f}%)")
    print(f"Processing complete!")


if __name__ == "__main__":
    main()
