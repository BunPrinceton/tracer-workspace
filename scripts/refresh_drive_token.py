#!/usr/bin/env python
"""Refresh the Google Drive OAuth token (scripts/drive_token.json).

The old token expired and its refresh token was revoked (invalid_grant), so a
fresh interactive sign-in is required. This reuses the client_id/client_secret
already stored in drive_token.json — no separate credentials.json needed.

RUN THIS YOURSELF (it opens a browser for Google sign-in):
    python scripts/refresh_drive_token.py

Sign in with the Google account that has access to the shared Drive folders.
On success it overwrites scripts/drive_token.json with a working token.

Note: if the OAuth consent screen is still in "Testing" mode, Google expires
the refresh token after 7 days — you'll need to re-run this weekly. To make it
durable, publish the OAuth app in Google Cloud Console (or we keep using the
already-authenticated MCP Drive tools instead).
"""
import json
from pathlib import Path
from google_auth_oauthlib.flow import InstalledAppFlow

HERE = Path(__file__).resolve().parent
TOKEN = HERE / "drive_token.json"
SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]

def main():
    if not TOKEN.exists():
        raise SystemExit(f"No token file at {TOKEN} to read client credentials from.")
    old = json.load(open(TOKEN))
    cid, csec = old.get("client_id"), old.get("client_secret")
    if not (cid and csec):
        raise SystemExit("client_id/client_secret missing from drive_token.json; "
                         "download a fresh OAuth client 'credentials.json' instead.")
    client_config = {
        "installed": {
            "client_id": cid,
            "client_secret": csec,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": ["http://localhost"],
        }
    }
    flow = InstalledAppFlow.from_client_config(client_config, SCOPES)
    print("A browser window will open for Google sign-in...")
    creds = flow.run_local_server(port=0)
    TOKEN.write_text(creds.to_json())
    print(f"\n[OK] Fresh token written to {TOKEN}")
    print("You can now re-run the image downloader.")

if __name__ == "__main__":
    main()
