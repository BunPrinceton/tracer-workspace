#!/usr/bin/env python3
"""
Test Google Sheets connection.

Usage:
    python test_sheets_connection.py
    python test_sheets_connection.py --creds /path/to/credentials.json
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from sheets_utils import get_sheets_client


def main():
    parser = argparse.ArgumentParser(description="Test Google Sheets connection")
    parser.add_argument("--creds", default=None,
                        help="Path to Google credentials JSON")
    args = parser.parse_args()

    print("="*60)
    print("Testing Google Sheets Connection")
    print("="*60 + "\n")

    print("Attempting to authenticate...")

    try:
        client = get_sheets_client(args.creds)
        print("✓ Authentication successful!\n")

        print("Listing your accessible spreadsheets (first 5):")
        sheets = client.openall()

        if sheets:
            for i, sheet in enumerate(sheets[:5], 1):
                print(f"  {i}. {sheet.title} (ID: {sheet.id})")
            print(f"\n  ... and {len(sheets) - 5} more" if len(sheets) > 5 else "")
        else:
            print("  No spreadsheets found.")
            print("  (If using service account, remember to share sheets with it)")

        print("\n" + "="*60)
        print("Connection test PASSED ✓")
        print("="*60)

    except FileNotFoundError as e:
        print("✗ No credentials found!\n")
        print("Please set up Google Sheets credentials first.")
        print("See GOOGLE_SHEETS_SETUP.md for instructions.\n")
        print("Quick start:")
        print("1. Go to https://console.cloud.google.com/")
        print("2. Create service account")
        print("3. Download JSON key")
        print("4. Save as: google_credentials.json")
        sys.exit(1)

    except Exception as e:
        print(f"✗ Authentication failed: {e}\n")
        print("Common issues:")
        print("- Invalid credentials file")
        print("- Expired OAuth token")
        print("- Missing Google Sheets API enabled")
        sys.exit(1)


if __name__ == "__main__":
    main()
