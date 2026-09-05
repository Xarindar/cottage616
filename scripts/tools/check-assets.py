#!/usr/bin/env python3
"""Check static local references and redirects, including Linux filename casing."""
from html.parser import HTMLParser
import json
import posixpath
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[2]
SKIP_PARTS = {".git", "__pycache__"}
FILES = {p.relative_to(ROOT).as_posix() for p in ROOT.rglob("*") if p.is_file() and not SKIP_PARTS.intersection(p.relative_to(ROOT).parts)}
DIRECTORIES = {str(Path(p).parent).replace("\\", "/") for p in FILES}
REDIRECTS = json.loads((ROOT / "deploy/asset-redirects.json").read_text(encoding="utf-8"))
errors = []
checked = set()


def check(source, url, page_relative=False):
    if not url or url.startswith(("#", "data:", "mailto:", "tel:", "javascript:", "${")):
        return
    parsed = urlsplit(url)
    if parsed.scheme or parsed.netloc:
        return
    path = unquote(parsed.path)
    if not path:
        return
    if path.startswith("/cottage616/"):
        target = path.removeprefix("/cottage616/")
    elif path.startswith("/"):
        target = path.lstrip("/")
    else:
        parent = "" if page_relative else posixpath.dirname(source)
        target = posixpath.normpath(posixpath.join(parent, path))
    checked.add((source, target))
    if target in REDIRECTS:
        errors.append(f"{source}: uses retired path {target}")
    elif target not in FILES and target not in DIRECTORIES:
        errors.append(f"{source}: missing file or incorrect case: {target}")


class References(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.source = source

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        for attr in ("src", "href", "poster", "xlink:href"):
            if attr in attrs:
                check(self.source, attrs[attr])
        if "srcset" in attrs and not attrs["srcset"].startswith("data:"):
            for entry in attrs["srcset"].split(","):
                if entry.strip():
                    check(self.source, entry.strip().split()[0])
        if "style" in attrs:
            css_urls(self.source, attrs["style"])


def css_urls(source, text):
    for match in re.finditer(r"url\(\s*(['\"]?)(.*?)\1\s*\)", text):
        check(source, match.group(2))
    for match in re.finditer(r"@import\s+['\"]([^'\"]+)['\"]", text):
        check(source, match.group(1))


for source in sorted(FILES):
    path = ROOT / source
    if path.suffix not in {".html", ".svg", ".css", ".js"}:
        continue
    text = path.read_text(encoding="utf-8")
    if path.suffix in {".html", ".svg"}:
        References(source).feed(text)
    if path.suffix == ".css":
        css_urls(source, text)
    if path.suffix == ".js":
        for match in re.finditer(r"['\"]((?:\./)?assets/[^'\"\n]+)['\"]", text):
            check(source, match.group(1), page_relative=True)

for old, new in REDIRECTS.items():
    if new not in FILES:
        errors.append(f"Redirect {old}: missing destination {new}")
    if new in REDIRECTS:
        errors.append(f"Redirect {old}: redirect chain through {new}")
    if old == new or ".." in Path(new).parts or new.startswith("/"):
        errors.append(f"Redirect {old}: invalid destination {new}")

if errors:
    raise SystemExit("\n".join(errors))
print(f"Checked {len(checked)} local references and {len(REDIRECTS)} redirects; no missing files, retired references, or casing errors.")
