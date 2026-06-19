function spCleanUpLayers() {
    var result = { success: false, renamed: [], deleted: [], warnings: [], error: "" };
    var registered = ["Quran Text", "Aya No.", "Ornaments", "Header & Marks & Page No."];

    function normalizeName(name) {
        return name.toString().replace(/^\s+|\s+$/g, "").toLowerCase().replace(/[_\-\.]/g, "").replace(/\s+/g, "");
    }

    function matchLayerName(name) {
        var n = normalizeName(name);
        if (!n) return null;

        var stdQuran = "Quran Text";
        var stdAya = "Aya No.";
        var stdOrn = "Ornaments";
        var stdHead = "Header & Marks & Page No.";

        if (n === normalizeName(stdQuran)) return stdQuran;
        if (n === normalizeName(stdAya)) return stdAya;
        if (n === normalizeName(stdOrn)) return stdOrn;
        if (n === normalizeName(stdHead)) return stdHead;

        if (n.indexOf("qurantext") !== -1 || n.indexOf("quran") !== -1) return stdQuran;
        if (n.indexOf("ayano") !== -1 || n.indexOf("ayahno") !== -1 || n.indexOf("aya.no") !== -1 || n.indexOf("ayah.no") !== -1 || n.indexOf("ayano.") !== -1 || n.indexOf("ayahno.") !== -1 || n.indexOf("ayano") !== -1 || n.indexOf("ayahno") !== -1) return stdAya;
        if (n.indexOf("ornament") !== -1 || n.indexOf("zakhrafah") !== -1 || n.indexOf("zakhrafa") !== -1 || n.indexOf("decoration") !== -1 || n.indexOf("decorations") !== -1) return stdOrn;
        if (n.indexOf("header") !== -1 || n.indexOf("marks") !== -1 || n.indexOf("pageno") !== -1) return stdHead;

        return null;
    }

    function isRegistered(standard) {
        for (var i = 0; i < registered.length; i++) {
            if (registered[i] === standard) return true;
        }
        return false;
    }

    function isEmpty(layer) {
        try {
            if (layer.pageItems.length > 0) return false;
            if (layer.layers && layer.layers.length > 0) {
                for (var i = 0; i < layer.layers.length; i++) {
                    if (!isEmpty(layer.layers[i])) return false;
                }
            }
        } catch (e) {}
        return true;
    }

    try {
        if (app.documents.length === 0) {
            result.error = "No document open";
        } else {
            var doc = app.activeDocument;

            // Rename potential layers
            for (var i = 0; i < doc.layers.length; i++) {
                var layer = doc.layers[i];
                var matched = matchLayerName(layer.name);
                if (matched && layer.name !== matched) {
                    var oldName = layer.name;
                    try {
                        layer.locked = false;
                        layer.visible = true;
                        layer.name = matched;
                        result.renamed.push({ old: oldName, newName: matched });
                    } catch (e) {
                        result.renamed.push({ old: oldName, newName: matched, error: e.toString() });
                    }
                }
            }

            // Delete empty unregistered layers; warn on non-empty unregistered layers
            for (var j = doc.layers.length - 1; j >= 0; j--) {
                var layer = doc.layers[j];
                var standard = matchLayerName(layer.name);
                if (standard && isRegistered(standard)) continue;
                if (isEmpty(layer)) {
                    try {
                        layer.locked = false;
                        layer.visible = true;
                        var deletedName = layer.name;
                        layer.remove();
                        result.deleted.push(deletedName);
                    } catch (e) {
                        result.deleted.push(layer.name + " (error: " + e.toString() + ")");
                    }
                } else {
                    result.warnings.push("Check " + layer.name + " layer");
                }
            }

            result.success = true;
        }
    } catch (e) {
        result.error = e.toString();
    }

    return JSON.stringify(result);
}
