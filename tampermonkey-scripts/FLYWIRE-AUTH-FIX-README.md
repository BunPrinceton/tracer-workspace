# FlyWire Segmentation Auth Fix

A Tampermonkey userscript that auto-repairs old FlyWire / Neuroglancer share links
whose segmentation fails to load with:

> `Error retrieving metadata for volume graphene://https://prodv1.flywire-daf.com/segmentation/1.0/fly_v31: Fetching "" resulted in HTTP error 0`

## Why links break

Old share links embed a **bare** segmentation source
(`graphene://https://prodv1.flywire-daf.com/...`). Current FlyWire servers sit behind
**middleauth** and expect the `graphene://middleauth+https://...` form plus a logged-in
token. The bare form fails the auth/CORS handshake before a real request is even made —
hence "HTTP error 0". The EM image and brain mesh still load because they are public
sources; only the graphene segmentation needs auth.

## What the script does

Runs on `https://ngl.flywire.ai/*`, watches the live viewer state, and when it sees a bare
`graphene://https://` source it injects `middleauth+` and reloads the scene as an inline
`#!` state.

- **Auto-fix** on by default (`CONFIG.AUTO_FIX`). Set it to `false` to require a click on
  the floating **⚡ Fix segmentation auth** button instead.
- **Loop-guarded**: if a repaired page comes back still-broken within 8 s (almost always
  "not logged in"), it stops auto-firing and shows the button + a login hint rather than
  reload-looping.
- **Non-invasive**: only acts when a bare source is present; already-`middleauth+` scenes
  are left untouched.
- **Login-aware (v1.1.0)**: if the source is already `middleauth+` but the segmentation
  *still* errors (the error banner is up), that means you're not logged in — the script
  says so and shows a "↻ I logged in — reload" button instead of going silent. (A
  `middleauth+` source whose token can't be obtained throws the *same* "HTTP error 0".)

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/).
2. Open the raw script URL — Tampermonkey detects the `.user.js` and offers to install:
   `https://raw.githubusercontent.com/BunPrinceton/tracer-workspace/master/tampermonkey-scripts/flywire-segmentation-auth-fix.user.js`

## After it loads

The script fixes **loading**, but a `local_id` scene still lives only in this browser.
Click **Share** in FlyWire afterward to mint a portable `json_url` link so the scene
survives browser/profile changes. Once the segmentation loads you can also select/deselect
segments again and refresh any outdated (red) root IDs.

## Related

- Browser tool / bookmarklet / console one-liner: **https://borkbook.com/link-restore/**
- Debug log prefix: `[FlyWire Auth Fix]` in the DevTools console.
