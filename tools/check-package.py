#!/usr/bin/env python
# Copyright (c) 2025-2026 Zensical and contributors
# SPDX-License-Identifier: MIT

"""Check the UI distributions against the built resource tree."""

from __future__ import annotations

import hashlib
import json
import sys
import tarfile
from email.parser import BytesParser
from pathlib import Path
from zipfile import ZipFile


def digest(content: bytes) -> bytes:
    """Return the content digest used to compare packaged resources."""
    return hashlib.sha256(content).digest()


def main() -> None:
    """Check all resources and metadata in the UI wheel and source archive."""
    root = Path(__file__).resolve().parent.parent
    version = json.loads((root / "package.json").read_text())["version"]
    output = Path(sys.argv[1])
    wheel = output / f"zensical_ui-{version}-py3-none-any.whl"
    sdist = output / f"zensical_ui-{version}.tar.gz"
    expected = {
        path.relative_to(root / "dist").as_posix(): digest(path.read_bytes())
        for path in (root / "dist").rglob("*")
        if path.is_file()
    }
    if (
        "base.html" not in expected
        or ".icons/lucide/external-link.svg" not in expected
    ):
        raise SystemExit("Build the complete UI resource tree before packaging")

    with ZipFile(wheel) as archive:
        prefix = "zensical_ui/templates/"
        actual = {
            name.removeprefix(prefix): digest(archive.read(name))
            for name in archive.namelist()
            if name.startswith(prefix) and not name.endswith("/")
        }
        if actual != expected:
            raise SystemExit("Wheel resources differ from dist/")
        metadata = BytesParser().parsebytes(
            archive.read(f"zensical_ui-{version}.dist-info/METADATA")
        )
        if metadata["Name"] != "zensical-ui" or metadata["Version"] != version:
            raise SystemExit("UI package identity does not match package.json")
        if metadata.get_all("Requires-Dist"):
            raise SystemExit("UI package must have no runtime dependencies")
        archive.read("zensical_ui/py.typed")
        archive.read(f"zensical_ui-{version}.dist-info/licenses/LICENSE")
        if b"Root-Is-Purelib: true" not in archive.read(
            f"zensical_ui-{version}.dist-info/WHEEL"
        ):
            raise SystemExit("UI wheel must be platform independent")

    with tarfile.open(sdist) as archive:
        prefix = f"zensical_ui-{version}/"
        actual = {}
        for member in archive.getmembers():
            if member.isfile() and member.name.startswith(prefix + "dist/"):
                stream = archive.extractfile(member)
                if stream is None:
                    raise SystemExit(f"Missing source resource: {member.name}")
                actual[member.name.removeprefix(prefix + "dist/")] = digest(
                    stream.read()
                )
        if actual != expected:
            raise SystemExit("Source distribution resources differ from dist/")
        for name in (
            "pyproject.toml",
            "package.json",
            "LICENSE",
            "python/zensical_ui/__init__.py",
            "python/zensical_ui/py.typed",
        ):
            archive.getmember(prefix + name)

    print(f"Checked UI {version}: all {len(expected):,} resource files match")  # noqa: T201


if __name__ == "__main__":
    main()
