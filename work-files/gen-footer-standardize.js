/* Standardize footer link placement to the SOP look across all pages:
   - footer element rule max-width -> 1000px (narrower than the 1200px content,
     so links sit in a centered column instead of at the page edges).
   - index.html (dashboard) .footer-links: add justify-content: space-between
     so its two links match the space-between layout used everywhere else.
   Touches only the footer element rule (8-space-indented `footer {`), never the
   `nav, footer {` media rule or `main`. Idempotent. */
const fs = require("fs");
const cp = require("child_process");

const files = cp.execSync('git ls-files "*.html"', { encoding: "utf8" })
  .split(/\r?\n/).filter(Boolean)
  .filter(f => !f.startsWith("drive_docs_output") && !f.startsWith("work-files"));

let footerChanged = 0, linksChanged = 0, skipped = 0;
files.forEach(f => {
  let h;
  try { h = fs.readFileSync(f, "utf8"); } catch (e) { return; }
  if (!/<footer>/i.test(h)) { return; }
  let orig = h;

  // 1. footer element rule: first max-width after a line-start `        footer {`
  h = h.replace(/(^[ \t]{0,8}footer\s*\{[\s\S]*?max-width:\s*)\d+px/m, "$11000px");

  // 2. dashboard .footer-links -> space-between (only where present, once)
  if (/\.footer-links\s*\{/.test(h) && !/\.footer-links\s*\{[^}]*justify-content/.test(h)) {
    h = h.replace(/(\.footer-links\s*\{\s*\n[ \t]*display:\s*flex;)/, "$1\n            justify-content: space-between;");
    if (h !== orig) linksChanged++;
  }

  if (h !== orig) { fs.writeFileSync(f, h); footerChanged++; }
  else skipped++;
});
console.log("footer pages updated:", footerChanged, "| .footer-links fixed:", linksChanged, "| unchanged:", skipped);
