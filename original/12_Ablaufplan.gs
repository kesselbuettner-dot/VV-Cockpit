// =====================================================
// FF HOLZHAUSEN – MODUL 12
// 12_Ablaufplan.gs
// =====================================================
// Veranstaltungsdaten + mehrere Veranstaltungstage
// + Programmpunkte + Stationszeiten.
//
// Dieses Modul ist die zentrale Datenquelle für:
// - Ablaufplan
// - Dienstplan
// - Wunschplan
//
// Daten werden im Sheet "Einstellungen" und im Sheet
// "Ablaufplan" gespeichert.
//
// Ablaufplan-Sheet:
// A = Typ
// B = Tag
// C = Datum
// D = Von
// E = Bis
// F = Titel / Station
// G = Beschreibung
// H = Farbe
//
// Typen:
// PROGRAMM
// STATION
//
// Veranstaltungstage werden zusätzlich als JSON in
// "Einstellungen" unter "Veranstaltungstage" gespeichert.
// =====================================================


// =====================================================
// SHEET ANLEGEN / STRUKTUR
// =====================================================

function ablaufplanSheet_() {

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Ablaufplan');

  if (!sheet) {
    sheet = ss.insertSheet('Ablaufplan');
  }

  // Neue Kopfzeile nur setzen, wenn das Blatt leer ist.
  if (sheet.getLastRow() === 0) {

    sheet.getRange(1, 1, 1, 8).setValues([[
      'Typ',
      'Tag',
      'Datum',
      'Von',
      'Bis',
      'Titel / Station',
      'Beschreibung',
      'Farbe'
    ]]);

  } else {

    // Alte Struktur erkennen und gegebenenfalls erweitern.
    var headers = sheet.getRange(
      1,
      1,
      1,
      Math.max(8, sheet.getLastColumn())
    ).getValues()[0];

    var first = String(headers[0] || '').trim();

    // Altes Modul hatte:
    // Typ | Zeit/Von | Bis | Titel/Station | Beschreibung
    if (first === 'Typ') {

      var oldSecond = String(headers[1] || '').trim();

      if (
        oldSecond === 'Zeit/Von' ||
        oldSecond === 'Zeit' ||
        oldSecond === ''
      ) {

        // Wir verändern alte Daten nicht automatisch,
        // sondern sorgen nur dafür, dass die neuen
        // Spalten vorhanden sind.
        if (sheet.getLastColumn() < 8) {
          sheet.insertColumnsAfter(
            sheet.getLastColumn(),
            8 - sheet.getLastColumn()
          );
        }

        sheet.getRange(1, 1, 1, 8).setValues([[
          'Typ',
          'Tag',
          'Datum',
          'Von',
          'Bis',
          'Titel / Station',
          'Beschreibung',
          'Farbe'
        ]]);
      }
    }
  }

  return sheet;
}


// =====================================================
// HAUPTFUNKTION – LADEN
// =====================================================

function ablaufplanLaden(password) {

  if (!getRole(password)) {
    throw new Error('Nicht angemeldet.');
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var settings = ss.getSheetByName('Einstellungen');

  var meta = {
    veranstaltung: '',
    ort: '',
    von: '',
    bis: ''
  };

  // ---------------------------------------------------
  // VERANSTALTUNGSDATEN LADEN
  // ---------------------------------------------------

  if (settings && settings.getLastRow() >= 1) {

    var settingsValues = settings.getRange(
      1,
      1,
      settings.getLastRow(),
      2
    ).getValues();

    settingsValues.forEach(function(row) {

      var key = String(row[0] || '').trim();
      var value = row[1];

      if (key === 'Veranstaltungsname') {
        meta.veranstaltung = String(value || '');
      }

      if (key === 'Veranstaltungsort') {
        meta.ort = String(value || '');
      }

      if (
        key === 'Veranstaltung von' ||
        key === 'Veranstaltungsbeginn'
      ) {
        meta.von = ablaufDatumFmt_(value);
      }

      if (
        key === 'Veranstaltung bis' ||
        key === 'Veranstaltungsende'
      ) {
        meta.bis = ablaufDatumFmt_(value);
      }

      // Altes System:
      // Veranstaltungsdatum
      if (key === 'Veranstaltungsdatum') {

        var datumAlt = ablaufDatumFmt_(value);

        if (!meta.von) {
          meta.von = datumAlt;
        }

        if (!meta.bis) {
          meta.bis = datumAlt;
        }
      }
    });
  }


  // ---------------------------------------------------
  // VERANSTALTUNGSTAGE
  // ---------------------------------------------------

  var tage = ablaufTageLaden_(settings);

  // Falls noch keine Tage existieren:
  // aus Von/Bis automatisch Tage erzeugen.
  if (!tage.length) {

    tage = ablaufTageAusZeitraum_(
      meta.von,
      meta.bis
    );
  }

  // Falls weiterhin kein Tag vorhanden ist,
  // aber altes Veranstaltungsdatum existiert:
  if (!tage.length && meta.von) {

    tage = [{
      index: 1,
      datum: meta.von,
      beginn: '12:00',
      ende: '18:00'
    }];
  }


  // ---------------------------------------------------
  // ABLAUFPLAN-SHEET
  // ---------------------------------------------------

  var sheet = ablaufplanSheet_();

  var programmpunkte = [];
  var stationen = [];

  if (sheet.getLastRow() >= 2) {

    var lastCol = Math.max(
      8,
      sheet.getLastColumn()
    );

    var rows = sheet.getRange(
      2,
      1,
      sheet.getLastRow() - 1,
      lastCol
    ).getValues();

    rows.forEach(function(row) {

      var typ = String(row[0] || '')
        .trim()
        .toUpperCase();

      if (!typ) {
        return;
      }


      // -----------------------------------------------
      // PROGRAMMPUNKT
      // -----------------------------------------------

      if (typ === 'PROGRAMM') {

        var tag = ablaufTagErmitteln_(
          row[1],
          row[2],
          tage
        );

        var datum = ablaufDatumFmt_(row[2]);

        var von = ablaufFmtZeit_(
          row[3]
        );

        var bis = ablaufFmtZeit_(
          row[4]
        );

        // Kompatibilität mit alter Struktur:
        // Wenn D leer ist, kann B die alte Uhrzeit
        // gewesen sein.
        if (!von && !bis) {

          var alteZeit = ablaufFmtZeit_(
            row[1]
          );

          if (alteZeit) {
            von = alteZeit;
          }
        }

        var titel = String(
          row[5] || ''
        ).trim();

        var beschreibung = String(
          row[6] || ''
        );

        if (titel) {

          programmpunkte.push({
            id: 'programm_' + (
              programmpunkte.length + 1
            ),

            tag: tag,

            tagIndex: ablaufTagIndex_(
              tag,
              tage
            ),

            datum: datum,

            von: von,

            bis: bis,

            zeit: von,

            text: titel,

            titel: titel,

            beschreibung: beschreibung
          });
        }
      }


      // -----------------------------------------------
      // STATION
      // -----------------------------------------------

      if (typ === 'STATION') {

        var stationTag = ablaufTagErmitteln_(
          row[1],
          row[2],
          tage
        );

        var stationDatum = ablaufDatumFmt_(
          row[2]
        );

        var stationVon = ablaufFmtZeit_(
          row[3]
        );

        var stationBis = ablaufFmtZeit_(
          row[4]
        );

        var stationName = String(
          row[5] || ''
        ).trim();

        var stationFarbe = String(
          row[7] || '#64748b'
        ).trim();

        if (
          stationName &&
          stationVon &&
          stationBis
        ) {

          stationen.push({

            id: 'station_' + (
              stationen.length + 1
            ),

            station: stationName,

            tag: stationTag,

            tagIndex: ablaufTagIndex_(
              stationTag,
              tage
            ),

            datum: stationDatum,

            von: stationVon,

            bis: stationBis,

            farbe: stationFarbe
          });
        }
      }
    });
  }


  // ---------------------------------------------------
  // FALLBACK: STATIONEN AUS SHEET "STATIONEN"
  // ---------------------------------------------------

  if (!stationen.length) {

    stationen = ablaufStationenLaden_(
      tage
    );
  }


  // ---------------------------------------------------
  // META VON/BIS FALLS NICHT VORHANDEN
  // ---------------------------------------------------

  if (!meta.von && tage.length) {
    meta.von = tage[0].datum;
  }

  if (!meta.bis && tage.length) {
    meta.bis = tage[tage.length - 1].datum;
  }


  return {
    ok: true,

    meta: meta,

    tage: tage,

    // verschiedene Namen zur Kompatibilität
    veranstaltungstage: tage,

    programmpunkte: programmpunkte,

    stationen: stationen
  };
}


// =====================================================
// HAUPTFUNKTION – SPEICHERN
// =====================================================

function ablaufplanSpeichern(password, data) {

  if (getRole(password) !== 'admin') {
    throw new Error(
      'Nur der Admin darf den Ablaufplan speichern.'
    );
  }

  if (
    !data ||
    typeof data !== 'object'
  ) {
    throw new Error(
      'Ungültiger Ablaufplan.'
    );
  }


  // ---------------------------------------------------
  // DATEN
  // ---------------------------------------------------

  var meta = data.meta || {};

  var programmpunkte =
    Array.isArray(data.programmpunkte)
      ? data.programmpunkte
      : [];

  var stationen =
    Array.isArray(data.stationen)
      ? data.stationen
      : [];

  var tage = [];

  if (Array.isArray(data.tage)) {

    tage = data.tage;

  } else if (
    Array.isArray(data.veranstaltungstage)
  ) {

    tage = data.veranstaltungstage;
  }


  // ---------------------------------------------------
  // TAGE NORMALISIEREN
  // ---------------------------------------------------

  tage = ablaufTageNormalisieren_(
    tage,
    meta
  );


  // ---------------------------------------------------
  // FALLBACK WENN HTML NOCH KEINE TAGE SENDEN SOLLTE
  // ---------------------------------------------------

  if (!tage.length) {

    tage = ablaufTageAusZeitraum_(
      meta.von,
      meta.bis
    );
  }


  // ---------------------------------------------------
  // EINSTELLUNGEN
  // ---------------------------------------------------

  var ss =
    SpreadsheetApp.getActiveSpreadsheet();

  var settings =
    ss.getSheetByName('Einstellungen');

  if (!settings) {

    settings =
      ss.insertSheet('Einstellungen');

    settings
      .getRange(1, 1, 1, 2)
      .setValues([[
        'Einstellung',
        'Wert'
      ]]);
  }


  // Veranstaltung
  ablaufSettingSetzen_(
    settings,
    'Veranstaltungsname',
    String(
      meta.veranstaltung || ''
    )
  );


  // Ort
  ablaufSettingSetzen_(
    settings,
    'Veranstaltungsort',
    String(
      meta.ort || ''
    )
  );


  // Veranstaltung von
  var veranstaltungVon =
    ablaufDatumFmt_(
      meta.von
    );

  if (
    !veranstaltungVon &&
    tage.length
  ) {
    veranstaltungVon =
      tage[0].datum;
  }

  ablaufSettingSetzen_(
    settings,
    'Veranstaltung von',
    veranstaltungVon
  );


  // Veranstaltung bis
  var veranstaltungBis =
    ablaufDatumFmt_(
      meta.bis
    );

  if (
    !veranstaltungBis &&
    tage.length
  ) {
    veranstaltungBis =
      tage[tage.length - 1].datum;
  }

  ablaufSettingSetzen_(
    settings,
    'Veranstaltung bis',
    veranstaltungBis
  );


  // ---------------------------------------------------
  // ALTE SCHLÜSSEL WEITERPFLEGEN
  // ---------------------------------------------------

  // Andere Module können diesen Wert noch benötigen.
  ablaufSettingSetzen_(
    settings,
    'Veranstaltungsdatum',
    veranstaltungVon
  );


  // ---------------------------------------------------
  // TAGE ALS JSON SPEICHERN
  // ---------------------------------------------------

  ablaufSettingSetzen_(
    settings,
    'Veranstaltungstage',
    JSON.stringify(tage)
  );


  // ---------------------------------------------------
  // ABLAUFPLAN SHEET
  // ---------------------------------------------------

  var sheet =
    ablaufplanSheet_();


  // Alte Einträge entfernen.
  if (sheet.getLastRow() >= 2) {

    sheet
      .getRange(
        2,
        1,
        sheet.getLastRow() - 1,
        8
      )
      .clearContent();
  }


  var rows = [];


  // ---------------------------------------------------
  // PROGRAMMPUNKTE SPEICHERN
  // ---------------------------------------------------

  programmpunkte.forEach(
    function(p) {

      var normalized =
        ablaufProgrammNormalisieren_(
          p,
          tage
        );

      if (
        !normalized.titel ||
        !normalized.von
      ) {
        return;
      }

      rows.push([

        'PROGRAMM',

        normalized.tag,

        normalized.datum,

        normalized.von,

        normalized.bis,

        normalized.titel,

        normalized.beschreibung,

        ''
      ]);
    }
  );


  // ---------------------------------------------------
  // STATIONEN IN ABLAUFPLAN SPEICHERN
  // ---------------------------------------------------

  stationen.forEach(
    function(s) {

      var normalized =
        ablaufStationNormalisieren_(
          s,
          tage
        );

      if (
        !normalized.station ||
        !normalized.von ||
        !normalized.bis
      ) {
        return;
      }

      rows.push([

        'STATION',

        normalized.tag,

        normalized.datum,

        normalized.von,

        normalized.bis,

        normalized.station,

        '',

        normalized.farbe
      ]);
    }
  );


  // ---------------------------------------------------
  // ZEILEN SCHREIBEN
  // ---------------------------------------------------

  if (rows.length) {

    sheet
      .getRange(
        2,
        1,
        rows.length,
        8
      )
      .setValues(rows);
  }


  // ---------------------------------------------------
  // STATIONEN-SHEET AKTUALISIEREN
  // ---------------------------------------------------

  stationen.forEach(
    function(s) {

      var normalized =
        ablaufStationNormalisieren_(
          s,
          tage
        );

      if (
        !normalized.station ||
        !normalized.von ||
        !normalized.bis
      ) {
        return;
      }

      ablaufStationZeitSetzen_(
        normalized.station,
        normalized.von,
        normalized.bis,
        normalized.tag,
        normalized.datum,
        normalized.farbe
      );
    }
  );


  // ---------------------------------------------------
  // ERNEUT LADEN
  // ---------------------------------------------------

  return ablaufplanLaden(
    password
  );
}


// =====================================================
// TAGE LADEN
// =====================================================

function ablaufTageLaden_(settings) {

  if (
    !settings ||
    settings.getLastRow() < 1
  ) {
    return [];
  }

  var values =
    settings.getRange(
      1,
      1,
      settings.getLastRow(),
      2
    ).getValues();

  var json = '';

  values.forEach(
    function(row) {

      var key =
        String(
          row[0] || ''
        ).trim();

      if (
        key === 'Veranstaltungstage'
      ) {
        json =
          String(
            row[1] || ''
          );
      }
    }
  );

  if (!json) {
    return [];
  }

  try {

    var parsed =
      JSON.parse(json);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return ablaufTageNormalisieren_(
      parsed,
      {}
    );

  } catch (e) {

    return [];
  }
}


// =====================================================
// TAGE NORMALISIEREN
// =====================================================

function ablaufTageNormalisieren_(
  tage,
  meta
) {

  if (!Array.isArray(tage)) {
    return [];
  }

  var result = [];

  tage.forEach(
    function(t, index) {

      if (
        !t ||
        typeof t !== 'object'
      ) {
        return;
      }

      var datum =
        ablaufDatumFmt_(
          t.datum ||
          t.date ||
          t.tagDatum
        );

      var beginn =
        ablaufFmtZeit_(
          t.beginn ||
          t.von ||
          t.start
        );

      var ende =
        ablaufFmtZeit_(
          t.ende ||
          t.bis ||
          t.stop
        );

      var tagIndex =
        Number(
          t.index ||
          t.tagIndex ||
          t.nr ||
          (index + 1)
        );

      if (!tagIndex || tagIndex < 1) {
        tagIndex = index + 1;
      }

      if (!datum) {
        return;
      }

      result.push({

        index: tagIndex,

        tag: 'Tag ' + tagIndex,

        datum: datum,

        beginn: beginn,

        ende: ende
      });
    }
  );


  // Nach Tagnummer sortieren.
  result.sort(
    function(a, b) {
      return a.index - b.index;
    }
  );


  // Neu durchnummerieren.
  result.forEach(
    function(t, i) {

      t.index = i + 1;
      t.tag = 'Tag ' + (i + 1);
    }
  );

  return result;
}


// =====================================================
// TAGE AUS DATUMSZEITRAUM ERZEUGEN
// =====================================================

function ablaufTageAusZeitraum_(
  von,
  bis
) {

  von = ablaufDatumFmt_(von);
  bis = ablaufDatumFmt_(bis);

  if (!von) {
    return [];
  }

  if (!bis) {
    bis = von;
  }

  var start =
    ablaufDateFromString_(von);

  var ende =
    ablaufDateFromString_(bis);

  if (!start || !ende) {
    return [];
  }

  var result = [];

  var current =
    new Date(start.getTime());

  var index = 1;

  while (
    current.getTime() <= ende.getTime()
  ) {

    var datum =
      Utilities.formatDate(
        current,
        Session.getScriptTimeZone(),
        'yyyy-MM-dd'
      );

    result.push({

      index: index,

      tag: 'Tag ' + index,

      datum: datum,

      // Standardwerte nur als Fallback.
      // Bestehende HTML-Werte werden nicht überschrieben.
      beginn: '12:00',

      ende: '18:00'
    });

    current.setDate(
      current.getDate() + 1
    );

    index++;
  }

  return result;
}


// =====================================================
// PROGRAMMPUNKT NORMALISIEREN
// =====================================================

function ablaufProgrammNormalisieren_(
  p,
  tage
) {

  p = p || {};

  var titel =
    String(
      p.titel ||
      p.text ||
      p.name ||
      ''
    ).trim();

  var beschreibung =
    String(
      p.beschreibung ||
      p.description ||
      ''
    );

  var von =
    ablaufFmtZeit_(
      p.von ||
      p.start ||
      p.zeit
    );

  var bis =
    ablaufFmtZeit_(
      p.bis ||
      p.ende ||
      p.stop
    );

  // Der Client kann den Tag entweder als "Tag 1" oder als Datum senden.
  // Deshalb zuerst ein echtes Datum aus datum/date UND tag erkennen.
  var rawDatum = p.datum || p.date || '';
  var datum = ablaufDatumFmt_(rawDatum);
  if (!datum) {
    datum = ablaufDatumFmt_(p.tag);
  }

  var tag =
    ablaufTagErmitteln_(
      p.tagIndex ||
      p.tagNr ||
      p.tag,
      datum,
      tage
    );

  if (!datum) {
    datum =
      ablaufDatumFuerTag_(
        tag,
        tage
      );
  }

  return {

    tag: tag,

    datum: datum,

    von: von,

    bis: bis,

    titel: titel,

    beschreibung: beschreibung
  };
}


// =====================================================
// STATION NORMALISIEREN
// =====================================================

function ablaufStationNormalisieren_(
  s,
  tage
) {

  s = s || {};

  var station =
    String(
      s.station ||
      s.name ||
      s.titel ||
      ''
    ).trim();

  var von =
    ablaufFmtZeit_(
      s.von ||
      s.start
    );

  var bis =
    ablaufFmtZeit_(
      s.bis ||
      s.ende
    );

  var rawDatum = s.datum || s.date || '';
  var datum = ablaufDatumFmt_(rawDatum);
  if (!datum) {
    datum = ablaufDatumFmt_(s.tag);
  }

  var tag =
    ablaufTagErmitteln_(
      s.tagIndex ||
      s.tagNr ||
      s.tag,
      datum,
      tage
    );

  if (!datum) {
    datum =
      ablaufDatumFuerTag_(
        tag,
        tage
      );
  }

  var farbe =
    String(
      s.farbe ||
      s.color ||
      '#64748b'
    ).trim();

  return {

    station: station,

    tag: tag,

    datum: datum,

    von: von,

    bis: bis,

    farbe: farbe
  };
}


// =====================================================
// TAG ERMITTELN
// =====================================================

function ablaufTagErmitteln_(
  tagValue,
  datumValue,
  tage
) {

  var datum =
    ablaufDatumFmt_(
      datumValue
    );

  // Datum hat Priorität.
  if (datum) {

    for (
      var i = 0;
      i < tage.length;
      i++
    ) {

      if (
        tage[i].datum === datum
      ) {
        return 'Tag ' + (
          i + 1
        );
      }
    }
  }


  // Tag als Zahl.
  if (
    typeof tagValue === 'number' ||
    /^\d+$/.test(
      String(tagValue || '').trim()
    )
  ) {

    var n =
      Number(tagValue);

    if (
      n >= 1 &&
      n <= tage.length
    ) {

      return 'Tag ' + n;
    }
  }


  // "Tag 1"
  var text =
    String(
      tagValue || ''
    ).trim();

  var match =
    text.match(
      /(?:tag\s*)?(\d+)/i
    );

  if (match) {

    var nr =
      Number(match[1]);

    if (
      nr >= 1 &&
      nr <= tage.length
    ) {

      return 'Tag ' + nr;
    }
  }


  // Kein Tag angegeben:
  // ersten Tag verwenden.
  if (tage.length) {
    return 'Tag 1';
  }

  return '';
}


// =====================================================
// TAG INDEX
// =====================================================

function ablaufTagIndex_(
  tag,
  tage
) {

  var text =
    String(
      tag || ''
    );

  var match =
    text.match(
      /(\d+)/
    );

  if (match) {
    return Number(match[1]);
  }

  return 1;
}


// =====================================================
// DATUM EINES TAGES
// =====================================================

function ablaufDatumFuerTag_(
  tag,
  tage
) {

  var index =
    ablaufTagIndex_(
      tag,
      tage
    );

  if (
    index >= 1 &&
    index <= tage.length
  ) {

    return tage[
      index - 1
    ].datum;
  }

  return '';
}


// =====================================================
// DATUM FORMATIEREN
// =====================================================

function ablaufDatumFmt_(
  value
) {

  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return '';
  }


  if (
    Object.prototype.toString.call(
      value
    ) === '[object Date]'
  ) {

    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone(),
      'yyyy-MM-dd'
    );
  }


  var text =
    String(
      value
    ).trim();


  // yyyy-MM-dd
  var iso =
    text.match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/
    );

  if (iso) {

    return iso[1] + '-' +
      ('0' + iso[2]).slice(-2) + '-' +
      ('0' + iso[3]).slice(-2);
  }


  // dd.MM.yyyy
  var de =
    text.match(
      /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/
    );

  if (de) {

    return de[3] + '-' +
      ('0' + de[2]).slice(-2) + '-' +
      ('0' + de[1]).slice(-2);
  }


  return '';
}


// =====================================================
// ZEIT FORMATIEREN
// =====================================================

function ablaufFmtZeit_(
  value
) {

  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return '';
  }


  if (
    Object.prototype.toString.call(
      value
    ) === '[object Date]'
  ) {

    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone(),
      'HH:mm'
    );
  }


  var text =
    String(
      value
    ).trim();


  var match =
    text.match(
      /(\d{1,2}):(\d{2})/
    );

  if (!match) {
    return '';
  }


  var h =
    Number(match[1]);

  var min =
    Number(match[2]);


  if (
    h < 0 ||
    h > 23 ||
    min < 0 ||
    min > 59
  ) {
    return '';
  }


  return (
    ('0' + h).slice(-2) +
    ':' +
    ('0' + min).slice(-2)
  );
}


// =====================================================
// DATUM → DATE
// =====================================================

function ablaufDateFromString_(
  datum
) {

  var m =
    String(
      datum || ''
    ).match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

  if (!m) {
    return null;
  }

  return new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3])
  );
}


// =====================================================
// STATIONEN AUS SHEET LADEN
// =====================================================

function ablaufStationenLaden_(tage) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Stationen');
  if (!sheet || sheet.getLastRow() < 2) return [];

  var lastCol = Math.max(7, sheet.getLastColumn());
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var stationCol = -1, farbeCol = -1, tageCol = -1;
  var vonCol = -1, bisCol = -1, tagCol = -1, datumCol = -1;

  headers.forEach(function(h, i) {
    var x = String(h || '').trim().toLowerCase();
    if (x === 'station') stationCol = i;
    if (x === 'farbe' || x === 'color') farbeCol = i;
    if (x === 'tageszeiten' || x === 'tageszeiten json' || x === 'zeiten') tageCol = i;
    if (x === 'von' || x === 'beginn' || x === 'start') vonCol = i;
    if (x === 'bis' || x === 'ende') bisCol = i;
    if (x === 'tag' || x === 'tag nr' || x === 'tagnummer') tagCol = i;
    if (x === 'datum' || x === 'date') datumCol = i;
  });
  if (stationCol < 0) return [];

  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, lastCol).getValues();
  var result = [];

  rows.forEach(function(row) {
    var station = String(row[stationCol] || '').trim();
    if (!station) return;
    var farbe = farbeCol >= 0 ? String(row[farbeCol] || '#64748b').trim() : '#64748b';

    // Neue Struktur: eine Station pro Zeile, Tageszeiten als JSON in einer Spalte.
    if (tageCol >= 0 && row[tageCol]) {
      var tageData = [];
      try { tageData = JSON.parse(String(row[tageCol])); } catch (e) { tageData = []; }
      if (Array.isArray(tageData)) {
        tageData.forEach(function(t) {
          var von = ablaufFmtZeit_(t && t.von);
          var bis = ablaufFmtZeit_(t && t.bis);
          if (!von || !bis || ablaufMinuten_(von) >= ablaufMinuten_(bis)) return;
          var datum = ablaufDatumFmt_(t && (t.datum || t.date));
          var tag = ablaufTagErmitteln_(t && (t.tag || t.tagIndex || t.tagNr), datum, tage);
          if (!datum) datum = ablaufDatumFuerTag_(tag, tage);
          result.push({
            id: 'station_' + (result.length + 1),
            station: station,
            tag: tag,
            tagIndex: ablaufTagIndex_(tag, tage),
            datum: datum,
            von: von,
            bis: bis,
            farbe: farbe
          });
        });
      }
      return;
    }

    // Rückwärtskompatibilität: alte Stationen-Struktur mit Von/Bis.
    if (vonCol >= 0 && bisCol >= 0) {
      var oldVon = ablaufFmtZeit_(row[vonCol]);
      var oldBis = ablaufFmtZeit_(row[bisCol]);
      if (!oldVon || !oldBis) return;
      var datum = datumCol >= 0 ? ablaufDatumFmt_(row[datumCol]) : '';
      var tag = tagCol >= 0 ? ablaufTagErmitteln_(row[tagCol], datum, tage) : 'Tag 1';
      if (!datum) datum = ablaufDatumFuerTag_(tag, tage);
      result.push({
        id: 'station_' + (result.length + 1), station: station,
        tag: tag, tagIndex: ablaufTagIndex_(tag, tage), datum: datum,
        von: oldVon, bis: oldBis, farbe: farbe
      });
    }
  });
  return result;
}


// =====================================================
// STATION ZEIT SETZEN
// =====================================================

function ablaufStationZeitSetzen_(station, von, bis, tag, datum, farbe) {
  if (!station || !von || !bis) return;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Stationen');
  if (!sheet || sheet.getLastRow() < 2) return;

  var lastCol = Math.max(7, sheet.getLastColumn());
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var stationCol = -1, farbeCol = -1, tageCol = -1;
  headers.forEach(function(h, i) {
    var x = String(h || '').trim().toLowerCase();
    if (x === 'station') stationCol = i;
    if (x === 'farbe' || x === 'color') farbeCol = i;
    if (x === 'tageszeiten' || x === 'tageszeiten json' || x === 'zeiten') tageCol = i;
  });
  if (stationCol < 0) return;
  if (tageCol < 0) {
    // Neue Spalte bei Bedarf anlegen; Von/Bis werden nicht mehr benötigt.
    tageCol = lastCol;
    sheet.getRange(1, tageCol + 1).setValue('Tageszeiten');
  }

  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, Math.max(tageCol + 1, lastCol)).getValues();
  var wantedDatum = ablaufDatumFmt_(datum);
  var wantedTag = String(tag || '').trim();

  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][stationCol] || '').trim() !== String(station).trim()) continue;

    var arr = [];
    try { arr = JSON.parse(String(rows[i][tageCol] || '')); } catch (e) { arr = []; }
    if (!Array.isArray(arr)) arr = [];

    var found = false;
    arr = arr.map(function(t) {
      var td = ablaufDatumFmt_(t && (t.datum || t.date));
      var tt = String(t && (t.tag || t.tagIndex || t.tagNr) || '').trim();
      var match = (wantedDatum && td === wantedDatum) || (!wantedDatum && wantedTag && tt === wantedTag);
      if (!match && wantedTag && tt && ('Tag ' + tt) === wantedTag) match = true;
      if (match) {
        found = true;
        return { tag: wantedTag || t.tag || '', datum: wantedDatum || td || '', von: von, bis: bis };
      }
      return t;
    });
    if (!found) arr.push({ tag: wantedTag, datum: wantedDatum, von: von, bis: bis });

    sheet.getRange(i + 2, tageCol + 1).setValue(JSON.stringify(arr));
    if (farbeCol >= 0 && farbe) sheet.getRange(i + 2, farbeCol + 1).setValue(farbe);
    return;
  }
}


// =====================================================
// EINSTELLUNG SETZEN
// =====================================================

function ablaufSettingSetzen_(
  sheet,
  key,
  value
) {

  var last =
    sheet.getLastRow();


  if (last >= 1) {

    var values =
      sheet
        .getRange(
          1,
          1,
          last,
          1
        )
        .getValues();


    for (
      var i = 0;
      i < values.length;
      i++
    ) {

      if (
        String(
          values[i][0] || ''
        ).trim() === key
      ) {

        sheet
          .getRange(
            i + 1,
            2
          )
          .setValue(value);

        return;
      }
    }
  }


  sheet.appendRow([
    key,
    value
  ]);
}


// =====================================================
// MINUTEN
// =====================================================

function ablaufMinuten_(
  zeit
) {

  var match =
    String(
      zeit || ''
    ).match(
      /^(\d{1,2}):(\d{2})$/
    );

  if (!match) {
    return -1;
  }

  return (
    Number(match[1]) * 60 +
    Number(match[2])
  );
}


// =====================================================
// DEBUG / TEST
// =====================================================

function ablaufplanTest_() {

  var ss =
    SpreadsheetApp.getActiveSpreadsheet();

  var settings =
    ss.getSheetByName(
      'Einstellungen'
    );

  var result = {
    settings: !!settings,
    ablaufplan:
      !!ss.getSheetByName(
        'Ablaufplan'
      ),
    stationen:
      !!ss.getSheetByName(
        'Stationen'
      )
  };

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}