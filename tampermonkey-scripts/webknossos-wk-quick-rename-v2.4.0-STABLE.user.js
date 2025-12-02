// ==UserScript==
// @name         WK Quick Rename (FIXED - React Compatible)
// @namespace    http://tampermonkey.net/
// @version      2.4.0
// @description  Fast segment renaming for WebKnossos - Fixed React state issues
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
        if (DEBUG) console.log('[WK Quick Rename v2]', ...args);
    }

    const SEMANTIC_IDS = [
        { id: 'dendrite', label: 'Dendrite', emoji: '🌲' },
        { id: 'axon', label: 'Axon', emoji: '⚡' },
        { id: 'soma', label: 'Soma', emoji: '🧬' },
        { id: 'nucleus', label: 'Nucleus', emoji: '🥜' },
        { id: 'glia', label: 'Glia', emoji: '🐙' },
        { id: 'extracellular-space', label: 'Extracellular Space', emoji: '⚪' },
        { id: 'myelin', label: 'Myelin', emoji: '🍩' },
        { id: 'blood-vessel', label: 'Blood Vessel', emoji: '❤️' },
        { id: 'fat-globule', label: 'Fat Globule', emoji: '🍔' },
        { id: 'tear', label: 'Tear', emoji: '💔' },
        { id: 'merge', label: 'Merge Between Classes', emoji: '🔀' },
        { id: 'uncertain', label: 'Uncertain', emoji: '❓' },
        { id: 'mitochondria', label: 'Mitochondria', emoji: '🔋' },
        { id: 'myelin-inner-tongue', label: 'Myelin Inner Tongue', emoji: '🌀' },
        { id: 'myelin-outer-tongue', label: 'Myelin Outer Tongue', emoji: '🌊' },
        { id: 'fold', label: 'Fold', emoji: '📐' },
        { id: 'cracks', label: 'Cracks', emoji: '💥' },
        { id: 'missing-data-full', label: 'Missing Data Full', emoji: '⬛' },
        { id: 'missing-data-partial', label: 'Missing Data Partial', emoji: '◻️' },
        { id: 'unknown', label: 'Unknown', emoji: '❔' },
        { id: 'merge-between-errors', label: 'Merge Between Errors', emoji: '🔴' }
    ];

    let contextMenu = null;
    let currentSegmentElement = null;
    let currentSegmentId = null;
    let isInitialized = false;

    // ========== UTILITY FUNCTIONS ==========

    function waitForElement(selector, parent = document, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const existing = parent.querySelector(selector);
            if (existing) {
                log('Element found immediately:', selector);
                return resolve(existing);
            }

            const observer = new MutationObserver(() => {
                const element = parent.querySelector(selector);
                if (element) {
                    log('Element found after waiting:', selector);
                    observer.disconnect();
                    clearTimeout(timeoutId);
                    resolve(element);
                }
            });

            observer.observe(parent, { childList: true, subtree: true });

            const timeoutId = setTimeout(() => {
                observer.disconnect();
                reject(new Error(`Timeout waiting for: ${selector}`));
            }, timeout);
        });
    }

    function setReactInputValue(input, value) {
        log('Setting React input value to:', value);

        // Focus first - important for React to recognize the interaction
        input.focus();

        // Clear existing value
        input.value = '';

        // Method 1: Use React's native value setter
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeInputValueSetter.call(input, value);

        // Method 2: Trigger input event (React 16+)
        const inputEvent = new Event('input', { bubbles: true, cancelable: true });
        input.dispatchEvent(inputEvent);

        // Method 3: Trigger change event (older React)
        const changeEvent = new Event('change', { bubbles: true, cancelable: true });
        input.dispatchEvent(changeEvent);

        // Method 4: Try InputEvent constructor for newer browsers
        try {
            const modernInputEvent = new InputEvent('input', {
                bubbles: true,
                cancelable: true,
                inputType: 'insertText',
                data: value,
            });
            input.dispatchEvent(modernInputEvent);
        } catch (e) {
            // InputEvent not supported, already fired Event above
        }

        // Method 5: Simulate typing each character (most aggressive, but works)
        setTimeout(() => {
            input.value = value;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }, 10);

        log('React input value set complete');
    }

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

        // Add animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(400px); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(notice);
        setTimeout(() => {
            notice.style.transition = 'opacity 0.3s';
            notice.style.opacity = '0';
            setTimeout(() => notice.remove(), 300);
        }, 3000);
    }

    function findEditButton(element) {
        log('Searching for edit button...');

        const strategies = [
            // Strategy 1: Look for edit icons
            () => element.querySelector('[data-icon="edit"], .anticon-edit, svg[data-icon="edit"]'),

            // Strategy 2: Look for buttons with edit in title/aria-label
            () => {
                const buttons = element.querySelectorAll('button, [role="button"]');
                return Array.from(buttons).find(btn => {
                    const title = (btn.title || '').toLowerCase();
                    const label = (btn.getAttribute('aria-label') || '').toLowerCase();
                    const text = (btn.textContent || '').toLowerCase();
                    return title.includes('edit') || label.includes('edit') || text.includes('edit');
                });
            },

            // Strategy 3: Look for Ant Design buttons
            () => element.querySelector('button.ant-btn'),

            // Strategy 4: Look for any button with a pencil icon (common edit icon)
            () => element.querySelector('button svg[viewBox*="64"]'), // Pencil icons often use this viewBox

            // Strategy 5: First visible button in the segment row
            () => {
                const buttons = Array.from(element.querySelectorAll('button'));
                return buttons.find(btn => btn.offsetParent !== null); // visible button
            },
        ];

        for (let i = 0; i < strategies.length; i++) {
            try {
                const button = strategies[i]();
                if (button) {
                    log(`Found edit button using strategy ${i + 1}`);
                    return button;
                }
            } catch (e) {
                log(`Strategy ${i + 1} failed:`, e.message);
            }
        }

        log('ERROR: No edit button found with any strategy');
        return null;
    }

    async function trySaveInput(element, input) {
        log('Attempting to save input...');

        // Wait a moment for React to process the change
        await new Promise(resolve => setTimeout(resolve, 200));

        // Strategy 1: Look for save/check button
        const saveButton = element.querySelector(
            'button[title*="save"], button[title*="Save"], ' +
            '[data-icon="check"], .anticon-check, svg[data-icon="check"], ' +
            'button[type="submit"]'
        );

        if (saveButton) {
            log('Found save button, clicking');
            saveButton.click();
            return true;
        }

        // Strategy 2: Press Enter key
        log('No save button, pressing Enter');
        const enterEvent = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true
        });
        input.dispatchEvent(enterEvent);

        // Also try keypress and keyup
        input.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', keyCode: 13, bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, bubbles: true }));

        // Blur to trigger save
        await new Promise(resolve => setTimeout(resolve, 100));
        input.blur();

        return true;
    }

    // ========== MAIN RENAME FUNCTION ==========

    async function renameSegmentInList(element, semantic) {
        log('=== Starting rename process for:', semantic.label, '===');

        try {
            // Find edit button
            const editButton = findEditButton(element);
            if (!editButton) {
                throw new Error('Could not find edit button');
            }

            log('Clicking edit button');
            editButton.click();

            // Wait for input field to appear
            log('Waiting for input field...');
            const input = await waitForElement(
                'input[type="text"], input.ant-input, input',
                element,
                3000
            );

            log('Input field found, setting value');
            setReactInputValue(input, semantic.label);

            // Try to save
            await trySaveInput(element, input);

            log('=== Rename process completed successfully ===');
            showNotification(`✓ Renamed to ${semantic.emoji} ${semantic.label}`, 'success');

        } catch (error) {
            log('=== Rename process FAILED ===');
            log('ERROR:', error.message);
            showNotification(`✗ Rename failed: ${error.message}`, 'error');
        }
    }

    // ========== CONTEXT MENU (List View) ==========

    function createContextMenu() {
        const menu = document.createElement('div');
        menu.id = 'wk-segment-context-menu';
        menu.style.cssText = `
            position: fixed;
            background: white;
            border: 1px solid #d9d9d9;
            border-radius: 4px;
            box-shadow: 0 3px 6px -4px rgba(0,0,0,.12), 0 6px 16px 0 rgba(0,0,0,.08), 0 9px 28px 8px rgba(0,0,0,.05);
            padding: 4px 0;
            z-index: 10000;
            display: none;
            min-width: 200px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 14px;
        `;

        SEMANTIC_IDS.forEach(semantic => {
            const item = document.createElement('div');
            item.className = 'wk-context-menu-item';
            item.textContent = semantic.emoji + ' ' + semantic.label;
            item.style.cssText = `
                padding: 8px 16px;
                cursor: pointer;
                transition: background 0.2s;
                color: #333;
            `;
            item.addEventListener('mouseenter', () => item.style.background = '#f5f5f5');
            item.addEventListener('mouseleave', () => item.style.background = 'white');
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                handleSemanticIdSelection(semantic);
                hideContextMenu();
            });
            menu.appendChild(item);
        });

        document.body.appendChild(menu);
        log('Context menu created');
        return menu;
    }

    function showContextMenu(x, y) {
        if (!contextMenu) {
            contextMenu = createContextMenu();
        }

        const menuWidth = 200;
        const menuHeight = SEMANTIC_IDS.length * 40;
        const maxX = window.innerWidth - menuWidth - 10;
        const maxY = window.innerHeight - menuHeight - 10;

        contextMenu.style.left = Math.min(Math.max(10, x), maxX) + 'px';
        contextMenu.style.top = Math.min(Math.max(10, y), maxY) + 'px';
        contextMenu.style.display = 'block';
        log('Context menu shown at', x, y);
    }

    function hideContextMenu() {
        if (contextMenu) {
            contextMenu.style.display = 'none';
        }
        currentSegmentElement = null;
        currentSegmentId = null;
    }

    function handleSemanticIdSelection(semantic) {
        log('Semantic ID selected:', semantic.label);
        if (currentSegmentElement) {
            log('Renaming from element');
            renameSegmentInList(currentSegmentElement, semantic);
        } else if (currentSegmentId) {
            log('Renaming by ID:', currentSegmentId);
            renameSegmentById(currentSegmentId, semantic);
        }
    }

    // ========== SEGMENT ID HANDLING ==========

    function extractSegmentId(element) {
        if (element.dataset && element.dataset.segmentId) {
            return element.dataset.segmentId;
        }
        const text = element.textContent || '';

        // Try to match segment ID patterns (more flexible now)
        const patterns = [
            /Segment\s+ID[:\s]+(\d+)/i,           // "Segment ID: 123"
            /Segment\s*\((\d+)\)/i,                // "Segment (123)"
            /ID[:\s]+(\d+)/i,                      // "ID: 123"
            /(\d+)$/,                              // Digits at END of string (for "Dendrite3", "Soma17")
            /\bSegment\s+(\d+)/i,                  // "Segment 123"
            /\b(\d+)\b/                            // Any standalone number (fallback)
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                log('Extracted segment ID:', match[1], 'using pattern:', pattern);
                return match[1];
            }
        }

        return null;
    }

    function renameSegmentById(segmentId, semantic) {
        log('Searching for segment by ID:', segmentId);

        const segmentElements = document.querySelectorAll(
            '[class*="segment"], [data-segment-id], .ant-tree-treenode, [class*="SegmentListItem"]'
        );

        for (const element of segmentElements) {
            // Try multiple methods to match the segment
            const elementId = extractSegmentIdFromElement(element, segmentId);
            if (elementId === String(segmentId)) {
                log('Found segment in DOM by ID match');
                renameSegmentInList(element, semantic);
                return;
            }
        }

        log('Segment not visible, attempting to scroll and find it');
        scrollToSegmentAndRename(segmentId, semantic);
    }

    function extractSegmentIdFromElement(element, targetId) {
        // Debug: Log element details when searching for specific ID
        if (DEBUG && targetId) {
            const sampleText = (element.textContent || '').substring(0, 50);
            log(`  Checking element: text="${sampleText}", class="${element.className}"`);
        }

        // Method 1: Check data attributes (most reliable)
        if (element.dataset) {
            if (element.dataset.segmentId) {
                log(`  ✓ Found via dataset.segmentId: ${element.dataset.segmentId}`);
                return element.dataset.segmentId;
            }
            if (element.dataset.id) {
                log(`  ✓ Found via dataset.id: ${element.dataset.id}`);
                return element.dataset.id;
            }
            if (element.dataset.key) {
                // Sometimes React uses keys like "segment-3"
                const keyMatch = element.dataset.key.match(/segment[_-]?(\d+)/i);
                if (keyMatch) {
                    log(`  ✓ Found via dataset.key: ${keyMatch[1]}`);
                    return keyMatch[1];
                }
            }
        }

        // Method 2: Check for hidden input or metadata
        const hiddenInput = element.querySelector('input[type="hidden"][name*="id"]');
        if (hiddenInput && hiddenInput.value) {
            log(`  ✓ Found via hidden input: ${hiddenInput.value}`);
            return hiddenInput.value;
        }

        // Method 3: Check aria-label or title attributes
        const ariaLabel = element.getAttribute('aria-label') || '';
        const title = element.getAttribute('title') || '';
        const labelMatch = ariaLabel.match(/segment[:\s]+(\d+)/i) || title.match(/segment[:\s]+(\d+)/i);
        if (labelMatch) {
            log(`  ✓ Found via aria-label/title: ${labelMatch[1]}`);
            return labelMatch[1];
        }

        // Method 4: Look for child elements with segment ID
        const idSpan = element.querySelector('[class*="segment-id"], [class*="segmentId"]');
        if (idSpan) {
            const idText = idSpan.textContent.match(/\d+/);
            if (idText) {
                log(`  ✓ Found via child span: ${idText[0]}`);
                return idText[0];
            }
        }

        // Method 5: Check if element has a stable class or ID containing segment number
        const className = element.className || '';
        const classMatch = className.match(/segment[_-](\d+)/i);
        if (classMatch) {
            log(`  ✓ Found via className: ${classMatch[1]}`);
            return classMatch[1];
        }

        const elementIdAttr = element.id || '';
        const idMatch = elementIdAttr.match(/segment[_-](\d+)/i);
        if (idMatch) {
            log(`  ✓ Found via element.id: ${idMatch[1]}`);
            return idMatch[1];
        }

        // Method 6: Try to extract from text content (fallback, less reliable after rename)
        const textId = extractSegmentId(element);
        if (textId) {
            log(`  ✓ Found via text content: ${textId}`);
        }
        return textId;
    }

    async function scrollToSegmentAndRename(targetId, semantic) {
        log('=== Starting scroll search for segment:', targetId, '===');

        // Find the scrollable container
        const scrollContainers = [
            document.querySelector('.ant-tree-list'),
            document.querySelector('[class*="SegmentList"]'),
            document.querySelector('.ant-tree'),
            document.querySelector('[role="tree"]'),
            ...Array.from(document.querySelectorAll('[class*="segment"]')).map(el => {
                let parent = el.parentElement;
                while (parent && parent !== document.body) {
                    const overflow = window.getComputedStyle(parent).overflowY;
                    if (overflow === 'auto' || overflow === 'scroll') {
                        return parent;
                    }
                    parent = parent.parentElement;
                }
                return null;
            }).filter(Boolean)
        ];

        const listContainer = scrollContainers.find(c => c !== null);

        if (!listContainer) {
            log('ERROR: Could not find scrollable segment list container');
            showNotification('Could not find segment list to scroll', 'error');
            return;
        }

        log('Found scroll container:', listContainer.className);
        log('Container scrollHeight:', listContainer.scrollHeight, 'clientHeight:', listContainer.clientHeight);

        // Check if container is actually scrollable
        const isScrollable = listContainer.scrollHeight > listContainer.clientHeight;
        if (!isScrollable) {
            log('Container is not scrollable - all segments should be visible');
            showNotification(`⚠ All segments visible but ID ${targetId} not found`, 'warning');
            return;
        }

        showNotification(`🔍 Searching for segment ${targetId}...`, 'info');

        const maxScrollAttempts = 50;
        const scrollStep = 100;
        let attempts = 0;
        let lastScrollTop = -1;

        // Function to search visible segments
        function searchVisibleSegments() {
            const nodes = document.querySelectorAll(
                '.ant-tree-treenode, [class*="segment"], [class*="SegmentListItem"]'
            );

            log(`Searching ${nodes.length} visible nodes for ID ${targetId}`);

            for (const node of nodes) {
                // Use the improved extraction method that checks data attributes first
                const nodeId = extractSegmentIdFromElement(node, targetId);
                if (nodeId === String(targetId)) {
                    log(`✓ Found segment after ${attempts} scroll attempts`);
                    return node;
                }
            }
            return null;
        }

        // Initial search
        log('Performing initial search before scrolling...');
        let foundElement = searchVisibleSegments();
        if (foundElement) {
            log('Segment found without scrolling');
            await renameSegmentInList(foundElement, semantic);
            return;
        }

        // Scroll to top first
        log('Scrolling to top of list first...');
        listContainer.scrollTop = 0;
        await new Promise(resolve => setTimeout(resolve, 300));

        // Start scrolling down
        async function scrollAndSearch() {
            attempts++;

            // Calculate new scroll position
            const oldScrollTop = listContainer.scrollTop;
            listContainer.scrollTop = oldScrollTop + scrollStep;
            const newScrollTop = listContainer.scrollTop;

            log(`Scroll attempt ${attempts}/${maxScrollAttempts}, old: ${oldScrollTop}, new: ${newScrollTop}, max: ${listContainer.scrollHeight}`);

            // Check if we actually scrolled (position changed)
            if (newScrollTop === oldScrollTop && oldScrollTop !== 0) {
                log('Reached bottom of list (scroll position unchanged), segment not found');
                showNotification(`✗ Segment ${targetId} not found in list`, 'error');
                return false;
            }

            lastScrollTop = newScrollTop;

            // Wait for virtual scroll to render new items
            await new Promise(resolve => setTimeout(resolve, 250));

            // Search again
            foundElement = searchVisibleSegments();
            if (foundElement) {
                log('✓ Segment found!');
                showNotification(`✓ Found segment ${targetId}`, 'success');

                // Scroll the element into view nicely
                foundElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await new Promise(resolve => setTimeout(resolve, 500));

                // Rename it
                await renameSegmentInList(foundElement, semantic);
                return true;
            }

            // Check if we've reached the bottom by comparing to scrollHeight
            if (newScrollTop + listContainer.clientHeight >= listContainer.scrollHeight - 10) {
                log('Reached bottom of scrollable area, segment not found');
                showNotification(`✗ Segment ${targetId} not found after scrolling entire list`, 'error');
                return false;
            }

            // Continue scrolling if we haven't reached max attempts
            if (attempts < maxScrollAttempts) {
                return scrollAndSearch();
            } else {
                log('Max scroll attempts reached');
                showNotification(`✗ Couldn't find segment ${targetId} after ${maxScrollAttempts} attempts`, 'error');
                return false;
            }
        }

        await scrollAndSearch();
    }

    // ========== SEGMENT LIST HANDLERS ==========

    function setupSegmentListHandlers() {
        log('Setting up segment list handlers');

        document.addEventListener('contextmenu', (e) => {
            let target = e.target;
            let segmentElement = null;
            let depth = 0;
            const maxDepth = 15;

            // Walk up the DOM tree to find segment container
            while (target && target !== document.body && depth < maxDepth) {
                const classList = target.classList || [];
                const className = target.className || '';

                const isSegment =
                    classList.contains('segment-item') ||
                    classList.contains('segment') ||
                    classList.contains('ant-tree-treenode') ||
                    (typeof className === 'string' && (
                        className.includes('segment') ||
                        className.includes('SegmentListItem') ||
                        className.includes('tree-node')
                    ));

                if (isSegment) {
                    segmentElement = target;
                    break;
                }

                target = target.parentElement;
                depth++;
            }

            if (segmentElement) {
                log('Right-click detected on segment element');
                e.preventDefault();
                e.stopPropagation();
                currentSegmentElement = segmentElement;
                currentSegmentId = extractSegmentId(segmentElement);
                log('Segment ID:', currentSegmentId);
                showContextMenu(e.pageX, e.pageY);
                return false;
            }
        }, true); // Use capture phase to catch event early

        log('Segment list handlers installed');
    }

    // ========== 2D VIEW DROPDOWN HANDLERS ==========

    function setup2DViewHandlers() {
        log('Setting up 2D view dropdown handlers');

        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === 1) {
                        let menu = node.classList?.contains('ant-dropdown-menu') ? node :
                                   node.querySelector?.('.ant-dropdown-menu');
                        if (menu) {
                            const segmentId = extractSegmentIdFromMenu(menu);
                            if (segmentId) {
                                log('Dropdown menu detected for segment:', segmentId);
                                injectRenameMenuItem(menu, segmentId);
                            }
                        }
                    }
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
        log('2D view handlers installed');
    }

    function extractSegmentIdFromMenu(menu) {
        const menuText = menu.textContent || '';
        const match = menuText.match(/Segment\s+ID:\s*(\d+)/i) ||
                     menuText.match(/Select\s+Segment\s*\((\d+)\)/i) ||
                     menuText.match(/ID:\s*(\d+)/i) ||
                     menuText.match(/\b(\d{4,})\b/); // Fallback: any 4+ digit number
        return match ? match[1] : null;
    }

    function injectRenameMenuItem(menu, segmentId) {
        if (menu.querySelector('.wk-rename-segment-item')) {
            log('Rename menu item already exists');
            return;
        }

        const divider = menu.querySelector('.ant-dropdown-menu-item-divider');
        const menuItem = document.createElement('li');
        menuItem.className = 'ant-dropdown-menu-item wk-rename-segment-item';
        menuItem.setAttribute('role', 'menuitem');
        menuItem.innerHTML = '<span class="ant-dropdown-menu-title-content">🏷️ Quick Rename <span style="float: right; margin-left: 16px;">▶</span></span>';

        // Create submenu
        const submenu = document.createElement('div');
        submenu.className = 'wk-rename-submenu';
        submenu.style.cssText = `
            position: fixed;
            background: white;
            border: 1px solid #d9d9d9;
            border-radius: 4px;
            box-shadow: 0 3px 6px -4px rgba(0,0,0,.12), 0 6px 16px 0 rgba(0,0,0,.08);
            padding: 4px 0;
            z-index: 10002;
            display: none;
            min-width: 200px;
            max-height: 400px;
            overflow-y: auto;
        `;

        SEMANTIC_IDS.forEach(semantic => {
            const subItem = document.createElement('div');
            subItem.textContent = semantic.emoji + ' ' + semantic.label;
            subItem.style.cssText = `
                padding: 8px 16px;
                cursor: pointer;
                color: #333;
                transition: background 0.2s;
            `;

            subItem.addEventListener('mouseenter', () => {
                subItem.style.background = '#f5f5f5';
            });

            subItem.addEventListener('mouseleave', () => {
                subItem.style.background = 'white';
            });

            subItem.addEventListener('click', async (e) => {
                e.stopPropagation();
                e.preventDefault();

                log('Submenu item clicked:', semantic.label);

                // Hide menus
                submenu.style.display = 'none';
                menu.style.display = 'none';

                // Set current segment
                currentSegmentId = segmentId;
                currentSegmentElement = null;

                // Perform rename
                handleSemanticIdSelection(semantic);
            });

            submenu.appendChild(subItem);
        });

        // Submenu positioning and visibility
        let submenuTimeout;

        menuItem.addEventListener('mouseenter', () => {
            clearTimeout(submenuTimeout);
            menuItem.style.background = '#f5f5f5';

            // Position submenu
            const rect = menuItem.getBoundingClientRect();
            const submenuWidth = 200;
            const submenuHeight = Math.min(400, SEMANTIC_IDS.length * 40);

            // Position to the right, or left if no room
            let left = rect.right + 5;
            if (left + submenuWidth > window.innerWidth) {
                left = rect.left - submenuWidth - 5;
            }

            // Position vertically aligned, or adjusted if no room
            let top = rect.top;
            if (top + submenuHeight > window.innerHeight) {
                top = window.innerHeight - submenuHeight - 10;
            }

            submenu.style.left = Math.max(10, left) + 'px';
            submenu.style.top = Math.max(10, top) + 'px';
            submenu.style.display = 'block';

            if (!submenu.parentElement) {
                document.body.appendChild(submenu);
            }
        });

        menuItem.addEventListener('mouseleave', (e) => {
            submenuTimeout = setTimeout(() => {
                if (!submenu.matches(':hover')) {
                    menuItem.style.background = 'white';
                    submenu.style.display = 'none';
                }
            }, 200);
        });

        submenu.addEventListener('mouseenter', () => {
            clearTimeout(submenuTimeout);
        });

        submenu.addEventListener('mouseleave', () => {
            submenuTimeout = setTimeout(() => {
                menuItem.style.background = 'white';
                submenu.style.display = 'none';
            }, 200);
        });

        // Insert menu item
        if (divider) {
            menu.insertBefore(menuItem, divider);
        } else {
            menu.appendChild(menuItem);
        }

        log('Rename menu item injected');
    }

    // ========== GLOBAL EVENT HANDLERS ==========

    document.addEventListener('click', (e) => {
        if (contextMenu && !contextMenu.contains(e.target)) {
            hideContextMenu();
        }
    });

    document.addEventListener('scroll', hideContextMenu, true);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideContextMenu();
        }
    });

    // ========== DEBUG HELPER ==========

    // Expose a debug function to inspect segment elements
    window.wkDebugSegment = function(element) {
        if (!element) {
            console.log('Usage: wkDebugSegment(element)');
            console.log('Right-click a segment and type: wkDebugSegment($0)');
            return;
        }

        console.log('=== Segment Debug Info ===');
        console.log('Element:', element);
        console.log('Text content:', element.textContent);
        console.log('Class:', element.className);
        console.log('ID:', element.id);
        console.log('Dataset:', element.dataset);
        console.log('Aria-label:', element.getAttribute('aria-label'));
        console.log('Title:', element.getAttribute('title'));
        console.log('All attributes:');
        for (let attr of element.attributes) {
            console.log(`  ${attr.name} = "${attr.value}"`);
        }
        console.log('Extracted ID:', extractSegmentIdFromElement(element, null));
    };

    log('Debug helper available: wkDebugSegment($0)');

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
        log('WK Quick Rename v2.4.0 - Fixed Trailing Number Bug');
        log('Current URL:', window.location.href);
        log('='.repeat(50));

        setupSegmentListHandlers();
        setup2DViewHandlers();

        isInitialized = true;
        log('✓ Initialization complete - Script is ACTIVE!');

        // Show visual confirmation
        showNotification('✓ WK Quick Rename v2.4 - Renamed segments fixed!', 'success');
    }

    // Start initialization
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => waitForWebKnossos(init));
    } else {
        waitForWebKnossos(init);
    }

    log('Script loaded, waiting for WebKnossos UI...');
})();
