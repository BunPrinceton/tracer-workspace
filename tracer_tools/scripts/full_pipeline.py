#!/usr/bin/env python3
"""
Full pipeline: Update IDs → Get Coords → Output to file/clipboard/Google Sheets.

Usage:
    # Basic: update IDs, get coords, print to terminal
    python full_pipeline.py --datastack brain_and_nerve_cord

    # Save to file
    python full_pipeline.py --datastack brain_and_nerve_cord --output results.tsv

    # Copy to clipboard (macOS)
    python full_pipeline.py --datastack brain_and_nerve_cord --clipboard

    # Skip update step (just get coords)
    python full_pipeline.py --datastack brain_and_nerve_cord --no-update
"""

import argparse
import subprocess
import sys
sys.path.insert(0, '/Users/bds2/Downloads/tracer_tools/src')

from tracer_tools.utils import update_root_ids, root_to_coords


def copy_to_clipboard(text):
    """Copy text to macOS clipboard."""
    process = subprocess.Popen(['pbcopy'], stdin=subprocess.PIPE)
    process.communicate(text.encode('utf-8'))


def main():
    parser = argparse.ArgumentParser(description="Full pipeline: Update IDs → Coords → Output")
    parser.add_argument("--datastack", "-d", default="brain_and_nerve_cord",
                        help="Datastack name (default: brain_and_nerve_cord)")
    parser.add_argument("--ids", "-i", nargs="+",
                        help="Root IDs (space-separated)")
    parser.add_argument("--output", "-o",
                        help="Output file path")
    parser.add_argument("--clipboard", "-c", action="store_true",
                        help="Copy results to clipboard")
    parser.add_argument("--no-update", action="store_true",
                        help="Skip ID update step")
    parser.add_argument("--method", "-m", default="skeleton",
                        choices=["skeleton", "supervoxel"],
                        help="Coord method (default: skeleton)")

    args = parser.parse_args()

    # Get IDs
    if args.ids:
        root_ids = args.ids
    else:
        print("Paste root IDs (one per line, empty line when done):", file=sys.stderr)
        root_ids = []
        while True:
            try:
                line = input()
                if line.strip():
                    root_ids.append(line.strip())
                else:
                    break
            except EOFError:
                break

    if not root_ids:
        print("No IDs provided!", file=sys.stderr)
        sys.exit(1)

    print(f"\n{'='*50}", file=sys.stderr)
    print(f"Processing {len(root_ids)} IDs", file=sys.stderr)
    print(f"Datastack: {args.datastack}", file=sys.stderr)
    print(f"{'='*50}\n", file=sys.stderr)

    # Step 1: Update IDs (optional)
    if not args.no_update:
        print("Step 1: Updating IDs to latest versions...", file=sys.stderr)
        update_results = update_root_ids(root_ids, args.datastack)

        changed_count = sum(1 for r in update_results if r['changed'])
        print(f"  → {changed_count}/{len(update_results)} IDs changed\n", file=sys.stderr)

        # Track changes
        changes_log = []
        for r in update_results:
            if r['changed']:
                changes_log.append(f"  {r['old_id']} → {r['new_id']}")

        if changes_log:
            print("Changed IDs:", file=sys.stderr)
            for log in changes_log[:10]:  # Show first 10
                print(log, file=sys.stderr)
            if len(changes_log) > 10:
                print(f"  ... and {len(changes_log) - 10} more", file=sys.stderr)
            print("", file=sys.stderr)

        # Use updated IDs
        working_ids = [r['new_id'] if r['new_id'] else r['old_id'] for r in update_results]
    else:
        print("Step 1: Skipped (--no-update)", file=sys.stderr)
        update_results = [{"old_id": rid, "new_id": rid, "changed": False} for rid in root_ids]
        working_ids = root_ids

    # Step 2: Get coordinates
    print("Step 2: Fetching coordinates...", file=sys.stderr)
    coords = root_to_coords(working_ids, args.datastack, method=args.method)

    valid_count = sum(1 for c in coords if c is not None)
    print(f"  → Got coords for {valid_count}/{len(coords)} IDs\n", file=sys.stderr)

    # Step 3: Format output
    print("Step 3: Formatting output...", file=sys.stderr)

    header = "original_id\tcurrent_id\tchanged\tx\ty\tz"
    lines = [header]

    for i, (r, c) in enumerate(zip(update_results, coords)):
        if c:
            lines.append(f"{r['old_id']}\t{r['new_id']}\t{r['changed']}\t{c[0]}\t{c[1]}\t{c[2]}")
        else:
            lines.append(f"{r['old_id']}\t{r['new_id']}\t{r['changed']}\tN/A\tN/A\tN/A")

    result = "\n".join(lines)

    # Output
    if args.output:
        with open(args.output, 'w') as f:
            f.write(result)
        print(f"  → Results written to {args.output}", file=sys.stderr)

    if args.clipboard:
        copy_to_clipboard(result)
        print("  → Results copied to clipboard!", file=sys.stderr)

    if not args.output and not args.clipboard:
        print("\n" + result)

    print(f"\n{'='*50}", file=sys.stderr)
    print("Done!", file=sys.stderr)
    print(f"{'='*50}", file=sys.stderr)


if __name__ == "__main__":
    main()
