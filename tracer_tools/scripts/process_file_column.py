#!/usr/bin/env python3
"""
Process a file with segment IDs in a column and add coordinates to adjacent column.

Usage:
    # Process CSV/TSV file:
    python process_file_column.py input.csv --column root_id --datastack brain_and_nerve_cord

    # Specify output file (default: creates new file with _with_coords suffix):
    python process_file_column.py input.csv --column 0 --output output.csv

    # Update IDs first, then get coords:
    python process_file_column.py input.csv --column root_id --update-ids
"""

import argparse
import pandas as pd
import sys
sys.path.insert(0, '/Users/bds2/Downloads/tracer_tools/src')

from tracer_tools.utils import root_to_coords, update_root_ids


def main():
    parser = argparse.ArgumentParser(description="Process file column and add coordinates")
    parser.add_argument("input_file", help="Input file (CSV, TSV, or Excel)")
    parser.add_argument("--column", "-c", required=True,
                        help="Column name or index (0-based) containing root IDs")
    parser.add_argument("--datastack", "-d", default="brain_and_nerve_cord",
                        help="Datastack name (default: brain_and_nerve_cord)")
    parser.add_argument("--output", "-o",
                        help="Output file path (default: input_with_coords.ext)")
    parser.add_argument("--update-ids", "-u", action="store_true",
                        help="Update IDs to latest version before getting coords")
    parser.add_argument("--method", "-m", default="skeleton",
                        choices=["skeleton", "supervoxel"],
                        help="Method for getting coords (default: skeleton)")
    parser.add_argument("--separator", "-s", default=None,
                        help="Field separator (auto-detected by default)")

    args = parser.parse_args()

    # Read input file
    input_file = args.input_file
    if input_file.endswith('.xlsx') or input_file.endswith('.xls'):
        df = pd.read_excel(input_file)
    elif input_file.endswith('.tsv') or args.separator == '\t':
        df = pd.read_csv(input_file, sep='\t')
    else:
        df = pd.read_csv(input_file, sep=args.separator)

    # Get column
    try:
        col_idx = int(args.column)
        col_name = df.columns[col_idx]
    except ValueError:
        col_name = args.column

    if col_name not in df.columns:
        print(f"Error: Column '{col_name}' not found. Available: {list(df.columns)}", file=sys.stderr)
        sys.exit(1)

    root_ids = df[col_name].astype(str).tolist()
    print(f"Processing {len(root_ids)} IDs from column '{col_name}'...", file=sys.stderr)

    # Optionally update IDs first
    if args.update_ids:
        print("Updating IDs to latest versions...", file=sys.stderr)
        update_results = update_root_ids(root_ids, args.datastack)

        # Add update columns
        df[f'{col_name}_updated'] = [r['new_id'] for r in update_results]
        df[f'{col_name}_changed'] = [r['changed'] for r in update_results]

        # Use updated IDs for coord lookup
        root_ids = [r['new_id'] if r['new_id'] else r['old_id'] for r in update_results]

        changed_count = sum(1 for r in update_results if r['changed'])
        print(f"  {changed_count}/{len(update_results)} IDs were updated", file=sys.stderr)

    # Get coordinates
    print("Fetching coordinates...", file=sys.stderr)
    coords_list = root_to_coords(root_ids, args.datastack, method=args.method)

    # Add coordinate columns
    df['coord_x'] = [c[0] if c else None for c in coords_list]
    df['coord_y'] = [c[1] if c else None for c in coords_list]
    df['coord_z'] = [c[2] if c else None for c in coords_list]

    # Determine output path
    if args.output:
        output_file = args.output
    else:
        base = input_file.rsplit('.', 1)
        output_file = f"{base[0]}_with_coords.{base[1]}" if len(base) > 1 else f"{input_file}_with_coords"

    # Write output
    if output_file.endswith('.xlsx'):
        df.to_excel(output_file, index=False)
    elif output_file.endswith('.tsv'):
        df.to_csv(output_file, sep='\t', index=False)
    else:
        df.to_csv(output_file, index=False)

    print(f"Results written to {output_file}", file=sys.stderr)

    # Summary
    valid_coords = sum(1 for c in coords_list if c is not None)
    print(f"Successfully got coordinates for {valid_coords}/{len(coords_list)} IDs", file=sys.stderr)


if __name__ == "__main__":
    main()
