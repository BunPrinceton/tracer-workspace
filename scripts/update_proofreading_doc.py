#!/usr/bin/env python3
"""
Update the Proofreading Protocol Google Doc with new label and damage annotations.
"""

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from pathlib import Path

def update_doc():
    token_path = Path('D:/1337/tracer_docs/scripts/drive_token_write.json')
    creds = Credentials.from_authorized_user_file(str(token_path))
    docs_service = build('docs', 'v1', credentials=creds)

    doc_id = '1oYJEKp39S0D3LxwDcBfH-AaQLqtsVSqqeX-SJeMvLH8'

    # Get current document
    doc = docs_service.documents().get(documentId=doc_id).execute()

    # Extract all text to find positions
    full_text = ""
    for element in doc['body']['content']:
        if 'paragraph' in element:
            for elem in element['paragraph'].get('elements', []):
                if 'textRun' in elem:
                    full_text += elem['textRun'].get('content', '')

    requests = []

    # Replace all "identifiable" with "partially_proofread"
    search_text = "identifiable"
    replace_text = "partially_proofread"

    idx = 0
    while True:
        pos = full_text.find(search_text, idx)
        if pos == -1:
            break
        # +1 because Google Docs indices are 1-based
        requests.append({
            'replaceAllText': {
                'containsText': {
                    'text': search_text,
                    'matchCase': True
                },
                'replaceText': replace_text
            }
        })
        break  # replaceAllText does all at once

    # Find where to insert the damage annotations section
    # We'll add it after "Added to proofreading_notes table via banc-bot"
    insert_after = "Added to proofreading_notes table via banc-bot"
    insert_pos = full_text.find(insert_after)

    if insert_pos != -1:
        # Position after this text plus newline
        insert_index = insert_pos + len(insert_after) + 2  # +1 for 1-based, +1 for newline

        damage_text = """

Additional Labels (when applicable):
• soma_is_damaged — Damage to the nervous system has made it impossible to connect this segment with its soma
• arbor_is_damaged — Damage to the nervous system has made it impossible to complete the main arbor of this segment
"""
        requests.append({
            'insertText': {
                'location': {'index': insert_index},
                'text': damage_text
            }
        })

    # Also add to Recording Results section
    recording_insert = "Sheet tracking: Note which round"
    rec_pos = full_text.find(recording_insert)
    if rec_pos != -1:
        damage_recording = "If damaged: Also add soma_is_damaged or arbor_is_damaged as applicable\n"
        requests.append({
            'insertText': {
                'location': {'index': rec_pos + 1},
                'text': damage_recording
            }
        })

    if requests:
        docs_service.documents().batchUpdate(documentId=doc_id, body={'requests': requests}).execute()
        print(f"Applied {len(requests)} updates")

    print(f"Document URL: https://docs.google.com/document/d/{doc_id}/edit")


if __name__ == '__main__':
    update_doc()
