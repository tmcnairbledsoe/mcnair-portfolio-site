"""Verify the exact deployed build, HTML routes, bundles, and hosting protections."""
import json
import sys
import time
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen
from urllib.error import HTTPError


class Assets(HTMLParser):
    def __init__(self):
        super().__init__()
        self.paths = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "script" and attrs.get("src"):
            self.paths.append(attrs["src"])
        if tag == "link" and attrs.get("rel") == "stylesheet":
            self.paths.append(attrs["href"])


def read(url):
    with urlopen(Request(url, headers={"Cache-Control": "no-cache"}), timeout=20) as response:
        return response.read(), response.headers


base, expected_commit = sys.argv[1:]
for attempt in range(18):
    try:
        version, _ = read(base + "/version.json?commit=" + expected_commit)
        if json.loads(version)["commit"] != expected_commit:
            raise RuntimeError("Production still serves an earlier build")
        break
    except Exception:
        if attempt == 17:
            raise
        time.sleep(10)

html, headers = read(base + "/")
assert b'<div id="root"' in html, "Application HTML is missing"
assert headers.get("X-Content-Type-Options") == "nosniff", "Missing security header"
assert headers.get("Content-Security-Policy"), "Missing content security policy"
assets = Assets()
assets.feed(html.decode())
assert assets.paths, "No application bundles found"
for asset in assets.paths:
    asset_url = urljoin(base, asset)
    assert urlparse(asset_url).netloc == urlparse(base).netloc, "Unexpected external bundle"
    content, _ = read(asset_url)
    assert content, "Empty application asset"
for route in ("/resume", "/projects", "/interests", "/tools", "/drawing", "/focus"):
    content, _ = read(base + route)
    assert b'<div id="root"' in content, "Missing SPA route: " + route
wedding, _ = read(base + "/weddingsite")
assert b"Charlotte" in wedding, "Wedding archive is missing"
wedding_assets = Assets()
wedding_assets.feed(wedding.decode())
assert wedding_assets.paths, "Wedding bundles are missing"
for asset in wedding_assets.paths:
    # Google Fonts supplies presentation only; verify our deployed app assets.
    if asset.startswith("/weddingsite/"):
        content, _ = read(urljoin(base, asset))
        assert content, "Empty wedding bundle"
photo, _ = read(base + "/weddingsite/images/1.jpg")
assert photo.startswith(b"\xff\xd8"), "Wedding photos are missing"
for route in ("/not-a-page", "/journal", "/calendar", "/static/missing.js"):
    try:
        read(base + route)
    except HTTPError as error:
        assert error.code == 404, "Unexpected error for " + route
    else:
        raise AssertionError("Missing 404 for " + route)
print("Verified production commit", expected_commit, "and", len(assets.paths), "bundles")
