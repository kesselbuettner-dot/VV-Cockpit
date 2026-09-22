// =====================================================
// FF HOLZHAUSEN – HELFER-DIENSTPLAN
// 14_Kassenhilfe.gs
// =====================================================
//
// Kassenverwaltung und Kassenbetrieb.
//
// Dieses Modul verwendet die Verkaufsartikel aus
// Modul 13.
//
// Eigene Tabellen:
//   - Kassen
//   - Kassenverkäufe
//
// Mehrere Kassen können gleichzeitig arbeiten.
//
// =====================================================


// =====================================================
// TABELLENNAMEN
// =====================================================

const KASSEN_SHEET = 'Kassen';
const KASSEN_VERKAEUFE_SHEET = 'Kassenverkäufe';
const KASSEN_ARTIKEL_STATUS_SHEET = 'KassenArtikelStatus';


// =====================================================
// KASSEN-TABELLEN ANLEGEN
// =====================================================

function kassenTabellenAnlegen() {

  const ss = dbGetSpreadsheet();

  let kassen =
    ss.getSheetByName(KASSEN_SHEET);

  if (!kassen) {

    kassen =
      ss.insertSheet(KASSEN_SHEET);

    kassen
      .getRange(1, 1, 1, 7)
      .setValues([[
        'ID',
        'Kasse',
        'Station',
        'Beschreibung',
        'Aktiv',
        'Erstellt',
        'Artikelreihenfolge'
      ]]);

    kassen
      .getRange(1, 1, 1, 7)
      .setFontWeight('bold');

  }


  // Bestehende Kassen-Tabelle auf die optionale
  // Artikelreihenfolge erweitern.
  if (kassen.getRange(1, 7).getValue() !== 'Artikelreihenfolge') {
    kassen.getRange(1, 7).setValue('Artikelreihenfolge');
    kassen.getRange(1, 7).setFontWeight('bold');
  }


  let verkaeufe =
    ss.getSheetByName(
      KASSEN_VERKAEUFE_SHEET
    );

  if (!verkaeufe) {

    verkaeufe =
      ss.insertSheet(
        KASSEN_VERKAEUFE_SHEET
      );

    verkaeufe
      .getRange(1, 1, 1, 13)
      .setValues([[
        'Verkauf-ID',
        'Zeit',
        'Kasse-ID',
        'Kasse',
        'Station',
        'Artikel-ID',
        'Artikel',
        'Menge',
        'Einzelpreis',
        'Pfand',
        'Gesamt',
        'Benutzer',
        'Veranstaltung'
      ]]);

    verkaeufe
      .getRange(1, 1, 1, 13)
      .setFontWeight('bold');

  }


  // -----------------------------------------------------
  // ARTIKELSTATUS – FAST ALLE / ALLE
  // -----------------------------------------------------
  let statusSheet =
    ss.getSheetByName(KASSEN_ARTIKEL_STATUS_SHEET);

  if (!statusSheet) {
    statusSheet = ss.insertSheet(KASSEN_ARTIKEL_STATUS_SHEET);
    statusSheet.getRange(1, 1, 1, 7).setValues([[
      'Kasse-ID',
      'Artikel-ID',
      'Status',
      'Nachschub',
      'Aktualisiert',
      'Artikel',
      'Station'
    ]]);
    statusSheet.getRange(1, 1, 1, 7).setFontWeight('bold');
  }

  return {
    ok: true,
    kassen: KASSEN_SHEET,
    verkaeufe: KASSEN_VERKAEUFE_SHEET,
    artikelStatus: KASSEN_ARTIKEL_STATUS_SHEET
  };

}


// =====================================================
// KASSEN LADEN
// =====================================================

function kassenLaden(
  password
) {

  const role =
    getRole(password);

  if (
    role !== 'admin' &&
    role !== 'kasse'
  ) {

    throw new Error(
      'Keine Berechtigung.'
    );

  }


  kassenTabellenAnlegen();


  const ss =
    dbGetSpreadsheet();

  const sheet =
    ss.getSheetByName(
      KASSEN_SHEET
    );

  const lastRow =
    sheet.getLastRow();


  if (lastRow < 2) {

    return [];

  }


  const values =
    sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        7
      )
      .getValues();


  return values
    .map(
      row => ({

        id:
          String(row[0] || ''),

        name:
          String(row[1] || ''),

        station:
          String(row[2] || ''),

        description:
          String(row[3] || ''),

        active:
          row[4] !== false &&
          String(row[4])
            .toLowerCase() !== 'false',

        created:
          String(row[5] || ''),

        artikelreihenfolge:
          parseArtikelReihenfolge_(row[6])

      })
    )
    .filter(
      kasse =>
        kasse.id &&
        kasse.name
    );

}


// =====================================================
// EINZELNE KASSE FINDEN
// =====================================================

function kasseFinden(
  kasseId
) {

  const id =
    String(
      kasseId || ''
    ).trim();


  if (!id) {

    return null;

  }


  const kassen =
    kassenLadenAlsAdmin();


  return (
    kassen.find(
      kasse =>
        kasse.id === id
    ) ||
    null
  );

}


// =====================================================
// KASSEN OHNE ROLLENPRÜFUNG
// =====================================================

function kassenLadenAlsAdmin() {

  kassenTabellenAnlegen();


  const ss =
    dbGetSpreadsheet();

  const sheet =
    ss.getSheetByName(
      KASSEN_SHEET
    );

  const lastRow =
    sheet.getLastRow();


  if (lastRow < 2) {

    return [];

  }


  const values =
    sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        7
      )
      .getValues();


  return values
    .map(
      row => ({

        id:
          String(row[0] || ''),

        name:
          String(row[1] || ''),

        station:
          String(row[2] || ''),

        description:
          String(row[3] || ''),

        active:
          row[4] !== false &&
          String(row[4])
            .toLowerCase() !== 'false',

        created:
          String(row[5] || ''),

        artikelreihenfolge:
          parseArtikelReihenfolge_(row[6])

      })
    )
    .filter(
      kasse =>
        kasse.id &&
        kasse.name
    );

}


// =====================================================
// KASSE SPEICHERN
// =====================================================

function kasseSpeichern(
  password,
  data
) {

  if (
    getRole(password) !==
    'admin'
  ) {

    throw new Error(
      'Nur der Admin darf Kassen verwalten.'
    );

  }


  data =
    data || {};


  const id =
    String(
      data.id || ''
    ).trim();


  const name =
    String(
      data.name || ''
    ).trim();


  const station =
    String(
      data.station || ''
    ).trim();


  const description =
    String(
      data.description || ''
    ).trim();


  const active =
    data.active !== false;


  if (!name) {

    throw new Error(
      'Kassenname fehlt.'
    );

  }


  kassenTabellenAnlegen();


  const ss =
    dbGetSpreadsheet();

  const sheet =
    ss.getSheetByName(
      KASSEN_SHEET
    );


  const existing =
    kassenLadenAlsAdmin();


  if (id) {

    const index =
      existing.findIndex(
        kasse =>
          kasse.id === id
      );


    if (index < 0) {

      throw new Error(
        'Kasse wurde nicht gefunden.'
      );

    }


    const row =
      index + 2;


    sheet
      .getRange(
        row,
        2,
        1,
        4
      )
      .setValues([[
        name,
        station,
        description,
        active
      ]]);

  } else {

    const newId =
      Utilities
        .getUuid();


    sheet
      .appendRow([
        newId,
        name,
        station,
        description,
        active,
        new Date()
      ]);

  }


  SpreadsheetApp.flush();


  return {

    ok: true,

    kassen:
      kassenLadenAlsAdmin()

  };

}


// =====================================================
// KASSE LÖSCHEN
// =====================================================

function kasseLoeschen(
  password,
  kasseId
) {

  if (
    getRole(password) !==
    'admin'
  ) {

    throw new Error(
      'Nur der Admin darf Kassen löschen.'
    );

  }


  const id =
    String(
      kasseId || ''
    ).trim();


  if (!id) {

    throw new Error(
      'Kassen-ID fehlt.'
    );

  }


  kassenTabellenAnlegen();


  const ss =
    dbGetSpreadsheet();

  const sheet =
    ss.getSheetByName(
      KASSEN_SHEET
    );


  const lastRow =
    sheet.getLastRow();


  if (lastRow < 2) {

    throw new Error(
      'Kasse wurde nicht gefunden.'
    );

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


  for (
    let i = 0;
    i < values.length;
    i++
  ) {

    if (
      String(
        values[i][0]
      ) === id
    ) {

      sheet.deleteRow(
        i + 2
      );

      SpreadsheetApp.flush();

      return {

        ok: true,

        kassen:
          kassenLadenAlsAdmin()

      };

    }

  }


  throw new Error(
    'Kasse wurde nicht gefunden.'
  );

}


// =====================================================
// ARTIKEL FÜR EINE KASSE LADEN
// =====================================================
//
// Es werden nur aktive Verkaufsartikel
// angezeigt, die der Station der Kasse
// zugeordnet sind.
//
// =====================================================

function kassenArtikelLaden(
  password,
  kasseId
) {

  const role =
    getRole(password);


  if (
    role !== 'admin' &&
    role !== 'kasse'
  ) {

    throw new Error(
      'Keine Berechtigung.'
    );

  }


  const kasse =
    kasseFinden(
      kasseId
    );


  if (!kasse) {

    throw new Error(
      'Kasse wurde nicht gefunden.'
    );

  }


  if (!kasse.active) {

    throw new Error(
      'Diese Kasse ist deaktiviert.'
    );

  }


  /*
   * Modul 13 stellt die Verkaufsartikel bereit.
   *
   * Unterstützt werden die bisher definierten
   * Felder:
   *
   * id
   * name
   * short
   * category
   * price
   * deposit
   * active
   * stations
   * allergens
   * additives
   */

  if (
    typeof verkaufArtikelLaden !==
    'function'
  ) {

    throw new Error(
      'Modul 13 – Verkauf ist nicht verfügbar.'
    );

  }


  const artikel =
    verkaufArtikelLaden();


  const station =
    String(
      kasse.station || ''
    ).trim();

  const statusMap = kassenArtikelStatusLaden_(kasseId);

  return artikel
    .filter(
      item => {

        if (
          item.active === false
        ) {

          return false;

        }


        if (!station) {

          return true;

        }


        const stations =
          item.stations || [];


        return stations.includes(
          station
        );

      }
    )
    .map(
      item => {

        const status = statusMap[String(item.id)] || {};

        return {
          id: item.id,
          name: item.name,
          short: item.short || '',
          category: item.category || '',
          price: Number(item.price || 0),
          deposit: Number(item.deposit || 0),
          allergens: item.allergens || [],
          additives: item.additives || [],
          stations: item.stations || [],
          kassenStatus: status.status || '',
          nachschub: status.nachschub === true,
          statusAktualisiert: status.aktualisiert || ''
        };
      }
    );

}



// =====================================================
// ARTIKELSTATUS – FAST ALLE / ALLE
// =====================================================

function kassenArtikelStatusLaden_(kasseId) {
  kassenTabellenAnlegen();

  const id = String(kasseId || '').trim();
  const ss = dbGetSpreadsheet();
  const sheet = ss.getSheetByName(KASSEN_ARTIKEL_STATUS_SHEET);
  const result = {};

  if (!sheet || sheet.getLastRow() < 2 || !id) return result;

  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 7).getValues();

  rows.forEach(row => {
    if (String(row[0] || '').trim() !== id) return;
    const artikelId = String(row[1] || '').trim();
    if (!artikelId) return;

    const status = String(row[2] || '').trim().toLowerCase();
    result[artikelId] = {
      status: status === 'alle' ? 'alle' : (status === 'fast_alle' ? 'fast_alle' : ''),
      nachschub: row[3] === true || String(row[3] || '').toLowerCase() === 'true',
      aktualisiert: String(row[4] || ''),
      artikel: String(row[5] || ''),
      station: String(row[6] || '')
    };
  });

  return result;
}


function kassenArtikelStatusSetzen(password, kasseId, artikelId, status, nachschub) {
  const role = getRole(password);
  if (role !== 'admin') {
    throw new Error('Keine Berechtigung.');
  }

  const id = String(kasseId || '').trim();
  const aid = String(artikelId || '').trim();
  const st = String(status || '').trim().toLowerCase();

  if (!id || !aid) throw new Error('Kasse oder Artikel fehlt.');
  if (st !== 'fast_alle' && st !== 'alle' && st !== 'normal') {
    throw new Error('Ungültiger Artikelstatus.');
  }

  const kasse = kasseFinden(id);
  if (!kasse) throw new Error('Kasse wurde nicht gefunden.');

  const artikel = verkaufArtikelFinden(aid);
  if (!artikel) throw new Error('Artikel wurde nicht gefunden.');

  kassenTabellenAnlegen();
  const ss = dbGetSpreadsheet();
  const sheet = ss.getSheetByName(KASSEN_ARTIKEL_STATUS_SHEET);
  const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm:ss');

  const values = sheet.getLastRow() >= 2
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 7).getValues()
    : [];

  let rowNumber = 0;
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0] || '').trim() === id &&
        String(values[i][1] || '').trim() === aid) {
      rowNumber = i + 2;
      break;
    }
  }

  if (st === 'normal') {
    if (rowNumber) sheet.deleteRow(rowNumber);
  } else {
    const row = [
      id,
      aid,
      st,
      nachschub === true || String(nachschub || '').toLowerCase() === 'true',
      now,
      artikel.name || '',
      kasse.station || ''
    ];

    if (rowNumber) {
      sheet.getRange(rowNumber, 1, 1, 7).setValues([row]);
    } else {
      sheet.appendRow(row);
    }
  }

  SpreadsheetApp.flush();

  return {
    ok: true,
    kasseId: id,
    artikelId: aid,
    status: st,
    nachschub: nachschub === true || String(nachschub || '').toLowerCase() === 'true',
    aktualisiert: now
  };
}




function kassenDienstplanAktuell(password, kasseId) {
  const role = getRole(password);
  if (role !== 'admin' && role !== 'kasse' && role !== 'viewer') {
    throw new Error('Keine Berechtigung.');
  }

  const id = String(kasseId || '').trim();
  if (!id) return {personen: []};

  // Nutzt vorhandene Dienstplan-/Stationsdaten, sofern verfügbar.
  // Die konkrete Datenstruktur wird aus der bestehenden Dienstplanfunktion übernommen.
  if (typeof dienstplanAktuellFuerKasse === 'function') {
    return dienstplanAktuellFuerKasse(password, id) || {personen: []};
  }

  return {personen: []};
}

function kassenAblosungAnfordern(password, kasseId) {
  const role = getRole(password);
  if (role !== 'admin') {
    throw new Error('Keine Berechtigung.');
  }

  const id = String(kasseId || '').trim();
  if (!id) throw new Error('Kasse fehlt.');

  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName('KassenAblosungen');
  if (!sh) {
    sh = ss.insertSheet('KassenAblosungen');
    sh.getRange(1,1,1,7).setValues([[
      'Zeitpunkt','Kasse-ID','Status','Angefordert von','Erledigt am','Erledigt von','Kasse'
    ]]);
  }

  const kasse = kasseFinden(id);
  const now = new Date();
  sh.appendRow([
    now,
    id,
    'offen',
    role,
    '',
    '',
    kasse ? (kasse.name || kasse.station || id) : id
  ]);

  return {ok:true, status:'offen', angefordertAm:now};
}


function kassenArtikelNachschubGeliefert(password, kasseId, artikelId) {
  const role = getRole(password);
  if (role !== 'admin') {
    throw new Error('Keine Berechtigung.');
  }

  const id = String(kasseId || '').trim();
  const aid = String(artikelId || '').trim();
  if (!id || !aid) throw new Error('Kasse oder Artikel fehlt.');

  const kasse = kasseFinden(id);
  if (!kasse) throw new Error('Kasse wurde nicht gefunden.');

  const artikel = verkaufArtikelFinden(aid);
  if (!artikel) throw new Error('Artikel wurde nicht gefunden.');

  // Lieferung hebt den stationsbezogenen Status auf.
  const result = kassenArtikelStatusSetzen(
    password, id, aid, 'normal', false
  );

  const now = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    'dd.MM.yyyy HH:mm:ss'
  );

  return {
    ok: true,
    kasseId: id,
    artikelId: aid,
    status: 'normal',
    nachschubGeliefert: true,
    geliefertAm: now,
    aktualisiert: result && result.aktualisiert ? result.aktualisiert : now
  };
}


function kassenArtikelStatusDashboard(password) {
  const role = getRole(password);
  if (role !== 'admin' && role !== 'kasse' && role !== 'viewer') {
    throw new Error('Keine Berechtigung.');
  }

  kassenTabellenAnlegen();

  const ss = dbGetSpreadsheet();
  const statusSheet = ss.getSheetByName(KASSEN_ARTIKEL_STATUS_SHEET);
  if (!statusSheet || statusSheet.getLastRow() < 2) return [];

  const kassen = kassenLadenAlsAdmin();
  const kassenMap = {};
  kassen.forEach(k => { kassenMap[String(k.id)] = k; });

  const artikel = verkaufArtikelLaden();
  const artikelMap = {};
  artikel.forEach(a => { artikelMap[String(a.id)] = a; });

  const rows = statusSheet.getRange(2, 1, statusSheet.getLastRow() - 1, 7).getValues();
  const result = [];

  rows.forEach(row => {
    const kasseId = String(row[0] || '').trim();
    const artikelId = String(row[1] || '').trim();
    const status = String(row[2] || '').trim().toLowerCase();
    if (!kasseId || !artikelId || (status !== 'fast_alle' && status !== 'alle')) return;

    const kasse = kassenMap[kasseId] || {};
    const a = artikelMap[artikelId] || {};
    result.push({
      kasseId: kasseId,
      kasse: String(kasse.name || ''),
      station: String(kasse.station || row[6] || ''),
      artikelId: artikelId,
      artikel: String(a.name || row[5] || artikelId),
      status: status,
      nachschub: row[3] === true || String(row[3] || '').toLowerCase() === 'true',
      aktualisiert: String(row[4] || '')
    });
  });

  return result.sort((a,b) => {
    const sa = a.status === 'alle' ? 0 : 1;
    const sb = b.status === 'alle' ? 0 : 1;
    if (sa !== sb) return sa - sb;
    return String(a.artikel).localeCompare(String(b.artikel), 'de');
  });
}


// =====================================================
// KASSEN-ARTIKELREIHENFOLGE
// =====================================================

function parseArtikelReihenfolge_(value) {
  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean);
  }

  const text = String(value || '').trim();
  if (!text) return [];

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed.map(String).filter(Boolean);
    }
  } catch (e) {}

  return text
    .split(',')
    .map(x => String(x || '').trim())
    .filter(Boolean);
}


function kassenArtikelReihenfolgeSpeichern(password, kasseId, reihenfolge) {

  const role = getRole(password);

  if (role !== 'admin') {
    throw new Error('Keine Berechtigung.');
  }

  const id = String(kasseId || '').trim();
  if (!id) throw new Error('Kassen-ID fehlt.');

  const order = Array.isArray(reihenfolge)
    ? reihenfolge.map(String).map(x => x.trim()).filter(Boolean)
    : [];

  kassenTabellenAnlegen();

  const ss = dbGetSpreadsheet();
  const sheet = ss.getSheetByName(KASSEN_SHEET);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    throw new Error('Kasse wurde nicht gefunden.');
  }

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();

  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0] || '').trim() === id) {
      sheet.getRange(i + 2, 7).setValue(JSON.stringify(order));
      SpreadsheetApp.flush();

      return {
        ok: true,
        kasseId: id,
        artikelreihenfolge: order
      };
    }
  }

  throw new Error('Kasse wurde nicht gefunden.');
}


// =====================================================
// KASSEN-STARTDATEN
// =====================================================

function kassenDatenLaden(
  password,
  kasseId
) {

  const role =
    getRole(password);


  if (
    role !== 'admin' &&
    role !== 'kasse'
  ) {

    throw new Error(
      'Keine Berechtigung.'
    );

  }


  const kasse =
    kasseFinden(
      kasseId
    );


  if (!kasse) {

    throw new Error(
      'Kasse wurde nicht gefunden.'
    );

  }


  return {

    ok: true,

    kasse: kasse,

    artikel:
      kassenArtikelLaden(
        password,
        kasseId
      ),

    artikelreihenfolge:
      parseArtikelReihenfolge_(kasse.artikelreihenfolge)

  };

}


// =====================================================
// VERKAUF SPEICHERN
// =====================================================
//
// Jeder Artikel des Bons wird als eigener Datensatz
// gespeichert.
//
// LockService verhindert, dass zwei Kassen bei
// gleichzeitigem Speichern dieselben Daten überschreiben.
//
// =====================================================

function kassenVerkaufSpeichern(
  password,
  data
) {

  const role = getRole(password);

  if (role !== 'admin' && role !== 'kasse') {
    throw new Error('Keine Berechtigung.');
  }

  data = data || {};

  const kasseId = String(data.kasseId || '').trim();
  const warenkorb = Array.isArray(data.items) ? data.items : [];
  const angeforderteVerkaufId = String(data.saleId || '').trim();

  if (!kasseId) throw new Error('Kasse fehlt.');
  if (!warenkorb.length) throw new Error('Der Warenkorb ist leer.');
  if (angeforderteVerkaufId.length > 120) {
    throw new Error('Ungültige Verkauf-ID.');
  }

  const kasse = kasseFinden(kasseId);
  if (!kasse) throw new Error('Kasse wurde nicht gefunden.');
  if (!kasse.active) throw new Error('Diese Kasse ist deaktiviert.');

  const artikel = kassenArtikelLaden(password, kasseId);
  const artikelMap = {};

  artikel.forEach(item => {
    artikelMap[String(item.id)] = item;
  });

  // =========================================================
  // KASSEN-LOGIN: KEINE VERKAUFSDATEN SPEICHERN
  // =========================================================
  // Das Login "KasseWache48" darf den Kassenrechner bedienen.
  // Verkäufe werden für diese Rolle weder in "Kassenverkäufe"
  // noch anderweitig serverseitig protokolliert.
  //
  // Die Prüfung des Warenkorbs/Preises erfolgt weiterhin,
  // damit die Kasse auch mit diesem Login korrekt arbeitet.
  if (role === 'kasse') {
    let total = 0;

    warenkorb.forEach(position => {
      const artikelId = String(position.articleId || '').trim();
      const item = artikelMap[artikelId];

      if (!item) {
        throw new Error(
          'Artikel "' + artikelId + '" ist für diese Kasse nicht verfügbar.'
        );
      }

      const menge = Number(position.quantity);
      if (!Number.isFinite(menge) || menge <= 0) {
        throw new Error('Ungültige Artikelmenge.');
      }

      const preis = Number(item.price || 0);
      const pfand = Number(item.deposit || 0);

      total += (preis + pfand) * menge;
    });

    return {
      ok: true,
      gespeichert: false,
      protokolliert: false,
      kassenmodus: true,
      total: total
    };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {

    kassenTabellenAnlegen();

    const ss = dbGetSpreadsheet();
    const sheet = ss.getSheetByName(KASSEN_VERKAEUFE_SHEET);

    // Wichtig für Offline-Synchronisierung:
    // Eine bereits gespeicherte saleId darf nie ein zweites Mal
    // als Umsatz verbucht werden.
    if (angeforderteVerkaufId && sheet.getLastRow() >= 2) {

      const lastRow = sheet.getLastRow();
      const ids = sheet
        .getRange(2, 1, lastRow - 1, 1)
        .getValues()
        .flat()
        .map(v => String(v || '').trim());

      if (ids.includes(angeforderteVerkaufId)) {

        const rows = sheet
          .getRange(2, 1, lastRow - 1, 13)
          .getValues();

        let vorhandenerGesamt = 0;

        rows.forEach(row => {
          if (String(row[0] || '').trim() === angeforderteVerkaufId) {
            vorhandenerGesamt += Number(row[10] || 0);
          }
        });

        return {
          ok: true,
          alreadyExists: true,
          verkaufId: angeforderteVerkaufId,
          total: vorhandenerGesamt
        };
      }
    }

    const verkaufId =
      angeforderteVerkaufId || Utilities.getUuid();

    const zeit =
      Utilities.formatDate(
        new Date(),
        Session.getScriptTimeZone(),
        'dd.MM.yyyy HH:mm:ss'
      );

    const username =
      Session.getActiveUser().getEmail() || 'Kasse';

    const veranstaltung =
      String(data.event || '').trim();

    const rows = [];

    warenkorb.forEach(position => {

      const artikelId =
        String(position.articleId || '').trim();

      const item = artikelMap[artikelId];

      if (!item) {
        throw new Error(
          'Artikel "' +
          artikelId +
          '" ist für diese Kasse nicht verfügbar.'
        );
      }

      const menge = Number(position.quantity);

      if (!Number.isFinite(menge) || menge <= 0) {
        throw new Error('Ungültige Artikelmenge.');
      }

      const preis = Number(item.price || 0);
      const pfand = Number(item.deposit || 0);
      const gesamt = (preis + pfand) * menge;

      rows.push([
        verkaufId,
        zeit,
        kasse.id,
        kasse.name,
        kasse.station,
        item.id,
        item.name,
        menge,
        preis,
        pfand,
        gesamt,
        username,
        veranstaltung
      ]);
    });

    if (rows.length) {
      sheet
        .getRange(
          sheet.getLastRow() + 1,
          1,
          rows.length,
          13
        )
        .setValues(rows);
    }

    SpreadsheetApp.flush();

    const gesamt =
      rows.reduce(
        (sum, row) => sum + Number(row[10] || 0),
        0
      );

    return {
      ok: true,
      verkaufId: verkaufId,
      total: gesamt,
      items: rows.length,
      zeit: zeit
    };

  } finally {
    lock.releaseLock();
  }
}

// =====================================================
// VERKAUF STORNIEREN
// =====================================================
//
// Verkäufe werden NICHT gelöscht.
// Stattdessen wird später ein Stornodatensatz
// ergänzt.
//
// Die eigentliche Stornofunktion wird in der
// nächsten Ausbaustufe ergänzt.
// =====================================================


// =====================================================
// KASSENSTATUS
// =====================================================

function kassenStatus(
  password
) {

  const role =
    getRole(password);


  if (
    role !== 'admin' &&
    role !== 'kasse'
  ) {

    throw new Error(
      'Keine Berechtigung.'
    );

  }


  const kassen =
    kassenLaden(
      password
    );


  return {

    ok: true,

    count:
      kassen.length,

    active:
      kassen.filter(
        kasse =>
          kasse.active
      ).length,

    kassen:
      kassen

  };

}

// =====================================================
// KASSEN-DIAGNOSE
// =====================================================
//
// Prüft unabhängig von der normalen Kassenanzeige,
// ob das Tabellenblatt "Kassen" vorhanden ist,
// wie viele Datensätze darin stehen und was tatsächlich
// aus dem Tabellenblatt gelesen wird.
//
// Nur für Administratoren.
// =====================================================





// =====================================================
// KASSEN-DIAGNOSE
// =====================================================
// Nur für Administratoren.
// Wichtig: Es werden ausschließlich Strings, Zahlen,
// Booleans und Arrays/Objekte ohne Date-Objekte zurückgegeben,
// damit google.script.run die Antwort sicher übertragen kann.
// =====================================================
function kassenDiagnose(password) {

  const role = getRole(password);

  if (role !== 'admin') {
    throw new Error(
      'Kassen-Diagnose: Nur der Admin darf diese Funktion ausführen.'
    );
  }

  const ss = dbGetSpreadsheet();

  if (!ss) {
    throw new Error(
      'Das Spreadsheet konnte nicht ermittelt werden.'
    );
  }

  const sheet = ss.getSheetByName(KASSEN_SHEET);

  if (!sheet) {
    return {
      ok: false,
      fehler: 'Das Tabellenblatt "Kassen" wurde nicht gefunden.',
      spreadsheet: String(ss.getName() || ''),
      sheet: '',
      lastRow: 0,
      lastColumn: 0,
      kassenCount: 0,
      activeCount: 0,
      kassen: []
    };
  }

  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  const kassen = [];

  if (lastRow >= 2) {
    const rows = sheet
      .getRange(2, 1, lastRow - 1, 6)
      .getDisplayValues();

    rows.forEach(function(row) {
      const id = String(row[0] || '').trim();
      const name = String(row[1] || '').trim();

      if (!id || !name) return;

      const aktiv = String(row[4] || '')
        .trim()
        .toLowerCase();

      kassen.push({
        id: id,
        name: name,
        station: String(row[2] || '').trim(),
        description: String(row[3] || '').trim(),
        active: aktiv !== 'false' && aktiv !== 'nein' && aktiv !== '0',
        created: String(row[5] || '').trim()
      });
    });
  }

  return {
    ok: true,
    fehler: null,
    spreadsheet: String(ss.getName() || ''),
    sheet: String(sheet.getName() || ''),
    lastRow: Number(lastRow),
    lastColumn: Number(lastColumn),
    rawRowCount: Math.max(0, lastRow - 1),
    kassenCount: kassen.length,
    activeCount: kassen.filter(function(kasse) {
      return kasse.active;
    }).length,
    kassen: kassen
  };
}


// =====================================================
// DASHBOARD – KASSENUMSÄTZE
// =====================================================
// Liefert den bisher gespeicherten Umsatz je Kasse.
// "Kassenstand" wird hier als Umsatz aus
// Kassenverkäufen dargestellt, da die Tabelle keine
// manuelle Zählung des Bargeldbestands enthält.
// =====================================================

function kassenUmsaetzeDashboard(password) {

  const role = getRole(password);

  if (role !== 'admin' && role !== 'kasse' && role !== 'viewer') {
    throw new Error('Keine Berechtigung.');
  }

  kassenTabellenAnlegen();

  const ss = dbGetSpreadsheet();
  const kassenSheet = ss.getSheetByName(KASSEN_SHEET);
  const verkaufSheet = ss.getSheetByName(KASSEN_VERKAEUFE_SHEET);

  const result = {};

  if (kassenSheet && kassenSheet.getLastRow() >= 2) {
    const rows = kassenSheet.getRange(2, 1, kassenSheet.getLastRow()-1, 6).getValues();
    rows.forEach(r => {
      const id = String(r[0] || '').trim();
      if (!id) return;
      result[id] = {
        id: id,
        name: String(r[1] || id).trim(),
        umsatz: 0
      };
    });
  }

  if (verkaufSheet && verkaufSheet.getLastRow() >= 2) {
    const rows = verkaufSheet.getRange(2, 1, verkaufSheet.getLastRow()-1, 13).getValues();
    rows.forEach(r => {
      const kassenId = String(r[2] || '').trim();
      if (!kassenId) return;
      if (!result[kassenId]) {
        result[kassenId] = {
          id: kassenId,
          name: String(r[3] || kassenId).trim(),
          umsatz: 0
        };
      }
      const gesamt = Number(r[10] || 0);
      if (Number.isFinite(gesamt)) result[kassenId].umsatz += gesamt;
    });
  }

  return Object.values(result).sort((a,b) =>
    String(a.name).localeCompare(String(b.name), 'de')
  );
}
