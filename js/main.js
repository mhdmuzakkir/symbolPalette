// Symbol Palette - SVG-Only with Categories & Ayah Number

var csInterface = new CSInterface();

// State management
var rootFolder = '';
var symbolCategory = '';
var symbols = [];
var isEditMode = false;
var editingIndex = -1;
var draggedItem = null;
var scannedCategories = [];
var previewData = { symbols: [], numbers: 0 };

var STORAGE_KEY = 'symbolPalette_data_v3';
var SETTINGS_KEY = 'symbolPalette_settings_v1';

// Page statistics data
var pageStatisticsData = null;
var surahTotalsBySystem = {};

// Current detected page info
var currentPageInfo = {
    detected: false,
    pageNumber: 0,
    riwayah: '',
    systemKey: 'al_kufi',
    ayahNumbers: []
};

// Riwayah settings
var riwayahSettings = {
    defaultSystem: 'al_kufi',
    qurra: [],
    mappings: {}  // { 'hafs': 'al_kufi', 'warsh': 'al_madani_al_awwal', ... }
};

// Default qurra data with qari id and rawi id
var DEFAULT_QURRA = [
    { id: "1", name: "nafi", counting_system: "madani akhir", rawi: [
        { id: "1", name: "qalun" }, { id: "2", name: "warsh" }
    ]},
    { id: "2", name: "ibn kathir", counting_system: "makki", rawi: [
        { id: "1", name: "bazzi" }, { id: "2", name: "qunbul" }
    ]},
    { id: "3", name: "abu amr", counting_system: "basri", rawi: [
        { id: "1", name: "duri" }, { id: "2", name: "susi" }
    ]},
    { id: "4", name: "ibn amir", counting_system: "damashqi", rawi: [
        { id: "1", name: "hisham" }, { id: "2", name: "ibn zakwan" }
    ]},
    { id: "5", name: "asim", counting_system: "kufi", rawi: [
        { id: "1", name: "shuba" }, { id: "2", name: "hafs" }
    ]},
    { id: "6", name: "hamza", counting_system: "kufi", rawi: [
        { id: "1", name: "khalaf" }, { id: "2", name: "khallad" }
    ]},
    { id: "7", name: "kisai", counting_system: "kufi", rawi: [
        { id: "1", name: "abu al-harith" }, { id: "2", name: "hafs ad-duri" }
    ]},
    { id: "8", name: "abu jafar", counting_system: "madani awwal", rawi: [
        { id: "1", name: "ibn wardan" }, { id: "2", name: "ibn jammaz" }
    ]},
    { id: "9", name: "yaqub", counting_system: "basri", rawi: [
        { id: "1", name: "ruwais" }, { id: "2", name: "rawh" }
    ]},
    { id: "10", name: "khalaf al-bazzar", counting_system: "kufi", rawi: [
        { id: "1", name: "ishaq" }, { id: "2", name: "idris" }
    ]}
];

function getSystemKeyFromCountingName(name) {
    var map = {
        'kufi': 'al_kufi',
        'madani awwal': 'al_madani_al_awwal',
        'madani akhir': 'al_madani_al_akhir',
        'makki': 'al_makki',
        'basri': 'al_basri',
        'damashqi': 'al_dimashqi',
        'dimashqi': 'al_dimashqi'
    };
    return map[(name || '').toLowerCase().trim()] || 'al_kufi';
}

function buildMappingsFromQurra(qurra) {
    var out = {};
    if (!Array.isArray(qurra)) return out;
    qurra.forEach(function(q) {
        var systemKey = getSystemKeyFromCountingName(q.counting_system);
        if (Array.isArray(q.rawi)) {
            q.rawi.forEach(function(r) {
                var rawiName = (typeof r === 'string') ? r : (r.name || '');
                out[rawiName.toLowerCase().trim()] = systemKey;
            });
        }
    });
    return out;
}

var SYSTEM_NAMES = {
    'al_kufi': 'Kufi',
    'al_madani_al_awwal': 'Madani Al-Awwal',
    'al_madani_al_akhir': 'Madani Al-Akhir',
    'al_makki': 'Makki',
    'al_basri': 'Basri',
    'al_dimashqi': 'Dimashqi'
};

var docCheckInterval = null;
var lastDocName = '';

// Settings file path (shared with MushafTaskManager)
var SYMBOLPALETTE_SETTINGS_FILE = '';

function getHomeDir() {
    // Try Node.js first (most reliable)
    if (typeof process !== 'undefined' && process.env) {
        var home = process.env.USERPROFILE || process.env.HOME;
        if (home) return home.replace(/\\/g, '/');
    }
    // Fallback: CEP fs
    try {
        var home2 = window.cep.fs.getEnv('USERPROFILE') || window.cep.fs.getEnv('HOME');
        if (home2) return home2.replace(/\\/g, '/');
    } catch (e) {}
    // Last resort
    return 'C:/Users/' + (typeof process !== 'undefined' && process.env ? process.env.USERNAME : 'User');
}

function getMushafTaskManagerDir() {
    return getHomeDir() + '/Documents/MushafTaskManager';
}

function getSymbolPaletteSettingsPath() {
    // Only use shared path on drive — no local fallback
    return getSharedSettingsPath();
}

function getSharedSettingsPath() {
    var settingsFolder = deriveSettingsFolder();
    if (!settingsFolder) return null;
    return settingsFolder.replace(/\\/g, '/') + '/counting/symbolPalette_settings.json';
}

function detectRiwayahFromFilename(filename) {
    var match = filename.match(/^(\d+)-(.+)\.ai$/i);
    if (match) {
        return {
            page: parseInt(match[1], 10),
            riwayah: match[2].trim()
        };
    }
    return null;
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    loadStoredData();
    loadSettings();
    loadPageStatistics();
    setupEventListeners();

    // Check accessibility and auto-detect on startup
    if (rootFolder && !pathExists(rootFolder)) {
        // saved rootFolder not accessible, attempting auto-detect
        var result = autoDetectFromDrive();
        if (result) {
            applyAutoDetectResult(result, false);
        } else {
            showDriveMissingModal(rootFolder);
        }
    } else if (!rootFolder) {
        // no rootFolder configured, attempting auto-detect
        var result = autoDetectFromDrive();
        if (result) {
            applyAutoDetectResult(result, false);
        }
    }

    if (rootFolder) {
        scanCategories();
        updateCategorySelect();
        loadSymbolsForCurrentView();
        ensureLayerColorsFile();
        // Scan for new riwayah folders on disk once per session
        if (!window._riwayahsScanned) {
            window._riwayahsScanned = true;
            var sf = deriveSettingsFolder();
            if (sf) {
                scanAndAddRiwayahs(sf);
            }
        }
    } else {
        renderGrid();
    }
    updateFolderDisplay();
    startDocumentDetection();

    // Populate version display from updater (single source of truth: version.json)
    var footerVersion = document.getElementById('footerVersion');
    if (footerVersion && window.SymbolUpdater) {
        footerVersion.textContent = 'v' + window.SymbolUpdater.CURRENT_VERSION;
    }

    // Initialize layer tools
    renderLayerButtons();
    scanDocumentLayers();
});

// ==================== STORAGE ====================

function loadStoredData() {
    try {
        var stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            var data = JSON.parse(stored);
            rootFolder = data.rootFolder || '';
            symbolCategory = data.symbolCategory || '';
        }
    } catch (e) {
        console.log('Could not load stored data');
    }
}

function saveState() {
    try {
        var stored = localStorage.getItem(STORAGE_KEY);
        var data = stored ? JSON.parse(stored) : {};
        data.rootFolder = rootFolder;
        data.symbolCategory = symbolCategory;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.log('Could not save state');
    }
}

// ==================== SETTINGS ====================

function loadSettings() {
    // Load only from shared path (drive folder) — no localStorage fallback
    try {
        var sharedPath = getSharedSettingsPath();
        if (sharedPath) {
            var result = window.cep.fs.readFile(sharedPath, 'utf-8');
            if (result.err === 0 && result.data) {
                var data = JSON.parse(result.data);
                riwayahSettings.defaultSystem = data.defaultSystem || 'al_kufi';
                riwayahSettings.qurra = Array.isArray(data.qurra) ? data.qurra : DEFAULT_QURRA.slice();
                riwayahSettings.mappings = data.mappings || buildMappingsFromQurra(riwayahSettings.qurra);
                console.log('Settings loaded from shared path:', sharedPath);
                return;
            }
        }
    } catch (e) {
        console.log('Could not load settings from shared path:', e);
    }
    // File doesn't exist yet — seed with default qurra data and save
    riwayahSettings.qurra = DEFAULT_QURRA.slice();
    riwayahSettings.mappings = buildMappingsFromQurra(DEFAULT_QURRA);
    saveSettings();
    // Settings seeded with default qurra data
}

function saveSettings() {
    // Save only to shared path (drive folder) — no localStorage fallback
    try {
        var settingsPath = getSymbolPaletteSettingsPath();
        if (!settingsPath) {
            console.log('saveSettings: no settings path derived');
            return;
        }
        var sp = settingsPath.replace(/\\/g, '/');
        var countingDir = sp.replace(/\/[^\/]+$/, '');      // .../mushaftasks/counting
        var tasksDir = countingDir.replace(/\/[^\/]+$/, ''); // .../mushaftasks

        // Ensure mushaftasks/ exists
        var tasksStat = window.cep.fs.readdir(tasksDir);
        if (tasksStat.err !== 0) {
            var makeTasks = window.cep.fs.makedir(tasksDir);
            if (makeTasks.err !== 0) {
                console.log('Could not create mushaftasks dir:', tasksDir, 'err:', makeTasks.err);
                throw new Error('Could not create mushaftasks directory');
            }
        }

        // Ensure counting/ exists
        var dirStat = window.cep.fs.readdir(countingDir);
        if (dirStat.err !== 0) {
            var makeResult = window.cep.fs.makedir(countingDir);
            if (makeResult.err !== 0) {
                console.log('Could not create counting dir:', countingDir, 'err:', makeResult.err);
                throw new Error('Could not create counting directory');
            }
        }

        var result = window.cep.fs.writeFile(settingsPath, JSON.stringify(riwayahSettings, null, 2), 'utf-8');
        if (result.err === 0) {
            console.log('Settings saved to', settingsPath);
            return;
        }

        // Fallback: Node.js fs for permission issues on Google Drive
        if (result.err === 5 && typeof require !== 'undefined') {
            try {
                var fs = require('fs');
                fs.writeFileSync(settingsPath, JSON.stringify(riwayahSettings, null, 2), 'utf-8');
                console.log('Settings saved via Node.js to', settingsPath);
                return;
            } catch (nodeErr) {
    // Node.js fallback failed
            }
        }
    } catch (e) {
        console.log('Could not save settings to shared path:', e);
    }
}

// ==================== GOOGLE DRIVE AUTO-DETECT ====================

function readMushafTaskManagerSettings() {
    try {
        var home = window.cep.process.getEnv('USERPROFILE');
        if (!home) return null;
        var settingsPath = home.replace(/\\/g, '/') + '/Documents/MushafTaskManager/settings.json';
        var result = window.cep.fs.readFile(settingsPath, 'utf-8');
        if (result.err === 0 && result.data) {
            var data = JSON.parse(result.data);
            console.log('symbolPalette: read MushafTaskManager settings from', settingsPath);
            return data;
        }
    } catch (e) {
        console.log('symbolPalette: could not read MushafTaskManager settings:', e);
    }
    return null;
}

function deriveMushafProjectRoot(projectFolder) {
    if (!projectFolder) return null;
    var pf = projectFolder.replace(/\\/g, '/');
    // If projectFolder points to mushafproject/mushaffiles/, go up one level
    var m = pf.match(/^(.*)[\\\/]mushaffiles$/i);
    if (m) {
        var candidate = m[1];
        if (isDirectory(candidate + '/symbols') && isDirectory(candidate + '/numbers')) {
            return candidate;
        }
    }
    // If projectFolder itself has symbols/ and numbers/, use it directly
    if (isDirectory(pf + '/symbols') && isDirectory(pf + '/numbers')) {
        return pf;
    }
    // Try going up one level from projectFolder
    var upOne = pf.replace(/[\\\/][^\\\/]+$/, '');
    if (upOne && upOne !== pf && isDirectory(upOne + '/symbols') && isDirectory(upOne + '/numbers')) {
        return upOne;
    }
    return null;
}

/**
 * Derive the settings (mushaftasks) folder from the current rootFolder.
 * rootFolder is either: mushafproject/          (flat)
 *                    or: mushafproject/symbols/  (nested)
 * mushaftasks lives at the project root level in both cases.
 */
function deriveSettingsFolder() {
    if (!rootFolder) return null;
    var rf = rootFolder.replace(/\\/g, '/').replace(/\/$/, ''); // normalize, strip trailing slash
    var projectRoot = null;
    if (rf.toLowerCase().endsWith('/symbols')) {
        projectRoot = rf.replace(/\/symbols$/i, '');
    } else {
        projectRoot = rf;
    }
    if (!projectRoot) return null;
    var tasksFolder = projectRoot.replace(/\/$/, '') + '/mushaftasks';
    return tasksFolder;
}

/**
 * Ensure mushaftasks/layers/layerColors.json exists with default colors.
 * Uses the same pattern as saveLayerButtons() which is known to work.
 */
function ensureLayerColorsFile(force) {
    try {
        var settingsFolder = deriveSettingsFolder();
        if (!settingsFolder) {
            // ensureLayerColorsFile: rootFolder is empty or invalid
            return false;
        }

        var sf = settingsFolder.replace(/\\/g, '/');
        var layersDir = sf + '/layers';
        var colorsPath = layersDir + '/layerColors.json';

        // Skip if already exists (unless force=true)
        if (!force) {
            var parentList = window.cep.fs.readdir(layersDir);
            if (parentList.err === 0 && parentList.data && parentList.data.indexOf('layerColors.json') !== -1) {
                return true;
            }
        }

        // Create mushaftasks/ if needed (same pattern as saveLayerButtons)
        var tasksStat = window.cep.fs.readdir(sf);
        if (tasksStat.err !== 0) {
            var makeTasks = window.cep.fs.makedir(sf);
            if (makeTasks.err !== 0) {
    // failed to create mushaftasks dir
                return false;
            }
        }

        // Create layers/ if needed
        var dirStat = window.cep.fs.readdir(layersDir);
        if (dirStat.err !== 0) {
            var makeDir = window.cep.fs.makedir(layersDir);
            if (makeDir.err !== 0) {
    // failed to create layers dir
                return false;
            }
        }

        var defaultColors = {
            "Iskan Haa": [255, 128, 0],
            "Meem Sila": [0, 128, 255],
            "default": [128, 128, 128]
        };

        var result = window.cep.fs.writeFile(colorsPath, JSON.stringify(defaultColors, null, 2), 'utf-8');
        if (result.err === 0) {
    // layerColors.json created
            return true;
        }

        // Fallback: Node.js fs (bypasses CEP permission issues on Google Drive)
        if (result.err === 5 && typeof require !== 'undefined') {
            try {
                var fs = require('fs');
                fs.writeFileSync(colorsPath, JSON.stringify(defaultColors, null, 2), 'utf-8');
    // layerColors.json created via Node.js
                return true;
            } catch (nodeErr) {
    // Node.js fallback failed
                return false;
            }
        }

    // writeFile failed
        return false;
    } catch (e) {
    // ensureLayerColorsFile error
        return false;
    }
}

function pathExists(path) {
    // Try readdir first (directories)
    var r = window.cep.fs.readdir(path);
    if (r.err === 0) return true;
    // Fallback: stat works on some paths where readdir fails
    var s = window.cep.fs.stat(path);
    if (s.err === 0) return true;
    // Second fallback: Node.js fs if available (other extensions use this)
    if (typeof require !== 'undefined') {
        try {
            var fs = require('fs');
            return fs.existsSync(path);
        } catch (e) {}
    }
    return false;
}

function autoDetectFromDrive() {
    // starting auto-detect

    // Helper: check if a path is valid symbolPalette root (has symbols/ + numbers/ inside)
    function checkRoot(path, source) {
        var p = path.replace(/\\/g, '/');
        // Structure A: flat — rootFolder/symbols/ + rootFolder/numbers/
        var flatSym = p + '/symbols';
        var flatNum = p + '/numbers';
        var flatSymOk = pathExists(flatSym);
        var flatNumOk = pathExists(flatNum);
        if (flatSymOk && flatNumOk) {
            // Verify symbols/ contains subfolders (categories), not SVGs directly
            var r = window.cep.fs.readdir(flatSym);
            var hasSubfolders = false;
            if (r.err === 0 && r.data) {
                for (var k = 0; k < r.data.length; k++) {
                    if (r.data[k] === 'numbers') continue; // skip numbers if nested inside symbols
                    var itemPath = flatSym + '/' + r.data[k];
                    if (isDirectory(itemPath)) { hasSubfolders = true; break; }
                }
            }
            if (hasSubfolders) {
    // found flat root
                return { rootFolder: p, tasksFolder: p + '/mushaftasks', source: source + ' (flat)' };
            }
        }
        // Structure B: nested — rootFolder/symbols/symbols/ + rootFolder/symbols/numbers/
        var nestSym = p + '/symbols/symbols';
        var nestNum = p + '/symbols/numbers';
        var nestSymOk = pathExists(nestSym);
        var nestNumOk = pathExists(nestNum);
        if (nestSymOk && nestNumOk) {
            console.log('symbolPalette: found NESTED root:', p + '/symbols', 'source:', source);
            return { rootFolder: p + '/symbols', tasksFolder: p + '/mushaftasks', source: source + ' (nested)' };
        }
        return null;
    }

    // Primary: use the full DriveScanner (same as mushaftask / ornamentReplacer)
    if (typeof window.DriveScanner !== 'undefined') {
        try {
            var candidates = window.DriveScanner.scanForProject();
    // DriveScanner found candidates
            for (var i = 0; i < candidates.length; i++) {
                var c = candidates[i];
                var result = checkRoot(c.path, 'DriveScanner (' + c.type + ')');
                if (result) return result;
            }
        } catch (e) {
            console.error('symbolPalette: DriveScanner failed:', e);
        }
    }

    // Fast path: read MushafTaskManager settings
    var mtmSettings = readMushafTaskManagerSettings();
    if (mtmSettings) {
    // MushafTaskManager settings found
        if (mtmSettings.projectFolder) {
            var rp = deriveMushafProjectRoot(mtmSettings.projectFolder);
    // deriveMushafProjectRoot result
            if (rp) {
                var res = checkRoot(rp, 'MushafTaskManager settings');
                if (res) return res;
            }
        }
        if (mtmSettings.tasksFolder) {
            var tf = mtmSettings.tasksFolder.replace(/\\/g, '/');
            var upFromTasks = tf.replace(/[\\\/]mushaftasks$/i, '');
    // derive from tasksFolder
            if (upFromTasks && upFromTasks !== tf) {
                var res2 = checkRoot(upFromTasks, 'MushafTaskManager settings');
                if (res2) return res2;
            }
        }
    } else {
    // no MushafTaskManager settings found
    }

    // Fallback: direct drive scan using Node.js
    if (typeof require !== 'undefined') {
        try {
            var fs = require('fs');
            var driveLetters = [];
            for (var c = 65; c <= 90; c++) {
                var drive = String.fromCharCode(c) + ':/';
                try { fs.readdirSync(drive); driveLetters.push(String.fromCharCode(c)); } catch (e) {}
            }
    // detected drives
            var patterns = ['/My Drive/mushafproject', '/Google Drive/mushafproject', '/mushafproject'];
            for (var di = 0; di < driveLetters.length; di++) {
                for (var pi = 0; pi < patterns.length; pi++) {
                    var path = driveLetters[di] + ':' + patterns[pi];
                    var res3 = checkRoot(path, 'Node.js drive scan (' + driveLetters[di] + ':)');
                    if (res3) return res3;
                }
            }
        } catch (e) {
            console.error('symbolPalette: Node.js drive scan failed:', e);
        }
    }

    // Final fallback: CEP fs scan
    var cepDriveLetters = ['G', 'H', 'D', 'E', 'F', 'I', 'J', 'K', 'L', 'M', 'C'];
    var cepPatterns = ['/My Drive/mushafproject', '/Google Drive/mushafproject', '/mushafproject'];
    for (var ci = 0; ci < cepDriveLetters.length; ci++) {
        for (var cj = 0; cj < cepPatterns.length; cj++) {
            var testPath = cepDriveLetters[ci] + ':' + cepPatterns[cj];
            var res4 = checkRoot(testPath, 'CEP drive scan (' + cepDriveLetters[ci] + ':)');
            if (res4) return res4;
        }
    }

    // auto-detect found no valid mushafproject folder
    return null;
}

function testPathAndUse(rawPath) {
    var path = rawPath.replace(/\\/g, '/').trim();
    if (!path) return;
    // testing path

    // Check flat structure: path/symbols/ + path/numbers/
    var flatSym = pathExists(path + '/symbols');
    var flatNum = pathExists(path + '/numbers');
    if (flatSym && flatNum) {
        document.getElementById('folderPathInput').value = path;
        scanRootFolderForPreview(path);
        setTimeout(function() { loadSymbolsFromRootFolder(); }, 200);
        return { success: true, path: path, structure: 'flat' };
    }

    // Check nested structure: path/symbols/symbols/ + path/symbols/numbers/
    var nestSym = pathExists(path + '/symbols/symbols');
    var nestNum = pathExists(path + '/symbols/numbers');
    if (nestSym && nestNum) {
        var root = path + '/symbols';
        document.getElementById('folderPathInput').value = root;
        scanRootFolderForPreview(root);
        setTimeout(function() { loadSymbolsFromRootFolder(); }, 200);
        return { success: true, path: root, structure: 'nested' };
    }

    return { success: false, flatSym: flatSym, flatNum: flatNum, nestSym: nestSym, nestNum: nestNum };
}

function scanAndAddRiwayahs(tasksFolder) {
    if (!tasksFolder) return [];
    var riwayahPath = tasksFolder.replace(/\\/g, '/') + '/riwayah-tasks';
    if (!isDirectory(riwayahPath)) {
    // riwayah-tasks folder not found
        return [];
    }

    var result = window.cep.fs.readdir(riwayahPath);
    if (result.err !== 0) {
    // could not read riwayah-tasks folder
        return [];
    }

    var added = [];
    result.data.forEach(function(item) {
        if (item.startsWith('.') || item === 'desktop.ini' || item === 'Thumbs.db') return;
        var itemPath = riwayahPath + '/' + item;
        if (isDirectory(itemPath)) {
            var riwayahName = item.toLowerCase().trim();
            // Only add if not already known in qurra data
            if (!isRawiInQurra(riwayahName) && !riwayahSettings.mappings[riwayahName]) {
                // Unknown rawi — add mapping to default so it shows in settings
                riwayahSettings.mappings[riwayahName] = riwayahSettings.defaultSystem;
                added.push(riwayahName);
            }
        }
    });

    if (added.length > 0) {
        saveSettings();
    // added riwayahs from scan
    } else {
    // no new riwayahs found
    }
    return added;
}

function applyAutoDetectResult(result, showAlert) {
    if (!result || !result.rootFolder) return false;

    rootFolder = result.rootFolder;

    // Reset category
    scanCategories();
    if (scannedCategories.indexOf(symbolCategory) === -1) {
        symbolCategory = scannedCategories.length > 0 ? scannedCategories[0] : '';
    }

    // Scan riwayahs from tasks folder
    var addedRiwayahs = scanAndAddRiwayahs(result.tasksFolder);

    saveState();
    saveSymbolsForCurrentView();
    updateCategorySelect();
    updateFolderDisplay();
    loadSymbolsForCurrentView();

    var msg = 'Auto-detected: ' + result.rootFolder;
    if (addedRiwayahs.length > 0) {
        msg += '\nFound riwayahs: ' + addedRiwayahs.join(', ');
    }
    msg += '\n(Source: ' + result.source + ')';

    // auto-detect result
    if (showAlert) {
        showErrorModal(msg, 'Auto-Detected');
    }
    return true;
}

function isRawiInQurra(riwayah) {
    var clean = riwayah.toLowerCase().trim();
    if (!Array.isArray(riwayahSettings.qurra)) return false;
    for (var i = 0; i < riwayahSettings.qurra.length; i++) {
        var q = riwayahSettings.qurra[i];
        if (Array.isArray(q.rawi)) {
            for (var j = 0; j < q.rawi.length; j++) {
                var rawiName = (typeof q.rawi[j] === 'string') ? q.rawi[j] : (q.rawi[j].name || '');
                if (rawiName.toLowerCase().trim() === clean) {
                    return true;
                }
            }
        }
    }
    return false;
}

function getSystemForRiwayah(riwayah) {
    var clean = riwayah.toLowerCase().trim();
    // 1. Check explicit mappings first (user overrides)
    if (riwayahSettings.mappings[clean]) {
        return riwayahSettings.mappings[clean];
    }
    // 2. Look up in qurra data
    if (Array.isArray(riwayahSettings.qurra)) {
        for (var i = 0; i < riwayahSettings.qurra.length; i++) {
            var q = riwayahSettings.qurra[i];
            if (Array.isArray(q.rawi)) {
                for (var j = 0; j < q.rawi.length; j++) {
                    var rawiName = (typeof q.rawi[j] === 'string') ? q.rawi[j] : (q.rawi[j].name || '');
                    if (rawiName.toLowerCase().trim() === clean) {
                        return getSystemKeyFromCountingName(q.counting_system);
                    }
                }
            }
        }
    }
    // 3. Fallback to default
    return riwayahSettings.defaultSystem;
}

function getRawisWithFiles() {
    var found = {};
    var settingsFolder = deriveSettingsFolder();
    if (!settingsFolder) return found;
    var riwayahPath = settingsFolder.replace(/\\/g, '/') + '/riwayah-tasks';
    try {
        var result = window.cep.fs.readdir(riwayahPath);
        if (result.err === 0 && result.data) {
            result.data.forEach(function(item) {
                if (item.startsWith('.') || item === 'desktop.ini' || item === 'Thumbs.db') return;
                found[item.toLowerCase().trim()] = true;
            });
        }
    } catch (e) {}
    return found;
}

// ==================== PAGE STATISTICS ====================

function loadPageStatistics() {
    try {
        var scriptPath = window.location.href.replace('file:///', '').replace(/\/[^\/]*$/, '');
        var statsPath = scriptPath + '/page_system_statistics.json';
        var result = window.cep.fs.readFile(statsPath);
        if (result.err === 0) {
            pageStatisticsData = JSON.parse(result.data);
            buildSurahTotalsBySystem();
            // Page statistics loaded
        } else {
    // Could not load page statistics
        }
    } catch (e) {
    // Error loading page statistics
    }
}

function buildSurahTotalsBySystem() {
    if (!pageStatisticsData || !pageStatisticsData.surah_statistics) return;
    surahTotalsBySystem = {};
    pageStatisticsData.surah_statistics.forEach(function(s) {
        var sn = s.surah_number;
        surahTotalsBySystem[sn] = {};
        for (var sys in s.system_ayah_counts) {
            surahTotalsBySystem[sn][sys] = s.system_ayah_counts[sys];
        }
    });
}

// ==================== DOCUMENT DETECTION ====================
// Matches mushaftaskextension approach: Promise-based with timeout

function startDocumentDetection() {
    checkActiveDocument();
    if (docCheckInterval) clearInterval(docCheckInterval);
    docCheckInterval = setInterval(checkActiveDocument, 2000);
}

function getActiveDocumentInfo() {
    return new Promise(function(resolve) {
        var timeout = setTimeout(function() {
    // getActiveDocumentName timeout
            resolve(null);
        }, 1000);

        csInterface.evalScript('getActiveDocumentName()', function(result) {
            clearTimeout(timeout);

            if (!result || result === 'null' || result === 'undefined' || result === 'Error') {
                resolve(null);
            } else {
                var info = detectRiwayahFromFilename(result);
                resolve(info);
            }
        });
    });
}

function checkActiveDocument() {
    getActiveDocumentInfo().then(function(docInfo) {
        var newDocName = docInfo ? (docInfo.page + '-' + docInfo.riwayah + '.ai') : '';
        if (newDocName === lastDocName) return;
        lastDocName = newDocName;
        parseDocumentInfo(docInfo);
        scanDocumentLayers();
    });
}

function parseDocumentInfo(docInfo) {
    if (!docInfo || !pageStatisticsData) {
        hidePageInfo();
        return;
    }

    var pageNum = docInfo.page;
    var riwayah = docInfo.riwayah;
    var systemKey = getSystemForRiwayah(riwayah);

    if (pageNum < 1 || pageNum > 604) {
        hidePageInfo();
        return;
    }

    // Get page stats
    var pageStats = pageStatisticsData.page_statistics[pageNum - 1];
    if (!pageStats || pageStats.page_number !== pageNum) {
        hidePageInfo();
        return;
    }

    var systemData = pageStats.systems[systemKey];
    if (!systemData) {
        hidePageInfo();
        return;
    }

    var ayahNumbers = extractAyahNumbers(pageStats, systemKey);

    currentPageInfo = {
        detected: true,
        pageNumber: pageNum,
        riwayah: riwayah,
        systemKey: systemKey,
        ayahNumbers: ayahNumbers
    };

    showPageInfo(pageNum, riwayah, systemKey, ayahNumbers.length);
    renderNumberGrid();
}

function extractAyahNumbers(pageStats, systemKey) {
    var numbers = [];
    var rangeStr = pageStats.systems[systemKey].verse_range;
    var ayahCount = pageStats.systems[systemKey].ayah_count;

    if (!rangeStr) return numbers;

    try {
        // Check if multi-surah (has two colons)
        if (rangeStr.split(':').length - 1 === 2) {
            var parts = rangeStr.split('-');
            var left = parts[0];
            var right = parts[1];
            var startS = parseInt(left.split(':')[0], 10);
            var startA = parseInt(left.split(':')[1], 10);
            var endS = parseInt(right.split(':')[0], 10);
            var endA = parseInt(right.split(':')[1], 10);

            if (startS === endS) {
                for (var a = startA; a <= endA; a++) {
                    numbers.push(a);
                }
            } else {
                // Start surah: from startA to its total for this system
                var startTotal = (surahTotalsBySystem[startS] && surahTotalsBySystem[startS][systemKey]) || 0;
                for (var a1 = startA; a1 <= startTotal; a1++) {
                    numbers.push(a1);
                }
                // Middle surahs (all ayahs)
                for (var s = startS + 1; s < endS; s++) {
                    var midTotal = (surahTotalsBySystem[s] && surahTotalsBySystem[s][systemKey]) || 0;
                    for (var a2 = 1; a2 <= midTotal; a2++) {
                        numbers.push(a2);
                    }
                }
                // End surah: from 1 to endA
                for (var a3 = 1; a3 <= endA; a3++) {
                    numbers.push(a3);
                }
            }
        } else {
            // Single surah: "2:16-23" or "2:1-4"
            var surahPart = rangeStr.split(':')[0];
            var ayahPart = rangeStr.split(':')[1];
            var start = parseInt(ayahPart.split('-')[0], 10);
            var end = parseInt(ayahPart.split('-')[1], 10);
            for (var a4 = start; a4 <= end; a4++) {
                numbers.push(a4);
            }
        }
    } catch (e) {
    // Error parsing verse range
    }

    // Sanity check: if our count doesn't match, trust ayah_count and adjust
    if (numbers.length !== ayahCount) {
        console.warn('Ayah count mismatch for page', pageStats.page_number, 'system', systemKey,
            'expected', ayahCount, 'got', numbers.length, 'range', rangeStr);
    }

    return numbers;
}

function hidePageInfo() {
    currentPageInfo = { detected: false, pageNumber: 0, riwayah: '', systemKey: 'al_kufi', ayahNumbers: [] };
    document.getElementById('pageInfoBar').classList.add('hidden');
    document.getElementById('importAllBar').classList.add('hidden');
    document.getElementById('numberSection').classList.add('hidden');
}

function showPageInfo(pageNum, riwayah, systemKey, count) {
    document.getElementById('pageBadge').textContent = 'Page ' + String(pageNum).padStart(3, '0');
    document.getElementById('riwayahBadge').textContent = riwayah;
    document.getElementById('systemBadge').textContent = SYSTEM_NAMES[systemKey] || systemKey;

    var titleEl = document.getElementById('numberSectionTitle');
    if (titleEl) {
        titleEl.textContent = count + ' AYAHS ON THIS PAGE';
    }

    document.getElementById('pageInfoBar').classList.remove('hidden');
    document.getElementById('importAllBar').classList.remove('hidden');
    document.getElementById('numberSection').classList.remove('hidden');
}

// ==================== NUMBER GRID ====================

function renderNumberGrid() {
    var container = document.getElementById('numberGrid');
    container.innerHTML = '';

    if (!currentPageInfo.detected || currentPageInfo.ayahNumbers.length === 0) {
        var emptyMsg = document.createElement('div');
        emptyMsg.className = 'empty-message';
        emptyMsg.textContent = 'No ayah numbers for this page';
        container.appendChild(emptyMsg);
        return;
    }

    currentPageInfo.ayahNumbers.forEach(function(num, index) {
        var cell = document.createElement('div');
        cell.className = 'number-cell';
        cell.dataset.index = index;
        cell.dataset.number = num;
        cell.title = 'Ayah ' + num;

        cell.addEventListener('click', function() {
            pasteNumber(num, cell);
        });

        var imgContainer = document.createElement('div');
        imgContainer.className = 'symbol-image-container';

        if (rootFolder) {
            var filePath = rootFolder + '/numbers/' + num + '.svg';
            var stat = window.cep.fs.stat(filePath);
            if (stat.err === 0) {
                var img = document.createElement('img');
                img.className = 'number-image';
                img.src = 'file:///' + filePath;
                img.alt = num;
                img.onerror = function() {
                    this.style.display = 'none';
                    showNumberPlaceholder(imgContainer, num);
                };
                imgContainer.appendChild(img);
            } else {
                showNumberPlaceholder(imgContainer, num);
            }
        } else {
            showNumberPlaceholder(imgContainer, num);
        }

        cell.appendChild(imgContainer);
        container.appendChild(cell);
    });
}

// ==================== PANEL WIDTH SNAPPING ====================

function showNumberPlaceholder(container, num) {
    var placeholder = document.createElement('div');
    placeholder.className = 'number-placeholder';
    placeholder.textContent = num;
    container.appendChild(placeholder);
}

function pasteNumber(num, cell) {
    if (!rootFolder) {
        showErrorModal('Please select a root folder first.');
        return;
    }

    var filePath = rootFolder + '/numbers/' + num + '.svg';
    var stat = window.cep.fs.stat(filePath);
    if (stat.err !== 0) {
        showErrorModal('Number file not found: ' + num + '.svg');
        return;
    }

    if (cell) cell.classList.add('processing');

    var script = 'pasteFromFile("' + escapePath(filePath) + '");';
    csInterface.evalScript(script, function(result) {
        if (cell) cell.classList.remove('processing');
        if (result && result.toString().indexOf('Error:') === 0) {
            showErrorModal(result);
        } else if (result === 'false' || result === false) {
            showErrorModal('Failed to paste number.');
        }
    });
}

function importAllNumbers() {
    if (!currentPageInfo.detected || currentPageInfo.ayahNumbers.length === 0) {
        showErrorModal('No ayah numbers to import for this page.');
        return;
    }

    if (!rootFolder) {
        showErrorModal('Please select a root folder first.');
        return;
    }

    var filePaths = [];
    var missing = [];
    currentPageInfo.ayahNumbers.forEach(function(num) {
        var filePath = rootFolder + '/numbers/' + num + '.svg';
        var stat = window.cep.fs.stat(filePath);
        if (stat.err === 0) {
            filePaths.push(filePath);
        } else {
            missing.push(num);
        }
    });

    if (filePaths.length === 0) {
        showErrorModal('No number SVG files found for this page.');
        return;
    }

    if (missing.length > 0) {
        console.warn('Missing number SVGs:', missing);
    }

    var btn = document.getElementById('importAllBtn');
    btn.classList.add('processing');
    btn.disabled = true;

    // Build ExtendScript array literal with properly escaped paths
    var pathsStr = filePaths.map(function(p) {
        return '"' + p.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
    }).join(',');
    var script = 'pasteAllNumbersAligned([' + pathsStr + ']);';

    csInterface.evalScript(script, function(result) {
        btn.classList.remove('processing');
        btn.disabled = false;
        if (result && result.toString().indexOf('Error:') === 0) {
            showErrorModal(result);
        } else if (result === 'success') {
        // Ayah numbers imported successfully
        }
    });
}

// ==================== SETTINGS MODAL ====================

function showSettingsModal() {
    document.getElementById('defaultSystemSelect').value = riwayahSettings.defaultSystem;
    renderRiwayahMappings();
    document.getElementById('settingsModal').classList.add('active');
}

function hideSettingsModal() {
    document.getElementById('settingsModal').classList.remove('active');
}

function getAvailableRiwayahs() {
    // Scan mushaftasks/riwayah-tasks/ for actual folder names
    var tasksFolder = deriveSettingsFolder();

    var fromDisk = [];
    if (tasksFolder) {
        var riwayahPath = tasksFolder.replace(/\\/g, '/') + '/riwayah-tasks';
        var result = window.cep.fs.readdir(riwayahPath);
        if (result.err === 0 && result.data) {
            result.data.forEach(function(item) {
                if (item.startsWith('.') || item === 'desktop.ini' || item === 'Thumbs.db') return;
                var itemPath = riwayahPath + '/' + item;
                if (isDirectory(itemPath)) {
                    fromDisk.push(item.toLowerCase().trim());
                }
            });
        }
    }

    if (fromDisk.length > 0) {
        // Merge with any saved mappings that aren't on disk yet
        for (var r in riwayahSettings.mappings) {
            if (fromDisk.indexOf(r) === -1) {
                fromDisk.push(r);
            }
        }
        return fromDisk.sort();
    }

    // Fallback: common riwayahs + saved mappings
    var fallback = ['hafs', 'warsh', 'qaloon', 'al_doori', 'al_susi', 'al_bazzi', 'qunbul', 'al_kisai'];
    for (var r2 in riwayahSettings.mappings) {
        if (fallback.indexOf(r2) === -1) {
            fallback.push(r2);
        }
    }
    return fallback;
}

function renderRiwayahMappings() {
    var container = document.getElementById('riwayahMappings');
    container.innerHTML = '';

    var rawisWithFiles = getRawisWithFiles();

    // Render qurra data grouped by qari
    if (Array.isArray(riwayahSettings.qurra)) {
        riwayahSettings.qurra.forEach(function(q) {
            var group = document.createElement('div');
            group.className = 'riwayah-group';
            group.style.marginBottom = '12px';

            var header = document.createElement('div');
            header.className = 'riwayah-group-header';
            header.style.fontSize = '12px';
            header.style.fontWeight = 'bold';
            header.style.color = 'var(--text-secondary)';
            header.style.marginBottom = '6px';
            header.style.paddingBottom = '4px';
            header.style.borderBottom = '1px solid var(--border-color)';
            header.textContent = q.name.toUpperCase();
            group.appendChild(header);

            if (Array.isArray(q.rawi)) {
                q.rawi.forEach(function(r) {
                    var rawiName = (typeof r === 'string') ? r : (r.name || '');
                    var clean = rawiName.toLowerCase().trim();
                    var hasFile = rawisWithFiles[clean];

                    var row = document.createElement('div');
                    row.className = 'mapping-row';
                    row.style.paddingLeft = '12px';
                    row.style.display = 'flex';
                    row.style.alignItems = 'center';
                    row.style.gap = '8px';

                    var label = document.createElement('label');
                    label.textContent = rawiName.toUpperCase();
                    if (hasFile) {
                        label.style.color = '#f39c12'; // accent-orange for rawis with files
                    }
                    row.appendChild(label);

                    var select = document.createElement('select');
                    select.dataset.riwayah = clean;

                    for (var key in SYSTEM_NAMES) {
                        var option = document.createElement('option');
                        option.value = key;
                        option.textContent = SYSTEM_NAMES[key];
                        if (riwayahSettings.mappings[clean] === key) {
                            option.selected = true;
                        } else if (!riwayahSettings.mappings[clean] && key === getSystemKeyFromCountingName(q.counting_system)) {
                            option.selected = true;
                        }
                        select.appendChild(option);
                    }

                    row.appendChild(select);
                    group.appendChild(row);
                });
            }

            container.appendChild(group);
        });
    }

    // Render any extra mappings not in qurra (truly custom rawis)
    var extras = [];
    for (var rawi in riwayahSettings.mappings) {
        if (!isRawiInQurra(rawi)) {
            extras.push(rawi);
        }
    }
    if (extras.length > 0) {
        var extraGroup = document.createElement('div');
        extraGroup.className = 'riwayah-group';
        extraGroup.style.marginTop = '16px';

        var extraHeader = document.createElement('div');
        extraHeader.className = 'riwayah-group-header';
        extraHeader.style.fontSize = '12px';
        extraHeader.style.fontWeight = 'bold';
        extraHeader.style.color = 'var(--text-secondary)';
        extraHeader.style.marginBottom = '6px';
        extraHeader.style.paddingBottom = '4px';
        extraHeader.style.borderBottom = '1px solid var(--border-color)';
        extraHeader.textContent = 'OTHER / CUSTOM';
        extraGroup.appendChild(extraHeader);

        extras.forEach(function(riwayah) {
            var hasFile = rawisWithFiles[riwayah];

            var row = document.createElement('div');
            row.className = 'mapping-row';
            row.style.paddingLeft = '12px';
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.gap = '8px';

            var label = document.createElement('label');
            label.textContent = riwayah.toUpperCase();
            if (hasFile) {
                label.style.color = '#f39c12'; // accent-orange for rawis with files
            }
            row.appendChild(label);

            var select = document.createElement('select');
            select.dataset.riwayah = riwayah;

            for (var key in SYSTEM_NAMES) {
                var option = document.createElement('option');
                option.value = key;
                option.textContent = SYSTEM_NAMES[key];
                if (riwayahSettings.mappings[riwayah] === key) {
                    option.selected = true;
                } else if (!riwayahSettings.mappings[riwayah] && key === riwayahSettings.defaultSystem) {
                    option.selected = true;
                }
                select.appendChild(option);
            }

            row.appendChild(select);
            extraGroup.appendChild(row);
        });

        container.appendChild(extraGroup);
    }
}

function resetSettingsToDefaults() {
    showConfirmModal(
        'This will restore the built-in Qurra data and clear any custom mappings.',
        'Reset to Defaults?',
        function() {
            riwayahSettings.qurra = DEFAULT_QURRA.slice();
            riwayahSettings.mappings = buildMappingsFromQurra(DEFAULT_QURRA);
            riwayahSettings.defaultSystem = 'al_kufi';
            saveSettings();
            renderRiwayahMappings();
            document.getElementById('defaultSystemSelect').value = riwayahSettings.defaultSystem;
        }
    );
}

function saveSettingsFromModal() {
    riwayahSettings.defaultSystem = document.getElementById('defaultSystemSelect').value;

    var selects = document.querySelectorAll('#riwayahMappings select');
    selects.forEach(function(select) {
        var riwayah = select.dataset.riwayah;
        var system = select.value;
        if (system !== riwayahSettings.defaultSystem) {
            riwayahSettings.mappings[riwayah] = system;
        } else {
            delete riwayahSettings.mappings[riwayah];
        }
    });

    saveSettings();
    hideSettingsModal();

    // Re-check document to apply new settings
    if (lastDocName) {
        var docInfo = detectRiwayahFromFilename(lastDocName);
        parseDocumentInfo(docInfo);
    }
}

function saveSymbolsForCurrentView() {
    try {
        var stored = localStorage.getItem(STORAGE_KEY);
        var data = stored ? JSON.parse(stored) : {};
        data.rootFolder = rootFolder;
        data.symbolCategory = symbolCategory;
        if (!data.symbols) data.symbols = {};
        if (symbolCategory) {
            data.symbols[symbolCategory] = symbols;
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
    // Could not save symbols
    }
}

function loadSymbolsFromStorage() {
    try {
        var stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return false;
        var data = JSON.parse(stored);
        if (symbolCategory && data.symbols && data.symbols[symbolCategory]) {
            symbols = data.symbols[symbolCategory];
            return true;
        }
    } catch (e) {}
    return false;
}

// ==================== UI UPDATES ====================

function updateFolderDisplay() {
    var folderPathEl = document.getElementById('folderPath');
    if (!folderPathEl) return; // Element removed from UI
    if (rootFolder) {
        var display = rootFolder;
        if (symbolCategory) {
            display += ' > symbols > ' + symbolCategory;
        }
        folderPathEl.textContent = display;
        folderPathEl.classList.remove('no-folder');
    } else {
        folderPathEl.textContent = 'No folder selected';
        folderPathEl.classList.add('no-folder');
    }
}

// ==================== REFRESH ====================

function refreshSymbols() {
    if (!rootFolder) {
        showErrorModal('Please select a root folder first.');
        return;
    }

    document.getElementById('loadingOverlay').classList.add('active');

    scanCategories();
    updateCategorySelect();

    if (scannedCategories.indexOf(symbolCategory) === -1) {
        symbolCategory = scannedCategories.length > 0 ? scannedCategories[0] : '';
        updateCategorySelect();
    }

    // Clear cache for current category to force rescan
    try {
        var stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            var data = JSON.parse(stored);
            if (data.symbols && data.symbols[symbolCategory]) {
                delete data.symbols[symbolCategory];
                localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            }
        }
    } catch (e) {}

    saveState();
    updateFolderDisplay();
    loadSymbolsForCurrentView();

    setTimeout(function() {
        document.getElementById('loadingOverlay').classList.remove('active');
    }, 300);
}

// ==================== CATEGORY MANAGEMENT ====================

function isSvgFile(name) {
    return name.toLowerCase().endsWith('.svg');
}

function isDirectory(path) {
    // Most reliable cross-version check: try to read it as a directory
    var result = window.cep.fs.readdir(path);
    return result.err === 0;
}

function scanCategories() {
    scannedCategories = [];
    if (!rootFolder) return;

    var symbolsPath = rootFolder + '/symbols';
    var result = window.cep.fs.readdir(symbolsPath);
    if (result.err !== 0) return;

    result.data.forEach(function(item) {
        // Skip hidden/system files
        if (item.startsWith('.') || item === 'desktop.ini' || item === 'Thumbs.db') return;
        
        var itemPath = symbolsPath + '/' + item;
        if (isDirectory(itemPath)) {
            scannedCategories.push(item);
        }
    });

    scannedCategories.sort();
}

function updateCategorySelect() {
    var select = document.getElementById('categorySelect');
    var currentValue = select.value;
    select.innerHTML = '<option value="">Select category...</option>';

    scannedCategories.forEach(function(cat) {
        var option = document.createElement('option');
        option.value = cat;
        option.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
        if (cat === symbolCategory || cat === currentValue) {
            option.selected = true;
        }
        select.appendChild(option);
    });
}

// ==================== SYMBOL LOADING ====================

function loadSymbolsForCurrentView() {
    if (!rootFolder) {
        symbols = [];
        renderGrid();
        return;
    }

    // Try cache first
    if (loadSymbolsFromStorage()) {
        renderGrid();
        updateFolderDisplay();
        return;
    }

    // Scan from disk
    document.getElementById('loadingOverlay').classList.add('active');

    scanCategories();
    updateCategorySelect();
    if (!symbolCategory && scannedCategories.length > 0) {
        symbolCategory = scannedCategories[0];
        updateCategorySelect();
    }
    if (symbolCategory) {
        scanSymbolsFolder();
    } else {
        symbols = [];
        renderGrid();
    }

    updateFolderDisplay();

    setTimeout(function() {
        document.getElementById('loadingOverlay').classList.remove('active');
    }, 300);
}

function scanSymbolsFolder() {
    symbols = [];
    if (!rootFolder || !symbolCategory) {
        renderGrid();
        return;
    }

    var folderPath = rootFolder + '/symbols/' + symbolCategory;
    var result = window.cep.fs.readdir(folderPath);
    if (result.err !== 0) {
        renderGrid();
        return;
    }

    result.data.forEach(function(file) {
        // Skip hidden/system files and non-SVG files
        if (file.startsWith('.') || file === 'desktop.ini' || file === 'Thumbs.db') return;
        if (!isSvgFile(file)) return;
        
        var name = file.substring(0, file.lastIndexOf('.'));
        symbols.push({
            name: name,
            svgPath: folderPath + '/' + file
        });
    });

    symbols.sort(function(a, b) {
        return a.name.localeCompare(b.name);
    });

    saveSymbolsForCurrentView();
    renderGrid();
}

// ==================== GRID RENDERING ====================

function renderGrid() {
    var container = document.getElementById('symbolGrid');
    container.innerHTML = '';

    var titleEl = document.getElementById('symbolSectionTitle');
    if (titleEl) {
        var categoryName = symbolCategory || 'ALL';
        titleEl.textContent = symbols.length + ' SYMBOLS IN ' + categoryName.toUpperCase();
    }

    if (symbols.length === 0) {
        container.classList.add('empty');
        var emptyMsg = document.createElement('div');
        emptyMsg.className = 'empty-message';
        var hint = rootFolder
            ? 'No SVG files found in this folder'
            : 'Click "Root Folder" to get started';
        emptyMsg.innerHTML = 'No symbols loaded<br><span class="hint">' + hint + '</span>';
        container.appendChild(emptyMsg);
        return;
    }

    container.classList.remove('empty');

    symbols.forEach(function(symbol, index) {
        var cell = document.createElement('div');
        cell.className = 'symbol-cell';
        cell.dataset.index = index;
        cell.title = symbol.name;

        if (isEditMode) {
            cell.classList.add('edit-mode');
            cell.draggable = true;

            var dragHandle = document.createElement('div');
            dragHandle.className = 'drag-handle';
            dragHandle.innerHTML = '⋮⋮';
            cell.appendChild(dragHandle);

            var editBadge = document.createElement('div');
            editBadge.className = 'edit-badge';
            editBadge.innerHTML = '✎';
            cell.appendChild(editBadge);

            cell.addEventListener('dragstart', handleDragStart);
            cell.addEventListener('dragend', handleDragEnd);
            cell.addEventListener('dragover', handleDragOver);
            cell.addEventListener('drop', handleDrop);
            cell.addEventListener('click', function(e) {
                showEditModal(index);
            });
        } else {
            cell.addEventListener('click', function() {
                pasteSymbol(index);
            });
        }

        var imgContainer = document.createElement('div');
        imgContainer.className = 'symbol-image-container';

        if (symbol.svgPath) {
            var img = document.createElement('img');
            img.className = 'symbol-image';
            img.src = 'file:///' + symbol.svgPath;
            img.alt = symbol.name;
            img.onerror = function() {
                this.style.display = 'none';
                showPlaceholder(imgContainer, symbol.name);
            };
            imgContainer.appendChild(img);
        } else {
            showPlaceholder(imgContainer, symbol.name);
        }

        cell.appendChild(imgContainer);
        container.appendChild(cell);
    });
}

function showPlaceholder(container, name) {
    var placeholder = document.createElement('div');
    placeholder.className = 'symbol-placeholder';
    placeholder.textContent = name.charAt(0).toUpperCase();
    container.appendChild(placeholder);
}

// ==================== DRAG & DROP ====================

function handleDragStart(e) {
    draggedItem = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    draggedItem = null;
    document.querySelectorAll('.symbol-cell').forEach(function(cell) {
        cell.classList.remove('drag-over');
    });
}

function handleDragOver(e) {
    if (e.preventDefault) e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (this !== draggedItem) {
        this.classList.add('drag-over');
    }
    return false;
}

function handleDrop(e) {
    if (e.stopPropagation) e.stopPropagation();
    if (draggedItem !== this) {
        var fromIndex = parseInt(draggedItem.dataset.index);
        var toIndex = parseInt(this.dataset.index);
        var item = symbols.splice(fromIndex, 1)[0];
        symbols.splice(toIndex, 0, item);
        saveSymbolsForCurrentView();
        renderGrid();
    }
    return false;
}

// ==================== PASTE INTO ILLUSTRATOR ====================

function pasteSymbol(index) {
    var symbol = symbols[index];
    var cell = document.querySelector('.symbol-cell[data-index="' + index + '"]');
    if (!symbol || !cell) return;

    cell.classList.add('processing');

    var script = 'pasteFromFile("' + escapePath(symbol.svgPath) + '");';

    csInterface.evalScript(script, function(result) {
        cell.classList.remove('processing');
        if (result && result.toString().indexOf('Error:') === 0) {
            showErrorModal(result);
        } else if (result === 'false' || result === false) {
            showErrorModal('Failed to paste symbol. Check that the SVG file exists and is valid.');
        }
    });
}

// ==================== EDIT MODE ====================

function toggleEditMode() {
    isEditMode = !isEditMode;
    var btn = document.getElementById('editModeBtn');
    var container = document.getElementById('symbolGrid');

    if (isEditMode) {
        btn.classList.add('active');
        btn.textContent = 'Done';
        container.classList.add('editing');
    } else {
        btn.classList.remove('active');
        btn.textContent = 'Edit';
        container.classList.remove('editing');
    }

    renderGrid();
}

// ==================== EVENT LISTENERS ====================

function setupEventListeners() {
    // Settings button
    document.getElementById('settingsBtn').addEventListener('click', showSettingsModal);

    // Refresh button
    document.getElementById('refreshBtn').addEventListener('click', function() {
        refreshSymbols();
        checkActiveDocument();
    });

    // Ayah Number button
    document.getElementById('ayahNumberBtn').addEventListener('click', showNumberModal);

    // Import All Numbers button
    document.getElementById('importAllBtn').addEventListener('click', importAllNumbers);

    // Category selector
    document.getElementById('categorySelect').addEventListener('change', function(e) {
        symbolCategory = e.target.value;
        saveState();
        updateFolderDisplay();
        loadSymbolsForCurrentView();
    });

    // Info button
    document.getElementById('infoBtn').addEventListener('click', showInfoModal);

    // Select Folder button
    document.getElementById('selectFolderBtn').addEventListener('click', showFolderModal);

    // Folder Modal
    document.getElementById('folderCancelBtn').addEventListener('click', hideFolderModal);
    document.getElementById('folderConfirmBtn').addEventListener('click', loadSymbolsFromRootFolder);
    document.getElementById('browseFolderBtn').addEventListener('click', browseForFolder);

    // Auto-Detect button
    document.getElementById('autoDetectBtn').addEventListener('click', function() {
        var btn = document.getElementById('autoDetectBtn');
        var statusEl = document.getElementById('autoDetectStatus');
        var iconEl = document.getElementById('driveStatusIcon');
        if (iconEl) iconEl.style.display = 'none';
        btn.disabled = true;
        statusEl.textContent = 'Scanning drives...';
        statusEl.style.color = 'var(--text-muted)';

        setTimeout(function() {
            var result = autoDetectFromDrive();
            if (result) {
                document.getElementById('folderPathInput').value = result.rootFolder;
                scanRootFolderForPreview(result.rootFolder);
                statusEl.textContent = 'Found: ' + result.rootFolder + ' (' + result.source + ')';
                statusEl.style.color = 'var(--accent-green)';
                // Auto-load after a brief delay so user sees the preview
                setTimeout(function() {
                    loadSymbolsFromRootFolder();
                }, 300);
            } else {
                statusEl.textContent = 'Could not auto-detect. Try Test & Use below, or Browse manually.';
                statusEl.style.color = 'var(--accent-orange)';
                if (iconEl) iconEl.style.display = 'flex';
                btn.disabled = false;
            }
        }, 100);
    });

    // Test Path button
    document.getElementById('testPathBtn').addEventListener('click', function() {
        var input = document.getElementById('testPathInput');
        var statusEl = document.getElementById('testPathStatus');
        var path = input.value.trim();
        if (!path) {
            statusEl.textContent = 'Please enter a path first.';
            statusEl.style.color = 'var(--accent-orange)';
            return;
        }
        statusEl.textContent = 'Testing...';
        statusEl.style.color = 'var(--text-muted)';
        setTimeout(function() {
            var result = testPathAndUse(path);
            if (result.success) {
                statusEl.textContent = 'Success! ' + (result.structure === 'nested' ? 'Nested' : 'Flat') + ' structure loaded from: ' + result.path;
                statusEl.style.color = 'var(--accent-green)';
            } else {
                statusEl.textContent = 'No valid structure found. Flat symbols:' + result.flatSym + ' numbers:' + result.flatNum +
                    ' | Nested symbols/symbols:' + result.nestSym + ' symbols/numbers:' + result.nestNum;
                statusEl.style.color = 'var(--accent-orange)';
            }
        }, 100);
    });
    document.getElementById('testPathInput').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            document.getElementById('testPathBtn').click();
        }
    });

    // Update buttons
    var btnCheckUpdates = document.getElementById('btnCheckUpdates');
    var btnInstallUpdate = document.getElementById('btnInstallUpdate');
    var updateStatusEl = document.getElementById('updateStatus');
    if (btnCheckUpdates) {
        btnCheckUpdates.addEventListener('click', function() {
            if (!window.SymbolUpdater) {
                if (updateStatusEl) updateStatusEl.textContent = 'Updater not loaded.';
                return;
            }
            if (updateStatusEl) updateStatusEl.textContent = 'Checking...';
            btnCheckUpdates.disabled = true;
            window.SymbolUpdater.checkForUpdates().then(function(result) {
                btnCheckUpdates.disabled = false;
                if (result.hasUpdate) {
                    if (updateStatusEl) updateStatusEl.textContent = 'v' + result.remoteVersion + ' available';
                    if (btnInstallUpdate) btnInstallUpdate.classList.remove('hidden');
                } else if (result.error) {
                    if (updateStatusEl) updateStatusEl.textContent = 'Error: ' + result.error;
                } else {
                    if (updateStatusEl) updateStatusEl.textContent = 'Latest (v' + result.currentVersion + ')';
                    if (btnInstallUpdate) btnInstallUpdate.classList.add('hidden');
                }
            });
        });
    }
    if (btnInstallUpdate) {
        btnInstallUpdate.addEventListener('click', function() {
            if (!window.SymbolUpdater) return;
            if (updateStatusEl) updateStatusEl.textContent = 'Installing...';
            btnInstallUpdate.disabled = true;
            window.SymbolUpdater.installUpdate(function(progress) {
                if (updateStatusEl) updateStatusEl.textContent = progress.percent + '%';
            }).then(function(result) {
                if (updateStatusEl) updateStatusEl.textContent = 'Done! Restart Illustrator.';
                btnInstallUpdate.disabled = false;
            }).catch(function(err) {
                if (updateStatusEl) updateStatusEl.textContent = 'Failed: ' + err.message;
                btnInstallUpdate.disabled = false;
            });
        });
    }

    var btnInstallToolShed = document.getElementById('btnInstallToolShed');
    if (btnInstallToolShed) {
        btnInstallToolShed.addEventListener('click', installToolShedPlugin);
    }

    // Edit Modal
    document.getElementById('editCancelBtn').addEventListener('click', hideEditModal);
    document.getElementById('editConfirmBtn').addEventListener('click', saveEditSymbol);
    document.getElementById('editDeleteBtn').addEventListener('click', deleteSymbol);
    document.getElementById('editBrowseBtn').addEventListener('click', function() {
        browseForFile('editSymbolPath', '.svg');
    });

    // Number Modal
    document.getElementById('numberCancelBtn').addEventListener('click', hideNumberModal);
    document.getElementById('numberConfirmBtn').addEventListener('click', insertNumber);
    document.getElementById('numberInput').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') insertNumber();
    });

    // Settings Modal
    document.getElementById('settingsCancelBtn').addEventListener('click', hideSettingsModal);
    document.getElementById('settingsConfirmBtn').addEventListener('click', saveSettingsFromModal);
    document.getElementById('settingsResetBtn').addEventListener('click', resetSettingsToDefaults);

    // Layer Button Modal
    document.getElementById('layerButtonCancelBtn').addEventListener('click', hideLayerButtonModal);
    document.getElementById('layerButtonConfirmBtn').addEventListener('click', addLayerButton);
    document.getElementById('layerButtonInput').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') addLayerButton();
    });

    // Add Layer Button opener
    document.getElementById('addLayerBtn').addEventListener('click', showLayerButtonModal);

    // Refresh Layers button
    document.getElementById('refreshLayersBtn').addEventListener('click', scanDocumentLayers);

    // Close modals on background click
    document.querySelectorAll('.modal').forEach(function(modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                if (this.id === 'folderModal') hideFolderModal();
                if (this.id === 'editModal') hideEditModal();
                if (this.id === 'numberModal') hideNumberModal();
                if (this.id === 'settingsModal') hideSettingsModal();
                if (this.id === 'layerButtonModal') hideLayerButtonModal();
            }
        });
    });
}

// ==================== FOLDER SELECTION ====================

function showFolderModal() {
    document.getElementById('folderModal').classList.add('active');
    document.getElementById('folderPathInput').value = rootFolder || '';
    scanRootFolderForPreview(rootFolder);
}

function hideFolderModal() {
    document.getElementById('folderModal').classList.remove('active');
}

function browseForFolder() {
    var result = window.cep.fs.showOpenDialog(
        false,
        true,
        "Select Root Folder",
        "",
        [],
        ""
    );

    if (result.err === 0 && result.data.length > 0) {
        var path = result.data[0].replace(/\\/g, '/');
        document.getElementById('folderPathInput').value = path;
        scanRootFolderForPreview(path);
    }
}

function scanRootFolderForPreview(path) {
    previewData = { symbols: [], numbers: 0 };

    if (!path) {
        updateFolderPreview();
        return;
    }

    // Scan symbols subfolders
    var symbolsPath = path + '/symbols';
    var symResult = window.cep.fs.readdir(symbolsPath);
    if (symResult.err === 0) {
        symResult.data.forEach(function(item) {
            if (item.startsWith('.') || item === 'desktop.ini' || item === 'Thumbs.db') return;
            
            var itemPath = symbolsPath + '/' + item;
            if (isDirectory(itemPath)) {
                var catResult = window.cep.fs.readdir(itemPath);
                var count = 0;
                if (catResult.err === 0) {
                    catResult.data.forEach(function(f) {
                        if (f.startsWith('.') || f === 'desktop.ini' || f === 'Thumbs.db') return;
                        if (isSvgFile(f)) count++;
                    });
                }
                previewData.symbols.push({ name: item, count: count });
            }
        });
    }

    // Scan numbers folder
    var numbersPath = path + '/numbers';
    var numResult = window.cep.fs.readdir(numbersPath);
    if (numResult.err === 0) {
        numResult.data.forEach(function(f) {
            if (f.startsWith('.') || f === 'desktop.ini' || f === 'Thumbs.db') return;
            if (isSvgFile(f)) previewData.numbers++;
        });
    }

    updateFolderPreview();
}

function updateFolderPreview() {
    var previewContent = document.getElementById('previewContent');
    var confirmBtn = document.getElementById('folderConfirmBtn');

    if (previewData.symbols.length === 0 && previewData.numbers === 0) {
        previewContent.innerHTML = '<span class="preview-empty">No valid symbol structure found.<br>Expected: symbols/ and numbers/ subfolders with SVG files.</span>';
        confirmBtn.disabled = true;
        return;
    }

    var html = '';

    // Show detected settings (mushaftasks) folder
    var settingsFolder = deriveSettingsFolder();
    if (settingsFolder) {
        var tasksExists = pathExists(settingsFolder);
        html += '<div class="preview-header">Settings Folder:</div>';
        html += '<div class="preview-item" style="font-size:11px;color:' + (tasksExists ? 'var(--accent-green)' : 'var(--text-muted)') + '">';
        html += settingsFolder + (tasksExists ? ' ✓' : ' (will be created)');
        html += '</div>';
        html += '<div style="margin-top:8px"></div>';
    }

    if (previewData.symbols.length > 0) {
        html += '<div class="preview-header">Symbols Categories:</div>';
        previewData.symbols.forEach(function(cat) {
            html += '<div class="preview-item">' + cat.name + ' <span style="color:var(--text-muted)">(' + cat.count + ' SVGs)</span></div>';
        });
    }

    if (previewData.numbers > 0) {
        if (previewData.symbols.length > 0) html += '<div style="margin-top:8px"></div>';
        html += '<div class="preview-header">Numbers:</div>';
        html += '<div class="preview-item">' + previewData.numbers + ' SVG files found</div>';
    }

    previewContent.innerHTML = html;
    confirmBtn.disabled = false;
}

function loadSymbolsFromRootFolder() {
    var folderPath = document.getElementById('folderPathInput').value.trim();

    if (!folderPath) {
        showErrorModal('Please select a folder first.');
        return;
    }

    if (previewData.symbols.length === 0 && previewData.numbers === 0) {
        showErrorModal('No symbols or numbers found in the selected folder structure.');
        return;
    }

    document.getElementById('loadingOverlay').classList.add('active');
    hideFolderModal();

    rootFolder = folderPath;

    // Ensure mushaftasks structure exists
    ensureLayerColorsFile();

    // Reset category if not valid
    scanCategories();
    if (scannedCategories.indexOf(symbolCategory) === -1) {
        symbolCategory = scannedCategories.length > 0 ? scannedCategories[0] : '';
    }

    saveState();
    updateCategorySelect();
    updateFolderDisplay();
    loadSymbolsForCurrentView();

    // Re-render number grid if a page is detected
    if (currentPageInfo.detected) {
        renderNumberGrid();
    }

    setTimeout(function() {
        document.getElementById('loadingOverlay').classList.remove('active');
    }, 300);
}

// ==================== EDIT SYMBOL ====================

function showEditModal(index) {
    editingIndex = index;
    var symbol = symbols[index];
    if (!symbol) return;

    document.getElementById('editSymbolName').value = symbol.name;
    document.getElementById('editSymbolPath').value = symbol.svgPath || '';
    document.getElementById('editModal').classList.add('active');
}

function hideEditModal() {
    document.getElementById('editModal').classList.remove('active');
    editingIndex = -1;
}

function saveEditSymbol() {
    if (editingIndex < 0 || editingIndex >= symbols.length) return;

    var name = document.getElementById('editSymbolName').value.trim();
    var svgPath = document.getElementById('editSymbolPath').value.trim();

    if (!name || !svgPath) {
        showErrorModal('Please fill in all required fields.');
        return;
    }

    symbols[editingIndex] = {
        name: name,
        svgPath: svgPath
    };

    saveSymbolsForCurrentView();
    renderGrid();
    hideEditModal();
}

function deleteSymbol() {
    if (editingIndex < 0 || editingIndex >= symbols.length) return;

    showConfirmModal(
        'Are you sure you want to remove this symbol from the palette?',
        'Remove Symbol?',
        function() {
            symbols.splice(editingIndex, 1);
            saveSymbolsForCurrentView();
            renderGrid();
            hideEditModal();
        }
    );
}

// ==================== NUMBER INSERTION ====================

function showNumberModal() {
    document.getElementById('numberModal').classList.add('active');
    document.getElementById('numberInput').value = '';
    setTimeout(function() {
        document.getElementById('numberInput').focus();
    }, 100);
}

function hideNumberModal() {
    document.getElementById('numberModal').classList.remove('active');
}

function showErrorModal(message, title) {
    var modal = document.getElementById('errorModal');
    var msgEl = document.getElementById('errorModalMessage');
    var titleEl = document.getElementById('errorModalTitle');
    var iconDefault = document.getElementById('errorIconDefault');
    var iconAdd = document.getElementById('errorIconAdd');
    var iconRemove = document.getElementById('errorIconRemove');

    if (titleEl) titleEl.textContent = title || 'Error';
    if (msgEl) msgEl.textContent = message || '';

    // Show appropriate icon based on error message
    var msgStr = (message || '').toString();
    if (iconDefault) iconDefault.style.display = 'none';
    if (iconAdd) iconAdd.style.display = 'none';
    if (iconRemove) iconRemove.style.display = 'none';

    if (msgStr.indexOf('Add') !== -1 && iconAdd) {
        iconAdd.style.display = 'flex';
    } else if (msgStr.indexOf('Remove') !== -1 && iconRemove) {
        iconRemove.style.display = 'flex';
    } else if (iconDefault) {
        iconDefault.style.display = 'flex';
    }

    if (modal) modal.classList.add('active');

    var okBtn = document.getElementById('errorModalOk');
    if (okBtn) {
        var newOk = okBtn.cloneNode(true);
        okBtn.parentNode.replaceChild(newOk, okBtn);
        newOk.addEventListener('click', function() {
            if (modal) modal.classList.remove('active');
        });
    }
}

function hideErrorModal() {
    document.getElementById('errorModal').classList.remove('active');
}

// Custom confirm modal (replaces native confirm() with themed UI)
var _confirmCallback = null;
function installToolShedPlugin() {
    try {
        var fs = require('fs');
        var path = require('path');
        var home = getHomeDir();
        if (!home) {
            showErrorModal('Could not determine user home directory.');
            return;
        }
        var destDir = path.join(home, 'AppData', 'Roaming', 'Adobe', 'CEP', 'plug-ins');
        var srcFile = path.join(home, 'AppData', 'Roaming', 'Adobe', 'CEP', 'extensions', 'symbolPalette', 'ToolShed.aip');
        var destFile = path.join(destDir, 'ToolShed.aip');

        // Check source file exists
        if (!fs.existsSync(srcFile)) {
            showErrorModal('ToolShed.aip not found in extension folder.');
            return;
        }

        // Create plug-ins directory if it doesn't exist
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }

        var alreadyThere = fs.existsSync(destFile);

        // Only copy if not already there (avoids EBUSY on loaded plugin)
        if (!alreadyThere) {
            fs.copyFileSync(srcFile, destFile);
        }

        // Show instructions
        showConfirmModal(
            'ToolShed is ready.\n\n' +
            'Go to Edit → Preferences → Plug-ins & Scratch Disks\n' +
            '1. Check "Additional Plug-ins Folder"\n' +
            '2. Click "Choose" and paste this path:\n\n' +
            '%appdata%\\Adobe\\CEP\\plug-ins\n\n' +
            '3. Click OK and restart Illustrator.',
            'ToolShed Ready',
            function() {}
        );
    } catch (e) {
        showErrorModal('Failed to install ToolShed: ' + e.message);
    }
}

function showConfirmModal(message, title, onOk, onCancel) {
    var modal = document.getElementById('confirmModal');
    var msgEl = document.getElementById('confirmModalMessage');
    var titleEl = document.getElementById('confirmModalTitle');
    if (titleEl) titleEl.textContent = title || 'Confirm';
    if (msgEl) {
        msgEl.innerHTML = '';
        var lines = (message || '').split('\n');
        lines.forEach(function(line, i) {
            if (i > 0) msgEl.appendChild(document.createElement('br'));
            msgEl.appendChild(document.createTextNode(line));
        });
    }

    var okBtn = document.getElementById('confirmModalOk');
    var cancelBtn = document.getElementById('confirmModalCancel');

    if (okBtn) {
        var newOk = okBtn.cloneNode(true);
        okBtn.parentNode.replaceChild(newOk, okBtn);
        newOk.addEventListener('click', function() {
            if (modal) modal.classList.remove('active');
            if (onOk) onOk();
        });
    }
    if (cancelBtn) {
        var newCancel = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
        newCancel.addEventListener('click', function() {
            if (modal) modal.classList.remove('active');
            if (onCancel) onCancel();
        });
    }

    if (modal) modal.classList.add('active');
}

function showInfoModal() {
    var modal = document.getElementById('infoModal');
    if (modal) modal.classList.add('active');

    var okBtn = document.getElementById('infoModalOk');
    if (okBtn) {
        var newOk = okBtn.cloneNode(true);
        okBtn.parentNode.replaceChild(newOk, okBtn);
        newOk.addEventListener('click', function() {
            if (modal) modal.classList.remove('active');
        });
    }
}

function hideInfoModal() {
    document.getElementById('infoModal').classList.remove('active');
}

function showDriveMissingModal(missingPath) {
    var modal = document.getElementById('driveMissingModal');
    var pathEl = document.getElementById('driveMissingPath');
    if (pathEl) pathEl.textContent = missingPath || '';
    if (modal) modal.classList.add('active');

    var retryBtn = document.getElementById('retryDriveBtn');
    if (retryBtn) {
        var newRetry = retryBtn.cloneNode(true);
        retryBtn.parentNode.replaceChild(newRetry, retryBtn);
        newRetry.addEventListener('click', function() {
            location.reload();
        });
    }

    var scanBtn = document.getElementById('scanDrivesBtn');
    if (scanBtn) {
        var newScan = scanBtn.cloneNode(true);
        scanBtn.parentNode.replaceChild(newScan, scanBtn);
        newScan.addEventListener('click', function() {
            var result = autoDetectFromDrive();
            if (result) {
                location.reload();
            } else {
                var statusEl = document.getElementById('autoDetectStatus');
                if (statusEl) {
                    statusEl.textContent = 'Could not auto-detect. Try Test & Use below, or Browse manually.';
                    statusEl.style.color = 'var(--accent-orange)';
                }
            }
        });
    }

    var changeBtn = document.getElementById('changeDriveBtn');
    if (changeBtn) {
        var newChange = changeBtn.cloneNode(true);
        changeBtn.parentNode.replaceChild(newChange, changeBtn);
        newChange.addEventListener('click', function() {
            if (modal) modal.classList.remove('active');
            showFolderModal();
        });
    }
}

function insertNumber() {
    var num = document.getElementById('numberInput').value.trim();
    if (!num) return;

    if (!rootFolder) {
        showErrorModal('Please select a root folder first.');
        return;
    }

    var filePath = rootFolder + '/numbers/' + num + '.svg';
    var stat = window.cep.fs.stat(filePath);
    if (stat.err !== 0) {
        showErrorModal('Number file not found: ' + num + '.svg\n\nMake sure the file exists in the numbers folder.');
        return;
    }

    hideNumberModal();

    var script = 'pasteFromFile("' + escapePath(filePath) + '");';
    csInterface.evalScript(script, function(result) {
        if (result && result.toString().indexOf('Error:') === 0) {
            showErrorModal(result);
        } else if (result === 'false' || result === false) {
            showErrorModal('Failed to paste number. Check that the SVG file is valid.');
        }
    });
}

// ==================== TEMPORARY: RENAME NUMBER SVGs ====================

// ==================== UTILITIES ====================

function browseForFile(inputId, fileType) {
    var desc = 'SVG Files (*.svg)';
    var types = ['.svg'];

    var result = window.cep.fs.showOpenDialog(
        false,
        false,
        "Select SVG File",
        "",
        types,
        desc
    );

    if (result.err === 0 && result.data.length > 0) {
        var path = result.data[0].replace(/\\/g, '/');
        document.getElementById(inputId).value = path;
    }
}

function escapePath(path) {
    return path.replace(/\\/g, '\\\\');
}


// ==================== LAYER TOOLS ====================

var LAYER_BUTTONS_KEY = 'symbolPalette_layerButtons_v1';
var DEFAULT_LAYER_BUTTONS = ['Iskan Haa', 'Meem Sila'];

function getSharedLayerButtonsPath() {
    var settingsFolder = deriveSettingsFolder();
    if (!settingsFolder) return null;
    return settingsFolder.replace(/\\/g, '/') + '/symbolPalette_layerButtons.json';
}

function getLayerColorsPath() {
    var settingsFolder = deriveSettingsFolder();
    if (!settingsFolder) return '';
    return settingsFolder.replace(/\\/g, '/') + '/layers/layerColors.json';
}

function getLayerButtons() {
    var buttons = null;
    var source = 'default';

    // Try shared path first (cross-device sync via mushaftasks)
    try {
        var sharedPath = getSharedLayerButtonsPath();
        if (sharedPath) {
            var result = window.cep.fs.readFile(sharedPath, 'utf-8');
            if (result.err === 0 && result.data) {
                var data = JSON.parse(result.data);
                if (Array.isArray(data.buttons)) {
                    buttons = data.buttons;
                    source = 'shared';
                }
            }
        }
    } catch (e) {
    // Could not load layer buttons from shared path
    }

    if (!buttons) {
        // No shared file yet — create it with defaults
        var defaults = DEFAULT_LAYER_BUTTONS.slice();
        saveLayerButtons(defaults);
        return defaults;
    }

    // Correct known typos / old names
    var corrected = [];
    var changed = false;
    for (var i = 0; i < buttons.length; i++) {
        var name = buttons[i];
        if (name === 'Iskan Ha' || name === 'Iskaan Ha' || name === 'Iskaan Haa') {
            name = 'Iskan Haa';
            changed = true;
        }
        corrected.push(name);
    }

    // Filter out deprecated buttons
    var cleaned = [];
    var removed = false;
    var deprecated = ['Sukoon', 'Shadda'];
    for (var i = 0; i < corrected.length; i++) {
        if (deprecated.indexOf(corrected[i]) === -1) {
            cleaned.push(corrected[i]);
        } else {
            removed = true;
        }
    }

    // Save back if corrected or cleaned
    if ((changed || removed) && cleaned.length > 0) {
        saveLayerButtons(cleaned);
    }

    return cleaned.length > 0 ? cleaned : DEFAULT_LAYER_BUTTONS.slice();
}

function saveLayerButtons(buttons) {
    // Save only to shared path (drive folder) — no localStorage fallback
    try {
        var sharedPath = getSharedLayerButtonsPath();
        if (!sharedPath) return;
        var dir = sharedPath.replace(/\\/g, '/').replace(/\/[^\/]+$/, '');
        var dirStat = window.cep.fs.readdir(dir);
        if (dirStat.err !== 0) {
            var makeResult = window.cep.fs.makedir(dir);
            if (makeResult.err !== 0) {
                throw new Error('Could not create directory');
            }
        }
        var result = window.cep.fs.writeFile(sharedPath, JSON.stringify({ buttons: buttons }, null, 2), 'utf-8');
        if (result.err === 0) {
    // Layer buttons saved
            return;
        }
        // Fallback: Node.js fs for permission issues on Google Drive
        if (result.err === 5 && typeof require !== 'undefined') {
            try {
                var fs = require('fs');
                fs.writeFileSync(sharedPath, JSON.stringify({ buttons: buttons }, null, 2), 'utf-8');
    // Layer buttons saved via Node.js
                return;
            } catch (nodeErr) {
                console.log('Node.js fallback failed:', nodeErr.message);
            }
        }
    } catch (e) {
    // Could not save layer buttons to shared path
    }
}

function renderLayerButtons() {
    var container = document.getElementById('layerToolsButtons');
    if (!container) return;
    container.innerHTML = '';

    // Ensure layerColors.json exists once per session
    if (!window._layerColorsEnsured) {
        window._layerColorsEnsured = true;
        ensureLayerColorsFile();
    }

    var buttons = getLayerButtons();
    buttons.forEach(function(name) {
        var btn = document.createElement('button');
        btn.className = 'btn-layer-tool';
        btn.title = 'Move selection to "' + name + '" layer';
        btn.addEventListener('click', function() {
            moveSelectionToLayer(name);
        });

        // Colored dot from layerColors.json
        var dot = document.createElement('span');
        dot.style.display = 'inline-block';
        dot.style.width = '8px';
        dot.style.height = '8px';
        dot.style.borderRadius = '50%';
        dot.style.marginRight = '8px';
        dot.style.flexShrink = '0';
        var rgb = spGetLayerColorForName(name);
        if (rgb) {
            dot.style.background = 'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')';
        } else {
            dot.style.background = '#888';
        }
        btn.appendChild(dot);

        var text = document.createElement('span');
        text.textContent = name;
        btn.appendChild(text);

        container.appendChild(btn);
    });
}

function spGetLayerColorForName(layerName) {
    var colorsPath = getLayerColorsPath();
    if (!colorsPath) return null;

    var jsonStr = null;

    // Try CEP fs first
    try {
        var result = window.cep.fs.readFile(colorsPath, 'utf-8');
        if (result.err === 0 && result.data) {
            jsonStr = result.data;
        }
    } catch (e) {}

    // Fallback: Node.js fs (for Google Drive permission issues)
    if (!jsonStr && typeof require !== 'undefined') {
        try {
            var fs = require('fs');
            jsonStr = fs.readFileSync(colorsPath, 'utf-8');
        } catch (e) {}
    }

    if (!jsonStr) return null;

    try {
        var config = JSON.parse(jsonStr);
        if (config[layerName]) return config[layerName];
        if (config.default) return config.default;
    } catch (e) {}
    return null;
}

var _hostScriptLoaded = false;
function getHostScriptPath() {
    try {
        var href = window.location.href;
        href = href.replace(/^file:\/+/, '').replace(/^\//, '').replace(/\\/g, '/');
        href = href.replace(/\/index\.html.*$/, '');
        return href + '/jsx/host.jsx';
    } catch (e) {
        return '';
    }
}
function ensureHostScript(callback) {
    if (_hostScriptLoaded) {
        if (callback) callback();
        return;
    }
    var scriptPath = getHostScriptPath();
    if (!scriptPath) {
        console.error('Cannot find host.jsx path');
        if (callback) callback();
        return;
    }
    var escapedPath = scriptPath.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    csInterface.evalScript('$.evalFile("' + escapedPath + '")', function(result) {
        if (result && result.indexOf('Error') !== -1) {
            console.error('Failed to load host.jsx:', result);
            if (callback) callback();
            return;
        }
        _hostScriptLoaded = true;
        if (callback) callback();
    });
}

function moveSelectionToLayer(layerName) {
    if (!layerName) return;
    var layerNameEscaped = layerName.replace(/"/g, '\\"');

    // Get extension path once for both create and move paths
    var extPath = '';
    try {
        var systemPathType = (csInterface.SystemPath && csInterface.SystemPath.EXTENSION) ? csInterface.SystemPath.EXTENSION : "extension";
        extPath = csInterface.getSystemPath(systemPathType).replace(/\\/g, '/');
    } catch (e) {
    // Could not get extension path
    }
    var extPathEscaped = extPath.replace(/"/g, '\\"');
    var layerColorsPath = getLayerColorsPath().replace(/"/g, '\\"');

    csInterface.evalScript('app.activeDocument.selection.length > 0 ? "HAS_SELECTION" : "NO_SELECTION"', function(selResult) {
        if (selResult === 'NO_SELECTION') {
            // No selection — create the layer with color
            csInterface.evalScript('spCreateLayer("' + layerNameEscaped + '", "' + extPathEscaped + '", "' + layerColorsPath + '")', function(createResult) {
                if (createResult && createResult.toString().indexOf('Error:') === 0) {
                    showErrorModal(createResult);
                } else {
                    scanDocumentLayers();
                }
            });
            return;
        }

        // Has selection — move it
        csInterface.evalScript('spMoveSelectionToLayer("' + layerNameEscaped + '", "' + extPathEscaped + '", "' + layerColorsPath + '")', function(result) {
            if (result && result.toString().indexOf('Error:') === 0) {
                showErrorModal(result);
            } else if (result === 'success') {
                scanDocumentLayers();
            }
        });
    });
}

function scanDocumentLayers() {
    var container = document.getElementById('layerList');
    if (!container) return;

    // Step 1: verify evalScript works and a document is actually open
    csInterface.evalScript('app.documents.length > 0 ? app.activeDocument.name : "NO_DOC"', function(docResult) {
    // scanDocumentLayers doc check
        if (!docResult || docResult === 'NO_DOC' || docResult === 'null' || docResult === 'undefined') {
            container.innerHTML = '<div class="empty-message">No document open</div>';
            return;
        }

        // Step 2: scan layers (manual JSON — no JSON.stringify needed)
        var script = '(function(){' +
            'var defs={quranText:{s:"Quran Text",p:["qurantext","quran"]},ayaNo:{s:"Aya No.",p:["ayano","ayahno","ayano.","ayahno.","aya.no","ayah.no","aya no","ayah no"]},ornaments:{s:"Ornaments",p:["ornament","zakhrafah","zakhrafa","decoration","decorations"]},header:{s:"Header & Marks & Page No.",p:["header","marks","pageno"]}};' +
            'function nm(n){if(!n)return"";return n.toString().replace(/^\\s+|\\s+$/g,"").toLowerCase().replace(/[_\\-\\.]/g,"").replace(/\\s+/g,"");}' +
            'function mt(n){var nd=nm(n);if(!nd)return null;for(var k in defs){if(!defs.hasOwnProperty(k))continue;var d=defs[k];var sn=nm(d.s);if(nd===sn)return d.s;for(var p=0;p<d.p.length;p++){if(nd.indexOf(d.p[p])!==-1)return d.s;}}return null;}' +
            'function esc(s){if(!s)return"";return s.replace(/\\\\/g,"\\\\\\\\").replace(/"/g,\'\\\\"\').replace(/\\n/g,"\\\\n").replace(/\\r/g,"\\\\r");}' +
            'var layers=[];' +
            'try{' +
                'var doc=app.activeDocument;' +
                'for(var i=0;i<doc.layers.length;i++){' +
                    'var ly=doc.layers[i];' +
                    'var m=mt(ly.name);' +
                    'layers.push("{\\"name\\":\\""+esc(ly.name)+"\\",\\"matched\\":"+(m?"\\""+esc(m)+"\\"":"null")+",\\"standard\\":\\""+esc(m||"\u2014")+"\\"}");' +
                '}' +
                'return "{\\"success\\":true,\\"layers\\":["+layers.join(",")+"],\\"error\\":\\"\\"}";' +
            '}catch(e){' +
                'return "{\\"success\\":false,\\"layers\\":[],\\"error\\":\\""+esc(e.toString())+"\\"}";' +
            '}' +
        '})()';

        csInterface.evalScript(script, function(result) {
    // scanDocumentLayers raw result
            try {
                var data = JSON.parse(result);
                if (data.success && data.layers) {
                    renderLayerList(data.layers);
                } else {
                    container.innerHTML = '<div class="empty-message">' + (data.error || 'No layers found') + '</div>';
                }
            } catch (e) {
                container.innerHTML = '<div class="empty-message" style="font-size:10px;word-break:break-all;">Debug: ' + escapeHtml(e.message) + '<br>Raw: ' + escapeHtml(String(result).slice(0,300)) + '</div>';
            }
        });
    });
}

function renderLayerList(layers) {
    var container = document.getElementById('layerList');
    if (!container) return;
    container.innerHTML = '';
    if (!layers || layers.length === 0) {
        container.innerHTML = '<div class="empty-message">No layers</div>';
        return;
    }
    layers.forEach(function(layer) {
        var isMatched = !!layer.matched;
        var isPotential = !!layer.potential;
        var needsRename = isMatched && layer.name !== layer.matched;
        var itemClass = isMatched && !needsRename ? 'layer-item matched' : (isPotential || needsRename ? 'layer-item potential' : 'layer-item unmatched');
        var badgeClass = isMatched && !needsRename ? 'layer-badge matched' : (isPotential || needsRename ? 'layer-badge potential' : 'layer-badge unmatched');
        var badgeText = isMatched && !needsRename ? layer.standard : (isPotential ? 'Similar' : (needsRename ? 'Similar' : 'Unmatched'));
        var nameColor = isMatched && !needsRename ? 'var(--accent-green)' : (isPotential || needsRename ? 'var(--accent-purple)' : 'var(--accent-orange)');
        var deleteBtn = (isMatched && !needsRename) ? '' : '<button class="layer-delete-btn" data-layer-name="' + escapeHtml(layer.name) + '" title="Delete layer">&times;</button>';
        var renameBtn = '';
        if (needsRename) {
            renameBtn = '<button class="layer-rename-btn" data-layer-name="' + escapeHtml(layer.name) + '" data-target-name="' + escapeHtml(layer.matched) + '" title="Rename to ' + escapeHtml(layer.matched) + '">' +
                        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg> Make Match' +
                        '</button>';
        }

        var row = document.createElement('div');
        row.className = itemClass;
        row.innerHTML = '<span class="layer-name" style="color:' + nameColor + ';">' + escapeHtml(layer.name) + '</span>' +
                        '<span style="display:flex;align-items:center;justify-content:flex-end;gap:6px;width:100%;">' +
                        '<span class="layer-badge ' + badgeClass + '">' + badgeText + '</span>' +
                        renameBtn +
                        deleteBtn +
                        '</span>';
        container.appendChild(row);

        // For potential layers, add a second row with rename option
        if (isPotential) {
            var hintRow = document.createElement('div');
            hintRow.className = 'layer-item potential-hint';
            hintRow.style.padding = '2px 8px 6px 8px';
            hintRow.style.background = 'transparent';
            hintRow.style.borderLeft = '3px solid var(--accent-purple)';
            hintRow.style.marginBottom = '2px';
            hintRow.style.fontSize = '10px';
            hintRow.style.color = 'var(--text-muted)';
            hintRow.style.display = 'flex';
            hintRow.style.alignItems = 'center';
            hintRow.style.justifyContent = 'space-between';
            hintRow.innerHTML = '<span>Should be "' + escapeHtml(layer.potential) + '"</span>' +
                                '<button class="layer-rename-btn" data-layer-name="' + escapeHtml(layer.name) + '" data-target-name="' + escapeHtml(layer.potential) + '" title="Rename to ' + escapeHtml(layer.potential) + '">' +
                                '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg> Make Match' +
                                '</button>';
            container.appendChild(hintRow);
        }
    });

    // Attach rename handlers via event delegation
    container.querySelectorAll('.layer-rename-btn').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            var layerName = btn.getAttribute('data-layer-name');
            var targetName = btn.getAttribute('data-target-name');
            if (layerName && targetName) {
                renamePotentialLayer(layerName, targetName);
            }
        });
    });

    // Attach delete handlers via event delegation
    container.querySelectorAll('.layer-delete-btn').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            var layerName = btn.getAttribute('data-layer-name');
            if (layerName) {
                showConfirmModal('Delete layer "' + layerName + '"?', 'Delete Layer?', function() {
                    deleteDocumentLayer(layerName);
                });
            }
        });
    });
}

function renamePotentialLayer(layerName, newName) {
    csInterface.evalScript('spRenameLayerByName("' + layerName.replace(/"/g, '\\"') + '","' + newName.replace(/"/g, '\\"') + '")', function(result) {
        try {
            var data = JSON.parse(result);
            if (data.success) {
                scanDocumentLayers();
            } else {
                showErrorModal(data.error || 'Rename failed');
            }
        } catch (e) {
            showErrorModal('Error renaming layer');
        }
    });
}

function deleteDocumentLayer(layerName) {
    csInterface.evalScript('spDeleteLayer("' + layerName.replace(/"/g, '\\"') + '")', function(result) {
        try {
            var data = JSON.parse(result);
            if (data.success) {
                scanDocumentLayers();
            } else {
                showErrorModal(data.error || 'Delete failed');
            }
        } catch (e) {
            showErrorModal('Error deleting layer');
        }
    });
}

function showLayerButtonModal() {
    document.getElementById('layerButtonModal').classList.add('active');
    document.getElementById('layerButtonInput').value = '';
    document.getElementById('layerButtonInput').focus();
}

function hideLayerButtonModal() {
    document.getElementById('layerButtonModal').classList.remove('active');
}

function addLayerButton() {
    var input = document.getElementById('layerButtonInput');
    var name = input.value.trim();
    if (!name) {
        showErrorModal('Please enter a layer name.');
        return;
    }
    var buttons = getLayerButtons();
    if (buttons.indexOf(name) !== -1) {
        showErrorModal('Button "' + name + '" already exists.');
        return;
    }
    buttons.push(name);
    saveLayerButtons(buttons);
    renderLayerButtons();
    hideLayerButtonModal();
}

function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
