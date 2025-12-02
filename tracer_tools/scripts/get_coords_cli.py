#!/usr/bin/env python3
"""
CLI utility to get coordinates for segment IDs.

Usage:
    # Paste IDs interactively:
    python get_coords_cli.py --datastack brain_and_nerve_cord

    # From command line arguments:
    python get_coords_cli.py --datastack brain_and_nerve_cord --ids 720575941471915328 720575941471915329

    # Output to file:
    python get_coords_cli.py --datastack brain_and_nerve_cord --output coords.tsv
"""

import argparse
import sys
sys.path.insert(0, '/Users/bds2/Downloads/tracer_tools/src')

from tracer_tools.utils import root_to_coords, root_ids_to_coords_table


def main():
    parser = argparse.ArgumentParser(description="Get coordinates for segment IDs")
    parser.add_argument("--datastack", "-d", default="brain_and_nerve_cord",
                        help="Datastack name (default: brain_and_nerve_cord)")
    parser.add_argument("--ids", "-i", nargs="+",
                        help="Root IDs to look up (space-separated)")
    parser.add_argument("--method", "-m", default="skeleton",
                        choices=["skeleton", "supervoxel"],
                        help="Method for getting coords (default: skeleton)")
    parser.add_argument("--output", "-o",
                        help="Output file path (optional, prints to stdout if not specified)")
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

    print(f"Processing {len(root_ids)} IDs...", file=sys.stderr)

    # Get coordinates
    result = root_ids_to_coords_table(root_ids, args.datastack, method=args.method)

    # Output
    if args.output:
        with open(args.output, 'w') as f:
            f.write(result)
        print(f"Results written to {args.output}", file=sys.stderr)
    else:
        print(result)


if __name__ == "__main__":
    main()
