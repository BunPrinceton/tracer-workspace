// ==UserScript==
// @name         FlyWire Segmentation Auth Fix
// @namespace    https://borkbook.com/
// @version      1.2.0
// @description  Auto-repair old FlyWire share links whose graphene segmentation fails to load ("HTTP error 0") by injecting the middleauth+ prefix. Pairs with the borkbook Link Restorer.
// @author       Bun
// @match        https://ngl.flywire.ai/*
// @grant        none
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/BunPrinceton/tracer-workspace/master/tampermonkey-scripts/flywire-segmentation-auth-fix.user.js
// @downloadURL  https://raw.githubusercontent.com/BunPrinceton/tracer-workspace/master/tampermonkey-scripts/flywire-segmentation-auth-fix.user.js
// ==/UserScript==

(function () {
    'use strict';

    // ============================ CONFIG ============================
    const CONFIG = {
        // Auto-apply the fix the moment a broken scene is detected.
        // Set to false to require a click on the floating button instead.
        AUTO_FIX: true,
        // Always show the manual "Fix segmentation auth" button when a broken
        // scene is detected (also used as the fallback if auto-fix doesn't stick).
        SHOW_BUTTON: true,
        // Console logging.
        DEBUG: true,
        // How long to keep polling for the viewer state to populate (ms).
        POLL_INTERVAL: 500,
        POLL_TIMEOUT: 30000,
        // If we auto-fixed and the page came back STILL broken within this window,
        // assume the fix didn't stick (usually = not logged in) and stop auto-firing
        // to avoid a reload loop — show the button + a hint instead.
        RELOAD_GUARD_MS: 8000
    };

    // The signature of an old, un-authenticated FlyWire segmentation source.
    // A scene that contains this WILL fail with "HTTP error 0" until middleauth+ is added.
    const BARE = 'graphene://https://';
    const FIXED = 'graphene://middleauth+https://';
    const VIEWER = 'https://ngl.flywire.ai';
    const GUARD_KEY = 'fwAuthFix:lastAttemptTs';

    function log(...args) { if (CONFIG.DEBUG) console.log('[FlyWire Auth Fix]', ...args); }

    // ===================== LOOP GUARD (timestamp) =====================
    function lastAttempt() { return parseInt(sessionStorage.getItem(GUARD_KEY) || '0', 10); }
    function markAttempt() { sessionStorage.setItem(GUARD_KEY, String(Date.now())); }
    function recentlyAttempted() { return (Date.now() - lastAttempt()) < CONFIG.RELOAD_GUARD_MS; }

    // ===================== STATE HELPERS =====================
    function getStateString() {
        try {
            if (typeof window.viewer === 'undefined' || !window.viewer.state) return null;
            return JSON.stringify(window.viewer.state.toJSON());
        } catch (e) {
            return null;
        }
    }

    function hasBareGraphene(s) { return !!s && s.indexOf(BARE) !== -1; }
    function hasGrapheneSeg(s) { return !!s && s.indexOf('graphene://') !== -1; }

    // Is the FlyWire "can't load the segmentation" error banner currently on screen?
    // Used to distinguish "source already fixed but still erroring" (= not logged in)
    // from a healthy scene.
    function hasAuthErrorBanner() {
        try {
            var t = (document.body && document.body.innerText) || '';
            return t.indexOf('Error retrieving metadata for volume') !== -1
                || (t.indexOf('HTTP error') !== -1 && t.indexOf('graphene://') !== -1)
                || t.indexOf('You are not logged in') !== -1;
        } catch (e) { return false; }
    }

    function applyFix(stateString) {
        const fixed = stateString.split(BARE).join(FIXED);
        markAttempt();
        log('Applying middleauth+ fix and reloading as an inline-state (#!) link.');
        window.location.href = VIEWER + '/#!' + encodeURIComponent(fixed);
    }

    // ===================== UI: notification =====================
    function showNotification(message, type, duration) {
        const colors = { success: '#16a34a', error: '#dc2626', warning: '#d97706', info: '#2563eb' };
        const notice = document.createElement('div');
        notice.textContent = message;
        notice.style.cssText = [
            'position:fixed', 'top:12px', 'left:50%', 'transform:translateX(-50%)',
            'background:' + (colors[type] || colors.info), 'color:#fff',
            'padding:12px 20px', 'border-radius:6px', 'z-index:100000',
            'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
            'font-size:14px', 'font-weight:600', 'box-shadow:0 2px 12px rgba(0,0,0,0.4)',
            'max-width:80vw', 'text-align:center'
        ].join(';');
        document.body.appendChild(notice);
        setTimeout(function () {
            notice.style.transition = 'opacity 0.4s';
            notice.style.opacity = '0';
            setTimeout(function () { notice.remove(); }, 400);
        }, duration || 4000);
    }

    // ===================== UI: manual fix button =====================
    function showFixButton() {
        if (document.getElementById('fw-auth-fix-btn')) return;
        const btn = document.createElement('button');
        btn.id = 'fw-auth-fix-btn';
        btn.textContent = '⚡ Fix segmentation auth';
        btn.title = 'This scene uses an old bare graphene source that fails to load (HTTP error 0). '
                  + 'Click to inject middleauth+ and reload.';
        btn.style.cssText = [
            'position:fixed', 'bottom:16px', 'left:16px', 'z-index:100000',
            'background:#2563eb', 'color:#fff', 'border:none', 'border-radius:6px',
            'padding:10px 16px',
            'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
            'font-size:14px', 'font-weight:600', 'cursor:pointer',
            'box-shadow:0 2px 10px rgba(0,0,0,0.4)'
        ].join(';');
        btn.addEventListener('mouseenter', function () { btn.style.background = '#1d4ed8'; });
        btn.addEventListener('mouseleave', function () { btn.style.background = '#2563eb'; });
        btn.addEventListener('click', function () {
            const cur = getStateString();
            if (!hasBareGraphene(cur)) {
                showNotification('Nothing to fix now — the source is already middleauth+. '
                               + 'If it still will not load, the issue is login-side.', 'warning');
                return;
            }
            applyFix(cur);
        });
        document.body.appendChild(btn);
        log('Manual "Fix segmentation auth" button added.');
    }

    // ===================== UI: "reload after login" button =====================
    function showLoginButton() {
        if (document.getElementById('fw-login-reload-btn')) return;
        const btn = document.createElement('button');
        btn.id = 'fw-login-reload-btn';
        btn.textContent = '↻ I logged in — reload';
        btn.title = 'The segmentation source is already authenticated (middleauth+) but still '
                  + 'failing — that means you are not logged in. Sign in via the account menu '
                  + '(allow popups), then click this to reload.';
        btn.style.cssText = [
            'position:fixed', 'bottom:16px', 'left:16px', 'z-index:100000',
            'background:#d97706', 'color:#fff', 'border:none', 'border-radius:6px',
            'padding:10px 16px',
            'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
            'font-size:14px', 'font-weight:600', 'cursor:pointer',
            'box-shadow:0 2px 10px rgba(0,0,0,0.4)'
        ].join(';');
        btn.addEventListener('mouseenter', function () { btn.style.background = '#b45309'; });
        btn.addEventListener('mouseleave', function () { btn.style.background = '#d97706'; });
        btn.addEventListener('click', function () { window.location.reload(); });
        document.body.appendChild(btn);
    }

    // Source is already middleauth+ but the segmentation still errors => almost always not logged in.
    function onAuthLikelyNeeded() {
        log('Segmentation source is already authenticated (middleauth+) but still erroring — '
            + 'you are most likely not logged in.');
        showNotification('Source is already authenticated (middleauth+) but the segmentation still '
            + 'won\'t load (HTTP error 0). That means the auth handshake is being blocked: (1) sign in '
            + 'via the account menu (allow popups; you may be prompted twice), and (2) on BRAVE, drop '
            + 'Shields for ngl.flywire.ai and allow cross-site cookies — Shields blocks the cross-site '
            + 'middleauth requests. Then reload.', 'warning', 12000);
        showLoginButton();
    }

    // ===================== DETECTION =====================
    function onBrokenDetected(stateString) {
        log('Bare graphene segmentation source detected — this scene will fail with HTTP error 0.');

        if (CONFIG.AUTO_FIX && !recentlyAttempted()) {
            showNotification('Old FlyWire link detected — repairing segmentation auth…', 'info');
            // small delay so the toast is visible before navigation
            setTimeout(function () { applyFix(stateString); }, 600);
            return;
        }

        if (CONFIG.AUTO_FIX && recentlyAttempted()) {
            // We just tried and it came back broken — almost always a login issue.
            showNotification('Segmentation still not loading after the auth fix — you may need to '
                           + 'log in (allow popups / third-party cookies). Use the button to retry.', 'warning');
        }

        if (CONFIG.SHOW_BUTTON) showFixButton();
    }

    // ===================== POLL FOR STATE =====================
    function start() {
        let tries = 0;
        let authHintShown = false;
        const maxTries = Math.ceil(CONFIG.POLL_TIMEOUT / CONFIG.POLL_INTERVAL);
        log('Watching for an un-authenticated FlyWire segmentation source…');
        const iv = setInterval(function () {
            tries++;
            const s = getStateString();

            // Case 1: bare graphene source -> repair it (auto or button).
            if (s && hasBareGraphene(s)) {
                clearInterval(iv);
                onBrokenDetected(s);
                return;
            }

            // Case 2: source is already middleauth+ but the seg error banner is up
            // -> the source is fine, the user just isn't logged in. Surface that
            // instead of silently doing nothing (the gap people hit after a fix).
            if (!authHintShown && hasGrapheneSeg(s) && hasAuthErrorBanner()) {
                authHintShown = true;
                clearInterval(iv);
                onAuthLikelyNeeded();
                return;
            }

            if (tries >= maxTries) {
                clearInterval(iv);
                log('No bare graphene source found within timeout — nothing to do.');
            }
        }, CONFIG.POLL_INTERVAL);
    }

    start();
})();
