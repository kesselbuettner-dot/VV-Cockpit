// =====================================================
// FF HOLZHAUSEN – HELFER-DIENSTPLAN
// 02_Datenbank.gs
// =====================================================
//
// Zentrale Datenzugriffsschicht.
//
// Dieses Modul liest und schreibt Google-Sheets-Daten.
// Andere Module sollen möglichst nicht direkt mit
// SpreadsheetApp arbeiten müssen.
//
// =====================================================


/**
 * Aktives Spreadsheet holen.
 */
function dbGetSpreadsheet() {

  return SpreadsheetApp
    .getActiveSpreadsheet();

}


/**
 * Helferliste laden.
 *
 * Aktuelle Struktur:
 *
 * A = Nr.
 * B = Nachname
 * C = Vorname
 * D = Teilnahme
 * E = Ankunft
 * F = Bemerkung
 * G = E-Mail
 *
 */
function dbGetHelpers() {

  const ss =
    dbGetSpreadsheet();

  const sheet =
    ss.getSheetByName(
      APP.SHEETS.HELFER
    );

  if (!sheet) {

    throw new Error(
      'Tabellenblatt "Helferliste" wurde nicht gefunden.'
    );

  }


  const lastRow =
    sheet.getLastRow();

  const helpers = [];


  if (lastRow < 2) {

    return helpers;

  }


  // A bis H lesen (inkl. geeignete Stationen)
  const width = Math.max(8, sheet.getLastColumn());
  const values =
    sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        Math.min(width, 8)
      )
      .getValues();


  values.forEach(
    (r, index) => {

      const nachname =
        String(
          r[1] || ''
        ).trim();

      const vorname =
        String(
          r[2] || ''
        ).trim();


      // Leere Zeilen ignorieren.
      if (
        !nachname &&
        !vorname
      ) {

        return;

      }


      let nr =
        r[0];


      if (
        nr === '' ||
        nr === null ||
        nr === undefined
      ) {

        nr =
          index + 1;

      }


      helpers.push({

        row:
          index + 2,

        nr:
          Number(nr),

        nachname:
          nachname,

        vorname:
          vorname,

        teilnahme:
          String(
            r[3] || ''
          ).trim(),

        ankunft:
          dbFormatTime(
            r[4]
          ),

        bemerkung:
          String(
            r[5] || ''
          ).trim(),

        email:
          String(
            r[6] || ''
          ).trim(),

        suitableStations:
          String(
            r[7] || ''
          ).trim()

      });

    }
  );


  return helpers;

}


/**
 * Dienstplan laden.
 *
 * Die aktuelle Tabelle besitzt:
 *
 * A  Nr.
 * B  Nachname
 * C  Vorname
 *
 * danach drei Schichten mit:
 *
 * Station / Von / Bis
 */
function dbGetPlan() {

  const ss =
    dbGetSpreadsheet();

  const sheet =
    ss.getSheetByName(
      APP.SHEETS.DIENSTPLAN
    );

  const plan = {};


  if (
    !sheet ||
    sheet.getLastRow() < 2
  ) {

    return plan;

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


  values.forEach(
    (r, index) => {

      let nr =
        r[0];


      if (
        nr === '' ||
        nr === null ||
        nr === undefined
      ) {

        nr =
          index + 1;

      }


      nr =
        Number(nr);


      if (!nr) {

        return;

      }


      const key =
        String(nr);


      plan[key] = {};


      // Drei vorhandene Schichten.
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
          dbFormatTime(
            r[4 + s * 3]
          );

        const bis =
          dbFormatTime(
            r[5 + s * 3]
          );


        if (
          station &&
          von &&
          bis
        ) {

          dbAddTimeRange(
            plan[key],
            von,
            bis,
            station
          );

        }

      }

    }
  );


  return plan;

}


/**
 * Stationen laden.
 *
 * Aktuelle Struktur:
 *
 * A Station
 * B Kürzel
 * C Farbe
 * D Benötigte Helfer
 * E Google Maps
 * F Hinweis
 */

function dbGetStations() {

  const ss =
    dbGetSpreadsheet();

  const sheet =
    ss.getSheetByName(
      APP.SHEETS.STATIONEN
    );

  const stations = [];


  if (
    !sheet ||
    sheet.getLastRow() < 2
  ) {

    return stations;

  }


  // Mindestens 9 Spalten lesen.
  const lastCol =
    Math.max(
      9,
      sheet.getLastColumn()
    );


  const rows =
    sheet
      .getRange(
        2,
        1,
        sheet.getLastRow() - 1,
        lastCol
      )
      .getValues();


  rows.forEach(
    (r, index) => {

      const name =
        String(
          r[0] || ''
        ).trim();


      if (!name) {
        return;
      }


      // -----------------------------------------------
      // Tageszeiten aus Spalte I
      // -----------------------------------------------

      let tage = [];


      if (r[8]) {

        try {

          const parsed =
            JSON.parse(
              String(r[8])
            );


          if (Array.isArray(parsed)) {

            tage =
              parsed
                .map(function(t) {

                  return {

                    tag:
                      Number(t.tag) || 0,

                    datum:
                      String(
                        t.datum || ''
                      ).trim(),

                    von:
                      dbFormatTime(
                        t.von
                      ),

                    bis:
                      dbFormatTime(
                        t.bis
                      )

                  };

                })
                .filter(function(t) {

                  return (
                    t.tag > 0 &&
                    t.von &&
                    t.bis
                  );

                });

          }

        } catch (e) {

          // Alte bzw. fehlerhafte Daten
          // dürfen den Stationsabruf nicht stoppen.

          tage = [];

        }

      }


      // -----------------------------------------------
      // Rückwärtskompatibilität
      // -----------------------------------------------

      const start =
        dbFormatTime(
          r[6]
        );

      const end =
        dbFormatTime(
          r[7]
        );


      // Wenn noch keine Tagesdaten existieren,
      // werden alte Beginn/Ende-Daten als Tag 1
      // interpretiert.

      if (
        !tage.length &&
        start &&
        end
      ) {

        tage.push({

          tag: 1,

          datum: '',

          von: start,

          bis: end

        });

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
            r[2] || ''
          ).trim(),

        needed:
          Number(
            r[3]
          ) || 1,

        maps:
          String(
            r[4] || ''
          ).trim(),

        hint:
          String(
            r[5] || ''
          ).trim(),

        start:
          start,

        end:
          end,

        tage:
          tage

      });

    }
  );


  return stations;

}


/**
 * Einstellungen laden.
 *
 * Die vorhandene Struktur bleibt erhalten.
 */
function dbGetSettings() {

  const ss =
    dbGetSpreadsheet();

  const sheet =
    ss.getSheetByName(
      APP.SHEETS.EINSTELLUNGEN
    );


  const result = {

    start: '12:00',

    end: '22:00',

    step: 30,

    theme: 'feuerwehr',

    mainColor: '#C62828',

    background: '#F4F4F4',

    headerColor: '#8E0000',

    buttonColor: '#C62828',

    textColor: '#FFFFFF'

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


      if (
        key === 'beginn'
      ) {

        result.start =
          dbFormatTime(
            value
          );

      }

      else if (
        key === 'ende'
      ) {

        result.end =
          dbFormatTime(
            value
          );

      }

      else if (
        key === 'raster'
      ) {

        result.step =
          Number(value) || 30;

      }

      else if (
        key === 'theme'
      ) {

        result.theme =
          value ||
          'feuerwehr';

      }

      else if (
        key === 'hauptfarbe'
      ) {

        result.mainColor =
          value;

      }

      else if (
        key === 'hintergrund'
      ) {

        result.background =
          value;

      }

      else if (
        key === 'kopfzeile'
      ) {

        result.headerColor =
          value;

      }

      else if (
        key === 'buttonfarbe'
      ) {

        result.buttonColor =
          value;

      }

      else if (
        key === 'schriftfarbe'
      ) {

        result.textColor =
          value;

      }

    }
  );


  return result;

}


/**
 * Zeitwert formatieren.
 */
function dbFormatTime(value) {

  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {

    return '';

  }


  const s =
    String(value).trim();


  const match =
    s.match(
      /(\d{1,2}):(\d{2})/
    );


  if (match) {

    const h =
      Number(match[1]);

    const m =
      Number(match[2]);


    if (
      h >= 0 &&
      h <= 23 &&
      m >= 0 &&
      m <= 59
    ) {

      return (
        String(h).padStart(2, '0') +
        ':' +
        String(m).padStart(2, '0')
      );

    }

  }


  const date =
    new Date(value);


  if (
    !isNaN(
      date.getTime()
    )
  ) {

    return (
      String(
        date.getHours()
      ).padStart(2, '0') +
      ':' +
      String(
        date.getMinutes()
      ).padStart(2, '0')
    );

  }


  return '';

}


/**
 * Zeitbereich in einzelne Rasterfelder zerlegen.
 *
 * Beispiel:
 *
 * 15:00 – 17:00
 *
 * wird zu:
 *
 * 15:00
 * 15:30
 * 16:00
 * 16:30
 */
function dbAddTimeRange(
  target,
  von,
  bis,
  station
) {

  const start =
    dbTimeToMinutes(
      von
    );

  const end =
    dbTimeToMinutes(
      bis
    );


  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    end <= start
  ) {

    return;

  }


  for (
    let m = start;
    m < end;
    m += 30
  ) {

    target[
      dbMinutesToTime(m)
    ] = station;

  }

}


/**
 * HH:mm → Minuten.
 */
function dbTimeToMinutes(
  value
) {

  const match =
    String(value || '')
      .match(
        /^(\d{1,2}):(\d{2})$/
      );


  if (!match) {

    return NaN;

  }


  return (
    Number(match[1]) * 60 +
    Number(match[2])
  );

}


/**
 * Minuten → HH:mm.
 */
function dbMinutesToTime(
  minutes
) {

  return (
    String(
      Math.floor(minutes / 60)
    ).padStart(2, '0') +
    ':' +
    String(
      minutes % 60
    ).padStart(2, '0')
  );

}
// =====================================================
// FF HOLZHAUSEN – HELFER-DIENSTPLAN
// ERGÄNZUNG FÜR SCHNELLERES LADEN
// =====================================================
//
// Diese Funktion NICHT als Ersatz für 02_Datenbank.gs
// verwenden. Den Inhalt einfach am Ende von
// 02_Datenbank.gs ergänzen.
//
// Vorteil:
// Die HTML-Oberfläche holt die Grunddaten beim Login
// mit nur EINEM google.script.run-Aufruf.
// =====================================================

function appStartLaden() {

  const helpers = dbGetHelpers();
  const stations = dbGetStations();
  const maps = mapsKarteLaden();
  const settings = dbGetSettings();

  return {
    ok: true,
    helpers: helpers,
    stations: stations,
    maps: maps,
    settings: settings
  };

}