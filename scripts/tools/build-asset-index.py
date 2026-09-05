#!/usr/bin/env python3
"""Rebuild the searchable asset library using only the Python standard library."""
from collections import defaultdict
from html import escape
import json
import os
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "assets"
EXTENSIONS = {".svg", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif", ".otf", ".ttf", ".woff", ".woff2"}
FONT_EXTENSIONS = {".otf", ".ttf", ".woff", ".woff2"}


def build():
    aliases = json.loads((ROOT / "deploy/asset-redirects.json").read_text(encoding="utf-8"))
    references = {}
    for directory in [ROOT, ROOT / "styles", ROOT / "scripts"]:
        candidates = directory.glob("*.html") if directory == ROOT else directory.rglob("*")
        for file in candidates:
            if file.suffix in {".html", ".css", ".js"} and "tools" not in file.relative_to(ROOT).parts:
                references[file] = file.read_text(encoding="utf-8")

    records = []
    folders = defaultdict(list)
    for file in sorted(ASSETS.rglob("*")):
        if not file.is_file() or file.suffix.lower() not in EXTENSIONS:
            continue
        path = file.relative_to(ROOT).as_posix()
        used_by = []
        for source, text in references.items():
            reference = os.path.relpath(file, source.parent).replace("\\", "/") if source.suffix == ".css" else path
            if reference in text:
                used_by.append(source.relative_to(ROOT).as_posix())
        record = {
            "path": path,
            "folder": file.parent.relative_to(ASSETS).as_posix(),
            "bytes": file.stat().st_size,
            "usedBy": sorted(used_by),
            "previousPaths": sorted(old for old, new in aliases.items() if new == path),
        }
        records.append(record)
        folders[record["folder"]].append(record)

    navigation, sections = [], []
    for folder, items in folders.items():
        section_id = folder.replace("/", "-")
        navigation.append(f'<a href="#{section_id}" data-folder-link="{section_id}">{escape(folder)} <span>{len(items)}</span></a>')
        cards = []
        for item in items:
            path = item["path"]
            relative = path.removeprefix("assets/")
            filename = Path(path).name
            url = quote(relative, safe="/")
            name = escape(filename)
            if Path(path).suffix in FONT_EXTENSIONS:
                preview = '<span class="font-sample">Cottage 616</span>'
            else:
                preview = f'<img src="{url}" alt="{name}" loading="lazy" decoding="async">'
            uses = len(item["usedBy"])
            usage = f'Used in {uses} site {"file" if uses == 1 else "files"}' if uses else 'Library asset'
            search = escape(" ".join([path, *item["previousPaths"], *item["usedBy"]]).lower(), quote=True)
            cards.append(f'''<article class="asset-card" data-search="{search}">
              <a class="asset-preview" href="{url}" target="_blank" rel="noopener" aria-label="Open {name}">{preview}</a>
              <div class="asset-card__copy"><h3><a href="{url}">{name}</a></h3>
                <p>{item["bytes"] / 1024:.1f} KB · {usage}</p>
                <button class="button button--secondary button--small" type="button" data-copy="{escape(path, quote=True)}">Copy path</button>
              </div></article>''')
        sections.append(f'<section id="{section_id}" data-asset-folder="{escape(folder.split("/")[0])}" aria-labelledby="{section_id}-title"><h2 id="{section_id}-title">{escape(folder)}</h2><div class="asset-grid">{"".join(cards)}</div></section>')
    labels = {'cottage-616': 'Cottage 616', 'hive': 'The Hive', 'vendors': 'Vendors', 'shared': 'Shared'}
    options = ''.join(f'<option value="{group}">{labels.get(group, group.title())}</option>' for group in sorted({r["folder"].split("/")[0] for r in records}))
    html = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Cottage 616 | Asset Library</title>
<link rel="stylesheet" href="../styles/tools/asset-library.css">
<link rel="stylesheet" href="../styles/components/buttons.css">
</head><body>
<header><a class="back-link" href="../index.html">Cottage 616</a><h1>Asset library.</h1>
<p>Browse by folder, search a filename, or copy a path for the site.</p>
<div class="library-filters"><label>Search assets<input type="search" id="asset-search" placeholder="Name, folder, or previous filename"></label>
<label>Folder<select id="asset-group"><option value="">All folders</option>{options}</select></label></div>
<p id="asset-count" role="status">{len(records)} assets</p></header>
<div class="library-layout"><nav aria-label="Asset folders">{"".join(navigation)}</nav><main>{"".join(sections)}<p id="asset-empty" hidden>No assets match your search.</p></main></div>
<p class="copy-status" id="copy-status" role="status"></p>
<script src="../scripts/tools/asset-library.js"></script></body></html>'''
    (ASSETS / "catalog.json").write_text(json.dumps(records, indent=2) + "\n", encoding="utf-8")
    (ASSETS / "index.html").write_text(html + "\n", encoding="utf-8")
    print(f"Indexed {len(records)} assets in {len(folders)} folders.")


if __name__ == "__main__":
    build()
