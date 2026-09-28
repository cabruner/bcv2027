#!/usr/bin/env python3
"""Report local HTML src/href assets that are missing under a site root.

Uses only the Python standard library. Fragment-only links, protocol-relative
URLs, and scheme URLs (http, https, mailto, data, and any other scheme) are
ignored. Local paths are query/fragment-stripped and percent-decoded.
"""

from __future__ import annotations

import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


class _ReferenceParser(HTMLParser):
    """Collect src and href attribute values from an HTML document."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.references: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        for name, value in attrs:
            if name in {"href", "src"} and value:
                self.references.append(value)


def _local_reference(value: str) -> str | None:
    """Return a decoded site-relative path, or None when the URL is not local."""
    text = value.strip()
    if not text or text.startswith("#"):
        return None
    parts = urlsplit(text)
    # Scheme URLs (http, https, mailto, data, ...) and protocol-relative URLs.
    if parts.scheme or parts.netloc:
        return None
    path = unquote(parts.path).replace("\\", "/").strip()
    while path.startswith("./"):
        path = path[2:]
    path = path.lstrip("/")
    if not path or path.endswith("/"):
        return None
    return path


def _is_missing(root: Path, relative: str) -> bool:
    root_resolved = root.resolve()
    candidate = (root_resolved / relative).resolve()
    try:
        candidate.relative_to(root_resolved)
    except ValueError:
        return True
    return not candidate.is_file()


def find_missing_assets(html: str, root: Path) -> list[str]:
    """Return sorted unique local paths referenced by html but absent under root."""
    parser = _ReferenceParser()
    parser.feed(html)
    parser.close()
    missing: set[str] = set()
    for reference in parser.references:
        relative = _local_reference(reference)
        if relative is not None and _is_missing(root, relative):
            missing.add(relative)
    return sorted(missing)


def main() -> int:
    repo_root = Path(__file__).resolve().parent.parent
    html = (repo_root / "index.html").read_text(encoding="utf-8")
    missing = find_missing_assets(html, repo_root)
    if missing:
        print("\n".join(missing))
        return 1
    print("OK: all local assets exist")
    return 0


if __name__ == "__main__":
    sys.exit(main())
