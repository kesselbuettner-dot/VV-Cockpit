// =====================================================
// FF HOLZHAUSEN – HELFER-DIENSTPLAN
// 04_Kontakte.gs
// =====================================================
//
// Kontaktabgleich – zunächst NUR PRÜFUNG
//
// Es werden keine Daten im Sheet verändert.
// =====================================================


/**
 * Startet die Kontaktprüfung.
 *
 * Ausgabe:
 * - gefundene Kontakte
 * - eindeutige Treffer
 * - mögliche Schreibabweichungen
 * - Mehrfachtreffer
 * - nicht gefundene Helfer
 */
function kontaktePruefen() {

  const helfer =
    dbGetHelpers();

  const kontakte =
    kontakteAusGoogleLaden();


  const ergebnis = {

    helferGesamt:
      helfer.length,

    kontakteGesamt:
      kontakte.length,

    eindeutig: [],

    abweichung: [],

    mehrfach: [],

    nichtGefunden: []

  };


  helfer.forEach(
    helferPerson => {

      const treffer =
        kontakte.filter(
          kontakt =>
            kontakteNamenVergleichen(
              helferPerson.vorname,
              helferPerson.nachname,
              kontakt.vorname,
              kontakt.nachname
            )
        );


      // ---------------------------------------------
      // Kein Treffer
      // ---------------------------------------------
if (treffer.length === 0) {

  const kandidaten = [];

  kontakte.forEach(kontakt => {

    const bewertung =
      kontakteAehnlichkeit(
        helferPerson.vorname,
        helferPerson.nachname,
        kontakt.vorname,
        kontakt.nachname
      );

    // Nur halbwegs ähnliche Namen aufnehmen.
    if (bewertung.gesamtScore >= 65) {

      kandidaten.push({

        kontaktName:
          kontakteName(
            kontakt.vorname,
            kontakt.nachname
          ),

        email:
          kontakt.email,

        vornameScore:
          bewertung.vornameScore,

        nachnameScore:
          bewertung.nachnameScore,

        gesamtScore:
          bewertung.gesamtScore

      });

    }

  });


  // Beste Kandidaten zuerst
  kandidaten.sort(
    (a, b) =>
      b.gesamtScore -
      a.gesamtScore
  );


  // Die besten Kandidaten für die Prüfung
  // separat ausgeben.
  if (kandidaten.length > 0) {

    ergebnis.abweichung.push({

      nr:
        helferPerson.nr,

      helferName:
        kontakteName(
          helferPerson.vorname,
          helferPerson.nachname
        ),

      kandidaten:
        kandidaten.slice(0, 3)

    });

  } else {

    ergebnis.nichtGefunden.push({

      nr:
        helferPerson.nr,

      name:
        kontakteName(
          helferPerson.vorname,
          helferPerson.nachname
        )

    });

  }

  return;
}

      // ---------------------------------------------
      // Mehrere Treffer
      // ---------------------------------------------

      if (treffer.length > 1) {

        ergebnis.mehrfach.push({

          nr:
            helferPerson.nr,

          name:
            kontakteName(
              helferPerson.vorname,
              helferPerson.nachname
            ),

          treffer:
            treffer

        });

        return;

      }


      // ---------------------------------------------
      // Genau ein Treffer
      // ---------------------------------------------

      const kontakt =
        treffer[0];


      const exakterName =
        kontakteNormalisieren(
          helferPerson.vorname
        ) ===
        kontakteNormalisieren(
          kontakt.vorname
        )
        &&
        kontakteNormalisieren(
          helferPerson.nachname
        ) ===
        kontakteNormalisieren(
          kontakt.nachname
        );


      if (exakterName) {

        ergebnis.eindeutig.push({

          nr:
            helferPerson.nr,

          name:
            kontakteName(
              helferPerson.vorname,
              helferPerson.nachname
            ),

          email:
            kontakt.email

        });

      } else {

        ergebnis.abweichung.push({

          nr:
            helferPerson.nr,

          helferName:
            kontakteName(
              helferPerson.vorname,
              helferPerson.nachname
            ),

          kontaktName:
            kontakteName(
              kontakt.vorname,
              kontakt.nachname
            ),

          email:
            kontakt.email

        });

      }

    }
  );


  console.log(
    '===== KONTAKTPRÜFUNG ====='
  );

  console.log(
    JSON.stringify(
      ergebnis,
      null,
      2
    )
  );


  return ergebnis;

}


/**
 * Google-Kontakte laden.
 *
 * WICHTIG:
 * Diese Funktion verwendet den
 * vorhandenen Google-Apps-Script-Kontaktzugriff.
 */
function kontakteAusGoogleLaden() {

  const kontakte = [];
  let pageToken = null;

  do {

    const response = People.People.Connections.list(
      'people/me',
      {
        personFields: 'names,emailAddresses',
        pageSize: 1000,
        pageToken: pageToken
      }
    );

    const personen =
      response.connections || [];

    personen.forEach(person => {

      const names =
        person.names || [];

      const emails =
        person.emailAddresses || [];

      if (names.length === 0) {
        return;
      }

      const name =
        names[0];

      const vorname =
        String(
          name.givenName || ''
        ).trim();

      const nachname =
        String(
          name.familyName || ''
        ).trim();

      let email = '';

      if (emails.length > 0) {
        email =
          String(
            emails[0].value || ''
          ).trim();
      }

      if (
        !vorname &&
        !nachname
      ) {
        return;
      }

      kontakte.push({

        vorname: vorname,

        nachname: nachname,

        email: email

      });

    });

    pageToken =
      response.nextPageToken || null;

  } while (pageToken);


  return kontakte;

}


/**
 * Namen robust normalisieren.
 *
 * Beispiele:
 *
 * " Meißner "
 * "Meissner"
 *
 * werden für den Vergleich ähnlich behandelt.
 */
function kontakteNormalisieren(
  text
) {

  return String(
    text || ''
  )

    .trim()

    .toLowerCase()

    .replace(
      /ß/g,
      'ss'
    )

    .replace(
      /ä/g,
      'ae'
    )

    .replace(
      /ö/g,
      'oe'
    )

    .replace(
      /ü/g,
      'ue'
    )

    .replace(
      /[^a-z0-9]/g,
      ''
    );

}


/**
 * Namensvergleich.
 */

function kontakteNamenVergleichen(
  vorname1,
  nachname1,
  vorname2,
  nachname2
) {

  const v1 = kontakteNormalisieren(vorname1);
  const n1 = kontakteNormalisieren(nachname1);

  const v2 = kontakteNormalisieren(vorname2);
  const n2 = kontakteNormalisieren(nachname2);

  // Exakter Treffer
  if (v1 === v2 && n1 === n2) {
    return true;
  }

  // Für den eigentlichen Prüfmodus werden
  // Abweichungen später separat bewertet.
  return false;
}

/**
 * Ähnlichkeit
 */

function kontakteAehnlichkeit(
  vorname1,
  nachname1,
  vorname2,
  nachname2
) {

  const v1 = kontakteNormalisieren(vorname1);
  const n1 = kontakteNormalisieren(nachname1);

  const v2 = kontakteNormalisieren(vorname2);
  const n2 = kontakteNormalisieren(nachname2);

  const vornameScore =
    stringAehnlichkeit(v1, v2);

  const nachnameScore =
    stringAehnlichkeit(n1, n2);

  // Der Nachname ist wichtiger als der Vorname.
  const gesamt =
    (vornameScore * 0.4) +
    (nachnameScore * 0.6);

  return {

    vornameScore:
      Math.round(vornameScore * 100),

    nachnameScore:
      Math.round(nachnameScore * 100),

    gesamtScore:
      Math.round(gesamt * 100)

  };
}


/**
 * Ähnlichkeit zweier Zeichenketten.
 *
 * 1.0 = identisch
 * 0.0 = völlig verschieden
 */
function stringAehnlichkeit(
  a,
  b
) {

  if (a === b) {
    return 1;
  }

  if (!a || !b) {
    return 0;
  }

  const entfernung =
    levenshteinDistanz(a, b);

  const maxLaenge =
    Math.max(
      a.length,
      b.length
    );

  return 1 -
    (
      entfernung /
      maxLaenge
    );
}


/**
 * Levenshtein-Distanz.
 *
 * Ermittelt, wie viele Zeichenänderungen
 * nötig sind, um einen Text in einen
 * anderen umzuwandeln.
 */
function levenshteinDistanz(
  a,
  b
) {

  const matrix = [];

  for (
    let i = 0;
    i <= b.length;
    i++
  ) {

    matrix[i] = [i];

  }

  for (
    let j = 0;
    j <= a.length;
    j++
  ) {

    matrix[0][j] = j;

  }

  for (
    let i = 1;
    i <= b.length;
    i++
  ) {

    for (
      let j = 1;
      j <= a.length;
      j++
    ) {

      if (
        b.charAt(i - 1)
        ===
        a.charAt(j - 1)
      ) {

        matrix[i][j] =
          matrix[i - 1][j - 1];

      } else {

        matrix[i][j] =
          Math.min(

            matrix[i - 1][j - 1] + 1,

            matrix[i][j - 1] + 1,

            matrix[i - 1][j] + 1

          );

      }

    }

  }

  return matrix[b.length][a.length];

}


/**
 * Lesbare Namensdarstellung.
 */
function kontakteName(
  vorname,
  nachname
) {

  return (

    String(
      vorname || ''
    ).trim()

    +

    ' '

    +

    String(
      nachname || ''
    ).trim()

  ).trim();

}
/**
 * Prüft OCR-Namen gegen Google Kontakte.
 *
 * WICHTIG:
 * Diese Funktion verändert KEINE Daten.
 * Sie erzeugt nur einen Prüfbericht.
 */
function kontakteOcrPruefung() {

  const helfer = dbGetHelpers();
  const kontakte = kontakteAusGoogleLaden();

  const ergebnis = [];

  helfer.forEach(helferPerson => {

    const exakt = kontakte.filter(kontakt =>
      kontakteNamenVergleichen(
        helferPerson.vorname,
        helferPerson.nachname,
        kontakt.vorname,
        kontakt.nachname
      )
    );

    // Exakter Treffer
    if (exakt.length === 1) {

      ergebnis.push({
        nr: helferPerson.nr,
        ocrName: kontakteName(
          helferPerson.vorname,
          helferPerson.nachname
        ),
        kontaktName: kontakteName(
          exakt[0].vorname,
          exakt[0].nachname
        ),
        email: exakt[0].email,
        score: 100,
        status: 'EINDEUTIG'
      });

      return;
    }

    // Ähnliche Kontakte suchen
    const kandidaten = [];

    kontakte.forEach(kontakt => {

      const score = kontakteAehnlichkeit(
        helferPerson.vorname,
        helferPerson.nachname,
        kontakt.vorname,
        kontakt.nachname
      );

      kandidaten.push({
        kontaktName: kontakteName(
          kontakt.vorname,
          kontakt.nachname
        ),
        email: kontakt.email,
        vornameScore: score.vornameScore,
        nachnameScore: score.nachnameScore,
        gesamtScore: score.gesamtScore
      });

    });

    kandidaten.sort(
      (a, b) => b.gesamtScore - a.gesamtScore
    );

    const bester = kandidaten[0];
    const zweiter = kandidaten[1];

    if (!bester) {
      ergebnis.push({
        nr: helferPerson.nr,
        ocrName: kontakteName(
          helferPerson.vorname,
          helferPerson.nachname
        ),
        status: 'NICHT GEFUNDEN'
      });
      return;
    }

    const abstand =
      zweiter
        ? bester.gesamtScore - zweiter.gesamtScore
        : 100;

    let status = 'PRÜFEN';

    /*
     * AUTOMATISCH SICHER:
     *
     * Vorname sehr ähnlich
     * UND Nachname sehr ähnlich
     * UND deutlicher Abstand zum nächsten Treffer
     */
    if (
      bester.vornameScore >= 90 &&
      bester.nachnameScore >= 80 &&
      bester.gesamtScore >= 85 &&
      abstand >= 8
    ) {
      status = 'WAHRSCHEINLICH';
    }

    /*
     * UNSICHER:
     *
     * Vorname passt nicht ausreichend
     * oder mehrere Kandidaten sind ähnlich.
     */
    if (
      bester.vornameScore < 70 ||
      abstand < 8
    ) {
      status = 'NICHT SICHER';
    }

    ergebnis.push({
      nr: helferPerson.nr,

      ocrName: kontakteName(
        helferPerson.vorname,
        helferPerson.nachname
      ),

      besterKontakt:
        bester.kontaktName,

      email:
        bester.email,

      vornameScore:
        bester.vornameScore,

      nachnameScore:
        bester.nachnameScore,

      gesamtScore:
        bester.gesamtScore,

      abstandZumZweiten:
        abstand,

      status:
        status,

      zweiterKandidat:
        zweiter
          ? zweiter.kontaktName
          : ''

    });

  });


  console.log(
    '===== OCR-KONTAKTPRÜFUNG ====='
  );

  console.log(
    JSON.stringify(
      ergebnis,
      null,
      2
    )
  );

  return ergebnis;
}
function kontakteOcrVorschlaege() {

  const daten = kontakteOcrPruefung();

  const vorschlaege = daten.filter(
    eintrag =>
      eintrag.status === 'WAHRSCHEINLICH'
  );

  console.log(
    '===== VORSCHLÄGE ZUR KORREKTUR ====='
  );

  vorschlaege.forEach(eintrag => {

    console.log(
      'Nr. ' +
      eintrag.nr +
      ' | ' +
      eintrag.ocrName +
      ' → ' +
      eintrag.besterKontakt +
      ' | ' +
      eintrag.gesamtScore +
      '% | ' +
      eintrag.email
    );

  });

  console.log(
    'Anzahl Vorschläge: ' +
    vorschlaege.length
  );

  return vorschlaege;
}

/**
 * Übernimmt bestätigte OCR-Korrekturen.
 *
 * SICHERHEIT:
 * Es werden nur Einträge übernommen,
 * die vorher als "WAHRSCHEINLICH" erkannt wurden.
 *
 * Aktuell noch mit zusätzlicher Bestätigung
 * über die Variable BESTAETIGEN.
 */

/**
 * Übernimmt bestätigte OCR-Korrekturen.
 *
 * Regeln:
 * 1. Nur Status "WAHRSCHEINLICH" wird übernommen.
 * 2. Die bisherige manuelle Nr.-Liste entfällt.
 * 3. Name und E-Mail werden aus dem Google-Kontakt übernommen.
 * 4. Unsichere Treffer werden NICHT verändert.
 */
function kontakteOcrUebernehmen() {

  console.log('===== OCR-ÜBERNAHME START =====');

  const vorschlaege =
    kontakteOcrVorschlaege();

  if (
    !vorschlaege ||
    vorschlaege.length === 0
  ) {

    console.log(
      'Keine sicheren Korrekturvorschläge vorhanden.'
    );

    return;

  }


  const sheet =
    dbGetSpreadsheet()
      .getSheetByName(
        APP.SHEETS.HELFER
      );


  if (!sheet) {

    throw new Error(
      'Tabellenblatt "Helferliste" wurde nicht gefunden.'
    );

  }


  const daten =
    sheet
      .getDataRange()
      .getValues();


  if (
    daten.length < 2
  ) {

    console.log(
      'Helferliste enthält keine Daten.'
    );

    return;

  }


  // ---------------------------------------------------
  // E-Mail-Spalte suchen
  // ---------------------------------------------------

  let emailSpalte = -1;


  for (
    let c = 0;
    c < daten[0].length;
    c++
  ) {

    const kopf =
      String(
        daten[0][c] || ''
      )
      .trim()
      .toLowerCase();


    if (
      kopf === 'e-mail' ||
      kopf === 'email'
    ) {

      emailSpalte =
        c + 1;

      break;

    }

  }


  // Falls noch keine E-Mail-Spalte existiert:
  if (
    emailSpalte === -1
  ) {

    emailSpalte =
      daten[0].length + 1;


    sheet
      .getRange(
        1,
        emailSpalte
      )
      .setValue(
        'E-Mail'
      );


    console.log(
      'E-Mail-Spalte angelegt: ' +
      emailSpalte
    );

  }


  // ---------------------------------------------------
  // Helfer bearbeiten
  // ---------------------------------------------------

  let uebernommen = 0;


  vorschlaege.forEach(
    eintrag => {

      // -----------------------------------------------
      // Sicherheit:
      // Nur WAHRSCHEINLICH übernehmen
      // -----------------------------------------------

      if (
        eintrag.status !==
        'WAHRSCHEINLICH'
      ) {

        console.log(
          'NICHT übernommen: Nr. ' +
          eintrag.nr +
          ' | Status: ' +
          eintrag.status
        );

        return;

      }


      const nr =
        Number(
          eintrag.nr
        );


      // -----------------------------------------------
      // Helferzeile anhand Nr. suchen
      // -----------------------------------------------

      let zielZeile = -1;


      for (
        let i = 1;
        i < daten.length;
        i++
      ) {

        if (
          Number(
            daten[i][0]
          ) === nr
        ) {

          zielZeile =
            i + 1;

          break;

        }

      }


      if (
        zielZeile === -1
      ) {

        console.log(
          'Nr. ' +
          nr +
          ': Helfer nicht gefunden.'
        );

        return;

      }


      // -----------------------------------------------
      // Aktuelle Daten lesen
      // -----------------------------------------------

      const alterNachname =
        String(
          sheet
            .getRange(
              zielZeile,
              2
            )
            .getValue() ||
          ''
        )
        .trim();


      const alterVorname =
        String(
          sheet
            .getRange(
              zielZeile,
              3
            )
            .getValue() ||
          ''
        )
        .trim();


      const alteEmail =
        String(
          sheet
            .getRange(
              zielZeile,
              emailSpalte
            )
            .getValue() ||
          ''
        )
        .trim();


      // -----------------------------------------------
      // Kontaktname aus dem geprüften Kontakt
      // -----------------------------------------------

      const kontaktName =
        String(
          eintrag.besterKontakt ||
          ''
        )
        .trim();


      const trennstelle =
        kontaktName.lastIndexOf(' ');


      if (
        trennstelle === -1
      ) {

        console.log(
          'Nr. ' +
          nr +
          ': Kontaktname ungültig: ' +
          kontaktName
        );

        return;

      }


      const neuerVorname =
        kontaktName
          .substring(
            0,
            trennstelle
          )
          .trim();


      const neuerNachname =
        kontaktName
          .substring(
            trennstelle + 1
          )
          .trim();


      // -----------------------------------------------
      // Änderung durchführen
      // -----------------------------------------------

      sheet
        .getRange(
          zielZeile,
          2
        )
        .setValue(
          neuerNachname
        );


      sheet
        .getRange(
          zielZeile,
          3
        )
        .setValue(
          neuerVorname
        );


      sheet
        .getRange(
          zielZeile,
          emailSpalte
        )
        .setValue(
          eintrag.email || ''
        );


      uebernommen++;


      console.log(
        'ÜBERNOMMEN: Nr. ' +
        nr
      );


      console.log(
        'Name: ' +
        alterVorname +
        ' ' +
        alterNachname +
        ' → ' +
        neuerVorname +
        ' ' +
        neuerNachname
      );


      console.log(
        'E-Mail: ' +
        (alteEmail || '(leer)') +
        ' → ' +
        (eintrag.email || '(leer)')
      );

    }
  );


  console.log(
    '===== OCR-ÜBERNAHME ENDE ====='
  );


  console.log(
    'Anzahl übernommen: ' +
    uebernommen
  );

}

/**
 * Übernimmt E-Mail-Adressen für alle eindeutig
 * zugeordneten Helfer aus Google Kontakte.
 *
 * Wichtig:
 * - Exakte Namen werden automatisch übernommen.
 * - OCR-Korrekturen werden NICHT verändert.
 * - Unsichere / mehrdeutige Namen werden übersprungen.
 * - Bereits vorhandene E-Mail-Adressen werden nicht überschrieben.
 */
function kontakteEmailsUebernehmen() {

  console.log('===== E-MAIL-ÜBERNAHME START =====');

  const helfer =
    dbGetHelpers();

  const kontakte =
    kontakteAusGoogleLaden();

  const sheet =
    dbGetSpreadsheet()
      .getSheetByName(
        APP.SHEETS.HELFER
      );

  if (!sheet) {
    throw new Error(
      'Tabellenblatt "Helferliste" wurde nicht gefunden.'
    );
  }

  const daten =
    sheet
      .getDataRange()
      .getValues();

  if (daten.length < 2) {
    console.log(
      'Keine Helferdaten vorhanden.'
    );
    return;
  }


  // ---------------------------------------------------
  // E-Mail-Spalte suchen
  // ---------------------------------------------------

  let emailSpalte = -1;

  for (
    let c = 0;
    c < daten[0].length;
    c++
  ) {

    const kopf =
      String(
        daten[0][c] || ''
      )
      .trim()
      .toLowerCase();

    if (
      kopf === 'e-mail' ||
      kopf === 'email'
    ) {

      emailSpalte =
        c + 1;

      break;

    }

  }


  // Falls keine E-Mail-Spalte existiert
  if (emailSpalte === -1) {

    emailSpalte =
      daten[0].length + 1;

    sheet
      .getRange(
        1,
        emailSpalte
      )
      .setValue(
        'E-Mail'
      );

    console.log(
      'E-Mail-Spalte angelegt: ' +
      emailSpalte
    );

  }


  let übernommen = 0;
  let bereitsVorhanden = 0;
  let nichtGefunden = 0;
  let mehrfach = 0;


  // ---------------------------------------------------
  // Alle Helfer prüfen
  // ---------------------------------------------------

  helfer.forEach(
    helferPerson => {

      const treffer =
        kontakte.filter(
          kontakt =>
            kontakteNamenVergleichen(
              helferPerson.vorname,
              helferPerson.nachname,
              kontakt.vorname,
              kontakt.nachname
            )
        );


      // ------------------------------------------------
      // Kein eindeutiger Kontakt
      // ------------------------------------------------

      if (
        treffer.length === 0
      ) {

        console.log(
          'NICHT GEFUNDEN: Nr. ' +
          helferPerson.nr +
          ' | ' +
          kontakteName(
            helferPerson.vorname,
            helferPerson.nachname
          )
        );

        nichtGefunden++;

        return;

      }


      // ------------------------------------------------
      // Mehrere Kontakte mit gleichem Namen
      // ------------------------------------------------

      if (
        treffer.length > 1
      ) {

        console.log(
          'MEHRFACH: Nr. ' +
          helferPerson.nr +
          ' | ' +
          kontakteName(
            helferPerson.vorname,
            helferPerson.nachname
          )
        );

        mehrfach++;

        return;

      }


      const kontakt =
        treffer[0];

      const email =
        String(
          kontakt.email || ''
        )
        .trim();


      // Kontakt ohne E-Mail
      if (!email) {

        console.log(
          'KEINE E-MAIL: Nr. ' +
          helferPerson.nr +
          ' | ' +
          kontakteName(
            helferPerson.vorname,
            helferPerson.nachname
          )
        );

        return;

      }


      // ------------------------------------------------
      // Helferzeile anhand Nr. suchen
      // ------------------------------------------------

      let zielZeile = -1;

      for (
        let i = 1;
        i < daten.length;
        i++
      ) {

        if (
          Number(
            daten[i][0]
          ) === Number(
            helferPerson.nr
          )
        ) {

          zielZeile =
            i + 1;

          break;

        }

      }


      if (
        zielZeile === -1
      ) {

        return;

      }


      // ------------------------------------------------
      // Bestehende E-Mail prüfen
      // ------------------------------------------------

      const alteEmail =
        String(
          sheet
            .getRange(
              zielZeile,
              emailSpalte
            )
            .getValue() || ''
        )
        .trim();


      // Bereits vorhandene E-Mail NICHT überschreiben
      if (alteEmail) {

        console.log(
          'BEREITS VORHANDEN: Nr. ' +
          helferPerson.nr +
          ' | ' +
          alteEmail
        );

        bereitsVorhanden++;

        return;

      }


      // ------------------------------------------------
      // E-Mail übernehmen
      // ------------------------------------------------

      sheet
        .getRange(
          zielZeile,
          emailSpalte
        )
        .setValue(
          email
        );


      übernommen++;

      console.log(
        'E-MAIL ÜBERNOMMEN: Nr. ' +
        helferPerson.nr +
        ' | ' +
        kontakteName(
          helferPerson.vorname,
          helferPerson.nachname
        ) +
        ' | ' +
        email
      );

    }
  );


  console.log(
    '===== E-MAIL-ÜBERNAHME ENDE ====='
  );

  console.log(
    'Übernommen: ' +
    übernommen
  );

  console.log(
    'Bereits vorhanden: ' +
    bereitsVorhanden
  );

  console.log(
    'Nicht gefunden: ' +
    nichtGefunden
  );

  console.log(
    'Mehrfach: ' +
    mehrfach
  );

}
/**
 * Übernimmt E-Mail-Adressen für alle eindeutig
 * zugeordneten Helfer aus Google Kontakte.
 *
 * Wichtig:
 * - Exakte Namen werden automatisch übernommen.
 * - OCR-Korrekturen werden NICHT verändert.
 * - Unsichere / mehrdeutige Namen werden übersprungen.
 * - Bereits vorhandene E-Mail-Adressen werden nicht überschrieben.
 */
function kontakteEmailsUebernehmen() {

  console.log('===== E-MAIL-ÜBERNAHME START =====');

  const helfer =
    dbGetHelpers();

  const kontakte =
    kontakteAusGoogleLaden();

  const sheet =
    dbGetSpreadsheet()
      .getSheetByName(
        APP.SHEETS.HELFER
      );

  if (!sheet) {
    throw new Error(
      'Tabellenblatt "Helferliste" wurde nicht gefunden.'
    );
  }

  const daten =
    sheet
      .getDataRange()
      .getValues();

  if (daten.length < 2) {
    console.log(
      'Keine Helferdaten vorhanden.'
    );
    return;
  }


  // ---------------------------------------------------
  // E-Mail-Spalte suchen
  // ---------------------------------------------------

  let emailSpalte = -1;

  for (
    let c = 0;
    c < daten[0].length;
    c++
  ) {

    const kopf =
      String(
        daten[0][c] || ''
      )
      .trim()
      .toLowerCase();

    if (
      kopf === 'e-mail' ||
      kopf === 'email'
    ) {

      emailSpalte =
        c + 1;

      break;

    }

  }


  // Falls keine E-Mail-Spalte existiert
  if (emailSpalte === -1) {

    emailSpalte =
      daten[0].length + 1;

    sheet
      .getRange(
        1,
        emailSpalte
      )
      .setValue(
        'E-Mail'
      );

    console.log(
      'E-Mail-Spalte angelegt: ' +
      emailSpalte
    );

  }


  let übernommen = 0;
  let bereitsVorhanden = 0;
  let nichtGefunden = 0;
  let mehrfach = 0;


  // ---------------------------------------------------
  // Alle Helfer prüfen
  // ---------------------------------------------------

  helfer.forEach(
    helferPerson => {

      const treffer =
        kontakte.filter(
          kontakt =>
            kontakteNamenVergleichen(
              helferPerson.vorname,
              helferPerson.nachname,
              kontakt.vorname,
              kontakt.nachname
            )
        );


      // ------------------------------------------------
      // Kein eindeutiger Kontakt
      // ------------------------------------------------

      if (
        treffer.length === 0
      ) {

        console.log(
          'NICHT GEFUNDEN: Nr. ' +
          helferPerson.nr +
          ' | ' +
          kontakteName(
            helferPerson.vorname,
            helferPerson.nachname
          )
        );

        nichtGefunden++;

        return;

      }


      // ------------------------------------------------
      // Mehrere Kontakte mit gleichem Namen
      // ------------------------------------------------

      if (
        treffer.length > 1
      ) {

        console.log(
          'MEHRFACH: Nr. ' +
          helferPerson.nr +
          ' | ' +
          kontakteName(
            helferPerson.vorname,
            helferPerson.nachname
          )
        );

        mehrfach++;

        return;

      }


      const kontakt =
        treffer[0];

      const email =
        String(
          kontakt.email || ''
        )
        .trim();


      // Kontakt ohne E-Mail
      if (!email) {

        console.log(
          'KEINE E-MAIL: Nr. ' +
          helferPerson.nr +
          ' | ' +
          kontakteName(
            helferPerson.vorname,
            helferPerson.nachname
          )
        );

        return;

      }


      // ------------------------------------------------
      // Helferzeile anhand Nr. suchen
      // ------------------------------------------------

      let zielZeile = -1;

      for (
        let i = 1;
        i < daten.length;
        i++
      ) {

        if (
          Number(
            daten[i][0]
          ) === Number(
            helferPerson.nr
          )
        ) {

          zielZeile =
            i + 1;

          break;

        }

      }


      if (
        zielZeile === -1
      ) {

        return;

      }


      // ------------------------------------------------
      // Bestehende E-Mail prüfen
      // ------------------------------------------------

      const alteEmail =
        String(
          sheet
            .getRange(
              zielZeile,
              emailSpalte
            )
            .getValue() || ''
        )
        .trim();


      // Bereits vorhandene E-Mail NICHT überschreiben
      if (alteEmail) {

        console.log(
          'BEREITS VORHANDEN: Nr. ' +
          helferPerson.nr +
          ' | ' +
          alteEmail
        );

        bereitsVorhanden++;

        return;

      }


      // ------------------------------------------------
      // E-Mail übernehmen
      // ------------------------------------------------

      sheet
        .getRange(
          zielZeile,
          emailSpalte
        )
        .setValue(
          email
        );


      übernommen++;

      console.log(
        'E-MAIL ÜBERNOMMEN: Nr. ' +
        helferPerson.nr +
        ' | ' +
        kontakteName(
          helferPerson.vorname,
          helferPerson.nachname
        ) +
        ' | ' +
        email
      );

    }
  );


  console.log(
    '===== E-MAIL-ÜBERNAHME ENDE ====='
  );

  console.log(
    'Übernommen: ' +
    übernommen
  );

  console.log(
    'Bereits vorhanden: ' +
    bereitsVorhanden
  );

  console.log(
    'Nicht gefunden: ' +
    nichtGefunden
  );

  console.log(
    'Mehrfach: ' +
    mehrfach
  );

}