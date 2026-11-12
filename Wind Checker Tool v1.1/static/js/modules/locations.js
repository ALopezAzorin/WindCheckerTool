// Locations CRUD module

// Letters that are not "base letter + accent", so NFD can't split them and they need an explicit replacement
const SPECIAL_LETTERS = { "ß": "ss", "æ": "ae", "œ": "oe", "ø": "o", "ł": "l", "đ": "d", "ð": "d", "þ": "th", "ı": "i" };
// How German, Swedish, Danish... write these letters when they don't type them: Gönnebek = Goennebek, Åbenrå = Aabenraa
const SPELLED_OUT_LETTERS = { "ä": "ae", "ö": "oe", "ü": "ue", "å": "aa", "ø": "oe" };

// Returns the two simplified versions of a place name: lowercase, without accents, special letters, spaces or symbols
// Two versions because "ü" is "u" in most languages (Küptepe = Kuptepe) but "ue" in German (Lutzhöft = Lutzhoeft)
function nameKeys(name) {
  const simplify = text => text
    .replace(/[ßæœøłđðþı]/g, letter => SPECIAL_LETTERS[letter])
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // NFD splits "ó" into "o" + accent, then the accent is removed
    .replace(/[^a-z0-9]/g, ""); // spaces, hyphens, apostrophes...
  const lower = name.normalize("NFC").toLowerCase(); // NFC first, so "ü" is always one character, never "u" + a separate "¨"
  return new Set([
    simplify(lower), // general version
    simplify(lower.replace(/[äöüåø]/g, letter => SPELLED_OUT_LETTERS[letter])) // spelled-out version
  ]);
}

// Compares two place names ignoring upper/lower case, accents, umlauts, special letters, spaces and symbols
// They are the same name if any of their two simplified versions match
function isSameName(a, b) {
  const keysOfB = nameKeys(b);
  return [...nameKeys(a)].some(key => keysOfB.has(key));
}

// Words of a project name that are not part of the place name: Wiemersdorf Repowering -> Wiemersdorf, Tarnow Sued -> Tarnow
const GENERAL_WORDS = ["repowering", "extension", "erweiterung", "ecc", "ii", "iii", "iv"];
const DIRECTION_WORDS = ["nord", "sued", "süd", "sud", "ost", "west", "north", "south", "east",
  "nordost", "nordwest", "suedost", "suedwest", "südost", "südwest"];

// Returns the name without general words, directions and single letters (Schoenberg A -> Schoenberg), or null if nothing was removed
function withoutGeneralWords(name) {
  const words = name.trim().split(/[\s-]+/);
  const placeWords = words.filter(word => {
    const lower = word.toLowerCase();
    return !GENERAL_WORDS.includes(lower) && !DIRECTION_WORDS.includes(lower) && !/^\p{L}$/u.test(word); // \p{L}: any single letter
  });
  if (placeWords.length === words.length || placeWords.length === 0) return null; // nothing removed, or nothing left
  return placeWords.join(" ");
}

// Countries whose names come from Jira with umlauts spelled out ("Goennebek"), and how to write them back
const GERMAN_UMLAUTS = { ae: "ä", oe: "ö", ue: "ü" };
const UMLAUTS_BY_COUNTRY = {
  DE: GERMAN_UMLAUTS, AT: GERMAN_UMLAUTS, CH: GERMAN_UMLAUTS, LU: GERMAN_UMLAUTS, LI: GERMAN_UMLAUTS, EE: GERMAN_UMLAUTS,
  SE: { ae: "ä", oe: "ö", aa: "å" },
  FI: { ae: "ä", oe: "ö", aa: "å" },
  DK: { ae: "æ", oe: "ø", aa: "å" },
  NO: { ae: "æ", oe: "ø", aa: "å" },
};

// Returns the name with its umlauts written back (Goennebek -> Gönnebek), or null if there is nothing to change
// Without country, the German umlauts are used (most of our locations are German)
function umlautVariant(name, countryCode) {
  const umlauts = countryCode ? UMLAUTS_BY_COUNTRY[countryCode] : GERMAN_UMLAUTS;
  if (!umlauts) return null; // this country doesn't use umlauts, e.g. "Puerto" in ES must stay as it is

  // (?<![eq]) because "ue" after "q" or "e" is never an umlaut: Quedlinburg, Neuenkirchen
  const variant = name.replace(/ae|oe|(?<![eq])ue|aa/gi, letters => {
    const umlaut = umlauts[letters.toLowerCase()];
    if (!umlaut) return letters; // e.g. "aa" in a German name
    return letters[0] === letters[0].toUpperCase() ? umlaut.toUpperCase() : umlaut; // "Oe" -> "Ö"
  });
  return variant !== name ? variant : null;
}

// Calls the geocoder once and returns all the places with exactly the same name (in the geocoder's order), or []
// (the geocoder also returns places whose name just starts like ours, e.g. "Cent" -> "Central Coast")
async function searchPlaces(name, countryCode) {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?` + `name=${encodeURIComponent(name)}` + `&count=10&language=en&format=json`
      + (countryCode ? `&countryCode=${countryCode}` : ""); // only search in that country, e.g. "DE"
    const response = await fetch(url);
    if (!response.ok) return [];

    const data = await response.json();
    // without matches the response has no "results" key
    return data.results?.filter(place => isSameName(place.name, name)) ?? [];
  } catch {
    return []; // network error: handled as unresolved
  }
}

// Calls the geocoder once and returns the first place with exactly the same name, or null
// Several places with the same name -> the first one
async function searchPlace(name, countryCode) {
  return (await searchPlaces(name, countryCode))[0] ?? null;
}

// Max distance between the two places of a name like "Passow Benthen". Real neighbouring villages were 3-6 km apart,
// wrong pairs (another Rosendahl, another Bergheim) started at ~19 km
const MAX_DISTANCE_BETWEEN_PLACES_KM = 15;

// Distance in km between two points on Earth (haversine formula)
function distanceKm(a, b) {
  const toRad = degrees => degrees * Math.PI / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// Searches all the places with one name: as it is, else with umlauts (Doerphof -> Dörphof)
async function searchPlacesOrUmlautVariant(name, countryCode) {
  const places = await searchPlaces(name, countryCode);
  if (places.length > 0) return places;
  const variant = umlautVariant(name, countryCode);
  return variant ? await searchPlaces(variant, countryCode) : [];
}

// Wind parks are often named after two neighbouring places: "Passow Benthen", "Hueckelhoven Brachelen"
// As there can be several places with each name (several Passow), all combinations are compared and the closest pair is used
// Returns the midpoint of that pair, or null if the name hasn't exactly 2 words, a place isn't found,
// or no pair is in the same country and close enough
async function searchTwoPlaces(name, countryCode) {
  const names = name.trim().split(/[\s-]+/);
  if (names.length !== 2) return null;

  const firstCandidates = await searchPlacesOrUmlautVariant(names[0], countryCode);
  if (firstCandidates.length === 0) return null;
  const secondCandidates = await searchPlacesOrUmlautVariant(names[1], countryCode);
  if (secondCandidates.length === 0) return null;

  let closest = null;
  for (const first of firstCandidates) {
    for (const second of secondCandidates) {
      if (first.country_code !== second.country_code) continue; // only possible when there is no countryCode filter
      const distance = distanceKm(first, second);
      if (!closest || distance < closest.distance) {
        closest = { first, second, distance };
      }
    }
  }
  if (!closest || closest.distance > MAX_DISTANCE_BETWEEN_PLACES_KM) return null;

  return {
    latitude: (closest.first.latitude + closest.second.latitude) / 2,
    longitude: (closest.first.longitude + closest.second.longitude) / 2
  };
}

async function createLocation(latitude, longitude, locationName, groupId = undefined, countryCode = undefined) {

  if (latitude == null && longitude == null) {
    // Each call only if the previous ones failed:
    // 1) the name as it is
    // 2) without general words and directions (only if something was removed): Tarnow Sued -> Tarnow
    // 3) with umlauts, on the name of step 2 or else the original (only if the name has spelled-out umlauts): Goennebek -> Gönnebek
    // 4) if the name of step 2 (or else the original) has 2 words, each word as a place: midpoint if both are found and close
    // Still unresolved -> manual review
    let result = await searchPlace(locationName, countryCode);
    const cleanedName = withoutGeneralWords(locationName);

    if (!result && cleanedName) {
      result = await searchPlace(cleanedName, countryCode);
    }

    if (!result) {
      const variant = umlautVariant(cleanedName ?? locationName, countryCode);
      if (variant) {
        result = await searchPlace(variant, countryCode);
      }
    }

    if (!result) {
      result = await searchTwoPlaces(cleanedName ?? locationName, countryCode);
    }

    if (!result) {
      unresolvedLocations.push({ name: locationName, groupId: groupId });
      return;
    }

    latitude = result.latitude;
    longitude = result.longitude;
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

  return newLoc;
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
