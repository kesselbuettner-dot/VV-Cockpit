// =====================================================
// FF HOLZHAUSEN – MANUELLER DIENSTPLAN
// 06_Dienstplanung.gs
// =====================================================
//
// Der Dienstplan wird NICHT automatisch berechnet.
//
// Quelle:
//    Tabellenblatt "Dienstplan"
//
// Ablauf:
//
//    Dienstplan laden
//        ↓
//    Raster bearbeiten
//        ↓
//    Station auswählen
//        ↓
//    Speichern
//        ↓
//    Tabellenblatt "Dienstplan"
//
// Der Wunschplan bleibt vollständig getrennt.
// =====================================================


// =====================================================
// DIENSTPLAN LADEN
// =====================================================

function dienstplanungLaden() {

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


  // Einstellungen laden

  const settings =
    getSettings();


  const start =
    settings.start ||
    CONFIG.DEFAULT_START;


  const end =
    settings.end ||
    CONFIG.DEFAULT_END;


  const step =
    Number(
      settings.step ||
      CONFIG.DEFAULT_STEP
    );


  // ---------------------------------------------------
  // Helfer laden
  // ---------------------------------------------------

  const helperSheet =
    ss.getSheetByName(
      CONFIG.HELFER_SHEET
    );

  if (!helperSheet) {
    throw new Error(
      'Tabellenblatt "Helferliste" fehlt.'
    );
  }


  const helperValues =
    helperSheet
      .getDataRange()
      .getValues();


  const helpers = {};


  for (
    let i = 1;
    i < helperValues.length;
    i++
  ) {

    const row =
      helperValues[i];


    const nr =
      Number(row[0]);


    if (!nr) {
      continue;
    }


    helpers[String(nr)] = {

      nr: nr,

      name:
        (
          String(row[2] || '') +
          ' ' +
          String(row[1] || '')
        ).trim(),

      vorname:
        String(row[2] || '').trim(),

      nachname:
        String(row[1] || '').trim(),

      ankunft:
        typeof fmtTime === 'function'
          ? fmtTime(row[4])
          : String(row[4] || '')

    };

  }


  // ---------------------------------------------------
  // Dienstplan lesen
  // ---------------------------------------------------

  const lastRow =
    sheet.getLastRow();


  const plan = {};


  if (lastRow >= 2) {

    const values =
      sheet
        .getRange(
          2,
          1,
          lastRow - 1,
          13
        )
        .getValues();


    values.forEach(
      row => {

        const nr =
          Number(row[0]);


        if (!nr) {
          return;
        }


        const key =
          String(nr);


        const helper =
          helpers[key] || {};


        if (!plan[key]) {

          plan[key] = {

            nr: nr,

            name:
              helper.name ||
              (
                String(row[2] || '') +
                ' ' +
                String(row[1] || '')
              ).trim(),

            vorname:
              helper.vorname ||
              String(row[2] || '').trim(),

            nachname:
              helper.nachname ||
              String(row[1] || '').trim(),

            arrival:
              helper.ankunft || '',

            raster: {}

          };

        }


        // ------------------------------------------------
        // Drei gespeicherte Schichten wieder in das
        // 30-Minuten-Raster umwandeln.
        // ------------------------------------------------

        for (
          let s = 0;
          s < 3;
          s++
        ) {

          const station =
            String(
              row[3 + s * 3] || ''
            ).trim();


          const von =
            dienstplanungZeit_(
              row[4 + s * 3]
            );


          const bis =
            dienstplanungZeit_(
              row[5 + s * 3]
            );


          if (
            !station ||
            !von ||
            !bis
          ) {
            continue;
          }


          dienstplanungBereichEintragen_(
            plan[key].raster,
            von,
            bis,
            station
          );

        }

      }
    );

  }


  return {

    ok: true,

    start: start,

    end: end,

    step: step,

    plan: plan

  };

}


// =====================================================
// ZEIT FORMATIEREN
// =====================================================

function dienstplanungZeit_(value) {

  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {

    return '';

  }


  if (
    value instanceof Date
  ) {

    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone(),
      'HH:mm'
    );

  }


  const text =
    String(value).trim();


  if (
    /^\d{1,2}:\d{2}$/.test(text)
  ) {

    const parts =
      text.split(':');


    return (
      ('0' + Number(parts[0])).slice(-2) +
      ':' +
      parts[1]
    );

  }


  return '';

}


// =====================================================
// ZEITBEREICH IN RASTER SCHREIBEN
// =====================================================

function dienstplanungBereichEintragen_(
  raster,
  von,
  bis,
  station
) {

  const start =
    timeToMinutes(von);


  const end =
    timeToMinutes(bis);


  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    end <= start
  ) {

    return;

  }


  for (
    let minute = start;
    minute < end;
    minute += 30
  ) {

    raster[
      minutesToTime(minute)
    ] = station;

  }

}


// =====================================================
// MANUELLE ÄNDERUNG PRÜFEN
// =====================================================

function dienstplanungAenderungPruefen(
  nr,
  zeit,
  station
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


  const time =
    String(
      zeit || ''
    ).trim();


  if (
    !/^([01]?\d|2[0-3]):[0-5]\d$/.test(time)
  ) {

    throw new Error(
      'Ungültige Uhrzeit.'
    );

  }


  const minuten =
    timeToMinutes(time);


  if (
    minuten % 30 !== 0
  ) {

    throw new Error(
      'Die Dienstplanung arbeitet nur im 30-Minuten-Raster.'
    );

  }


  const value =
    String(
      station || ''
    ).trim();


  // Leeres Feld = Dienst entfernen

  if (!value) {

    return {

      ok: true,

      nr: nummer,

      zeit:
        minutesToTime(minuten),

      station: ''

    };

  }


  // Station muss existieren

  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();


  const stationSheet =
    ss.getSheetByName(
      CONFIG.STATION_SHEET
    );


  if (!stationSheet) {

    throw new Error(
      'Tabellenblatt "Stationen" fehlt.'
    );

  }


  const lastRow =
    stationSheet.getLastRow();


  let exists = false;


  if (lastRow >= 2) {

    const values =
      stationSheet
        .getRange(
          2,
          1,
          lastRow - 1,
          1
        )
        .getValues();


    exists =
      values.some(
        row =>
          String(row[0] || '')
            .trim() === value
      );

  }


  if (!exists) {

    throw new Error(
      'Unbekannte Station: ' +
      value
    );

  }


  return {

    ok: true,

    nr: nummer,

    zeit:
      minutesToTime(minuten),

    station:
      value

  };

}


// =====================================================
// EINEN DIENST ÄNDERN
// =====================================================

function dienstplanungAendern(
  plan,
  nr,
  zeit,
  station
) {

  if (
    !plan ||
    typeof plan !== 'object'
  ) {

    throw new Error(
      'Ungültiger Plan.'
    );

  }


  const change =
    dienstplanungAenderungPruefen(
      nr,
      zeit,
      station
    );


  const key =
    String(
      change.nr
    );


  if (
    !plan[key] ||
    typeof plan[key] !== 'object'
  ) {

    plan[key] = {

      nr:
        change.nr,

      raster: {}

    };

  }


  if (
    !plan[key].raster ||
    typeof plan[key].raster !== 'object'
  ) {

    plan[key].raster = {};

  }


  if (change.station) {

    plan[key].raster[
      change.zeit
    ] =
      change.station;

  } else {

    delete plan[key].raster[
      change.zeit
    ];

  }


  return {

    ok: true,

    plan: plan

  };

}


// =====================================================
// DIENST LÖSCHEN
// =====================================================

function dienstplanungLoeschen(
  plan,
  nr,
  zeit
) {

  return dienstplanungAendern(
    plan,
    nr,
    zeit,
    ''
  );

}


// =====================================================
// MEHRERE FELDER ÄNDERN
// =====================================================

function dienstplanungMehrfachAendern(
  plan,
  changes
) {

  if (
    !plan ||
    typeof plan !== 'object'
  ) {

    throw new Error(
      'Ungültiger Plan.'
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


  const resultPlan =
    JSON.parse(
      JSON.stringify(plan)
    );


  changes.forEach(
    change => {

      const checked =
        dienstplanungAenderungPruefen(
          change.nr,
          change.zeit,
          change.station
        );


      const key =
        String(
          checked.nr
        );


      if (
        !resultPlan[key] ||
        typeof resultPlan[key] !== 'object'
      ) {

        resultPlan[key] = {

          nr:
            checked.nr,

          raster: {}

        };

      }


      if (
        !resultPlan[key].raster ||
        typeof resultPlan[key].raster !== 'object'
      ) {

        resultPlan[key].raster = {};

      }


      if (checked.station) {

        resultPlan[key].raster[
          checked.zeit
        ] =
          checked.station;

      } else {

        delete resultPlan[key].raster[
          checked.zeit
        ];

      }

    }
  );


  return {

    ok: true,

    plan:
      resultPlan,

    geaendert:
      changes.length

  };

}


// =====================================================
// KOMPLETTEN PLAN SPEICHERN
// =====================================================

function dienstplanungSpeichern(
  password,
  plan
) {

  if (
    getRole(password) !== 'admin'
  ) {

    throw new Error(
      'Nur der Admin darf den Dienstplan speichern.'
    );

  }


  if (
    !plan ||
    typeof plan !== 'object'
  ) {

    throw new Error(
      'Ungültiger Plan.'
    );

  }


  let gespeichert = 0;


  Object.keys(plan).forEach(
    nr => {

      const entry =
        plan[nr];


      const raster =
        (
          entry &&
          entry.raster &&
          typeof entry.raster === 'object'
        )

        ? entry.raster

        : entry || {};


      // Nur echte Zeitfelder übernehmen

      const cleanRaster = {};


      Object.keys(
        raster
      ).forEach(
        zeit => {

          if (
            !/^([01]\d|2[0-3]):[0-5]\d$/.test(
              zeit
            )
          ) {

            return;

          }


          const station =
            String(
              raster[zeit] || ''
            ).trim();


          if (station) {

            cleanRaster[zeit] =
              station;

          }

        }
      );


      saveGraphPlan(
        password,
        Number(nr),
        cleanRaster
      );


      gespeichert++;

    }
  );


  return {

    ok: true,

    gespeichert:
      gespeichert

  };

}


// =====================================================
// PLAN PRÜFEN
// =====================================================
//
// Beim manuellen Dienstplan genügt eine einfache
// Prüfung der gespeicherten Rasterdaten.
//
// =====================================================

function dienstplanungPruefen(
  plan
) {

  if (
    !plan ||
    typeof plan !== 'object'
  ) {

    return {

      ok: false,

      errors: [
        'Ungültiger Plan.'
      ]

    };

  }


  const errors = [];


  Object.keys(plan).forEach(
    nr => {

      const entry =
        plan[nr];


      const raster =
        (
          entry &&
          entry.raster &&
          typeof entry.raster === 'object'
        )

        ? entry.raster

        : entry || {};


      Object.keys(
        raster
      ).forEach(
        zeit => {

          try {

            dienstplanungAenderungPruefen(
              nr,
              zeit,
              raster[zeit]
            );

          }

          catch (error) {

            errors.push(
              'Helfer ' +
              nr +
              ', ' +
              zeit +
              ': ' +
              error.message
            );

          }

        }
      );

    }
  );


  return {

    ok:
      errors.length === 0,

    errors:
      errors

  };

}
// =====================================================
// FF HOLZHAUSEN – TAGESDIENSTPLAN
// Erweiterung zu 06_Dienstplanung.gs
// =====================================================
// Tagesbezogene Dienstpläne.
// Das bestehende Blatt "Dienstplan" bleibt unangetastet.
// =====================================================

function dienstplanTageSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Dienstplan_Tage');

  if (!sheet) {
    sheet = ss.insertSheet('Dienstplan_Tage');
    sheet.getRange(1,1,1,4).setValues([[
      'Datum','Helfer-Nr.','Zeit','Station'
    ]]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function dienstplanungTagesLaden(password, datum) {
  if (!getRole(password)) {
    throw new Error('Nicht angemeldet.');
  }

  const tag = tagesplanDatum_(datum);
  if (!tag) throw new Error('Ungültiges Veranstaltungsdatum.');

  const ablauf = ablaufplanLaden(password);
  const tage = ablauf.tage || [];
  const tagInfo = tage.find(t => String(t.datum) === tag);

  if (!tagInfo) {
    throw new Error('Der Veranstaltungstag wurde nicht gefunden.');
  }

  const basis = dienstplanungLaden();
  const plan = {};

  const sheet = dienstplanTageSheet_();
  const last = sheet.getLastRow();

  if (last >= 2) {
    const rows = sheet.getRange(2,1,last-1,4).getValues();

    rows.forEach(row => {
      if (tagesplanDatum_(row[0]) !== tag) return;

      const nr = Number(row[1]);
      const zeit = dienstplanungZeit_(row[2]);
      const station = String(row[3] || '').trim();

      if (!nr || !zeit || !station) return;

      if (!plan[String(nr)]) {
        const basisPerson =
          basis.plan && basis.plan[String(nr)]
            ? basis.plan[String(nr)]
            : {};

        plan[String(nr)] = {
          nr: nr,
          name: basisPerson.name || '',
          vorname: basisPerson.vorname || '',
          nachname: basisPerson.nachname || '',
          arrival: basisPerson.arrival || '',
          raster: {}
        };
      }

      plan[String(nr)].raster[zeit] = station;
    });
  }

  // Rückwärtskompatibilität:
  // Wenn für diesen Tag noch kein Tagesplan gespeichert wurde,
  // den bisherigen Dienstplan als Ausgangsbasis verwenden.
  const hatTagdaten = last >= 2 &&
    sheet.getRange(2,1,last-1,1).getValues()
      .some(r => tagesplanDatum_(r[0]) === tag);

  if (!hatTagdaten) {
    Object.keys(basis.plan || {}).forEach(nr => {
      plan[nr] = cloneObj_(basis.plan[nr]);
    });
  }

  return {
    ok: true,
    datum: tag,
    beginn: tagInfo.beginn || basis.start,
    ende: tagInfo.ende || basis.end,
    start: tagInfo.beginn || basis.start,
    end: tagInfo.ende || basis.end,
    step: basis.step || 30,
    plan: plan
  };
}

function dienstplanungTagesSpeichern(password, datum, plan) {
  if (getRole(password) !== 'admin') {
    throw new Error('Nur der Admin darf den Dienstplan speichern.');
  }

  const tag = tagesplanDatum_(datum);
  if (!tag) throw new Error('Ungültiges Veranstaltungsdatum.');

  const sheet = dienstplanTageSheet_();
  const last = sheet.getLastRow();

  // NICHT deleteRow() verwenden: Bei einem Blatt mit nur einer
  // fixierten Kopfzeile würde das Löschen aller Datenzeilen von
  // Google Sheets abgelehnt werden. Stattdessen lesen wir die
  // vorhandenen Tagesdaten, behalten alle anderen Tage und bauen
  // den Datenbereich anschließend komplett neu auf.
  let vorhandeneZeilen = [];
  if (last >= 2) {
    const vorhandene = sheet.getRange(2, 1, last - 1, 4).getValues();
    vorhandeneZeilen = vorhandene.filter(function(row) {
      return tagesplanDatum_(row[0]) !== tag;
    });
  }

  const rows = [];

  // Stationszeiten des aktuell gespeicherten Veranstaltungstages laden.
  // Dadurch kann kein Dienst außerhalb der für diesen Tag gepflegten
  // Stationszeit gespeichert werden.
  const stations = stationenLaden(password) || [];
  const stationMap = {};
  stations.forEach(function(station) {
    stationMap[String(station.name).trim()] = station;
  });

  const veranstaltungstage = (ablaufplanLaden(password).tage || []);
  const tagIndex = veranstaltungstage.findIndex(function(t) {
    return tagesplanDatum_(t && t.datum) === tag;
  });

  function stationAnTagVerfuegbar(station, zeit) {
    if (!station) return false;

    const tage = Array.isArray(station.tage) ? station.tage : [];
    if (!tage.length) return true; // alte Station ohne Tageszeiten

    // Stationsverwaltung speichert den Veranstaltungstag teils nur als Tagnummer.
    // Datumseinträge haben Vorrang; ein undatierter Eintrag gilt ausschließlich
    // für den gleich nummerierten Veranstaltungstag.
    const day = tage.find(function(t) {
      return tagesplanDatum_(t && t.datum) === tag;
    }) || tage.find(function(t) {
      return !String(t && t.datum || '').trim() &&
             tagIndex >= 0 && Number(t && t.tag) === tagIndex + 1;
    });
    if (!day) return false;

    const von = dienstplanungZeit_(day.von || day.start);
    const bis = dienstplanungZeit_(day.bis || day.end);
    if (!von || !bis) return false;

    return dienstplanungZeitMinuten_(zeit) >= dienstplanungZeitMinuten_(von) &&
           dienstplanungZeitMinuten_(zeit) < dienstplanungZeitMinuten_(bis);
  }

  Object.keys(plan || {}).forEach(nr => {
    const entry = plan[nr] || {};
    const raster = entry.raster || entry || {};

    Object.keys(raster).forEach(zeit => {
      const cleanTime = dienstplanungZeit_(zeit);
      const station = String(raster[zeit] || '').trim();

      if (!cleanTime || !station) return;

      const stationObj = stationMap[station];
      if (!stationObj) {
        throw new Error('Unbekannte Station "' + station + '" im Dienstplan.');
      }

      if (!stationAnTagVerfuegbar(stationObj, cleanTime)) {
        throw new Error(
          'Station "' + station + '" ist am ' + tag +
          ' um ' + cleanTime + ' Uhr nicht verfügbar.'
        );
      }

      rows.push([
        tag,
        Number(nr),
        cleanTime,
        station
      ]);
    });
  });

  // Kopfzeile bleibt unangetastet. Alle vorhandenen Datenzeilen
  // werden nur geleert, niemals gelöscht. Danach schreiben wir die
  // erhaltenen Tage plus den gerade gespeicherten Tag zurück.
  const datenZeilen = vorhandeneZeilen.concat(rows);
  const maxDataRows = Math.max(last - 1, datenZeilen.length, 1);

  sheet.getRange(2, 1, maxDataRows, 4).clearContent();

  if (datenZeilen.length) {
    sheet.getRange(2, 1, datenZeilen.length, 4).setValues(datenZeilen);
  }

  // Schreibvorgang vor dem direkten Rücklesen abschließen.
  SpreadsheetApp.flush();

  const saved = dienstplanungTagesLaden(password, tag);
  saved.gespeichert = rows.length;
  saved.gespeicherteZeilen = rows.length;
  return saved;
}

function dienstplanungZeitMinuten_(value) {
  const m = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}

function tagesplanDatum_(value) {
  if (value === null || value === undefined || value === '') return '';

  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone(),
      'yyyy-MM-dd'
    );
  }

  const text = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const de = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (de) {
    return de[3] + '-' +
      ('0' + de[2]).slice(-2) + '-' +
      ('0' + de[1]).slice(-2);
  }

  return '';
}

function cloneObj_(value) {
  return JSON.parse(JSON.stringify(value || {}));
}
