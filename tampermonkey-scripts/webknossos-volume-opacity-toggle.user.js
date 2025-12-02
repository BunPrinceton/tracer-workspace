// ==UserScript==
// @name         WK Volume Opacity Toggle
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Toggle Volume layer opacity between 1 and saved value (Ctrl+Shift+O)
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

    const DEBUG = true;

    function log(...args) {
        if (DEBUG) console.log('[WK Opacity Toggle]', ...args);
    }

    let isInitialized = false;
    let savedOpacity = null;

    // ========== UTILITY FUNCTIONS ==========

    function showNotification(message, type = 'info') {
        const colors = {
            success: '#4CAF50',
            error: '#f44336',
            warning: '#ff9800',
            info: '#2196F3'
        };

        const notice = document.createElement('div');
        notice.textContent = message;
        notice.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: ${colors[type]};
            color: white;
            padding: 12px 20px;
            border-radius: 4px;
            z-index: 99999;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 14px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease-out;
        `;

        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(400px); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        if (!document.querySelector('style[data-opacity-toggle]')) {
            style.setAttribute('data-opacity-toggle', 'true');
            document.head.appendChild(style);
        }

        document.body.appendChild(notice);
        setTimeout(() => {
            notice.style.transition = 'opacity 0.3s';
            notice.style.opacity = '0';
            setTimeout(() => notice.remove(), 300);
        }, 2000);
    }

    // ========== OPACITY TOGGLE LOGIC ==========

    function findVolumeOpacityInput() {
        log('Searching for Volume layer opacity input...');

        // Find the tracing-settings-menu container
        const settingsMenu = document.querySelector('.tracing-settings-menu');
        if (!settingsMenu) {
            log('❌ Could not find .tracing-settings-menu container');
            return null;
        }

        log('✓ Found tracing-settings-menu container');

        // Get direct children divs
        const childDivs = Array.from(settingsMenu.children).filter(el => el.tagName === 'DIV');
        log(`Found ${childDivs.length} direct child divs in settings menu`);

        // Find the Volume div (the one WITHOUT ant-spin-nested-loading)
        let volumeDiv = null;
        for (let i = 0; i < childDivs.length; i++) {
            const div = childDivs[i];
            const hasSpinLoading = div.querySelector('.ant-spin-nested-loading') !== null;
            log(`  - Child div #${i}: has ant-spin-nested-loading = ${hasSpinLoading}`);

            if (!hasSpinLoading) {
                log(`  - ✓ This is the Volume div (no spin loading)`);
                volumeDiv = div;
                break;
            }
        }

        if (!volumeDiv) {
            log('❌ Could not find Volume div (one without ant-spin-nested-loading)');
            return null;
        }

        // Now find the "Opacity" label inside this Volume div
        const opacityLabels = Array.from(volumeDiv.querySelectorAll('label.setting-label')).filter(el => {
            return el.textContent.trim() === 'Opacity';
        });

        log(`Found ${opacityLabels.length} "Opacity" labels in Volume div`);

        if (opacityLabels.length === 0) {
            log('❌ No Opacity label found in Volume div');
            return null;
        }

        // Get the first Opacity label (main opacity, not pattern opacity)
        const opacityLabel = opacityLabels[0];
        log('Using first Opacity label');

        // Find the row containing this label
        const row = opacityLabel.closest('.ant-row');
        if (!row) {
            log('❌ No row found for Opacity label');
            return null;
        }

        // Find the number input in this row
        const numberInput = row.querySelector('input.ant-input-number-input[role="spinbutton"]');
        if (numberInput) {
            log('✓ FOUND THE INPUT!');
            log('Current value:', numberInput.value);
            return numberInput;
        } else {
            log('❌ No number input found in row');
            return null;
        }
    }

    function setInputValue(input, value) {
        if (!input) return false;

        log(`Setting input to value: ${value}`);

        // Get current value
        const oldValue = input.value;
        log(`Old value: ${oldValue}, New value: ${value}`);

        // Get min and max values
        const min = parseInt(input.getAttribute('aria-valuemin')) || 0;
        const max = parseInt(input.getAttribute('aria-valuemax')) || 100;

        // Clamp value to min-max range
        const clampedValue = Math.max(min, Math.min(max, value));

        // Focus the input first
        input.focus();

        // Set value using native setter to trigger React
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype, 'value'
        ).set;
        nativeInputValueSetter.call(input, clampedValue);

        // Update aria-valuenow attribute
        input.setAttribute('aria-valuenow', clampedValue);

        // Trigger input event (React listens to this)
        input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));

        // Trigger change event
        input.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));

        // Modern InputEvent for React
        try {
            const modernInputEvent = new InputEvent('input', {
                bubbles: true,
                cancelable: true,
                inputType: 'insertText',
                data: String(clampedValue),
            });
            input.dispatchEvent(modernInputEvent);
        } catch (e) {
            // InputEvent not supported
        }

        // Blur the input to commit the change
        setTimeout(() => {
            input.blur();
        }, 50);

        log(`Input updated: ${oldValue} → ${clampedValue}`);
        return true;
    }

    function toggleOpacity() {
        log('=== Toggle Opacity Triggered ===');

        const opacityInput = findVolumeOpacityInput();

        if (!opacityInput) {
            showNotification('✗ Could not find Volume opacity input', 'error');
            log('Opacity input not found!');
            return;
        }

        const currentValue = parseInt(opacityInput.value);
        log(`Current opacity value: ${currentValue}`);

        if (currentValue === 1) {
            // Toggle back to saved value
            const targetValue = savedOpacity || 15; // Default to 15 if no saved value
            setInputValue(opacityInput, targetValue);
            showNotification(`Volume opacity → ${targetValue}`, 'success');
            log(`Toggled from 1 to ${targetValue}`);
        } else {
            // Save current value and toggle to 1
            savedOpacity = currentValue;
            setInputValue(opacityInput, 1);
            showNotification(`Volume opacity → 1 (saved: ${savedOpacity})`, 'success');
            log(`Toggled from ${savedOpacity} to 1`);
        }
    }

    // ========== KEYBOARD SHORTCUT ==========

    function setupKeyboardShortcut() {
        log('Setting up keyboard shortcut: Ctrl+Shift+O');

        document.addEventListener('keydown', (e) => {
            // Ctrl+Shift+O
            if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'o') {
                e.preventDefault();
                e.stopPropagation();
                log('Keyboard shortcut activated!');
                toggleOpacity();
            }
        }, true); // Use capture phase to catch it early

        log('Keyboard shortcut installed');
    }

    // ========== INITIALIZATION ==========

    function waitForWebKnossos(callback, maxAttempts = 50) {
        let attempts = 0;

        function check() {
            attempts++;

            const hasUI = document.querySelector('.ant-layout') ||
                         document.querySelector('[class*="oxalis"]') ||
                         document.querySelector('.ant-tree') ||
                         document.querySelector('[class*="segment"]') ||
                         document.body.classList.contains('webknossos');

            if (hasUI) {
                log('WebKnossos UI detected, initializing...');
                callback();
                return;
            }

            if (attempts < maxAttempts) {
                setTimeout(check, 200);
            } else {
                log('WARNING: WebKnossos UI not detected after', maxAttempts, 'attempts. Initializing anyway...');
                callback();
            }
        }

        check();
    }

    function init() {
        if (isInitialized) {
            log('Already initialized');
            return;
        }

        log('='.repeat(50));
        log('WK Volume Opacity Toggle v1.0.0');
        log('Keyboard Shortcut: Ctrl+Shift+O');
        log('Current URL:', window.location.href);
        log('='.repeat(50));

        setupKeyboardShortcut();

        isInitialized = true;
        log('✓ Initialization complete - Script is ACTIVE!');

        // Show visual confirmation
        showNotification('✓ Opacity Toggle loaded (Ctrl+Shift+O)', 'success');
    }

    // Start initialization
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => waitForWebKnossos(init));
    } else {
        waitForWebKnossos(init);
    }

    log('Script loaded, waiting for WebKnossos UI...');
})();
