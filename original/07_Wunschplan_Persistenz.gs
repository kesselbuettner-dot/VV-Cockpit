// =====================================================
// FF HOLZHAUSEN – WUNSCHPLAN PERSISTENZ
// 07_Wunschplan_Persistenz.gs
// =====================================================
//
// Eigene Datei.
// NICHT mit 07_Wunschplan.gs zusammenführen.
//
// Tabellenblatt:
// Wunschplan
//
// A = Helfer-Nr.
// B = Zeit
// C = Station
//
// Der endgültige Dienstplan wird NICHT verändert.
// =====================================================


// =====================================================
// HELFER-NR. ROBUST AUSLESEN
// =====================================================

function wunschPersistenzNr_(value) {

  if (typeof value === 'number') {
    return value;
  }

  const text =
    String(value == null ? '' : value).trim();

  if (!text) {
    return NaN;
  }

  // z.B. "35"
  if (/^\d+$/.test(text)) {
    return Number(text);
  }

  // z.B. "Nr. 35 – Eric Kessel-Büttner"
  const match =
    text.match(/(?:Nr\.?\s*)?(\d+)/i);

  return match
    ? Number(match[1])
    : NaN;
}


// =====================================================
// WUNSCHPLAN-TABELLE HOLEN / ERSTELLEN
// =====================================================

function wunschPersistenzGetSheet_() {

  const ss =
    dbGetSpreadsheet();

  let sheet =
    ss.getSheetByName('Wunschplan');

  if (!sheet) {

    sheet =
      ss.insertSheet('Wunschplan');

    sheet
      .getRange(1, 1, 1, 3)
      .setValues([[
        'Helfer-Nr.',
        'Zeit',
        'Station'
      ]]);

    sheet.setFrozenRows(1);
  }

  return sheet;
}


// =====================================================
// ALLE WÜNSCHE LADEN
// =====================================================

function wunschplaenePersistiertLaden() {

  const sheet =
    wunschPersistenzGetSheet_();

  const result = {};

  const lastRow =
    sheet.getLastRow();

  if (lastRow < 2) {
    return result;
  }

  const values =
    sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        3
      )
      .getValues();

  values.forEach(row => {

    const nr =
      wunschPersistenzNr_(row[0]);

    const zeit =
      dbFormatTime(row[1]);

    const station =
      String(
        row[2] || ''
      ).trim();

    if (
      !Number.isFinite(nr) ||
      nr <= 0 ||
      !zeit ||
      !station
    ) {
      return;
    }

    const key =
      String(nr);

    if (!result[key]) {
      result[key] = {};
    }

    result[key][zeit] =
      station;

  });

  return result;
}


// =====================================================
// WUNSCHPLAN EINES HELFERS LADEN
// =====================================================

function wunschplanPersistiertLaden(nr) {

  const nummer =
    wunschPersistenzNr_(nr);

  if (
    !Number.isFinite(nummer) ||
    nummer <= 0
  ) {

    throw new Error(
      'Ungültige Helfer-Nr.: ' +
      String(nr)
    );

  }

  const helpers =
    dbGetHelpers();

  const helper =
    helpers.find(
      h =>
        Number(h.nr) === nummer
    );

  if (!helper) {

    throw new Error(
      'Helfer Nr. ' +
      nummer +
      ' wurde nicht gefunden.'
    );

  }

  const settings =
    dbGetSettings();

  const wishes =
    wunschplaenePersistiertLaden();

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
      wishes[String(nummer)] || {}

  };

}


// =====================================================
// EINEN WUNSCH SPEICHERN / LÖSCHEN
// =====================================================

function wunschplanPersistiertAendern(
  nr,
  zeit,
  station
) {

  const nummer =
    wunschPersistenzNr_(nr);

  if (
    !Number.isFinite(nummer) ||
    nummer <= 0
  ) {

    throw new Error(
      'Ungültige Helfer-Nr.: ' +
      String(nr)
    );

  }

  const checked =
    dienstplanungAenderungPruefen(
      nummer,
      zeit,
      station
    );

  const sheet =
    wunschPersistenzGetSheet_();

  const lastRow =
    sheet.getLastRow();


  // Bestehenden Eintrag suchen.
  if (lastRow >= 2) {

    const values =
      sheet
        .getRange(
          2,
          1,
          lastRow - 1,
          3
        )
        .getValues();

    for (
      let i = 0;
      i < values.length;
      i++
    ) {

      const rowNr =
        wunschPersistenzNr_(
          values[i][0]
        );

      const rowTime =
        dbFormatTime(
          values[i][1]
        );

      if (
        rowNr === nummer &&
        rowTime === checked.zeit
      ) {

        const sheetRow =
          i + 2;

        if (checked.station) {

          sheet
            .getRange(
              sheetRow,
              3
            )
            .setValue(
              checked.station
            );

        } else {

          sheet.deleteRow(
            sheetRow
          );

        }

        return {

          ok: true,

          nr:
            nummer,

          raster:
            wunschplaenePersistiertLaden()
              [String(nummer)] || {}

        };

      }

    }

  }


  // Leeres Feld = nichts speichern.
  if (!checked.station) {

    return {

      ok: true,

      nr:
        nummer,

      raster:
        wunschplaenePersistiertLaden()
          [String(nummer)] || {}

    };

  }


  // Neuer Wunsch.
  sheet.appendRow([
    nummer,
    checked.zeit,
    checked.station
  ]);


  return {

    ok: true,

    nr:
      nummer,

    raster:
      wunschplaenePersistiertLaden()
        [String(nummer)] || {}

  };

}


// =====================================================
// MEHRERE WÜNSCHE IN EINEM AUFRUF
// =====================================================

function wunschplanPersistiertMehrfachAendern(
  nr,
  changes
) {

  const nummer =
    wunschPersistenzNr_(nr);

  if (
    !Number.isFinite(nummer) ||
    nummer <= 0
  ) {

    throw new Error(
      'Ungültige Helfer-Nr.: ' +
      String(nr)
    );

  }

  if (
    !Array.isArray(changes) ||
    !changes.length
  ) {

    throw new Error(
      'Keine Zeitfelder ausgewählt.'
    );

  }


  // Alle Änderungen zuerst prüfen.
  changes.forEach(
    change => {

      dienstplanungAenderungPruefen(
        nummer,
        change.zeit,
        change.station
      );

    }
  );


  // Danach speichern.
  changes.forEach(
    change => {

      wunschplanPersistiertAendern(
        nummer,
        change.zeit,
        change.station
      );

    }
  );


  return {

    ok: true,

    nr:
      nummer,

    raster:
      wunschplaenePersistiertLaden()
        [String(nummer)] || {},

    geaendert:
      changes.length

  };

}


// =====================================================
// KOMPLETTEN WUNSCHPLAN SPEICHERN
// =====================================================

function wunschplanPersistiertKomplettSpeichern(
  nr,
  raster
) {

  const nummer =
    wunschPersistenzNr_(nr);

  if (
    !Number.isFinite(nummer) ||
    nummer <= 0
  ) {

    throw new Error(
      'Ungültige Helfer-Nr.: ' +
      String(nr)
    );

  }

  const sheet =
    wunschPersistenzGetSheet_();

  const lastRow =
    sheet.getLastRow();


  // Alte Wünsche dieses Helfers entfernen.
  if (lastRow >= 2) {

    const values =
      sheet
        .getRange(
          2,
          1,
          lastRow - 1,
          3
        )
        .getValues();

    for (
      let i = values.length - 1;
      i >= 0;
      i--
    ) {

      if (
        wunschPersistenzNr_(
          values[i][0]
        ) === nummer
      ) {

        sheet.deleteRow(
          i + 2
        );

      }

    }

  }


  const rows = [];


  Object.keys(
    raster || {}
  ).forEach(
    zeit => {

      const station =
        String(
          raster[zeit] || ''
        ).trim();

      if (!station) {
        return;
      }


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

    }
  );


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

    nr:
      nummer,

    raster:
      wunschplaenePersistiertLaden()
        [String(nummer)] || {}

  };

}