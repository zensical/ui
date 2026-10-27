# Zensical UI

Templates for [Zensical].

> [!NOTE]
>
> Note that this library is still in early development and its API may change
> significantly in future releases. This repository contains the UI templates
> for [Zensical] as a first step towards modularization.

[Zensical]: https://zensical.org

## Python package

The `zensical-ui` distribution provides the built templates, browser assets,
and icons as a platform-independent Python package. It requires Python 3.11 or
newer and has no runtime dependencies.

```python
from zensical_ui import get_theme_dir

# Absolute path to the built templates and assets, including .icons.
theme_dir = get_theme_dir()
```

### Build distributions

Build the UI with Node.js 24 or newer, then package the resulting `dist/` tree:

```sh
npm ci
npm run build
python -m pip install build
python -m build --outdir artifacts
```

The package version comes from `package.json`. The wheel and source
distribution include the built assets; installing them does not require Node.js
or access to this repository. The source distribution also includes the UI
sources and build tools.

### Develop locally

Create or activate the Python environment that will run Zensical, then install
this checkout as an editable dependency:

```sh
npm ci
npm run build
python -m pip install --editable .
npm start
```

`get_theme_dir()` resolves to this checkout's `dist/` directory for an editable
installation. Changes written by the UI watcher are visible without reinstalling
this package or copying files into the core repository. The core's exact UI
version requirement must match the version in this checkout's `package.json`.
