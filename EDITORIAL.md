# Editorial Guidelines

Internal reference for site maintainers.

---

## Single-Editor Model

This site uses a **single-editor model**: one person reviews and incorporates all changes.

**Why:**
- Consistent voice and terminology across 50+ pages
- No merge conflicts or coordination overhead
- Clear accountability for accuracy
- Faster turnaround than committee review

**Trade-off accepted:** Bottleneck risk if editor unavailable. Mitigated by clear documentation and simple tooling.

---

## Change Classification

### Wording Changes (Low friction)
Make directly without consultation:
- Typo fixes
- Clarifying ambiguous sentences
- Adding missing steps to procedures
- Updating outdated tool names or URLs
- Fixing broken links

### Structural Changes (Moderate friction)
Consider impact before making:
- Adding new sections to existing pages
- Reorganizing content within a page
- Adding new pages to existing categories
- Updating navigation links

### Architectural Changes (High friction)
Discuss with team lead first:
- New top-level sections (nav bar changes)
- Removing or deprecating pages
- Changing URL structure
- Modifying SOP versioning scheme
- Changes affecting multiple publications

---

## SOP Versioning Rules

**Location:** `/sop/[sop-name]/`

**Structure:**
```
sop/gt-task-handling/
├── index.html     # Always shows current version
├── v2.0.html      # Current
├── v1.0.html      # Deprecated
```

**Version numbers:**
- **Major (X.0):** Significant procedure changes, new requirements, workflow restructuring
- **Minor (X.Y):** Clarifications, typo fixes, added examples, tool updates

**Rules:**
1. Never delete old versions—mark as deprecated
2. Update index.html to point to new current version
3. Add change log entry to new version
4. Update SOP index page (`/sop/`) with new version info

**When to version vs. edit in place:**
- New version: Changes that affect how work is done
- Edit in place: Typos, broken links, clarifications that don't change procedure

---

## Reviewing Suggestions

Suggestions come via GitHub Issues using templates:
- Content Suggestion
- SOP Update Request
- Gallery Addition
- Correction / Error

**Triage process:**

1. **Quick wins** (do immediately):
   - Typos, broken links
   - Obvious corrections
   - Simple clarifications

2. **Standard review** (within 1 week):
   - New examples or gallery items
   - Wording improvements
   - Minor SOP updates

3. **Needs investigation** (flag for later):
   - Structural suggestions
   - Conflicting information claims
   - Requests requiring SME input

**Closing issues:**
- Reference commit hash when closing
- Thank contributor briefly
- If rejecting, explain why in one sentence

---

## Consultation Thresholds

### No consultation needed
- Fixing errors
- Clarifying existing content
- Adding examples that match established patterns
- Updating links and references
- Minor SOP version bumps

### Check with team lead
- New SOP creation
- Deprecating existing content
- Changes to pipeline stage definitions
- Anything touching publication metadata
- Navigation structure changes

### Check with relevant SME
- Technical accuracy of specific procedures
- Dataset-specific information (FAFB vs BANC)
- Tool-specific workflows (WebKnossos, CAVE)

---

## Style Notes

**Voice:** Clear, direct, friendly. Not academic.

**Avoid:**
- Jargon without explanation
- Passive voice where active is clearer
- Excessive hedging ("might," "perhaps," "it seems")

**Prefer:**
- Numbered steps for procedures
- Bullet points for lists
- Code blocks for commands, coordinates, IDs
- Links to related content

**Page titles:** `[Topic] - Princeton Tracer`

**Heading hierarchy:** H1 for page title only. H2 for sections. H3 for subsections.

---

## File Locations

| Content Type | Location |
|--------------|----------|
| Main pages | `/[section]/index.html` |
| SOPs | `/sop/[name]/index.html` + versions |
| Tasks | `/tasks/[name]/index.html` |
| Publications | `/publications/[name]/index.html` |
| Issue templates | `/.github/ISSUE_TEMPLATE/` |
| This document | `/EDITORIAL.md` |

---

*Last updated: January 2026*
