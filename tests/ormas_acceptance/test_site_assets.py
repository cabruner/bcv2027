"""Independent acceptance checks for the site asset helper."""

import json

from ormas_acceptance import run


def test_reports_missing_local_assets():
    code = '''
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from scripts.check_site_assets import find_missing_assets

with TemporaryDirectory() as directory:
    root = Path(directory)
    (root / "assets").mkdir()
    (root / "assets" / "present.svg").write_text("", encoding="utf-8")
    html = """
        <img src="assets/present.svg?version=1">
        <img src="assets/missing%20image.svg?version=2#icon">
        <script src="assets/missing%20image.svg"></script>
        <a href="#details">Details</a>
        <a href="mailto:guest@example.com">Email</a>
        <a href="https://example.com/away">External</a>
    """
    print(json.dumps(find_missing_assets(html, root)))
'''
    observed = run(["python3", "-c", code])
    assert observed["returncode"] == 0, observed["output"]
    assert json.loads(observed["output"].strip()) == ["assets/missing image.svg"]


def test_current_site_has_no_missing_local_assets():
    observed = run(["python3", "scripts/check_site_assets.py"])
    assert observed["returncode"] == 0, observed["output"]
    assert "OK: all local assets exist" in observed["output"]
