/* Local snapshot refresher: fetch all 9 tabs from the sheet, anonymize, and
   overwrite datasets/data/activity-snapshot.json (the committed public fallback).
   RAW responses (with real names) are held only in memory here and are never
   written to disk. Run: `SHEET_ID=<id> node worker/build-snapshot.mjs`
   (or drop the id into a git-ignored worker/.dev.vars as `SHEET_ID=<id>`).

   The Google Sheet ID is a secret and MUST NOT be committed — it is read from
   the environment or worker/.dev.vars, never hardcoded. */
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { anonymizeSheet, ALL_TABS } from './anonymize.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

function loadSheetId() {
  if (process.env.SHEET_ID) return process.env.SHEET_ID.trim();
  const dv = join(HERE, '.dev.vars');
  if (existsSync(dv)) {
    const m = readFileSync(dv, 'utf8').match(/^\s*SHEET_ID\s*=\s*(.+?)\s*$/m);
    if (m) return m[1].replace(/^["']|["']$/g, '').trim();
  }
  console.log('ERROR: SHEET_ID not set. Pass it as an env var (SHEET_ID=<id> node worker/build-snapshot.mjs)\n' +
                '       or put `SHEET_ID=<id>` in a git-ignored worker/.dev.vars file.');
  process.exit(1);
}
const SHEET_ID = loadSheetId();
const OUT_SNAPSHOT = join(HERE, '..', 'datasets', 'data', 'activity-snapshot.json');

function stripJsonp(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  return JSON.parse(text.slice(start, end + 1));
}

async function fetchTab(tab) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq` +
    `?tqx=out:json&sheet=${encodeURIComponent(tab)}&headers=2`;
  const r = await fetch(url);
  const t = await r.text();
  return stripJsonp(t);
}

const raw = {};
for (const tab of ALL_TABS) {
  try { raw[tab] = await fetchTab(tab); console.log('fetched', tab); }
  catch (e) { console.log('FAILED', tab, e.message); }
}

// Collect the real names present in the raw source (for the privacy report only).
const realNames = new Set();
for (const resp of Object.values(raw)) {
  for (const col of (resp.table?.cols || [])) {
    const label = (col.label || '').trim();
    const m = label.match(/^(\d+)\s+(.+)$/);
    if (m) realNames.add(m[2]);
    else if (label && label.toLowerCase() !== 'date' && label.toLowerCase() !== 'average') realNames.add(label);
  }
}

// Build the anonymized data WITHOUT a timestamp first, so we can tell whether the
// numbers actually changed (independent of when we last checked). "Last updated"
// should reflect the last real data change, not every daily poll.
const freshNoTs = anonymizeSheet(raw, null);
const dataKey = (o) => JSON.stringify({ tabCount: o.tabCount, contributorCount: o.contributorCount, roster: o.roster, tabs: o.tabs });
let generatedAt = new Date().toISOString();
let dataChanged = true;
if (existsSync(OUT_SNAPSHOT)) {
  try {
    const prev = JSON.parse(readFileSync(OUT_SNAPSHOT, 'utf8'));
    if (prev.generatedAt && dataKey(prev) === dataKey(freshNoTs)) {
      dataChanged = false;            // numbers identical -> keep the prior "last updated" time
      generatedAt = prev.generatedAt;
    }
  } catch { /* unreadable prev -> treat as changed */ }
}
const snapshot = anonymizeSheet(raw, generatedAt);
// Scan the timestamp-FREE data for leaks (so timestamp digits can't collide with a worker id).
const snapText = JSON.stringify(freshNoTs);

// ---- PRIVACY AUDIT: assert no real name / id appears in the anonymized output ----
const leaks = [];
for (const name of realNames) {
  // check full name and each name token >= 3 chars
  const tokens = [name, ...name.split(/[\s,]+/)].filter(t => t.length >= 3);
  for (const tok of tokens) {
    if (snapText.toLowerCase().includes(tok.toLowerCase())) leaks.push({ name, tok });
  }
}
// check numeric ids
const idLeaks = [];
for (const resp of Object.values(raw)) {
  for (const col of (resp.table?.cols || [])) {
    const m = (col.label || '').match(/^(\d+)\s+/);
    if (m && new RegExp('\\b' + m[1] + '\\b').test(snapText)) idLeaks.push(m[1]);
  }
}
const sheetLeak = snapText.includes(SHEET_ID);

// Refuse to write if the anonymized output would leak anything.
if (leaks.length || idLeaks.length || sheetLeak) {
  console.log('ABORT: anonymized output failed the privacy check — snapshot NOT written.');
  process.exit(2);
}
// Write ONLY the anonymized snapshot into the repo, and only when the data changed
// (so unchanged days don't churn the file or its timestamp). The real-name list is
// never persisted to disk (it stays in memory); only aggregate counts are reported.
if (!dataChanged) {
  console.log('no data change since last run - snapshot left as-is (last updated ' + generatedAt + ')');
} else {
  writeFileSync(OUT_SNAPSHOT, JSON.stringify(snapshot, null, 0));
  console.log('wrote', OUT_SNAPSHOT, '(last updated ' + generatedAt + ')');
}

console.log('\n===== PRIVACY REPORT =====');
console.log('real names in source:', realNames.size);
console.log('contributors (pseudonymized):', snapshot.contributorCount);
console.log('name leaks:', leaks.length, 'id leaks:', [...new Set(idLeaks)].length, 'sheetId leak:', sheetLeak);
console.log('VERDICT:', (leaks.length === 0 && idLeaks.length === 0 && !sheetLeak) ? 'PASS' : 'FAIL');
