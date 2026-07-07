/* ============================================================
   activity-proxy.js — Cloudflare Worker (ES module format).

   The anonymizing proxy for the Activity Dashboard. It server-side
   fetches all 9 gviz tabs from the private Google Sheet, runs them
   through the SHARED anonymizer (anonymize.mjs), and returns a
   payload that contains ONLY pseudonyms — never a real name, a
   numeric worker ID, or the sheet ID.

   The sheet ID lives in env.SHEET_ID (a wrangler secret/var), so it
   never ships in any public artifact. Nothing about the upstream
   sheet is observable from the response or from this source file.

   Route:  worker.borkbook.com/activity   (GET)
   ============================================================ */

import { anonymizeSheet, ALL_TABS } from './anonymize.mjs';

// CORS allowlist. Access-Control-Allow-Origin is echoed only for an
// exact match (localhost allowed on any port).
const ALLOWED_ORIGINS = [
  'https://borkbook.com',
  'https://bunprinceton.github.io',
];

function corsOrigin(origin) {
  if (!origin) return null;
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  // http://localhost or http://localhost:<port>
  if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return origin;
  return null;
}

function corsHeaders(origin) {
  const h = {
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  const allowed = corsOrigin(origin);
  if (allowed) h['Access-Control-Allow-Origin'] = allowed;
  return h;
}

function jsonResponse(obj, status, origin, extraHeaders = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(origin),
      ...extraHeaders,
    },
  });
}

// Strip the gviz JSONP wrapper:
//   /*O_o*/google.visualization.Query.setResponse({...});
// and return the parsed JSON object.
function stripJsonp(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('unrecognized gviz response');
  }
  return JSON.parse(text.slice(start, end + 1));
}

async function fetchTab(sheetId, tab) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq` +
    `?tqx=out:json&sheet=${encodeURIComponent(tab)}&headers=2`;
  const r = await fetch(url, {
    // gviz occasionally 302s; follow and treat non-2xx as a failure.
    cf: { cacheTtl: 60, cacheEverything: true },
  });
  if (!r.ok) throw new Error(`tab "${tab}" upstream ${r.status}`);
  const t = await r.text();
  return stripJsonp(t);
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin');

    // --- CORS preflight ---
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== 'GET') {
      return jsonResponse({ error: 'method_not_allowed' }, 405, origin);
    }

    if (!env.SHEET_ID) {
      // Misconfiguration — never leak details, just fail closed.
      return jsonResponse({ error: 'server_misconfigured' }, 500, origin);
    }

    // --- Cheap in-Worker edge cache (caches.default) ---
    // Key on a stable, origin-independent URL so all allowed origins
    // share one cached anonymized payload. CORS headers are applied
    // fresh on every response so the cache never pins one origin.
    const cache = caches.default;
    const cacheKey = new Request('https://worker.borkbook.com/activity', {
      method: 'GET',
    });

    let cached = await cache.match(cacheKey);
    if (cached) {
      const body = await cached.text();
      return new Response(body, {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 's-maxage=300',
          'X-Cache': 'HIT',
          ...corsHeaders(origin),
        },
      });
    }

    // --- Fetch all 9 tabs server-side, in parallel ---
    let tabResponses;
    try {
      const results = await Promise.all(
        ALL_TABS.map(async (tab) => [tab, await fetchTab(env.SHEET_ID, tab)])
      );
      tabResponses = Object.fromEntries(results);
    } catch (err) {
      return jsonResponse(
        { error: 'upstream_fetch_failed' },
        502,
        origin,
        { 'Cache-Control': 'no-store' }
      );
    }

    // --- Anonymize. generatedAt = request time. ---
    let payload;
    try {
      payload = anonymizeSheet(tabResponses, new Date().toISOString());
    } catch (err) {
      return jsonResponse(
        { error: 'anonymize_failed' },
        502,
        origin,
        { 'Cache-Control': 'no-store' }
      );
    }

    const body = JSON.stringify(payload);

    // Store an origin-neutral copy in the edge cache (no CORS header baked in).
    const toCache = new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 's-maxage=300',
      },
    });
    ctx.waitUntil(cache.put(cacheKey, toCache.clone()));

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 's-maxage=300',
        'X-Cache': 'MISS',
        ...corsHeaders(origin),
      },
    });
  },
};
