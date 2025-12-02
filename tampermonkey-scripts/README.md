# Webknossos Segment Renamer

A Tampermonkey userscript that adds quick semantic renaming to Webknossos segments via context menus.

## Features

✨ **Two Ways to Rename Segments:**
- 🖱️ Right-click segments in the **segment list** for instant renaming
- 🎯 Right-click segments in **2D viewports** via integrated context menu

🎨 **Pre-defined Semantic Categories:**
- 🔴 Dendrite
- 🔵 Axon
- 🟡 Soma
- 🟣 Nucleus
- 🟠 Glia
- ⚪ Extracellular Space
- 🟤 Myelin
- ❤️ Blood Vessel
- 🔀 Merge Between Classes
- ❓ Uncertain

⚡ **Smart Features:**
- Automatic edit mode activation
- Smart submenu positioning (never goes off-screen!)
- Works with Webknossos's native context menus
- Visual feedback with emoji icons

## Installation

### Prerequisites

1. **Install Tampermonkey** extension for your browser:
   - [Chrome/Brave](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
   - [Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
   - [Edge](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)

### Install the Script

**Option 1: Direct Install (Recommended)**
1. Click on the raw script file: [webknossos-segment-renamer.user.js](scripts/webknossos-segment-renamer.user.js)
2. Tampermonkey will automatically detect it and show an installation prompt
3. Click **Install**

**Option 2: Manual Install**
1. Copy the contents of [webknossos-segment-renamer.user.js](scripts/webknossos-segment-renamer.user.js)
2. Open Tampermonkey Dashboard
3. Click **"+"** to create a new script
4. Paste the code
5. Save (Ctrl+S / Cmd+S)

## Usage

### Renaming from Segment List

1. Open a Webknossos annotation
2. **Right-click** any segment in the segment list
3. Choose a semantic ID from the popup menu
4. ✅ Segment automatically renamed!

### Renaming from 2D View

1. Open a Webknossos annotation
2. **Right-click** on a segment in any 2D viewport
3. Look for **"🏷️ Rename Segment ▶"** in the context menu
4. Hover to see submenu with semantic IDs
5. Click your choice
6. ✅ Segment automatically renamed!

## Configuration

### Custom Webknossos Domain

If your Webknossos instance is on a custom domain, update the `@match` directives:

```javascript
// Add your domain to the script header
// @match        https://your-domain.com/*
// @match        http://your-domain.com:9000/*
```

### Custom Semantic IDs

Edit the `SEMANTIC_IDS` array in the script:

```javascript
const SEMANTIC_IDS = [
    { id: 'your-id', label: 'Your Label', emoji: '🎯' },
    { id: 'another', label: 'Another Type', emoji: '🌟' },
    // Add more...
];
```

## Compatibility

- ✅ Webknossos (tested on wk.zetta.ai)
- ✅ Chrome/Brave/Edge (Chromium-based browsers)
- ✅ Firefox
- ✅ Tampermonkey 5.0+

## Troubleshooting

### Script not working?

1. **Check Tampermonkey icon** - should show the script is enabled
2. **Open Console** (F12) - look for "Webknossos Segment Renamer initialized"
3. **Verify URL match** - script only runs on configured domains

### Menu not appearing in 2D view?

- Check console for `[2D Menu]` debug messages
- Ensure you're right-clicking directly on a segment
- Webknossos should show segment ID in its context menu

### Renaming not saving?

- The script automatically clicks the save button
- Check console for any error messages
- Verify you can rename manually (pencil icon → edit → enter)

## Development

### Debug Mode

The script logs detailed information to the console:

```
[2D Menu] Found segment context menu with ID: 23
[2D Menu] Injecting rename menu item for segment: 23
[2D Menu] Inserted menu item before divider
```

Open DevTools (F12) → Console to see these messages.

### Project Structure

```
tampermonkey-scripts/
├── README.md                                    # This file
├── CHANGELOG.md                                 # Version history
├── LICENSE                                      # License information
├── QUICK_START.md                              # Quick reference guide
└── scripts/
    └── webknossos-segment-renamer.user.js      # Main script
```

## Contributing

Contributions are welcome! To contribute:

1. Fork this repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test thoroughly on your Webknossos instance
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) file for details.

Free to use for research, personal, and commercial projects.

## Acknowledgments

- Built for the neuroscience community
- Designed for [Webknossos](https://webknossos.org/) - open-source annotation tool
- Uses Ant Design context menu patterns

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and updates.

## Support

- 🐛 **Report bugs**: [Open an issue](../../issues)
- 💡 **Request features**: [Open an issue](../../issues)
- ❓ **Questions**: Check existing issues or open a new one

---

Made with ❤️ for efficient connectomics annotation
