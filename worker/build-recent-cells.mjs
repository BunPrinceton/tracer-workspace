/* build-recent-cells.mjs — publish step for the "Recent cells" profile feature.

   Input  (git-ignored, REAL CAVE user ids):  worker/recent-cells-raw.json
           written by worker/build_recent_cells.py (local CAVE crawl).
   Output (public, pseudonyms only):          datasets/data/recent-cells/<DATASET>.json

   The user id -> "Tracer NN" mapping is the SAME one the activity snapshot uses
   (anonymize.mjs#pseudonymMap over the live sheet headers), so a profile's recent
   cells always belong to the same pseudonym as its edit counts. Users who are not
   in the sheet are dropped. Like build-snapshot.mjs, this refuses to write if the
   output contains any tracked worker id, real name, or the sheet id.

   Run:  node worker/build-recent-cells.mjs        (needs worker/.dev.vars SHEET_ID) */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ALL_TABS, DATASETS, pseudonymMap } from './anonymize.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const RAW = join(HERE, 'recent-cells-raw.json');
const OUT_DIR = join(ROOT, 'datasets', 'data', 'recent-cells');

function loadSheetId() {
  if (process.env.SHEET_ID) return process.env.SHEET_ID.trim();
  const dv = join(HERE, '.dev.vars');
  if (existsSync(dv)) {
    const m = readFileSync(dv, 'utf8').match(/^\s*SHEET_ID\s*=\s*(.+?)\s*$/m);
    if (m) return m[1];
  }
  console.log('ERROR: SHEET_ID not set (env or worker/.dev.vars).');
  process.exit(1);
}
const SHEET_ID = loadSheetId();

async function fetchTab(tab) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq` +
    `?tqx=out:json&sheet=${encodeURIComponent(tab)}&headers=2`;
  const txt = await (await fetch(url)).text();
  const s = txt.indexOf('{'), e = txt.lastIndexOf('}');
  return JSON.parse(txt.slice(s, e + 1));
}

if (!existsSync(RAW)) { console.log('ERROR: missing', RAW, '— run build_recent_cells.py first'); process.exit(1); }
const raw = JSON.parse(readFileSync(RAW, 'utf8'));

const tabResponses = {};
for (const tab of ALL_TABS) {
  try { tabResponses[tab] = await fetchTab(tab); } catch (e) { console.log('sheet tab failed', tab, e.message); }
}
const { pidByKey, extracted } = pseudonymMap(tabResponses);

// Real names from the sheet headers (never written; only used for the leak audit).
const realNames = new Set();
const trackedIds = new Set();
for (const resp of Object.values(tabResponses)) {
  for (const col of (resp.table?.cols || [])) {
    const label = (col.label || '').trim();
    const m = label.match(/^(\d+)\s+(.+)$/);
    if (m) { trackedIds.add(m[1]); m[2].split(/[,\s]+/).filter(w => w.length >= 3).forEach(w => realNames.add(w.toLowerCase())); }
    else if (label && !/^(date|average)$/i.test(label)) label.split(/[,\s]+/).filter(w => w.length >= 3).forEach(w => realNames.add(w.toLowerCase()));
  }
}
void extracted;

mkdirSync(OUT_DIR, { recursive: true });
let wrote = 0;
for (const ds of DATASETS) {
  const src = raw.datasets?.[ds.key];
  if (!src) { console.log('skip', ds.key, '(no raw data)'); continue; }
  const people = {};
  let dropped = 0;
  for (const [uid, cells] of Object.entries(src.users || {})) {
    const pid = pidByKey.get('id:' + uid);
    if (!pid) { dropped++; continue; }
    people[pid] = cells.map(c => ({
      root: String(c.root),
      roots: (c.roots && c.roots.length ? c.roots : [c.root]).map(String),
      pieces: Array.isArray(c.pieces) ? c.pieces.map(p => ({ root: String(p.root), l2: p.l2 })) : null,
      mergedAway: c.mergedAway || 0,
      tNow: c.tNow || null,
      today: c.today ? String(c.today) : null,
      others: c.others || 0,
      otherUsers: c.otherUsers || 0,
      before: (c.before || []).map(String),
      tBefore: c.tBefore,
      t0: c.t0, t1: c.t1,
      ops: c.ops, merges: c.merges, splits: c.splits,
      xyz: Array.isArray(c.xyz) ? c.xyz.map(Number) : null,
      centerNm: Array.isArray(c.centerNm) ? c.centerNm : null,
      extentNm: Array.isArray(c.extentNm) ? c.extentNm : null,
      l2: c.l2 || null,
    }));
  }
  const out = {
    dataset: ds.key,
    generatedAt: src.generatedAt || raw.generatedAt,
    windowDays: src.windowDays || null,
    viewer: src.viewer,
    people,
  };
  const text = JSON.stringify(out);

  // ---- PRIVACY AUDIT ----
  // Strip the numeric fields that legitimately contain long digit runs (root ids,
  // timestamps, coordinates), then assert no tracked worker id survives as a token.
  const scrub = JSON.stringify(out, (k, v) => (['root', 'roots', 'pieces', 'before', 'tBefore', 'tNow', 'today', 'others', 'otherUsers', 't0', 't1', 'xyz', 'centerNm', 'extentNm', 'l2'].includes(k) ? undefined : v));
  const idLeaks = [...trackedIds].filter(id => new RegExp('(^|[^0-9])' + id + '([^0-9]|$)').test(scrub));
  const lower = text.toLowerCase();
  const nameLeaks = [...realNames].filter(n => n !== 'tracer' && lower.includes('"' + n) || lower.includes(n + '"'));
  const sheetLeak = text.includes(SHEET_ID);
  if (idLeaks.length || nameLeaks.length || sheetLeak) {
    console.log(`REFUSING to write ${ds.key}: idLeaks=${idLeaks.length} nameLeaks=${nameLeaks.length} sheetLeak=${sheetLeak}`);
    process.exitCode = 2;
    continue;
  }
  const file = join(OUT_DIR, ds.key + '.json');
  writeFileSync(file, text);
  wrote++;
  const nCells = Object.values(people).reduce((a, c) => a + c.length, 0);
  console.log(`wrote ${ds.key}: ${Object.keys(people).length} tracers, ${nCells} cells (${(text.length / 1024).toFixed(1)} KB; ${dropped} untracked users dropped)`);
}
console.log('done,', wrote, 'files');
