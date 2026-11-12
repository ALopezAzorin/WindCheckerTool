// Groups management module

let activeGroupFilters = new Set(["all"]);

function createGroup(name, color) {
  const newGroup = {
    id: crypto.randomUUID(),
    name: name.trim(),
    color: color
  };
  groups.push(newGroup);
  saveLocations();
  refreshUI();
  return newGroup;
}

function editGroup(groupId, newName, newColor) {
  const group = groups.find(g => g.id === groupId);
  if (!group) return;

  group.name = newName.trim();
  group.color = newColor;

  saveLocations();
  refreshUI();
  updateMarkers();
}

function deleteGroup(groupId) {
  groups = groups.filter(g => g.id !== groupId);
  locations = locations.filter(loc => loc.groupId !== groupId)
  
  if (activeGroupFilters.has(groupId)) {
    activeGroupFilters.delete(groupId);
    if (activeGroupFilters.size === 0) {
      activeGroupFilters.add("all");
    }
  }
  saveLocations();
  refreshUI();
  updateMarkers();
}

function setGroupFilter(groupId) {
  if (groupId === "all") {
    activeGroupFilters.clear();
    activeGroupFilters.add("all");
  } else {
    if (activeGroupFilters.has("all")) {
      activeGroupFilters.clear();
    }

    if (activeGroupFilters.has(groupId)) {
      activeGroupFilters.delete(groupId);
      if (activeGroupFilters.size === 0) {
        activeGroupFilters.add("all");
      }
    } else {
      activeGroupFilters.add(groupId);
    }
  }

  refreshUI();
  updateMarkers();
}

function getLocationsByFilter() {
  if (activeGroupFilters.has("all")) {
    return locations;
  }
  return locations.filter(l => {
    if (!l.groupId) return false;
    return activeGroupFilters.has(l.groupId);
  });
}
