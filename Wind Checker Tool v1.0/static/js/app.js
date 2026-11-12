// Main app file
// Initialization and global event listeners

let clickMode = false;
let sidebarOpen = false;
let selectedLocation = null;
let pendingPin = null;
let selectedGroupColor = defaultGroupColors[0];
let weatherPanelExpanded = false;
let weatherPanelDailyViewisActive = false;
let selectedDay = new Date().toISOString().split('T')[0];
let currentDayOffset = 0;
let unresolvedLocations = [];
let currentReviewIndex = 0;

// Initialize app
document.addEventListener("DOMContentLoaded", async function() {
  loadLocations();
  initializeMap();
  refreshUI();
  updateMarkers();
  toggleSidebar();
  sidebarOpen = true;
  toggleSidebar();

  if (locations.length > 0) {
    console.log("Starting background fetch of weather data...");
    fetchAndCalculateAllBadges();
  }
});

// Sidebar toggle
document.getElementById("sidebar-toggle").addEventListener("click", toggleSidebar);

// Selection mode
document.getElementById("btn-selection").addEventListener("click", function() {
  setClickMode(!clickMode);
});

// Coordinates form
const coordForm = document.getElementById("coord-form");
coordForm.addEventListener("submit", function(evt) {
  evt.preventDefault();

  const nameInput = document.getElementById("f-name").value;
  const latInput = parseCoord(document.getElementById("f-lat").value);
  const lonInput = parseCoord(document.getElementById("f-lon").value);
  const groupInput = document.getElementById("f-group").value;
  const errorMsg = document.getElementById("coord-error");

  if (isNaN(latInput) || latInput < -90 || latInput > 90) {
    showError(errorMsg, "Invalid latitude (between −90 and 90).");
    return;
  }

  if (isNaN(lonInput) || lonInput < -180 || lonInput > 180) {
    showError(errorMsg, "Invalid longitude (between −180 and 180).");
    return;
  }

  errorMsg.style.display = "none";
  const finalName = nameInput.trim().length > 0 ? nameInput.trim() : `Location ${locations.length + 1}`;
  const groupId = groupInput ? groupInput : undefined;
  createLocation(latInput, lonInput, finalName, groupId);
  coordForm.reset();
});

const latField = document.getElementById("f-lat");
latField.addEventListener("input", function() {
  document.getElementById("coord-error").style.display = "none";
});

const lonField = document.getElementById("f-lon");
lonField.addEventListener("input", function() {
  document.getElementById("coord-error").style.display = "none";
});

// Name dialog
const saveBtn = document.getElementById("nd-save");
saveBtn.addEventListener("click", function() {
  if (!pendingPin) return;

  const inputName = document.getElementById("nd-input").value.trim();

  if (!inputName) {
    alert("Please enter a name");
    return;
  }

  const groupId = document.getElementById("nd-group").value || undefined;
  

  createLocation(pendingPin.lat, pendingPin.lon, inputName, groupId);
  closeNameDialog();
});

const cancelBtn = document.getElementById("nd-cancel");
cancelBtn.addEventListener("click", function() {
  closeNameDialog();
  setClickMode(false);
});

const nameInput = document.getElementById("nd-input");
nameInput.addEventListener("keydown", function(evt) {
  if (evt.key === "Enter") {
    saveBtn.click();
  } else if (evt.key === "Escape") {
    cancelBtn.click();
  }
});

function openNameDialog() {
  const dlg = document.getElementById("name-dialog");
  const inp = document.getElementById("nd-input");
  const groupField = document.getElementById("nd-group-field");
  const groupSelect = document.getElementById("nd-group");

  inp.value = "";

  groupField.style.display = groups.length > 0 ? "flex" : "none";
  groupSelect.value = "";

  updateNameDialogGroupSelector();

  dlg.style.display = "flex";
  inp.focus();
}

function closeNameDialog() {
  document.getElementById("name-dialog").style.display = "none";
  pendingPin = null;
}

// Weather panel
const closeWeatherBtn = document.querySelector(".wp-close");
closeWeatherBtn.addEventListener("click", function() {
  setSelectedLocation(null);
});

const expandWeatherBtn = document.querySelector(".wp-expand");
expandWeatherBtn.addEventListener("click", toggleWeatherPanelExpand);

const dailyWeatherBtn = document.querySelector(".wp-daily");
dailyWeatherBtn.addEventListener("click", toggleWeatherPanelDailyView);

// Group management
const newGroupBtn = document.getElementById("btn-new-group");
newGroupBtn.addEventListener("click", openGroupDialog);

const allGroupBtn = document.querySelector('[data-group="all"]');
allGroupBtn.addEventListener("click", function() {
  setGroupFilter("all");
});

const colorOptions = document.querySelectorAll(".color-option");
colorOptions.forEach(option => {
  option.addEventListener("click", function() {
    colorOptions.forEach(o => o.classList.remove("active"));
    this.classList.add("active");
    selectedGroupColor = this.getAttribute("data-color");
  });
});

const groupNameInput = document.getElementById("group-name-input");
const groupSaveBtn = document.getElementById("group-save");
const groupCancelBtn = document.getElementById("group-cancel");

groupSaveBtn.addEventListener("click", function() {
  const name = groupNameInput.value.trim();
  if (!name) {
    alert("Please enter a group name");
    return;
  }
  createGroup(name, selectedGroupColor);
  closeGroupDialog();
});

groupCancelBtn.addEventListener("click", closeGroupDialog);

groupNameInput.addEventListener("keydown", function(e) {
  if (e.key === "Enter") {
    groupSaveBtn.click();
  } else if (e.key === "Escape") {
    groupCancelBtn.click();
  }
});

function openGroupDialog() {
  const dialog = document.getElementById("group-dialog");
  groupNameInput.value = "";
  selectedGroupColor = defaultGroupColors[0];

  colorOptions.forEach((opt, idx) => {
    if (idx === 0) {
      opt.classList.add("active");
    } else {
      opt.classList.remove("active");
    }
  });

  dialog.style.display = "flex";
  groupNameInput.focus();
}

function closeGroupDialog() {
  document.getElementById("group-dialog").style.display = "none";
}

// Export/Import
const exportBtn = document.getElementById("btn-export");
exportBtn.addEventListener("click", openExportDialog);

const importBtn = document.getElementById("btn-import");
importBtn.addEventListener("click", function() {
  document.getElementById("csv-input").click();
});

const csvInput = document.getElementById("csv-input");
csvInput.addEventListener("change", function(evt) {
  const file = evt.target.files[0];
  if (file) {
    openImportDialog(file);
  }
});

// Export dialog
document.getElementById("export-cancel").addEventListener("click", closeExportDialog);
document.getElementById("export-do").addEventListener("click", doExport);

// Import dialog
const importRadios = document.querySelectorAll('input[name="import-option"]');
importRadios.forEach(radio => {
  radio.addEventListener("change", function() {
    const importGroupSelect = document.getElementById("import-group-select");
    importGroupSelect.style.display = this.value === "to-group" ? "block" : "none";
  });
});

document.getElementById("import-cancel").addEventListener("click", closeImportDialog);
document.getElementById("import-proceed").addEventListener("click", doImport);

// Settings
const settingsBtn = document.getElementById("btn-settings");
settingsBtn.addEventListener("click", openSettingsDialog);

const settingsSaveBtn = document.getElementById("settings-save");
const settingsCancelBtn = document.getElementById("settings-cancel");
const settingsInput = document.getElementById("settings-threshold");

settingsSaveBtn.addEventListener("click", function() {
  const errorDiv = document.getElementById("settings-error");
  const newThreshold = parseCoord(settingsInput.value);

  if (isNaN(newThreshold) || newThreshold <= 0) {
    showError(errorDiv, "Please enter a valid positive number.");
    return;
  }

  windThreshold = newThreshold;
  saveThreshold();
  closeSettingsDialog();

  if (selectedLocation) {
    loadWeatherData(selectedLocation);
  }
  updateMarkers();
});

settingsCancelBtn.addEventListener("click", closeSettingsDialog);

settingsInput.addEventListener("input", function() {
  document.getElementById("settings-error").style.display = "none";
});

settingsInput.addEventListener("keydown", function(evt) {
  if (evt.key === "Enter") {
    settingsSaveBtn.click();
  } else if (evt.key === "Escape") {
    settingsCancelBtn.click();
  }
});

function openSettingsDialog() {
  const dlg = document.getElementById("settings-dialog");
  const errorDiv = document.getElementById("settings-error");

  settingsInput.value = windThreshold;
  errorDiv.style.display = "none";

  dlg.style.display = "flex";
  settingsInput.focus();
}

function closeSettingsDialog() {
  document.getElementById("settings-dialog").style.display = "none";
}
