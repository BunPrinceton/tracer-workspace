#!/usr/bin/env python3
"""Batch-restore old neuroglancer "appspot" share links.

Companion to the borkbook Link Restorer (/link-restore/). The web tool restores
links one at a time; this does a whole pile at once, from the command line, using
your CAVE token (so it can fetch auth-gated saved states and route by their actual
CONTENTS — which the static web page can only do after you sign in).

What it does for each link:
  1. Parses the json_url out of the appspot link -> (state-server host, state id).
  2. Fetches the saved state JSON with your CAVE Bearer token (tries the flywire
     state server and global.daf-apis.com).
  3. Inspects the layers and routes by contents:
       - FlyWire scene (prodv1 / fly_v## graphene seg) -> ngl.flywire.ai/#! inline
         (the native FlyWire viewer authenticates fly_v31; Spelunker can't).
       - MICrONS/Minnie scene with a dead microns-seunglab intermediate EM image
         -> repoint that image to the public release EM, open in Spelunker.
       - otherwise -> Spelunker middleauth+ link.
  4. Writes an HTML index of clickable fixed links.

KEY LESSON baked in here: the link's HOST does NOT tell you the dataset. Old
appspot links on BOTH globalv1.flywire-daf.com AND www.dynamicannotationframework.com
have turned out to be FlyWire fly_v31 scenes. Only the fetched contents are reliable.

Auth: reads your token from ~/.cloudvolume/secrets/cave-secret.json (and the
global.daf-apis.com one). Get a token with:  python -c "from caveclient import
CAVEclient; print(CAVEclient().auth.token)"

Usage:
  python restore_old_ng_links.py links.txt                 # one link per line (or pasted/concatenated)
  python restore_old_ng_links.py links.txt out.html        # custom output path
  # links.txt may contain links run together with no separators; they're split on
  # the appspot prefix automatically.
"""
import json, os, re, sys, urllib.parse

try:
    import requests
except ImportError:
    sys.exit("pip install requests  (it ships with caveclient)")

SECRETS = [
    os.path.expanduser("~/.cloudvolume/secrets/cave-secret.json"),
    os.path.expanduser("~/.cloudvolume/secrets/global.daf-apis.com-cave-secret.json"),
]
FLYWIRE_VIEWER = "https://ngl.flywire.ai"
SPELUNKER = "https://spelunker.cave-explorer.org"


def load_tokens():
    toks = []
    for p in SECRETS:
        try:
            t = json.load(open(p)).get("token", "")
            if t and t not in toks:
                toks.append(t)
        except Exception:
            pass
    if not toks:
        sys.exit("No CAVE token found in ~/.cloudvolume/secrets/. "
                 "Get one: python -c \"from caveclient import CAVEclient; print(CAVEclient().auth.token)\"")
    return toks


def split_links(text):
    # handle one-per-line AND links concatenated with no separator
    parts = re.split(r"(?=https?://neuromancer-seung-import\.appspot\.com)", text)
    return [p.strip() for p in parts if "json_url=" in p]


def parse(link):
    u = urllib.parse.unquote(re.search(r"json_url=(\S+)", link).group(1))
    host = re.match(r"https?://([^/]+)", u).group(1)
    sid = re.search(r"nglstate/(?:api/v1/)?(\d+)", u).group(1)
    return host, sid


def fetch(host, sid, tokens):
    servers = (["https://globalv1.flywire-daf.com/nglstate/api/v1/",
                "https://global.daf-apis.com/nglstate/api/v1/"]
               if "flywire-daf.com" in host else
               ["https://global.daf-apis.com/nglstate/api/v1/",
                "https://globalv1.flywire-daf.com/nglstate/api/v1/"])
    last = None
    for srv in servers:
        for tok in tokens:
            try:
                r = requests.get(srv + sid, headers={"Authorization": "Bearer " + tok}, timeout=30)
                last = r.status_code
                if r.status_code == 200:
                    return srv, r.json()
            except Exception as e:
                last = str(e)[:50]
    return None, last


def srcof(layer):
    s = layer.get("source")
    if isinstance(s, dict):
        s = s.get("url")
    if isinstance(s, list):
        s = ",".join(x.get("url") if isinstance(x, dict) else str(x) for x in s)
    return str(s)


def route(srv, sid, state):
    layers = state.get("layers", [])
    segs = [srcof(L) for L in layers if "segmentation" in (L.get("type") or "")]
    imgs = [(L, srcof(L)) for L in layers if L.get("type") == "image"]
    flywire = any("flywire-daf.com" in s or re.search(r"/fly_v\d", s) for s in segs)
    if flywire:
        url = FLYWIRE_VIEWER + "/#!" + urllib.parse.quote(json.dumps(state), safe="")
        return "FlyWire -> ngl.flywire.ai", url
    dead = [(L, s) for L, s in imgs if "microns-seunglab" in s and "minnie" in s]
    if dead:
        for L, s in dead:
            ds = "minnie35" if "minnie35" in s else "minnie65"
            pub = "precomputed://gs://iarpa_microns/minnie/%s/em" % ds
            if isinstance(L["source"], str):
                L["source"] = pub
            else:
                L["source"]["url"] = pub
        url = SPELUNKER + "/#!" + urllib.parse.quote(json.dumps(state), safe="")
        return "MICrONS dead-EM -> swap + Spelunker", url
    return "MICrONS -> Spelunker", SPELUNKER + "/#!middleauth+" + srv + sid


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    links = split_links(open(sys.argv[1], encoding="utf-8").read())
    out_path = sys.argv[2] if len(sys.argv) > 2 else "restored_links.html"
    tokens = load_tokens()
    print("%d links to restore\n" % len(links))

    results = []
    for i, link in enumerate(links, 1):
        try:
            host, sid = parse(link)
        except Exception:
            print("%2d  UNPARSEABLE: %s" % (i, link[:60]))
            continue
        srv, state = fetch(host, sid, tokens)
        if not state:
            print("%2d  %s  FETCH FAIL (%s)" % (i, sid, state if state else srv))
            results.append((i, sid, "FETCH FAIL", None))
            continue
        kind, url = route(srv, sid, state)
        print("%2d  %-18s  %s" % (i, sid, kind))
        results.append((i, sid, kind, url))

    rows = "".join(
        '<li style="margin:.5rem 0">%s &mdash; <code>%s</code>%s</li>' % (
            kind, sid,
            ' &mdash; <a href="%s">open</a>' % url.replace("&", "&amp;").replace('"', "&quot;") if url else "")
        for _, sid, kind, url in results)
    html = ('<!DOCTYPE html><meta charset="utf-8"><title>restored links</title>'
            '<body style="font:15px system-ui;margin:2rem;max-width:900px">'
            '<h2>Restored neuroglancer links (%d)</h2><ol>%s</ol>'
            '<p style="color:#666;font-size:.85rem">FlyWire links open in ngl.flywire.ai '
            '(log into FlyWire). Generated by scripts/restore_old_ng_links.py.</p></body>'
            % (len(results), rows))
    open(out_path, "w", encoding="utf-8").write(html)
    print("\nwrote %s" % out_path)


if __name__ == "__main__":
    main()
