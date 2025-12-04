#!/usr/bin/env python3
"""
Create a Google Doc with formatted content.

Requirements:
    pip install google-auth google-auth-oauthlib google-api-python-client

Usage:
    python create_google_doc.py --title "My Document" --html content.html
    python create_google_doc.py --title "My Document" --html content.html --folder FOLDER_ID
"""

import argparse
import sys
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# Need write access for creating docs
SCOPES = [
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/drive.file',
]

# Token file for write access (separate from read-only token)
TOKEN_FILE = 'drive_token_write.json'


def get_credentials(creds_path: Path, token_path: Path):
    """Get or refresh OAuth credentials with write access."""
    creds = None

    if token_path.exists():
        creds = Credentials.from_authorized_user_file(str(token_path), SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            print("  Refreshing expired token...")
            creds.refresh(Request())
        else:
            if not creds_path.exists():
                print(f"\n[ERR] credentials.json not found at {creds_path}")
                sys.exit(1)

            print("\n[AUTH] Opening browser for Google authorization...")
            print("   (This will request WRITE access to create documents)\n")
            flow = InstalledAppFlow.from_client_secrets_file(str(creds_path), SCOPES)
            creds = flow.run_local_server(port=0)

        with open(token_path, 'w') as f:
            f.write(creds.to_json())
        print(f"  [OK] Token saved to {token_path}")

    return creds


def html_to_docs_requests(html_content: str) -> list:
    """
    Convert simple HTML to Google Docs API requests.

    Handles: h1, h2, h3, p, ul/li, strong, em, code, hr
    """
    import re
    from html.parser import HTMLParser

    requests = []
    current_index = 1  # Docs index starts at 1

    class SimpleHTMLParser(HTMLParser):
        def __init__(self):
            super().__init__()
            self.requests = []
            self.current_index = 1
            self.text_buffer = ""
            self.style_stack = []
            self.in_list = False
            self.list_items = []

        def flush_text(self, style=None, heading=None):
            if not self.text_buffer.strip():
                self.text_buffer = ""
                return

            text = self.text_buffer + "\n"
            self.text_buffer = ""

            # Insert text
            self.requests.append({
                'insertText': {
                    'location': {'index': self.current_index},
                    'text': text
                }
            })

            text_len = len(text)

            # Apply heading style
            if heading:
                self.requests.append({
                    'updateParagraphStyle': {
                        'range': {
                            'startIndex': self.current_index,
                            'endIndex': self.current_index + text_len
                        },
                        'paragraphStyle': {
                            'namedStyleType': heading
                        },
                        'fields': 'namedStyleType'
                    }
                })

            # Apply text styling
            if style:
                style_update = {'range': {
                    'startIndex': self.current_index,
                    'endIndex': self.current_index + text_len - 1
                }}

                if style == 'bold':
                    style_update['textStyle'] = {'bold': True}
                    style_update['fields'] = 'bold'
                elif style == 'italic':
                    style_update['textStyle'] = {'italic': True}
                    style_update['fields'] = 'italic'
                elif style == 'code':
                    style_update['textStyle'] = {
                        'fontFamily': 'Courier New',
                        'backgroundColor': {'color': {'rgbColor': {'red': 0.95, 'green': 0.95, 'blue': 0.95}}}
                    }
                    style_update['fields'] = 'fontFamily,backgroundColor'

                self.requests.append({'updateTextStyle': style_update})

            self.current_index += text_len

        def handle_starttag(self, tag, attrs):
            tag = tag.lower()

            if tag in ['h1', 'h2', 'h3']:
                self.flush_text()
                self.style_stack.append(('heading', tag.upper()))
            elif tag == 'p':
                self.flush_text()
            elif tag in ['strong', 'b']:
                self.style_stack.append(('style', 'bold'))
            elif tag in ['em', 'i']:
                self.style_stack.append(('style', 'italic'))
            elif tag == 'code':
                self.style_stack.append(('style', 'code'))
            elif tag == 'ul':
                self.flush_text()
                self.in_list = True
            elif tag == 'li':
                self.text_buffer = "  - "
            elif tag == 'hr':
                self.flush_text()
                self.text_buffer = "─" * 50
                self.flush_text()
            elif tag == 'br':
                self.text_buffer += "\n"

        def handle_endtag(self, tag):
            tag = tag.lower()

            if tag in ['h1', 'h2', 'h3']:
                heading_map = {'H1': 'HEADING_1', 'H2': 'HEADING_2', 'H3': 'HEADING_3'}
                if self.style_stack and self.style_stack[-1][0] == 'heading':
                    _, h = self.style_stack.pop()
                    self.flush_text(heading=heading_map.get(h, 'NORMAL_TEXT'))
            elif tag == 'p':
                self.flush_text()
            elif tag in ['strong', 'b', 'em', 'i', 'code']:
                if self.style_stack and self.style_stack[-1][0] == 'style':
                    _, style = self.style_stack.pop()
                    # For inline styles, we'd need more complex handling
                    # For now, just continue
            elif tag == 'ul':
                self.flush_text()
                self.in_list = False
            elif tag == 'li':
                self.flush_text()

        def handle_data(self, data):
            # Clean up whitespace
            data = ' '.join(data.split())
            if data:
                self.text_buffer += data

        def get_requests(self):
            self.flush_text()  # Flush any remaining text
            return self.requests

    parser = SimpleHTMLParser()
    parser.feed(html_content)
    return parser.get_requests()


def create_doc_simple(docs_service, drive_service, title: str, content: str, folder_id: str = None) -> str:
    """
    Create a Google Doc with plain text content.
    Returns the document URL.
    """
    # Create empty document
    doc = docs_service.documents().create(body={'title': title}).execute()
    doc_id = doc.get('documentId')

    print(f"  [OK] Created document: {doc_id}")

    # Insert content
    if content.strip():
        requests = [{
            'insertText': {
                'location': {'index': 1},
                'text': content
            }
        }]

        docs_service.documents().batchUpdate(
            documentId=doc_id,
            body={'requests': requests}
        ).execute()

        print(f"  [OK] Inserted content")

    # Move to folder if specified
    if folder_id:
        file = drive_service.files().get(fileId=doc_id, fields='parents').execute()
        previous_parents = ",".join(file.get('parents', []))

        drive_service.files().update(
            fileId=doc_id,
            addParents=folder_id,
            removeParents=previous_parents,
            fields='id, parents'
        ).execute()

        print(f"  [OK] Moved to folder: {folder_id}")

    return f"https://docs.google.com/document/d/{doc_id}/edit"


def create_doc_from_html(docs_service, drive_service, title: str, html_path: Path, folder_id: str = None) -> str:
    """
    Create a Google Doc from HTML content with formatting.
    Returns the document URL.
    """
    # Read HTML
    with open(html_path, 'r', encoding='utf-8') as f:
        html_content = f.read()

    # Extract just the body content if full HTML
    import re
    body_match = re.search(r'<body[^>]*>(.*?)</body>', html_content, re.DOTALL | re.IGNORECASE)
    if body_match:
        html_content = body_match.group(1)

    # Create empty document
    doc = docs_service.documents().create(body={'title': title}).execute()
    doc_id = doc.get('documentId')

    print(f"  [OK] Created document: {doc_id}")

    # Convert HTML to Docs API requests
    requests = html_to_docs_requests(html_content)

    if requests:
        try:
            docs_service.documents().batchUpdate(
                documentId=doc_id,
                body={'requests': requests}
            ).execute()
            print(f"  [OK] Applied formatting ({len(requests)} operations)")
        except HttpError as e:
            print(f"  [WARN] Formatting error: {e}")
            # Fallback: just insert plain text
            from html.parser import HTMLParser

            class TextExtractor(HTMLParser):
                def __init__(self):
                    super().__init__()
                    self.text = []
                def handle_data(self, data):
                    self.text.append(data)
                def get_text(self):
                    return ''.join(self.text)

            extractor = TextExtractor()
            extractor.feed(html_content)
            plain_text = extractor.get_text()

            docs_service.documents().batchUpdate(
                documentId=doc_id,
                body={'requests': [{
                    'insertText': {
                        'location': {'index': 1},
                        'text': plain_text
                    }
                }]}
            ).execute()
            print(f"  [OK] Inserted plain text fallback")

    # Move to folder if specified
    if folder_id:
        file = drive_service.files().get(fileId=doc_id, fields='parents').execute()
        previous_parents = ",".join(file.get('parents', []))

        drive_service.files().update(
            fileId=doc_id,
            addParents=folder_id,
            removeParents=previous_parents,
            fields='id, parents'
        ).execute()

        print(f"  [OK] Moved to folder: {folder_id}")

    return f"https://docs.google.com/document/d/{doc_id}/edit"


def main():
    parser = argparse.ArgumentParser(description='Create a Google Doc')
    parser.add_argument('--title', '-t', required=True, help='Document title')
    parser.add_argument('--html', help='Path to HTML file to convert')
    parser.add_argument('--text', help='Plain text content (or path to .txt file)')
    parser.add_argument('--folder', '-f', help='Google Drive folder ID to place document in')
    parser.add_argument('--credentials', '-c', default='credentials.json', help='Path to credentials.json')

    args = parser.parse_args()

    if not args.html and not args.text:
        print("Error: Must provide either --html or --text")
        sys.exit(1)

    print("=" * 60)
    print("Google Docs Creator")
    print("=" * 60)
    print(f"Title: {args.title}")
    if args.html:
        print(f"HTML source: {args.html}")
    if args.folder:
        print(f"Folder: {args.folder}")
    print("=" * 60 + "\n")

    # Setup paths
    script_dir = Path(__file__).parent
    creds_path = Path(args.credentials)
    if not creds_path.is_absolute():
        creds_path = script_dir / creds_path
    token_path = script_dir / TOKEN_FILE

    # Authenticate
    print("Step 1: Authenticating...")
    creds = get_credentials(creds_path, token_path)

    docs_service = build('docs', 'v1', credentials=creds)
    drive_service = build('drive', 'v3', credentials=creds)
    print("  [OK] Authenticated\n")

    # Create document
    print("Step 2: Creating document...")

    if args.html:
        html_path = Path(args.html)
        if not html_path.exists():
            print(f"Error: HTML file not found: {html_path}")
            sys.exit(1)
        url = create_doc_from_html(docs_service, drive_service, args.title, html_path, args.folder)
    else:
        content = args.text
        if Path(content).exists():
            with open(content, 'r', encoding='utf-8') as f:
                content = f.read()
        url = create_doc_simple(docs_service, drive_service, args.title, content, args.folder)

    print("\n" + "=" * 60)
    print("SUCCESS!")
    print("=" * 60)
    print(f"\nDocument URL: {url}\n")

    return url


if __name__ == '__main__':
    main()
