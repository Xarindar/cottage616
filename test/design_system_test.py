"""Regression checks for shared markup, asset validation and token adoption."""
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import runpy
import unittest

ROOT = Path(__file__).resolve().parents[1]
builder = runpy.run_path(str(ROOT / "scripts/tools/build-site.py"))


class Elements(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.elements = []
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        self.elements.append((tag, dict(attrs)))


class SharedDesignTests(unittest.TestCase):
    def test_railway_preserves_asset_redirects(self):
        config = (ROOT / "Caddyfile").read_text(encoding="utf-8")
        redirects = json.loads((ROOT / "deploy/asset-redirects.json").read_text(encoding="utf-8"))
        for old, new in redirects.items():
            self.assertIn(f'{json.dumps("/" + old)} {json.dumps("/" + new)}', config)
        self.assertIn('"{asset_redirect}?{query}" 308', config)

    def test_generated_chrome_is_current_and_regions_are_required(self):
        builder["build"](check=True)
        for source in ("", "    <!-- shared:header -->x    <!-- /shared:header -->" * 2):
            with self.assertRaises(ValueError):
                builder["render"](source, "header", "header")

    def test_static_vendor_contacts_survive_legacy_layout_removal(self):
        source = (ROOT / "vendors.html").read_text(encoding="utf-8")
        elements = Elements(source).elements
        ids = {attrs["id"] for _, attrs in elements if "id" in attrs}
        targets = [attrs["data-contact-target"] for _, attrs in elements if "data-contact-target" in attrs]
        self.assertEqual(len(targets), 7)
        self.assertTrue(set(targets) <= ids)
        self.assertNotIn('class="vendor-card"', source)
        self.assertNotIn('class="vendor-logo-frame"', source)
        for tag, attrs in elements:
            if tag == "a" and "button--icon" in attrs.get("class", ""):
                self.assertTrue(attrs.get("aria-label"))

    def test_shared_design_values_have_one_source(self):
        sheets = list((ROOT / "styles").rglob("*.css"))
        all_css = "\n".join(path.read_text(encoding="utf-8") for path in sheets)
        definitions = set(re.findall(r"(--[\w-]+)\s*:", all_css))
        references = set(re.findall(r"var\(\s*(--[\w-]+)", all_css))
        dynamic_images = {"--category-image", "--promo-image", "--service-image", "--service-position", "--service-zoom"}
        self.assertEqual(references - definitions - dynamic_images, set())
        for path in (ROOT / "styles").rglob("*.css"):
            if path.name in ("tokens.css", "asset-library.css"):
                continue
            text = path.read_text(encoding="utf-8")
            self.assertNotRegex(text, r"#[\da-fA-F]{3,8}\b|rgba?\(", str(path))
            self.assertNotIn("var(--var(", text)
        hive = (ROOT / "the-hive.html").read_text(encoding="utf-8")
        self.assertNotIn('src="assets/hive/photos/treatments/head-spa-menu-banner-v1.png"', hive)
        for page in builder["PAGES"]:
            source = (ROOT / page).read_text(encoding="utf-8")
            self.assertEqual(source.count('href="styles/tokens.css'), 1)
            self.assertEqual(source.count('href="styles/components/header.css'), 1)

    def test_asset_checker_ignores_local_exports_and_checks_lazy_video_sources(self):
        checker = runpy.run_path(str(ROOT / "scripts/tools/check-assets.py"))
        self.assertFalse(any(".tmp" in Path(name).parts for name in checker["FILES"]))
        checker["References"]("the-hive.html").feed('<source data-src="assets/missing-video.mp4">')
        self.assertTrue(any("missing-video.mp4" in error for error in checker["errors"]))
        catalog = runpy.run_path(str(ROOT / "scripts/tools/build-asset-index.py"))
        self.assertIn(".mp4", catalog["EXTENSIONS"])


if __name__ == "__main__":
    unittest.main()
