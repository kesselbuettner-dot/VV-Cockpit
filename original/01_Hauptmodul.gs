// =====================================================
// FF HOLZHAUSEN – HELFER-DIENSTPLAN
// 01_Hauptmodul.gs
// =====================================================
//
// Zentrale Steuerung der neuen Programmstruktur.
// Bestehender Code.gs bleibt während der Umbauphase
// unangetastet.
//
// =====================================================

/**
 * Zentrale Konfiguration
 *
 * Diese Konfiguration ist bewusst klein gehalten.
 * Die eigentlichen Sheet-Zugriffe liegen in
 * 02_Datenbank.gs.
 */
const APP = {

  NAME: 'Helfer-Dienstplan – FF Holzhausen',

  SHEETS: {
    HELFER: 'Helferliste',
    DIENSTPLAN: 'Dienstplan',
    STATIONEN: 'Stationen',
    EINSTELLUNGEN: 'Einstellungen'
  }

};


/**
 * Neuer Einstiegspunkt der zukünftigen Architektur.
 *
 * WICHTIG:
 * Der bestehende doGet() aus Code.gs bleibt zunächst
 * bestehen.
 *
 * Erst wenn die neue Struktur vollständig getestet ist,
 * wird die Web-App auf appDoGet() umgestellt.
 */
function appDoGet() {

  return HtmlService
    .createHtmlOutputFromFile('Index')
    .setTitle(APP.NAME)
    .setXFrameOptionsMode(
      HtmlService.XFrameOptionsMode.ALLOWALL
    );

}


/**
 * Zentrale Datenabfrage.
 *
 * Die Oberfläche soll später nicht mehr wissen,
 * in welchem Sheet welche Daten liegen.
 *
 * Sie fragt nur noch:
 *
 *     appGetData()
 *
 * Das Hauptmodul verteilt die Arbeit an die
 * jeweiligen Module.
 */
function appGetData(password) {

  // ---------------------------------------------------
  // Anmeldung prüfen
  // ---------------------------------------------------

  const role = getRole(password);

  if (!role) {
    throw new Error('Falsches Passwort.');
  }


  // ---------------------------------------------------
  // Daten über das Datenbankmodul laden
  // ---------------------------------------------------

  return {

    role: role,

    helpers:
      dbGetHelpers(),

    plan:
      dbGetPlan(),

    stations:
      dbGetStations(),

    settings:
      dbGetSettings()

  };

}


/**
 * Kleine Diagnosefunktion.
 *
 * Damit können wir nach dem Einbau prüfen,
 * ob das neue System die Sheets korrekt erreicht.
 */
function appTestConnection() {

  const result = {

    ok: true,

    spreadsheet:
      SpreadsheetApp
        .getActiveSpreadsheet()
        .getName(),

    sheets: {

      helpers:
        !!SpreadsheetApp
          .getActiveSpreadsheet()
          .getSheetByName(APP.SHEETS.HELFER),

      plan:
        !!SpreadsheetApp
          .getActiveSpreadsheet()
          .getSheetByName(APP.SHEETS.DIENSTPLAN),

      stations:
        !!SpreadsheetApp
          .getActiveSpreadsheet()
          .getSheetByName(APP.SHEETS.STATIONEN),

      settings:
        !!SpreadsheetApp
          .getActiveSpreadsheet()
          .getSheetByName(APP.SHEETS.EINSTELLUNGEN)

    }

  };

  console.log(result);

  return result;
}

/** APDATA */

function appTestData() {

  const data = {

    helpers: dbGetHelpers(),
    plan: dbGetPlan(),
    stations: dbGetStations(),
    settings: dbGetSettings()

  };

  console.log(
    JSON.stringify(data, null, 2)
  );

  return data;
}
