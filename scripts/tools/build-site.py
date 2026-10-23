#!/usr/bin/env python3
"""Render shared site chrome into committed HTML; --check fails on stale output."""
from html import escape
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[2]
PAGES = ("index.html", "the-hive.html", "vendors.html", "booking.html")


def header(page):
    home = page == "index.html"
    hive = page == "the-hive.html"
    booking = page == "booking.html"
    prefix = "" if home else "index.html"
    links = [("the-hive.html", "The Hive"), (f"{prefix}#events", "Events"),
             (f"{prefix}#team", "Team"), ("vendors.html", "Vendors")]
    if hive:
        links = [("index.html", "Cottage 616"), ("#head-spa-menu", "Treatments"), ("#team", "Team")]
    elif page == "vendors.html":
        links = [("index.html", "Cottage616"), ("index.html#events", "Events"),
                 ("index.html#team", "Team"), ("the-hive.html", "The Hive")]
    return (ROOT / "templates/header.html").read_text(encoding="utf-8").format(
        brand_class=" brand--hive" if hive else "",
        home="the-hive.html" if hive else "#top" if home else "index.html",
        brand_label="The Hive" if hive else "Cottage 616 home",
        home_attribute=" data-booking-home" if booking else "",
        logo="assets/hive/branding/logo.png" if hive else "assets/cottage-616/branding/symbol.svg",
        logo_alt="The Hive at Cottage 616" if hive else "",
        brand_name="" if hive else '<span data-business-name>Cottage 616</span>',
        navigation="\n".join(f'          <a href="{escape(href, quote=True)}">{escape(label)}</a>' for href, label in links),
        contact="#contact" if hive or home else "index.html#contact",
        profile="the-hive" if hive else "cottage616",
        booking_attribute=' aria-current="page" data-booking-nav' if booking else "",
        booking_label="Book now" if hive else "Book",
    ).replace("        \n", "").rstrip()


def render(source, part, markup):
    pattern = rf"    <!-- shared:{part} -->.*?    <!-- /shared:{part} -->"
    result, count = re.subn(pattern, lambda _: f"    <!-- shared:{part} -->\n{markup}\n    <!-- /shared:{part} -->", source, flags=re.S)
    if count != 1:
        raise ValueError(f"Expected exactly one shared:{part} region, found {count}")
    return result


def build(check=False):
    stale = []
    for page in PAGES:
        path = ROOT / page
        source = path.read_text(encoding="utf-8")
        output = render(source, "header", header(page))
        if page != "booking.html":
            output = render(output, "footer", (ROOT / "templates/footer.html").read_text(encoding="utf-8").rstrip())
        if source != output:
            stale.append(page)
            if not check:
                path.write_text(output, encoding="utf-8", newline="\n")
    redirects = json.loads((ROOT / "deploy/asset-redirects.json").read_text(encoding="utf-8"))
    mappings = "\n".join(f'\t\t{json.dumps("/" + old)} {json.dumps("/" + new)}' for old, new in sorted(redirects.items()))
    caddy = (ROOT / "templates/Caddyfile").read_text(encoding="utf-8").replace("__ASSET_REDIRECTS__", mappings)
    path = ROOT / "Caddyfile"
    if not path.exists() or path.read_text(encoding="utf-8") != caddy:
        stale.append("Caddyfile")
        if not check:
            path.write_text(caddy, encoding="utf-8", newline="\n")
    if check and stale:
        raise SystemExit("Run python scripts/tools/build-site.py: " + ", ".join(stale))
    print("Shared site files are current." if check else f"Updated {len(stale)} site files.")


if __name__ == "__main__":
    build(check="--check" in sys.argv)
