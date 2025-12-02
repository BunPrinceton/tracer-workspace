# Changelog

All notable changes to the Webknossos Segment Renamer will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-11-17

### Changed
- **BREAKING**: Updated semantic ID categories to match neuroscience annotation needs:
  - Dendrite, Axon, Soma, Nucleus, Glia, Extracellular Space, Myelin, Blood Vessel, Merge Between Classes, Uncertain
  - Removed: Spine, Bouton, Mitochondria, Vesicle, Synapse
- Updated emoji icons to better represent each category

### Added
- Smart submenu positioning - automatically adjusts to stay on screen
- Submenu shows to left if it would go off right edge
- Submenu adjusts vertically if it would go off bottom edge

## [1.6.0] - 2025-11-17

### Fixed
- **Major Fix**: 2D view context menu now working correctly
- Changed MutationObserver to watch for `.ant-dropdown-menu` directly instead of empty container
- Resolved timing issue where menu container was detected before content was added

### Changed
- Simplified menu detection logic
- Removed retry/timeout mechanism (no longer needed)

## [1.5.2] - 2025-11-17

### Added
- Retry logic for menu detection (up to 10 attempts, 20ms intervals)
- Multiple selector fallbacks for menu element
- Enhanced debug logging

### Fixed
- Attempted to fix timing issues with menu detection

## [1.5.1] - 2025-11-17

### Added
- 50ms delay for menu rendering after container detection

### Fixed
- Attempted to resolve menu detection timing issues

## [1.5.0] - 2025-11-17

### Added
- Extract segment ID directly from context menu text (more reliable)
- Proper `<li>` element creation matching Ant Design structure
- Insert menu item before divider for better positioning

### Changed
- Improved menu detection to look for `.node-context-menu` container
- Better integration with Webknossos native context menu

## [1.4.1] - 2025-11-17

### Added
- Comprehensive debug logging for 2D menu detection
- Logging for segment ID extraction

## [1.4.0] - 2025-11-17

### Added
- **Major Feature**: 2D viewport context menu integration
- MutationObserver to detect Webknossos context menus
- Inject custom "Rename Segment" menu item into native context menus
- Submenu with semantic IDs appears on hover
- Extract segment ID from Webknossos context menu

### Changed
- Context menu now integrates with existing Webknossos menus instead of replacing them

## [1.3.0] - 2025-11-17

### Added
- Automatic save button detection and clicking
- Press Enter key as fallback save method
- Look for checkmark/save button after entering segment name

### Fixed
- Segment renaming now properly saves (was reverting before)
- Click save button or press Enter to confirm rename

## [1.2.0] - 2025-11-17

### Changed
- Use native input value setter for React compatibility
- Only trigger `input` event (removed `change` and Enter key events)
- Increased delay before blur to 300ms for React processing

### Fixed
- Attempted to fix React state management issues

## [1.1.0] - 2025-11-17

### Added
- Automatically click pencil/edit icon before renaming
- Search for edit button with multiple selectors
- Press Enter key to confirm rename
- Blur input field as backup save method

### Fixed
- Segment renaming now works with Webknossos edit button workflow

## [1.0.0] - 2025-11-17

### Added
- Initial release
- Right-click context menu for segment list
- 10 semantic ID categories with emoji icons
- Custom context menu styling
- Support for webknossos.org and wk.zetta.ai domains
- Dark text color for menu items (fixed white-on-white issue)

### Features
- Segment list renaming via right-click
- Custom context menu with semantic categories
- Automatic segment name input field detection
- Basic error handling and console logging

## Development Notes

### Version Numbering
- **Major (X.0.0)**: Breaking changes, significant feature additions
- **Minor (x.X.0)**: New features, backwards compatible
- **Patch (x.x.X)**: Bug fixes, minor improvements

### Testing Checklist
- [ ] Segment list right-click renaming works
- [ ] 2D viewport right-click renaming works
- [ ] Submenu positioning stays on screen
- [ ] All semantic IDs rename correctly
- [ ] Console shows no errors
- [ ] Works on custom Webknossos domains

---

[2.0.0]: https://github.com/yourusername/tampermonkey-scripts/releases/tag/v2.0.0
[1.6.0]: https://github.com/yourusername/tampermonkey-scripts/releases/tag/v1.6.0
