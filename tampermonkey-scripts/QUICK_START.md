# Quick Start Guide

## Install Script (30 seconds)

1. **Open Tampermonkey Dashboard**
   - Click Tampermonkey icon in browser → "Dashboard"

2. **Import the script**
   - Go to "Utilities" tab
   - Click "Choose File" under "Import from file"
   - Select: `/Users/bds2/Documents/tampermonkey-scripts/scripts/webknossos-segment-renamer.user.js`
   - Click "Install"

   **OR** just drag the file into the browser window

3. **Done!** Navigate to webknossos.org and start using it

## Usage (2 ways)

### Method 1: Segment List
Right-click any segment → Pick semantic ID

### Method 2: 2D View
Right-click on a segment in viewport → Pick semantic ID

## Semantic IDs Available

🔵 Axon • 🔴 Dendrite • 🟡 Soma • 🟢 Spine • 🟣 Bouton
🟠 Glia • ⚫ Mitochondria • ⚪ Vesicle • ✨ Synapse • ❓ Unknown

## Edit Semantic IDs

1. Tampermonkey Dashboard → Click script name
2. Find `SEMANTIC_IDS` array (line ~20)
3. Add/edit entries:
   ```javascript
   { id: 'your-id', label: 'Your Label', emoji: '🎯' }
   ```
4. Save (Cmd+S) → Refresh webknossos

## Troubleshooting

**Menu not showing?**
- Check Tampermonkey icon - script should be enabled (green toggle)
- Press F12 → Console → Should see "Webknossos Segment Renamer initialized"

**Different webknossos domain?**
- Edit script, add your domain to `@match` lines at top
- Example: `// @match https://your-domain.com/*`

That's it! 🎉
