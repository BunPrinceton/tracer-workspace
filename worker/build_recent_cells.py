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

Usage:  python worker/build_recent_cells.py [--days 7] [--per-user 15] [--only BANC,RETINA]
"""
import argparse, datetime as dt, json, os, random, sys, time
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor

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
L2_SAMPLE = 100      # L2 nodes sampled per cell for the centroid / extent (l2cache call dominates cost)
CENTROID_WORKERS = 4 # l2cache is rate-limited to 600 req/min per server; 2 calls per cell -> keep this low
BEFORE_WORKERS = 8   # parallel get_roots(timestamp) lookups (one per kept cell)
PRE_CUT = 40         # candidates per user kept for lineage grouping before the final per-user cut
MAX_PIECES = 10      # current fragments listed per cell (largest first)
FOREIGN_FRAC = 0.25  # far side of a split counts as a cut-off only if <= this fraction of the main cell's L2 nodes
PIECE_WORKERS = 8    # get_latest_roots / get_leaves are chunkedgraph calls (not l2cache-rate-limited)


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


def cell_geometry(client, root, _retries=0):
    """Centroid + extent (nm) of a root from a sample of its L2 nodes' rep coords."""
    try:
        l2 = client.chunkedgraph.get_leaves(int(root), stop_layer=2)
        l2 = [int(x) for x in l2]
        if not l2:
            return None
        if len(l2) > L2_SAMPLE:
            l2 = random.sample(l2, L2_SAMPLE)
        d = client.l2cache.get_l2data(l2, attributes=['rep_coord_nm'])
        pts = np.array([v['rep_coord_nm'] for v in d.values() if v.get('rep_coord_nm')], dtype=float)
        if not len(pts):
            return None
        c = pts.mean(axis=0); ext = pts.max(axis=0) - pts.min(axis=0)
        return {'centerNm': [int(x) for x in c], 'extentNm': [int(x) for x in ext], 'l2': len(d)}
    except Exception as e:
        if '429' in str(e) and _retries < 3:
            time.sleep(15 * (_retries + 1))
            return cell_geometry(client, root, _retries + 1)
        log('  geometry failed for', root, str(e)[:100])
        return None


def _l2set(cg, root):
    try:
        return set(int(x) for x in cg.get_leaves(int(root), stop_layer=2))
    except Exception:
        return set()


def score_pieces(cg, roots, touched, desc, orig, main_root=None):
    """Rank a set of roots (fragments of one cell).
       main   = the largest fragment holding the tracer's edit points (else the one with most ORIGINAL material)
       kept   = main + cut-off pieces:
                * descendants of the original cell (desc) that are mostly original material, or tiny
                  -> "cut off"; descendants that are mostly OTHER material were merged into a
                  different neuron -> excluded, counted as n_away ("merged elsewhere")
                * other touched roots (the far side of a split edge) only when they are small next
                  to main (a wrong bit snipped off the cell). A large far side is a NEIGHBOUR the
                  tracer took a piece from (their cell grew by it), never a cut-off -> dropped silently.
       Returns (main, kept_pieces, n_away) or (None, [], 0). Pieces carry their L2 set in '_l2'."""
    pieces = []
    for r in list(roots)[:MAX_PIECES * 2]:
        l2 = _l2set(cg, r)
        shared = len(l2 & orig)
        pieces.append({'root': str(r), 'l2': len(l2), 'orig': shared,
                       'frac': (shared / len(l2)) if l2 else 0.0, '_l2': l2})
    if not pieces:
        return None, [], 0
    touched = set(str(t) for t in touched)
    desc = set(str(d) for d in desc)
    main = next((p for p in pieces if main_root and p['root'] == str(main_root)), None)
    if main is None:
        hit = [p for p in pieces if p['root'] in touched]
        if hit:
            hit.sort(key=lambda p: (-p['l2'], -p['orig']))
            main = hit[0]
        else:
            pieces.sort(key=lambda p: (-p['orig'], -p['l2']))
            main = pieces[0]
    kept, away = [main], []
    for p in pieces:
        if p is main:
            continue
        if p['root'] in desc:
            if p['frac'] >= 0.5 or p['l2'] <= 3 or not orig:
                kept.append(p)
            else:
                away.append(p)
        elif p['root'] in touched and (p['l2'] <= 3 or p['l2'] <= FOREIGN_FRAC * main['l2']):
            kept.append(p)
    kept.sort(key=lambda p: (p is not main, -p['l2']))
    return main, kept[:MAX_PIECES], len(away)


def cell_states(cg, cell):
    """Fill the cell with:
       - root/roots/pieces/mergedAway  = the cell AS THE TRACER LEFT IT (pinned at tNow = last edit + 1 s)
       - before                        = the TRUNK: the pre-session root that contributes the most
                                         material to that cell (replaces the first-edit roots, which
                                         are kept only as the lineage/grouping key)
       - today                         = the live descendant of the cell (never a neighbour)
       - _live                         = current roots of the cell (for the edits-by-others signal)
    Pinning at the last edit keeps other people's later work out of the tracer's picture."""
    first_before = [int(b) for b in cell.get('before') or []]
    t_now = cell['t1'] + 1000
    ts_now = dt.datetime.fromtimestamp(t_now / 1000, tz=dt.timezone.utc)
    ts_before = dt.datetime.fromtimestamp(cell['tBefore'] / 1000, tz=dt.timezone.utc)
    # --- 1. the cell at the tracer's last edit: candidates = what the first-edit roots became + the
    #        roots at tNow of the tracer's own edit supervoxels; main = largest one holding edit points
    desc1 = set()
    for b in first_before:
        try:
            desc1.update(str(int(x)) for x in cg.get_latest_roots(b, timestamp=ts_now))
        except Exception as e:
            log('  latest-roots@t1 failed for', b, str(e)[:80])
    touched1 = set()
    svs = [int(x) for x in (cell.get('_svs_all') or [])]
    if svs:
        try:
            touched1 = set(str(r) for r in roots_for(cg, svs, timestamp=ts_now).values() if r)
        except Exception as e:
            log('  touched@t1 failed for', cell.get('roots'), str(e)[:80])
    orig_first = set()
    for b in first_before:
        orig_first |= _l2set(cg, b)
    main1, _, _ = score_pieces(cg, desc1 | touched1, touched1, desc1, orig_first)
    if not main1:
        cell['tNow'] = t_now
        cell['today'] = cell.get('root')
        for k in ('_edit_roots', '_desc', '_svs_all'):
            cell.pop(k, None)
        return cell
    main_l2 = main1['_l2']
    # --- 2. trunk: which pre-session root do most of the cell's L2 nodes come from?
    #        (get_roots accepts L2 ids; nodes created during the session come back as 0)
    trunk = None
    if main_l2:
        try:
            r = cg.get_roots(np.array(sorted(main_l2), dtype=np.uint64), timestamp=ts_before)
            counts = Counter(int(x) for x in r if int(x))
            if counts:
                trunk = counts.most_common(1)[0][0]
        except Exception as e:
            log('  trunk lookup failed for', main1['root'], str(e)[:80])
    if trunk:
        cell['before'] = [str(trunk)]
        orig = _l2set(cg, trunk)
        desc = set()
        try:
            desc = set(str(int(x)) for x in cg.get_latest_roots(trunk, timestamp=ts_now))
        except Exception as e:
            log('  latest-roots@t1 failed for trunk', trunk, str(e)[:80])
    else:
        orig, desc = orig_first, desc1
    # --- 3. cut-offs: fragments of the trunk + small far sides of the tracer's splits
    main, kept, away = score_pieces(cg, desc | touched1 | {main1['root']}, touched1, desc, orig, main_root=main1['root'])
    cell['root'] = main['root']
    cell['roots'] = [p['root'] for p in kept]
    cell['pieces'] = [{'root': p['root'], 'l2': p['l2']} for p in kept]
    if away:
        cell['mergedAway'] = away
    cell['tNow'] = t_now
    # --- 4. today: the live descendant of the cell as they left it (largest shared material)
    live = []
    try:
        live = [str(int(x)) for x in cg.get_latest_roots(int(main['root']))]
    except Exception as e:
        log('  latest-roots@now failed for', main['root'], str(e)[:80])
    if not live or live == [main['root']]:
        cell['today'] = main['root']
    else:
        best, best_n = None, -1
        for r in live[:MAX_PIECES * 2]:
            n = len(_l2set(cg, r) & main_l2)
            if n > best_n:
                best, best_n = r, n
        cell['today'] = best or main['root']
    cell['_live'] = sorted(set(live) | {cell['today']})
    for k in ('_edit_roots', '_desc', '_svs_all'):
        cell.pop(k, None)
    return cell


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

    # Representative supervoxel per op -> its CURRENT root (batched, one timestamp). The second
    # supervoxel of the first edge is the OTHER side of a split (or the merged-in piece), so its
    # current root also counts as "touched" by the tracer.
    rep = {o['id']: (o['svs'][0] if o['svs'] else None) for o in ops}
    alt = {o['id']: (o['svs'][1] if len(o['svs']) > 1 else None) for o in ops}
    cur = roots_for(cg, sorted({sv for sv in list(rep.values()) + list(alt.values()) if sv}))
    # Group per (user, current root)
    groups = defaultdict(list)
    for o in ops:
        sv = rep[o['id']]
        root = cur.get(sv) if sv else (o['roots'][0] if o['roots'] else None)
        if not root:
            continue
        groups[(o['user'], root)].append(o)

    # Stage 1: one candidate per (user, current root); keep the PRE_CUT most recent per user.
    users = defaultdict(list)
    for (user, root), gops in groups.items():
        gops.sort(key=lambda o: o['ts'])
        first, last = gops[0], gops[-1]
        touched = {str(root)} | {str(cur[alt[o['id']]]) for o in gops if alt[o['id']] and cur.get(alt[o['id']])}
        users[user].append({
            'roots': [str(root)],
            '_touched': sorted(touched),
            't0': first['ts'], 't1': last['ts'],
            'ops': len(gops),
            'merges': sum(1 for o in gops if o['merge']),
            'splits': sum(1 for o in gops if not o['merge']),
            'xyz': last['xyz'],
            '_first_svs': first['svs'][:4],
            # a few supervoxels spread over the ops (first, last, middle) for "touched at last edit"
            '_svs_all': sorted({sv for o in (first, last, gops[len(gops) // 2]) for sv in o['svs'][:2]}),
        })
    for user, cells in users.items():
        cells.sort(key=lambda c: c['t1'], reverse=True)
        del cells[PRE_CUT:]
    cand = [c for cells in users.values() for c in cells]

    def resolve_before(c):
        """Roots of the candidate's first-edit supervoxels one second before that edit."""
        svs = c.get('_first_svs') or []
        c['tBefore'] = c['t0'] - 1000
        c['before'] = []
        if not svs:
            return
        ts_before = dt.datetime.fromtimestamp(c['tBefore'] / 1000, tz=dt.timezone.utc)
        try:
            br = roots_for(cg, svs, timestamp=ts_before)
            c['before'] = sorted({str(r) for r in br.values() if r})
        except Exception as e:
            log('  before-roots failed for', c['roots'][0], str(e)[:100])
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=BEFORE_WORKERS) as ex:
        list(ex.map(resolve_before, cand))
    # Lineage key: the root each candidate's first supervoxel belonged to at the START of the
    # window (one batched call). Pieces of one cell share it even when their per-edit "before"
    # ids differ (e.g. the tracer edited, then split, then edited each side).
    ws_ts = dt.datetime.fromtimestamp(window_start / 1000, tz=dt.timezone.utc)
    all_svs = sorted({sv for c in cand for sv in (c.get('_first_svs') or [])[:2]})
    try:
        ws_roots = roots_for(cg, all_svs, timestamp=ws_ts)
    except Exception as e:
        log('  window-start roots failed:', str(e)[:120]); ws_roots = {}
    for c in cand:
        c['_lineage'] = sorted({str(ws_roots[sv]) for sv in (c.get('_first_svs') or [])[:2] if ws_roots.get(sv)})

    # Current descendants of each candidate's before-root(s): what that cell became. Used both as a
    # grouping key (a seed the tracer grew by merging shares descendants with the grown cell even
    # though neither its before-root nor its edit points match) and later as the fragment list.
    def resolve_desc(c):
        d = set()
        for b in c.get('before') or []:
            try:
                d.update(str(int(x)) for x in cg.get_latest_roots(int(b)))
            except Exception as e:
                log('  latest-roots failed for', b, str(e)[:80])
        c['_desc'] = sorted(d)
    with ThreadPoolExecutor(max_workers=PIECE_WORKERS) as ex:
        list(ex.map(resolve_desc, cand))
    log(f'  {len(ops)} ops -> {len(groups)} user-cells, {len(users)} users, {len(cand)} before-root lookups + {len(all_svs)} lineage keys in {time.time()-t0:.0f}s')

    # Stage 2: lineage grouping per user. Candidates that share a "before" root (a cell the
    # tracer later split) or a current root (pieces the tracer merged) are ONE cell: its
    # "before" is the state at the tracer's EARLIEST touch, its "now" the state after the LATEST.
    def union_cells(cells):
        parent = list(range(len(cells)))
        def find(i):
            while parent[i] != i:
                parent[i] = parent[parent[i]]; i = parent[i]
            return i
        seen = {}
        for i, c in enumerate(cells):
            for key in [('b', b) for b in c['before']] + [('n', r) for r in c['roots']] + [('n', d) for d in c.get('_desc', [])] + [('l', l) for l in c.get('_lineage', [])]:
                if key in seen:
                    parent[find(i)] = find(seen[key])
                else:
                    seen[key] = i
        comp = defaultdict(list)
        for i in range(len(cells)):
            comp[find(i)].append(cells[i])
        merged = []
        for members in comp.values():
            members.sort(key=lambda c: c['t0'])
            earliest = members[0]
            latest = max(members, key=lambda c: c['t1'])
            if len(members) == 1:
                m = dict(earliest); m['_regroup_svs'] = None
            else:
                m = {
                    'roots': sorted({r for c in members for r in c['roots']}),
                    '_desc': sorted({d for c in members for d in c.get('_desc', [])}),
                    '_touched': sorted({t for c in members for t in c.get('_touched', [])}),
                    '_svs_all': sorted({sv for c in members for sv in c.get('_svs_all', [])})[:12],
                    't0': earliest['t0'], 't1': latest['t1'],
                    'ops': sum(c['ops'] for c in members),
                    'merges': sum(c['merges'] for c in members),
                    'splits': sum(c['splits'] for c in members),
                    'xyz': latest['xyz'],
                    # "before" = ONLY what the tracer's very FIRST edit on this lineage touched, one
                    # second before it. Pieces joined by later edits are growth (translucent colour),
                    # even if the tracer edited them separately first; their trimmed fragments are
                    # still found via the descendants union above.
                    'tBefore': earliest['tBefore'],
                    'before': list(earliest['before']),
                    '_regroup_svs': None,
                    '_first_svs': earliest.get('_first_svs'),
                }
            m['root'] = latest['roots'][0] if latest['roots'] else m['roots'][0]
            merged.append(m)
        return merged

    regroup = []
    for user in list(users.keys()):
        merged = union_cells(users[user])
        merged.sort(key=lambda c: c['t1'], reverse=True)
        del merged[per_user:]
        users[user] = merged
        regroup.extend(c for c in merged if c.get('_regroup_svs'))

    def resolve_group_before(c):
        svs = c.pop('_regroup_svs')
        ts_before = dt.datetime.fromtimestamp(c['tBefore'] / 1000, tz=dt.timezone.utc)
        try:
            br = roots_for(cg, svs, timestamp=ts_before)
            c['before'] = sorted({str(r) for r in br.values() if r})
        except Exception as e:
            log('  group before-roots failed for', c['root'], str(e)[:100])
    with ThreadPoolExecutor(max_workers=BEFORE_WORKERS) as ex:
        list(ex.map(resolve_group_before, regroup))
    for cells in users.values():
        for c in cells:
            c.pop('_first_svs', None); c.pop('_regroup_svs', None); c.pop('_lineage', None)
    kept = [c for cells in users.values() for c in cells]
    for c in kept:
        c['_edit_roots'] = sorted(set(c.get('roots') or []) | set(c.pop('_touched', [])))
    log(f'  lineage grouping: {len(cand)} candidates -> {len(kept)} cells ({len(regroup)} merged groups re-resolved)')
    # State as the tracer left it (pinned at last edit + 1 s), trunk "before" and live "today" root (parallel).
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=PIECE_WORKERS) as ex:
        list(ex.map(lambda c: cell_states(cg, c), kept))
    # Edits by OTHER users on the same cell (any op whose current root is one of this cell's
    # own fragments, live or as-left, by a different user) -> "changed hands" signal. Only the
    # cell's own roots count: the neighbours a tracer took pieces from are not their cell.
    by_root = defaultdict(list)
    for o in ops:
        sv = rep[o['id']]
        r = cur.get(sv) if sv else None
        if r:
            by_root[str(r)].append((o['user'], o['ts']))
    for user, cells in users.items():
        for c in cells:
            own = set(c.get('roots') or []) | set(c.pop('_live', []) or [])
            others = [(u, ts) for r in own for (u, ts) in by_root.get(r, []) if u != user]
            after = [u for (u, ts) in others if ts > c['t1']]
            before = [u for (u, ts) in others if ts <= c['t1']]
            # "others" = edits by other people AFTER this tracer's last touch (the changed-hands signal);
            # "othersBefore" = other people's edits earlier in the window (already inside "before"/"after").
            if after:
                c['others'] = len(after); c['otherUsers'] = len(set(after))
            if before:
                c['othersBefore'] = len(before); c['otherUsersBefore'] = len(set(before))
    log(f'  states resolved for {len(kept)} cells in {time.time()-t0:.0f}s '
        f'({sum(1 for c in kept if len(c.get("roots") or []) > 1)} with cut-off pieces, '
        f'{sum(c.get("mergedAway", 0) for c in kept)} fragments merged elsewhere excluded, '
        f'{sum(1 for c in kept if c.get("others"))} cells also edited by others, '
        f'{sum(1 for c in kept if c.get("today") and c.get("today") != c.get("root"))} changed since)')
    # Centroid / extent for every kept cell (parallel; ~1s each serially).
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=CENTROID_WORKERS) as ex:
        geos = list(ex.map(lambda c: cell_geometry(client, c['root']), kept))
    for c, g in zip(kept, geos):
        if g:
            c['centerNm'] = g['centerNm']; c['extentNm'] = g['extentNm']; c['l2'] = g['l2']
    log(f'  geometry for {sum(1 for g in geos if g)}/{len(kept)} cells in {time.time()-t0:.0f}s')
    return {'viewer': viewer, 'users': dict(users), 'ops': len(ops), 'maxOp': max_id, 'windowDays': window_days}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--days', type=int, default=7)
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
