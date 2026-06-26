# Princeton Tracers — Workspace

Internal documentation, training materials, and tooling for the Princeton connectomics
annotation team ("tracers").

**Live site:** [borkbook.com](https://borkbook.com)
(also served at [bunprinceton.github.io/tracer-workspace](https://bunprinceton.github.io/tracer-workspace/))

This repository is two things in one:

1. A **static documentation site** (GitHub Pages) — SOPs, task guides, a figure gallery,
   a glossary, and a site-wide search system.
2. A small set of **tracer tooling** — a Python library for CAVE/Neuroglancer, WebKnossos
   browser userscripts, and assorted CLI scripts.

---

## The documentation site

### No build system

The site is **pure static HTML served directly by GitHub Pages** — no Jekyll, no bundler,
no templating. A few consequences worth knowing before you edit:

- **CSS and navigation are duplicated in every page.** The shared exceptions are
  `sop/print.css`, `sop/sidebar.css`, and the runtime styles injected by `search.js`.
  `_includes/nav.html` is a *reference template only* — it is not auto-included.
- **Deployment is just `git push` to `master`.** No CI, no Actions. Pages rebuilds in ~30–90s.
- Design system: colorblind-safe blue/amber palette, WCAG AA contrast, no web fonts,
  no chrome animations, 44px minimum touch targets. Details live in `index.html` comments
  and `CLAUDE.md`.

### Search is the spine of the site — `search.js`

`search.js` is loaded by every page. The `INDEX` array at the top is the **canonical
registry of every page and searchable artifact** on the site.

> **Adding a page = adding its `INDEX` entry in `search.js`, in the same commit.**
> There is no other data source — the All Documents listing and the `/archive/` search
> view both render live from `SiteSearch.INDEX`.

The matcher is hand-rolled (no Fuse.js): substring → prefix → edit-distance/transposition,
plus Google-style operators (`+required`, `-excluded`, `"exact phrase"`, `section:name`).

### Site map

| Path | What it is |
|------|------------|
| `/` (`index.html`) | Dashboard — hero image + mission |
| `/pipeline/` | Pipeline stages |
| `/sop/` | SOPs — Google-Docs-style left-rail layout (`sidebar.js` is the source of truth for the SOP list) |
| `/gallery/` | Unified figure gallery (~245 figures across stacked sections) |
| `/glossary/` | Jargon/terms glossary with deep-link anchors |
| `/archive/` | "All Documents" index **and** the search-results view |
| `/publications/` | Seung Lab publication stubs |
| `/contribute/` | How to suggest changes |
| `/thoughts/` | "Save for later" holding area |
| `/games/sandy-pong/` | Off-topic 2-player Pong (in the More dropdown) |

Some paths are intentionally **orphaned** (unlinked + de-indexed but left on disk per the
preserve-originals rule): `/tasks/`, `/ground-truth/`, and the standalone gallery pages that
were merged into `/gallery/`. See `CLAUDE.md` for the full list and the why.

### Editing rules

**Read [`EDITORIAL.md`](EDITORIAL.md) before making site changes.** In short:

- **Single-editor model** — changes flow through one maintainer for consistency. When working
  in parallel, drop a hand-off note in `work-files/` rather than both editing
  `search.js` / `archive/index.html` / `gallery/index.html` at once.
- **Never delete old SOP versions** — create a new `vX.Y.html`; the old one becomes a redirect stub.
- Page titles: `[Topic] - Princeton Tracers`. H1 for the page title only.
- Every page footer builds a "Suggest an edit" GitHub Issues link dynamically
  (templates in `.github/ISSUE_TEMPLATE/`).

---

## Tracer tooling

### `tracer_tools/` — Python library for CAVE / Neuroglancer

Fork of [jaybgager/tracer_tools](https://github.com/jaybgager/tracer_tools) with added
coordinate/ID helpers and CLI scripts. All functions live in
`tracer_tools/src/tracer_tools/utils.py`.

```bash
cd tracer_tools
pip install -e .
pip install caveclient cloudvolume pandas nglui numpy plotly gspread google-auth-oauthlib
```

CLI scripts come in two generations — Gen 1 (sequential) under `tracer_tools/scripts/`, and
Gen 2 (parallel `ThreadPoolExecutor`, much faster) e.g. `fast_get_coords.py`,
`fast_validate_ids.py`. For large ID validation see `ID_VALIDATION_WORKFLOW_GUIDE.md`.

> **Note:** most functions are hardcoded for specific datastacks (FlyWire / BANC). ID updates
> follow *supervoxels* through splits, not root IDs — see `CLAUDE.md` for the critical detail.

### `tampermonkey-scripts/` — WebKnossos userscripts

Browser userscripts for annotation workflows (opacity toggles, quick-rename with keyboard
shortcuts). Target `webknossos.org`, `wk.zetta.ai`, and `localhost:9090`. They navigate the
Ant Design DOM, so WebKnossos UI upgrades can break them — debug via the `[WK ...]` console logs.

### `scripts/`

Google Drive doc downloader and an HTML text extractor used to pull training docs into
`drive_docs_output/`.

---

## Authentication (local, never committed)

- **CAVE:** `~/.cloudvolume/secrets/cave-secret.json`
- **Google Sheets:** `google_credentials.json` in `tracer_tools/` (OAuth)

Secrets, credentials, billing docs (`*.xlsx` / `*.pdf`), `work-files/`, and the separate
`slack-workspace-toolkit/` repo are all `.gitignore`d.

---

## Repository conventions

- **Preserve originals.** Don't delete or overwrite originals — create a new variant
  (`-v2`, `vX.Y.html`, etc.) and unlink/de-index the old one if it's being retired.
- **`CLAUDE.md`** is the deep technical reference for this repo (architecture, known bugs,
  the search system internals, SOP layout). Start there for anything not covered here.
