// Import/Export CSV module

let importPendingData = null;

function openExportDialog() {
  if (locations.length === 0) {
    alert("No locations to export.");
    return;
  }

  const dialog = document.getElementById("export-dialog");
  const exportGroupsSection = document.getElementById("export-groups-section");
  const exportGroupsList = document.getElementById("export-groups-list");
  const exportAllMsg = document.getElementById("export-all-msg");

  if (locations.length > 0) {
    exportGroupsSection.style.display = "block";
    exportGroupsList.innerHTML = "";

    // Crear TODO en un único HTML
    let html = "";

    groups.forEach(group => {
      html += `
        <label class="checkbox-label">
          <input type="checkbox" value="${group.id}" checked>
          <span>${group.name}</span>
        </label>
      `;
    });

    // comprobar si hay locations sin grupo
    const hasUngrouped = locations.some(loc => !loc.groupId);

    // añadir solo si existen
    if (hasUngrouped) {
      html += `
        <label class="checkbox-label">
          <input type="checkbox" value="no-group" checked>
          <span>Without group</span>
        </label>
      `;
    }
    ``

    exportGroupsList.innerHTML = html;

  } else {
    exportGroupsSection.style.display = "none";
  }

  dialog.style.display = "flex";
}

function closeExportDialog() {
  document.getElementById("export-dialog").style.display = "none";
}

function doExport() {
  let locsToExport = [];

  // If there are groups, export only selected groups; otherwise export all
  if (groups.length > 0) {
    const checkedGroups = Array.from(
      document.querySelectorAll("#export-groups-list input:checked")
    ).map(cb => cb.value);

    if (checkedGroups.length === 0) {
      alert("Please select at least one group to export.");
      return;
    }

    locsToExport = locations.filter(loc => {
      return (
        checkedGroups.includes(loc.groupId) ||
        (checkedGroups.includes("no-group") && !loc.groupId)
      );
    });
  } else {
    locsToExport = locations;
  }

  if (locsToExport.length === 0) {
    alert("No locations to export in selected filter.");
    return;
  }

  let csvContent = "name,latitude,longitude,group\n";

  locsToExport.forEach(loc => {
    const name = loc.name.replace(/"/g, '""');
    const groupName = loc.groupId ? (groups.find(g => g.id === loc.groupId)?.name || "") : "";
    const line = `"${name}",${loc.lat},${loc.lon},"${groupName}"\n`;
    csvContent += line;
  });

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", "wind-locations.csv");
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  closeExportDialog();
}

function openImportDialog(file) {
  const reader = new FileReader();

  reader.onload = function(event) {
    try {
      const csv = event.target.result;
      const lines = csv.split("\n").filter(line => line.trim().length > 0);

      if (lines.length < 2) {
        alert("CSV file is empty or invalid.");
        document.getElementById("csv-input").value = "";
        return;
      }

      // trim() removes the "\r" that CSVs with Windows line endings (e.g. the Jira script's) leave on the last column
      const header = parseCSVLine(lines[0]).map(column => column.trim().toLowerCase());
      const hasGroupColumn = header.includes("group");
      const hasCountryColumn = header.includes("country");
      const dataLines = lines.slice(1);
      const parsedData = [];
      const errors = [];

      dataLines.forEach((line, index) => {
        try {
          const parsed = parseCSVLine(line);

          if (parsed.length < 3) {
            errors.push(`Row ${index + 2}: Missing fields`);
            return;
          }

          const name = parsed[0].trim();
          // Support both . and , as decimal separator
          const lat = parsed[1] === "" ? null : parseCoord(parsed[1]);
          const lon = parsed[2] === "" ? null : parseCoord(parsed[2]);
          const groupName = hasGroupColumn && parsed[3] ? parsed[3].trim() : "";
          // 5th column: 2-letter country code (e.g. "DE") for the geocoder. Anything else is ignored and the search is not filtered by country
          const country = hasCountryColumn && parsed[4] ? parsed[4].trim().toUpperCase() : "";
          const countryCode = /^[A-Z]{2}$/.test(country) ? country : undefined;

          if (!name) {
            errors.push(`Row ${index + 2}: Name is empty`);
            return;
          }

          if (lat != null && (isNaN(lat) || lat < -90 || lat > 90)) {
            errors.push(`Row ${index + 2}: Invalid latitude`);
            return;
          }

          if (lon != null && (isNaN(lon) || lon < -180 || lon > 180)) {
            errors.push(`Row ${index + 2}: Invalid longitude`);
            return;
          }

          parsedData.push({ name, lat, lon, groupName, countryCode });
        } catch (err) {
          errors.push(`Row ${index + 2}: ${err.message}`);
        }
      });

      if (parsedData.length === 0) {
        alert("No valid locations to import.");
        document.getElementById("csv-input").value = "";
        return;
      }

      importPendingData = { data: parsedData, hasGroupColumn, errors };

      const dialog = document.getElementById("import-dialog");
      const importGroupSelect = document.getElementById("import-group-select");
      const importGroupPicker = document.getElementById("import-group-picker");

      importGroupPicker.innerHTML = '<option value="">Import without group</option>';
      groups.forEach(group => {
        const option = document.createElement("option");
        option.value = group.id;
        option.textContent = group.name;
        option.style.color = group.color;
        importGroupPicker.appendChild(option);
      });

      document.querySelector('input[name="import-option"]').checked = true;
      importGroupSelect.style.display = "none";

      dialog.style.display = "flex";
    } catch (err) {
      alert(`Error reading CSV: ${err.message}`);
      document.getElementById("csv-input").value = "";
    }
  };

  reader.readAsText(file);
}

function closeImportDialog() {
  document.getElementById("import-dialog").style.display = "none";
  importPendingData = null;
}

async function doImport() {
  if (!importPendingData) return;

  const importOption = document.querySelector('input[name="import-option"]:checked').value;
  const { data: allData, errors } = importPendingData;

  // Skip locations whose name already exists (case-insensitive), also repeated within the same CSV
  const nameKey = name => name.trim().toLowerCase();
  const usedNames = new Set(locations.map(loc => nameKey(loc.name)));
  const duplicateNames = [];
  const data = allData.filter(item => {
    const key = nameKey(item.name);
    if (usedNames.has(key)) {
      duplicateNames.push(item.name);
      return false;
    }
    usedNames.add(key);
    return true;
  });

  let importedCount = 0;
  let createdGroupsCount = 0;
  let pendingReviewCount = 0;

  if (importOption === "keep") {
    await Promise.all(data.map(async item => {
      let groupId = undefined;
      if (item.groupName) {
        let group = groups.find(g => g.name === item.groupName);
        // If group doesn't exist, create it with a random color
        if (!group) {
          const randomColor = defaultGroupColors[Math.floor(Math.random() * defaultGroupColors.length)];
          createGroup(item.groupName, randomColor);
          createdGroupsCount++;
          group = groups.find(g => g.name === item.groupName);
        }
        groupId = group ? group.id : undefined;
      }
      const newLoc = await createLocation(item.lat, item.lon, item.name, groupId, item.countryCode);
      newLoc ? importedCount++ : pendingReviewCount++;
    }));
  } else if (importOption === "to-group") {
    const targetGroupId = document.getElementById("import-group-picker").value || undefined;
    await Promise.all(data.map(async item => {
      const newLoc = await createLocation(item.lat, item.lon, item.name, targetGroupId, item.countryCode);
      newLoc ? importedCount++ : pendingReviewCount++;
    }));
  }

  closeImportDialog();
  document.getElementById("csv-input").value = "";

  console.log (`Unresolved locations: ${unresolvedLocations.length}`);

  if (duplicateNames.length > 0) {
    alert(`The location with names ${duplicateNames.join(", ")} wasn't imported.\r\nBecause you already have locations with the same name`);
  }

  let message = `${importedCount} locations were imported`;
  if (pendingReviewCount > 0) {
    message += `\n${pendingReviewCount} locations require manual review: ${unresolvedLocations.map(loc => loc.name).join(", ")}`;
  }
  alert(message);

  if (unresolvedLocations.length > 0) {
    openManualReviewDialog();
  }
}

function openManualReviewDialog() {
  currentReviewIndex = 0;
  document.getElementById("manual-review-dialog").style.display = "flex";
  
  showCurrentManualReviewLocation();
}

function showCurrentManualReviewLocation() {
  const location = unresolvedLocations[currentReviewIndex];
  const latInput = document.getElementById("manual-review-lat");

  document.getElementById("manual-review-count").textContent = unresolvedLocations.length - currentReviewIndex;
  document.getElementById("manual-review-location").textContent = location.name;
  document.getElementById("manual-review-error").style.display = "none";

  latInput.value = "";
  document.getElementById("manual-review-lon").value = "";
  latInput.focus();
}

async function saveManualLocation() {
  const lat = parseCoord(document.getElementById("manual-review-lat").value);
  const lon = parseCoord(document.getElementById("manual-review-lon").value);
  const errorMsg = document.getElementById("manual-review-error");

  if (isNaN(lat) || lat < -90 || lat > 90) {
    showError(errorMsg, "Invalid latitude (between −90 and 90).");
    return;
  }
  if (isNaN(lon) || lon < -180 || lon > 180) {
    showError(errorMsg, "Invalid longitude (between −180 and 180).");
    return;
  }

  const location = unresolvedLocations[currentReviewIndex];

  await createLocation(
    lat,
    lon,
    location.name,
    location.groupId
  );

  currentReviewIndex++;

  if (currentReviewIndex >= unresolvedLocations.length) {
    document.getElementById("manual-review-dialog").style.display = "none";
    unresolvedLocations = [];
    return;
  }

  showCurrentManualReviewLocation();
}

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}
