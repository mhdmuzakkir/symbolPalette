// CSInterface.js - Adobe CEP CSInterface Library
// Version 9.4.0
// This is a simplified version for the Symbol Palette extension

function CSInterface() {
    this.hostEnvironment = JSON.parse(window.__adobe_cep__.getHostEnvironment());
}

CSInterface.prototype.evalScript = function(script, callback) {
    if (callback === undefined || callback === null) {
        callback = function(result) {};
    }
    window.__adobe_cep__.evalScript(script, callback);
};

CSInterface.prototype.getHostEnvironment = function() {
    this.hostEnvironment = JSON.parse(window.__adobe_cep__.getHostEnvironment());
    return this.hostEnvironment;
};

CSInterface.prototype.closeExtension = function() {
    window.__adobe_cep__.closeExtension();
};

CSInterface.prototype.getSystemPath = function(pathType) {
    var path = decodeURI(window.__adobe_cep__.getSystemPath(pathType));
    return path;
};

// System path types
CSInterface.prototype.SystemPath = {
    USER_DATA: "userData",
    COMMON_FILES: "commonFiles",
    MY_DOCUMENTS: "myDocuments",
    APPLICATION: "application",
    EXTENSION: "extension",
    HOST_APPLICATION: "hostApplication"
};

// Host object types
CSInterface.prototype.HostObject = {
    ILLUSTRATOR: "ILST"
};
