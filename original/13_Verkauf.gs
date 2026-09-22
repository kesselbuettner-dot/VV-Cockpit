// =====================================================
// FF HOLZHAUSEN – HELFER-DIENSTPLAN
// 13_Verkauf.gs
// =====================================================
//
// Verkauf / Artikelstamm
//
// Aufgaben:
// - Artikel verwalten
// - Preise und Pfand verwalten
// - Allergene verwalten
// - Zusatzstoffe verwalten
// - Artikel Stationen zuordnen
// - Artikel aktiv / inaktiv setzen
// - Artikel für die Oberfläche bereitstellen
//
// WICHTIG:
// - Keine eigene HTML-Datei
// - Oberfläche wird später in Index.html integriert
// - Modul 12 Ablaufplan bleibt unangetastet
//
// Tabellenblätter:
//   Artikel
//   Artikel_Stationen
//
// =====================================================


// =====================================================
// KONFIGURATION
// =====================================================

const VERKAUF = {

  SHEETS: {
    ARTIKEL: 'Artikel',
    ARTIKEL_STATIONEN: 'Artikel_Stationen'
  },

  ARTIKEL_HEADERS: [
    'ID',
    'Artikel',
    'Kurzname',
    'Kategorie',
    'Preis',
    'Pfand',
    'Allergene',
    'Zusatzstoffe',
    'Aktiv',
    'Sortierung',
    'Symbol',
    'Alkoholgehalt'
  ],

  ARTIKEL_STATIONEN_HEADERS: [
    'Artikel-ID',
    'Station'
  ]

};


// =====================================================
// HILFSFUNKTION – ADMIN PRÜFEN
// =====================================================

function verkaufAdminPruefen(password) {

  if (getRole(password) !== 'admin') {

    throw new Error(
      'Nur der Admin darf Verkaufsartikel verwalten.'
    );

  }

  return true;

}


// =====================================================
// TABELLENBLÄTTER ANLEGEN
// =====================================================

function verkaufSheetsAnlegen() {

  const ss = dbGetSpreadsheet();


  // ---------------------------------------------------
  // ARTIKEL
  // ---------------------------------------------------

  let artikelSheet =
    ss.getSheetByName(
      VERKAUF.SHEETS.ARTIKEL
    );


  if (!artikelSheet) {

    artikelSheet =
      ss.insertSheet(
        VERKAUF.SHEETS.ARTIKEL
      );

  }


  if (
    artikelSheet.getLastRow() === 0
  ) {

    artikelSheet
      .getRange(
        1,
        1,
        1,
        VERKAUF.ARTIKEL_HEADERS.length
      )
      .setValues([
        VERKAUF.ARTIKEL_HEADERS
      ]);

    artikelSheet
      .setFrozenRows(1);

  }

  // Bestehende Artikel-Tabelle auf die aktuelle Struktur erweitern.
  // K/L werden nur angelegt, wenn sie noch fehlen; vorhandene Daten bleiben erhalten.
  if (artikelSheet.getLastColumn() < VERKAUF.ARTIKEL_HEADERS.length) {
    const startCol = artikelSheet.getLastColumn() + 1;
    const missing = VERKAUF.ARTIKEL_HEADERS.slice(startCol - 1);
    if (missing.length) {
      artikelSheet.getRange(1, startCol, 1, missing.length).setValues([missing]);
    }
  }


  // ---------------------------------------------------
  // ARTIKEL / STATIONEN
  // ---------------------------------------------------

  let stationSheet =
    ss.getSheetByName(
      VERKAUF.SHEETS.ARTIKEL_STATIONEN
    );


  if (!stationSheet) {

    stationSheet =
      ss.insertSheet(
        VERKAUF.SHEETS.ARTIKEL_STATIONEN
      );

  }


  if (
    stationSheet.getLastRow() === 0
  ) {

    stationSheet
      .getRange(
        1,
        1,
        1,
        VERKAUF.ARTIKEL_STATIONEN_HEADERS.length
      )
      .setValues([
        VERKAUF.ARTIKEL_STATIONEN_HEADERS
      ]);

    stationSheet
      .setFrozenRows(1);

  }


  return {

    ok: true,

    artikel:
      VERKAUF.SHEETS.ARTIKEL,

    artikelStationen:
      VERKAUF.SHEETS.ARTIKEL_STATIONEN

  };

}


// =====================================================
// NÄCHSTE ARTIKEL-ID
// =====================================================

function verkaufNaechsteId() {

  verkaufSheetsAnlegen();


  const ss = dbGetSpreadsheet();

  const sheet =
    ss.getSheetByName(
      VERKAUF.SHEETS.ARTIKEL
    );


  const lastRow =
    sheet.getLastRow();


  if (lastRow < 2) {

    return 'ART-001';

  }


  const values =
    sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        1
      )
      .getValues();


  let max = 0;


  values.forEach(
    row => {

      const value =
        String(
          row[0] || ''
        ).trim();


      const match =
        value.match(
          /^ART-(\d+)$/i
        );


      if (match) {

        max =
          Math.max(
            max,
            Number(match[1])
          );

      }

    }
  );


  return (
    'ART-' +
    String(max + 1)
      .padStart(3, '0')
  );

}


// =====================================================
// ALLE ARTIKEL LADEN
// =====================================================

function verkaufArtikelLaden() {

  verkaufSheetsAnlegen();


  const ss =
    dbGetSpreadsheet();


  const artikelSheet =
    ss.getSheetByName(
      VERKAUF.SHEETS.ARTIKEL
    );


  const stationSheet =
    ss.getSheetByName(
      VERKAUF.SHEETS.ARTIKEL_STATIONEN
    );


  const artikel = [];


  // ---------------------------------------------------
  // ARTIKEL
  // ---------------------------------------------------

  if (
    artikelSheet.getLastRow() >= 2
  ) {

    const values =
      artikelSheet
        .getRange(
          2,
          1,
          artikelSheet.getLastRow() - 1,
          VERKAUF.ARTIKEL_HEADERS.length
        )
        .getValues();


    values.forEach(
      row => {

        const id =
          String(
            row[0] || ''
          ).trim();


        const name =
          String(
            row[1] || ''
          ).trim();


        if (!id && !name) {

          return;

        }


        artikel.push({

          id: id,

          name: name,

          short:
            String(
              row[2] || ''
            ).trim(),

          category:
            String(
              row[3] || ''
            ).trim(),

          price:
            Number(
              row[4]
            ) || 0,

          deposit:
            Number(
              row[5]
            ) || 0,

          allergens:
            String(row[6] || '').split(',').map(x => x.trim()).filter(Boolean),

          additives:
            String(row[7] || '').split(',').map(x => x.trim()).filter(Boolean),

          active:
            verkaufBool(
              row[8]
            ),

          sort:
            Number(
              row[9]
            ) || 0,

          icon:
            String(row[10] || '').trim(),

          alkoholgehalt:
            String(row[11] || '').trim(),

          stations: []

        });

      }
    );

  }


  // ---------------------------------------------------
  // STATIONSZUORDNUNGEN
  // ---------------------------------------------------

  if (
    stationSheet.getLastRow() >= 2
  ) {

    const values =
      stationSheet
        .getRange(
          2,
          1,
          stationSheet.getLastRow() - 1,
          2
        )
        .getValues();


    values.forEach(
      row => {

        const artikelId =
          String(
            row[0] || ''
          ).trim();


        const station =
          String(
            row[1] || ''
          ).trim();


        if (
          !artikelId ||
          !station
        ) {

          return;

        }


        const artikelItem =
          artikel.find(
            item =>
              item.id === artikelId
          );


        if (!artikelItem) {

          return;

        }


        if (
          !artikelItem.stations
            .includes(station)
        ) {

          artikelItem.stations
            .push(station);

        }

      }
    );

  }


  // ---------------------------------------------------
  // SORTIERUNG
  // ---------------------------------------------------

  artikel.sort(
    (a, b) => {

      if (
        a.sort !== b.sort
      ) {

        return a.sort - b.sort;

      }


      return a.name.localeCompare(
        b.name,
        'de'
      );

    }
  );


  return artikel;

}


// =====================================================
// ARTIKEL EINZELN LADEN
// =====================================================

function verkaufArtikelFinden(
  artikelId
) {

  const id =
    String(
      artikelId || ''
    ).trim();


  if (!id) {

    return null;

  }


  return (
    verkaufArtikelLaden()
      .find(
        artikel =>
          artikel.id === id
      ) ||
    null
  );

}


// =====================================================
// ARTIKEL SPEICHERN
// =====================================================

function verkaufArtikelSpeichern(
  password,
  data
) {

  verkaufAdminPruefen(
    password
  );


  data =
    data || {};


  verkaufSheetsAnlegen();


  const name =
    String(
      data.name || ''
    ).trim();


  const short =
    String(
      data.short || ''
    ).trim();


  const category =
    String(
      data.category || ''
    ).trim();


  const price =
    Number(
      data.price
    );


  const deposit =
    Number(
      data.deposit
    ) || 0;


  const allergens =
    verkaufListe(
      data.allergens
    );


  const additives =
    verkaufListe(
      data.additives
    );


  const active =
    data.active !== false;


  const sort =
    Number(
      data.sort
    ) || 0;


  const icon =
    String(data.icon || '').trim();


  const alkoholgehalt =
    String(data.alkoholgehalt || '').trim();


  let id =
    String(
      data.id || ''
    ).trim();


  if (!name) {

    throw new Error(
      'Artikelname fehlt.'
    );

  }


  if (
    !Number.isFinite(price) ||
    price < 0
  ) {

    throw new Error(
      'Ungültiger Verkaufspreis.'
    );

  }


  if (
    !Number.isFinite(deposit) ||
    deposit < 0
  ) {

    throw new Error(
      'Ungültiger Pfandbetrag.'
    );

  }


  if (!id) {

    id =
      verkaufNaechsteId();

  }


  const ss =
    dbGetSpreadsheet();


  const sheet =
    ss.getSheetByName(
      VERKAUF.SHEETS.ARTIKEL
    );


  const lastRow =
    sheet.getLastRow();


  let targetRow = 0;
  let wasUpdate = false;


  if (lastRow >= 2) {

    const ids =
      sheet
        .getRange(
          2,
          1,
          lastRow - 1,
          1
        )
        .getValues();


    ids.some(
      (row, index) => {

        if (
          String(
            row[0] || ''
          ).trim() === id
        ) {

          targetRow =
            index + 2;
          wasUpdate = true;

          return true;

        }

        return false;

      }
    );

  }


  const values = [

    id,

    name,

    short,

    category,

    price,

    deposit,

    allergens.join(', '),

    additives.join(', '),

    active,

    sort,

    icon,

    alkoholgehalt

  ];


  if (targetRow) {

    sheet
      .getRange(
        targetRow,
        1,
        1,
        values.length
      )
      .setValues([
        values
      ]);

  } else {

    targetRow =
      sheet.getLastRow() + 1;


    sheet
      .getRange(
        targetRow,
        1,
        1,
        values.length
      )
      .setValues([
        values
      ]);

  }


  // ---------------------------------------------------
  // STATIONEN SPEICHERN
  // ---------------------------------------------------

  verkaufArtikelStationenSpeichernIntern(
    id,
    data.stations
  );


  SpreadsheetApp.flush();


  return {

    ok: true,
    updated: wasUpdate,

    id: id,

    article:
      verkaufArtikelFinden(
        id
      ),

    articles:
      verkaufArtikelLaden()

  };

}


// =====================================================
// ARTIKEL LÖSCHEN
// =====================================================

function verkaufArtikelLoeschen(
  password,
  artikelId
) {

  verkaufAdminPruefen(
    password
  );


  const id =
    String(
      artikelId || ''
    ).trim();


  if (!id) {

    throw new Error(
      'Artikel-ID fehlt.'
    );

  }


  verkaufSheetsAnlegen();


  const ss =
    dbGetSpreadsheet();


  const sheet =
    ss.getSheetByName(
      VERKAUF.SHEETS.ARTIKEL
    );


  const lastRow =
    sheet.getLastRow();


  if (lastRow >= 2) {

    const ids =
      sheet
        .getRange(
          2,
          1,
          lastRow - 1,
          1
        )
        .getValues();


    for (
      let i = 0;
      i < ids.length;
      i++
    ) {

      if (
        String(
          ids[i][0] || ''
        ).trim() === id
      ) {

        sheet.deleteRow(
          i + 2
        );

        break;

      }

    }

  }


  verkaufArtikelStationenLoeschenIntern(
    id
  );


  SpreadsheetApp.flush();


  return {

    ok: true,

    articles:
      verkaufArtikelLaden()

  };

}


// =====================================================
// ARTIKEL AKTIV / INAKTIV
// =====================================================

function verkaufArtikelStatusSetzen(
  password,
  artikelId,
  active
) {

  verkaufAdminPruefen(
    password
  );


  const artikel =
    verkaufArtikelFinden(
      artikelId
    );


  if (!artikel) {

    throw new Error(
      'Artikel wurde nicht gefunden.'
    );

  }


  const ss =
    dbGetSpreadsheet();


  const sheet =
    ss.getSheetByName(
      VERKAUF.SHEETS.ARTIKEL
    );


  sheet
    .getRange(
      verkaufArtikelZeile(
        artikel.id
      ),
      9
    )
    .setValue(
      active === true
    );


  SpreadsheetApp.flush();


  return {

    ok: true,

    article:
      verkaufArtikelFinden(
        artikel.id
      )

  };

}


// =====================================================
// ARTIKELZEILE FINDEN
// =====================================================

function verkaufArtikelZeile(
  artikelId
) {

  const ss =
    dbGetSpreadsheet();


  const sheet =
    ss.getSheetByName(
      VERKAUF.SHEETS.ARTIKEL
    );


  if (
    !sheet ||
    sheet.getLastRow() < 2
  ) {

    return 0;

  }


  const values =
    sheet
      .getRange(
        2,
        1,
        sheet.getLastRow() - 1,
        1
      )
      .getValues();


  for (
    let i = 0;
    i < values.length;
    i++
  ) {

    if (
      String(
        values[i][0] || ''
      ).trim() ===
      String(
        artikelId || ''
      ).trim()
    ) {

      return i + 2;

    }

  }


  return 0;

}


// =====================================================
// STATIONEN EINES ARTIKELS SPEICHERN
// =====================================================

function verkaufArtikelStationenSpeichern(
  password,
  artikelId,
  stations
) {

  verkaufAdminPruefen(
    password
  );


  const artikel =
    verkaufArtikelFinden(
      artikelId
    );


  if (!artikel) {

    throw new Error(
      'Artikel wurde nicht gefunden.'
    );

  }


  verkaufArtikelStationenSpeichernIntern(
    artikel.id,
    stations
  );


  SpreadsheetApp.flush();


  return {

    ok: true,

    article:
      verkaufArtikelFinden(
        artikel.id
      )

  };

}


// =====================================================
// STATIONEN INTERN SPEICHERN
// =====================================================

function verkaufArtikelStationenSpeichernIntern(
  artikelId,
  stations
) {

  const ss =
    dbGetSpreadsheet();


  const sheet =
    ss.getSheetByName(
      VERKAUF.SHEETS.ARTIKEL_STATIONEN
    );


  if (!sheet) {

    throw new Error(
      'Tabellenblatt "' +
      VERKAUF.SHEETS.ARTIKEL_STATIONEN +
      '" fehlt.'
    );

  }


  const id =
    String(
      artikelId || ''
    ).trim();


  const stationListe =
    Array.isArray(stations)
      ? stations
      : (
          stations
            ? [stations]
            : []
        );


  // ---------------------------------------------------
  // Alte Zuordnungen entfernen
  // ---------------------------------------------------

  const lastRow =
    sheet.getLastRow();


  if (lastRow >= 2) {

    const values =
      sheet
        .getRange(
          2,
          1,
          lastRow - 1,
          2
        )
        .getValues();


    for (
      let i = values.length - 1;
      i >= 0;
      i--
    ) {

      if (
        String(
          values[i][0] || ''
        ).trim() === id
      ) {

        sheet.deleteRow(
          i + 2
        );

      }

    }

  }


  // ---------------------------------------------------
  // Neue Zuordnungen
  // ---------------------------------------------------

  const rows = [];


  stationListe.forEach(
    station => {

      const name =
        String(
          station || ''
        ).trim();


      if (!name) {

        return;

      }


      if (
        !rows.some(
          row =>
            row[1] === name
        )
      ) {

        rows.push([
          id,
          name
        ]);

      }

    }
  );


  if (rows.length) {

    sheet
      .getRange(
        sheet.getLastRow() + 1,
        1,
        rows.length,
        2
      )
      .setValues(
        rows
      );

  }

}


// =====================================================
// STATIONENZUORDNUNG LÖSCHEN
// =====================================================

function verkaufArtikelStationenLoeschenIntern(
  artikelId
) {

  const ss =
    dbGetSpreadsheet();


  const sheet =
    ss.getSheetByName(
      VERKAUF.SHEETS.ARTIKEL_STATIONEN
    );


  if (
    !sheet ||
    sheet.getLastRow() < 2
  ) {

    return;

  }


  const id =
    String(
      artikelId || ''
    ).trim();


  const values =
    sheet
      .getRange(
        2,
        1,
        sheet.getLastRow() - 1,
        2
      )
      .getValues();


  for (
    let i = values.length - 1;
    i >= 0;
    i--
  ) {

    if (
      String(
        values[i][0] || ''
      ).trim() === id
    ) {

      sheet.deleteRow(
        i + 2
      );

    }

  }

}


// =====================================================
// ARTIKEL EINER STATION
// =====================================================

function verkaufArtikelFuerStation(
  stationName
) {

  const station =
    String(
      stationName || ''
    ).trim();


  if (!station) {

    return [];

  }


  return verkaufArtikelLaden()
    .filter(
      artikel =>
        artikel.active &&
        artikel.stations
          .includes(station)
    );

}


// =====================================================
// AKTIVE ARTIKEL
// =====================================================

function verkaufAktiveArtikel() {

  return verkaufArtikelLaden()
    .filter(
      artikel =>
        artikel.active
    );

}


// =====================================================
// STATIONEN MIT ARTIKELN
// =====================================================

function verkaufStationenMitArtikeln() {

  const stations =
    dbGetStations();


  const artikel =
    verkaufArtikelLaden();


  return stations.map(
    station => ({

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

      articles:
        artikel.filter(
          item =>
            item.active &&
            item.stations
              .includes(
                station.name
              )
        )

    })
  );

}


// =====================================================
// GESAMTDATEN FÜR INDEX.HTML
// =====================================================

function verkaufDatenLaden() {

  verkaufSheetsAnlegen();


  return {

    ok: true,

    articles:
      verkaufArtikelLaden(),

    stations:
      verkaufStationenMitArtikeln(),

    stationNames:
      dbGetStations()
        .map(
          station =>
            station.name
        )

  };

}


// =====================================================
// ALLERGENE
// =====================================================

function verkaufAllergene() {

  return [

    {
      code: 'A',
      name: 'Glutenhaltiges Getreide'
    },

    {
      code: 'B',
      name: 'Krebstiere'
    },

    {
      code: 'C',
      name: 'Eier'
    },

    {
      code: 'D',
      name: 'Fisch'
    },

    {
      code: 'E',
      name: 'Erdnüsse'
    },

    {
      code: 'F',
      name: 'Soja'
    },

    {
      code: 'G',
      name: 'Milch'
    },

    {
      code: 'H',
      name: 'Schalenfrüchte'
    },

    {
      code: 'L',
      name: 'Sellerie'
    },

    {
      code: 'M',
      name: 'Senf'
    },

    {
      code: 'N',
      name: 'Sesamsamen'
    },

    {
      code: 'O',
      name: 'Schwefeldioxid / Sulfite'
    },

    {
      code: 'P',
      name: 'Lupinen'
    },

    {
      code: 'R',
      name: 'Weichtiere'
    }

  ];

}


// =====================================================
// ZUSATZSTOFFE
// =====================================================

function verkaufZusatzstoffe() {

  return [

    {
      code: '1',
      name: 'Farbstoff'
    },

    {
      code: '2',
      name: 'Konservierungsstoff'
    },

    {
      code: '3',
      name: 'Antioxidationsmittel'
    },

    {
      code: '4',
      name: 'Geschmacksverstärker'
    },

    {
      code: '5',
      name: 'Schwefeldioxid / Sulfite'
    },

    {
      code: '6',
      name: 'Schwärzungsmittel'
    },

    {
      code: '7',
      name: 'Phosphat'
    },

    {
      code: '8',
      name: 'Milcheiweiß'
    },

    {
      code: '9',
      name: 'Koffein'
    },

    {
      code: '10',
      name: 'Chinin'
    },

    {
      code: '11',
      name: 'Süßungsmittel'
    },

    {
      code: '12',
      name: 'Phenylalaninquelle'
    },

    {
      code: '13',
      name: 'gewachst'
    },

    {
      code: '14',
      name: 'Taurin'
    }

  ];

}


// =====================================================
// HILFSFUNKTIONEN
// =====================================================

function verkaufBool(
  value
) {

  if (
    value === true
  ) {

    return true;

  }


  const text =
    String(
      value || ''
    )
      .trim()
      .toLowerCase();


  return (
    text === 'true' ||
    text === 'ja' ||
    text === 'yes' ||
    text === '1' ||
    text === 'x'
  );

}


function verkaufListe(
  value
) {

  if (
    Array.isArray(value)
  ) {

    return value
      .map(
        item =>
          String(
            item || ''
          ).trim()
      )
      .filter(
        Boolean
      );

  }


  if (!value) {

    return [];

  }


  return String(
    value
  )
    .split(',')
    .map(
      item =>
        item.trim()
    )
    .filter(
      Boolean
    );

}


// =====================================================
// TEST / INITIALISIERUNG
// =====================================================

function verkaufInitialisieren() {

  return verkaufSheetsAnlegen();

}


function verkaufTest() {

  verkaufSheetsAnlegen();


  return {

    ok: true,

    sheets:
      verkaufSheetsAnlegen(),

    articles:
      verkaufArtikelLaden(),

    stations:
      dbGetStations()
        .map(
          station =>
            station.name
        ),

    allergens:
      verkaufAllergene(),

    additives:
      verkaufZusatzstoffe()

  };

}

// Einheitlicher Artikel-Speicher-Endpunkt für das Frontend.
function artikelSpeichern(password, data) {
  return verkaufArtikelSpeichern(password, data);
}

// Expliziter Reload-Endpunkt für die Artikelliste.
function artikelListeLaden(password) {
  verkaufAdminPruefen(password);
  return verkaufArtikelLaden();
}
