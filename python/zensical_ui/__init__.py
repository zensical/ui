# Copyright (c) 2025-2026 Zensical and contributors

# SPDX-License-Identifier: MIT
# Third-party contributions licensed under DCO

# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to
# deal in the Software without restriction, including without limitation the
# rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
# sell copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:

# The above copyright notice and this permission notice shall be included in
# all copies or substantial portions of the Software.

# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
# FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
# IN THE SOFTWARE.

"""Templates and browser assets for Zensical."""

from pathlib import Path


def get_theme_dir() -> str:
    """Return the absolute directory containing the built-in theme.

    Installed wheels carry the theme beside this module. Editable installations
    use the UI checkout's build output so asset changes remain visible.
    """
    package = Path(__file__).resolve().parent
    path = package / "templates"
    if not path.is_dir():
        path = package.parent.parent / "dist"
    if not path.is_dir():
        raise FileNotFoundError(
            "Zensical UI assets are missing. For an editable installation, "
            "run 'npm run build' in the UI checkout; otherwise reinstall "
            "zensical-ui."
        )
    return str(path)
