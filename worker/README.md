# Activity Dashboard — anonymizing proxy (Cloudflare Worker)

`activity-proxy.js` is a Cloudflare Worker that sits between the public
Activity Dashboard and the **private** Google Sheet. It fetches all 9
gviz tabs server-side, runs them through the shared anonymizer
(`anonymize.mjs`), and returns a payload containing **only pseudonyms** —
no real names, no numeric worker IDs, and no sheet ID. The sheet ID is
never present in any public artifact: the browser only ever talks to the
Worker, and the Worker reads the sheet ID from an environment binding.

- **Route:** `worker.borkbook.com/activity`
- **Method:** `GET` (plus `OPTIONS` for CORS preflight)
- **Entry:** `activity-proxy.js` (ES module — `export default { fetch }`)
- **Shared module:** `anonymize.mjs` (`anonymizeSheet(tabResponses, generatedAt)`, `ALL_TABS`) — do not fork; the same file drives the local snapshot builder so prod and local never drift.

## How it works

1. On `GET`, the Worker fetches each of the 9 gviz tabs named in
   `ALL_TABS` from
   `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=<tab>&headers=2`.
2. Each response is stripped of its JSONP wrapper
   (`/*O_o*/google.visualization.Query.setResponse( … )`) and parsed to JSON.
3. The `{ [tabName]: rawGvizResponse }` map is passed to
   `anonymizeSheet(map, new Date().toISOString())`.
4. The anonymized payload is returned as JSON with CORS + cache headers.

The **sheet ID is read from `env.SHEET_ID`** and is never hardcoded, so it
does not ship in the Worker source or in any response body.

## Environment binding — `SHEET_ID`

The Worker requires `env.SHEET_ID`. Store it as a **secret** (preferred, so
it is not visible in the dashboard/config) or as a plain var.

`wrangler.toml` example:

```toml
name = "activity-proxy"
main = "activity-proxy.js"
compatibility_date = "2024-11-01"

# Route the Worker at worker.borkbook.com/activity
# (worker.borkbook.com must be a zone/subdomain on your Cloudflare account)
[[routes]]
pattern = "worker.borkbook.com/activity"
zone_name = "borkbook.com"

# Option A (recommended): set SHEET_ID as a secret, NOT in this file:
#   wrangler secret put SHEET_ID
#
# Option B: plain var (visible in dashboard/config — avoid for anything sensitive):
# [vars]
# SHEET_ID = "your-sheet-id-here"
```

> `anonymize.mjs` is imported by `activity-proxy.js`, so it is bundled
> automatically by wrangler — no extra config needed.

## Deploy steps

```bash
# 1. Install wrangler (once)
npm install -g wrangler        # or: npm i -D wrangler

# 2. Authenticate to Cloudflare (once)
wrangler login

# 3. Provide the sheet ID as a secret (never committed)
wrangler secret put SHEET_ID
#   → paste the Google Sheet ID when prompted

# 4. Deploy
wrangler deploy

# 5. Verify (from an allowed origin)
curl -H "Origin: https://borkbook.com" https://worker.borkbook.com/activity
```

Local dev:

```bash
# Provide SHEET_ID locally via .dev.vars (git-ignored), containing:
#   SHEET_ID=your-sheet-id-here
wrangler dev
```

## CORS

`Access-Control-Allow-Origin` is **echoed per allowlist** — the response
carries the caller's `Origin` back only if it is one of:

- `https://borkbook.com`
- `https://bunprinceton.github.io`
- `http://localhost` (any port, e.g. `http://localhost:8000`)

Any other origin gets a response with **no** `Access-Control-Allow-Origin`
header (the browser blocks it). Preflight `OPTIONS` returns `204` with the
same allowlist rules. `Vary: Origin` is set so caches don't cross-pollinate
CORS headers between origins.

## Caching / refresh model

- **Edge cache:** the anonymized payload is stored in `caches.default`
  under an origin-neutral key (`https://worker.borkbook.com/activity`), so
  every allowed origin shares one cached copy. CORS headers are re-applied
  fresh on each response, so the cache never pins a single origin.
- **`Cache-Control: s-maxage=300`** — Cloudflare's shared cache serves the
  payload for up to 5 minutes before the Worker re-fetches the sheet. Good
  enough for a slowly-changing activity dashboard and keeps gviz load low.
- **Refresh:** clients simply re-`GET` the endpoint; a fresh payload
  (with an updated `generatedAt`) is produced at most every ~5 minutes.
  `X-Cache: HIT|MISS` indicates whether the edge cache served the request.
- Error responses (`502`, `500`) are sent with `Cache-Control: no-store`
  so transient upstream failures are never cached.

## Failure handling

- Any tab that fails to fetch/parse → **`502`** `{"error":"upstream_fetch_failed"}`.
- Anonymizer throws → **`502`** `{"error":"anonymize_failed"}`.
- Missing `env.SHEET_ID` → **`500`** `{"error":"server_misconfigured"}`.
- Non-GET (other than OPTIONS) → **`405`** `{"error":"method_not_allowed"}`.

None of these error bodies contain names, IDs, or the sheet ID.

## Public payload shape

Exactly what `anonymizeSheet` returns (names/IDs/sheet-id free):

```jsonc
{
  "generatedAt": "2026-07-07T18:22:04.531Z",   // request time, ISO 8601
  "tabCount": 9,                                 // tabs successfully parsed
  "contributorCount": 42,                        // distinct pseudonymous people
  "roster": {
    "T001": { "label": "Tracer 01" },
    "T002": { "label": "Tracer 02" }
    // … one entry per contributor, stable across datasets
  },
  "tabs": {
    "RETINA_edits": {
      "people": [ { "id": "T001", "name": "Tracer 01" }, … ],
      "dates":  [ "2026-01-01", "2026-01-02", … ],     // ISO date per row
      "values": [ [12, 0, …], [3, 7, …], … ]           // values[row][personIdx]
    },
    "MINNIE_edits":  { … },
    "CA3_edits":     { … },
    "BANC_edits":    { … }, "BANC_cells":  { … }, "BANC_labels":  { … },
    "FAFB_edits":    { … }, "FAFB_cells":  { … }, "FAFB_labels":  { … }
  }
}
```

`values[r][i]` is the value on `dates[r]` for `people[i]`. Pseudonyms are
stable **across** tabs/datasets: the same underlying worker is always the
same `T0NN` / `Tracer NN`.

## Recent cells feed (profile panel → "Recent Cells")

A second, independent pipeline feeds the **Recent Cells** section of the contributor
profile on each dataset page: the cells a tracer edited most recently, each with the
root(s) it was *right before* that tracer's first edit, so the viewer can open a
Spelunker link that overlays *before* (amber, pinned to a past timestamp) against
*now* (live). Two steps, both local:

1. `python worker/build_recent_cells.py [--days 7] [--per-user 15] [--only BANC]`
   Crawls PyChunkedGraph with the local CAVE token using only **view-level**
   endpoints (no admin): operation ids are a sequential counter, so it walks
   `operation_details` id ranges back to the window start (~10k ids/day on BANC,
   500 ids per 0.2 s call), keeps successful ops, resolves each op's supervoxel to
   its **current** root (`get_roots` at now, batched) and the first-edit
   supervoxels to their roots one second **before** that edit (`get_roots` at
   `t0 - 1s`). Writes `worker/recent-cells-raw.json` (git-ignored: keyed by REAL
   CAVE user ids) and `worker/recent-cells-state.json`. Datastacks: RETINA=`stroeh_mouse_retina`, MINNIE=`minnie65_phase3_v1`,
   CA3=`zheng_ca3`, BANC=`brain_and_nerve_cord`, FAFB=`flywire_fafb_production`.
   Datasets are crawled per CAVE **server group** (`SERVER_GROUPS`): RETINA/MINNIE/CA3
   share minnie.microns-daf.com and run one after another (its l2cache limit of
   600 req/min is per server), while BANC (cave.fanc-fly.com) runs concurrently in
   its own thread. Log lines carry a `[DATASET]` prefix. Whole run ≈ 9 min.
2. `node worker/build-recent-cells.mjs`
   Maps user id → `Tracer NN` with the SAME `pseudonymMap()` the snapshot uses
   (sheet headers are `<CAVE user id> <name>`), drops users not in the sheet, and
   writes `datasets/data/recent-cells/<DATASET>.json` (~20–100 KB each). Refuses
   to write on any tracked id / real name / sheet id leak (exit 2).

The site fetches a dataset's file **only when the viewer clicks "Load recent
cells"** in a profile (cached in memory afterwards), so the feature costs nothing
on page load. Link building is pure client-side JSON: EM layer + one
`timestamp`-pinned segmentation layer per selected cell (Spelunker-only key,
milliseconds) + one live layer holding all selected current roots + one
`local://annotations` layer per cell ("edits") replaying the tracer's operations.

Edit points (added 2026-09-17): each cell's `edits[]` lists every operation the
tracer made on it in chronological order — `{id, t, k: 'm'|'s', a: [[x,y,z]…],
b: [[x,y,z]…]}` with `a` = source click(s) and `b` = sink click(s) in **nm**
(operation coords come back in segmentation-base voxels, which differ from the
viewer resolution on BANC; `viewer.segRes` records that base). `editsTotal` is
the true count when a cell exceeds the 400-entry cap. The viewer turns each
click into a point marker and each operation into a source→sink line, colored
cyan (merge) / magenta (split) through an `annotationProperties` color prop, and
numbers them `#1, #2…` in the description (with UTC time and the elapsed time
since the tracer's first edit on that cell). The link opens with the first
cell's "edits" layer selected so its annotation list is the replay.

Stray ops (added 2026-09-23): a row only keeps the operations that actually
landed on its cell. At the tracer's last edit every op's edge supervoxels are
resolved to their root; an op none of whose supervoxels sit on the row's main
root or one of its cut-off pieces was an edit on a *different* neuron and is spun
off into a row of its own for that neuron (grouped by the source-side root, then
subject to the same most-recent-15-per-tracer cut). This is what stops a "sweep"
session — cut a bit off neuron A, merge it into B, cut a bit off B, merge into
C … — from collapsing through the lineage union into one impossible 300-edit row
on a one-node fragment with replay points scattered over dozens of neurons that
the link never loads. Ops whose supervoxels cannot be resolved stay with the row.

### Proofreading status, live from CAVE (added 2026-09-23)

The Recent Cells list has a **Check proofreading status** button that asks CAVE, with the
*viewer's own* token, which of the listed cells are marked proofread. This is the
"tie the dataset tracker to CAVE authentication tokens" request, reading 2 (live status;
sign-in-to-see-names can be layered on later since the token plumbing is now there).

- **Sign-in:** the token lives only in the browser's `localStorage['cave_token']`, the same
  slot `/link-restore/` uses, and that page (`?cave_auth_return=1`) doubles as the popup
  receiver for the `global.daf-apis.com/sticky_auth` flow. A paste-a-token fallback exists.
  The token is validated with `GET global.daf-apis.com/auth/api/v1/user/me` (CORS allows
  borkbook.com) and shown as "user #id" only.
- **Lookup:** `RC_PROOF` in `activity-core.js` maps each dataset to its status tables:
  BANC `backbone_proofread` (bool); MINNIE `vortex_proofreading_status` (bool, the 611
  assignment table) + `proofreading_status_and_strategy` (axon/dendrite status + strategy);
  RETINA and CA3 have no live status table (RETINA only has 2025 `test0N_sstroeh_table_proofstatus`
  tests and EyeWire II tags) so the button explains that instead.
  Calls: `POST <server>/segmentation/api/v1/table/<seg>/is_latest_roots` (which roots on file
  are still current), then `POST <server>/materialize/api/v3/datastack/<ds>/query?return_pyarrow=False&arrow_format=False`
  with `{table, timestamp: now, filter_in_dict: {table: {pt_root_id: [...]}}}` in chunks of
  100 (the server 500s on any root that is not current at the timestamp, so the is-latest
  filter comes first; 200 ids ≈ 7 s, 100 ≈ 2.5 s). Materialize CORS is `*`; the segmentation
  and auth servers echo `https://borkbook.com` only.
- **Root ids exceed 2^53:** bodies are built as text and responses go through `rcParseBig`
  (quotes 16+ digit integers before `JSON.parse`).
- **Rendering:** blue pill = marked (site palette is blue/amber, no red/green semantics),
  grey = not marked / false, amber = "changed since update · status unknown" (root no
  longer current). The tables' `user_id` (who marked it) is never rendered.

Privacy note: the public files contain pseudonyms and root ids only. Root ids
are not personal data, but anyone with CAVE access could look a root's change
log up and learn who a pseudonym is — weaker than the counts-only snapshot.
