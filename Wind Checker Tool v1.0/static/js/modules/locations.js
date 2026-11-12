// Locations CRUD module

function normalizeLocationName(name) {
  return name
    .replace(/\bRepowering\b/gi, "")
    .replace(/\bExtension\b/gi, "")
    .replace(/\bECC\b/gi, "")
    .replace(/\bI\b/gi, "")
    .replace(/\bII\b/gi, "")
    .replace(/\bIII\b/gi, "")
    .replace(/\bIV\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function germanizeName(name) {
  return name
    .replace(/ue/g, "ü")
    .replace(/oe/g, "ö")
    .replace(/ae/g, "ä");
}


async function createLocation(latitude, longitude, locationName, groupId = undefined) {

  if (latitude == null && longitude == null) {

    const attempts =[
      locationName,
      normalizeLocationName(locationName),
      normalizeLocationName(locationName).split(" ")[0],
      germanizeName(normalizeLocationName(locationName))
    ];

    let found = false;

    for (const searchName of attempts) {

      if (!searchName) continue;

      try {
        const url = `https://geocoding-api.open-meteo.com/v1/search?` + `name=${encodeURIComponent(searchName)}` + `&count=1&language=en&format=json`;
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!data.results || data.results.length === 0) {
          throw new Error("No results");
        }

        latitude = data.results[0].latitude;
        longitude = data.results[0].longitude;
        found = true;
        break;

      } catch {
        continue;
      }
    }

    if (!found) {{
      unresolvedLocations.push({ name: locationName , groupId: groupId });
      return;
    }}
  }


  const newLoc = {
    id: crypto.randomUUID(),
    name: locationName,
    lat: latitude,
    lon: longitude
  };
  if (groupId) {
    newLoc.groupId = groupId;
  }
  locations.push(newLoc);
  saveLocations();
  setClickMode(false);
  refreshUI();
  updateMarkers();

  fetchWeatherDataForLocation(newLoc).then(() => {
    const badge = calculateBadgeForLocation(newLoc);
    if (badge) {
      const badgeOverrides = {};
      badgeOverrides[newLoc.id] = badge;
      updateMarkers(badgeOverrides);
    }
  });
}

function deleteLocation(locId) {
  const index = locations.findIndex(l => l.id === locId);
  if (index >= 0) {
    locations.splice(index, 1);
    saveLocations();

    if (selectedLocation?.id === locId) {
      setSelectedLocation(null);
    }

    refreshUI();
    updateMarkers();
  }
}

function editLocation(locId, newName, newLat, newLon) {
  const loc = locations.find(l => l.id === locId);
  if (!loc) return;

  const coordsChanged = loc.lat !== newLat || loc.lon !== newLon;

  loc.name = newName;
  loc.lat = newLat;
  loc.lon = newLon;

  saveLocations();

  if (selectedLocation?.id === locId) {
    selectedLocation = { ...loc };
  }

  refreshUI();
  updateMarkers();

  if (coordsChanged) {
    fetchWeatherDataForLocation(loc).then(() => {
      const badge = calculateBadgeForLocation(loc);
      if (badge) {
        const badgeOverrides = {};
        badgeOverrides[loc.id] = badge;
        updateMarkers(badgeOverrides);
      }
    });
  }
}

function assignLocationToGroup(locId, groupId) {
  const loc = locations.find(l => l.id === locId);
  if (!loc) return;
  loc.groupId = groupId === "none" ? undefined : groupId;
  saveLocations();
  refreshUI();
  updateMarkers();
}

function parseCoord(str) {
  // Support both . and , as decimal separator (e.g., 40.4168 or 40,4168)
  const normalized = str.trim().replace(",", ".");
  return parseFloat(normalized);
}
