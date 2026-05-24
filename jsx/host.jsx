// Symbol Palette - ExtendScript (JSX) Host Functions
// These functions interact with Adobe Illustrator

/**
 * Main function to paste content from an SVG file into the active document
 * @param {string} filePath - Path to the SVG file (use forward slashes)
 * @returns {boolean} - true on success, false on failure
 */
function pasteFromFile(filePath) {
    try {
        // Check if there's an active document
        if (app.documents.length === 0) {
            alert("Error: No active document. Please open or create a document first.");
            return false;
        }
        
        var targetDoc = app.activeDocument;
        var sourceFile = new File(filePath);
        
        // Check if source file exists
        if (!sourceFile.exists) {
            alert("Error: File not found: " + filePath);
            return false;
        }
        
        // Open the source document (Illustrator supports SVG natively)
        var sourceDoc = app.open(sourceFile);
        
        if (!sourceDoc) {
            alert("Error: Could not open file: " + filePath);
            return false;
        }
        
        if (sourceDoc.pageItems.length === 0) {
            sourceDoc.close(SaveOptions.DONOTSAVECHANGES);
            alert("Error: No objects found in the SVG file.");
            return false;
        }
        
        // Use Illustrator's native Select All to avoid duplicate selections.
        // Manually looping pageItems can select grouped items twice
        // (once as the group, once as individual items inside), causing
        // overlapping shapes and quality loss when pasted.
        sourceDoc.selection = null;
        app.executeMenuCommand('selectall');
        
        // Copy the selection
        app.copy();
        
        // Close source document without saving
        sourceDoc.close(SaveOptions.DONOTSAVECHANGES);
        
        // Switch back to target document and paste
        app.activeDocument = targetDoc;
        
        // Paste in front
        app.paste();
        
        return true;
        
    } catch (e) {
        alert("Error: " + e.toString());
        return false;
    }
}

/**
 * Get the name of the active Illustrator document
 * Matches mushaftaskextension behavior
 * @returns {string} - Document name or "null" if none
 */
function getActiveDocumentName() {
    try {
        if (app.documents.length > 0) {
            return app.activeDocument.name;
        }
    } catch (e) {
        $.writeln("Error getting active document: " + e);
    }
    return "null";
}

/**
 * Paste multiple SVG number files arranged beside the artboard
 * @param {Array} filePaths - Array of file path strings
 * @param {number} spacing - Spacing between items in points
 * @param {string} direction - 'horizontal' or 'vertical'
 * @returns {string} - 'success' or error message
 */
function pasteAllNumbers(filePaths, spacing, direction) {
    try {
        if (app.documents.length === 0) {
            return "Error: No active document.";
        }

        var targetDoc = app.activeDocument;
        if (!filePaths || filePaths.length === 0) {
            return "Error: No files to paste.";
        }

        // Find or create the "Aya No." layer
        var layerName = "Aya No.";
        var targetLayer = null;
        var layerRegex = /^(Aya|Ayah)\s*No\.?$/i;

        for (var i = 0; i < targetDoc.layers.length; i++) {
            if (layerRegex.test(targetDoc.layers[i].name)) {
                targetLayer = targetDoc.layers[i];
                break;
            }
        }

        if (!targetLayer) {
            targetLayer = targetDoc.layers.add();
            targetLayer.name = layerName;
        }

        // Get artboard bounds to place items beside it
        var artboard = targetDoc.artboards[0];
        var abBounds = artboard.artboardRect; // [left, top, right, bottom]
        var abLeft = abBounds[0];
        var abTop = abBounds[1];
        var abRight = abBounds[2];
        var abBottom = abBounds[3];

        // Place to the right of the artboard, aligned with top
        var margin = 30;
        var startX = abRight + margin;
        var startY = abTop;

        if (!spacing) spacing = 50;
        if (!direction) direction = 'horizontal';

        // Store initial selection
        var initialSelection = targetDoc.selection;
        targetDoc.selection = null;

        for (var j = 0; j < filePaths.length; j++) {
            var filePath = filePaths[j];
            var sourceFile = new File(filePath);

            if (!sourceFile.exists) {
                continue;
            }

            var sourceDoc = app.open(sourceFile);
            if (!sourceDoc || sourceDoc.pageItems.length === 0) {
                if (sourceDoc) sourceDoc.close(SaveOptions.DONOTSAVECHANGES);
                continue;
            }

            sourceDoc.selection = null;
            app.executeMenuCommand('selectall');
            app.copy();
            sourceDoc.close(SaveOptions.DONOTSAVECHANGES);

            app.activeDocument = targetDoc;
            app.paste();

            // Move pasted items to target layer and position
            var pastedItems = [];
            for (var k = 0; k < targetDoc.selection.length; k++) {
                var item = targetDoc.selection[k];
                item.move(targetLayer, ElementPlacement.PLACEATEND);
                pastedItems.push(item);
            }

            // Group if multiple items were pasted
            var targetItem;
            if (pastedItems.length > 1) {
                targetItem = targetLayer.groupItems.add();
                for (var m = pastedItems.length - 1; m >= 0; m--) {
                    pastedItems[m].move(targetItem, ElementPlacement.PLACEATEND);
                }
            } else if (pastedItems.length === 1) {
                targetItem = pastedItems[0];
            } else {
                continue;
            }

            // Position the item
            var itemBounds = targetItem.visibleBounds;
            var itemWidth = itemBounds[2] - itemBounds[0];
            var itemHeight = itemBounds[1] - itemBounds[3];

            var posX, posY;
            if (direction === 'vertical') {
                posX = startX;
                posY = startY - (j * (itemHeight + spacing));
            } else {
                posX = startX + (j * (itemWidth + spacing));
                posY = startY;
            }

            targetItem.position = [posX, posY];
            targetDoc.selection = null;
        }

        return "success";
    } catch (e) {
        return "Error: " + e.toString();
    }
}

/**
 * One-time batch: opens each SVG in the numbers folder,
 * ungroups all nested groups, renames the first path/compound-path
 * to the filename, then saves and closes.
 * @param {string} folderPath - Path to the numbers folder
 * @returns {string} - Summary message
 */
function renameNumberSvgs(folderPath) {
    try {
        var folder = new Folder(folderPath);
        if (!folder.exists) {
            return "Error: Folder not found: " + folderPath;
        }

        var files = folder.getFiles("*.svg");
        var count = 0;
        var errors = [];

        for (var i = 0; i < files.length; i++) {
            var file = files[i];
            var name = file.name.replace(/\.svg$/i, '');

            var doc;
            try {
                doc = app.open(file);
            } catch (e) {
                errors.push(file.name);
                continue;
            }

            if (!doc) {
                errors.push(file.name);
                continue;
            }

            try {
                // Ungroup all groups recursively across all layers
                var hasGroups = true;
                while (hasGroups) {
                    hasGroups = false;
                    for (var li = 0; li < doc.layers.length; li++) {
                        var layer = doc.layers[li];
                        for (var gi = layer.groupItems.length - 1; gi >= 0; gi--) {
                            var group = layer.groupItems[gi];
                            var parent = group.parent;
                            while (group.pageItems.length > 0) {
                                group.pageItems[0].move(parent, ElementPlacement.PLACEATEND);
                            }
                            group.remove();
                            hasGroups = true;
                        }
                    }
                }

                // Rename the first pageItem (path or compound path)
                if (doc.pageItems.length > 0) {
                    doc.pageItems[0].name = name;
                }

                // Save back as SVG via export, fallback to regular save
                try {
                    var svgOpts = new ExportOptionsSVG();
                    doc.exportFile(file, ExportType.SVG, svgOpts);
                } catch (e) {
                    doc.save();
                }

                count++;
            } catch (e) {
                errors.push(file.name + " (" + e + ")");
            }

            try {
                doc.close(SaveOptions.DONOTSAVECHANGES);
            } catch (e) {}
        }

        return "Ungrouped & renamed " + count + " files" + (errors.length > 0 ? ". Errors: " + errors.join(", ") : "");
    } catch (e) {
        return "Error: " + e.toString();
    }
}

/**
 * Test function to verify the extension is loaded
 */
function testConnection() {
    return "CEP Panel Connected! Illustrator version: " + app.version;
}
