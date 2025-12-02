// ==UserScript==
// @name         Webknossos Segment Renamer
// @namespace    http://tampermonkey.net/
// @version      2.0.0
// @description  Add context menu for quick segment renaming with semantic IDs (axon, dendrite, etc.)
// @author       You
// @match        https://webknossos.org/*
// @match        http://webknossos.org/*
// @match        https://*.webknossos.org/*
// @match        http://*.webknossos.org/*
// @match        http://wk.zetta.ai:9000/*
// @match        https://wk.zetta.ai:9000/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // Semantic ID options for segment naming
    const SEMANTIC_IDS = [
        { id: 'dendrite', label: 'Dendrite', emoji: '🔴' },
        { id: 'axon', label: 'Axon', emoji: '🔵' },
        { id: 'soma', label: 'Soma', emoji: '🟡' },
        { id: 'nucleus', label: 'Nucleus', emoji: '🟣' },
        { id: 'glia', label: 'Glia', emoji: '🟠' },
        { id: 'extracellular-space', label: 'Extracellular Space', emoji: '⚪' },
        { id: 'myelin', label: 'Myelin', emoji: '🟤' },
        { id: 'blood-vessel', label: 'Blood Vessel', emoji: '❤️' },
        { id: 'merge', label: 'Merge Between Classes', emoji: '🔀' },
        { id: 'uncertain', label: 'Uncertain', emoji: '❓' }
    ];

    let contextMenu = null;
    let currentSegmentElement = null;
    let currentSegmentId = null;

    // Create custom context menu
    function createContextMenu() {
        const menu = document.createElement('div');
        menu.id = 'wk-segment-context-menu';
        menu.style.cssText = `
            position: fixed;
            background: white;
            border: 1px solid #ccc;
            border-radius: 4px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            padding: 4px 0;
            z-index: 10000;
            display: none;
            min-width: 180px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 14px;
        `;

        SEMANTIC_IDS.forEach(semantic => {
            const item = document.createElement('div');
            item.className = 'wk-context-menu-item';
            item.textContent = `${semantic.emoji} ${semantic.label}`;
            item.dataset.semanticId = semantic.id;
            item.style.cssText = `
                padding: 8px 16px;
                cursor: pointer;
                transition: background 0.2s;
                color: #333;
            `;
            item.addEventListener('mouseenter', () => {
                item.style.background = '#f0f0f0';
                item.style.color = '#333';
            });
            item.addEventListener('mouseleave', () => {
                item.style.background = 'white';
                item.style.color = '#333';
            });
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                handleSemanticIdSelection(semantic);
                hideContextMenu();
            });
            menu.appendChild(item);
        });

        document.body.appendChild(menu);
        return menu;
    }

    function showContextMenu(x, y) {
        if (!contextMenu) {
            contextMenu = createContextMenu();
        }

        // Adjust position if menu would go off screen
        const menuWidth = 180;
        const menuHeight = SEMANTIC_IDS.length * 40;
        const maxX = window.innerWidth - menuWidth;
        const maxY = window.innerHeight - menuHeight;

        contextMenu.style.left = Math.min(x, maxX) + 'px';
        contextMenu.style.top = Math.min(y, maxY) + 'px';
        contextMenu.style.display = 'block';
    }

    function hideContextMenu() {
        if (contextMenu) {
            contextMenu.style.display = 'none';
        }
        currentSegmentElement = null;
        currentSegmentId = null;
    }

    // Handle semantic ID selection
    function handleSemanticIdSelection(semantic) {
        console.log('Selected semantic ID:', semantic.label, 'for segment:', currentSegmentId);

        if (currentSegmentElement) {
            // Try to find and rename the segment
            renameSegmentInList(currentSegmentElement, semantic);
        } else if (currentSegmentId) {
            // Rename via segment ID (from 2D view click)
            renameSegmentById(currentSegmentId, semantic);
        }
    }

    // Rename segment in the list
    function renameSegmentInList(element, semantic) {
        // First, look for the edit/pencil icon button
        const editButton = element.querySelector('button[title*="edit"], [title*="Edit"], .anticon-edit, svg[data-icon="edit"]')
            || Array.from(element.querySelectorAll('button, [role="button"]'))
                .find(btn => btn.title?.toLowerCase().includes('edit') || btn.getAttribute('aria-label')?.toLowerCase().includes('edit'));

        if (editButton) {
            console.log('Found edit button, clicking it');
            editButton.click();

            // Wait for the input field to appear
            setTimeout(() => {
                const input = element.querySelector('input[type="text"]');
                if (input) {
                    console.log('Found input field, setting value to:', semantic.label);
                    input.focus();

                    // Set value using native setter for React compatibility
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                    nativeInputValueSetter.call(input, semantic.label);

                    // Trigger input event for React
                    const inputEvent = new Event('input', { bubbles: true });
                    input.dispatchEvent(inputEvent);

                    // Wait for React to process, then press Enter or click save button
                    setTimeout(() => {
                        // Look for checkmark/save button
                        const saveButton = element.querySelector('button[title*="save"], [title*="Save"], .anticon-check, svg[data-icon="check"]')
                            || Array.from(element.querySelectorAll('button, [role="button"]'))
                                .find(btn => btn.title?.toLowerCase().includes('save'));

                        if (saveButton) {
                            console.log('Found save button, clicking it');
                            saveButton.click();
                        } else {
                            // Press Enter as fallback
                            console.log('Pressing Enter to save');
                            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
                            input.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
                            input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
                        }
                    }, 200);
                } else {
                    console.warn('Edit button clicked but no input field appeared');
                }
            }, 150);
        } else {
            // Fallback: try to find existing input or double-click
            const nameInput = element.querySelector('input[type="text"]');
            const nameSpan = element.querySelector('.segment-name, [class*="name"], [class*="Name"]');

            if (nameInput) {
                nameInput.value = semantic.label;
                nameInput.dispatchEvent(new Event('input', { bubbles: true }));
                nameInput.dispatchEvent(new Event('change', { bubbles: true }));
                nameInput.blur();
            } else if (nameSpan) {
                nameSpan.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
                setTimeout(() => {
                    const input = element.querySelector('input[type="text"]');
                    if (input) {
                        input.value = semantic.label;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                        input.blur();
                    }
                }, 100);
            } else {
                console.warn('Could not find edit button or name field in segment element');
            }
        }
    }

    // Rename segment by ID (for 2D view clicks)
    function renameSegmentById(segmentId, semantic) {
        console.log('Attempting to rename segment ID:', segmentId, 'to:', semantic.label);

        // Try to find the segment in the list by ID
        const segmentElements = document.querySelectorAll('[class*="segment"], [class*="Segment"], [data-segment-id]');

        for (const element of segmentElements) {
            const elementId = element.dataset.segmentId || element.textContent.match(/\d+/)?.[0];
            if (elementId === String(segmentId)) {
                renameSegmentInList(element, semantic);
                return;
            }
        }

        // If we can't find it in the list, try to use webknossos API if available
        if (window.webknossos) {
            try {
                // This is speculative - webknossos API might have different methods
                if (window.webknossos.api && window.webknossos.api.renameSegment) {
                    window.webknossos.api.renameSegment(segmentId, semantic.label);
                }
            } catch (e) {
                console.error('Error calling webknossos API:', e);
            }
        }

        console.warn('Could not find segment element for ID:', segmentId);
    }

    // Extract segment ID from element
    function extractSegmentId(element) {
        // Try various methods to extract segment ID
        if (element.dataset.segmentId) {
            return element.dataset.segmentId;
        }

        const idMatch = element.textContent.match(/(?:Segment|ID|#)\s*(\d+)/i);
        if (idMatch) {
            return idMatch[1];
        }

        return null;
    }

    // Set up right-click handling for segment list
    function setupSegmentListHandlers() {
        document.addEventListener('contextmenu', (e) => {
            // Try to find if we clicked on a segment in the list
            let target = e.target;
            let segmentElement = null;

            // Walk up the DOM tree to find segment container
            while (target && target !== document.body) {
                if (target.classList && (
                    target.classList.contains('segment-item') ||
                    target.classList.contains('segment') ||
                    target.getAttribute('class')?.includes('segment') ||
                    target.getAttribute('class')?.includes('Segment') ||
                    target.getAttribute('data-segment-id')
                )) {
                    segmentElement = target;
                    break;
                }
                target = target.parentElement;
            }

            if (segmentElement) {
                e.preventDefault();
                e.stopPropagation();
                currentSegmentElement = segmentElement;
                currentSegmentId = extractSegmentId(segmentElement);
                showContextMenu(e.pageX, e.pageY);
            }
        }, true);
    }

    // Set up right-click handling for 2D views by injecting into native context menu
    function setup2DViewHandlers() {
        let lastContextMenuPosition = { x: 0, y: 0 };
        let submenu = null;

        // Track right-click position
        document.addEventListener('contextmenu', (e) => {
            lastContextMenuPosition = { x: e.clientX, y: e.clientY };
        }, true);

        // Watch for the actual menu being added (not just the container)
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === 1) {
                        // Look for the actual dropdown menu
                        let menu = null;

                        if (node.classList?.contains('ant-dropdown-menu')) {
                            menu = node;
                        } else {
                            menu = node.querySelector?.('.ant-dropdown-menu');
                        }

                        if (menu) {
                            // Check if this is a segment context menu by looking for segment ID
                            const segmentId = extractSegmentIdFromMenu(menu);

                            if (segmentId) {
                                console.log('[2D Menu] Found segment context menu with ID:', segmentId);
                                injectRenameMenuItem(menu, segmentId);
                            }
                        }
                    }
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    // Extract segment ID from the context menu text
    function extractSegmentIdFromMenu(menu) {
        const menuText = menu.textContent || menu.innerText;
        const match = menuText.match(/Segment\s+ID:\s*(\d+)/i);
        if (match) {
            return match[1];
        }
        // Also try to extract from "Select Segment (23)"
        const selectMatch = menuText.match(/Select\s+Segment\s*\((\d+)\)/i);
        if (selectMatch) {
            return selectMatch[1];
        }
        return null;
    }

    // Inject our rename menu item into webknossos context menu
    function injectRenameMenuItem(menu, segmentId) {
        // Check if already injected
        if (menu.querySelector('.wk-rename-segment-item')) {
            console.log('[2D Menu] Already injected, skipping');
            return;
        }

        console.log('[2D Menu] Injecting rename menu item for segment:', segmentId);

        // Find the divider to insert before it
        const divider = menu.querySelector('.ant-dropdown-menu-item-divider');

        // Create menu item as an li to match Ant Design structure
        const menuItem = document.createElement('li');
        menuItem.className = 'ant-dropdown-menu-item wk-rename-segment-item';
        menuItem.setAttribute('role', 'menuitem');
        menuItem.setAttribute('tabindex', '-1');
        menuItem.innerHTML = '<span class="ant-dropdown-menu-title-content">🏷️ Rename Segment <span style="float: right">▶</span></span>';

        // Create submenu
        const submenu = document.createElement('div');
        submenu.className = 'wk-rename-submenu';
        submenu.style.cssText = `
            position: fixed;
            background: white;
            border: 1px solid #ccc;
            border-radius: 4px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            padding: 4px 0;
            z-index: 10001;
            display: none;
            min-width: 180px;
        `;

        // Add semantic ID options to submenu
        SEMANTIC_IDS.forEach(semantic => {
            const subItem = document.createElement('div');
            subItem.textContent = `${semantic.emoji} ${semantic.label}`;
            subItem.style.cssText = `
                padding: 8px 16px;
                cursor: pointer;
                transition: background 0.2s;
                color: #333;
            `;
            subItem.addEventListener('mouseenter', () => {
                subItem.style.background = '#f0f0f0';
            });
            subItem.addEventListener('mouseleave', () => {
                subItem.style.background = 'white';
            });
            subItem.addEventListener('click', (e) => {
                e.stopPropagation();
                currentSegmentId = segmentId;
                currentSegmentElement = null;
                handleSemanticIdSelection(semantic);
                // Close menus
                menu.remove();
                submenu.remove();
            });
            submenu.appendChild(subItem);
        });

        // Show submenu on hover with smart positioning
        menuItem.addEventListener('mouseenter', () => {
            menuItem.style.background = '#f0f0f0';
            const rect = menuItem.getBoundingClientRect();

            // Append to body first to measure it
            submenu.style.display = 'block';
            submenu.style.visibility = 'hidden';
            document.body.appendChild(submenu);

            const submenuRect = submenu.getBoundingClientRect();
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;

            let left, top;

            // Horizontal positioning - try right first, then left if it goes off-screen
            if (rect.right + submenuRect.width > windowWidth) {
                // Show to the left
                left = rect.left - submenuRect.width;
            } else {
                // Show to the right
                left = rect.right;
            }

            // Vertical positioning - align with menu item, but adjust if it goes off-screen
            top = rect.top;
            if (top + submenuRect.height > windowHeight) {
                // Align bottom of submenu with bottom of viewport
                top = windowHeight - submenuRect.height - 10;
            }

            submenu.style.left = left + 'px';
            submenu.style.top = top + 'px';
            submenu.style.visibility = 'visible';
        });

        menuItem.addEventListener('mouseleave', (e) => {
            // Only hide if not moving to submenu
            setTimeout(() => {
                if (!submenu.matches(':hover') && !menuItem.matches(':hover')) {
                    menuItem.style.background = 'white';
                    submenu.style.display = 'none';
                }
            }, 100);
        });

        submenu.addEventListener('mouseleave', () => {
            setTimeout(() => {
                if (!submenu.matches(':hover') && !menuItem.matches(':hover')) {
                    submenu.style.display = 'none';
                }
            }, 100);
        });

        // Insert before the divider (before Position/Segment ID section)
        if (divider) {
            menu.insertBefore(menuItem, divider);
            console.log('[2D Menu] Inserted menu item before divider');
        } else {
            menu.appendChild(menuItem);
            console.log('[2D Menu] Appended menu item at end');
        }
    }

    // Try to get the currently hovered segment ID from webknossos state
    function getHoveredSegmentId() {
        console.log('[Segment ID Debug] Trying to get hovered segment ID...');
        console.log('[Segment ID Debug] window.webknossos exists:', !!window.webknossos);

        // Try to access webknossos global state
        if (window.webknossos) {
            console.log('[Segment ID Debug] webknossos object:', Object.keys(window.webknossos));
        }

        // Try to find active segment in the UI
        const activeSegment = document.querySelector('[class*="segment"][class*="active"], [class*="segment"][class*="selected"]');
        console.log('[Segment ID Debug] Active segment element:', activeSegment);

        if (activeSegment) {
            const id = extractSegmentId(activeSegment);
            console.log('[Segment ID Debug] Extracted ID from UI:', id);
            return id;
        }

        console.log('[Segment ID Debug] No segment ID found');
        return null;
    }

    // Hide context menu on click outside
    document.addEventListener('click', (e) => {
        if (contextMenu && !contextMenu.contains(e.target)) {
            hideContextMenu();
        }
    });

    // Hide context menu on scroll
    document.addEventListener('scroll', () => {
        hideContextMenu();
    }, true);

    // Initialize
    function init() {
        console.log('Webknossos Segment Renamer initialized');
        setupSegmentListHandlers();
        setup2DViewHandlers();
    }

    // Wait for page to be fully loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
