#!/usr/bin/env python3
"""
Get coords from Google Sheets using OAuth (your personal account).
SAFE: Creates NEW spreadsheet with results, never modifies source.
"""

import argparse
import sys
from pathlib import Path
from datetime import datetime
import gspread
from gspread_dataframe import set_with_dataframe

sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))

from tracer_tools.utils import root_to_coords, update_root_ids
import pandas as pd

# Template spreadsheet to copy formatting from
TEMPLATE_SHEET_ID = "12qR0Mx0kEPYXAoNqpffDb93eALfNA2UdbmTtIDHML5E"


def auto_detect_id_column(df):
    """Auto-detect column with segment IDs."""
    # Priority 1: Named with id/root
    for col in df.columns:
        if any(kw in col.lower() for kw in ['root', 'segment', 'id']):
            return col
    # Priority 2: First column
    return df.columns[0]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--sheet", "-s", required=True)
    parser.add_argument("--worksheet", "-w", default=None)
    parser.add_argument("--column", "-c", default=None)
    parser.add_argument("--datastack", "-d", default="brain_and_nerve_cord")
    parser.add_argument("--update-ids", "-u", action="store_true")
    parser.add_argument("--output-name", "-o", default=None)
    parser.add_argument("--limit", "-l", type=int, default=None,
                        help="Only process first N rows (for testing)")
    parser.add_argument("--offset", type=int, default=0,
                        help="Skip first N rows (for parallel processing)")

    args = parser.parse_args()

    print("="*60)
    print("Google Sheets → Coordinates → NEW Spreadsheet")
    print("="*60)
    print(f"Sheet: {args.sheet}")
    print(f"Datastack: {args.datastack}")
    if args.limit:
        print(f"TESTING: Only {args.limit} rows")
    print("="*60 + "\n")

    # Connect
    print("Step 1: Connecting to Google Sheets...")
    gc = gspread.oauth()

    if "docs.google.com" in args.sheet:
        sheet_id = args.sheet.split("/d/")[1].split("/")[0]
    else:
        sheet_id = args.sheet

    spreadsheet = gc.open_by_key(sheet_id)

    if args.worksheet:
        worksheet = spreadsheet.worksheet(args.worksheet)
    else:
        worksheet = spreadsheet.sheet1

    print(f"  ✓ Opened: {spreadsheet.title}")
    print(f"  ✓ Worksheet: {worksheet.title}\n")

    # Read data
    print("Step 2: Reading data...")
    all_values = worksheet.get_all_values()
    df = pd.DataFrame(all_values[1:], columns=all_values[0])

    # Remove empty rows/cols
    df = df.replace('', pd.NA).dropna(how='all', axis=0).dropna(how='all', axis=1)

    print(f"  ✓ Read {len(df)} rows\n")

    # Detect ID column
    if args.column:
        col_name = args.column
    else:
        col_name = auto_detect_id_column(df)
        print(f"  ✓ Auto-detected ID column: '{col_name}'\n")

    # Apply offset and limit for parallel processing
    if args.offset > 0:
        df = df.iloc[args.offset:]
        print(f"  ⚠ Skipped first {args.offset} rows (offset)\n")

    if args.limit:
        df = df.head(args.limit)
        print(f"  ⚠ Limited to {args.limit} rows\n")
        if args.offset > 0:
            print(f"  → Processing rows {args.offset} to {args.offset + args.limit}\n")

    # Filter to numeric IDs only (skip links/headers)
    df[col_name] = df[col_name].astype(str)
    df = df[df[col_name].str.match(r'^\d+$', na=False)]
    root_ids = df[col_name].tolist()

    print(f"  ✓ Filtered to {len(root_ids)} valid IDs\n")

    # Update IDs
    if args.update_ids:
        print("Step 3: Updating IDs...")
        results = update_root_ids(root_ids, args.datastack)

        # Replace old IDs with updated IDs in the root_id column
        updated_ids = [r['new_id'] if r['new_id'] else r['old_id'] for r in results]
        df[col_name] = updated_ids

        # Track which IDs changed
        df['ID Changed'] = [r['changed'] for r in results]
        changed = sum(1 for r in results if r['changed'])
        print(f"  ✓ {changed}/{len(results)} changed\n")

        # Use updated IDs for coordinate lookup
        root_ids = updated_ids
    else:
        print("Step 3: Skipped (use --update-ids)\n")

    # Get coords
    print("Step 4: Fetching coordinates...")

    # Save old coordinates for comparison
    old_coords = df['Coordinates'].tolist() if 'Coordinates' in df.columns else [None] * len(df)

    coords = root_to_coords(root_ids, args.datastack)

    # Format coordinates as "x,y,z" string for the Coordinates column
    # Replace the existing Coordinates column with new coords
    # Prefix with apostrophe to force text format in Google Sheets
    coord_strings = []
    coords_changed = []
    for i, c in enumerate(coords):
        if c:
            # Add leading apostrophe to force text format and preserve commas
            new_coord_str = f"'{c[0]},{c[1]},{c[2]}"
            coord_strings.append(new_coord_str)
            # Check if coordinates changed (compare without apostrophe)
            old_coord = str(old_coords[i]) if old_coords[i] else ""
            coords_changed.append(f"{c[0]},{c[1]},{c[2]}" != old_coord.replace("'", ""))
        else:
            coord_strings.append(None)
            coords_changed.append(False)

    df['Coordinates'] = coord_strings
    df['Coords Updated'] = coords_changed

    valid = sum(1 for c in coords if c)
    print(f"  ✓ Got {valid}/{len(coords)} coordinates\n")

    # Create NEW spreadsheet from template
    print("Step 5: Creating new spreadsheet from template...")

    output_name = args.output_name or f"Coords_{spreadsheet.title}_{datetime.now().strftime('%Y%m%d_%H%M')}"

    # Copy the template
    template = gc.open_by_key(TEMPLATE_SHEET_ID)
    new_spreadsheet = gc.copy(template.id, title=output_name)
    new_ws = new_spreadsheet.sheet1

    # Clear data rows but keep header row (row 1)
    # Clear from row 2 to end
    if new_ws.row_count > 1:
        max_col_letter = chr(64 + new_ws.col_count) if new_ws.col_count <= 26 else 'ZZ'
        range_to_clear = f'A2:{max_col_letter}{new_ws.row_count}'
        new_ws.batch_clear([range_to_clear])

    # Write headers for all columns (row 1)
    headers = df.columns.tolist()
    end_col_letter = chr(64 + len(headers)) if len(headers) <= 26 else 'ZZ'
    new_ws.update(values=[headers], range_name=f'A1:{end_col_letter}1', value_input_option='USER_ENTERED')

    # Convert URLs in Final Link column to HYPERLINK formulas
    if 'Final Link' in df.columns:
        link_col_idx = df.columns.get_loc('Final Link')
        for idx in range(len(df)):
            link_value = df.iloc[idx, link_col_idx]
            if link_value and str(link_value).startswith('http'):
                # Convert to HYPERLINK formula
                df.iloc[idx, link_col_idx] = f'=HYPERLINK("{link_value}", "{link_value}")'

    # Write new data starting at row 2 using batch update (fast for large datasets)
    # Convert dataframe to list of lists, replacing NA with empty string
    data_values = df.fillna('').values.tolist()

    # Update in one batch (much faster than cell-by-cell)
    # Note: new gspread API uses values first, then range_name
    range_name = f'A2:{end_col_letter}{len(data_values) + 1}'
    new_ws.update(values=data_values, range_name=range_name, value_input_option='USER_ENTERED')

    # Add link template to Data column in row 2 as clickable hyperlink
    if 'Data' in df.columns:
        data_col_idx = list(df.columns).index('Data') + 1
        data_col_letter = chr(64 + data_col_idx) if data_col_idx <= 26 else 'ZZ'
        # Use HYPERLINK formula to make "Link" clickable
        link_url = "https://spelunker.cave-explorer.org/#!middleauth+https://global.daf-apis.com/nglstate/api/v1/5286937834291200"
        new_ws.update_cell(2, data_col_idx, f'=HYPERLINK("{link_url}", "Link")')

    # Collect ALL formatting requests to batch them (avoid rate limits)
    print("  ✓ Applying all formatting (batched)...")
    format_requests = []

    # Format the Coordinates column as plain text (not numbers)
    if 'Coordinates' in df.columns:
        col_idx = list(df.columns).index('Coordinates') + 1
        if col_idx <= 26:
            col_letter = chr(64 + col_idx)
        else:
            col_letter = chr(64 + (col_idx - 1) // 26) + chr(64 + ((col_idx - 1) % 26) + 1)
        format_requests.append({
            "range": f'{col_letter}:{col_letter}',
            "format": {"numberFormat": {"type": "TEXT"}}
        })

    # Remove bold from row 2 (data rows should not be bold)
    format_requests.append({
        "range": '2:2',
        "format": {"textFormat": {"bold": False}}
    })

    # Format Final Link column to display URLs as hyperlinks
    if 'Final Link' in df.columns:
        link_col_idx = list(df.columns).index('Final Link') + 1
        link_col_letter = chr(64 + link_col_idx) if link_col_idx <= 26 else 'ZZ'
        format_requests.append({
            "range": f'{link_col_letter}:{link_col_letter}',
            "format": {"hyperlinkDisplayType": "LINKED"}
        })

    # Add conditional highlighting for cells with ID/Coords not updated
    if args.update_ids and 'ID Changed' in df.columns and 'Coords Updated' in df.columns:
        # Highlight cells in root_id and Coordinates columns based on update status
        root_id_col = list(df.columns).index(col_name) + 1
        coords_col = list(df.columns).index('Coordinates') + 1
        root_id_letter = chr(64 + root_id_col)
        coords_letter = chr(64 + coords_col)

        # Red: Both NOT updated (ID Changed = FALSE AND Coords Updated = FALSE)
        # Orange: Either not updated (XOR)
        for row_idx, row in df.iterrows():
            row_num = row_idx + 2  # +2 because row 1 is header, row_idx is 0-based
            if row['ID Changed'] == False and row['Coords Updated'] == False:
                # Highlight both root_id and Coordinates cells red
                format_requests.append({
                    "range": f'{root_id_letter}{row_num}',
                    "format": {"backgroundColor": {"red": 1.0, "green": 0.6, "blue": 0.6}}
                })
                format_requests.append({
                    "range": f'{coords_letter}{row_num}',
                    "format": {"backgroundColor": {"red": 1.0, "green": 0.6, "blue": 0.6}}
                })
            # Orange: Either not updated (XOR)
            elif row['ID Changed'] == False or row['Coords Updated'] == False:
                if row['ID Changed'] == False:
                    # Highlight root_id cell orange
                    format_requests.append({
                        "range": f'{root_id_letter}{row_num}',
                        "format": {"backgroundColor": {"red": 1.0, "green": 0.8, "blue": 0.6}}
                    })
                if row['Coords Updated'] == False:
                    # Highlight Coordinates cell orange
                    format_requests.append({
                        "range": f'{coords_letter}{row_num}',
                        "format": {"backgroundColor": {"red": 1.0, "green": 0.8, "blue": 0.6}}
                    })

    # Apply ALL formats in ONE batch API call
    if format_requests:
        new_ws.batch_format(format_requests)
        print(f"    Applied {len(format_requests)} format rules in 1 API call")

    url = new_spreadsheet.url

    print(f"  ✓ Created: '{output_name}'")
    print(f"  ✓ Template formatting applied, coordinates formatted as text")
    print(f"\n📊 {url}\n")
    print("="*60)
    print("✅ DONE! Source spreadsheet untouched, results in NEW spreadsheet")
    print("="*60)


if __name__ == "__main__":
    main()
