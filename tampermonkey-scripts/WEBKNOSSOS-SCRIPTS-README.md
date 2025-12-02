# WebKnossos Tampermonkey Scripts

Production-ready scripts for enhancing WebKnossos workflow.

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) browser extension
2. Click Tampermonkey icon → Dashboard
3. Click "+" tab or Utilities → Import from file
4. Import the `.user.js` files from this folder
5. Save and reload WebKnossos

## Available Scripts

### 1. Volume Opacity Toggle
**File:** `webknossos-volume-opacity-toggle.user.js`
**Shortcut:** `Ctrl+Shift+O`
**Function:** Toggles the Volume layer's main Opacity between 1 and your saved value

**Usage:**
- Press `Ctrl+Shift+O` to toggle
- First press: Opacity → 1 (saves current value, e.g., 15)
- Second press: Opacity → 15 (restores saved value)
- Continues toggling between 1 and your saved value

**How it works:**
- Finds the `.tracing-settings-menu` container
- Identifies the Volume layer (the div WITHOUT `.ant-spin-nested-loading`)
- Toggles the first "Opacity" input (not "Pattern Opacity")

---

### 2. Pattern Opacity Toggle
**File:** `webknossos-pattern-opacity-toggle.user.js`
**Shortcut:** `Ctrl+Shift+P`
**Function:** Toggles the Volume layer's Pattern Opacity between 1 and your saved value

**Usage:**
- Press `Ctrl+Shift+P` to toggle
- First press: Pattern Opacity → 1 (saves current value, e.g., 40)
- Second press: Pattern Opacity → 40 (restores saved value)

---

### 3. 2D EM Opacity Toggle
**File:** `webknossos-2d-em-opacity-toggle.user.js`
**Shortcut:** `Ctrl+Shift+E` (or custom)
**Function:** Toggles the cutout/EM layer's opacity between 1 and your saved value

**Note:** This was the first version created during development. May target the top-level EM layer.

---

### 4. Quick Rename (v2.4.0)
**File:** `webknossos-wk-quick-rename-v2.4.0-STABLE.user.js`
**Function:** Adds "Quick Rename" option to segment context menu for fast renaming

**Usage:**
- Right-click on a segment in 2D view
- Select "Quick Rename Selected Segment"
- Enter new name in prompt
- Segment is renamed instantly

---

## Keyboard Shortcuts Summary

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+O` | Toggle Volume Opacity (1 ↔ saved value) |
| `Ctrl+Shift+P` | Toggle Pattern Opacity (1 ↔ saved value) |
| `K` | Open/close layers panel (WebKnossos default) |

---

## Debugging

All scripts include detailed console logging. To debug:

1. Open browser console (`F12`)
2. Trigger the script action
3. Look for log messages starting with `[WK ...]`
4. Logs show exactly what the script is finding and doing

Example log output:
```
[WK Opacity Toggle] === Toggle Opacity Triggered ===
[WK Opacity Toggle] ✓ Found tracing-settings-menu container
[WK Opacity Toggle] Found 3 direct child divs in settings menu
[WK Opacity Toggle]   - Child div #0: has ant-spin-nested-loading = true
[WK Opacity Toggle]   - Child div #1: has ant-spin-nested-loading = false
[WK Opacity Toggle]   - ✓ This is the Volume div (no spin loading)
[WK Opacity Toggle] Found 1 "Opacity" labels in Volume div
[WK Opacity Toggle] ✓ FOUND THE INPUT!
[WK Opacity Toggle] Current value: 15
```

---

## Troubleshooting

### Script not working after WebKnossos update
WebKnossos may change its DOM structure. If a script stops working:
1. Check console for error messages
2. Verify the layers panel is open (press `K`)
3. The Volume layer must be expanded to see opacity controls

### "Could not find..." error
- Make sure the layers panel is open (`K` key)
- Ensure the Volume layer is visible in the left sidebar
- Check that opacity controls are visible when you manually expand the layer

### Wrong layer being toggled
If the script toggles the wrong opacity:
1. Check console logs to see which div it's selecting
2. Verify the DOM structure hasn't changed
3. The Volume layer should be the div WITHOUT `.ant-spin-nested-loading`

---

## Technical Details

**Target URLs:**
- `*://webknossos.org/*`
- `*://*.webknossos.org/*`
- `*://wk.zetta.ai:9000/*`
- `*://wk.zetta.ai/*`
- `*://localhost:9090/*`
- `*://127.0.0.1:9090/*`

**Dependencies:** None (vanilla JavaScript)

**Compatible with:** Tampermonkey, Greasemonkey, Violentmonkey

---

## Version History

### Volume Opacity Toggle
- **v1.0.0** (2025-11-19) - Initial release
  - Targets Volume layer specifically
  - Uses `.tracing-settings-menu` container detection
  - Distinguishes layers by `.ant-spin-nested-loading` presence

### Pattern Opacity Toggle
- **v1.0.0** (2025-11-19) - Initial release
  - Targets "Pattern Opacity" label
  - Same layer detection logic as Volume Opacity Toggle

### 2D EM Opacity Toggle
- **v1.0.0** (2025-11-19) - Initial release
  - First version created during development
  - May target top-level EM layer

### Quick Rename
- **v2.4.0** (Stable) - Production version
  - Context menu integration
  - Fast segment renaming

---

## Development Notes

These scripts were developed through iterative debugging to handle WebKnossos's dynamic DOM structure:

1. **Initial approach:** Used `.ant-collapse-item` selectors (didn't exist)
2. **Second approach:** Searched for "Volume" text globally (too broad, found wrong layer)
3. **Final solution:** Target `.tracing-settings-menu` and distinguish children by `.ant-spin-nested-loading` presence

**Key insight:** The Volume layer is the second child div in `.tracing-settings-menu` and is uniquely identified by NOT having `.ant-spin-nested-loading` class.

---

*Last updated: 2025-11-19*
