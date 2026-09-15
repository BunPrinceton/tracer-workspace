#!/usr/bin/env python
"""
build_recent_cells.py - LOCAL crawler: recent cells edited per CAVE user, per dataset.

Runs on this machine only (needs ~/.cloudvolume/secrets/cave-secret.json). Uses only
view-level PyChunkedGraph endpoints (no admin needed):

  operation_details(ids)      -> user, timestamp, resulting roots, touched supervoxels
  get_roots(svs, timestamp)   -> root a supervoxel belonged to at a given time

Operation ids are a sequential counter per table, so the recent edit feed is simply
"fetch operation details for the id range since last run". We walk backwards from the
current max id until we pass the window start.

OUTPUT (git-ignored, contains REAL numeric CAVE user ids - never publish):
  worker/recent-cells-raw.json
STATE (git-ignored):
  worker/recent-cells-state.json   (last max operation id per datastack)

The public, pseudonymized files are produced by worker/build-recent-cells.mjs.

Usage:  python worker/build_recent_cells.py [--days 14] [--per-user 15] [--only BANC,RETINA]
"""
import argparse, datetime as dt, json, os, sys, time
from collections import defaultdict

import numpy as np
from caveclient import CAVEclient

HERE = os.path.dirname(os.path.abspath(__file__))
RAW_PATH = os.path.join(HERE, 'recent-cells-raw.json')
STATE_PATH = os.path.join(HERE, 'recent-cells-state.json')

# Site dataset key -> CAVE datastack. Keep in sync with anonymize.mjs DATASETS.
DATASTACKS = {
    'RETINA': 'stroeh_mouse_retina',
    'MINNIE': 'minnie65_phase3_v1',
    'CA3':    'zheng_ca3',
    'BANC':   'brain_and_nerve_cord',
    'FAFB':   'flywire_fafb_production',
}

CHUNK = 500          # operation ids per operation_details call (0.2s each on BANC)
PROBE = 400          # width of the existence probe (ids travel in the query string; >~500 -> HTTP 414)
ROOTS_BATCH = 2000   # supervoxels per get_roots call


def log(*a):
    print(time.strftime('%H:%M:%S'), *a, flush=True)


def parse_ts(s):
    """'2026-09-15 05:42:44.449000+00:00' -> ms since epoch (int)."""
    if isinstance(s, (int, float)):
        return int(s)
    d = dt.datetime.fromisoformat(str(s).replace('Z', '+00:00'))
    if d.tzinfo is None:
        d = d.replace(tzinfo=dt.timezone.utc)
    return int(d.timestamp() * 1000)


def op_details(cg, ids):
    """operation_details for a list of ids; missing ids are simply absent."""
    if not ids:
        return {}
    for attempt in range(3):
        try:
            return cg.get_operation_details([int(i) for i in ids])
        except Exception as e:
            if attempt == 2:
                raise
            log('  retry operation_details:', str(e)[:120])
            time.sleep(2)


def find_max_op_id(cg, hint=None):
    """Binary-search the highest existing operation id using existence probes."""
    def exists_at_or_above(x):
        return len(op_details(cg, range(x, x + PROBE))) > 0
    lo = 1
    hi = max(hint or 0, 1)
    # grow hi until nothing exists at/above it
    while exists_at_or_above(hi):
        lo = hi
        hi = hi * 2 if hi > 1 else 1024
    # now ops exist at lo (or lo==1), none at hi
    while hi - lo > PROBE // 4:
        mid = (lo + hi) // 2
        if exists_at_or_above(mid):
            lo = mid
        else:
            hi = mid
    tail = op_details(cg, range(lo, hi + PROBE))
    return max(int(k) for k in tail) if tail else lo


def op_supervoxels(op):
    svs = []
    for key in ('added_edges', 'removed_edges'):
        for e in op.get(key) or []:
            for sv in e:
                try:
                    svs.append(int(sv))
                except (TypeError, ValueError):
                    pass
    for key in ('source_ids', 'sink_ids'):
        for sv in op.get(key) or []:
            try:
                svs.append(int(sv))
            except (TypeError, ValueError):
                pass
    # dedupe, keep order
    seen, out = set(), []
    for s in svs:
        if s not in seen:
            seen.add(s); out.append(s)
    return out


def crawl_ops(cg, window_start_ms, max_id, last_seen_id=None, hard_cap=400000):
    """Walk op ids downward from max_id collecting successful ops inside the window."""
    ops = []
    hi = max_id
    lowest_id = max_id
    stop_id = (last_seen_id or 0)
    calls = 0
    while hi > 0 and (max_id - hi) < hard_cap:
        lo = max(1, hi - CHUNK + 1)
        batch = op_details(cg, range(lo, hi + 1))
        calls += 1
        oldest_in_batch = None
        for k, op in batch.items():
            ts = parse_ts(op.get('timestamp') or op.get('operation_ts'))
            oldest_in_batch = ts if oldest_in_batch is None else min(oldest_in_batch, ts)
            if ts < window_start_ms:
                continue
            if op.get('operation_status', 0) not in (0, '0', None):
                continue
            if op.get('operation_exception'):
                continue
            ops.append({
                'id': int(k),
                'user': str(op.get('user')),
                'ts': ts,
                'roots': [int(r) for r in (op.get('roots') or [])],
                'svs': op_supervoxels(op),
                'merge': bool(op.get('added_edges')),
                'xyz': (op.get('sink_coords') or op.get('source_coords') or [None])[0],
            })
        lowest_id = lo
        if batch and oldest_in_batch is not None and oldest_in_batch < window_start_ms:
            break
        if lo <= stop_id:
            break
        hi = lo - 1
    log(f'  scanned ids {lowest_id}..{max_id} in {calls} calls -> {len(ops)} ops in window')
    return ops


def roots_for(cg, svs, timestamp=None):
    """Batched get_roots; returns {sv: root}."""
    out = {}
    svs = [int(s) for s in svs]
    for i in range(0, len(svs), ROOTS_BATCH):
        chunk = svs[i:i + ROOTS_BATCH]
        for attempt in range(3):
            try:
                r = cg.get_roots(np.array(chunk, dtype=np.uint64), timestamp=timestamp)
                break
            except Exception as e:
                if attempt == 2:
                    raise
                log('  retry get_roots:', str(e)[:120]); time.sleep(2)
        for sv, root in zip(chunk, r):
            out[sv] = int(root)
    return out


def build_dataset(ds_key, datastack, window_days, per_user, state):
    client = CAVEclient(datastack)
    cg = client.chunkedgraph
    info = client.info.get_datastack_info()
    viewer = {
        'site': (info.get('viewer_site') or 'https://spelunker.cave-explorer.org/').rstrip('/') + '/',
        'seg': info.get('segmentation_source'),
        'img': (info.get('aligned_volume') or {}).get('image_source'),
        'res': [info.get('viewer_resolution_x'), info.get('viewer_resolution_y'), info.get('viewer_resolution_z')],
    }
    now_ms = int(time.time() * 1000)
    window_start = now_ms - window_days * 86400 * 1000

    st = state.get(datastack) or {}
    t0 = time.time()
    max_id = find_max_op_id(cg, hint=st.get('max_id'))
    log(f'  max operation id {max_id} (found in {time.time()-t0:.1f}s)')
    ops = crawl_ops(cg, window_start, max_id)
    state[datastack] = {'max_id': max_id, 'checked': dt.datetime.utcnow().isoformat() + 'Z'}
    if not ops:
        return {'viewer': viewer, 'users': {}, 'ops': 0, 'maxOp': max_id}

    # One representative supervoxel per op -> its CURRENT root (batched, one timestamp).
    rep = {o['id']: (o['svs'][0] if o['svs'] else None) for o in ops}
    cur = roots_for(cg, [sv for sv in rep.values() if sv])
    # Group per (user, current root)
    groups = defaultdict(list)
    for o in ops:
        sv = rep[o['id']]
        root = cur.get(sv) if sv else (o['roots'][0] if o['roots'] else None)
        if not root:
            continue
        groups[(o['user'], root)].append(o)

    users = defaultdict(list)
    for (user, root), gops in groups.items():
        gops.sort(key=lambda o: o['ts'])
        first, last = gops[0], gops[-1]
        users[user].append({
            'root': str(root),
            't0': first['ts'], 't1': last['ts'],
            'ops': len(gops),
            'merges': sum(1 for o in gops if o['merge']),
            'splits': sum(1 for o in gops if not o['merge']),
            'xyz': last['xyz'],
            '_first_svs': first['svs'][:4],
        })
    # Keep the most recent N cells per user, then resolve "before" roots for those only.
    n_before_calls = 0
    for user, cells in users.items():
        cells.sort(key=lambda c: c['t1'], reverse=True)
        del cells[per_user:]
        for c in cells:
            svs = c.pop('_first_svs')
            before = []
            if svs:
                ts_before = dt.datetime.fromtimestamp((c['t0'] - 1000) / 1000, tz=dt.timezone.utc)
                try:
                    br = roots_for(cg, svs, timestamp=ts_before)
                    n_before_calls += 1
                    before = sorted({str(r) for r in br.values() if r})
                except Exception as e:
                    log('  before-roots failed for', c['root'], str(e)[:100])
            c['before'] = before
            c['tBefore'] = c['t0'] - 1000
    log(f'  {len(ops)} ops -> {len(groups)} user-cells, {len(users)} users, {n_before_calls} before-root lookups')
    return {'viewer': viewer, 'users': dict(users), 'ops': len(ops), 'maxOp': max_id, 'windowDays': window_days}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--days', type=int, default=14)
    ap.add_argument('--per-user', type=int, default=15)
    ap.add_argument('--only', default='')
    args = ap.parse_args()
    only = {s.strip().upper() for s in args.only.split(',') if s.strip()}

    state = {}
    if os.path.exists(STATE_PATH):
        with open(STATE_PATH) as f:
            state = json.load(f)
    raw = {}
    if os.path.exists(RAW_PATH):
        with open(RAW_PATH) as f:
            raw = json.load(f)
    out = raw.get('datasets', {})
    for ds_key, datastack in DATASTACKS.items():
        if only and ds_key not in only:
            continue
        log(f'== {ds_key} ({datastack})')
        t0 = time.time()
        try:
            out[ds_key] = build_dataset(ds_key, datastack, args.days, args.per_user, state)
            out[ds_key]['generatedAt'] = dt.datetime.utcnow().isoformat() + 'Z'
            log(f'  done in {time.time()-t0:.1f}s')
        except Exception as e:
            log(f'  FAILED: {str(e)[:300]}')
    with open(STATE_PATH, 'w') as f:
        json.dump(state, f, indent=1)
    with open(RAW_PATH, 'w') as f:
        json.dump({'generatedAt': dt.datetime.utcnow().isoformat() + 'Z', 'datasets': out}, f)
    log('wrote', RAW_PATH)


if __name__ == '__main__':
    main()
