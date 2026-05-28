# SOPs page cleanup — 2026-05-28

Readability/usability pass on the SOPs section, ahead of a planned redesign of the SOP pages.

## Changes

### 1. Removed the breadcrumb bar (all 10 SOP sub-pages)
Dropped the `<nav class="breadcrumb">` row that sat just under the top nav (e.g. *Dashboard › Ground Truth › SOP › Voxel Painting v1.2*). It was redundant with the main nav. Also removed the now-dead `.breadcrumb` CSS from each page so the style blocks don't carry rules for an element that no longer exists.

Pages: `gt-task-handling/index.html`, `gt-task-handling/v1.0.html`, `gt-verification/index.html`, `gt-checklist/index.html`, `gt-protocol-guidelines/index.html`, `file-naming/index.html`, `voxel-painting/index.html`, `voxel-painting/v1.2.html`, `omni-export/index.html`, `vast-annotation/index.html`.

### 2. Fixed the top-nav style inconsistency (8 pages)
The top bar visibly changed when navigating from other pages into an SOP sub-page — the links rendered **left-aligned** instead of centered. Cause was a CSS typo: `justify-content: center;` had been bumped *outside* the `nav ul { … }` braces, so it was inert. Moved it back inside the rule. The two `gt-task-handling` pages already had it correct and were left untouched.

### 3. Trimmed the SOPs index (`sop/index.html`) to Current Procedures only
Removed three sections that belong in the (newly improved) Archive rather than on the main SOPs page:
- **Status legend** (Current / Deprecated / Draft key)
- **Deprecated Procedures** table (Omni Export, VAST — the "2 archived" section)
- **Source Documents** list (Google Doc HTML exports, a duplicate DOCX entry, references)

Also removed the dead `.legend` / `.source-docs` / `.source-label` CSS. Kept `.status-badge--deprecated` because the Current Procedures version-history dropdowns still use it to tag old versions.

## Rationale
The Archive is now the canonical home for deprecated procedures and source/reference material. The SOPs page should be just the current, authoritative procedures.

## Nothing lost / preserved
- The deprecated SOP pages (`sop/omni-export/`, `sop/vast-annotation/`) still exist with their "Deprecated → see Archive" banners.
- The source documents still exist as files.
- `search.js` still indexes the deprecated SOP pages (entries unchanged), so they remain findable via search and the Archive.
- Verified there are no `search.js` deep links into the removed `#deprecated-heading` / `#source-heading` anchors.

## Next
SOP-page redesign (design plan TBD).
