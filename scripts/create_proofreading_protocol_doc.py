#!/usr/bin/env python3
"""
Create Proofreading Protocol Google Doc with proper formatting.
Matches the style of the GT SOP document.
"""

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from pathlib import Path

# Colors from the template (RGB 0-1 scale)
COLORS = {
    'dark_blue': {'red': 0.17254902, 'green': 0.24313726, 'blue': 0.3137255},      # H1 text
    'medium_blue': {'red': 0.16078432, 'green': 0.5019608, 'blue': 0.7254902},     # H2 text
    'light_blue': {'red': 0.20392157, 'green': 0.59607846, 'blue': 0.85882354},    # H1 border
    'gray_border': {'red': 0.9254902, 'green': 0.9411765, 'blue': 0.94509804},     # H2 border
    'h3_gray': {'red': 0.20392157, 'green': 0.28627452, 'blue': 0.36862746},       # H3 text
    'green': {'red': 0.2, 'green': 0.66, 'blue': 0.33},                             # Round 1
    'orange': {'red': 1.0, 'green': 0.6, 'blue': 0.0},                              # Round 2
    'red': {'red': 0.95, 'green': 0.26, 'blue': 0.21},                              # Round 3
    'purple': {'red': 0.61, 'green': 0.15, 'blue': 0.69},                           # Mindset quote
}

def create_doc():
    # Load credentials
    token_path = Path('D:/1337/tracer_docs/scripts/drive_token_write.json')
    creds = Credentials.from_authorized_user_file(str(token_path))

    docs_service = build('docs', 'v1', credentials=creds)

    # Create empty document
    doc = docs_service.documents().create(body={
        'title': 'Proofreading Protocol: Three-Round Triage System'
    }).execute()
    doc_id = doc.get('documentId')
    print(f"Created document: {doc_id}")

    # Build content - we'll insert text then apply formatting
    content = """Proofreading Protocol: Three-Round Triage System
Three-Round Triage System

Label to Use
identifiable
Added to proofreading_notes table via banc-bot

Round 1: Quick Triage
Time: 2-3 minutes per cell

Goal
Identify cells that are clearly complete enough with no obvious major issues.

Mental Checklist
Does the backbone look continuous and reasonable?
Are there any glaring merger artifacts visible?
Does the arbor appear substantially complete?
No obvious broken/floating segments?

Decision
YES to all → Mark as identifiable, move on
ANY hesitation → Flag for Round 2

Do NOT
Hunt for small errors
Follow every branch tip
Second-guess yourself
Spend more than 3 minutes

Round 2: Focused Review
Time: 5-8 minutes MAX

Goal
Push as many flagged cells as possible into "proofread enough" category.

⏱️ TIME LIMIT IS HARD — Set a timer!

Only Look for These Three Dealbreakers
Bad merger — Obviously wrong segment fused to neuron
Tricky pathswap — Clear swap yielding worthwhile correction (>5% volume change)
Major missing segmentation — Cumulative missing volume ≥15-20% of total

Decision at 8 Minutes
Found a dealbreaker? → Flag for Round 3
No dealbreaker found? → Mark as identifiable, move on

Key Mindset
"Could there be more? Yes. Is this good enough? If I can't prove otherwise in 8 minutes, yes."

Round 3: Full Proofread
Time: Normal pace

For: Only cells that failed Rounds 1 and 2

Standard thorough proofreading at whatever pace is needed.

Workflow Summary
All Cells
↓ Round 1 (2-3 min)
Clear? → identifiable ✓
↓ Round 2 (5-8 min max)
No dealbreaker? → identifiable ✓
↓ Round 3 (full)
Thorough → backbone_proofread ✓

Recording Results
Passes Round 1 or 2: Add identifiable via banc-bot to proofreading_notes
Passes Round 3: Add backbone_proofread label
Sheet tracking: Note which round the cell passed in the shared sheet

Reference Examples
These passed quick review (~5 min each):
720575941462418643
720575941538701032
720575941613131181
720575941660072784

BANC Proofreading Protocol v1.0 | Updated December 2025
"""

    # Insert all content first
    requests = [{
        'insertText': {
            'location': {'index': 1},
            'text': content
        }
    }]

    docs_service.documents().batchUpdate(documentId=doc_id, body={'requests': requests}).execute()
    print("Inserted content")

    # Now apply formatting
    # Get the document to find indices
    doc = docs_service.documents().get(documentId=doc_id).execute()

    # Helper to find text position
    def find_text(text):
        for element in doc['body']['content']:
            if 'paragraph' in element:
                for elem in element['paragraph'].get('elements', []):
                    if 'textRun' in elem:
                        content = elem['textRun'].get('content', '')
                        if text in content:
                            start = elem['startIndex'] + content.index(text)
                            return start, start + len(text)
        return None, None

    format_requests = []

    # Title - H1 style with blue border
    title_start, title_end = 1, content.index('\n') + 1
    format_requests.append({
        'updateParagraphStyle': {
            'range': {'startIndex': title_start, 'endIndex': title_end},
            'paragraphStyle': {
                'namedStyleType': 'HEADING_1',
                'borderBottom': {
                    'color': {'color': {'rgbColor': COLORS['light_blue']}},
                    'width': {'magnitude': 2.25, 'unit': 'PT'},
                    'padding': {'magnitude': 7.5, 'unit': 'PT'},
                    'dashStyle': 'SOLID'
                }
            },
            'fields': 'namedStyleType,borderBottom'
        }
    })
    format_requests.append({
        'updateTextStyle': {
            'range': {'startIndex': title_start, 'endIndex': title_end - 1},
            'textStyle': {
                'bold': True,
                'fontSize': {'magnitude': 23, 'unit': 'PT'},
                'foregroundColor': {'color': {'rgbColor': COLORS['dark_blue']}}
            },
            'fields': 'bold,fontSize,foregroundColor'
        }
    })

    # H2 sections with gray underline
    h2_sections = [
        'Label to Use',
        'Round 1: Quick Triage',
        'Round 2: Focused Review',
        'Round 3: Full Proofread',
        'Workflow Summary',
        'Recording Results',
        'Reference Examples'
    ]

    for section in h2_sections:
        start, end = find_text(section)
        if start:
            # Find end of line
            line_end = content.index('\n', content.index(section)) + 2  # +1 for the character, +1 for 1-indexing
            format_requests.append({
                'updateParagraphStyle': {
                    'range': {'startIndex': start, 'endIndex': start + len(section) + 1},
                    'paragraphStyle': {
                        'namedStyleType': 'HEADING_2',
                        'borderBottom': {
                            'color': {'color': {'rgbColor': COLORS['gray_border']}},
                            'width': {'magnitude': 1.5, 'unit': 'PT'},
                            'padding': {'magnitude': 3.75, 'unit': 'PT'},
                            'dashStyle': 'SOLID'
                        }
                    },
                    'fields': 'namedStyleType,borderBottom'
                }
            })
            format_requests.append({
                'updateTextStyle': {
                    'range': {'startIndex': start, 'endIndex': start + len(section)},
                    'textStyle': {
                        'bold': True,
                        'fontSize': {'magnitude': 17, 'unit': 'PT'},
                        'foregroundColor': {'color': {'rgbColor': COLORS['medium_blue']}}
                    },
                    'fields': 'bold,fontSize,foregroundColor'
                }
            })

    # H3 sections
    h3_sections = ['Goal', 'Mental Checklist', 'Decision', 'Do NOT', 'Key Mindset',
                   'Only Look for These Three Dealbreakers', 'Decision at 8 Minutes']

    for section in h3_sections:
        start, end = find_text(section)
        if start:
            format_requests.append({
                'updateParagraphStyle': {
                    'range': {'startIndex': start, 'endIndex': start + len(section) + 1},
                    'paragraphStyle': {'namedStyleType': 'HEADING_3'},
                    'fields': 'namedStyleType'
                }
            })
            format_requests.append({
                'updateTextStyle': {
                    'range': {'startIndex': start, 'endIndex': start + len(section)},
                    'textStyle': {
                        'bold': True,
                        'fontSize': {'magnitude': 13, 'unit': 'PT'},
                        'foregroundColor': {'color': {'rgbColor': COLORS['h3_gray']}}
                    },
                    'fields': 'bold,fontSize,foregroundColor'
                }
            })

    # Make "identifiable" bold and styled
    text_to_bold = ['identifiable', 'backbone_proofread']
    for text in text_to_bold:
        idx = 0
        search_content = content
        while True:
            try:
                pos = search_content.index(text, idx)
                format_requests.append({
                    'updateTextStyle': {
                        'range': {'startIndex': pos + 1, 'endIndex': pos + 1 + len(text)},
                        'textStyle': {
                            'bold': True,
                            'backgroundColor': {'color': {'rgbColor': COLORS['green'] if text == 'identifiable' else COLORS['medium_blue']}}
                        },
                        'fields': 'bold,backgroundColor'
                    }
                })
                idx = pos + len(text)
            except ValueError:
                break

    # Apply formatting
    if format_requests:
        docs_service.documents().batchUpdate(documentId=doc_id, body={'requests': format_requests}).execute()
        print(f"Applied {len(format_requests)} formatting operations")

    url = f"https://docs.google.com/document/d/{doc_id}/edit"
    print(f"\nDocument URL: {url}")
    return url


if __name__ == '__main__':
    create_doc()
