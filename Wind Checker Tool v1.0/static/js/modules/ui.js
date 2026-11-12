// UI module
// Handles all UI updates and interactions

function refreshUI() {
  updateLocationCount();
  updateSelectButton();
  updateLocationList();
}

function updateLocationCount() {
  const count = document.getElementById("sidebar-count");
  if (locations.length > 0) {
    count.textContent = `${locations.length} saved`;
  } else {
    count.textContent = "";
  }
}

function updateSelectButton() {
  const btn = document.getElementById("btn-selection");
  const hint = document.getElementById("click-hint");

  if (clickMode) {
    btn.textContent = "Cancel selection";
    btn.classList.add("active");
    hint.style.display = "block";
  } else {
    btn.textContent = "Enable selection";
    btn.classList.remove("active");
    hint.style.display = "none";
  }
}

function updateLocationList() {
  const list = document.getElementById("location-list");
  const empty = document.getElementById("empty-msg");
  const section = document.getElementById("saved-section");
  const divider = document.getElementById("saved-divider");
  const shareSection = document.getElementById("share-section");
  const shareDivider = document.getElementById("share-divider");
  const groupsSection = document.getElementById("groups-section");

  list.innerHTML = "";

  shareSection.style.display = "flex";
  shareDivider.style.display = "block";

  groupsSection.style.display = "flex";

  const filteredLocations = getLocationsByFilter();

  if (locations.length === 0) {
    empty.style.display = "block";
    section.style.display = "none";
    divider.style.display = "none";
  } else {
    if (filteredLocations.length === 0) {
      empty.style.display = "block";
      empty.textContent = "No locations in this group.";
    } else {
      empty.style.display = "none";
    }

    section.style.display = "flex";
    divider.style.display = "block";

    filteredLocations.forEach(loc => {
      const item = makeLocationListItem(loc);
      list.appendChild(item);
    });
  }

  updateGroupFilterButtons();
}

function makeLocationListItem(loc) {

  const li = document.createElement("li");
  li.className = "location-item";
  li.setAttribute("data-id", loc.id);

  const displayLat = loc.lat.toFixed(4);
  const displayLon = (loc.lon >= 0 ? "+" : "") + loc.lon.toFixed(4);
  const safeName = htmlEscape(loc.name);

  if (loc.groupId) {
    const group = groups.find(g => g.id === loc.groupId);
    if (group) {
      li.classList.add("group-colored");
      li.style.borderLeftColor = group.color;
    }
  }

  li.innerHTML = `
    <div class="item-info">
      <p class="item-name">${safeName}</p>
      <p class="item-coords">${displayLat}°&thinsp;${displayLon}°</p>
    </div>
    <div class="item-actions">
      ${groups.length > 0 ? `<button class="item-btn group" aria-label="Change group" title="Change group">G</button>` : ""}
      <button class="item-btn edit" aria-label="Edit location">${getEditIcon()}</button>
      <button class="item-btn delete" aria-label="Delete location">${getTrashIcon()}</button>
    </div>
  `;

  if (groups.length > 0) {
    const groupBtn = li.querySelector(".item-btn.group");
    groupBtn.addEventListener("click", function(e) {
      e.stopPropagation();
      showGroupMenu(loc.id, groupBtn);
    });
  }

  const editBtn = li.querySelector(".item-btn.edit");
  editBtn.addEventListener("click", function() {
    startEditingLocation(loc, li);
  });

  const deleteBtn = li.querySelector(".item-btn.delete");
  deleteBtn.addEventListener("click", function() {
    deleteLocation(loc.id);
  });

  return li;
}

function updateGroupFilterButtons() {
  const filterDiv = document.getElementById("group-filter");

  // Remove all containers except the "All" button
  const containers = filterDiv.querySelectorAll("div");
  containers.forEach(cont => cont.remove());

  // Only create group buttons if there are groups
  if (groups.length === 0) {
    return;
  }

  groups.forEach(group => {
    const container = document.createElement("div");
    container.style.display = "flex";
    container.style.gap = "4px";
    container.style.alignItems = "center";

    const btn = document.createElement("button");
    btn.className = "group-filter-btn";
    btn.style.flex = "1";
    if (activeGroupFilters.has(group.id)) {
      btn.classList.add("active");
    }
    btn.setAttribute("data-group", group.id);
    btn.setAttribute("data-type", "group");
    btn.setAttribute("title", `Filter by ${group.name}`);
    btn.style.setProperty("--group-color", group.color);
    btn.textContent = group.name;
    btn.addEventListener("click", function(e) {
      e.preventDefault();
      setGroupFilter(group.id);
    });

    const editBtn = document.createElement("button");
    editBtn.className = "group-edit-btn";
    editBtn.setAttribute("title", `Edit ${group.name}`);
    editBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:14px;height:14px"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931zm0 0L19.5 7.125"/></svg>`;
    editBtn.style.padding = "6px";
    editBtn.style.borderRadius = "6px";
    editBtn.style.background = "transparent";
    editBtn.style.border = "none";
    editBtn.style.color = "var(--text-muted)";
    editBtn.style.cursor = "pointer";
    editBtn.style.flexShrink = "0";
    editBtn.addEventListener("click", function(e) {
      e.preventDefault();
      e.stopPropagation();
      openEditGroupDialog(group.id);
    });
    editBtn.addEventListener("mouseenter", function() {
      this.style.color = "var(--accent)";
      this.style.background = "rgba(34,211,238,0.1)";
    });
    editBtn.addEventListener("mouseleave", function() {
      this.style.color = "var(--text-muted)";
      this.style.background = "transparent";
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "group-delete-btn";
    deleteBtn.setAttribute("title", `Delete ${group.name}`);
    deleteBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>`;
    deleteBtn.style.padding = "6px";
    deleteBtn.style.borderRadius = "6px";
    deleteBtn.style.background = "transparent";
    deleteBtn.style.border = "none";
    deleteBtn.style.color = "var(--text-muted)";
    deleteBtn.style.cursor = "pointer";
    deleteBtn.style.flexShrink = "0";
    deleteBtn.addEventListener("click", function(e) {
      e.preventDefault();
      e.stopPropagation();
      deleteGroupWithConfirmation(group.id);
    });
    deleteBtn.addEventListener("mouseenter", function() {
      this.style.color = "#f87171";
      this.style.background = "rgba(248,113,113,0.1)";
    });
    deleteBtn.addEventListener("mouseleave", function() {
      this.style.color = "var(--text-muted)";
      this.style.background = "transparent";
    });

    container.appendChild(btn);
    container.appendChild(editBtn);
    container.appendChild(deleteBtn);
    filterDiv.appendChild(container);
  });

  const allBtn = filterDiv.querySelector("[data-type='all']");
  if (activeGroupFilters.has("all")) {
    allBtn.classList.add("active");
  } else {
    allBtn.classList.remove("active");
  }

  updateGroupSelector();
  updateNameDialogGroupSelector();
}

function showGroupMenu(locId, button) {
  const menu = document.createElement("div");
  menu.className = "group-menu";
  menu.style.position = "absolute";
  menu.style.zIndex = "1000";
  menu.style.backgroundColor = "var(--bg-card)";
  menu.style.border = "1px solid var(--border)";
  menu.style.borderRadius = "8px";
  menu.style.overflow = "hidden";
  menu.style.minWidth = "150px";

  const noneBtn = document.createElement("button");
  noneBtn.textContent = "No group";
  noneBtn.style.width = "100%";
  noneBtn.style.padding = "8px 12px";
  noneBtn.style.border = "none";
  noneBtn.style.background = "transparent";
  noneBtn.style.color = "var(--text-muted)";
  noneBtn.style.fontSize = "12px";
  noneBtn.style.cursor = "pointer";
  noneBtn.style.textAlign = "left";
  noneBtn.addEventListener("click", () => {
    assignLocationToGroup(locId, "none");
    document.body.removeChild(menu);
  });
  menu.appendChild(noneBtn);

  const divider = document.createElement("div");
  divider.style.height = "1px";
  divider.style.backgroundColor = "var(--border)";
  menu.appendChild(divider);

  groups.forEach(group => {
    const btn = document.createElement("button");
    btn.textContent = group.name;
    btn.style.width = "100%";
    btn.style.padding = "8px 12px";
    btn.style.border = "none";
    btn.style.background = "transparent";
    btn.style.color = "var(--text-main)";
    btn.style.fontSize = "12px";
    btn.style.cursor = group.color;
    btn.style.textAlign = "left";
    btn.style.borderLeft = `3px solid ${group.color}`;
    btn.addEventListener("click", () => {
      assignLocationToGroup(locId, group.id);
      document.body.removeChild(menu);
    });
    menu.appendChild(btn);
  });

  const rect = button.getBoundingClientRect();
  menu.style.left = rect.left + "px";
  menu.style.top = (rect.bottom + 4) + "px";

  document.body.appendChild(menu);

  setTimeout(() => {
    document.addEventListener("click", function closeMenu() {
      if (document.body.contains(menu)) {
        document.body.removeChild(menu);
      }
      document.removeEventListener("click", closeMenu);
    });
  }, 0);
}

function startEditingLocation(loc, li) {
  const editWrapper = document.createElement("li");
  editWrapper.className = "edit-form";

  const safeName = htmlEscape(loc.name);

  editWrapper.innerHTML = `
    <form class="edit-form-fields">
      <div class="field">
        <label>Name</label>
        <input class="input" type="text" name="name" value="${safeName}">
      </div>
      <div class="field">
        <label>Latitude</label>
        <input class="input mono" type="text" inputmode="decimal" name="lat" value="${loc.lat}" required>
      </div>
      <div class="field">
        <label>Longitude</label>
        <input class="input mono" type="text" inputmode="decimal" name="lon" value="${loc.lon}" required>
      </div>
      <div class="error-msg" style="display:none"></div>
      <div class="edit-form-actions">
        <button type="submit" class="btn-edit-save">Save</button>
        <button type="button" class="btn-edit-cancel">Cancel</button>
      </div>
    </form>
  `;

  li.replaceWith(editWrapper);

  const cancelBtn = editWrapper.querySelector(".btn-edit-cancel");
  cancelBtn.addEventListener("click", function() {
    const newItem = makeLocationListItem(loc);
    editWrapper.replaceWith(newItem);
  });

  const form = editWrapper.querySelector("form");
  form.addEventListener("submit", function(evt) {
    evt.preventDefault();

    const nameField = form.querySelector("[name=name]");
    const latField = form.querySelector("[name=lat]");
    const lonField = form.querySelector("[name=lon]");
    const errorDiv = form.querySelector(".error-msg");

    const newName = nameField.value;
    const newLat = parseCoord(latField.value);
    const newLon = parseCoord(lonField.value);

    if (isNaN(newLat) || newLat < -90 || newLat > 90) {
      showError(errorDiv, "Invalid latitude (between −90 and 90).");
      return;
    }

    if (isNaN(newLon) || newLon < -180 || newLon > 180) {
      showError(errorDiv, "Invalid longitude (between −180 and 180).");
      return;
    }

    const finalName = newName.trim().length > 0 ? newName.trim() : loc.name;
    editLocation(loc.id, finalName, newLat, newLon);
  });

  editWrapper.querySelector("[name=name]").focus();
}

function showError(element, message) {
  element.textContent = message;
  element.style.display = "block";
}

function updateGroupSelector() {
  const groupSelect = document.getElementById("f-group");
  const currentValue = groupSelect.value;

  while (groupSelect.options.length > 1) {
    groupSelect.remove(1);
  }

  groups.forEach(group => {
    const option = document.createElement("option");
    option.value = group.id;
    option.textContent = group.name;
    option.style.color = group.color;
    groupSelect.appendChild(option);
  });

  if (currentValue && Array.from(groupSelect.options).some(opt => opt.value === currentValue)) {
    groupSelect.value = currentValue;
  }
}

function updateNameDialogGroupSelector() {
  const groupSelect = document.getElementById("nd-group");
  const currentValue = groupSelect.value;

  while (groupSelect.options.length > 1) {
    groupSelect.remove(1);
  }

  groups.forEach(group => {
    const option = document.createElement("option");
    option.value = group.id;
    option.textContent = group.name;
    option.style.color = group.color;
    groupSelect.appendChild(option);
  });

  if (currentValue && Array.from(groupSelect.options).some(opt => opt.value === currentValue)) {
    groupSelect.value = currentValue;
  }
}

function setClickMode(enabled) {
  clickMode = enabled;
  const mapEl = document.getElementById("map");
  mapEl.style.cursor = enabled ? "crosshair" : "";
  refreshUI();
}

function toggleSidebar() {
  sidebarOpen = !sidebarOpen;
  const wrapper = document.getElementById("sidebar-wrapper");
  const btn = document.getElementById("sidebar-toggle");

  if (sidebarOpen) {
    wrapper.classList.remove("collapsed");
    btn.classList.add("open");
    btn.classList.remove("closed");
  } else {
    wrapper.classList.add("collapsed");
    btn.classList.remove("open");
    btn.classList.add("closed");
  }

  setTimeout(() => {
    if (map) {
      map.invalidateSize();
    }
  }, 310);
}

function getEditIcon() {
  return `<svg style="width:14px;height:14px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931zm0 0L19.5 7.125"/></svg>`;
}

function getTrashIcon() {
  return `<svg style="width:14px;height:14px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>`;
}

function htmlEscape(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;"
  };
  return text.replace(/[&<>"]/g, char => map[char]);
}

function openEditGroupDialog(groupId) {
  const group = groups.find(g => g.id === groupId);
  if (!group) return;

  const dialog = document.getElementById("edit-group-dialog");
  const nameInput = document.getElementById("edit-group-name");
  const colorOptions = document.querySelectorAll("#edit-color-picker .color-option");

  nameInput.value = group.name;

  // Set active color
  colorOptions.forEach(opt => {
    opt.classList.remove("active");
    if (opt.getAttribute("data-color") === group.color) {
      opt.classList.add("active");
    }
  });

  const saveBtn = document.getElementById("edit-group-save");
  const cancelBtn = document.getElementById("edit-group-cancel");

  cancelBtn.onclick = function() {
    dialog.style.display = "none";
  };

  saveBtn.onclick = function() {
    const newName = nameInput.value.trim();
    if (!newName) {
      alert("Please enter a group name");
      return;
    }

    const activeColor = document.querySelector("#edit-color-picker .color-option.active");
    const newColor = activeColor ? activeColor.getAttribute("data-color") : group.color;

    editGroup(groupId, newName, newColor);
    dialog.style.display = "none";
  };

  // Color picker interaction
  colorOptions.forEach(opt => {
    opt.addEventListener("click", function() {
      colorOptions.forEach(o => o.classList.remove("active"));
      this.classList.add("active");
    });
  });

  nameInput.addEventListener("keydown", function(e) {
    if (e.key === "Enter") {
      saveBtn.click();
    } else if (e.key === "Escape") {
      cancelBtn.click();
    }
  });

  dialog.style.display = "flex";
}

function deleteGroupWithConfirmation(groupId) {
  const group = groups.find(g => g.id === groupId);
  if (!group) return;

  const locationsInGroup = locations.filter(l => l.groupId === groupId);
  const count = locationsInGroup.length;

  if (count === 0) {
    // No locations, delete directly
    deleteGroup(groupId);
    return;
  }

  // Show confirmation dialog
  const dialog = document.getElementById("delete-group-dialog");
  const countSpan = document.getElementById("delete-group-count");

  countSpan.textContent = count;

  const confirmBtn = document.getElementById("delete-group-confirm");
  const cancelBtn = document.getElementById("delete-group-cancel");

  confirmBtn.onclick = function() {
    deleteGroup(groupId);
    dialog.style.display = "none";
  };

  cancelBtn.onclick = function() {
    dialog.style.display = "none";
  };

  dialog.style.display = "flex";
}
