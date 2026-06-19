# Symbol Palette - Agent Guide

> **Purpose**: Essential context for AI coding agents working on this project. Read this first before making any changes.

---

## Project Overview

**Symbol Palette** is an Adobe CEP panel extension for Adobe Illustrator designed for **Mushaf (Quran typesetting)** workflows. It provides a quick-access palette for inserting symbols and ayah numbers from external SVG files, with automatic page detection and ornament alignment.

| Attribute | Value |
|-----------|-------|
| Host Application | Adobe Illustrator (ILST) |
| CEP Version | 7.0 (CSXS.7) |
| Extension Type | Panel |
| Panel Size | 280x300px default; min 260x200px; max 600x1200px |
| Current Version | 1.4.1 |

---

## Technology Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| UI | HTML5, CSS3, Vanilla JavaScript | No frameworks. Single-page panel UI in `index.html`. |
| Illustrator Integration | ExtendScript (JSX) | `jsx/host.jsx` — open SVG, copy/paste, layer manipulation. |
| CEP Bridge | `js/CSInterface.js` | Custom minimal CEP bridge (43 lines). |
| Node.js | Used inside CEP via `--enable-nodejs` | File system ops, drive scanning, updater. |
| File I/O | `window.cep.fs` with Node.js `fs` fallback | Google Drive permission issues handled. |
| Storage | `localStorage` for UI state; shared JSON on drive | Settings and layer buttons saved to project drive. |
| Update Mechanism | Windows `.bat` files + PowerShell + robocopy | Same pattern as mushaftask and ornamentReplacer. |
| CSS Theme | Adobe-dark matching Illustrator dark mode. | |

**Critical constraint**: ES6 modules (`import`/`export`) are **not used**. Scripts load via traditional `<script>` tags. Node.js APIs are available directly via `require()` in the mixed context.

---

## Project Structure

    symbolPalette/
    |-- .debug                      # CEP debug config (port 8090)
    |-- .gitattributes
    |-- .gitignore
    |-- CSXS/
    |   |-- manifest.xml            # CEP extension manifest
    |-- assets/
    |   |-- icons/
    |       |-- add.svg
    |       |-- drive.svg
    |       |-- remove.svg
    |-- css/
    |   |-- style.css               # Full dark-theme UI (1568 lines)
    |-- js/
    |   |-- CSInterface.js          # Minimal CEP bridge
    |   |-- drive-scanner.js        # Reusable Google Drive auto-discovery (596 lines)
    |   |-- main.js                 # Core extension logic (2806 lines)
    |   |-- updater.js              # Self-updater logic (331 lines)
    |-- jsx/
    |   |-- host.jsx                # ExtendScript host functions (814 lines)
    |-- index.html                  # Main panel UI (343 lines)
    |-- check-update.bat            # Checks GitHub for newer version
    |-- update.bat                  # Downloads and installs update
    |-- install.bat                 # Team installer to AppData
    |-- CutPasteFront.jsx           # Standalone ExtendScript snippet
    |-- flatten_rename.json         # Archived batch tool for flattening number SVGs
    |-- page_system_statistics.json # Ayah counts for 604 pages x 6 systems
    |-- page_system_statistics_guide.md
    |-- README.md
    |-- Symbol.aia                  # Illustrator action set (layer isolation)
    |-- ToolShed.aip                # Adobe Illustrator plugin binary (~8.5 MB)
    |-- version.json                # Current version: 1.4.1

---

## Build and Test Commands

### No Build System

This project has **no build process**, **no package manager**, and **no bundler**.

- Edit files directly.
- Changes take effect after restarting Illustrator or reloading the extension.
- There is no transpilation step.

### Installation Locations

| Location | Path | Admin Required |
|----------|------|---------------|
| User | `%APPDATA%\Adobe\CEP\extensions\symbolPalette\` | **No** |
| System (x86) | `C:\Program Files (x86)\Common Files\Adobe\CEP\extensions\` | Yes |
| System (x64) | `C:\Program Files\Common Files\Adobe\CEP\extensions\` | Yes |

### Testing

There is **no automated test suite**. Testing is entirely manual. Verify:

1. **Panel loads** without console errors.
2. **Root folder selection** works; categories and symbols load.
3. **Symbol click** pastes SVG into active document.
4. **Page detection** works with filenames like `001-hafs.ai`.
5. **Ayah number grid** shows correct numbers for detected page.
6. **Import All** aligns numbers to ornament markers.
7. **Layer tools** scan, rename, and move selections correctly.
8. **Updater** checks for updates and installs correctly.

---

## Code Organization

### Key Global Objects

- `csInterface` — CEP bridge instance.
- `rootFolder` — Selected project root containing `symbols/` and `numbers/`.
- `symbols` — Array of symbol objects `{name, path, category}`.
- `currentPageInfo` — Detected page info `{detected, pageNumber, riwayah, systemKey, ayahNumbers, ayahNumbersBySurah}`. The ayah numbers are grouped by surah for the UI grid while the flat `ayahNumbers` array is preserved for bulk import.
- `riwayahSettings` — Qurra data and counting system mappings.

### Script Loading Order

`index.html` loads scripts in this order:

1. `js/CSInterface.js`
2. `js/drive-scanner.js`
3. `js/updater.js`
4. `js/main.js`

---

## Runtime Architecture

### CEP Context

The extension runs inside Adobe Illustrator's CEF panel with these flags:

- `--enable-nodejs` — Node.js APIs available.
- `--mixed-context` — JSX and JS share context.

### Communication Flow

    User clicks in HTML panel
        |
        v
    JavaScript in main.js
        |
        v
    csInterface.evalScript('extendScriptFunction()')
        |
        v
    jsx/host.jsx executes in Illustrator
        |
        v
    Callback returns result to JS (always as a string)

### Data Storage Locations

**Extension state** (localStorage):
- `symbolPalette_data_v3` — rootFolder, symbolCategory

**Shared settings** (on project drive):
- `{projectRoot}/mushaftasks/counting/symbolPalette_settings.json` — riwayah mappings, default system
- `{projectRoot}/mushaftasks/symbolPalette_layerButtons.json` — custom layer buttons
- `{projectRoot}/mushaftasks/layers/layerColors.json` — layer color definitions

---

## Code Style Guidelines

### JavaScript

- **No ES6 modules** — Use traditional script loading and global namespace.
- **Var / let / const mixed** — Follow the surrounding style.
- **Functions are hoisted** — Declared with `function name() {}`.
- **Console logging is heavy** — Do not remove existing logs.
- **Path separators** — Normalize with `.replace(/\\/g, '/')`.
- **ExtendScript returns strings** — Check for `"null"`, `"undefined"`, `"Error"`.

### CSS

- CSS custom properties in `:root` for theming.
- Dark theme matching Adobe Illustrator native panels.

---

## Common Pitfalls for Agents

1. **Do not add ES6 module imports** — CEP does not support import/export.
2. **Do not delete console.log statements**.
3. **Path separators** — Normalize paths with `.replace(/\\/g, '/')`.
4. **ExtendScript returns strings** — Even booleans/nulls come back as strings.
5. **Node.js availability** — Check `typeof require !== 'undefined'`.
6. **Shared settings depend on rootFolder** — If rootFolder is not set, settings cannot be saved. Show an error instead of silently failing.
7. **layerColors.json** — Default colors are seeded automatically; custom colors can be added per layer name.
8. **drive-scanner.js is shared** — Changes affect all Mushaf tools (mushaftask, ornamentReplacer, webp-exporter). Do not break its API.
9. **Version tracking (3 locations)** — When releasing, update:
   - `version.json` -> `"version"`
   - `js/updater.js` -> `CURRENT_VERSION`
   - `CSXS/manifest.xml` -> `ExtensionBundleVersion` and `Extension Version`
10. **Symbol.aia path** — Loaded from extension root via `extPath + "/Symbol.aia"` in `host.jsx`.

---

## Related Systems

- **Mushaf Task Manager** (`mushaftask.extension`)
- **Ornament Replacer** (`ornamentReplacer`)
- **WebP Exporter** (`mushaf-webp-exporter.extension`)

---

*Last updated: June 6, 2026*
