// =====================================================
// FF HOLZHAUSEN – HELFER-DIENSTPLAN
// 09_Maps.gs – OpenStreetMap / Leaflet
// =====================================================
//
// Kartenmodul ohne Google Maps API.
// OpenStreetMap + Leaflet werden in Index.html verwendet.
//
// Spalte E der Stationentabelle enthält die Position als:
//     latitude,longitude
// Beispiel:
//     50.123456,8.654321
//
// Alte Google-Maps-Links werden beim Lesen weiterhin erkannt,
// damit vorhandene Stationen nicht verloren gehen.
// =====================================================

function mapsStationenLaden() {
  return dbGetStations().map(function(station) {
    const coordinates = mapsKoordinatenAusMaps(station.maps);
    return {
      row: station.row,
      name: station.name,
      short: station.short,
      color: station.color,
      needed: station.needed,
      maps: station.maps || '',
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      hint: station.hint
    };
  });
}

function mapsStationLaden(stationName) {
  const station = stationFinden(stationName);
  if (!station) {
    throw new Error('Station "' + String(stationName || '') + '" wurde nicht gefunden.');
  }

  const coordinates = mapsKoordinatenAusMaps(station.maps);
  return {
    ok: true,
    row: station.row,
    name: station.name,
    short: station.short,
    color: station.color,
    needed: station.needed,
    maps: station.maps || '',
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    hint: station.hint
  };
}

// Unterstützt reine Koordinaten sowie vorhandene Google-Maps-Links.
function mapsKoordinatenAusMaps(maps) {
  let value = String(maps || '').trim();

  if (!value) {
    return { latitude: null, longitude: null };
  }

  try {
    value = decodeURIComponent(value);
  } catch (e) {}

  let match = value.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);

  if (!match) {
    match = value.match(/[?&](?:query|q)=(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/i);
  }

  if (!match) {
    match = value.match(/@(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/i);
  }

  if (!match) {
    // Manche Links enthalten die Koordinaten erst nach einem Text.
    match = value.match(/(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
  }

  if (!match) {
    return { latitude: null, longitude: null };
  }

  const latitude = Number(match[1]);
  const longitude = Number(match[2]);

  if (!mapsKoordinatenGueltig(latitude, longitude)) {
    return { latitude: null, longitude: null };
  }

  return { latitude: latitude, longitude: longitude };
}

function mapsKoordinatenGueltig(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function mapsLinkErzeugen(latitude, longitude) {
  if (!mapsKoordinatenGueltig(latitude, longitude)) {
    throw new Error('Ungültige Koordinaten.');
  }

  return 'https://www.openstreetmap.org/?mlat=' +
    encodeURIComponent(Number(latitude)) +
    '&mlon=' + encodeURIComponent(Number(longitude)) +
    '#map=18/' + Number(latitude) + '/' + Number(longitude);
}

function mapsStationPunktSpeichern(password, stationName, latitude, longitude) {
  if (getRole(password) !== 'admin') {
    throw new Error('Nur der Admin darf Stationskoordinaten speichern.');
  }

  const station = stationFinden(stationName);
  if (!station) {
    throw new Error('Station "' + String(stationName || '') + '" wurde nicht gefunden.');
  }

  const lat = Number(latitude);
  const lng = Number(longitude);

  if (!mapsKoordinatenGueltig(lat, lng)) {
    throw new Error('Ungültige Koordinaten.');
  }

  const ss = dbGetSpreadsheet();
  const sheet = ss.getSheetByName(APP.SHEETS.STATIONEN);
  if (!sheet) {
    throw new Error('Tabellenblatt "Stationen" wurde nicht gefunden.');
  }

  // In Spalte E werden ausschließlich die Koordinaten gespeichert.
  const coordinateText = lat.toFixed(7) + ',' + lng.toFixed(7);
  sheet.getRange(station.row, 5).setValue(coordinateText);
  SpreadsheetApp.flush();

  return {
    ok: true,
    row: station.row,
    name: station.name,
    latitude: lat,
    longitude: lng,
    maps: coordinateText,
    osm: mapsLinkErzeugen(lat, lng)
  };
}

function mapsStationPunktLoeschen(password, stationName) {
  if (getRole(password) !== 'admin') {
    throw new Error('Nur der Admin darf Stationskoordinaten löschen.');
  }

  const station = stationFinden(stationName);
  if (!station) {
    throw new Error('Station "' + String(stationName || '') + '" wurde nicht gefunden.');
  }

  const ss = dbGetSpreadsheet();
  const sheet = ss.getSheetByName(APP.SHEETS.STATIONEN);
  if (!sheet) {
    throw new Error('Tabellenblatt "Stationen" wurde nicht gefunden.');
  }

  sheet.getRange(station.row, 5).clearContent();
  SpreadsheetApp.flush();

  return { ok: true, row: station.row, name: station.name };
}

function mapsPlanDaten() {
  const stations = mapsStationenLaden();
  const mapped = stations.filter(function(station) {
    return mapsKoordinatenGueltig(station.latitude, station.longitude);
  });

  return {
    ok: true,
    stations: stations,
    mapped: mapped.length,
    total: stations.length,
    unmapped: stations.length - mapped.length
  };
}

function mapsMittelpunkt(stations) {
  const points = (stations || []).filter(function(station) {
    return mapsKoordinatenGueltig(station.latitude, station.longitude);
  });

  if (!points.length) {
    return { latitude: null, longitude: null };
  }

  let latSum = 0;
  let lngSum = 0;

  points.forEach(function(station) {
    latSum += Number(station.latitude);
    lngSum += Number(station.longitude);
  });

  return {
    latitude: latSum / points.length,
    longitude: lngSum / points.length
  };
}

function mapsKarteLaden() {
  const data = mapsPlanDaten();
  return {
    ok: true,
    center: mapsMittelpunkt(data.stations),
    stations: data.stations,
    mapped: data.mapped,
    total: data.total,
    unmapped: data.unmapped
  };
}
