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
