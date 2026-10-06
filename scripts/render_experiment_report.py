#!/usr/bin/env python3
"""Markdown 正本から、同じ場所に実験レポートの HTML を生成する。

準備: python3 -m pip install -r scripts/requirements-report.txt
実行: python3 scripts/render_experiment_report.py docs/reports/<report>.md
"""

from __future__ import annotations

import argparse
import base64
import html
import mimetypes
import re
import unicodedata
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import quote, unquote, urlsplit

try:
    import mistune
except ImportError:
    raise SystemExit(
        "Markdown parser が必要です。"
        "python3 -m pip install -r scripts/requirements-report.txt を実行してください。"
    ) from None


class PlainText(HTMLParser):
    """見出し内の装飾を外し、タイトルと目次の表示をそろえる。"""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self.parts.append(data)

    @classmethod
    def from_html(cls, markup: str) -> str:
        parser = cls()
        parser.feed(markup)
        parser.close()
        return "".join(parser.parts)


class ReportRenderer(mistune.HTMLRenderer):
    def __init__(self, source: Path) -> None:
        super().__init__(escape=True)
        self.source = source
        self.headings: list[tuple[int, str, str]] = []
        self.used_ids: set[str] = set()

    def heading(self, text: str, level: int, **attrs: object) -> str:
        label = PlainText.from_html(text)
        slug = re.sub(r"[^\w\-]+", "-", unicodedata.normalize("NFKC", label)).strip("-")
        base = f"section-{slug or 'heading'}"
        anchor = base
        index = 2
        while anchor in self.used_ids:
            anchor = f"{base}-{index}"
            index += 1
        self.used_ids.add(anchor)
        self.headings.append((level, anchor, label))
        return super().heading(text, level, id=html.escape(anchor, quote=True))

    def image(self, text: str, url: str, title: str | None = None) -> str:
        parsed = urlsplit(url)
        if parsed.scheme or parsed.netloc:
            return super().image(text, url, title)

        # HTML を単体で開いても図が読めるよう、ローカル画像だけを埋め込む。
        image_path = self.source.parent / unquote(parsed.path)
        mime_type, _ = mimetypes.guess_type(image_path.name)
        if not mime_type or not mime_type.startswith("image/"):
            raise ValueError(f"画像の形式を判定できません: {image_path}")
        encoded = base64.b64encode(image_path.read_bytes()).decode("ascii")
        src = f"data:{mime_type};base64,{encoded}"
        alt = html.escape(PlainText.from_html(text), quote=True)
        title_attr = f' title="{html.escape(title, quote=True)}"' if title else ""
        return f'<img src="{src}" alt="{alt}"{title_attr} decoding="async" />'

    def table(self, text: str) -> str:
        # 狭い画面でも本文全体を横に広げず、表だけをスクロールさせる。
        return '<div class="table-scroll" tabindex="0"><table>\n' + text + "</table></div>\n"


STYLES = """\
:root {
  color-scheme: light;
  --ink: #172b3a;
  --muted: #586b79;
  --line: #dce4e9;
  --accent: #176b69;
  --paper: #ffffff;
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; scroll-padding-top: 1.5rem; }
body {
  margin: 0;
  background: #f4f7f8;
  color: var(--ink);
  font-family: -apple-system, BlinkMacSystemFont, "Hiragino Kaku Gothic ProN",
    "Yu Gothic", Meiryo, sans-serif;
  font-size: 16px;
  line-height: 1.9;
  overflow-wrap: anywhere;
}
a { color: var(--accent); text-decoration-thickness: 1px; text-underline-offset: 3px; }
a:hover { color: #104c4a; }
a:focus-visible, .table-scroll:focus-visible { outline: 3px solid #55aaa5; outline-offset: 4px; }
.skip-link { position: absolute; top: -100px; left: 1rem; background: white; padding: .5rem 1rem; }
.skip-link:focus { top: 1rem; }
.page { max-width: 1200px; margin: 0 auto; padding: 2.5rem 2rem 4rem; }
.page-header { border-bottom: 1px solid var(--line); margin-bottom: 2rem; padding-bottom: 1rem; }
.eyebrow { margin: 0 0 .3rem; font-size: .75rem; color: var(--muted); letter-spacing: .12em; }
.page-header p:last-child { margin: 0; font-size: .88rem; color: var(--muted); }
.layout { display: grid; grid-template-columns: 210px minmax(0, 1fr); gap: 2rem; align-items: start; }
.toc { position: sticky; top: 1.5rem; max-height: calc(100vh - 3rem); overflow-y: auto; font-size: .83rem; }
.toc h2 { margin: 0 0 .6rem; font-size: .85rem; }
.toc ul { list-style: none; padding: 0; margin: 0; }
.toc li { margin: 0 0 .4rem; line-height: 1.6; }
.toc .nested { padding-left: .9rem; font-size: .78rem; }
.toc a { color: var(--muted); text-decoration: none; }
.toc a:hover { color: var(--accent); text-decoration: underline; }
article { min-width: 0; background: var(--paper); padding: 2rem 2.5rem; border: 1px solid var(--line); border-radius: 8px; }
h1 { font-size: clamp(1.5rem, 3vw, 2rem); line-height: 1.5; letter-spacing: .01em; margin: 0 0 1.25rem; }
article h2 { font-size: 1.35rem; line-height: 1.5; margin: 2.5rem 0 1rem; padding-bottom: .4rem; border-bottom: 2px solid var(--line); }
article h3 { font-size: 1.08rem; margin: 1.8rem 0 .8rem; line-height: 1.6; }
article h4, article h5, article h6 { margin: 1.5rem 0 .6rem; }
p { margin: 0 0 1rem; }
ul, ol { padding-left: 1.4rem; margin: 0 0 1.2rem; }
li { margin-bottom: .5rem; }
li > p { margin-bottom: .5rem; }
code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: .86em; padding: .1em .3em; background: #edf2f5; border-radius: 3px; }
pre { padding: 1rem; background: #edf2f5; border: 1px solid var(--line); border-radius: 5px; overflow-x: auto; line-height: 1.6; }
pre code { padding: 0; background: none; overflow-wrap: normal; white-space: pre; }
.table-scroll { max-width: 100%; overflow-x: auto; margin: 1.4rem 0; }
table { width: 100%; border-collapse: collapse; font-size: .83rem; line-height: 1.7; }
th, td { padding: .65rem .75rem; text-align: left; vertical-align: top; border: 1px solid var(--line); }
th { background: #eaf2f3; font-weight: 600; }
tbody tr:nth-child(even) { background: #f8fafb; }
td code { word-break: break-all; }
img { display: block; max-width: 100%; height: auto; margin: 1.5rem auto; }
blockquote { border-left: 4px solid var(--accent); padding: .6rem 1rem; margin: 1rem 0; background: #f2f7f7; }
blockquote p:last-child { margin-bottom: 0; }
hr { border: 0; border-top: 1px solid var(--line); margin: 2rem 0; }
.page-footer { margin-top: 1.5rem; color: var(--muted); font-size: .78rem; }
@media (max-width: 900px) {
  .page { padding: 1.5rem 1rem 2rem; }
  .layout { display: block; }
  .toc { position: static; max-height: none; margin-bottom: 1.5rem; padding: 1rem; background: #eaf2f3; border-radius: 5px; }
  .toc ul { columns: 2; column-gap: 1.5rem; }
  .toc li { break-inside: avoid; }
  article { padding: 1.5rem; }
}
@media (max-width: 520px) {
  body { font-size: 15px; }
  article { padding: 1.1rem; }
  .toc ul { columns: 1; }
  th, td { min-width: 6rem; }
}
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
@media print {
  @page { size: A4; margin: 15mm; }
  body { background: white; font-size: 10pt; line-height: 1.7; }
  .page { max-width: none; margin: 0; padding: 0; }
  .layout { display: block; }
  .toc, .skip-link { display: none; }
  .page-header { margin-bottom: 1rem; }
  article { padding: 0; border: 0; border-radius: 0; }
  h1 { font-size: 18pt; }
  article h2 { font-size: 14pt; }
  article h3 { font-size: 11pt; }
  h1, h2, h3, h4 { break-after: avoid; }
  img, pre, tr { break-inside: avoid; }
  .table-scroll { overflow: visible; }
  table { font-size: 8pt; }
  th, td { padding: .35rem .45rem; }
  thead { display: table-header-group; }
  pre { white-space: pre-wrap; }
  pre code { white-space: pre-wrap; overflow-wrap: anywhere; }
  a { color: var(--ink); }
}
"""


def render_report(source: Path) -> Path:
    renderer = ReportRenderer(source)
    markdown = mistune.create_markdown(
        renderer=renderer,
        plugins=["table", "footnotes", "strikethrough", "task_lists", "url"],
    )
    body = markdown(source.read_text(encoding="utf-8"))
    title = next((text for level, _, text in renderer.headings if level == 1), source.stem)
    toc_items = "\n".join(
        f'<li class="{"nested" if level > 2 else "section"}">'
        f'<a href="#{html.escape(anchor, quote=True)}">{html.escape(text)}</a></li>'
        for level, anchor, text in renderer.headings
        if level in (2, 3)
    )
    source_link = html.escape(quote(source.name), quote=True)
    document = f"""<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{html.escape(title)} — 実験レポート</title>
  <style>
{STYLES}  </style>
</head>
<body>
  <a class="skip-link" href="#report">本文へ移動</a>
  <div class="page">
    <header class="page-header">
      <p class="eyebrow">SHOPPIE / EXPERIMENT REPORT</p>
      <p>実験レポート · <a href="{source_link}">Markdown 正本を読む</a></p>
    </header>
    <div class="layout">
      <nav class="toc" aria-label="目次">
        <h2>目次</h2>
        <ul>
{toc_items}
        </ul>
      </nav>
      <article id="report">
{body}      </article>
    </div>
    <footer class="page-footer">Markdown 正本から生成した HTML。数値・条件・制約・参照先は正本と同じ。</footer>
  </div>
</body>
</html>
"""
    destination = source.with_suffix(".html")
    destination.write_text(document, encoding="utf-8")
    return destination


def main() -> None:
    parser = argparse.ArgumentParser(description="実験レポートの Markdown から隣に HTML を生成する。")
    parser.add_argument("markdown", type=Path, help="正本の .md ファイル")
    args = parser.parse_args()
    if args.markdown.suffix.lower() != ".md":
        parser.error("入力には .md ファイルを指定してください。")
    try:
        destination = render_report(args.markdown)
    except (OSError, ValueError) as error:
        parser.exit(1, f"レポートを生成できません: {error}\n")
    print(destination)


if __name__ == "__main__":
    main()
