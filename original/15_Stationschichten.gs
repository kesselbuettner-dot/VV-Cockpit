// =====================================================
// FF HOLZHAUSEN – STATIONSCHICHTEN
// 15_Stationschichten.gs
// =====================================================
//
// Stationschichten sind die Quelle der Grundplanung:
// Station + Zeit + benötigte Helfer + konkrete Helfer.
// Daraus kann der Tages-Dienstplan erzeugt werden.
// Einzelne Korrekturen im Dienstplan bleiben danach möglich.
// =====================================================

function stationschichtenSheet_() {
  const ss = dbGetSpreadsheet();
  let sheet = ss.getSheetByName('Stationschichten');
  if (!sheet) {
    sheet = ss.insertSheet('Stationschichten');
    sheet.getRange(1,1,1,9).setValues([[
      'Datum','Station','Schicht','Von','Bis','Helfer-Nr.','Helfer','Notiz','Geändert'
    ]]);
    sheet.setFrozenRows(1);
  } else if (sheet.getLastColumn() < 9) {
    sheet.getRange(1,1,1,9).setValues([[
      'Datum','Station','Schicht','Von','Bis','Helfer-Nr.','Helfer','Notiz','Geändert'
    ]]);
  }
  return sheet;
}

function stationschichtenLaden(password, datum) {
  if (!getRole(password)) throw new Error('Falsches Passwort.');
  const tag = tagesplanDatum_(datum);
  if (!tag) throw new Error('Ungültiges Veranstaltungsdatum.');

  const sheet = stationschichtenSheet_();
  const last = sheet.getLastRow();
  const rows = last >= 2 ? sheet.getRange(2,1,last-1,9).getValues() : [];
  const stationMap = {};
  (dbGetStations() || []).forEach(s => stationMap[String(s.name).trim()] = s);
  const helperMap = {};
  (dbGetHelpers() || []).forEach(h => helperMap[String(Number(h.nr))] = h);

  const grouped = {};
  rows.forEach(r => {
    if (tagesplanDatum_(r[0]) !== tag) return;
    const station = String(r[1] || '').trim();
    const schicht = Number(r[2]) || 1;
    const von = dienstplanungZeit_(r[3]);
    const bis = dienstplanungZeit_(r[4]);
    if (!station || !von || !bis) return;
    const key = station + '|' + schicht + '|' + von + '|' + bis;
    if (!grouped[key]) {
      grouped[key] = { id:key, station:station, schicht:schicht, von:von, bis:bis, helfer:[], notiz:String(r[7]||'') };
    }
    const nr = Number(r[5]);
    if (nr > 0) grouped[key].helfer.push(nr);
  });

  const shifts = Object.keys(grouped).map(k => grouped[k]);
  shifts.sort((a,b) => a.von.localeCompare(b.von) || a.station.localeCompare(b.station,'de') || a.schicht-b.schicht);
  return { ok:true, datum:tag, shifts:shifts, stations:dbGetStations(), helpers:dbGetHelpers() };
}

function stationschichtenSpeichern(password, datum, shifts) {
  if (getRole(password) !== 'admin') throw new Error('Nur der Admin darf Stationschichten speichern.');
  const tag = tagesplanDatum_(datum);
  if (!tag) throw new Error('Ungültiges Veranstaltungsdatum.');
  if (!Array.isArray(shifts)) shifts = [];

  const stations = dbGetStations() || [];
  const stationMap = {};
  stations.forEach(s => stationMap[String(s.name).trim()] = s);
  const helpers = dbGetHelpers() || [];
  const helperMap = {};
  helpers.forEach(h => helperMap[String(Number(h.nr))] = h);

  const clean = [];
  const occupied = {};
  const helperShift = {};
  const warnings = [];

  shifts.forEach((raw, index) => {
    const station = String(raw && raw.station || '').trim();
    const von = dienstplanungZeit_(raw && raw.von);
    const bis = dienstplanungZeit_(raw && raw.bis);
    const schicht = Math.max(1, Number(raw && raw.schicht) || index + 1);
    const notiz = String(raw && raw.notiz || '').trim();
    if (!station && !von && !bis && !(raw && Array.isArray(raw.helfer) && raw.helfer.length)) return;
    if (!station) throw new Error('Stationschicht ' + (index+1) + ': Station fehlt.');
    if (!stationMap[station]) throw new Error('Unbekannte Station: ' + station);
    if (!von || !bis || dienstplanungZeitMinuten_(bis) <= dienstplanungZeitMinuten_(von)) {
      throw new Error('Stationschicht ' + (index+1) + ': Ungültiger Zeitraum.');
    }
    // Die Stationschicht ist die konkrete Grundplanung.
    // Ihre Von/Bis-Zeit darf deshalb bewusst von der in der
    // Stationsverwaltung hinterlegten Tageszeit abweichen.
    // Die Tageszeit dient weiterhin der normalen manuellen
    // Stationsauswahl und als Information, blockiert aber nicht
    // das Anlegen einer bewusst geplanten Stationschicht.

    const nrs = Array.isArray(raw.helfer) ? raw.helfer.map(Number).filter(n => Number.isFinite(n) && n > 0) : [];
    const unique = [...new Set(nrs)];
    const needed = Math.max(1, Number(stationMap[station].needed) || 1);
    if (unique.length < needed) warnings.push('Station "' + station + '": zu wenig Helfer (' + unique.length + '/' + needed + ').');
    if (unique.length > needed) warnings.push('Station "' + station + '": zu viele Helfer (' + unique.length + '/' + needed + ').');
    // Zu viele/zu wenige Helfer sind nur ein Hinweis. Die Grundplanung
    // darf bewusst vorübergehend unvollständig oder überbesetzt sein.
    unique.forEach(nr => {
      if (!helperMap[String(nr)]) throw new Error('Unbekannte Helfer-Nr. ' + nr + '.');
      const h = helperMap[String(nr)];
      const shiftKey = String(nr);
      if (helperShift[shiftKey] !== undefined && Number(helperShift[shiftKey]) !== Number(schicht)) {
        throw new Error((h.vorname+' '+h.nachname).trim() + ' ist bereits Schicht ' + helperShift[shiftKey] + ' zugeordnet und kann nicht zusätzlich Schicht ' + schicht + ' übernehmen.');
      }
      helperShift[shiftKey] = Number(schicht);
      const suitable = helperStationGeeignet_(h, stationMap[station]);
      if (!suitable) throw new Error((h.vorname+' '+h.nachname).trim() + ' ist für die Station "' + station + '" nicht als geeignet hinterlegt.');
      const key = String(nr);
      if (!occupied[key]) occupied[key] = [];
      occupied[key].forEach(x => {
        if (dienstplanungZeitMinuten_(von) < dienstplanungZeitMinuten_(x.bis) && dienstplanungZeitMinuten_(bis) > dienstplanungZeitMinuten_(x.von)) {
          throw new Error((h.vorname+' '+h.nachname).trim() + ' hat überschneidende Stationschichten: ' + x.station + ' und ' + station + '.');
        }
      });
      occupied[key].push({von:von,bis:bis,station:station});
    });

    clean.push({station:station,schicht:schicht,von:von,bis:bis,helfer:unique,notiz:notiz});
  });

  const sheet = stationschichtenSheet_();
  const last = sheet.getLastRow();
  const keep = [];
  if (last >= 2) {
    sheet.getRange(2,1,last-1,9).getValues().forEach(r => {
      if (tagesplanDatum_(r[0]) !== tag) keep.push(r);
    });
  }

  const rows = [];
  clean.forEach(s => {
    if (!s.helfer.length) {
      rows.push([tag,s.station,s.schicht,s.von,s.bis,'','',s.notiz,new Date()]);
    } else {
      s.helfer.forEach(nr => {
        const h = helperMap[String(nr)];
        rows.push([tag,s.station,s.schicht,s.von,s.bis,nr,(h.vorname+' '+h.nachname).trim(),s.notiz,new Date()]);
      });
    }
  });

  const all = keep.concat(rows);
  const max = Math.max(last-1, all.length, 1);
  sheet.getRange(2,1,max,9).clearContent();
  if (all.length) sheet.getRange(2,1,all.length,9).setValues(all);
  SpreadsheetApp.flush();
  const result = stationschichtenLaden(password, tag);
  result.warnings = warnings;
  return result;
}

function stationschichtenDienstplanErzeugen(password, datum) {
  if (getRole(password) !== 'admin') throw new Error('Nur der Admin darf den Dienstplan erzeugen.');
  const tag = tagesplanDatum_(datum);
  if (!tag) throw new Error('Ungültiges Veranstaltungsdatum.');
  const loaded = stationschichtenLaden(password, tag);
  const plan = {};
  (loaded.shifts || []).forEach(s => {
    (s.helfer || []).forEach(nr => {
      const key = String(Number(nr));
      if (!plan[key]) plan[key] = {nr:Number(nr), raster:{}};
      for (let m=dienstplanungZeitMinuten_(s.von); m<dienstplanungZeitMinuten_(s.bis); m+=30) {
        plan[key].raster[minutesToTime(m)] = s.station;
      }
    });
  });
  return dienstplanungTagesSpeichern(password, tag, plan);
}

function stationAnTagVerfuegbar_(station, datum, von, bis) {
  const tage = Array.isArray(station && station.tage) ? station.tage : [];
  if (!tage.length) return true;
  const day = tage.find(t => String(t && t.datum || '').trim() === datum);
  if (!day) return false;
  const start = dienstplanungZeitMinuten_(day.von || day.start);
  const end = dienstplanungZeitMinuten_(day.bis || day.end);
  return Number.isFinite(start) && Number.isFinite(end) &&
    dienstplanungZeitMinuten_(von) >= start && dienstplanungZeitMinuten_(bis) <= end;
}

function helperStationGeeignet_(helper, station) {
  const raw = String(helper && (helper.suitableStations || helper.geeigneteStationen) || '').trim();
  if (!raw) return true;
  const wanted = raw.split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  const name = String(station && station.name || '').trim().toLowerCase();
  const short = String(station && (station.short || station.kurz) || '').trim().toLowerCase();
  return wanted.includes(name) || (short && wanted.includes(short));
}
