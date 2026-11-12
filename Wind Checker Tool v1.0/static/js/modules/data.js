// Data persistence module
// Handles localStorage save/load

let locations = [];
let groups = [];
let windThreshold = 6;

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
