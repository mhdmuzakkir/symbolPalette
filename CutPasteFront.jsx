// WORKING: Cut → Exit ANY Isolation → Paste in Front

// 1. CUT
app.executeMenuCommand("cut");

// 2. EXIT ISOLATION by selecting the parent layer
// (this forces Illustrator to leave isolation mode completely)
var doc = app.activeDocument;
doc.activeLayer.hasSelectedArtwork = true;   // selects whole layer → exits isolation

// 3. PASTE IN FRONT
app.executeMenuCommand("pasteFront");
