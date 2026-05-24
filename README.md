# Symbol Palette - Illustrator CEP Extension

A CEP panel extension for Adobe Illustrator that provides a quick-access palette for inserting symbols from external AI files.

## Features

- **Three Default Buttons**: Damma, Imala, Mufrada
- **File Browser**: Browse and select AI files instead of typing paths
- **Edit Symbols**: Modify name and file path for any existing symbol
- **Delete Symbols**: Remove symbols you no longer need
- **Persistent Storage**: Your symbols are saved between sessions
- **Dark Theme**: Easy on the eyes

## Installation

### Method 1: Standard CEP Installation

1. Copy the entire `symbolPalette` folder to your CEP extensions directory:
   ```
   C:\Program Files (x86)\Common Files\Adobe\CEP\extensions\symbolPalette
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

### Method 2: Development Installation (Recommended for testing)

1. Copy the `symbolPalette` folder to:
   ```
   C:\Users\[YourUsername]\AppData\Roaming\Adobe\CEP\extensions\symbolPalette
   ```

2. Enable debug mode as described above

3. Restart Illustrator

## File Structure

```
symbolPalette/
├── CSXS/
│   └── manifest.xml          # Extension manifest
├── css/
│   └── style.css             # Panel styling
├── js/
│   ├── CSInterface.js        # Adobe CEP interface
│   └── main.js               # Panel logic
├── jsx/
│   └── host.jsx              # Illustrator ExtendScript
├── index.html                # Panel UI
└── README.md                 # This file
```

## How to Use

### Pasting Symbols

Click any symbol button to paste its contents into your active document:
- **Damma**: Pastes from `C:/Users/Admin/Desktop/symbols/damma.ai`
- **Imala**: Pastes from `C:/Users/Admin/Desktop/symbols/imala.ai`
- **Mufrada**: Pastes from `C:/Users/Admin/Desktop/symbols/mufrada.ai`

### Adding New Symbols

1. Click the **+ Add Symbol** button
2. Enter a name for your symbol (e.g., "Fatha")
3. Click **Browse...** to open the file picker and select an AI file
4. Click **Add**

The new button will appear in the palette and persist between sessions.

### Editing Symbols

1. Hover over any symbol button
2. Click the **✎** (edit) icon that appears on the right
3. Change the name and/or click **Browse...** to select a different file
4. Click **Save** to apply changes

### Deleting Symbols

1. Hover over the symbol and click the **✎** edit icon
2. Click the **Delete** button in the edit modal
3. Confirm the deletion

### Source File Requirements

Each AI file must have:
- A layer named exactly **"Layer"** (case-sensitive)
- Artwork placed on that layer

The extension will:
1. Open the source AI file
2. Select all objects on the "Layer" layer
3. Copy them
4. Paste into your active document
5. Close the source file without saving

## Customizing Default Symbols

To change the default symbols, edit `js/main.js`:

```javascript
var defaultSymbols = [
    { name: "Damma", path: "C:/Users/Admin/Desktop/symbols/damma.ai" },
    { name: "Imala", path: "C:/Users/Admin/Desktop/symbols/imala.ai" },
    { name: "Mufrada", path: "C:/Users/Admin/Desktop/symbols/mufrada.ai" }
    // Add more defaults here
];
```

After modifying, clear the extension's storage or reset to defaults by removing and re-adding the extension.

## Troubleshooting

### Panel doesn't appear in Window > Extensions
- Ensure debug mode is enabled in the registry
- Check that the manifest.xml is valid
- Verify the folder path is correct

### "File not found" error
- Verify the file exists at the specified path
- Use the Browse button to ensure the correct path is selected
- Check file permissions

### "Could not find layer named 'Layer'"
- Open the AI file and ensure there's a layer named exactly "Layer"
- The layer name is case-sensitive

### "No active document" error
- Open or create a document in Illustrator before using the panel

### Browse button doesn't work
- Make sure you're using a compatible Illustrator version (2020+)
- The file browser uses CEP's native file dialog which requires proper CEP support

## Uninstallation

1. Close Illustrator
2. Delete the `symbolPalette` folder from the extensions directory
3. (Optional) Remove the registry key if you no longer need debug mode

## License

Free to use and modify for personal or commercial projects.
