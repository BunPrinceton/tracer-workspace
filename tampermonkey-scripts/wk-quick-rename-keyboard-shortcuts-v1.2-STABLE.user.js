// ==UserScript==
// @name         WK Quick Rename - Keyboard Shortcuts (Rebindable)
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Press 1-9, Q, W, E to select semantic labels - RIGHT-CLICK keyboard hints to rebind!
// @author       Bun
// @match        *://webknossos.org/*
// @match        *://*.webknossos.org/*
// @match        *://wk.zetta.ai:9000/*
// @match        *://wk.zetta.ai/*
// @match        *://localhost:9090/*
// @match        *://127.0.0.1:9090/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    console.log('[WK Keyboard Shortcuts] Loaded v1.2 (Rebindable)');

    // Default key mapping
    const DEFAULT_KEY_MAP = {
        '1': 0, '2': 1, '3': 2, '4': 3, '5': 4,
        '6': 5, '7': 6, '8': 7, '9': 8,
        'q': 9, 'Q': 9,
        'w': 10, 'W': 10,
        'e': 11, 'E': 11
    };

    const DEFAULT_KEY_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Q', 'W', 'E', '?', '?', '?', '?', '?', '?', '?', '?', '?'];

    // Load custom keybinds from localStorage or use defaults
    let KEY_MAP = loadKeybinds() || { ...DEFAULT_KEY_MAP };
    let KEY_LABELS = loadKeyLabels() || [...DEFAULT_KEY_LABELS];

    // Migrate old keybinds: if saved labels are shorter than defaults, extend with '?'
    if (KEY_LABELS.length < DEFAULT_KEY_LABELS.length) {
        console.log('[WK Keyboard] Migrating old keybinds:', KEY_LABELS.length, '→', DEFAULT_KEY_LABELS.length);
        while (KEY_LABELS.length < DEFAULT_KEY_LABELS.length) {
            KEY_LABELS.push('?');
        }
        saveKeybinds(); // Save the extended version
    }

    let menuLabeled = false;
    let rebindingIndex = null; // Which item we're rebinding

    // ========== LOCALSTORAGE FUNCTIONS ==========

    function saveKeybinds() {
        localStorage.setItem('wk-keyboard-shortcuts-map', JSON.stringify(KEY_MAP));
        localStorage.setItem('wk-keyboard-shortcuts-labels', JSON.stringify(KEY_LABELS));
        console.log('[WK Keyboard] Saved keybinds:', KEY_MAP);
    }

    function loadKeybinds() {
        const saved = localStorage.getItem('wk-keyboard-shortcuts-map');
        return saved ? JSON.parse(saved) : null;
    }

    function loadKeyLabels() {
        const saved = localStorage.getItem('wk-keyboard-shortcuts-labels');
        return saved ? JSON.parse(saved) : null;
    }

    function resetKeybinds() {
        KEY_MAP = { ...DEFAULT_KEY_MAP };
        KEY_LABELS = [...DEFAULT_KEY_LABELS];
        saveKeybinds();
        console.log('[WK Keyboard] Reset to defaults');
        menuLabeled = false; // Force re-labeling with new keys
    }

    // ========== REBINDING FUNCTIONS ==========

    function startRebinding(index, hintElement) {
        rebindingIndex = index;
        hintElement.textContent = '...';
        hintElement.style.background = 'rgba(255, 165, 0, 0.8)'; // Orange
        hintElement.style.animation = 'pulse 0.5s infinite';

        // Add pulse animation
        if (!document.getElementById('wk-pulse-style')) {
            const style = document.createElement('style');
            style.id = 'wk-pulse-style';
            style.textContent = `
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
            `;
            document.head.appendChild(style);
        }

        console.log('[WK Keyboard] Rebinding item', index, '- Press any key...');
    }

    function completeRebinding(newKey, hintElement) {
        if (rebindingIndex === null) return;

        // Remove old mapping for this index
        for (let key in KEY_MAP) {
            if (KEY_MAP[key] === rebindingIndex) {
                delete KEY_MAP[key];
            }
        }

        // Add new mapping (both lowercase and uppercase for letters)
        KEY_MAP[newKey] = rebindingIndex;
        if (newKey.toLowerCase() !== newKey.toUpperCase()) {
            // It's a letter
            KEY_MAP[newKey.toLowerCase()] = rebindingIndex;
            KEY_MAP[newKey.toUpperCase()] = rebindingIndex;
            KEY_LABELS[rebindingIndex] = newKey.toUpperCase();
        } else {
            // It's a number or special char
            KEY_LABELS[rebindingIndex] = newKey;
        }

        // Save to localStorage
        saveKeybinds();

        // Update visual
        hintElement.textContent = KEY_LABELS[rebindingIndex];
        hintElement.style.background = 'rgba(76, 175, 80, 0.8)'; // Green flash
        hintElement.style.animation = '';

        setTimeout(() => {
            hintElement.style.background = 'rgba(0, 0, 0, 0.1)'; // Back to normal
        }, 500);

        console.log('[WK Keyboard] Rebound item', rebindingIndex, 'to key', newKey);
        rebindingIndex = null;
    }

    // ========== MENU LABELING ==========

    function createResetButton() {
        const resetBtn = document.createElement('div');
        resetBtn.className = 'wk-reset-keybinds';
        resetBtn.textContent = '🔄 Reset Keybinds';
        resetBtn.style.cssText = `
            padding: 8px 16px;
            cursor: pointer;
            transition: background 0.2s;
            color: #666;
            border-top: 1px solid #ddd;
            margin-top: 4px;
            font-size: 12px;
            text-align: center;
        `;

        resetBtn.addEventListener('mouseenter', () => {
            resetBtn.style.background = '#f5f5f5';
        });

        resetBtn.addEventListener('mouseleave', () => {
            resetBtn.style.background = 'white';
        });

        resetBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Reset all keybinds to defaults?')) {
                resetKeybinds();
                // Close and reopen menu to show new bindings
                const menu = document.getElementById('wk-segment-context-menu');
                if (menu) {
                    menu.style.display = 'none';
                }
            }
        });

        return resetBtn;
    }

    // Watch for menu appearing and add keyboard hints
    const observer = new MutationObserver(() => {
        const menu = document.getElementById('wk-segment-context-menu');
        if (menu && menu.style.display !== 'none' && !menuLabeled) {
            const menuItems = menu.querySelectorAll('.wk-context-menu-item');

            menuItems.forEach((item, index) => {
                if (index < KEY_LABELS.length) {
                    // Check if hint already exists
                    if (!item.querySelector('.wk-keyboard-hint')) {
                        const hint = document.createElement('span');
                        hint.className = 'wk-keyboard-hint';
                        hint.textContent = KEY_LABELS[index];
                        hint.style.cssText = `
                            float: right;
                            margin-left: 16px;
                            padding: 2px 6px;
                            background: rgba(0, 0, 0, 0.1);
                            border-radius: 3px;
                            font-family: monospace;
                            font-size: 11px;
                            font-weight: bold;
                            color: #666;
                            cursor: context-menu;
                        `;
                        hint.title = 'Right-click to rebind';

                        // Right-click on hint to rebind
                        hint.addEventListener('contextmenu', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            startRebinding(index, hint);
                        });

                        item.appendChild(hint);
                    }
                }
            });

            // Add reset button if not exists
            if (!menu.querySelector('.wk-reset-keybinds')) {
                menu.appendChild(createResetButton());
            }

            menuLabeled = true;
            console.log('[WK Keyboard Shortcuts] Added keyboard hints to menu');
        } else if (!menu || menu.style.display === 'none') {
            menuLabeled = false;
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // ========== KEYBOARD HANDLING ==========

    // Keyboard event listener - CAPTURE PHASE to intercept before WebKnossos
    document.addEventListener('keydown', function(e) {
        // Check if we're in rebinding mode
        if (rebindingIndex !== null) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            const menu = document.getElementById('wk-segment-context-menu');
            if (menu) {
                const hints = menu.querySelectorAll('.wk-keyboard-hint');
                if (hints[rebindingIndex]) {
                    completeRebinding(e.key, hints[rebindingIndex]);
                }
            }
            return;
        }

        // Check if WK Quick Rename context menu is open
        const menu = document.getElementById('wk-segment-context-menu');
        if (!menu || menu.style.display === 'none') {
            return; // Menu not open, let WebKnossos handle keys
        }

        // Get all menu items
        const menuItems = menu.querySelectorAll('.wk-context-menu-item');
        if (menuItems.length === 0) {
            return;
        }

        // Check if the pressed key is mapped
        const index = KEY_MAP[e.key];
        if (index !== undefined && index < menuItems.length) {
            // STOP WebKnossos from handling this key
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            // Click the menu item
            menuItems[index].click();

            console.log('[WK Keyboard Shortcuts] Clicked item', e.key.toUpperCase(), ':', menuItems[index].textContent);
        }
    }, true); // TRUE = capture phase (runs before WebKnossos handlers)

    console.log('[WK Keyboard Shortcuts] Ready - 21 labels available (12 bound by default)');
    console.log('[WK Keyboard Shortcuts] RIGHT-CLICK keyboard hints to rebind keys!');
})();
