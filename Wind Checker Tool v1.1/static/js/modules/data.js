// Data persistence module
// Handles localStorage save/load

let locations = [];
let groups = [];
let windThreshold = 6;
let windHeight = 120;
let markerSymbolMode = "above";

const defaultGroupColors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899"];

function loadLocations() {
  try {
    const stored = localStorage.getItem("windy-locations");
    if (stored) {
      locations = JSON.parse(stored);
    }
    const groupsStored = localStorage.getItem("windy-groups");
    if (groupsStored) {
      groups = JSON.parse(groupsStored);
    }
    const thresholdStored = localStorage.getItem("windy-threshold");
    if (thresholdStored) {
      const parsedThreshold = parseFloat(thresholdStored);
      if (!isNaN(parsedThreshold)) {
        windThreshold = parsedThreshold;
      }
    }
    const heightStored = localStorage.getItem("windy-height");
    if (heightStored) {
      const parsedHeight = parseInt(heightStored);
      if ([10, 80, 120, 180].includes(parsedHeight)) {
        windHeight = parsedHeight;
      }
    }
    const symbolModeStored = localStorage.getItem("windy-symbol-mode");
    if (symbolModeStored === "above" || symbolModeStored === "below") {
      markerSymbolMode = symbolModeStored;
    }
  } catch (e) {
    console.warn("Failed to load data:", e);
  }
}

function saveLocations() {
  try {
    localStorage.setItem("windy-locations", JSON.stringify(locations));
    localStorage.setItem("windy-groups", JSON.stringify(groups));
  } catch (e) {
    console.error("Could not save data", e);
  }
}

function saveThreshold() {
  try {
    localStorage.setItem("windy-threshold", String(windThreshold));
  } catch (e) {
    console.error("Could not save threshold", e);
  }
}

function saveHeight() {
  try {
    localStorage.setItem("windy-height", String(windHeight));
  } catch (e) {
    console.error("Could not save height", e);
  }
}

function saveSymbolMode() {
  try {
    localStorage.setItem("windy-symbol-mode", markerSymbolMode);
  } catch (e) {
    console.error("Could not save symbol mode", e);
  }
}
