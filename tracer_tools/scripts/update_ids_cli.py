#!/usr/bin/env python3
"""
CLI utility to update outdated segment IDs to current versions.

Usage:
    # Paste IDs interactively:
    python update_ids_cli.py --datastack brain_and_nerve_cord

    # From command line arguments:
    python update_ids_cli.py --datastack brain_and_nerve_cord --ids 720575941471915328 720575941471915329

    # Also get coordinates for updated IDs:
    python update_ids_cli.py --datastack brain_and_nerve_cord --with-coords
"""

import argparse
import sys
sys.path.insert(0, '/Users/bds2/Downloads/tracer_tools/src')

from tracer_tools.utils import update_root_ids, root_to_coords


def main():
    parser = argparse.ArgumentParser(description="Update outdated segment IDs")
    parser.add_argument("--datastack", "-d", default="brain_and_nerve_cord",
                        help="Datastack name (default: brain_and_nerve_cord)")
    parser.add_argument("--ids", "-i", nargs="+",
                        help="Root IDs to update (space-separated)")
    parser.add_argument("--with-coords", "-c", action="store_true",
                        help="Also fetch coordinates for updated IDs")
    parser.add_argument("--output", "-o",
                        help="Output file path (optional)")
    parser.add_argument("--paste", "-p", action="store_true",
                        help="Read IDs from stdin (paste mode)")

    args = parser.parse_args()

    # Get IDs from args or stdin
    if args.ids:
        root_ids = args.ids
    elif args.paste or sys.stdin.isatty() == False:
        print("Paste root IDs (one per line, Ctrl+D when done):", file=sys.stderr)
        root_ids = []
        for line in sys.stdin:
            line = line.strip()
            if line:
                root_ids.append(line)
    else:
        print("Enter root IDs (one per line, empty line when done):", file=sys.stderr)
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

    print(f"Updating {len(root_ids)} IDs...", file=sys.stderr)

    # Update IDs
    results = update_root_ids(root_ids, args.datastack)

    # Optionally get coords
    if args.with_coords:
        new_ids = [r["new_id"] for r in results if r["new_id"]]
        coords = root_to_coords(new_ids, args.datastack) if new_ids else []
        coord_map = dict(zip(new_ids, coords))

    # Format output
    if args.with_coords:
        header = "old_id\tnew_id\tchanged\tx\ty\tz"
    else:
        header = "old_id\tnew_id\tchanged"

    lines = [header]
    coord_idx = 0
    for r in results:
        if args.with_coords:
            if r["new_id"] and r["new_id"] in coord_map:
                c = coord_map[r["new_id"]]
                if c:
                    lines.append(f"{r['old_id']}\t{r['new_id']}\t{r['changed']}\t{c[0]}\t{c[1]}\t{c[2]}")
                else:
                    lines.append(f"{r['old_id']}\t{r['new_id']}\t{r['changed']}\tN/A\tN/A\tN/A")
            else:
                lines.append(f"{r['old_id']}\t{r['new_id']}\t{r['changed']}\tN/A\tN/A\tN/A")
        else:
            lines.append(f"{r['old_id']}\t{r['new_id']}\t{r['changed']}")

    result = "\n".join(lines)

    # Output
    if args.output:
        with open(args.output, 'w') as f:
            f.write(result)
        print(f"Results written to {args.output}", file=sys.stderr)
    else:
        print(result)

    # Summary
    changed_count = sum(1 for r in results if r["changed"])
    print(f"\nSummary: {changed_count}/{len(results)} IDs changed", file=sys.stderr)


if __name__ == "__main__":
    main()
