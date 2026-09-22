// =====================================================
// FF HOLZHAUSEN – HELFER-DIENSTPLAN
// Code.gs
// =====================================================

const CONFIG = {
  HELFER_SHEET: 'Helferliste',
  PLAN_SHEET: 'Dienstplan',
  STATION_SHEET: 'Stationen',
  SETTINGS_SHEET: 'Einstellungen',

  PASSWORD_KEY: 'APP_PASSWORD',
  VIEWER_PASSWORD_KEY: 'VIEWER_PASSWORD',
  KASSE_PASSWORD_KEY: 'KASSE_PASSWORD',

  DEFAULT_PASSWORD: 'Wache48',
  DEFAULT_VIEWER_PASSWORD: 'Helfer123',
  DEFAULT_KASSE_PASSWORD: 'Kasse48',

  DEFAULT_START: '12:00',
  DEFAULT_END: '22:00',
  DEFAULT_STEP: 30
};


// =====================================================
// WEB-APP
// =====================================================

function doGet() {
  return HtmlService
    .createHtmlOutputFromFile('Index')
    .setTitle('Helfer-Dienstplan – FF Holzhausen')
    .setXFrameOptionsMode(
      HtmlService.XFrameOptionsMode.ALLOWALL
    );
}


// =====================================================
// EINRICHTUNG
// =====================================================

function setup() {

  const props =
    PropertiesService.getScriptProperties();

  // Admin-Passwort
  if (!props.getProperty(CONFIG.PASSWORD_KEY)) {
    props.setProperty(
      CONFIG.PASSWORD_KEY,
      CONFIG.DEFAULT_PASSWORD
    );
  }

  // Viewer-Passwort
  if (!props.getProperty(CONFIG.VIEWER_PASSWORD_KEY)) {
    props.setProperty(
      CONFIG.VIEWER_PASSWORD_KEY,
      CONFIG.DEFAULT_VIEWER_PASSWORD
    );
  }

  // Kassen-Passwort – ausschließlich für die read-only Rechenhilfe
  if (!props.getProperty(CONFIG.KASSE_PASSWORD_KEY)) {
    props.setProperty(
      CONFIG.KASSE_PASSWORD_KEY,
      CONFIG.DEFAULT_KASSE_PASSWORD
    );
  }

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();


  // -----------------------------------------------------
  // HELFERLISTE
  // -----------------------------------------------------

  let sheet =
    ss.getSheetByName(CONFIG.HELFER_SHEET);

  if (!sheet) {

    sheet =
      ss.insertSheet(CONFIG.HELFER_SHEET);

    sheet.appendRow([
      'Nr.',
      'Nachname',
      'Vorname',
      'Teilnahme',
      'Ankunft',
      'Bemerkung',
      'E-Mail',
      'Geeignete Stationen'
    ]);
  }


  // -----------------------------------------------------
  // DIENSTPLAN
  // -----------------------------------------------------

  sheet =
    ss.getSheetByName(CONFIG.PLAN_SHEET);

  if (!sheet) {

    sheet =
      ss.insertSheet(CONFIG.PLAN_SHEET);

    sheet.appendRow([
      'Nr.',
      'Nachname',
      'Vorname',

      'Schicht 1 Station',
      'Schicht 1 Von',
      'Schicht 1 Bis',

      'Schicht 2 Station',
      'Schicht 2 Von',
      'Schicht 2 Bis',

      'Schicht 3 Station',
      'Schicht 3 Von',
      'Schicht 3 Bis',

      'Notiz'
    ]);
  }


  // -----------------------------------------------------
  // STATIONEN
  // -----------------------------------------------------

  sheet =
    ss.getSheetByName(CONFIG.STATION_SHEET);

  if (!sheet) {

    sheet =
      ss.insertSheet(CONFIG.STATION_SHEET);

    sheet.appendRow([
      'Station',
      'Kürzel',
      'Farbe',
      'Benötigte Helfer',
      'Google Maps',
      'Hinweis',
      'Tageszeiten'
    ]);
  }


  // -----------------------------------------------------
  // EINSTELLUNGEN
  // -----------------------------------------------------

  sheet =
    ss.getSheetByName(CONFIG.SETTINGS_SHEET);

  if (!sheet) {

    sheet =
      ss.insertSheet(CONFIG.SETTINGS_SHEET);

    sheet.appendRow([
      'Einstellung',
      'Wert'
    ]);

    sheet.appendRow([
      'Beginn',
      CONFIG.DEFAULT_START
    ]);

    sheet.appendRow([
      'Ende',
      CONFIG.DEFAULT_END
    ]);

    sheet.appendRow([
      'Raster',
      CONFIG.DEFAULT_STEP
    ]);

    sheet.appendRow([
      'Theme',
      'feuerwehr'
    ]);

    sheet.appendRow([
      'Hauptfarbe',
      '#C62828'
    ]);

    sheet.appendRow([
      'Hintergrund',
      '#F4F4F4'
    ]);

    sheet.appendRow([
      'Kopfzeile',
      '#8E0000'
    ]);

    sheet.appendRow([
      'Buttonfarbe',
      '#C62828'
    ]);

    sheet.appendRow([
      'Schriftfarbe',
      '#FFFFFF'
    ]);
  }

  // Spalten für Stations-Eignung und tagesbezogene Stationszeiten
  if (ss.getSheetByName(CONFIG.HELFER_SHEET)) {
    var hs = ss.getSheetByName(CONFIG.HELFER_SHEET);
    if (hs.getLastColumn() < 8) hs.getRange(1, 8).setValue('Geeignete Stationen');
  }
  if (ss.getSheetByName(CONFIG.STATION_SHEET)) {
    var st = ss.getSheetByName(CONFIG.STATION_SHEET);
    if (st.getLastColumn() < 7) st.getRange(1, 7).setValue('Tageszeiten');
  }
  helferGeeigneteStationenValidierung_();

  return 'Einrichtung abgeschlossen.';
}


// =====================================================
// LOGIN
// =====================================================

function getRole(password) {

  const props =
    PropertiesService.getScriptProperties();

  let adminPassword =
    props.getProperty(CONFIG.PASSWORD_KEY);

  let viewerPassword =
    props.getProperty(CONFIG.VIEWER_PASSWORD_KEY);

  let kassePassword =
    props.getProperty(CONFIG.KASSE_PASSWORD_KEY);


  // Falls setup noch nicht ausgeführt wurde,
  // funktionieren die Standardpasswörter trotzdem.
  if (!adminPassword) {
    adminPassword =
      CONFIG.DEFAULT_PASSWORD;
  }

  if (!viewerPassword) {
    viewerPassword =
      CONFIG.DEFAULT_VIEWER_PASSWORD;
  }

  if (!kassePassword) {
    kassePassword =
      CONFIG.DEFAULT_KASSE_PASSWORD;
  }


  if (
    password &&
    password === adminPassword
  ) {
    return 'admin';
  }


  if (
    password &&
    password === viewerPassword
  ) {
    return 'viewer';
  }

  if (
    password &&
    password === kassePassword
  ) {
    return 'kasse';
  }

  return '';
}


function checkPassword(password) {
  return getRole(password) !== '';
}


// =====================================================
// GESAMTDATEN
// =====================================================

function getAllData(password) {

  const role =
    getRole(password);

  if (!role) {
    throw new Error('Falsches Passwort.');
  }


  const ss =
    SpreadsheetApp.getActiveSpreadsheet();


  // ===================================================
  // HELFER
  // ===================================================

  const helperSheet =
    ss.getSheetByName(
      CONFIG.HELFER_SHEET
    );

  if (!helperSheet) {
    throw new Error(
      'Tabellenblatt "Helferliste" wurde nicht gefunden.'
    );
  }


  const lastHelperRow =
    helperSheet.getLastRow();

  const helpers = [];


  if (lastHelperRow >= 2) {

    const values =
      helperSheet
        .getRange(
          2,
          1,
          lastHelperRow - 1,
          8
        )
        .getValues();


    values.forEach(
      (r, index) => {

        const nachname =
          String(r[1] || '').trim();

        const vorname =
          String(r[2] || '').trim();


        // Leere Zeilen überspringen
        if (!nachname && !vorname) {
          return;
        }


        let nr =
          r[0];

        if (
          nr === '' ||
          nr === null ||
          nr === undefined
        ) {
          nr = index + 1;
        }


        helpers.push({

          // tatsächliche Tabellenzeile
          row: index + 2,

          nr: Number(nr),

          nachname:
            nachname,

          vorname:
            vorname,

          teilnahme:
            String(r[3] || '').trim(),

          ankunft:
            fmtTime(r[4]),

          bemerkung:
            String(r[5] || '').trim(),

          email:
            String(r[6] || '').trim(),

          suitableStations:
            String(r[7] || '').trim()
        });
      }
    );
  }


  // ===================================================
  // DIENSTPLAN
  // ===================================================

  const planSheet =
    ss.getSheetByName(
      CONFIG.PLAN_SHEET
    );

  const plan = {};


  if (planSheet && planSheet.getLastRow() >= 2) {

    const values =
      planSheet
        .getRange(
          2,
          1,
          planSheet.getLastRow() - 1,
          13
        )
        .getValues();


    values.forEach(
      (r, index) => {

        let nr =
          r[0];

        if (
          nr === '' ||
          nr === null ||
          nr === undefined
        ) {
          nr = index + 1;
        }


        nr = Number(nr);

        if (!nr) {
          return;
        }


        const key =
          String(nr);

        plan[key] = {};


        // Drei Schichten
        for (
          let s = 0;
          s < 3;
          s++
        ) {

          const station =
            String(
              r[3 + s * 3] || ''
            ).trim();

          const von =
            fmtTime(
              r[4 + s * 3]
            );

          const bis =
            fmtTime(
              r[5 + s * 3]
            );


          if (
            station &&
            von &&
            bis
          ) {

            addTimeRange(
              plan[key],
              von,
              bis,
              station
            );
          }
        }
      }
    );
  }


  // ===================================================
  // STATIONEN
  // ===================================================

  const stationSheet =
    ss.getSheetByName(
      CONFIG.STATION_SHEET
    );

  const stations = [];


  if (
    stationSheet &&
    stationSheet.getLastRow() >= 2
  ) {

    const rows =
      stationSheet
        .getRange(
          2,
          1,
          stationSheet.getLastRow() - 1,
          7
        )
        .getValues();


    rows.forEach(
      (r, index) => {

        const name =
          String(r[0] || '').trim();

        if (!name) {
          return;
        }


        stations.push({

          row:
            index + 2,

          name:
            name,

          short:
            String(
              r[1] ||
              name.charAt(0)
            ).trim(),

          color:
            String(
              r[2] ||
              getStationColor(index)
            ).trim(),

          needed:
            Number(r[3]) || 1,

          maps:
            String(r[4] || '').trim(),

          hint:
            String(r[5] || '').trim(),

          tage:
            parseStationDayTimes_(r[6])
        });
      }
    );
  }


  // ===================================================
  // EINSTELLUNGEN
  // ===================================================

  const settings =
    getSettings();


  return {

    role:
      role,

    helpers:
      helpers,

    stations:
      stations,

    settings:
      settings,

    plan:
      plan
  };
}


// =====================================================
// EINSTELLUNGEN LADEN
// =====================================================

function getSettings() {

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const sheet =
    ss.getSheetByName(
      CONFIG.SETTINGS_SHEET
    );


  const result = {

    start:
      CONFIG.DEFAULT_START,

    end:
      CONFIG.DEFAULT_END,

    step:
      CONFIG.DEFAULT_STEP,

    theme:
      'feuerwehr',

    mainColor:
      '#C62828',

    background:
      '#F4F4F4',

    headerColor:
      '#8E0000',

    buttonColor:
      '#C62828',

    textColor:
      '#FFFFFF'
  };


  if (
    !sheet ||
    sheet.getLastRow() < 2
  ) {
    return result;
  }


  const values =
    sheet
      .getRange(
        2,
        1,
        sheet.getLastRow() - 1,
        2
      )
      .getValues();


  values.forEach(
    r => {

      const key =
        String(
          r[0] || ''
        )
        .trim()
        .toLowerCase();

      const value =
        String(
          r[1] || ''
        ).trim();


      if (key === 'beginn') {
        result.start =
          fmtTime(value);
      }

      else if (key === 'ende') {
        result.end =
          fmtTime(value);
      }

      else if (key === 'raster') {
        result.step =
          Number(value) || 30;
      }

      else if (key === 'theme') {
        result.theme =
          value || 'feuerwehr';
      }

      else if (key === 'hauptfarbe') {
        result.mainColor =
          value;
      }

      else if (key === 'hintergrund') {
        result.background =
          value;
      }

      else if (key === 'kopfzeile') {
        result.headerColor =
          value;
      }

      else if (key === 'buttonfarbe') {
        result.buttonColor =
          value;
      }

      else if (key === 'schriftfarbe') {
        result.textColor =
          value;
      }
    }
  );


  return result;
}


// =====================================================
// DIENSTPLAN SPEICHERN
// =====================================================

function saveGraphPlan(
  password,
  helperNumber,
  plan
) {

  if (
    getRole(password) !== 'admin'
  ) {
    throw new Error(
      'Nur der Admin darf den Dienstplan bearbeiten.'
    );
  }


  const ss =
    SpreadsheetApp.getActiveSpreadsheet();


  const sheet =
    ss.getSheetByName(
      CONFIG.PLAN_SHEET
    );

  if (!sheet) {
    throw new Error(
      'Tabellenblatt "Dienstplan" fehlt.'
    );
  }


  const helperSheet =
    ss.getSheetByName(
      CONFIG.HELFER_SHEET
    );

  if (!helperSheet) {
    throw new Error(
      'Tabellenblatt "Helferliste" fehlt.'
    );
  }


  // ---------------------------------------------------
  // Helfer suchen
  // ---------------------------------------------------

  const helperValues =
    helperSheet
      .getDataRange()
      .getValues();


  let helper = null;


  for (
    let i = 1;
    i < helperValues.length;
    i++
  ) {

    if (
      Number(helperValues[i][0]) ===
      Number(helperNumber)
    ) {

      helper =
        helperValues[i];

      break;
    }
  }


  if (!helper) {
    throw new Error(
      'Helfer wurde nicht gefunden.'
    );
  }


  // ---------------------------------------------------
  // Dienstplan-Zeile suchen
  // ---------------------------------------------------

  const data =
    sheet
      .getDataRange()
      .getValues();


  let row = -1;


  for (
    let i = 1;
    i < data.length;
    i++
  ) {

    if (
      Number(data[i][0]) ===
      Number(helperNumber)
    ) {

      row =
        i + 1;

      break;
    }
  }


  // Falls noch keine Zeile existiert
  if (row === -1) {

    sheet.appendRow([

      helper[0],
      helper[1],
      helper[2],

      '',
      '',
      '',

      '',
      '',
      '',

      '',
      '',
      '',

      ''
    ]);

    row =
      sheet.getLastRow();
  }


  // ---------------------------------------------------
  // Zeitfelder sortieren
  // ---------------------------------------------------

  const times =
    Object.keys(plan || {})
      .filter(
        t => plan[t]
      )
      .sort(
        (a, b) =>
          timeToMinutes(a) -
          timeToMinutes(b)
      );


  // ---------------------------------------------------
  // Zeitbereiche zusammenfassen
  // ---------------------------------------------------

  const groups = [];


  times.forEach(
    time => {

      const station =
        plan[time];

      const start =
        timeToMinutes(time);


      const last =
        groups[
          groups.length - 1
        ];


      if (
        !last ||
        last.station !== station ||
        last.end !== start
      ) {

        groups.push({

          station:
            station,

          start:
            start,

          end:
            start + 30
        });

      } else {

        last.end += 30;
      }
    }
  );


  // ---------------------------------------------------
  // Maximal 3 Schichten speichern
  // ---------------------------------------------------

  const result = [];


  for (
    let i = 0;
    i < 3;
    i++
  ) {

    if (groups[i]) {

      result.push(
        groups[i].station,

        minutesToTime(
          groups[i].start
        ),

        minutesToTime(
          groups[i].end
        )
      );

    } else {

      result.push(
        '',
        '',
        ''
      );
    }
  }


  // ---------------------------------------------------
  // Schichten D-L schreiben
  // ---------------------------------------------------

  sheet
    .getRange(
      row,
      4,
      1,
      9
    )
    .setValues([
      result
    ]);


  return true;
}


// =====================================================
// GESPEICHERTEN DIENSTPLAN FÜR EINEN HELFER LADEN
// =====================================================
// Liest den tatsächlich im Tabellenblatt "Dienstplan"
// gespeicherten Plan und wandelt Schicht 1-3 wieder in
// das 30-Minuten-Raster um.
// =====================================================
function dienstplanGespeichertFuerHelfer(nr) {

  const nummer = Number(nr);
  if (!Number.isFinite(nummer) || nummer <= 0) {
    throw new Error('Ungültige Helfer-Nr.');
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.PLAN_SHEET);
  if (!sheet) throw new Error('Tabellenblatt "Dienstplan" fehlt.');

  const data = sheet.getDataRange().getValues();
  let row = null;

  for (let i = 1; i < data.length; i++) {
    if (Number(data[i][0]) === nummer) {
      row = data[i];
      break;
    }
  }

  const raster = {};

  if (!row) {
    return { ok: true, nr: nummer, raster: raster };
  }

  // D-L = 3 Schichten mit jeweils Station / Beginn / Ende.
  for (let block = 0; block < 3; block++) {
    const base = 3 + block * 3;
    const station = String(row[base] || '').trim();
    const start = normalizeSheetTime_(row[base + 1]);
    const end = normalizeSheetTime_(row[base + 2]);

    if (!station || !start || !end) continue;

    let from = timeToMinutes(start);
    const to = timeToMinutes(end);

    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) continue;

    while (from < to) {
      raster[minutesToTime(from)] = station;
      from += 30;
    }
  }

  return {
    ok: true,
    nr: nummer,
    raster: raster
  };
}

function normalizeSheetTime_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'HH:mm');
  }

  const s = String(value == null ? '' : value).trim();
  if (!s) return '';

  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return '';

  return String(Number(m[1])).padStart(2, '0') + ':' + m[2];
}

// =====================================================
// HELFER HINZUFÜGEN
// =====================================================

function addPerson(
  password,
  nachname,
  vorname,
  email,
  ankunft,
  bemerkung
) {

  if (
    getRole(password) !== 'admin'
  ) {
    throw new Error(
      'Nur der Admin darf Helfer hinzufügen.'
    );
  }


  nachname =
    String(nachname || '').trim();

  vorname =
    String(vorname || '').trim();

  email =
    String(email || '').trim();

  ankunft =
    String(ankunft || '').trim();

  bemerkung =
    String(bemerkung || '').trim();


  if (!nachname && !vorname) {
    throw new Error(
      'Bitte Nachname oder Vorname eingeben.'
    );
  }


  const sheet =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(
        CONFIG.HELFER_SHEET
      );


  if (!sheet) {
    throw new Error(
      'Tabellenblatt "Helferliste" fehlt.'
    );
  }


  const lastRow =
    sheet.getLastRow();


  let nr = 1;


  if (lastRow >= 2) {

    const numbers =
      sheet
        .getRange(
          2,
          1,
          lastRow - 1,
          1
        )
        .getValues()
        .flat()
        .map(Number)
        .filter(
          n =>
            !isNaN(n) &&
            n > 0
        );


    if (numbers.length) {
      nr =
        Math.max.apply(
          null,
          numbers
        ) + 1;
    }
  }


  sheet.appendRow([

    nr,

    nachname,

    vorname,

    'ja',

    ankunft,

    bemerkung,

    email
  ]);


  return true;
}


// =====================================================
// HELFER LÖSCHEN
// =====================================================

function deletePerson(
  password,
  row
) {

  if (
    getRole(password) !== 'admin'
  ) {
    throw new Error(
      'Nur der Admin darf Helfer löschen.'
    );
  }


  const sheet =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(
        CONFIG.HELFER_SHEET
      );


  if (!sheet) {
    throw new Error(
      'Tabellenblatt "Helferliste" fehlt.'
    );
  }


  row =
    Number(row);


  if (
    row < 2 ||
    row > sheet.getLastRow()
  ) {
    throw new Error(
      'Ungültige Helfer-Zeile.'
    );
  }


  sheet.deleteRow(row);

  return true;
}


// =====================================================
// STATIONS-TAGESZEITEN / STATIONSVERWALTUNG
// =====================================================

function parseStationDayTimes_(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    var parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function stationenLadenLegacy_Code(password) {
  if (getRole(password) === '') throw new Error('Falsches Passwort.');

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.STATION_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];

  var lastCol = Math.max(7, sheet.getLastColumn());
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, lastCol).getValues();
  var result = [];

  rows.forEach(function(r, index) {
    var name = String(r[0] || '').trim();
    if (!name) return;
    result.push({
      row: index + 2,
      name: name,
      short: String(r[1] || name.charAt(0)).trim(),
      color: String(r[2] || getStationColor(index)).trim(),
      needed: Number(r[3]) || 1,
      maps: String(r[4] || '').trim(),
      hint: String(r[5] || '').trim(),
      tage: parseStationDayTimes_(r[6])
    });
  });

  return result;
}

function stationSpeichernLegacy_Code(password, data) {
  if (getRole(password) !== 'admin') {
    throw new Error('Nur der Admin darf Stationen bearbeiten.');
  }
  data = data || {};
  var name = String(data.name || '').trim();
  if (!name) throw new Error('Stationsname fehlt.');

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.STATION_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.STATION_SHEET);
    sheet.getRange(1, 1, 1, 7).setValues([['Station','Kürzel','Farbe','Benötigte Helfer','Google Maps','Hinweis','Tageszeiten']]);
  }
  if (sheet.getLastColumn() < 7) sheet.getRange(1, 7).setValue('Tageszeiten');

  var row = Number(data.row) || 0;
  var values = [[
    name,
    String(data.short || name.charAt(0).toUpperCase()).trim(),
    String(data.color || '#2563eb').trim(),
    Math.max(1, Number(data.needed) || 1),
    String(data.maps || '').trim(),
    String(data.hint || '').trim(),
    JSON.stringify(Array.isArray(data.tage) ? data.tage : [])
  ]];

  if (row >= 2 && row <= sheet.getLastRow()) {
    sheet.getRange(row, 1, 1, 7).setValues(values);
  } else {
    sheet.appendRow(values[0]);
  }

  return { success: true, stations: stationenLaden(password) };
}

// Beim Auswählen einer Station in Spalte H wird die Auswahl an die
// vorhandene Liste angehängt. Dadurch funktioniert H praktisch wie
// eine Mehrfachauswahl über das Dropdown. Entfernen erfolgt durch
// manuelles Bearbeiten der Zelle.
function onEdit(e) {
  if (!e || !e.range) return;
  var sheet = e.range.getSheet();
  if (sheet.getName() !== CONFIG.HELFER_SHEET) return;
  if (e.range.getRow() < 2 || e.range.getColumn() !== 8) return;
  if (!e.value || !e.oldValue) return;

  var oldItems = String(e.oldValue).split(',').map(function(x){ return x.trim(); }).filter(Boolean);
  var newItem = String(e.value).trim();
  if (!newItem) return;
  if (oldItems.indexOf(newItem) < 0) oldItems.push(newItem);
  e.range.setValue(oldItems.join(', '));
}

function helferGeeigneteStationenValidierung_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var helper = ss.getSheetByName(CONFIG.HELFER_SHEET);
  var station = ss.getSheetByName(CONFIG.STATION_SHEET);
  if (!helper || !station) return;
  if (helper.getLastColumn() < 8) helper.getRange(1, 8).setValue('Geeignete Stationen');
  var last = Math.max(2, station.getLastRow());
  var source = station.getRange(2, 1, Math.max(1, last - 1), 1);
  var rule = SpreadsheetApp.newDataValidation().requireValueInRange(source, true).setAllowInvalid(true).build();
  helper.getRange(2, 8, Math.max(1, helper.getMaxRows() - 1), 1).setDataValidation(rule);
}

// =====================================================
// STATION ANLEGEN
// =====================================================

function addStation(
  password,
  name,
  short,
  color,
  needed,
  maps,
  hint
) {

  if (
    getRole(password) !== 'admin'
  ) {
    throw new Error(
      'Nur der Admin darf Stationen bearbeiten.'
    );
  }


  name =
    String(name || '').trim();


  if (!name) {
    throw new Error(
      'Stationsname fehlt.'
    );
  }


  const sheet =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(
        CONFIG.STATION_SHEET
      );


  if (!sheet) {
    throw new Error(
      'Tabellenblatt "Stationen" fehlt.'
    );
  }


  sheet.appendRow([

    name,

    String(
      short ||
      name.charAt(0).toUpperCase()
    ),

    color ||
      getStationColor(
        sheet.getLastRow()
      ),

    Number(needed) || 1,

    String(maps || ''),

    String(hint || '')
  ]);


  return true;
}


// =====================================================
// STATION ÄNDERN
// =====================================================

function updateStation(
  password,
  row,
  name,
  short,
  color,
  needed,
  maps,
  hint
) {

  if (
    getRole(password) !== 'admin'
  ) {
    throw new Error(
      'Nur der Admin darf Stationen bearbeiten.'
    );
  }


  const sheet =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(
        CONFIG.STATION_SHEET
      );


  if (!sheet) {
    throw new Error(
      'Tabellenblatt "Stationen" fehlt.'
    );
  }


  row =
    Number(row);


  sheet
    .getRange(
      row,
      1,
      1,
      6
    )
    .setValues([[
      String(name || ''),
      String(short || ''),
      String(color || '#C62828'),
      Number(needed) || 1,
      String(maps || ''),
      String(hint || '')
    ]]);


  return true;
}


// =====================================================
// STATION LÖSCHEN
// =====================================================

function deleteStation(
  password,
  row
) {

  if (
    getRole(password) !== 'admin'
  ) {
    throw new Error(
      'Nur der Admin darf Stationen löschen.'
    );
  }


  const sheet =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(
        CONFIG.STATION_SHEET
      );


  if (!sheet) {
    throw new Error(
      'Tabellenblatt "Stationen" fehlt.'
    );
  }


  row =
    Number(row);


  if (
    row < 2 ||
    row > sheet.getLastRow()
  ) {
    throw new Error(
      'Ungültige Stationszeile.'
    );
  }


  sheet.deleteRow(row);

  return true;
}


// =====================================================
// EINSTELLUNGEN SPEICHERN
// =====================================================

function saveSettings(
  password,
  start,
  end,
  theme,
  mainColor,
  background,
  headerColor,
  buttonColor,
  textColor
) {

  if (
    getRole(password) !== 'admin'
  ) {
    throw new Error(
      'Nur der Admin darf Einstellungen ändern.'
    );
  }


  if (
    timeToMinutes(start) >=
    timeToMinutes(end)
  ) {
    throw new Error(
      'Das Ende muss nach dem Beginn liegen.'
    );
  }


  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();


  let sheet =
    ss.getSheetByName(
      CONFIG.SETTINGS_SHEET
    );


  if (!sheet) {

    sheet =
      ss.insertSheet(
        CONFIG.SETTINGS_SHEET
      );

    sheet.appendRow([
      'Einstellung',
      'Wert'
    ]);
  }


  const settings = {

    'Beginn':
      start,

    'Ende':
      end,

    'Raster':
      30,

    'Theme':
      theme,

    'Hauptfarbe':
      mainColor,

    'Hintergrund':
      background,

    'Kopfzeile':
      headerColor,

    'Buttonfarbe':
      buttonColor,

    'Schriftfarbe':
      textColor
  };


  Object.keys(settings)
    .forEach(
      key => {

        const rows =
          sheet
            .getRange(
              1,
              1,
              Math.max(
                1,
                sheet.getLastRow()
              ),
              2
            )
            .getValues();


        let found = false;


        for (
          let i = 1;
          i < rows.length;
          i++
        ) {

          if (
            String(
              rows[i][0]
            ) === key
          ) {

            sheet
              .getRange(
                i + 1,
                2
              )
              .setValue(
                settings[key]
              );

            found = true;

            break;
          }
        }


        if (!found) {

          sheet.appendRow([
            key,
            settings[key]
          ]);
        }
      }
    );


  return true;
}


// =====================================================
// ADMIN PASSWORT
// =====================================================

function setPassword(
  oldPassword,
  newPassword
) {

  if (
    getRole(oldPassword) !== 'admin'
  ) {
    throw new Error(
      'Altes Admin-Passwort ist falsch.'
    );
  }


  if (
    !newPassword ||
    newPassword.length < 6
  ) {
    throw new Error(
      'Das Passwort muss mindestens 6 Zeichen haben.'
    );
  }


  PropertiesService
    .getScriptProperties()
    .setProperty(
      CONFIG.PASSWORD_KEY,
      newPassword
    );


  return true;
}


// =====================================================
// VIEWER PASSWORT
// =====================================================

function setViewerPassword(
  adminPassword,
  newPassword
) {

  if (
    getRole(adminPassword) !== 'admin'
  ) {
    throw new Error(
      'Nur der Admin darf das Ansichts-Passwort ändern.'
    );
  }


  if (
    !newPassword ||
    newPassword.length < 6
  ) {
    throw new Error(
      'Das Passwort muss mindestens 6 Zeichen haben.'
    );
  }


  PropertiesService
    .getScriptProperties()
    .setProperty(
      CONFIG.VIEWER_PASSWORD_KEY,
      newPassword
    );


  return true;
}


// =====================================================
// HILFSFUNKTIONEN
// =====================================================

function addTimeRange(
  target,
  von,
  bis,
  station
) {

  if (!von || !bis) {
    return;
  }


  let start =
    timeToMinutes(von);

  const end =
    timeToMinutes(bis);


  while (
    start < end
  ) {

    target[
      minutesToTime(start)
    ] =
      station;

    start += 30;
  }
}


// =====================================================
// ZEIT → MINUTEN
// =====================================================

function timeToMinutes(time) {

  if (!time) {
    return 0;
  }


  const parts =
    String(time)
      .split(':');


  return (
    Number(parts[0]) * 60 +
    Number(parts[1] || 0)
  );
}


// =====================================================
// MINUTEN → ZEIT
// =====================================================

function minutesToTime(minutes) {

  return String(
    Math.floor(
      minutes / 60
    )
  ).padStart(2, '0')
  + ':' +
  String(
    minutes % 60
  ).padStart(2, '0');
}


// =====================================================
// ZEIT FORMATIEREN
// =====================================================

function fmtTime(value) {

  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return '';
  }


  if (
    Object.prototype.toString.call(value) ===
    '[object Date]'
  ) {

    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone(),
      'HH:mm'
    );
  }


  // Google Sheets kann Uhrzeiten
  // manchmal als Dezimalzahl liefern.
  if (
    typeof value === 'number' &&
    value >= 0 &&
    value < 1
  ) {

    const totalMinutes =
      Math.round(
        value * 24 * 60
      );


    return minutesToTime(
      totalMinutes
    );
  }


  return String(value);
}


// =====================================================
// STATIONSFARBEN
// =====================================================

function getStationColor(index) {

  const colors = [

    '#C62828',
    '#1565C0',
    '#2E7D32',
    '#EF6C00',
    '#6A1B9A',
    '#00838F',
    '#AD1457',
    '#455A64',
    '#795548',
    '#00897B',
    '#5E35B1',
    '#F9A825'

  ];


  return colors[
    Math.abs(index) %
    colors.length
  ];
}



// =====================================================
// DASHBOARD / AUSWERTUNG
// =====================================================
// Liefert kompakte Kennzahlen für die Startseite.
// Das Dashboard kann später um Dienstplan-, Wunschplan-
// und Verkaufszahlen erweitert werden, ohne die übrigen
// Module zu verändern.
function dashboardDaten(password) {
  const role = getRole(password);
  if (!role) throw new Error('Falsches Passwort.');

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const helperSheet = ss.getSheetByName(CONFIG.HELFER_SHEET);
  const stationSheet = ss.getSheetByName(CONFIG.STATION_SHEET);

  let helfer = 0;
  let stationen = 0;
  let stationenMitKarte = 0;

  if (helperSheet && helperSheet.getLastRow() > 1) {
    const values = helperSheet.getRange(2, 1, helperSheet.getLastRow() - 1, 3).getValues();
    helfer = values.filter(r => String(r[1] || '').trim() || String(r[2] || '').trim()).length;
  }

  if (stationSheet && stationSheet.getLastRow() > 1) {
    const width = Math.max(6, stationSheet.getLastColumn());
    const values = stationSheet.getRange(2, 1, stationSheet.getLastRow() - 1, width).getValues();
    values.forEach(r => {
      const name = String(r[0] || '').trim();
      if (!name) return;
      stationen++;
      if (String(r[4] || '').trim()) stationenMitKarte++;
    });
  }

  return {
    helfer: helfer,
    stationen: stationen,
    stationenMitKarte: stationenMitKarte,
    rolle: role
  };
}


// =====================================================
// HELFER HINZUFÜGEN
// =====================================================
// Wird vom Dashboard verwendet. Die Nummer wird automatisch
// aus der nächsten freien Zeile gebildet.
function helferHinzufuegen(password, daten) {
  const role = getRole(password);
  if (role !== 'admin') throw new Error('Nur Administratoren dürfen Helfer speichern.');

  daten = daten || {};

  const nachname = String(daten.nachname || '').trim();
  const vorname = String(daten.vorname || '').trim();
  const teilnahme = String(daten.teilnahme || '').trim();
  const ankunft = String(daten.ankunft || '').trim();
  const bemerkung = String(daten.bemerkung || '').trim();
  const email = String(daten.email || '').trim();
  const suitableStations = String(daten.suitableStations || '').trim();
  const requestedRow = Number(daten.row);
  const requestedNr = Number(daten.nr);

  if (!nachname && !vorname) {
    throw new Error('Bitte mindestens Vorname oder Nachname eingeben.');
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.HELFER_SHEET);
  if (!sheet) throw new Error('Tabellenblatt "Helferliste" wurde nicht gefunden.');

  // Aktuelle Struktur A:H sicherstellen.
  if (sheet.getLastColumn() < 7) sheet.getRange(1, 7).setValue('E-Mail');
  if (sheet.getLastColumn() < 8) sheet.getRange(1, 8).setValue('Geeignete Stationen');

  let targetRow = 0;
  let wasUpdate = false;
  let nr = Number.isFinite(requestedNr) && requestedNr > 0 ? requestedNr : 0;

  // Zuerst über die übergebene Tabellenzeile aktualisieren.
  if (Number.isInteger(requestedRow) && requestedRow >= 2 && requestedRow <= sheet.getLastRow()) {
    targetRow = requestedRow;
    wasUpdate = true;
    if (!nr) nr = Number(sheet.getRange(targetRow, 1).getValue());
  }

  // Alternativ über die Helfer-Nr. aktualisieren.
  if (!targetRow && nr > 0 && sheet.getLastRow() >= 2) {
    const numbers = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    for (let i = 0; i < numbers.length; i++) {
      if (Number(numbers[i][0]) === nr) {
        targetRow = i + 2;
        wasUpdate = true;
        break;
      }
    }
  }

  // Neue Helfer erhalten die nächste freie Nummer.
  if (!targetRow) {
    const lastRow = sheet.getLastRow();
    nr = 1;
    if (lastRow > 1) {
      const nums = sheet.getRange(2, 1, lastRow - 1, 1).getValues()
        .map(r => Number(r[0]))
        .filter(n => Number.isFinite(n) && n > 0);
      if (nums.length) nr = Math.max.apply(null, nums) + 1;
    }
    targetRow = sheet.getLastRow() + 1;
  }

  sheet.getRange(targetRow, 1, 1, 8).setValues([[
    nr, nachname, vorname, teilnahme, ankunft, bemerkung, email, suitableStations
  ]]);

  SpreadsheetApp.flush();

  return {
    success: true,
    updated: wasUpdate,
    helper: {
      row: targetRow,
      nr: nr,
      nachname: nachname,
      vorname: vorname,
      teilnahme: teilnahme,
      ankunft: ankunft,
      bemerkung: bemerkung,
      email: email,
      suitableStations: suitableStations
    },
    helpers: dbGetHelpers()
  };
}

// Einheitlicher Speichern-Endpunkt für das Frontend.
function helferSpeichern(password, daten) {
  return helferHinzufuegen(password, daten);
}

// Expliziter Reload-Endpunkt für die Helferliste.
function helferListeLaden(password) {
  if (!getRole(password)) throw new Error('Falsches Passwort.');
  return dbGetHelpers();
}

// V10: Admin-only delete; reject if any saved plan references the helper.
function helferLoeschen(password,nr){
  if(getRole(password)!=='admin')throw new Error('Nur Administratoren dürfen Helfer löschen.');
  nr=Number(nr);
  if(!Number.isInteger(nr)||nr<=0)throw new Error('Ungültige Helfernummer.');
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const sheet=ss.getSheetByName(CONFIG.HELFER_SHEET);
  if(!sheet)throw new Error('Helferliste fehlt.');
  const last=sheet.getLastRow();
  if(last<2)throw new Error('Helfer nicht gefunden.');
  const nums=sheet.getRange(2,1,last-1,1).getValues();
  const index=nums.findIndex(r=>Number(r[0])===nr);
  if(index<0)throw new Error('Helfer nicht gefunden.');
  const plan=ss.getSheetByName(CONFIG.PLAN_SHEET);
  if(plan&&plan.getLastRow()>1){
    const ids=plan.getRange(2,1,plan.getLastRow()-1,1).getValues();
    if(ids.some(r=>Number(r[0])===nr)){
      throw new Error('Dieser Helfer hat gespeicherte Dienste. Bitte die Dienste zuerst entfernen oder Teilnahme auf Nein setzen.');
    }
  }
  sheet.deleteRow(index+2);
  return {success:true};
}
