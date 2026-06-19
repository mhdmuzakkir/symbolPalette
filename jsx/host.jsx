// Symbol Palette - ExtendScript (JSX) Host Functions
// These functions interact with Adobe Illustrator

// Polyfill JSON.stringify for older Illustrator versions
if (typeof JSON === 'undefined') {
    JSON = {
        stringify: function stringify(value) {
            if (value === null) return 'null';
            if (typeof value === 'undefined') return 'null';
            if (typeof value === 'string') {
                return '"' + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t') + '"';
            }
            if (typeof value === 'number' || typeof value === 'boolean') return String(value);
            if (value instanceof Array) {
                var parts = [];
                for (var i = 0; i < value.length; i++) {
                    parts.push(stringify(value[i]));
                }
                return '[' + parts.join(',') + ']';
            }
            var props = [];
            for (var key in value) {
                if (!value.hasOwnProperty(key)) continue;
                props.push(stringify(key) + ':' + stringify(value[key]));
            }
            return '{' + props.join(',') + '}';
        }
    };
}



/**
 * Main function to paste content from an SVG file into the active document
 * @param {string} filePath - Path to the SVG file (use forward slashes)
 * @returns {boolean} - true on success, false on failure
 */
function pasteFromFile(filePath) {
    try {
        // Check if there's an active document
        if (app.documents.length === 0) {
            return "Error: No active document. Please open or create a document first.";
        }
        
        var targetDoc = app.activeDocument;
        var sourceFile = new File(filePath);
        
        // Check if source file exists
        if (!sourceFile.exists) {
            return "Error: File not found: " + filePath;
        }
        
        // Open the source document (Illustrator supports SVG natively)
        var sourceDoc = app.open(sourceFile);
        
        if (!sourceDoc) {
            return "Error: Could not open file: " + filePath;
        }
        
        if (sourceDoc.pageItems.length === 0) {
            sourceDoc.close(SaveOptions.DONOTSAVECHANGES);
            return "Error: No objects found in the SVG file.";
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
        return "Error: " + e.toString();
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

        // --- 3. Collect ornaments named "ayah" or "آية" ---
        // NOTE: layer.pageItems in Illustrator is already recursive (includes nested items),
        // so we do NOT recurse into groupItems — that would double-count every ornament.
        var ORNAMENT_NAMES = ["ayah", "آية"];
        var ornaments = [];

        var items = ornamentLayer.pageItems;
        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            for (var n = 0; n < ORNAMENT_NAMES.length; n++) {
                if (it.name === ORNAMENT_NAMES[n]) {
                    ornaments.push(it);
                    break;
                }
            }
        }

        // --- 4. Validate count BEFORE clearing Aya No. layer ---
        if (ornaments.length < filePaths.length) {
            var needed = filePaths.length - ornaments.length;
            return "Error: " + needed + " Ayah Missing — Add " + needed + " Ayah";
        }
        if (ornaments.length > filePaths.length) {
            var excess = ornaments.length - filePaths.length;
            return "Error: " + excess + " Ayah Extra — Remove " + excess + " Ayah";
        }

        // --- 5. Clear existing items in Aya No. layer (only after validation passes) ---
        ayaLayer.locked = false;
        ayaLayer.visible = true;
        while (ayaLayer.pageItems.length > 0) {
            ayaLayer.pageItems[0].remove();
        }
        while (ayaLayer.groupItems.length > 0) {
            ayaLayer.groupItems[0].remove();
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

        // --- 8. Fine-tune alignment on the mapped ornament ---
        // Use the same mapping as initial placement (sortedOrnaments[i] ↔ pastedGroups[i])
        // instead of nearest-neighbor, which can reassign numbers to wrong ornaments
        // when ornaments are close together.
        var OFFSET_DOWN_MM = 0.1;
        var offsetDownPt = OFFSET_DOWN_MM * MM_TO_PT;
        var AYAH_SHIFT_DY_PT = -0.6644; // extra shift from ornament replacer

        function getItemCenter(item) {
            return {
                cx: item.left + item.width / 2,
                cy: item.top - item.height / 2
            };
        }

        for (var i = 0; i < pastedGroups.length; i++) {
            var ayahItem = pastedGroups[i];
            var bestOrn = sortedOrnaments[i];
            if (!bestOrn) continue;

            var ayahCenter = getItemCenter(ayahItem);
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
 * Test function to verify the extension is loaded
 */
function testConnection() {
    return "CEP Panel Connected! Illustrator version: " + app.version;
}


// ==================== LAYER DETECTION (from ornamentReplacer) ====================

var SP_LAYER_DEFS = {
    quranText: { standard: "Quran Text", patterns: ["qurantext", "quran"] },
    ayaNo:     { standard: "Aya No.",    patterns: ["ayano", "ayahno", "ayano.", "ayahno.", "aya.no", "ayah.no", "aya no", "ayah no"] },
    ornaments: { standard: "Ornaments",  patterns: ["ornament", "zakhrafah", "zakhrafa", "decoration", "decorations"] },
    header:    { standard: "Header & Marks & Page No.", patterns: ["header", "marks", "pageno"] }
};

function spNormalizeLayerName(name) {
    if (!name) return "";
    return name.toString().replace(/^\s+|\s+$/g, '').toLowerCase().replace(/[_\-\.]/g, '').replace(/\s+/g, '');
}

function spMatchLayerName(name) {
    var normalized = spNormalizeLayerName(name);
    if (!normalized) return null;
    for (var key in SP_LAYER_DEFS) {
        if (!SP_LAYER_DEFS.hasOwnProperty(key)) continue;
        var def = SP_LAYER_DEFS[key];
        var stdNorm = spNormalizeLayerName(def.standard);
        if (normalized === stdNorm) return def.standard;
        for (var p = 0; p < def.patterns.length; p++) {
            if (normalized.indexOf(def.patterns[p]) !== -1) return def.standard;
        }
    }
    return null;
}

function spDetectPotentialQuranText(layer) {
    var TARGET_W_MM = 86.5;
    var TARGET_H_MM = 141.6;
    var TOLERANCE_MM = 12.0;
    var MM_PER_PT = 0.352778;
    var MAX_ITEMS = 20;
    try {
        var items = layer.pageItems;
        var count = items.length > MAX_ITEMS ? MAX_ITEMS : items.length;
        for (var i = 0; i < count; i++) {
            var item = items[i];
            if (item.typename === "PathItem" || item.typename === "CompoundPathItem") {
                try {
                    var bounds = item.geometricBounds;
                    if (!bounds || bounds.length < 4) continue;
                    var wPt = bounds[2] - bounds[0];
                    var hPt = bounds[1] - bounds[3];
                    var wMm = wPt * MM_PER_PT;
                    var hMm = hPt * MM_PER_PT;
                    if (wMm > 0 && hMm > 0 && wMm < hMm &&
                        Math.abs(wMm - TARGET_W_MM) <= TOLERANCE_MM &&
                        Math.abs(hMm - TARGET_H_MM) <= TOLERANCE_MM) {
                        return true;
                    }
                } catch (e) {}
            } else if (item.typename === "GroupItem") {
                try {
                    var gItems = item.pageItems;
                    var gCount = gItems.length > MAX_ITEMS ? MAX_ITEMS : gItems.length;
                    for (var j = 0; j < gCount; j++) {
                        var child = gItems[j];
                        if (child.typename === "PathItem" || child.typename === "CompoundPathItem") {
                            try {
                                var cb = child.geometricBounds;
                                if (!cb || cb.length < 4) continue;
                                var cwPt = cb[2] - cb[0];
                                var chPt = cb[1] - cb[3];
                                var cwMm = cwPt * MM_PER_PT;
                                var chMm = chPt * MM_PER_PT;
                                if (cwMm > 0 && chMm > 0 && cwMm < chMm &&
                                    Math.abs(cwMm - TARGET_W_MM) <= TOLERANCE_MM &&
                                    Math.abs(chMm - TARGET_H_MM) <= TOLERANCE_MM) {
                                    return true;
                                }
                            } catch (e) {}
                        }
                    }
                } catch (e) {}
            }
        }
    } catch (e) {}
    return false;
}

function spScanCurrentLayers() {
    var result = { success: false, layers: [], error: "" };
    try {
        if (app.documents.length === 0) { result.error = "No document open"; return JSON.stringify(result); }
        var doc = app.activeDocument;
        for (var i = 0; i < doc.layers.length; i++) {
            var layer = doc.layers[i];
            var matched = spMatchLayerName(layer.name);
            var potential = null;
            if (!matched) {
                try {
                    if (spDetectPotentialQuranText(layer)) {
                        potential = "Quran Text";
                    }
                } catch (e) {}
            }
            result.layers.push({ name: layer.name, matched: matched || null, standard: matched || "\u2014", potential: potential });
        }
        result.success = true;
    } catch (e) { result.error = e.toString(); }
    return JSON.stringify(result);
}

function spRenameLayerByName(layerName, newName) {
    var result = { success: false, error: "" };
    try {
        if (app.documents.length === 0) { result.error = "No document open"; return JSON.stringify(result); }
        var doc = app.activeDocument;
        for (var i = 0; i < doc.layers.length; i++) {
            if (doc.layers[i].name === layerName) {
                doc.layers[i].name = newName;
                result.success = true;
                return JSON.stringify(result);
            }
        }
        result.error = "Layer '" + layerName + "' not found";
    } catch (e) { result.error = e.toString(); }
    return JSON.stringify(result);
}

function spDeleteLayer(layerName) {
    var result = { success: false, error: "" };
    try {
        if (app.documents.length === 0) { result.error = "No document open"; return JSON.stringify(result); }
        var doc = app.activeDocument;
        for (var i = 0; i < doc.layers.length; i++) {
            if (doc.layers[i].name === layerName) {
                doc.layers[i].remove();
                result.success = true;
                return JSON.stringify(result);
            }
        }
        result.error = "Layer '" + layerName + "' not found";
    } catch (e) { result.error = e.toString(); }
    return JSON.stringify(result);
}

function spLayerIsEmpty(layer) {
    try {
        if (layer.pageItems.length > 0) return false;
        if (layer.layers && layer.layers.length > 0) {
            for (var i = 0; i < layer.layers.length; i++) {
                if (!spLayerIsEmpty(layer.layers[i])) return false;
            }
        }
    } catch (e) {}
    return true;
}

function spIsRegisteredLayer(standardName) {
    var registered = ["Quran Text", "Aya No.", "Ornaments", "Header & Marks & Page No."];
    for (var i = 0; i < registered.length; i++) {
        if (registered[i] === standardName) return true;
    }
    return false;
}

function spCleanUpLayers() {
    var result = { success: false, renamed: [], deleted: [], warnings: [], error: "" };

    try {
        if (app.documents.length === 0) { result.error = "No document open"; return JSON.stringify(result); }
        var doc = app.activeDocument;

        // 1. Rename potential layers to standard names
        for (var i = 0; i < doc.layers.length; i++) {
            var layer = doc.layers[i];
            var matched = spMatchLayerName(layer.name);
            if (matched && layer.name !== matched) {
                var oldName = layer.name;
                try {
                    layer.locked = false;
                    layer.visible = true;
                    layer.name = matched;
                    result.renamed.push({ old: oldName, new: matched });
                } catch (e) {
                    result.renamed.push({ old: oldName, new: matched, error: e.toString() });
                }
            }
        }

        // 2. Process registered layers (warn if not empty) and delete unregistered empty layers
        for (var j = doc.layers.length - 1; j >= 0; j--) {
            var layer = doc.layers[j];
            var standard = spMatchLayerName(layer.name);
            var isRegistered = standard && spIsRegisteredLayer(standard);

            if (isRegistered) {
                if (!spLayerIsEmpty(layer)) {
                    result.warnings.push("Check " + standard + " layer");
                }
            } else {
                if (spLayerIsEmpty(layer)) {
                    try {
                        layer.locked = false;
                        layer.visible = true;
                        var deletedName = layer.name;
                        layer.remove();
                        result.deleted.push(deletedName);
                    } catch (e) {
                        result.deleted.push(layer.name + " (error: " + e.toString() + ")");
                    }
                }
            }
        }

        result.success = true;
    } catch (e) { result.error = e.toString(); }
    return JSON.stringify(result);
}

// ==================== MOVE SELECTION TO LAYER ====================

function spLoadSymbolActions() {
    try {
        var hostFile = new File($.fileName);
        var extFolder = hostFile.parent.parent;
        var actionFile = new File(extFolder + "/Symbol.aia");
        if (actionFile.exists) {
            try {
                app.unloadAction("Symbol", "");
            } catch (e) {}
            app.loadAction(actionFile);
        }
    } catch (e) {
        // Path resolution failed — ignore
    }
}

function spGetLayerColor(layerName, layerColorsPath) {
    try {
        if (layerColorsPath) {
            var configFile = new File(layerColorsPath);
            if (configFile.exists) {
                configFile.open('r');
                var jsonStr = configFile.read();
                configFile.close();
                var config = JSON.parse(jsonStr);
                if (config[layerName]) {
                    return config[layerName];
                }
                // No default fallback — each layer must have its own color in the file
            }
        }
    } catch (e) {}

    // No fallback — only drive file colors
    return null;
}

function spApplyLayerColor(layer, layerName, layerColorsPath) {
    try {
        var rgb = spGetLayerColor(layerName, layerColorsPath);
        if (rgb && rgb.length >= 3) {
            var color = new RGBColor();
            color.red = rgb[0];
            color.green = rgb[1];
            color.blue = rgb[2];
            layer.color = color;
        }
    } catch (e) {}
}

function spCreateLayer(layerName, extPath, layerColorsPath) {
    try {
        var doc = app.activeDocument;
        var targetLayer = null;
        for (var i = 0; i < doc.layers.length; i++) {
            if (doc.layers[i].name === layerName) {
                targetLayer = doc.layers[i];
                break;
            }
        }
        if (!targetLayer) {
            targetLayer = doc.layers.add();
            targetLayer.name = layerName;
        }
        targetLayer.locked = false;
        targetLayer.visible = true;
        spApplyLayerColor(targetLayer, layerName, layerColorsPath);
        return "CREATED";
    } catch (e) {
        return "Error: " + e.toString();
    }
}

function spCollectPaths(container, outPaths) {
    var items = container.pageItems;
    for (var i = items.length - 1; i >= 0; i--) {
        var item = items[i];
        if (item.typename === "PathItem") {
            outPaths.push(item);
        } else if (item.typename === "GroupItem") {
            spCollectPaths(item, outPaths);
        } else if (item.typename === "CompoundPathItem") {
            var cpPaths = item.pathItems;
            for (var p = cpPaths.length - 1; p >= 0; p--) {
                outPaths.push(cpPaths[p]);
            }
        }
    }
}

function spMoveSelectionToLayer(layerName, extPath, layerColorsPath) {
    try {
        if (app.documents.length === 0) return "Error: No active document.";
        var doc = app.activeDocument;
        if (doc.selection.length === 0) return "Error: Nothing selected.";

        var actionFile = new File(extPath + "/Symbol.aia");

        // Helper: load .aia, run action, then unload
        function runAction(actionName) {
            if (actionFile.exists) {
                app.loadAction(actionFile);
                app.doScript(actionName, "Symbol");
                app.unloadAction("Symbol", "");
            }
        }

        // 1. Cut the selection while inside isolation
        app.executeMenuCommand("cut");

        // 2. Exit isolation
        runAction("Exit");

        // 3. Find the target layer now that doc.layers is reliable
        var targetLayer = null;
        for (var i = 0; i < doc.layers.length; i++) {
            if (doc.layers[i].name === layerName) {
                targetLayer = doc.layers[i];
                break;
            }
        }
        if (!targetLayer) {
            targetLayer = doc.layers.add();
            targetLayer.name = layerName;
        }
        targetLayer.locked = false;
        targetLayer.visible = true;
        spApplyLayerColor(targetLayer, layerName, layerColorsPath);

        // 4. Paste on target layer and compound
        doc.activeLayer = targetLayer;
        app.executeMenuCommand("pasteFront");

        if (doc.selection.length > 0) {
            app.executeMenuCommand("compoundPath");
        }

        // 5. Reselect the compound path inside Quran Text layer
        var quranTextLayer = null;
        for (var i = 0; i < doc.layers.length; i++) {
            if (doc.layers[i].name === "Quran Text") {
                quranTextLayer = doc.layers[i];
                break;
            }
        }
        if (quranTextLayer) {
            doc.selection = null;
            doc.activeLayer = quranTextLayer;
            // Explicitly select the compound path
            if (quranTextLayer.compoundPathItems.length > 0) {
                quranTextLayer.compoundPathItems[0].selected = true;
            } else if (quranTextLayer.groupItems.length > 0) {
                quranTextLayer.groupItems[0].selected = true;
            } else if (quranTextLayer.pathItems.length > 0) {
                quranTextLayer.pathItems[0].selected = true;
            } else if (quranTextLayer.pageItems.length > 0) {
                quranTextLayer.pageItems[0].selected = true;
            }
        }

        // 6. Re-enter isolation on the selected compound path
        runAction("Enter");

        return "success";
    } catch (e) {
        return "Error: " + e.toString();
    }
}
