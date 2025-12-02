#!/usr/bin/env python3
"""Quick OAuth test - will open browser for you to authorize."""

import gspread

print("Opening browser for Google authorization...")
print("1. Browser will open")
print("2. Log in with YOUR Google account")
print("3. Click 'Allow'")
print("4. Token saved for future use\n")

try:
    gc = gspread.oauth()
    print("✓ Authorization successful!")

    print("\nYour accessible sheets:")
    sheets = gc.openall()
    for i, sheet in enumerate(sheets[:5], 1):
        print(f"  {i}. {sheet.title}")

    if len(sheets) > 5:
        print(f"  ... and {len(sheets)-5} more")

except Exception as e:
    print(f"Error: {e}")
