#!/usr/bin/env python3
"""Static file server for the Cottage 616 site under /cottage616."""
import http.server
import json
import os
from urllib.parse import quote, unquote, urlsplit

PORT = int(os.environ.get("PORT", 8083))
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT = REPO_ROOT
PREFIX = "/cottage616"
with open(os.path.join(REPO_ROOT, "deploy", "asset-redirects.json"), encoding="utf-8") as redirects_file:
    ASSET_REDIRECTS = json.load(redirects_file)


class CottageHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def _request_path(self):
        return self.path.split("?", 1)[0].split("#", 1)[0]

    def _stripped_path(self):
        path = self._request_path()
        if path == PREFIX:
            return "/"
        if path.startswith(PREFIX + "/"):
            return path[len(PREFIX):] or "/"
        return None

    def _redirect_prefix_root(self):
        self.send_response(308)
        self.send_header("Location", PREFIX + "/")
        self.end_headers()

    def _redirect_legacy_asset(self):
        stripped = self._stripped_path()
        if stripped is None:
            return False
        target = ASSET_REDIRECTS.get(unquote(stripped).lstrip("/"))
        if not target:
            return False
        location = PREFIX + "/" + quote(target, safe="/")
        query = urlsplit(self.path).query
        if query:
            location += "?" + query
        self.send_response(308)
        self.send_header("Location", location)
        self.end_headers()
        return True

    def end_headers(self):
        stripped = self._stripped_path() or self._request_path()
        _, ext = os.path.splitext(stripped)
        if ext in {".html", ".css", ".js"} or stripped in {"/", ""}:
            self.send_header("Cache-Control", "no-cache, max-age=0, must-revalidate")
        else:
            self.send_header("Cache-Control", "public, max-age=3600")
        super().end_headers()

    def do_GET(self):
        if self._request_path() == PREFIX:
            self._redirect_prefix_root()
            return
        if self._redirect_legacy_asset():
            return
        super().do_GET()

    def do_HEAD(self):
        if self._request_path() == PREFIX:
            self._redirect_prefix_root()
            return
        if self._redirect_legacy_asset():
            return
        super().do_HEAD()

    def translate_path(self, path):
        stripped = self._stripped_path()
        if stripped is None:
            return os.path.join(ROOT, "__not_found__")
        if stripped in {"/", ""}:
            stripped = "/index.html"
        return super().translate_path(stripped)

    def log_message(self, fmt, *args):
        pass


if __name__ == "__main__":
    if not os.path.isfile(os.path.join(ROOT, "index.html")):
        raise SystemExit(f"Site entrypoint not found: {os.path.join(ROOT, 'index.html')}")
    os.chdir(ROOT)
    with http.server.ThreadingHTTPServer(("127.0.0.1", PORT), CottageHandler) as httpd:
        print(f"cottage616-server listening on 127.0.0.1:{PORT}, serving {ROOT}", flush=True)
        httpd.serve_forever()
