// =====================================================
// FF HOLZHAUSEN – STATIONEN SPEICHERN
// Ergänzung für 08_Stationen.gs / 02_Datenbank.gs
// =====================================================

/**
 * Station neu anlegen oder bestehende Station ändern.
 * Tabellenstruktur:
 * A Station
 * B Kürzel
 * C Farbe
 * D Benötigte Helfer
 * E Google Maps
 * F Hinweis
 * G Beginn
 * H Ende
 * I Tageszeiten (JSON)
 */
function stationSpeichernLegacy_Stationen(password, data) {
  const role = getRole(password);
  if (role !== 'admin') {
    throw new Error('Nur der Admin darf Stationen speichern.');
  }

  data = data || {};

  const name = String(data.name || '').trim();
  const short = String(data.short || '').trim() || name.charAt(0).toUpperCase();
  const color = String(data.color || '').trim();
  const maps = String(data.maps || '').trim();
  const hint = String(data.hint || '').trim();
  const start = dbFormatTime(data.start || '');
  const end = dbFormatTime(data.end || '');
  const needed = Number(data.needed || 1);
  const row = Number(data.row || 0);

  if (!name) throw new Error('Bitte einen Stationsnamen eingeben.');
  if (!Number.isFinite(needed) || needed < 1) {
    throw new Error('Benötigte Helfer muss mindestens 1 sein.');
  }
  if ((start && !end) || (!start && end)) {
    throw new Error('Stationsbeginn und Stationsende müssen beide gesetzt werden.');
  }
  if (start && end && dbTimeToMinutes(end) <= dbTimeToMinutes(start)) {
    throw new Error('Das Stationsende muss nach dem Stationsbeginn liegen.');
  }

  const ss = dbGetSpreadsheet();
  const sheet = ss.getSheetByName(APP.SHEETS.STATIONEN);
  if (!sheet) throw new Error('Tabellenblatt "Stationen" wurde nicht gefunden.');

  const lastRow = sheet.getLastRow();
  const existing = lastRow >= 2
    ? sheet.getRange(2, 1, lastRow - 1, Math.max(9, sheet.getLastColumn())).getValues()
    : [];

  // Doppelte Stationsnamen verhindern; beim Bearbeiten die eigene Zeile ausnehmen.
  const duplicate = existing.some(function(r, i) {
    const sheetRow = i + 2;
    return sheetRow !== row && String(r[0] || '').trim().toLowerCase() === name.toLowerCase();
  });
  if (duplicate) throw new Error('Eine Station mit diesem Namen existiert bereits.');

  let targetRow = row;
  if (targetRow < 2 || targetRow > lastRow) {
    targetRow = Math.max(2, lastRow + 1);
  }

  // Bestehende Tagesdaten aus Spalte I erhalten, sofern vorhanden.
  let tage = [];
  if (targetRow <= lastRow) {
    const oldJson = sheet.getRange(targetRow, 9).getValue();
    if (oldJson) {
      try {
        const parsed = JSON.parse(String(oldJson));
        if (Array.isArray(parsed)) {
          tage = parsed.filter(function(t) {
            return t && Number(t.tag) > 0 && dbFormatTime(t.von) && dbFormatTime(t.bis);
          }).map(function(t) {
            return {
              tag: Number(t.tag),
              datum: String(t.datum || '').trim(),
              von: dbFormatTime(t.von),
              bis: dbFormatTime(t.bis)
            };
          });
        }
      } catch (_) {
        tage = [];
      }
    }
  }

  // Wenn keine Tagesdaten vorhanden sind, die neuen Beginn/Ende-Werte als Tag 1 ablegen.
  if (!tage.length && start && end) {
    tage = [{tag: 1, datum: '', von: start, bis: end}];
  }

  const values = [[
    name,
    short,
    color,
    needed,
    maps,
    hint,
    start,
    end,
    tage.length ? JSON.stringify(tage) : ''
  ]];

  sheet.getRange(targetRow, 1, 1, 9).setValues(values);

  SpreadsheetApp.flush();

  return {
    ok: true,
    row: targetRow,
    stations: dbGetStations()
  };
}
