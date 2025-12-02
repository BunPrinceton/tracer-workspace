#!/usr/bin/env python3
"""
Merge multiple Google Sheets into one combined spreadsheet.
Useful for combining parallel batch outputs.
"""

import argparse
import sys
from pathlib import Path
from datetime import datetime
import gspread

sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))

import pandas as pd

# Template spreadsheet to copy formatting from
TEMPLATE_SHEET_ID = "12qR0Mx0kEPYXAoNqpffDb93eALfNA2UdbmTtIDHML5E"


def main():
    parser = argparse.ArgumentParser(description='Merge multiple Google Sheets into one')
    parser.add_argument("--sheets", "-s", nargs='+', required=True,
                        help="List of sheet IDs or URLs to merge")
    parser.add_argument("--output-name", "-o", default=None,
                        help="Name for the merged output spreadsheet")

    args = parser.parse_args()

    print("="*60)
    print("Merging Multiple Sheets → One Combined Spreadsheet")
    print("="*60)
    print(f"Merging {len(args.sheets)} sheets...")
    print("="*60 + "\n")

    # Connect to Google Sheets
    print("Step 1: Connecting to Google Sheets...")
    gc = gspread.oauth()
    print("  ✓ Connected\n")

    # Read all sheets and combine
    print("Step 2: Reading all sheets...")
    all_dfs = []

    for i, sheet_input in enumerate(args.sheets, 1):
        # Extract sheet ID from URL if needed
        if "docs.google.com" in sheet_input:
            sheet_id = sheet_input.split("/d/")[1].split("/")[0]
        else:
            sheet_id = sheet_input

        print(f"  Reading sheet {i}/{len(args.sheets)}...")

        try:
            spreadsheet = gc.open_by_key(sheet_id)
            worksheet = spreadsheet.sheet1

            # Get all values
            all_values = worksheet.get_all_values()

            # First sheet: include headers
            if i == 1:
                df = pd.DataFrame(all_values[1:], columns=all_values[0])
            else:
                # Subsequent sheets: skip header row, use first sheet's headers
                df = pd.DataFrame(all_values[1:], columns=all_dfs[0].columns)

            # Remove completely empty rows
            df = df.replace('', pd.NA).dropna(how='all', axis=0)

            all_dfs.append(df)
            print(f"    ✓ Got {len(df)} rows from sheet {i}")

        except Exception as e:
            print(f"    ✗ Error reading sheet {i}: {e}")
            continue

    if not all_dfs:
        print("\n✗ No sheets could be read. Exiting.")
        return

    # Combine all dataframes
    print(f"\nStep 3: Combining {len(all_dfs)} sheets...")
    combined_df = pd.concat(all_dfs, ignore_index=True)
    print(f"  ✓ Combined into {len(combined_df)} total rows\n")

    # Create new spreadsheet from template
    print("Step 4: Creating merged spreadsheet from template...")

    output_name = args.output_name or f"Merged_{len(args.sheets)}_sheets_{datetime.now().strftime('%Y%m%d_%H%M')}"

    # Copy the template
    template = gc.open_by_key(TEMPLATE_SHEET_ID)
    new_spreadsheet = gc.copy(template.id, title=output_name)
    new_ws = new_spreadsheet.sheet1

    # Clear existing data rows (keep header row)
    if new_ws.row_count > 1:
        max_col_letter = chr(64 + new_ws.col_count) if new_ws.col_count <= 26 else 'ZZ'
        range_to_clear = f'A2:{max_col_letter}{new_ws.row_count}'
        new_ws.batch_clear([range_to_clear])

    # Write headers
    headers = combined_df.columns.tolist()
    end_col_letter = chr(64 + len(headers)) if len(headers) <= 26 else 'ZZ'
    new_ws.update(values=[headers], range_name=f'A1:{end_col_letter}1', value_input_option='USER_ENTERED')

    # Convert URLs in Final Link column to HYPERLINK formulas
    if 'Final Link' in combined_df.columns:
        link_col_idx = combined_df.columns.get_loc('Final Link')
        for idx in range(len(combined_df)):
            link_value = combined_df.iloc[idx, link_col_idx]
            if link_value and str(link_value).startswith('http'):
                combined_df.iloc[idx, link_col_idx] = f'=HYPERLINK("{link_value}", "{link_value}")'

    # Write all data in one batch
    data_values = combined_df.fillna('').values.tolist()
    range_name = f'A2:{end_col_letter}{len(data_values) + 1}'
    new_ws.update(values=data_values, range_name=range_name, value_input_option='USER_ENTERED')

    print(f"  ✓ Wrote {len(combined_df)} rows to new spreadsheet\n")

    # Apply formatting
    print("Step 5: Applying formatting (batched)...")

    # Add link template to Data column in row 2 as clickable hyperlink
    if 'Data' in combined_df.columns:
        data_col_idx = list(combined_df.columns).index('Data') + 1
        data_col_letter = chr(64 + data_col_idx) if data_col_idx <= 26 else 'ZZ'
        link_url = "https://spelunker.cave-explorer.org/#!middleauth+https://global.daf-apis.com/nglstate/api/v1/5286937834291200"
        new_ws.update_cell(2, data_col_idx, f'=HYPERLINK("{link_url}", "Link")')

    format_requests = []

    # Format Coordinates column as text
    if 'Coordinates' in combined_df.columns:
        col_idx = list(combined_df.columns).index('Coordinates') + 1
        if col_idx <= 26:
            col_letter = chr(64 + col_idx)
        else:
            col_letter = chr(64 + (col_idx - 1) // 26) + chr(64 + ((col_idx - 1) % 26) + 1)
        format_requests.append({
            "range": f'{col_letter}:{col_letter}',
            "format": {"numberFormat": {"type": "TEXT"}}
        })

    # Remove bold from row 2
    format_requests.append({
        "range": '2:2',
        "format": {"textFormat": {"bold": False}}
    })

    # Format Final Link column as hyperlinks
    if 'Final Link' in combined_df.columns:
        link_col_idx = list(combined_df.columns).index('Final Link') + 1
        link_col_letter = chr(64 + link_col_idx) if link_col_idx <= 26 else 'ZZ'
        format_requests.append({
            "range": f'{link_col_letter}:{link_col_letter}',
            "format": {"hyperlinkDisplayType": "LINKED"}
        })

    # Add conditional highlighting if ID Changed and Coords Updated columns exist
    if 'ID Changed' in combined_df.columns and 'Coords Updated' in combined_df.columns:
        col_name = combined_df.columns[0]  # Assume first column is root_id
        root_id_col = list(combined_df.columns).index(col_name) + 1
        coords_col = list(combined_df.columns).index('Coordinates') + 1
        root_id_letter = chr(64 + root_id_col)
        coords_letter = chr(64 + coords_col)

        for row_idx, row in combined_df.iterrows():
            row_num = row_idx + 2  # +2 because row 1 is header, row_idx is 0-based

            # Convert to proper boolean (handle string values)
            id_changed = str(row['ID Changed']).lower() in ['true', '1', 'yes']
            coords_updated = str(row['Coords Updated']).lower() in ['true', '1', 'yes']

            if not id_changed and not coords_updated:
                # Red: both not updated
                format_requests.append({
                    "range": f'{root_id_letter}{row_num}',
                    "format": {"backgroundColor": {"red": 1.0, "green": 0.6, "blue": 0.6}}
                })
                format_requests.append({
                    "range": f'{coords_letter}{row_num}',
                    "format": {"backgroundColor": {"red": 1.0, "green": 0.6, "blue": 0.6}}
                })
            elif not id_changed or not coords_updated:
                # Orange: either not updated
                if not id_changed:
                    format_requests.append({
                        "range": f'{root_id_letter}{row_num}',
                        "format": {"backgroundColor": {"red": 1.0, "green": 0.8, "blue": 0.6}}
                    })
                if not coords_updated:
                    format_requests.append({
                        "range": f'{coords_letter}{row_num}',
                        "format": {"backgroundColor": {"red": 1.0, "green": 0.8, "blue": 0.6}}
                    })

    # Apply all formatting in one batch
    if format_requests:
        new_ws.batch_format(format_requests)
        print(f"  ✓ Applied {len(format_requests)} format rules in 1 API call\n")

    url = new_spreadsheet.url

    print(f"  ✓ Created: '{output_name}'")
    print(f"\n📊 {url}\n")
    print("="*60)
    print(f"✅ DONE! Merged {len(args.sheets)} sheets into one with {len(combined_df)} total rows")
    print("="*60)


if __name__ == "__main__":
    main()
