#!/usr/bin/env python3
"""
Google Sheets utilities for tracer_tools.

Handles authentication and basic read/write operations.
"""

import gspread
from gspread_dataframe import set_with_dataframe, get_as_dataframe
import pandas as pd
import os
from pathlib import Path


def get_sheets_client(credentials_path=None):
    """
    Get authenticated gspread client.

    Arguments:
    credentials_path -- path to service account JSON or OAuth credentials (str, optional)
                       defaults to ./google_credentials.json

    Returns:
    client -- authenticated gspread client
    """
    if credentials_path is None:
        # Try default locations
        default_paths = [
            Path(__file__).parent.parent / "google_credentials.json",
            Path.home() / ".config" / "gspread" / "credentials.json",
            Path.home() / "google_credentials.json",
        ]

        for path in default_paths:
            if path.exists():
                credentials_path = str(path)
                break

        if credentials_path is None:
            raise FileNotFoundError(
                "No Google credentials found. Please set up credentials first.\n"
                "See GOOGLE_SHEETS_SETUP.md for instructions."
            )

    # Authenticate based on credential type
    try:
        # Try service account first
        client = gspread.service_account(filename=credentials_path)
        return client
    except Exception as e:
        try:
            # Fall back to OAuth
            client = gspread.oauth(credentials_filename=credentials_path)
            return client
        except Exception as e2:
            raise Exception(
                f"Failed to authenticate with Google Sheets.\n"
                f"Service account error: {e}\n"
                f"OAuth error: {e2}"
            )


def open_sheet(sheet_id_or_url, worksheet_name=None, credentials_path=None):
    """
    Open a Google Sheet by ID or URL.

    Arguments:
    sheet_id_or_url -- Sheet ID or full URL (str)
    worksheet_name -- specific worksheet/tab name (str, optional, defaults to first sheet)
    credentials_path -- path to credentials (str, optional)

    Returns:
    worksheet -- gspread worksheet object
    """
    client = get_sheets_client(credentials_path)

    # Extract sheet ID from URL if needed
    if "docs.google.com" in sheet_id_or_url:
        sheet_id = sheet_id_or_url.split("/d/")[1].split("/")[0]
    else:
        sheet_id = sheet_id_or_url

    spreadsheet = client.open_by_key(sheet_id)

    if worksheet_name:
        worksheet = spreadsheet.worksheet(worksheet_name)
    else:
        worksheet = spreadsheet.sheet1  # First sheet

    return worksheet


def read_sheet_to_dataframe(sheet_id_or_url, worksheet_name=None, credentials_path=None):
    """
    Read a Google Sheet into a pandas DataFrame.

    Arguments:
    sheet_id_or_url -- Sheet ID or URL (str)
    worksheet_name -- worksheet name (str, optional)
    credentials_path -- credentials path (str, optional)

    Returns:
    df -- pandas DataFrame
    """
    worksheet = open_sheet(sheet_id_or_url, worksheet_name, credentials_path)
    df = get_as_dataframe(worksheet, evaluate_formulas=True)

    # Clean up empty rows/columns
    df = df.dropna(how='all', axis=0)  # Remove empty rows
    df = df.dropna(how='all', axis=1)  # Remove empty columns

    return df


def write_dataframe_to_sheet(df, sheet_id_or_url, worksheet_name=None,
                             credentials_path=None, resize=True, include_index=False):
    """
    Write a pandas DataFrame to a Google Sheet.

    Arguments:
    df -- pandas DataFrame to write
    sheet_id_or_url -- Sheet ID or URL (str)
    worksheet_name -- worksheet name (str, optional)
    credentials_path -- credentials path (str, optional)
    resize -- whether to resize sheet to fit data (bool, default True)
    include_index -- include DataFrame index (bool, default False)

    Returns:
    None
    """
    worksheet = open_sheet(sheet_id_or_url, worksheet_name, credentials_path)

    set_with_dataframe(
        worksheet,
        df,
        include_index=include_index,
        resize=resize
    )

    print(f"Successfully wrote {len(df)} rows to sheet")


def append_rows_to_sheet(rows, sheet_id_or_url, worksheet_name=None, credentials_path=None):
    """
    Append rows to the end of a Google Sheet.

    Arguments:
    rows -- list of lists, each inner list is a row (list of lists)
    sheet_id_or_url -- Sheet ID or URL (str)
    worksheet_name -- worksheet name (str, optional)
    credentials_path -- credentials path (str, optional)

    Returns:
    None
    """
    worksheet = open_sheet(sheet_id_or_url, worksheet_name, credentials_path)
    worksheet.append_rows(rows)
    print(f"Successfully appended {len(rows)} rows")


def get_column_values(sheet_id_or_url, column_name, worksheet_name=None, credentials_path=None):
    """
    Get all values from a specific column by name.

    Arguments:
    sheet_id_or_url -- Sheet ID or URL (str)
    column_name -- name of column header (str)
    worksheet_name -- worksheet name (str, optional)
    credentials_path -- credentials path (str, optional)

    Returns:
    values -- list of column values (list)
    """
    df = read_sheet_to_dataframe(sheet_id_or_url, worksheet_name, credentials_path)

    if column_name not in df.columns:
        raise ValueError(f"Column '{column_name}' not found. Available: {list(df.columns)}")

    return df[column_name].tolist()


def add_columns_to_sheet(sheet_id_or_url, new_columns_dict, worksheet_name=None,
                         credentials_path=None):
    """
    Add new columns to existing sheet without overwriting data.

    Arguments:
    sheet_id_or_url -- Sheet ID or URL (str)
    new_columns_dict -- dict mapping column names to lists of values (dict)
                       Example: {'coord_x': [1, 2, 3], 'coord_y': [4, 5, 6]}
    worksheet_name -- worksheet name (str, optional)
    credentials_path -- credentials path (str, optional)

    Returns:
    None
    """
    # Read existing data
    df = read_sheet_to_dataframe(sheet_id_or_url, worksheet_name, credentials_path)

    # Add new columns
    for col_name, values in new_columns_dict.items():
        df[col_name] = values

    # Write back
    write_dataframe_to_sheet(df, sheet_id_or_url, worksheet_name, credentials_path)
