// =====================================================
// FF HOLZHAUSEN – HELFER-DIENSTPLAN
// 07_Wunschplan.gs
// =====================================================
//
// Wunschplan des Helfers.
//
// Dieses Modul trennt den persönlichen Wunschplan
// vom endgültigen Dienstplan.
//
// Grundlage ist das 30-Minuten-Raster aus Modul 05/06.
//
// Der Wunschplan wird zunächst nur geprüft und
// vorbereitet. Die endgültige Verteilung erfolgt
// später über 10_Planverteilung.gs.
//
// =====================================================


// =====================================================
// WUNSCHPLAN DES HELFERS LADEN
// =====================================================
//
// Liefert den aktuellen Dienstplan-Vorschlag als
// Grundlage für den persönlichen Wunschplan.
//
// =====================================================

function wunschplanLaden(
  nr
) {

  const nummer =
    Number(nr);

  if (
    !Number.isFinite(nummer) ||
    nummer <= 0
  ) {

    throw new Error(
      'Ungültige Helfer-Nr.'
    );

  }


  const raster =
    dienstplanHelferRaster(
      nummer
    );

  const helpers =
    dbGetHelpers();

  const helper =
    helpers.find(
      h =>
        Number(h.nr) === nummer
    );

  if (
    !helper
  ) {

    throw new Error(
      'Helfer Nr. ' +
      nummer +
      ' wurde nicht gefunden.'
    );

  }


  const settings =
    dbGetSettings();


  return {

    ok: true,

    nr:
      nummer,

    name:
      (
        helper.vorname +
        ' ' +
        helper.nachname
      ).trim(),

    arrival:
      helper.ankunft,

    start:
      settings.start,

    end:
      settings.end,

    step:
      30,

    raster:
      raster

  };

}


// =====================================================
// LEEREN WUNSCHPLAN ERSTELLEN
// =====================================================

function wunschplanLeer(
  nr
) {

  const data =
    wunschplanLaden(
      nr
    );


  return {

    ok: true,

    nr:
      data.nr,

    name:
      data.name,

    arrival:
      data.arrival,

    start:
      data.start,

    end:
      data.end,

    step:
      data.step,

    raster: {}

  };

}


// =====================================================
// WUNSCHPLAN ÄNDERN
// =====================================================
//
// Noch kein Schreiben ins Spreadsheet.
//
// Leeres station-Feld entfernt den Wunsch für
// dieses 30-Minuten-Feld.
//
// =====================================================

function wunschplanAendern(
  plan,
  nr,
  zeit,
  station
) {

  return dienstplanungAendern(
    plan,
    nr,
    zeit,
    station
  );

}


// =====================================================
// WUNSCHPLAN LÖSCHEN
// =====================================================

function wunschplanLoeschen(
  plan,
  nr,
  zeit
) {

  return dienstplanungLoeschen(
    plan,
    nr,
    zeit
  );

}


// =====================================================
// WUNSCHPLAN PRÜFEN
// =====================================================
//
// Prüft Stationen und Raster, bevor der Wunschplan
// weitergegeben wird.
//
// =====================================================

function wunschplanPruefen(
  plan
) {

  return dienstplanungPruefen(
    plan
  );

}


// =====================================================
// WUNSCHPLAN EINES HELFERS PRÜFEN
// =====================================================
//
// Praktische Kurzfunktion für die spätere HTML-
// Oberfläche.
//
// =====================================================

function wunschplanHelferPruefen(
  nr,
  raster
) {

  const nummer =
    Number(nr);

  if (
    !Number.isFinite(nummer) ||
    nummer <= 0
  ) {

    throw new Error(
      'Ungültige Helfer-Nr.'
    );

  }


  const plan = {};

  plan[
    String(nummer)
  ] =
    raster || {};


  const result =
    wunschplanPruefen(
      plan
    );


  return result;

}


// =====================================================
// WUNSCHPLAN ALS VORSCHLAG ÜBERNEHMEN
// =====================================================
//
// Der persönliche Wunschplan wird NICHT direkt zum
// endgültigen Dienstplan.
//
// Diese Funktion liefert den geprüften Wunsch zurück.
// Modul 10 kann später daraus den endgültigen Plan
// erstellen.
//
// =====================================================

function wunschplanBereitstellen(
  nr,
  raster
) {

  const nummer =
    Number(nr);

  if (
    !Number.isFinite(nummer) ||
    nummer <= 0
  ) {

    throw new Error(
      'Ungültige Helfer-Nr.'
    );

  }


  const plan = {};

  plan[
    String(nummer)
  ] =
    raster || {};


  const check =
    wunschplanPruefen(
      plan
    );


  if (
    !check.ok
  ) {

    return {

      ok: false,

      errors:
        check.errors

    };

  }


  return {

    ok: true,

    nr:
      nummer,

    raster:
      raster || {}

  };

}


// =====================================================
// MEHRERE WUNSCHPLÄNE PRÜFEN
// =====================================================
//
// Für die spätere Planverteilung.
//
// =====================================================

function wunschplaenePruefen(
  plaene
) {

  if (
    !plaene ||
    typeof plaene !== 'object'
  ) {

    throw new Error(
      'Ungültige Wunschpläne.'
    );

  }


  const result = {

    ok: true,

    errors: []

  };


  Object.keys(
    plaene
  )
  .forEach(
    nr => {

      const plan = {};

      plan[nr] =
        plaene[nr] || {};


      const check =
        wunschplanPruefen(
          plan
        );


      if (
        !check.ok
      ) {

        result.ok = false;

        result.errors =
          result.errors.concat(
            check.errors
          );

      }

    }
  );


  return result;

}


// =====================================================
// WUNSCHPLAN FÜR PLANVERTEILUNG AUFBEREITEN
// =====================================================
//
// Gibt nur geprüfte Wunschdaten zurück.
// Es erfolgt KEINE Speicherung.
//
// =====================================================

function wunschplaeneFuerVerteilung(
  plaene
) {

  const check =
    wunschplaenePruefen(
      plaene
    );


  if (
    !check.ok
  ) {

    throw new Error(
      'Wunschpläne enthalten ungültige Einträge:\n' +
      check.errors.join('\n')
    );

  }


  return {

    ok: true,

    plaene:
      plaene

  };

}


// =====================================================
// ERWEITERUNG 07_Wunschplan.gs
// Mehrfachauswahl in EINEM Server-Aufruf verarbeiten.
// =====================================================

function wunschplanMehrfachAendern(raster, nr, changes) {

  const nummer = Number(nr);

  if (!Number.isFinite(nummer) || nummer <= 0) {
    throw new Error('Ungültige Helfer-Nr.');
  }

  if (!Array.isArray(changes) || !changes.length) {
    throw new Error('Keine Zeitfelder ausgewählt.');
  }

  const resultRaster =
    JSON.parse(JSON.stringify(raster || {}));

  changes.forEach(change => {

    const zeit = String(change.zeit || '').trim();
    const station = String(change.station || '').trim();

    const check = dienstplanungAenderungPruefen(
      nummer,
      zeit,
      station
    );

    if (check.station) {
      resultRaster[check.zeit] = check.station;
    } else {
      delete resultRaster[check.zeit];
    }
  });

  return {
    ok: true,
    nr: nummer,
    raster: resultRaster,
    geaendert: changes.length
  };
}

// =====================================================
// 07_Wunschplan.gs – ERWEITERUNG PERSISTENZ
// =====================================================
//
// Die Wunschpläne werden dauerhaft im Tabellenblatt
// "Wunschplan" gespeichert.
//
// Struktur:
// A = Helfer-Nr.
// B = Zeit
// C = Station
//
// Änderungen werden sofort gespeichert. Der endgültige
// Dienstplan wird dadurch NICHT verändert.
// =====================================================


function wunschplanGetSheet_() {

  const ss = dbGetSpreadsheet();
  let sheet = ss.getSheetByName('Wunschplan');

  if (!sheet) {
    sheet = ss.insertSheet('Wunschplan');
    sheet.getRange(1,1,1,3).setValues([[
      'Helfer-Nr.',
      'Zeit',
      'Station'
    ]]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}


// =====================================================
// GESPEICHERTE WÜNSCHE LADEN
// =====================================================

function wunschplaeneLaden() {

  const sheet = wunschplanGetSheet_();
  const result = {};

  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return result;
  }

  const values =
    sheet.getRange(2,1,lastRow-1,3).getValues();

  values.forEach(row => {

    const nr = Number(row[0]);
    const zeit = dbFormatTime(row[1]);
    const station = String(row[2] || '').trim();

    if (!Number.isFinite(nr) || nr <= 0 || !zeit) {
      return;
    }

    if (!result[String(nr)]) {
      result[String(nr)] = {};
    }

    if (station) {
      result[String(nr)][zeit] = station;
    }
  });

  return result;
}


// =====================================================
// WUNSCHPLAN EINES HELFERS LADEN
// =====================================================

function wunschplanLaden(nr) {

  const nummer = Number(nr);

  if (!Number.isFinite(nummer) || nummer <= 0) {
    throw new Error('Ungültige Helfer-Nr.');
  }

  const helpers = dbGetHelpers();

  const helper = helpers.find(
    h => Number(h.nr) === nummer
  );

  if (!helper) {
    throw new Error(
      'Helfer Nr. ' + nummer + ' wurde nicht gefunden.'
    );
  }

  const settings = dbGetSettings();
  const allWishes = wunschplaeneLaden();

  return {
    ok: true,
    nr: nummer,
    name: (
      helper.vorname + ' ' + helper.nachname
    ).trim(),
    arrival: helper.ankunft,
    start: settings.start,
    end: settings.end,
    step: 30,
    raster: allWishes[String(nummer)] || {}
  };
}


// =====================================================
// EINEN WUNSCH SPEICHERN
// =====================================================

function wunschplanAendern(nr, zeit, station) {

  const nummer = Number(nr);

  if (!Number.isFinite(nummer) || nummer <= 0) {
    throw new Error('Ungültige Helfer-Nr.');
  }

  const checked =
    dienstplanungAenderungPruefen(
      nummer,
      zeit,
      station
    );

  const sheet = wunschplanGetSheet_();
  const lastRow = sheet.getLastRow();

  // Bestehenden Eintrag für Helfer + Zeit suchen.
  if (lastRow >= 2) {

    const values =
      sheet.getRange(2,1,lastRow-1,3).getValues();

    for (let i = 0; i < values.length; i++) {

      const rowNr = Number(values[i][0]);
      const rowTime = dbFormatTime(values[i][1]);

      if (
        rowNr === nummer &&
        rowTime === checked.zeit
      ) {

        const sheetRow = i + 2;

        if (checked.station) {
          sheet.getRange(sheetRow,3).setValue(
            checked.station
          );
        } else {
          sheet.deleteRow(sheetRow);
        }

        return {
          ok: true,
          nr: nummer,
          raster: wunschplaeneLaden()[String(nummer)] || {}
        };
      }
    }
  }

  // Leeres Feld bedeutet: nichts speichern.
  if (!checked.station) {
    return {
      ok: true,
      nr: nummer,
      raster: wunschplaeneLaden()[String(nummer)] || {}
    };
  }

  sheet.appendRow([
    nummer,
    checked.zeit,
    checked.station
  ]);

  return {
    ok: true,
    nr: nummer,
    raster: wunschplaeneLaden()[String(nummer)] || {}
  };
}


// =====================================================
// MEHRERE WÜNSCHE IN EINEM AUFRUF SPEICHERN
// =====================================================

function wunschplanMehrfachAendern(nr, changes) {

  const nummer = Number(nr);

  if (!Number.isFinite(nummer) || nummer <= 0) {
    throw new Error('Ungültige Helfer-Nr.');
  }

  if (!Array.isArray(changes) || !changes.length) {
    throw new Error('Keine Zeitfelder ausgewählt.');
  }

  changes.forEach(change => {

    wunschplanAendern(
      nummer,
      change.zeit,
      change.station
    );

  });

  return {
    ok: true,
    nr: nummer,
    raster: wunschplaeneLaden()[String(nummer)] || {},
    geaendert: changes.length
  };
}


// =====================================================
// KOMPLETTEN WUNSCHPLAN SPEICHERN
// =====================================================

function wunschplanKomplettSpeichern(nr, raster) {

  const nummer = Number(nr);

  if (!Number.isFinite(nummer) || nummer <= 0) {
    throw new Error('Ungültige Helfer-Nr.');
  }

  const sheet = wunschplanGetSheet_();

  // Alle bestehenden Wünsche dieses Helfers entfernen.
  const lastRow = sheet.getLastRow();

  if (lastRow >= 2) {

    const values =
      sheet.getRange(2,1,lastRow-1,3).getValues();

    for (let i = values.length - 1; i >= 0; i--) {

      if (Number(values[i][0]) === nummer) {
        sheet.deleteRow(i + 2);
      }
    }
  }

  const rows = [];

  Object.keys(raster || {}).forEach(zeit => {

    const station =
      String(raster[zeit] || '').trim();

    if (!station) return;

    const checked =
      dienstplanungAenderungPruefen(
        nummer,
        zeit,
        station
      );

    rows.push([
      nummer,
      checked.zeit,
      checked.station
    ]);
  });

  if (rows.length) {
    sheet
      .getRange(
        sheet.getLastRow() + 1,
        1,
        rows.length,
        3
      )
      .setValues(rows);
  }

  return {
    ok: true,
    nr: nummer,
    raster: wunschplaeneLaden()[String(nummer)] || {}
  };
}

// =====================================================
// 07_Wunschplan.gs – ERWEITERUNG PERSISTENZ
// =====================================================
//
// Die Wunschpläne werden dauerhaft im Tabellenblatt
// "Wunschplan" gespeichert.
//
// Struktur:
// A = Helfer-Nr.
// B = Zeit
// C = Station
//
// Änderungen werden sofort gespeichert. Der endgültige
// Dienstplan wird dadurch NICHT verändert.
// =====================================================


function wunschplanGetSheet_() {

  const ss = dbGetSpreadsheet();
  let sheet = ss.getSheetByName('Wunschplan');

  if (!sheet) {
    sheet = ss.insertSheet('Wunschplan');
    sheet.getRange(1,1,1,3).setValues([[
      'Helfer-Nr.',
      'Zeit',
      'Station'
    ]]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}


// =====================================================
// GESPEICHERTE WÜNSCHE LADEN
// =====================================================

function wunschplaeneLaden() {

  const sheet = wunschplanGetSheet_();
  const result = {};

  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return result;
  }

  const values =
    sheet.getRange(2,1,lastRow-1,3).getValues();

  values.forEach(row => {

    const nr = Number(row[0]);
    const zeit = dbFormatTime(row[1]);
    const station = String(row[2] || '').trim();

    if (!Number.isFinite(nr) || nr <= 0 || !zeit) {
      return;
    }

    if (!result[String(nr)]) {
      result[String(nr)] = {};
    }

    if (station) {
      result[String(nr)][zeit] = station;
    }
  });

  return result;
}


// =====================================================
// WUNSCHPLAN EINES HELFERS LADEN
// =====================================================

function wunschplanLaden(nr) {

  const nummer = Number(nr);

  if (!Number.isFinite(nummer) || nummer <= 0) {
    throw new Error('Ungültige Helfer-Nr.');
  }

  const helpers = dbGetHelpers();

  const helper = helpers.find(
    h => Number(h.nr) === nummer
  );

  if (!helper) {
    throw new Error(
      'Helfer Nr. ' + nummer + ' wurde nicht gefunden.'
    );
  }

  const settings = dbGetSettings();
  const allWishes = wunschplaeneLaden();

  return {
    ok: true,
    nr: nummer,
    name: (
      helper.vorname + ' ' + helper.nachname
    ).trim(),
    arrival: helper.ankunft,
    start: settings.start,
    end: settings.end,
    step: 30,
    raster: allWishes[String(nummer)] || {}
  };
}


// =====================================================
// EINEN WUNSCH SPEICHERN
// =====================================================

function wunschplanAendern(nr, zeit, station) {

  const nummer = Number(nr);

  if (!Number.isFinite(nummer) || nummer <= 0) {
    throw new Error('Ungültige Helfer-Nr.');
  }

  const checked =
    dienstplanungAenderungPruefen(
      nummer,
      zeit,
      station
    );

  const sheet = wunschplanGetSheet_();
  const lastRow = sheet.getLastRow();

  // Bestehenden Eintrag für Helfer + Zeit suchen.
  if (lastRow >= 2) {

    const values =
      sheet.getRange(2,1,lastRow-1,3).getValues();

    for (let i = 0; i < values.length; i++) {

      const rowNr = Number(values[i][0]);
      const rowTime = dbFormatTime(values[i][1]);

      if (
        rowNr === nummer &&
        rowTime === checked.zeit
      ) {

        const sheetRow = i + 2;

        if (checked.station) {
          sheet.getRange(sheetRow,3).setValue(
            checked.station
          );
        } else {
          sheet.deleteRow(sheetRow);
        }

        return {
          ok: true,
          nr: nummer,
          raster: wunschplaeneLaden()[String(nummer)] || {}
        };
      }
    }
  }

  // Leeres Feld bedeutet: nichts speichern.
  if (!checked.station) {
    return {
      ok: true,
      nr: nummer,
      raster: wunschplaeneLaden()[String(nummer)] || {}
    };
  }

  sheet.appendRow([
    nummer,
    checked.zeit,
    checked.station
  ]);

  return {
    ok: true,
    nr: nummer,
    raster: wunschplaeneLaden()[String(nummer)] || {}
  };
}


// =====================================================
// MEHRERE WÜNSCHE IN EINEM AUFRUF SPEICHERN
// =====================================================

function wunschplanMehrfachAendern(nr, changes) {

  const nummer = Number(nr);

  if (!Number.isFinite(nummer) || nummer <= 0) {
    throw new Error('Ungültige Helfer-Nr.');
  }

  if (!Array.isArray(changes) || !changes.length) {
    throw new Error('Keine Zeitfelder ausgewählt.');
  }

  changes.forEach(change => {

    wunschplanAendern(
      nummer,
      change.zeit,
      change.station
    );

  });

  return {
    ok: true,
    nr: nummer,
    raster: wunschplaeneLaden()[String(nummer)] || {},
    geaendert: changes.length
  };
}


// =====================================================
// KOMPLETTEN WUNSCHPLAN SPEICHERN
// =====================================================

function wunschplanKomplettSpeichern(nr, raster) {

  const nummer = Number(nr);

  if (!Number.isFinite(nummer) || nummer <= 0) {
    throw new Error('Ungültige Helfer-Nr.');
  }

  const sheet = wunschplanGetSheet_();

  // Alle bestehenden Wünsche dieses Helfers entfernen.
  const lastRow = sheet.getLastRow();

  if (lastRow >= 2) {

    const values =
      sheet.getRange(2,1,lastRow-1,3).getValues();

    for (let i = values.length - 1; i >= 0; i--) {

      if (Number(values[i][0]) === nummer) {
        sheet.deleteRow(i + 2);
      }
    }
  }

  const rows = [];

  Object.keys(raster || {}).forEach(zeit => {

    const station =
      String(raster[zeit] || '').trim();

    if (!station) return;

    const checked =
      dienstplanungAenderungPruefen(
        nummer,
        zeit,
        station
      );

    rows.push([
      nummer,
      checked.zeit,
      checked.station
    ]);
  });

  if (rows.length) {
    sheet
      .getRange(
        sheet.getLastRow() + 1,
        1,
        rows.length,
        3
      )
      .setValues(rows);
  }

  return {
    ok: true,
    nr: nummer,
    raster: wunschplaeneLaden()[String(nummer)] || {}
  };
}

//=========================================
// AKTUELLEN GESPEICHERTEN DIENST FÜR DEN WUNSCHPLAN LADEN
// =====================================================
//
// Liest NICHT den automatischen Vorschlag.
// Liest direkt das Tabellenblatt "Dienstplan".
//
// Aufbau des Dienstplan-Sheets:
// A = Nr.
// B = Nachname
// C = Vorname
// D/E/F = Schicht 1 Station / Von / Bis
// G/H/I = Schicht 2 Station / Von / Bis
// J/K/L = Schicht 3 Station / Von / Bis
//
// Rückgabe:
// {
//   ok: true,
//   nr: 34,
//   raster: {
//      "17:30": "Bierwagen",
//      "18:00": "Bierwagen"
//   }
// }
// =====================================================

function wunschplanAktuellenDienstLaden(password, nr) {

  if (getRole(password) === '') {
    throw new Error('Nicht angemeldet.');
  }

  const nummer = Number(nr);

  if (!Number.isFinite(nummer) || nummer <= 0) {
    throw new Error('Ungültige Helfer-Nr.');
  }

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const sheet =
    ss.getSheetByName(CONFIG.PLAN_SHEET);

  if (!sheet) {
    throw new Error(
      'Tabellenblatt "' +
      CONFIG.PLAN_SHEET +
      '" wurde nicht gefunden.'
    );
  }

  if (sheet.getLastRow() < 2) {
    return {
      ok: true,
      nr: nummer,
      raster: {}
    };
  }

  const values =
    sheet
      .getRange(
        2,
        1,
        sheet.getLastRow() - 1,
        13
      )
      .getValues();

  let found = false;
  const raster = {};

  values.forEach(function(r) {

    const rowNr = Number(r[0]);

    if (rowNr !== nummer) {
      return;
    }

    found = true;

    // Drei manuell eingetragene Schichten lesen.
    for (let s = 0; s < 3; s++) {

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
          raster,
          von,
          bis,
          station
        );
      }
    }
  });

  return {
    ok: true,
    nr: nummer,
    gefunden: found,
    raster: raster
  };
}
// =====================================================
// FF HOLZHAUSEN – TAGES-WUNSCHPLAN
// Erweiterung zu 07_Wunschplan / 07_Wunschplan_Persistenz
// =====================================================
// Tagesbezogene Wünsche.
// Bestehende Wunschplan-Daten bleiben erhalten.
// =====================================================

function wunschplanTageSheet_() {
  const ss = dbGetSpreadsheet();
  let sheet = ss.getSheetByName('Wunschplan_Tage');

  if (!sheet) {
    sheet = ss.insertSheet('Wunschplan_Tage');
    sheet.getRange(1,1,1,4).setValues([[
      'Datum','Helfer-Nr.','Zeit','Station'
    ]]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function wunschplanTagesLaden(nr, datum) {
  const nummer = wunschPersistenzNr_(nr);

  if (!Number.isFinite(nummer) || nummer <= 0) {
    throw new Error('Ungültige Helfer-Nr.: ' + String(nr));
  }

  const tag = tagesplanDatum_(datum);
  if (!tag) throw new Error('Ungültiges Veranstaltungsdatum.');

  const helpers = dbGetHelpers();
  const helper = helpers.find(h => Number(h.nr) === nummer);

  if (!helper) {
    throw new Error(
      'Helfer Nr. ' + nummer + ' wurde nicht gefunden.'
    );
  }

  const settings = dbGetSettings();
  const raster = {};

  const sheet = wunschplanTageSheet_();
  const last = sheet.getLastRow();

  let hatTagdaten = false;

  if (last >= 2) {
    const rows = sheet.getRange(2,1,last-1,4).getValues();

    rows.forEach(row => {
      if (tagesplanDatum_(row[0]) !== tag) return;
      if (wunschPersistenzNr_(row[1]) !== nummer) return;

      hatTagdaten = true;

      const zeit = dbFormatTime(row[2]);
      const station = String(row[3] || '').trim();

      if (zeit && station) raster[zeit] = station;
    });
  }

  // Für den ersten/alten Veranstaltungstag alte Wünsche als Basis.
  if (!hatTagdaten) {
    const alte = wunschplaenePersistiertLaden
      ? wunschplaenePersistiertLaden()
      : {};

    if (alte[String(nummer)]) {
      Object.assign(raster, alte[String(nummer)]);
    }
  }

  return {
    ok: true,
    nr: nummer,
    name: (
      String(helper.vorname || '') + ' ' +
      String(helper.nachname || '')
    ).trim(),
    arrival: helper.ankunft || '',
    start: settings.start || '12:00',
    end: settings.end || '22:00',
    step: 30,
    datum: tag,
    raster: raster
  };
}

function wunschplanTagesSpeichern(nr, datum, raster) {
  const nummer = wunschPersistenzNr_(nr);

  if (!Number.isFinite(nummer) || nummer <= 0) {
    throw new Error('Ungültige Helfer-Nr.: ' + String(nr));
  }

  const tag = tagesplanDatum_(datum);
  if (!tag) throw new Error('Ungültiges Veranstaltungsdatum.');

  const sheet = wunschplanTageSheet_();
  const last = sheet.getLastRow();

  if (last >= 2) {
    const rows = sheet.getRange(2,1,last-1,4).getValues();

    for (let i = rows.length - 1; i >= 0; i--) {
      if (
        tagesplanDatum_(rows[i][0]) === tag &&
        wunschPersistenzNr_(rows[i][1]) === nummer
      ) {
        sheet.deleteRow(i + 2);
      }
    }
  }

  const rows = [];

  Object.keys(raster || {}).forEach(zeit => {
    const cleanTime = dbFormatTime(zeit);
    const station = String(raster[zeit] || '').trim();

    if (!cleanTime || !station) return;

    rows.push([
      tag,
      nummer,
      cleanTime,
      station
    ]);
  });

  if (rows.length) {
    sheet.getRange(
      sheet.getLastRow() + 1,
      1,
      rows.length,
      4
    ).setValues(rows);
  }

  return wunschplanTagesLaden(nummer, tag);
}

function wunschplanTagesAlleLaden(datum) {
  const tag = tagesplanDatum_(datum);
  if (!tag) throw new Error('Ungültiges Veranstaltungsdatum.');

  const result = {};
  const sheet = wunschplanTageSheet_();
  const last = sheet.getLastRow();

  if (last < 2) return result;

  const rows = sheet.getRange(2,1,last-1,4).getValues();

  rows.forEach(row => {
    if (tagesplanDatum_(row[0]) !== tag) return;

    const nr = wunschPersistenzNr_(row[1]);
    const zeit = dbFormatTime(row[2]);
    const station = String(row[3] || '').trim();

    if (!Number.isFinite(nr) || !zeit || !station) return;

    if (!result[String(nr)]) result[String(nr)] = {};
    result[String(nr)][zeit] = station;
  });

  return result;
}
