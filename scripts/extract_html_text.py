#!/usr/bin/env python3
"""Extract readable text from HTML files for documentation review."""

import re
import sys
from pathlib import Path
from html.parser import HTMLParser

class HTMLTextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.text = []
        self.skip_tags = {'style', 'script', 'head'}
        self.current_skip = False

    def handle_starttag(self, tag, attrs):
        if tag.lower() in self.skip_tags:
            self.current_skip = True
        if tag.lower() in ('p', 'div', 'br', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'tr'):
            self.text.append('\n')

    def handle_endtag(self, tag):
        if tag.lower() in self.skip_tags:
            self.current_skip = False
        if tag.lower() in ('p', 'div', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'):
            self.text.append('\n')

    def handle_data(self, data):
        if not self.current_skip:
            self.text.append(data)

    def get_text(self):
        return ''.join(self.text)

def extract_text(html_path, start_char=0, length=10000):
    """Extract text from HTML file."""
    with open(html_path, 'r', encoding='utf-8') as f:
        html = f.read()

    parser = HTMLTextExtractor()
    parser.feed(html)
    text = parser.get_text()

    # Clean up whitespace
    text = re.sub(r'\n\s*\n', '\n\n', text)
    text = re.sub(r' +', ' ', text)
    text = text.strip()

    # Return specified portion
    return text[start_char:start_char + length]

if __name__ == '__main__':
    import sys
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

    if len(sys.argv) < 2:
        print("Usage: python extract_html_text.py <file.html> [start] [length]")
        sys.exit(1)

    file_path = sys.argv[1]
    start = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    length = int(sys.argv[3]) if len(sys.argv) > 3 else 10000

    print(extract_text(file_path, start, length))
