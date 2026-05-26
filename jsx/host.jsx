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
 * Paste ayah numbers aligned to existing ornament markers on the page.
 * Counts ornaments named "ayah"/"آية" in the Ornaments layer, validates count,
 * sorts ornaments top-to-bottom / right-to-left, pastes each number at the
 * corresponding ornament position, then aligns using ayah-align logic.
 * @param {Array} filePaths - Array of SVG file path strings
 * @returns {string} - 'success' or error message
 */
function pasteAllNumbersAligned(filePaths) {
    try {
        if (app.documents.length === 0) {
            return "Error: No active document.";
        }

        var targetDoc = app.activeDocument;
        if (!filePaths || filePaths.length === 0) {
            return "Error: No files to paste.";
        }

        // --- 1. Find Ornaments layer ---
        var ornamentLayer = null;
        var ornamentLayerNames = ["Ornaments", "Ornament"];
        for (var i = 0; i < ornamentLayerNames.length; i++) {
            for (var j = 0; j < targetDoc.layers.length; j++) {
                if (targetDoc.layers[j].name === ornamentLayerNames[i]) {
                    ornamentLayer = targetDoc.layers[j];
                    break;
                }
            }
            if (ornamentLayer) break;
        }
        if (!ornamentLayer) {
            return "Error: Layer 'Ornament' or 'Ornaments' not found.";
        }

        // --- 2. Find or create Aya No. layer ---
        var ayaLayer = null;
        var ayaLayerRegex = /^(Aya|Ayah)\s*No\.?$/i;
        for (var i = 0; i < targetDoc.layers.length; i++) {
            if (ayaLayerRegex.test(targetDoc.layers[i].name)) {
                ayaLayer = targetDoc.layers[i];
                break;
            }
        }
        if (!ayaLayer) {
            ayaLayer = targetDoc.layers.add();
            ayaLayer.name = "Aya No.";
        }

        // --- 3. Clear existing items in Aya No. layer ---
        ayaLayer.locked = false;
        ayaLayer.visible = true;
        while (ayaLayer.pageItems.length > 0) {
            ayaLayer.pageItems[0].remove();
        }
        while (ayaLayer.groupItems.length > 0) {
            ayaLayer.groupItems[0].remove();
        }

        // --- 4. Collect ornaments named "ayah" or "آية" recursively ---
        var ORNAMENT_NAMES = ["ayah", "آية"];
        var ornaments = [];

        function collectOrnaments(container) {
            var items = container.pageItems;
            for (var i = 0; i < items.length; i++) {
                var it = items[i];
                var isMatch = false;
                for (var n = 0; n < ORNAMENT_NAMES.length; n++) {
                    if (it.name === ORNAMENT_NAMES[n]) {
                        isMatch = true;
                        break;
                    }
                }
                if (isMatch) {
                    ornaments.push(it);
                }
            }
            if (container.groupItems) {
                for (var g = 0; g < container.groupItems.length; g++) {
                    collectOrnaments(container.groupItems[g]);
                }
            }
        }
        collectOrnaments(ornamentLayer);

        // --- 5. Validate count ---
        if (ornaments.length < filePaths.length) {
            var needed = filePaths.length - ornaments.length;
            return "Error: Add " + needed + " ayah";
        }

        // --- 6. Sort ornaments: top-to-bottom rows, right-to-left within each row ---
        var MM_TO_PT = 2.83464567;
        var ROW_TOLERANCE = 3 * MM_TO_PT;

        function getBoundsCenter(item) {
            var b = item.visibleBounds || item.geometricBounds;
            return {
                cx: (b[0] + b[2]) / 2,
                cy: (b[1] + b[3]) / 2
            };
        }

        // Calculate centers
        var ornamentData = [];
        for (var i = 0; i < ornaments.length; i++) {
            var c = getBoundsCenter(ornaments[i]);
            ornamentData.push({
                item: ornaments[i],
                cx: c.cx,
                cy: c.cy
            });
        }

        // Sort by cy descending (top to bottom) — higher cy = higher up on page
        ornamentData.sort(function(a, b) {
            return b.cy - a.cy;
        });

        // Group into rows using tolerance
        var rows = [];
        for (var i = 0; i < ornamentData.length; i++) {
            var od = ornamentData[i];
            var placed = false;
            for (var r = 0; r < rows.length; r++) {
                var rowCy = rows[r][0].cy;
                if (Math.abs(rowCy - od.cy) <= ROW_TOLERANCE) {
                    rows[r].push(od);
                    placed = true;
                    break;
                }
            }
            if (!placed) {
                rows.push([od]);
            }
        }

        // Sort each row by cx descending (right to left)
        for (var r = 0; r < rows.length; r++) {
            rows[r].sort(function(a, b) {
                return b.cx - a.cx;
            });
        }

        // Flatten sorted ornaments
        var sortedOrnaments = [];
        for (var r = 0; r < rows.length; r++) {
            for (var c = 0; c < rows[r].length; c++) {
                sortedOrnaments.push(rows[r][c].item);
            }
        }

        // --- 7. Paste all numbers into Aya No. layer ---
        var pastedGroups = [];

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

            // Move pasted items to Aya No. layer
            var pastedItems = [];
            for (var k = 0; k < targetDoc.selection.length; k++) {
                var item = targetDoc.selection[k];
                item.move(ayaLayer, ElementPlacement.PLACEATEND);
                pastedItems.push(item);
            }

            // Group if multiple items were pasted
            var targetItem;
            if (pastedItems.length > 1) {
                targetItem = ayaLayer.groupItems.add();
                for (var m = pastedItems.length - 1; m >= 0; m--) {
                    pastedItems[m].move(targetItem, ElementPlacement.PLACEATEND);
                }
            } else if (pastedItems.length === 1) {
                targetItem = pastedItems[0];
            } else {
                continue;
            }

            // Rough initial placement at corresponding ornament (so nearest-neighbor works well)
            var orn = sortedOrnaments[j];
            var ornBounds = orn.visibleBounds || orn.geometricBounds;
            var ornCx = (ornBounds[0] + ornBounds[2]) / 2;
            var ornCy = (ornBounds[1] + ornBounds[3]) / 2;

            var itemBounds = targetItem.visibleBounds || targetItem.geometricBounds;
            var itemCx = (itemBounds[0] + itemBounds[2]) / 2;
            var itemCy = (itemBounds[1] + itemBounds[3]) / 2;

            targetItem.translate(ornCx - itemCx, ornCy - itemCy);

            pastedGroups.push(targetItem);
            targetDoc.selection = null;
        }

        // --- 8. Run nearest-neighbor ayah align (same logic as ornament replacer) ---
        var OFFSET_DOWN_MM = 0.1;
        var offsetDownPt = OFFSET_DOWN_MM * MM_TO_PT;
        var AYAH_SHIFT_DY_PT = -0.6644; // extra shift from ornament replacer

        function getItemCenter(item) {
            return {
                cx: item.left + item.width / 2,
                cy: item.top - item.height / 2
            };
        }

        function distanceSquared(a, b) {
            var dx = a.cx - b.cx;
            var dy = a.cy - b.cy;
            return dx * dx + dy * dy;
        }

        for (var i = 0; i < pastedGroups.length; i++) {
            var ayahItem = pastedGroups[i];
            var ayahCenter = getItemCenter(ayahItem);
            var bestOrn = null;
            var bestDist2 = Number.MAX_VALUE;

            for (var j = 0; j < ornaments.length; j++) {
                var orn = ornaments[j];
                var ornCenter = getItemCenter(orn);
                var d2 = distanceSquared(ayahCenter, ornCenter);
                if (d2 < bestDist2) {
                    bestDist2 = d2;
                    bestOrn = orn;
                }
            }

            if (!bestOrn) continue;

            var targetC = getItemCenter(bestOrn);

            // 1) center ayah number on ornament
            var dx = targetC.cx - ayahCenter.cx;
            var dy = targetC.cy - ayahCenter.cy;
            ayahItem.translate(dx, dy);

            // 2) move ayah number 0.1 mm DOWN
            ayahItem.translate(0, -offsetDownPt);

            // 3) extra 0.6644 pt DOWN (same as ornament replacer)
            ayahItem.translate(0, AYAH_SHIFT_DY_PT);
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
