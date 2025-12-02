// ==UserScript==
// @name         WK Quick Rename
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Fast segment renaming for WebKnossos
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
        { id: 'uncertain', label: 'Uncertain', emoji: '❓' }
    ];

    let contextMenu = null;
    let currentSegmentElement = null;
    let currentSegmentId = null;

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
            item.style.cssText = `
                padding: 8px 16px;
                cursor: pointer;
                transition: background 0.2s;
                color: #333;
            `;
            item.addEventListener('mouseenter', () => item.style.background = '#f0f0f0');
            item.addEventListener('mouseleave', () => item.style.background = 'white');
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

    function handleSemanticIdSelection(semantic) {
        if (currentSegmentElement) {
            renameSegmentInList(currentSegmentElement, semantic);
        } else if (currentSegmentId) {
            renameSegmentById(currentSegmentId, semantic);
        }
    }

    function renameSegmentInList(element, semantic) {
        const editButton = element.querySelector('button[title*="edit"], [title*="Edit"], .anticon-edit, svg[data-icon="edit"]')
            || Array.from(element.querySelectorAll('button, [role="button"]'))
                .find(btn => btn.title?.toLowerCase().includes('edit'));

        if (editButton) {
            editButton.click();

            setTimeout(() => {
                const input = element.querySelector('input[type="text"]');
                if (input) {
                    input.focus();
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                    nativeInputValueSetter.call(input, semantic.label);
                    input.dispatchEvent(new Event('input', { bubbles: true }));

                    setTimeout(() => {
                        const saveButton = element.querySelector('button[title*="save"], .anticon-check, svg[data-icon="check"]');
                        if (saveButton) {
                            saveButton.click();
                        } else {
                            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
                        }
                        input.blur();
                    }, 100);
                }
            }, 150);
        }
    }

    function renameSegmentById(segmentId, semantic) {
        // First try to find it in currently visible DOM
        const segmentElements = document.querySelectorAll('[class*="segment"], [data-segment-id]');
        for (const element of segmentElements) {
            const elementId = element.dataset.segmentId || element.textContent.match(/\d+/)?.[0];
            if (elementId === String(segmentId)) {
                renameSegmentInList(element, semantic);
                return;
            }
        }

        // Not visible - need to scroll to find it
        scrollToSegmentAndRename(segmentId, semantic);
    }

    function scrollToSegmentAndRename(targetId, semantic) {
        const listContainer = document.querySelector('.ant-tree-list');
        if (!listContainer) return;

        let attempts = 0;
        const maxAttempts = 30;

        function searchAndScroll() {
            attempts++;

            // Check if segment is now visible
            const nodes = Array.from(listContainer.querySelectorAll('.ant-tree-treenode'));
            for (const node of nodes) {
                const text = node.textContent?.trim() || '';
                if (text.includes(targetId)) {
                    // Found it! Rename it
                    renameSegmentInList(node, semantic);
                    return true;
                }
            }

            // Not found yet - scroll down and try again
            if (attempts < maxAttempts) {
                listContainer.scrollTop += 200;
                setTimeout(searchAndScroll, 100);
            }

            return false;
        }

        searchAndScroll();
    }

    function extractSegmentId(element) {
        if (element.dataset.segmentId) {
            return element.dataset.segmentId;
        }
        const idMatch = element.textContent.match(/(\d+)/);
        return idMatch ? idMatch[1] : null;
    }

    function setupSegmentListHandlers() {
        document.addEventListener('contextmenu', (e) => {
            let target = e.target;
            let segmentElement = null;

            while (target && target !== document.body) {
                if (target.classList && (
                    target.classList.contains('segment-item') ||
                    target.classList.contains('segment') ||
                    target.getAttribute('class')?.includes('segment')
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

    function setup2DViewHandlers() {
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === 1) {
                        let menu = node.classList?.contains('ant-dropdown-menu') ? node : node.querySelector?.('.ant-dropdown-menu');
                        if (menu) {
                            const segmentId = extractSegmentIdFromMenu(menu);
                            if (segmentId) {
                                injectRenameMenuItem(menu, segmentId);
                            }
                        }
                    }
                }
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function extractSegmentIdFromMenu(menu) {
        const menuText = menu.textContent || '';
        const match = menuText.match(/Segment\s+ID:\s*(\d+)/i) || menuText.match(/Select\s+Segment\s*\((\d+)\)/i);
        return match ? match[1] : null;
    }

    function injectRenameMenuItem(menu, segmentId) {
        if (menu.querySelector('.wk-rename-segment-item')) return;

        const divider = menu.querySelector('.ant-dropdown-menu-item-divider');
        const menuItem = document.createElement('li');
        menuItem.className = 'ant-dropdown-menu-item wk-rename-segment-item';
        menuItem.setAttribute('role', 'menuitem');
        menuItem.innerHTML = '<span class="ant-dropdown-menu-title-content">🏷️ Rename Segment <span style="float: right">▶</span></span>';

        const submenu = document.createElement('div');
        submenu.style.cssText = `
            position: fixed; background: white; border: 1px solid #ccc;
            border-radius: 4px; box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            padding: 4px 0; z-index: 10001; display: none; min-width: 180px;
        `;

        SEMANTIC_IDS.forEach(semantic => {
            const subItem = document.createElement('div');
            subItem.textContent = `${semantic.emoji} ${semantic.label}`;
            subItem.style.cssText = 'padding: 8px 16px; cursor: pointer; color: #333;';
            subItem.addEventListener('mouseenter', () => subItem.style.background = '#f0f0f0');
            subItem.addEventListener('mouseleave', () => subItem.style.background = 'white');
            subItem.addEventListener('click', (e) => {
                e.stopPropagation();
                currentSegmentId = segmentId;
                currentSegmentElement = null;
                handleSemanticIdSelection(semantic);
                menu.remove();
                submenu.remove();
            });
            submenu.appendChild(subItem);
        });

        menuItem.addEventListener('mouseenter', () => {
            menuItem.style.background = '#f0f0f0';
            const rect = menuItem.getBoundingClientRect();
            submenu.style.display = 'block';
            document.body.appendChild(submenu);
            const left = rect.right + submenu.offsetWidth > window.innerWidth ? rect.left - submenu.offsetWidth : rect.right;
            const top = Math.min(rect.top, window.innerHeight - submenu.offsetHeight - 10);
            submenu.style.left = left + 'px';
            submenu.style.top = top + 'px';
        });

        menuItem.addEventListener('mouseleave', () => {
            setTimeout(() => {
                if (!submenu.matches(':hover')) {
                    menuItem.style.background = 'white';
                    submenu.style.display = 'none';
                }
            }, 100);
        });

        submenu.addEventListener('mouseleave', () => {
            setTimeout(() => {
                if (!menuItem.matches(':hover')) submenu.style.display = 'none';
            }, 100);
        });

        if (divider) {
            menu.insertBefore(menuItem, divider);
        } else {
            menu.appendChild(menuItem);
        }
    }

    document.addEventListener('click', (e) => {
        if (contextMenu && !contextMenu.contains(e.target)) hideContextMenu();
    });

    document.addEventListener('scroll', hideContextMenu, true);

    function init() {
        console.log('WK Quick Rename v1.0.0');
        setupSegmentListHandlers();
        setup2DViewHandlers();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
