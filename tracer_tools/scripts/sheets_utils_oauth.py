#!/usr/bin/env python3
"""
Google Sheets OAuth utilities - uses YOUR personal Google account.
"""

import gspread
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
import pickle
from pathlib import Path

SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file'
]

def get_oauth_client():
    """Get authenticated client using OAuth (your personal account)."""

    creds = None
    token_file = Path.home() / '.tracer_tools_token.pickle'

    # Load existing token
    if token_file.exists():
        with open(token_file, 'rb') as token:
            creds = pickle.load(token)

    # Refresh or get new token
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            # First time - will open browser
            print("Opening browser for authorization...")
            print("This only happens once - token will be saved.")
            flow = InstalledAppFlow.from_client_secrets_file(
                'google_credentials.json', SCOPES)
            creds = flow.run_local_server(port=0)

        # Save token for next time
        with open(token_file, 'wb') as token:
            pickle.dump(creds, token)

    return gspread.authorize(creds)
