// =====================================================
// FF HOLZHAUSEN – STATIONSVERWALTUNG
// 08_Stationsverwaltung_Zeiten.gs
// =====================================================


// =====================================================
// STATIONEN LADEN
// =====================================================

function stationenLaden(password) {

  if (!getRole(password)) {
    throw new Error('Falsches Passwort.');
  }

  return dbGetStations();
}


// =====================================================
// STATION SPEICHERN
// =====================================================

function stationSpeichern(password, data) {

  const role = getRole(password);

  if (role !== 'admin') {
    throw new Error(
      'Nur der Admin darf Stationen speichern.'
    );
  }

  data = data || {};

  const name =
    String(data.name || '').trim();

  const short =
    String(data.short || '').trim() ||
    name.charAt(0).toUpperCase();

  const color =
    String(data.color || '').trim();

  const maps =
    String(data.maps || '').trim();

  const hint =
    String(data.hint || '').trim();

  const needed =
    Number(data.needed || 1);

  const row =
    Number(data.row || 0);


  if (!name) {
    throw new Error(
      'Bitte einen Stationsnamen eingeben.'
    );
  }


  if (!Number.isFinite(needed) || needed < 1) {
    throw new Error(
      'Benötigte Helfer muss mindestens 1 sein.'
    );
  }


  // ---------------------------------------------------
  // Tageszeiten aus dem Frontend übernehmen
  // ---------------------------------------------------

  let tage = [];

  if (Array.isArray(data.tage)) {

    tage = data.tage
      .map(function(t) {

        const tag =
          Number(t && t.tag || 0);

        const datum =
          String(t && t.datum || '').trim();

        const von =
          dbFormatTime(
            t && (t.von || t.start || '')
          );

        const bis =
          dbFormatTime(
            t && (t.bis || t.end || '')
          );

        return {
          tag: tag,
          datum: datum,
          von: von,
          bis: bis
        };

      })
      .filter(function(t) {

        return t.tag > 0;

      });

  }


  // ---------------------------------------------------
  // Tageszeiten prüfen
  // ---------------------------------------------------

  tage.forEach(function(t) {

    // Leerer Tag ist erlaubt
    if (!t.von && !t.bis) {
      return;
    }

    if (!t.von || !t.bis) {
      throw new Error(
        'Für Tag ' +
        t.tag +
        ' müssen Beginn und Ende gemeinsam gesetzt werden.'
      );
    }

    if (
      dbTimeToMinutes(t.bis) <=
      dbTimeToMinutes(t.von)
    ) {
      throw new Error(
        'Das Stationsende muss nach dem Beginn liegen ' +
        '(Tag ' + t.tag + ').'
      );
    }

  });


  // ---------------------------------------------------
  // Alte Beginn/Ende-Spalten
  // ---------------------------------------------------
  //
  // G/H bleiben aus Kompatibilitätsgründen erhalten.
  // Wenn Tag 1 existiert, werden dessen Zeiten verwendet.
  //

  let start = '';
  let end = '';

  const tag1 =
    tage.find(function(t) {

      return Number(t.tag) === 1;

    });


  if (tag1) {

    start =
      tag1.von || '';

    end =
      tag1.bis || '';

  }


  // ---------------------------------------------------
  // Falls keine Tageszeiten vorhanden sind:
  // alte Start/End-Werte übernehmen
  // ---------------------------------------------------

  if (!tage.length) {

    start =
      dbFormatTime(data.start || '');

    end =
      dbFormatTime(data.end || '');

    if (
      (start && !end) ||
      (!start && end)
    ) {
      throw new Error(
        'Stationsbeginn und Stationsende müssen beide gesetzt werden.'
      );
    }

    if (
      start &&
      end &&
      dbTimeToMinutes(end) <=
      dbTimeToMinutes(start)
    ) {
      throw new Error(
        'Das Stationsende muss nach dem Stationsbeginn liegen.'
      );
    }

  }


  // ---------------------------------------------------
  // Spreadsheet
  // ---------------------------------------------------

  const ss =
    dbGetSpreadsheet();

  const sheet =
    ss.getSheetByName(
      APP.SHEETS.STATIONEN
    );


  if (!sheet) {
    throw new Error(
      'Tabellenblatt "Stationen" wurde nicht gefunden.'
    );
  }


  // Mindestens 9 Spalten sicherstellen

  if (sheet.getMaxColumns() < 9) {

    sheet.insertColumnsAfter(
      sheet.getMaxColumns(),
      9 - sheet.getMaxColumns()
    );

  }


  // Kopfzeilen

  sheet
    .getRange(1, 7, 1, 3)
    .setValues([[
      'Beginn',
      'Ende',
      'Tageszeiten'
    ]]);


  // ---------------------------------------------------
  // Doppelte Stationsnamen verhindern
  // ---------------------------------------------------

  const lastRow =
    sheet.getLastRow();

  const existing =
    lastRow >= 2
      ? sheet
          .getRange(
            2,
            1,
            lastRow - 1,
            9
          )
          .getValues()
      : [];


  const duplicate =
    existing.some(function(r, i) {

      const sheetRow =
        i + 2;

      return (
        sheetRow !== row &&
        String(r[0] || '')
          .trim()
          .toLowerCase() ===
        name.toLowerCase()
      );

    });


  if (duplicate) {
    throw new Error(
      'Eine Station mit diesem Namen existiert bereits.'
    );
  }


  // ---------------------------------------------------
  // Zielzeile
  // ---------------------------------------------------

  let targetRow = row;


  if (
    targetRow < 2 ||
    targetRow > lastRow
  ) {

    targetRow =
      Math.max(
        2,
        lastRow + 1
      );

  }


  // ---------------------------------------------------
  // Speichern
  // ---------------------------------------------------

  const values = [[

    name,
    short,
    color,
    needed,
    maps,
    hint,
    start,
    end,
    tage.length
      ? JSON.stringify(tage)
      : ''

  ]];


  sheet
    .getRange(
      targetRow,
      1,
      1,
      9
    )
    .setValues(values);


  SpreadsheetApp.flush();


  return {

    ok: true,

    row: targetRow,

    stations:
      dbGetStations()

  };

}


// =====================================================
// STATIONSZEITEN AKTUALISIEREN
// =====================================================

function stationsZeitenAktualisieren() {

  return dbGetStations();

}


// =====================================================
// STATIONEN FÜR EINEN TAG
// =====================================================

function stationenFuerTag(tag) {

  const nr =
    Number(tag);

  if (!nr) {
    return [];
  }


  return dbGetStations()

    .filter(function(station) {

      return (
        Array.isArray(station.tage) &&
        station.tage.some(function(t) {

          return Number(t.tag) === nr;

        })
      );

    })

    .map(function(station) {

      const t =
        station.tage.find(function(t) {

          return Number(t.tag) === nr;

        });


      return {

        row:
          station.row,

        name:
          station.name,

        short:
          station.short,

        color:
          station.color,

        needed:
          station.needed,

        maps:
          station.maps,

        hint:
          station.hint,

        tag:
          t.tag,

        datum:
          t.datum || '',

        von:
          t.von || '',

        bis:
          t.bis || ''

      };

    });

}