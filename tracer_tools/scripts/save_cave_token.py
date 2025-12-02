#!/usr/bin/env python3
"""
Save your CAVE authentication token.

After getting your token from https://global.daf-apis.com/auth/api/v1/create_token,
run this script and paste it when prompted.
"""

from caveclient import CAVEclient

print("=" * 60)
print("CAVE Token Setup")
print("=" * 60)
print("\nPaste your token from the browser:")
token = input("> ").strip()

# Initialize client and save token
client = CAVEclient(server_address="https://global.daf-apis.com")
client.auth.save_token(token=token)

print("\n✓ Token saved successfully!")
print("You can now access brain_and_nerve_cord datastack")
print("=" * 60)
