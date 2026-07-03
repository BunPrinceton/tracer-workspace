/* gen-nav.js — rewrite the top nav on every page: pop Experimental out of More
   into its own dropdown (between Pipeline and More), add Curated Links + CAVE Local
   to More, remove Experimental + FlyWire Links from More. A second dropdown reuses
   the existing `.nav-more` class, so NO per-page CSS change is needed.
   Depth prefix (./ vs ../ vs ../../) and aria-current are computed per page.
   Run: node work-files/gen-nav.js   (from repo root)
*/
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

// find every html file with the main nav
function walk(dir, acc) {
  for (const name of fs.readdirSync(dir)) {
    if (name === '.git' || name === 'node_modules' || name === 'work-files') continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (name.endsWith('.html')) acc.push(p);
  }
  return acc;
}

// which nav target owns this page (for aria-current)
function currentKey(rel) {
  if (rel === 'index.html') return 'dashboard';
  const first = rel.split('/')[0];
  if (rel.startsWith('experimental/')) return 'exp-scripts';
  if (rel.startsWith('link-restore/')) return 'exp-restorer';
  if (rel.startsWith('tracertools-catalog/')) return 'exp-catalog';
  const map = { gallery: 'gallery', sop: 'sops', pipeline: 'pipeline', publications: 'publications',
    links: 'links', 'cave-local': 'cavelocal', archive: 'archive', glossary: 'glossary',
    games: 'sandypong', thoughts: 'thoughts', thanks: 'thanks' };
  return map[first] || null;
}

function buildNav(prefix, cur) {
  const A = (key, href, label, extra) => {
    const ac = cur === key ? ' aria-current="page"' : '';
    return `<a href="${href}"${ac}${extra || ''}>${label}</a>`;
  };
  return `<nav aria-label="Main navigation">
    <ul>
        <li>${A('dashboard', prefix, 'Dashboard')}</li>
        <li>${A('gallery', prefix + 'gallery/', 'Gallery')}</li>
        <li>${A('sops', prefix + 'sop/', 'SOPs')}</li>
        <li>${A('pipeline', prefix + 'pipeline/', 'Pipeline')}</li>
        <li class="nav-more">
            <button class="nav-more-btn" aria-expanded="false" aria-haspopup="true">Experimental &#9662;</button>
            <ul class="nav-more-menu">
                <li>${A('exp-scripts', prefix + 'experimental/', 'Tracer Tools Scripts')}</li>
                <li>${A('exp-restorer', prefix + 'link-restore/', 'Link Restorer')}</li>
                <li>${A('exp-catalog', prefix + 'tracertools-catalog/', 'tracertools Catalog')}</li>
            </ul>
        </li>
        <li class="nav-more">
            <button class="nav-more-btn" aria-expanded="false" aria-haspopup="true">More &#9662;</button>
            <ul class="nav-more-menu">
                <li>${A('publications', prefix + 'publications/', 'Publications')}</li>
                <li>${A('links', prefix + 'links/', 'Curated Links')}</li>
                <li>${A('cavelocal', prefix + 'cave-local/', 'CAVE Local')}</li>
                <li>${A('archive', prefix + 'archive/', 'Archive')}</li>
                <li>${A('glossary', prefix + 'glossary/', 'Glossary')}</li>
                <li>${A('sandypong', prefix + 'games/sandy-pong/', 'Sandy Pong')}</li>
                <li>${A('thoughts', prefix + 'thoughts/', 'Thoughts')}</li>
                <li>${A('thanks', prefix + 'thanks/', 'Thanks')}</li>
                <li><a href="https://github.com/BunPrinceton/tracer-workspace" target="_blank" rel="noopener noreferrer">GitHub</a></li>
            </ul>
        </li>
    </ul>
</nav>`;
}

const NAV_RE = /<nav aria-label="Main navigation">[\s\S]*?<\/nav>/;
const files = walk(ROOT, []);
let changed = 0, skipped = 0, missing = 0;
for (const f of files) {
  let html = fs.readFileSync(f, 'utf8');
  if (!NAV_RE.test(html)) { continue; }
  const rel = path.relative(ROOT, f).split(path.sep).join('/');
  // depth = number of directory levels; prefix is that many '../', or './' at root
  const dirDepth = rel.split('/').length - 1;
  const isInclude = rel === '_includes/nav.html';
  const prefix = (dirDepth === 0 || isInclude) ? './' : '../'.repeat(dirDepth);
  const cur = isInclude ? null : currentKey(rel);
  const nav = buildNav(prefix, cur);
  const nl = html.includes('\r\n') ? '\r\n' : '\n';
  const navNl = nav.split('\n').join(nl);
  const next = html.replace(NAV_RE, navNl);
  if (next !== html) { fs.writeFileSync(f, next); changed++; console.log('  nav » ' + rel + '  (depth ' + dirDepth + (cur ? ', current=' + cur : '') + ')'); }
  else skipped++;
}
console.log(`\nnav rewritten on ${changed} files, ${skipped} unchanged`);
