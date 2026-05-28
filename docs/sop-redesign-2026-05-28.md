# SOP section redesign — 2026-05-28

A Google-Cloud-docs-style redesign of the SOP section: a persistent left rail for navigation, a focused center column, and a clean "land on the Procedure" reading experience. Scoped to `/sop/` for now as a test of the pattern.

## New shared assets
- **`sop/sidebar.js`** — single source of truth for the SOP list. Injects the left rail into `<aside id="sop-sidebar">` on every SOP page, resolves links relative to page depth (works on `file://` and GitHub Pages), and marks the active item. On a page that declares in-page views (`<div class="sop-view" data-view="…">`), it also renders a nested **Procedure / Details** sub-menu and switches which view is shown.
- **`sop/sidebar.css`** — all rail + layout + view + de-carded-header styling, mirroring the existing `print.css` shared-stylesheet pattern (so it's one file to tweak, not inline-per-page).

## Rail
- Grouped: **Current procedures** (GT Task Handling, Voxel Painting), **Recent procedures** (GT Protocol Guidelines), **Older procedures** (GT Verification, GT Checklist, File Naming).
- Light/open styling (overrides the site's dark global `nav`), thin section separators, caret affordance (▸ collapsed / ▾ expanded), active highlight.

## Page changes
- **Landing (`sop/index.html`)** — now an **Overview** (scope + a described, linked SOP list) instead of the metadata table. The SOP list lives in the rail.
- **Every SOP sub-page** — de-carded header (title presented like other page titles, not boxed) + two rail-switched views:
  - **Procedure** (default) — the clean steps, in one card.
  - **Details** — Purpose, Scope, Related documents, Version history, Change log, combined into one card.

## Older SOPs filled out (no longer placeholders)
Authored real Procedure content from each source doc:
- **GT Verification** ← *How to Verify GT Tasks* (VAST + Omni inspection, appeal process).
- **GT Checklist** ← *Updated GT Checklist* (segmentation rules incl. dust/defect/fat-globule handling).
- **File Naming** ← *Protocols for Naming Files* (`Project_Type_Volume` convention, Type/Examples tables, Omni exception).
- **GT Protocol Guidelines** ← *GT Protocol Guidelines Revised* — reorganized into Mitochondria / Myelin / Upsampled images / Edge cases / Workflow & QA / WebKnossos tools. **Slack-message citations and the message appendix were intentionally omitted.**

## Known follow-up
- The previously-used card CSS (`.sop-header`, `.content-section`, `.placeholder-banner`, `.meta-*`, `.version-history`, `.change-log`, etc.) is now unused but still inline on the SOP pages. Pending a cleanup sweep now that the design has settled.
- Pattern is SOP-only for now; could extend to other sections if we like it.
