# Symbol Palette — Illustrator CEP Extension

A CEP panel extension for Adobe Illustrator designed for **Mushaf (Qur'an typesetting)** workflows. It provides a quick-access palette for inserting symbols and ayah numbers from external SVG files, with automatic page detection and ornament alignment.

---

## Features

### Symbol Palette
- **Dynamic Category Scanning**: Automatically discovers symbol categories from `symbols/{category}/` subfolders
- **Click-to-Paste**: Click any symbol thumbnail to paste its SVG directly into your active Illustrator document
- **Edit Mode**: Reorder symbols (drag), rename, or delete entries via the edit modal
- **Dark Theme**: Easy on the eyes for long sessions

### Ayah Number Management
- **Auto Page Detection**: Detects the current Mushaf page from the filename (e.g., `001-hafs.ai` → Page 1, riwayah "hafs")
- **Ayah Count Lookup**: Automatically shows how many ayahs belong on the detected page using built-in statistics for 6 counting systems
- **Number Grid**: One-click grid of all ayah numbers for the current page
- **Import All Numbers**: Bulk-import all ayah number SVGs for a page in one click, automatically aligned to pre-placed ornament markers
- **Manual Insert**: Type any number to paste its SVG directly

### Multi-Riwayah Support
- Supports multiple Qur'anic readings (Hafs, Warsh, Qaloon, etc.)
- **6 Counting Systems**: Kufi, Madani Al-Awwal, Madani Al-Akhir, Makki, Basri, Dimashqi
- Per-riwayah system mapping via Settings

### Self-Updater
- Built-in update checker that downloads from GitHub
- Supports `git pull` for cloned repositories

---

## Installation

### Standard CEP Installation

1. Copy the entire `symbolPalette` folder to your CEP extensions directory:
   ```
   C:\Users\[YourUsername]\AppData\Roaming\Adobe\CEP\extensions\symbolPalette
   ```

2. **Enable Debug Mode** (required for unsigned extensions):

   Create or edit the registry key:
   ```
   HKEY_CURRENT_USER\Software\Adobe\CSXS.11
   ```

   Add a String value named `PlayerDebugMode` with value `1`

   For different Illustrator versions:
   - Illustrator 2023 (v27): CSXS.11
   - Illustrator 2024 (v28): CSXS.12
   - Illustrator 2025 (v29): CSXS.13

3. Restart Illustrator

4. Open the panel via: **Window > Extensions > Symbol Palette**

---

## Required Folder Structure

The extension needs a root folder containing:

```
mushafproject/
├── symbols/
│   ├── damma/              # Symbol category
│   │   ├── symbol1.svg
│   │   └── symbol2.svg
│   ├── imala/
│   └── mufrada/
├── numbers/
│   ├── 1.svg               # Ayah number SVGs
│   ├── 2.svg
│   └── ...
└── mushaftasks/
    └── riwayah-tasks/      # Auto-detected for riwayah settings
```

Select the root folder (e.g., `mushafproject`) via the **📁 Select Root Folder** button.

---

## How to Use

### Pasting Symbols
1. Select a category from the **Type** dropdown
2. Click any symbol thumbnail to paste it into your active document
3. The pasted item appears at the center of your current view

### Pasting Ayah Numbers (Single)
1. Open a Mushaf page file (e.g., `001-hafs.ai`)
2. The panel auto-detects the page and shows ayah numbers in the grid
3. Click any number cell to paste that ayah number

### Import All Numbers (Bulk)
1. Ensure your document has an **"Ornaments"** layer containing ornament markers named exactly `"ayah"` or `"آية"`
2. Click **⬇ Import All Numbers**
3. The extension pastes all ayah numbers for the page, aligned to the detected ornaments

### Manual Number Insert
1. Click **+ Ayah Number**
2. Type the number (e.g., `5` or `286`)
3. Click **Insert**

### Settings (Riwayah → System Mapping)
1. Click **⚙ Settings**
2. Map each riwayah name to its counting system
3. Choose a **Default System** for unmapped riwayahs
4. Save — settings sync across extensions via `mushaftasks/symbolPalette_settings.json`

---

## Source File Requirements

### Symbols
- SVG files in `symbols/{category}/`
- No specific layer naming required
- Artwork is copied as-is from the SVG

### Ayah Numbers
- SVG files in `numbers/` named `{number}.svg` (e.g., `1.svg`, `2.svg`, ... `286.svg`)
- Each file should contain the ayah number artwork

### Ornaments (for Import All)
- Layer named exactly **"Ornaments"** or **"Ornament"**
- Ornament markers named exactly **"ayah"** or **"آية"**
- One ornament per ayah on the page

---

## Auto-Detection

The extension automatically tries to find your project folder by scanning:
1. Google Drive (`G:/My Drive/`, etc.)
2. All available drives (`C:/`, `D:/`, etc.)
3. `.lnk` shortcut files in common locations
4. Settings shared with Mushaf Task Manager

---

## Troubleshooting

### Panel doesn't appear in Window > Extensions
- Ensure debug mode is enabled in the registry
- Check that the manifest.xml is valid
- Verify the folder path is correct

### "No document open" error
- Open or create a document in Illustrator before using the panel

### "Ornaments layer not found"
- Create a layer named exactly **"Ornaments"** (case-sensitive)
- Ensure ornament markers are named **"ayah"** or **"آية"**

### "Error: Add X ayah"
- The number of ornament markers is less than the number of ayahs on this page
- Add more ornaments or check that all are named correctly

### Number SVGs not found
- Ensure the `numbers/` folder exists under your selected root
- Files must be named exactly `{number}.svg` (e.g., `7.svg`, `12.svg`)

### Browse button doesn't work
- Make sure you're using a compatible Illustrator version (2020+)
- The file browser uses CEP's native file dialog which requires proper CEP support

---

## Uninstallation

1. Close Illustrator
2. Delete the `symbolPalette` folder from the extensions directory
3. (Optional) Remove the registry key if you no longer need debug mode

---

## License

Free to use and modify for personal or commercial projects.
