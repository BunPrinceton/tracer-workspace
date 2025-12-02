#!/usr/bin/env python3
"""
SAFE MODE: Read IDs from Google Sheet, create NEW worksheet with coordinates.
Original sheet is NEVER modified.

Usage:
    # Auto-detect ID column, create new tab with results
    python sheets_get_coords_safe.py --sheet SHEET_URL

    # Specify source worksheet
    python sheets_get_coords_safe.py --sheet SHEET_URL --worksheet "Sheet1"

    # Custom output tab name
    python sheets_get_coords_safe.py --sheet SHEET_URL --output-name "Coords_2024"
"""

import argparse
import sys
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))
sys.path.insert(0, str(Path(__file__).parent))

from tracer_tools.utils import root_to_coords, update_root_ids
from sheets_utils import read_sheet_to_dataframe, get_sheets_client
import gspread


def auto_detect_id_column(df):
    """Auto-detect column containing segment IDs."""

    # Priority 1: Column named with "id" or "root"
    for col in df.columns:
        if any(keyword in col.lower() for keyword in ['root', 'segment', 'id']):
            return col

    # Priority 2: First column (usually column A)
    return df.columns[0]


def main():
    parser = argparse.ArgumentParser(
        description="SAFE: Get coords without modifying original sheet"
    )
    parser.add_argument("--sheet", "-s", required=True,
                        help="Google Sheet ID or URL")
    parser.add_argument("--worksheet", "-w", default=None,
                        help="Source worksheet/tab name (default: first sheet)")
    parser.add_argument("--column", "-c", default=None,
                        help="Column name with IDs (auto-detected if not specified)")
    parser.add_argument("--output-name", "-o", default=None,
                        help="Name for new output worksheet (default: 'Coords_TIMESTAMP')")
    parser.add_argument("--datastack", "-d", default="brain_and_nerve_cord",
                        help="Datastack name (default: brain_and_nerve_cord)")
    parser.add_argument("--update-ids", "-u", action="store_true",
                        help="Update IDs to latest version first")
    parser.add_argument("--method", "-m", default="skeleton",
                        choices=["skeleton", "supervoxel"],
                        help="Coord method (default: skeleton)")
    parser.add_argument("--creds", default=None,
                        help="Path to Google credentials JSON")

    args = parser.parse_args()

    print("="*60)
    print("SAFE MODE: Original sheet will NOT be modified")
    print("="*60)
    print(f"Sheet: {args.sheet}")
    print(f"Datastack: {args.datastack}")
    print("="*60 + "\n")

    # Step 1: Read Sheet (READ ONLY)
    print("Step 1: Reading source sheet (read-only)...")
    try:
        df = read_sheet_to_dataframe(
            args.sheet,
            worksheet_name=args.worksheet,
            credentials_path=args.creds
        )
        print(f"  ✓ Read {len(df)} rows")
    except Exception as e:
        print(f"  ✗ Error: {e}")
        print("\nMake sure sheet is shared with: ttools@ttolskey.iam.gserviceaccount.com")
        sys.exit(1)

    # Auto-detect or use specified column
    if args.column:
        col_name = args.column
        if col_name not in df.columns:
            print(f"\n✗ Column '{col_name}' not found!")
            print(f"Available: {list(df.columns)}")
            sys.exit(1)
    else:
        col_name = auto_detect_id_column(df)
        print(f"  ✓ Auto-detected ID column: '{col_name}'")

    root_ids = df[col_name].astype(str).tolist()
    print(f"  ✓ Found {len(root_ids)} IDs\n")

    # Step 2: Update IDs (optional)
    if args.update_ids:
        print("Step 2: Updating IDs to latest versions...")
        update_results = update_root_ids(root_ids, args.datastack)

        df[f'{col_name}_updated'] = [r['new_id'] for r in update_results]
        df[f'{col_name}_changed'] = [r['changed'] for r in update_results]

        changed_count = sum(1 for r in update_results if r['changed'])
        print(f"  ✓ {changed_count}/{len(update_results)} IDs updated\n")

        root_ids = [r['new_id'] if r['new_id'] else r['old_id'] for r in update_results]
    else:
        print("Step 2: Skipped (use --update-ids to enable)\n")

    # Step 3: Get coordinates
    print(f"Step 3: Fetching coordinates (method: {args.method})...")
    coords_list = root_to_coords(root_ids, args.datastack, method=args.method)

    df['coord_x'] = [c[0] if c else None for c in coords_list]
    df['coord_y'] = [c[1] if c else None for c in coords_list]
    df['coord_z'] = [c[2] if c else None for c in coords_list]

    valid_count = sum(1 for c in coords_list if c is not None)
    print(f"  ✓ Got coordinates for {valid_count}/{len(coords_list)} IDs\n")

    # Step 4: Create NEW worksheet with results
    print("Step 4: Creating NEW worksheet with results...")

    # Generate output worksheet name
    if args.output_name:
        output_name = args.output_name
    else:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M")
        output_name = f"Coords_{timestamp}"

    try:
        # Get spreadsheet
        client = get_sheets_client(args.creds)

        if "docs.google.com" in args.sheet:
            sheet_id = args.sheet.split("/d/")[1].split("/")[0]
        else:
            sheet_id = args.sheet

        spreadsheet = client.open_by_key(sheet_id)

        # Create new worksheet
        try:
            new_worksheet = spreadsheet.add_worksheet(
                title=output_name,
                rows=len(df) + 1,
                cols=len(df.columns)
            )
        except gspread.exceptions.APIError as e:
            if "already exists" in str(e):
                print(f"  ! Worksheet '{output_name}' exists, using unique name...")
                output_name = f"{output_name}_{datetime.now().strftime('%H%M%S')}"
                new_worksheet = spreadsheet.add_worksheet(
                    title=output_name,
                    rows=len(df) + 1,
                    cols=len(df.columns)
                )
            else:
                raise

        # Write data to new worksheet
        from gspread_dataframe import set_with_dataframe
        set_with_dataframe(new_worksheet, df, include_index=False, resize=True)

        print(f"  ✓ Created new worksheet: '{output_name}'")
        print(f"  ✓ Original sheet unchanged!")

        # Get URL to new worksheet
        new_url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/edit#gid={new_worksheet.id}"
        print(f"\n📊 View results: {new_url}\n")

    except Exception as e:
        print(f"  ✗ Error creating worksheet: {e}")
        sys.exit(1)

    print("="*60)
    print("✅ COMPLETE - Original data safe, results in new tab!")
    print("="*60)


if __name__ == "__main__":
    main()
