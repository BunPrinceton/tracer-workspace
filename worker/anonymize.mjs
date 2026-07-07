/* ============================================================
   anonymize.mjs — SHARED anonymizer (used by both the Cloudflare
   Worker and the local snapshot builder, so there is zero drift
   between what production serves and what is verified locally).

   Contract: takes the raw gviz JSON responses (one per sheet tab)
   and returns a payload that contains ONLY pseudonyms — no real
   names, no numeric worker IDs, no sheet ID. Cross-dataset stable:
   the same worker gets the same "Tracer NN" label in every dataset.
   ============================================================ */

const DATASETS = [
  { key: 'RETINA', metrics: { edits: 'RETINA_edits' } },
  { key: 'MINNIE', metrics: { edits: 'MINNIE_edits' } },
  { key: 'CA3',    metrics: { edits: 'CA3_edits' } },
  { key: 'BANC',   metrics: { edits: 'BANC_edits', cells: 'BANC_cells', labels: 'BANC_labels' } },
  { key: 'FAFB',   metrics: { edits: 'FAFB_edits', cells: 'FAFB_cells', labels: 'FAFB_labels' } },
];

export const ALL_TABS = DATASETS.flatMap(d => Object.values(d.metrics));
export { DATASETS };

// Deterministic 32-bit hash for name-only headers (no numeric ID).
function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Parse a raw gviz col label "<id> <Last, First>" into {id, rawName}.
// Some headers are name-only (no leading numeric id).
function parseHeader(label) {
  const h = (label || '').trim();
  const m = h.match(/^(\d+)\s+(.+)$/);
  if (m) return { id: m[1], rawName: m[2] };
  return { id: '', rawName: h };
}

function parseDateCell(cell) {
  if (!cell) return null;
  const v = cell.v;
  if (typeof v === 'string') {
    const dm = v.match(/^Date\((-?\d+),(-?\d+),(-?\d+)/);
    if (dm) return new Date(+dm[1], +dm[2], +dm[3]);
    const md = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (md) return new Date(+md[3], +md[1] - 1, +md[2]);
    const d = new Date(v);
    return isNaN(d) ? null : d;
  }
  return null;
}
function isoDate(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Extract raw per-tab {headers, dates, values} keeping a private stable key per person.
function extractTab(resp) {
  if (!resp || !resp.table) return null;
  const cols = resp.table.cols || [];
  const rows = resp.table.rows || [];
  const lastIdx = cols.length - 1;
  const peopleEnd = cols[lastIdx] && ((cols[lastIdx].label || '').toLowerCase().includes('average'))
    ? lastIdx : lastIdx + 1;
  const people = [];
  for (let c = 1; c < peopleEnd; c++) {
    const label = (cols[c] && cols[c].label) || '';
    if (!label.trim()) continue;
    const { id, rawName } = parseHeader(label);
    // privateKey: numeric id if present (stable across datasets), else name-hash.
    const privateKey = id ? ('id:' + id) : ('nm:' + hashStr(rawName.toLowerCase()));
    people.push({ colIdx: c, privateKey });
  }
  const dates = [];
  const values = [];
  for (const r of rows) {
    const cells = (r && r.c) || [];
    const d = parseDateCell(cells[0]);
    if (!d) continue;
    dates.push(isoDate(d));
    values.push(people.map(p => {
      const cell = cells[p.colIdx];
      const v = cell && cell.v;
      const n = typeof v === 'number' ? v : parseFloat(v);
      return Number.isFinite(n) ? n : 0;
    }));
  }
  return { people, dates, values };
}

/**
 * anonymizeSheet(tabResponses) — tabResponses: { [tabName]: rawGvizResponse }
 * Returns the public, name-free payload.
 */
export function anonymizeSheet(tabResponses, generatedAt = null) {
  // 1) Extract every tab, collecting the universe of private keys.
  const extracted = {};
  const keyUniverse = new Map(); // privateKey -> {isId, sortNum}
  for (const tab of ALL_TABS) {
    const ex = extractTab(tabResponses[tab]);
    if (!ex) continue;
    extracted[tab] = ex;
    for (const p of ex.people) {
      if (!keyUniverse.has(p.privateKey)) {
        const isId = p.privateKey.startsWith('id:');
        const sortNum = isId ? parseInt(p.privateKey.slice(3), 10) : Number.MAX_SAFE_INTEGER;
        keyUniverse.set(p.privateKey, { isId, sortNum });
      }
    }
  }

  // 2) Assign stable pseudonyms. Numeric-id workers sorted ascending first
  //    (deterministic), then name-only workers by their hash — so the same
  //    worker always maps to the same Tracer NN across all datasets.
  const keys = [...keyUniverse.entries()].sort((a, b) => {
    if (a[1].isId !== b[1].isId) return a[1].isId ? -1 : 1;
    if (a[1].sortNum !== b[1].sortNum) return a[1].sortNum - b[1].sortNum;
    return a[0] < b[0] ? -1 : 1;
  });
  const pidByKey = new Map();
  const roster = {};
  keys.forEach(([key], i) => {
    const n = i + 1;
    const pid = 'T' + String(n).padStart(3, '0');
    pidByKey.set(key, pid);
    roster[pid] = { label: 'Tracer ' + String(n).padStart(2, '0') };
  });

  // 3) Re-emit each tab with pseudonyms only. No names, no ids, no colIdx.
  const tabs = {};
  for (const [tab, ex] of Object.entries(extracted)) {
    tabs[tab] = {
      people: ex.people.map(p => {
        const pid = pidByKey.get(p.privateKey);
        return { id: pid, name: roster[pid].label };
      }),
      dates: ex.dates,
      values: ex.values,
    };
  }

  return {
    generatedAt,
    tabCount: Object.keys(tabs).length,
    contributorCount: keys.length,
    roster,
    tabs,
  };
}
