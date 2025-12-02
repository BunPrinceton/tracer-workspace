#!/usr/bin/env python3
"""
Read segment IDs from Google Sheet, get coordinates, write back to new columns.

Usage:
    # Basic: read column, add coord columns
    python sheets_get_coords.py --sheet SHEET_ID --column root_id

    # Specify worksheet tab
    python sheets_get_coords.py --sheet SHEET_URL --column root_id --worksheet "Sheet1"

    # Also update IDs first
    python sheets_get_coords.py --sheet SHEET_ID --column root_id --update-ids

    # Custom credentials
    python sheets_get_coords.py --sheet SHEET_ID --column root_id --creds /path/to/creds.json
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))
sys.path.insert(0, str(Path(__file__).parent))

from tracer_tools.utils import root_to_coords, update_root_ids
from sheets_utils import (
    read_sheet_to_dataframe,
    write_dataframe_to_sheet,
    get_sheets_client
)


def main():
    parser = argparse.ArgumentParser(
        description="Get coordinates for segment IDs from Google Sheet"
    )
    parser.add_argument("--sheet", "-s", required=True,
                        help="Google Sheet ID or URL")
    parser.add_argument("--column", "-c", required=True,
                        help="Column name containing root IDs")
    parser.add_argument("--worksheet", "-w", default=None,
                        help="Worksheet/tab name (default: first sheet)")
    parser.add_argument("--datastack", "-d", default="brain_and_nerve_cord",
                        help="Datastack name (default: brain_and_nerve_cord)")
    parser.add_argument("--update-ids", "-u", action="store_true",
                        help="Update IDs to latest version first")
    parser.add_argument("--method", "-m", default="skeleton",
                        choices=["skeleton", "supervoxel"],
                        help="Coord method (default: skeleton)")
    parser.add_argument("--creds", default=None,
                        help="Path to Google credentials JSON")
    parser.add_argument("--dry-run", action="store_true",
                        help="Show preview without writing to Sheet")

    args = parser.parse_args()

    print("="*60)
    print("Google Sheets Coordinate Lookup")
    print("="*60)
    print(f"Sheet: {args.sheet}")
    print(f"Column: {args.column}")
    print(f"Datastack: {args.datastack}")
    print("="*60 + "\n")

    # Step 1: Read Sheet
    print("Step 1: Reading Google Sheet...")
    try:
        df = read_sheet_to_dataframe(
            args.sheet,
            worksheet_name=args.worksheet,
            credentials_path=args.creds
        )
        print(f"  ✓ Read {len(df)} rows")
    except Exception as e:
        print(f"  ✗ Error reading sheet: {e}")
        print("\nMake sure:")
        print("1. You've set up credentials (see GOOGLE_SHEETS_SETUP.md)")
        print("2. The sheet is shared with your service account")
        sys.exit(1)

    # Check column exists
    if args.column not in df.columns:
        print(f"\n✗ Column '{args.column}' not found!")
        print(f"Available columns: {list(df.columns)}")
        sys.exit(1)

    root_ids = df[args.column].astype(str).tolist()
    print(f"  ✓ Found {len(root_ids)} IDs in column '{args.column}'\n")

    # Step 2: Update IDs (optional)
    if args.update_ids:
        print("Step 2: Updating IDs to latest versions...")
        update_results = update_root_ids(root_ids, args.datastack)

        df[f'{args.column}_updated'] = [r['new_id'] for r in update_results]
        df[f'{args.column}_changed'] = [r['changed'] for r in update_results]

        changed_count = sum(1 for r in update_results if r['changed'])
        print(f"  ✓ {changed_count}/{len(update_results)} IDs updated\n")

        # Use updated IDs for coord lookup
        root_ids = [r['new_id'] if r['new_id'] else r['old_id'] for r in update_results]
    else:
        print("Step 2: Skipped (use --update-ids to enable)\n")

    # Step 3: Get coordinates
    print(f"Step 3: Fetching coordinates (method: {args.method})...")
    coords_list = root_to_coords(root_ids, args.datastack, method=args.method)

    # Add to dataframe
    df['coord_x'] = [c[0] if c else None for c in coords_list]
    df['coord_y'] = [c[1] if c else None for c in coords_list]
    df['coord_z'] = [c[2] if c else None for c in coords_list]

    valid_count = sum(1 for c in coords_list if c is not None)
    print(f"  ✓ Got coordinates for {valid_count}/{len(coords_list)} IDs\n")

    # Step 4: Write back
    if args.dry_run:
        print("DRY RUN - Preview of first 5 rows:\n")
        print(df.head().to_string())
        print("\n(Use without --dry-run to write to Sheet)")
    else:
        print("Step 4: Writing results back to Google Sheet...")
        try:
            write_dataframe_to_sheet(
                df,
                args.sheet,
                worksheet_name=args.worksheet,
                credentials_path=args.creds
            )
            print("  ✓ Successfully updated Sheet!\n")
        except Exception as e:
            print(f"  ✗ Error writing to sheet: {e}")
            sys.exit(1)

    print("="*60)
    print("Done!")
    print("="*60)


if __name__ == "__main__":
    main()
