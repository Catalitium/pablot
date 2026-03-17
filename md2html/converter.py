#!/usr/bin/env python3
"""
Markdown to HTML Converter with live preview
Simple static site generator for markdown files
"""
import argparse
import re
from pathlib import Path

class MarkdownConverter:
    def __init__(self):
        self.html = []
        self.in_code_block = False
        self.in_list = False
        self.in_table = False

    def convert(self, md: str) -> str:
        lines = md.split('\n')
        self.html = ['<article class="markdown">']

        for line in lines:
            line = line.rstrip()

            # Code blocks
            if line.startswith('```'):
                if self.in_code_block:
                    self.html.append('</code></pre>')
                    self.in_code_block = False
                else:
                    lang = line[3:].strip() or 'text'
                    self.html.append(f'<pre><code class="language-{lang}">')
                    self.in_code_block = True
                continue

            if self.in_code_block:
                self.html.append(line)
                continue

            # Headers
            if line.startswith('######'):
                self.html.append(f'<h6>{self.escape(line[7:])}</h6>')
            elif line.startswith('#####'):
                self.html.append(f'<h5>{self.escape(line[6:])}</h5>')
            elif line.startswith('####'):
                self.html.append(f'<h4>{self.escape(line[5:])}</h4>')
            elif line.startswith('###'):
                self.html.append(f'<h3>{self.escape(line[4:])}</h3>')
            elif line.startswith('##'):
                self.html.append(f'<h2>{self.escape(line[3:])}</h2>')
            elif line.startswith('#'):
                self.html.append(f'<h1>{self.escape(line[2:])}</h1>')

            # Horizontal rule
            elif re.match(r'^---+$', line) or re.match(r'^\*\*\*+$', line):
                self.html.append('<hr>')

            # Blockquote
            elif line.startswith('>'):
                self.html.append(f'<blockquote>{self.escape(line[2:])}</blockquote>')

            # Unordered list
            elif line.startswith(('- ', '* ', '+ ')):
                if not self.in_list:
                    self.html.append('<ul>')
                    self.in_list = True
                self.html.append(f'<li>{self.parse_inline(line[2:])}</li>')

            # Ordered list
            elif re.match(r'^\d+\.\s', line):
                if not self.in_list:
                    self.html.append('<ol>')
                    self.in_list = True
                self.html.append(f'<li>{self.parse_inline(re.sub(r"^\d+\.\s", "", line))}</li>')

            # Table
            elif '|' in line and re.search(r'\|[\s\-:|]+\|', line):
                cells = [c.strip() for c in line.split('|')[1:-1]]
                if all(re.match(r'^[:\-]+$', c) for c in cells):
                    self.html.append('</thead><tbody>')
                    self.in_table = True
                elif self.in_table:
                    self.html.append('<tr>')
                    for c in cells:
                        self.html.append(f'<td>{self.escape(c)}</td>')
                    self.html.append('</tr>')
                else:
                    self.html.append('<table><thead><tr>')
                    for c in cells:
                        self.html.append(f'<th>{self.escape(c)}</th>')
                    self.html.append('</tr></thead><tbody>')
                    self.in_table = True
                continue

            # Empty line
            elif not line:
                if self.in_list:
                    self.html.append('</ul>' if '<ol>' not in ''.join(self.html[-5:]) else '</ol>')
                    self.in_list = False
                if self.in_table:
                    self.html.append('</tbody></table>')
                    self.in_table = False
                continue

            # Paragraph
            else:
                self.html.append(f'<p>{self.parse_inline(line)}</p>')

        # Close open tags
        if self.in_list:
            self.html.append('</ul>' if '<ol>' not in ''.join(self.html[-5:]) else '</ol>')
        if self.in_table:
            self.html.append('</tbody></table>')

        self.html.append('</article>')
        return '\n'.join(self.html)

    def escape(self, text: str) -> str:
        return (text
            .replace('&', '&amp;')
            .replace('<', '&lt;')
            .replace('>', '&gt;')
            .replace('"', '&quot;'))

    def parse_inline(self, text: str) -> str:
        text = self.escape(text)

        # Bold
        text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
        text = re.sub(r'__(.+?)__', r'<strong>\1</strong>', text)

        # Italic
        text = re.sub(r'\*(.+?)\*', r'<em>\1</em>', text)
        text = re.sub(r'_(.+?)_', r'<em>\1</em>', text)

        # Code
        text = re.sub(r'`(.+?)`', r'<code>\1</code>', text)

        # Links
        text = re.sub(r'\[(.+?)\]\((.+?)\)', r'<a href="\2">\1</a>', text)

        # Images
        text = re.sub(r'!\[(.+?)\]\((.+?)\)', r'<img src="\2" alt="\1">', text)

        # Strikethrough
        text = re.sub(r'~~(.+?)~~', r'<del>\1</del>', text)

        return text

def wrap_html(content: str, title: str = "Document") -> str:
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 2rem; background: #fafafa; color: #333; }}
    .markdown {{ background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }}
    h1, h2, h3, h4, h5, h6 {{ margin-top: 1.5em; margin-bottom: 0.5em; color: #111; }}
    h1 {{ border-bottom: 2px solid #eee; padding-bottom: 0.3em; }}
    code {{ background: #f4f4f4; padding: 0.2em 0.4em; border-radius: 3px; font-family: 'SF Mono', monospace; font-size: 0.9em; }}
    pre {{ background: #1e1e1e; color: #d4d4d4; padding: 1rem; border-radius: 8px; overflow-x: auto; }}
    pre code {{ background: none; padding: 0; }}
    blockquote {{ border-left: 4px solid #ddd; margin: 0; padding-left: 1rem; color: #666; }}
    table {{ border-collapse: collapse; width: 100%; }}
    th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
    th {{ background: #f4f4f4; }}
    hr {{ border: none; border-top: 2px solid #eee; margin: 2rem 0; }}
    a {{ color: #0366d6; }}
    img {{ max-width: 100%; height: auto; }}
  </style>
</head>
<body>
{content}
</body>
</html>'''

def main():
    parser = argparse.ArgumentParser(description="Markdown to HTML Converter")
    parser.add_argument("input", nargs="?", help="Input markdown file")
    parser.add_argument("-o", "--output", help="Output HTML file")
    parser.add_argument("-s", "--standalone", action="store_true", help="Wrap in full HTML document")
    parser.add_argument("-t", "--title", default="Document", help="Document title")

    args = parser.parse_args()

    if args.input:
        md = Path(args.input).read_text(encoding='utf-8')
    else:
        md = input("Enter markdown (Ctrl+D to finish):\n")

    converter = MarkdownConverter()
    html = converter.convert(md)

    if args.standalone:
        html = wrap_html(html, args.title)

    if args.output:
        Path(args.output).write_text(html, encoding='utf-8')
        print(f"Converted to {args.output}")
    else:
        print(html)

if __name__ == "__main__":
    main()
