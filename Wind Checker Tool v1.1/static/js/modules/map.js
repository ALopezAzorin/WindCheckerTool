// Map module
// Handles map initialization and marker management

let map = null;
const markerMap = new Map();

function initializeMap() {
  map = L.map("map", {
    center: [47, 27],
    zoom: 4,
    zoomControl: false
  });

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; OpenStreetMap contributors',
    subdomains: ["a", "b", "c", "d"],
    maxZoom: 19,
  }).addTo(map);

  map.on("click", function(event) {
    if (!clickMode) {
      return;
    }
    pendingPin = {
      lat: event.latlng.lat,
      lon: event.latlng.lng
    };
    openNameDialog();
  });
}

function createPinIcon(color = "#ef4444", badgeType = null) {
  const badgeHtml = badgeType ? createBadgeHTML(badgeType) : '';

  return L.divIcon({
    className: "marker-with-badge",
    iconSize: [32, 42],
    iconAnchor: [16, 42],
    html: `
      <div style="position: relative; width: 32px; height: 42px;">
        <svg width="20" height="30" viewBox="0 0 28 40" xmlns="http://www.w3.org/2000/svg" style="position: absolute; left: 6px; top: 6px;">
          <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 26 14 26S28 24.5 28 14C28 6.268 21.732 0 14 0z" fill="${color}"/>
          <circle cx="14" cy="14" r="5.5" fill="white"/>
        </svg>
        ${badgeHtml}
      </div>
    `
  });
}

function createBadgeHTML(type) {
  const isValid = type === 'valid';
  const bgColor = isValid ? '#22C55E' : '#F97316';
  const icon = isValid ? '✓' : '✕';

  return `
    <div class="marker-badge" style="
      position: absolute;
      top: 0;
      right: 0;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background-color: ${bgColor};
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 12px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      border: 2px solid white;
      line-height: 1;
      z-index: 1000;
    ">
      ${icon}
    </div>
  `;
}

function updateMarkers(badgeOverrides = null) {
  markerMap.forEach(marker => {
    marker.remove();
  });
  markerMap.clear();

  const filteredLocations = getLocationsByFilter();

  filteredLocations.forEach(location => {
    let color = "#ef4444";
    if (location.groupId) {
      const group = groups.find(g => g.id === location.groupId);
      if (group) {
        color = group.color;
      }
    }

    let badgeType;
    if (badgeOverrides && badgeOverrides[location.id] !== undefined) {
      badgeType = badgeOverrides[location.id];
    } else {
      badgeType = calculateBadgeForLocation(location);
    }

    const m = L.marker([location.lat, location.lon], {
      icon: createPinIcon(color, badgeType)
    }).addTo(map);

    bindLocationTooltip(m, location);

    m.on("click", function() {
      setSelectedLocation(location);
    });

    markerMap.set(location.id, m);
  });
}

// The name tooltip shows on hover, and stays visible for the location whose weather panel is open
function bindLocationTooltip(marker, location) {
  marker.unbindTooltip();
  marker.bindTooltip(location.name, {
    direction: "top",
    offset: [0, -10],
    permanent: selectedLocation?.id === location.id
  });
}

function updateSelectedTooltip() {
  markerMap.forEach((marker, locId) => {
    const location = locations.find(l => l.id === locId);
    if (location) {
      bindLocationTooltip(marker, location);
    }
  });
}
